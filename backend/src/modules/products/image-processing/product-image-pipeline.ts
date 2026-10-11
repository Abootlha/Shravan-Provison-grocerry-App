/**
 * Product image "pack shot" pipeline: optional background removal followed by
 * normalisation (trim transparent border, centre on a square transparent
 * canvas with a small margin, max 800px, compressed PNG).
 *
 * Framework-free on purpose: the NestJS ImageProcessingService wraps it, and
 * scripts/normalize-product-images.js loads the same code (compiled from dist/,
 * or via ts-node from src/), so the API and the batch job behave identically.
 *
 * Storage: product images are stored as strings on the product document
 * (`image` / `images[]`), either http(s) URLs or base64 `data:image/...` URIs.
 * There is no upload/storage service, so the processed result is returned as a
 * PNG data URI, the same form admin uploads already use.
 */
import { execFile as nodeExecFile } from 'child_process';
import { lookup as nodeLookup } from 'dns/promises';
import { promises as fs } from 'fs';
import { isIP } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

export type BgProvider = 'none' | 'removebg' | 'local';
export const BG_PROVIDERS: readonly BgProvider[] = [
  'none',
  'removebg',
  'local',
];

export const MAX_OUTPUT_SIDE = 800;
export const CANVAS_MARGIN_RATIO = 0.06;
/** Raw input bytes accepted (upload or downloaded file). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Must stay within the DTO data-URI cap (image-source.validator.ts). */
export const MAX_OUTPUT_DATA_URI_LENGTH = 1_500_000;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_REDIRECTS = 3;
const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

export interface PipelineConfig {
  provider: BgProvider;
  removeBgApiKey?: string;
  rembgBin: string;
  /** Timeout for remote calls / the rembg process, ms. */
  timeoutMs: number;
}

export interface PipelineLogger {
  warn(message: string): void;
}

type ExecFileFn = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
  callback: (error: Error | null) => void,
) => unknown;

/** Injectable side-effects (overridden in tests). */
export interface PipelineDeps {
  fetch?: typeof fetch;
  execFile?: ExecFileFn;
  lookup?: (host: string) => Promise<{ address: string }[]>;
  logger?: PipelineLogger;
}

export interface ProcessedImage {
  buffer: Buffer;
  dataUri: string;
  width: number;
  height: number;
  provider: BgProvider;
  backgroundRemoved: boolean;
  warnings: string[];
}

export class ImageInputError extends Error {}

export function resolvePipelineConfig(
  env: Record<string, string | undefined>,
): PipelineConfig {
  const raw = (env.PRODUCT_IMAGE_BG_PROVIDER || 'none').trim().toLowerCase();
  const provider = (BG_PROVIDERS as readonly string[]).includes(raw)
    ? (raw as BgProvider)
    : 'none';
  const timeout = parseInt(env.PRODUCT_IMAGE_TIMEOUT_MS || '', 10);
  return {
    provider,
    removeBgApiKey: env.REMOVE_BG_API_KEY || undefined,
    rembgBin: env.REMBG_BIN || 'rembg',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 60_000,
  };
}

/** True when the provider can actually remove backgrounds with this config. */
export function isBgRemovalEnabled(config: PipelineConfig): boolean {
  if (config.provider === 'removebg') return !!config.removeBgApiKey;
  return config.provider === 'local';
}

// ---------------------------------------------------------------- input ---

const DATA_URI_RE =
  /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Detects the image type from magic bytes; null when not an allowed type. */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG')
    return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  return null;
}

function assertImageBuffer(buf: Buffer): Buffer {
  if (buf.length === 0) throw new ImageInputError('Image is empty');
  if (buf.length > MAX_INPUT_BYTES) {
    throw new ImageInputError(
      `Image is larger than ${MAX_INPUT_BYTES / (1024 * 1024)}MB`,
    );
  }
  if (!sniffImageMime(buf)) {
    throw new ImageInputError(
      'Unsupported image type (png, jpeg, webp or gif only)',
    );
  }
  return buf;
}

export function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export function decodeDataUri(value: string): Buffer {
  const match = DATA_URI_RE.exec(value);
  if (!match) throw new ImageInputError('Invalid image data URI');
  return assertImageBuffer(Buffer.from(match[2], 'base64'));
}

/** Loopback, private, link-local, CGNAT, multicast/reserved and unspecified. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    return (
      ip === '::' ||
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb') ||
      ip.startsWith('ff')
    );
  }
  return true;
}

async function assertPublicUrl(
  raw: string,
  lookup: NonNullable<PipelineDeps['lookup']>,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageInputError('Invalid image URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageInputError('Only http(s) image URLs can be fetched');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal')
  ) {
    throw new ImageInputError('Image URL points to a private address');
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host);
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ImageInputError('Image URL points to a private address');
  }
  return url;
}

/**
 * Downloads a remote image. Basic SSRF guard: http(s) only, hostname must not
 * resolve to a loopback/private/link-local address, redirects are followed
 * manually (max 3) and each hop is re-checked, size and type are capped.
 * (DNS rebinding between the check and the connection is not prevented; the
 * endpoint is admin-only, which is the main control.)
 */
export async function fetchRemoteImage(
  raw: string,
  config: PipelineConfig,
  deps: PipelineDeps = {},
): Promise<Buffer> {
  const doFetch = deps.fetch ?? fetch;
  const lookup =
    deps.lookup ?? ((host: string) => nodeLookup(host, { all: true }));
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, lookup);
    const res = await doFetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, url).toString();
      continue;
    }
    if (!res.ok) {
      throw new ImageInputError(`Image download failed (HTTP ${res.status})`);
    }
    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_INPUT_BYTES) {
      throw new ImageInputError('Remote image is too large');
    }
    return assertImageBuffer(Buffer.from(await res.arrayBuffer()));
  }
  throw new ImageInputError('Too many redirects');
}

export async function loadImageInput(
  input: Buffer | string,
  config: PipelineConfig,
  deps: PipelineDeps = {},
): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return assertImageBuffer(input);
  if (isDataUri(input)) return decodeDataUri(input);
  if (/^https?:\/\//i.test(input)) return fetchRemoteImage(input, config, deps);
  throw new ImageInputError('Expected an image data URI or http(s) URL');
}

// ------------------------------------------------------ background removal ---

async function removeWithRemoveBg(
  image: Buffer,
  config: PipelineConfig,
  deps: PipelineDeps,
): Promise<Buffer> {
  if (!config.removeBgApiKey) throw new Error('REMOVE_BG_API_KEY is not set');
  const form = new FormData();
  form.append('image_file', new Blob([new Uint8Array(image)]), 'image');
  form.append('size', 'auto');
  form.append('format', 'png');
  const res = await (deps.fetch ?? fetch)(REMOVE_BG_ENDPOINT, {
    method: 'POST',
    headers: { 'X-Api-Key': config.removeBgApiKey },
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`remove.bg returned HTTP ${res.status} ${detail}`.trim());
  }
  return Buffer.from(await res.arrayBuffer());
}

async function removeWithRembg(
  image: Buffer,
  config: PipelineConfig,
  deps: PipelineDeps,
): Promise<Buffer> {
  const run = deps.execFile ?? (nodeExecFile as unknown as ExecFileFn);
  const dir = await fs.mkdtemp(join(tmpdir(), 'rembg-'));
  const input = join(dir, 'in');
  const output = join(dir, 'out.png');
  try {
    await fs.writeFile(input, image);
    await new Promise<void>((resolve, reject) => {
      run(
        config.rembgBin,
        ['i', input, output],
        { timeout: config.timeoutMs, windowsHide: true },
        (error) => (error ? reject(error) : resolve()),
      );
    });
    return await fs.readFile(output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new Error(
        `rembg CLI not found ("${config.rembgBin}"). Install with: pip install "rembg[cpu,cli]"`,
      );
    }
    throw error;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Removes the background with the configured provider. Never throws: on any
 * failure it logs a warning and returns the original image.
 */
export async function removeBackground(
  image: Buffer,
  config: PipelineConfig,
  deps: PipelineDeps = {},
): Promise<{ buffer: Buffer; removed: boolean; warning?: string }> {
  if (config.provider === 'none') return { buffer: image, removed: false };
  try {
    const out =
      config.provider === 'removebg'
        ? await removeWithRemoveBg(image, config, deps)
        : await removeWithRembg(image, config, deps);
    if (sniffImageMime(out) !== 'image/png') {
      throw new Error('provider did not return a PNG');
    }
    return { buffer: out, removed: true };
  } catch (error) {
    const warning = `Background removal (${config.provider}) failed, using original image: ${(error as Error).message}`;
    deps.logger?.warn(warning);
    return { buffer: image, removed: false, warning };
  }
}

// ----------------------------------------------------------- normalisation ---

/**
 * Trims transparent (or uniform) borders, centres the subject on a square
 * transparent canvas with a ~6% margin, caps the side at `maxSide` and encodes
 * a palette PNG at max compression.
 */
export async function normalizePackShot(
  image: Buffer,
  maxSide = MAX_OUTPUT_SIDE,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const opts = { limitInputPixels: MAX_INPUT_PIXELS };
  const base = await sharp(image, opts).rotate().ensureAlpha().png().toBuffer();

  let trimmed: { data: Buffer; info: sharp.OutputInfo };
  try {
    trimmed = await sharp(base, opts)
      .trim()
      .png()
      .toBuffer({ resolveWithObject: true });
  } catch {
    // e.g. a fully uniform image: nothing to trim
    trimmed = await sharp(base, opts)
      .png()
      .toBuffer({ resolveWithObject: true });
  }

  const longest = Math.max(trimmed.info.width, trimmed.info.height);
  const inner = Math.max(
    1,
    Math.min(Math.floor(maxSide * (1 - 2 * CANVAS_MARGIN_RATIO)), longest),
  );
  const margin = Math.round(
    (inner * CANVAS_MARGIN_RATIO) / (1 - 2 * CANVAS_MARGIN_RATIO),
  );
  const side = Math.min(maxSide, inner + 2 * margin);
  const extra = side - inner;
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  const buffer = await sharp(trimmed.data, opts)
    .resize(inner, inner, { fit: 'contain', background: transparent })
    .extend({
      top: Math.floor(extra / 2),
      bottom: Math.ceil(extra / 2),
      left: Math.floor(extra / 2),
      right: Math.ceil(extra / 2),
      background: transparent,
    })
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();
  return { buffer, width: side, height: side };
}

export function toPngDataUri(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/**
 * Full pipeline. Throws ImageInputError for bad input and lets sharp errors
 * (corrupt image) propagate; background removal failures only add a warning.
 */
export async function processImage(
  input: Buffer | string,
  config: PipelineConfig,
  deps: PipelineDeps = {},
  options: { removeBackground?: boolean } = {},
): Promise<ProcessedImage> {
  const original = await loadImageInput(input, config, deps);
  const wantRemoval = options.removeBackground ?? config.provider !== 'none';
  const warnings: string[] = [];

  let source = original;
  let removed = false;
  if (wantRemoval && config.provider !== 'none') {
    const result = await removeBackground(original, config, deps);
    source = result.buffer;
    removed = result.removed;
    if (result.warning) warnings.push(result.warning);
  }

  // Shrink further if the PNG would not fit the product data-URI limit.
  for (const side of [MAX_OUTPUT_SIDE, 640, 512, 384]) {
    const out = await normalizePackShot(source, side);
    const dataUri = toPngDataUri(out.buffer);
    if (dataUri.length <= MAX_OUTPUT_DATA_URI_LENGTH) {
      return {
        ...out,
        dataUri,
        provider: config.provider,
        backgroundRemoved: removed,
        warnings,
      };
    }
  }
  throw new ImageInputError('Processed image is too large to store');
}
