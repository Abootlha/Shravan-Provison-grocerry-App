import { promises as fs } from 'fs';
import sharp from 'sharp';
import { ImageProcessingService } from './image-processing.service';
import {
  fetchRemoteImage,
  ImageInputError,
  isPrivateAddress,
  normalizePackShot,
  PipelineDeps,
  resolvePipelineConfig,
  toPngDataUri,
} from './product-image-pipeline';

const makeService = (
  env: Record<string, string | undefined>,
  deps: PipelineDeps = {},
) =>
  new ImageProcessingService({ get: (key: string) => env[key] } as any, {
    logger: { warn: jest.fn() },
    ...deps,
  });

/** 300x200 JPEG: white background with a red block in the middle. */
const jpegWithBackground = () =>
  sharp({
    create: { width: 300, height: 200, channels: 3, background: '#ffffff' },
  })
    .composite([
      {
        input: {
          create: {
            width: 60,
            height: 120,
            channels: 3,
            background: '#d00000',
          },
        },
        left: 120,
        top: 40,
      },
    ])
    .jpeg()
    .toBuffer();

/** 400x400 transparent PNG with an opaque 100x50 block (what a bg remover returns). */
const transparentCutout = () =>
  sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: 100,
            height: 50,
            channels: 4,
            background: '#00a000ff',
          },
        },
        left: 10,
        top: 300,
      },
    ])
    .png()
    .toBuffer();

const pngResponse = (buf: Buffer) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: () =>
      Promise.resolve(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
      ),
    text: () => Promise.resolve(''),
  }) as unknown as Response;

const expectSquarePng = async (dataUri: string, maxSide = 800) => {
  expect(dataUri.startsWith('data:image/png;base64,')).toBe(true);
  const meta = await sharp(
    Buffer.from(dataUri.split(',')[1], 'base64'),
  ).metadata();
  expect(meta.format).toBe('png');
  expect(meta.width).toBe(meta.height);
  expect(meta.width).toBeLessThanOrEqual(maxSide);
  return meta;
};

describe('product image pipeline config', () => {
  it('defaults to none and ignores unknown providers', () => {
    expect(resolvePipelineConfig({}).provider).toBe('none');
    expect(
      resolvePipelineConfig({ PRODUCT_IMAGE_BG_PROVIDER: 'magic' }).provider,
    ).toBe('none');
    expect(
      resolvePipelineConfig({ PRODUCT_IMAGE_BG_PROVIDER: ' RemoveBG ' })
        .provider,
    ).toBe('removebg');
    const local = resolvePipelineConfig({ PRODUCT_IMAGE_BG_PROVIDER: 'local' });
    expect(local.provider).toBe('local');
    expect(local.rembgBin).toBe('rembg');
  });

  it('reports whether background removal is usable', () => {
    expect(makeService({}).getProcessingConfig()).toEqual({
      provider: 'none',
      enabled: false,
    });
    expect(
      makeService({
        PRODUCT_IMAGE_BG_PROVIDER: 'removebg',
      }).getProcessingConfig(),
    ).toEqual({ provider: 'removebg', enabled: false });
    expect(
      makeService({
        PRODUCT_IMAGE_BG_PROVIDER: 'removebg',
        REMOVE_BG_API_KEY: 'k',
      }).getProcessingConfig(),
    ).toEqual({ provider: 'removebg', enabled: true });
    expect(
      makeService({ PRODUCT_IMAGE_BG_PROVIDER: 'local' }).getProcessingConfig(),
    ).toEqual({ provider: 'local', enabled: true });
  });
});

describe('ImageProcessingService.processImage', () => {
  it("'none' skips background removal and only normalises", async () => {
    const fetchMock = jest.fn();
    const execMock = jest.fn();
    const service = makeService({}, { fetch: fetchMock, execFile: execMock });
    const input = await jpegWithBackground();

    const result = await service.processImage(toDataUri(input, 'image/jpeg'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('none');
    expect(result.backgroundRemoved).toBe(false);
    await expectSquarePng(result.dataUri);
  });

  it('removebg: sends the image with the api key and uses the cut-out', async () => {
    const cutout = await transparentCutout();
    const fetchMock = jest.fn().mockResolvedValue(pngResponse(cutout));
    const service = makeService(
      { PRODUCT_IMAGE_BG_PROVIDER: 'removebg', REMOVE_BG_API_KEY: 'secret' },
      { fetch: fetchMock as any },
    );

    const result = await service.processImage(await jpegWithBackground());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.remove.bg/v1.0/removebg');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Api-Key']).toBe('secret');
    expect((init.body as FormData).get('size')).toBe('auto');
    expect((init.body as FormData).get('format')).toBe('png');
    expect(result.backgroundRemoved).toBe(true);
    expect(result.warnings).toEqual([]);
    const meta = await expectSquarePng(result.dataUri);
    expect(meta.hasAlpha).toBe(true);
  });

  it('removebg: falls back to the original image when the API fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: () => Promise.resolve('insufficient credits'),
    });
    const warn = jest.fn();
    const service = makeService(
      { PRODUCT_IMAGE_BG_PROVIDER: 'removebg', REMOVE_BG_API_KEY: 'secret' },
      { fetch: fetchMock as any, logger: { warn } },
    );

    const result = await service.processImage(await jpegWithBackground());

    expect(result.backgroundRemoved).toBe(false);
    expect(result.warnings[0]).toMatch(/402/);
    expect(warn).toHaveBeenCalled();
    await expectSquarePng(result.dataUri);
  });

  it('local: falls back gracefully when the rembg binary is missing', async () => {
    const execMock = jest.fn((_file, _args, _opts, cb) =>
      cb(Object.assign(new Error('spawn rembg ENOENT'), { code: 'ENOENT' })),
    );
    const service = makeService(
      { PRODUCT_IMAGE_BG_PROVIDER: 'local', REMBG_BIN: 'rembg-missing' },
      { execFile: execMock },
    );

    const result = await service.processImage(await jpegWithBackground());

    expect(execMock).toHaveBeenCalledWith(
      'rembg-missing',
      ['i', expect.any(String), expect.any(String)],
      expect.objectContaining({ timeout: expect.any(Number) }),
      expect.any(Function),
    );
    expect(result.backgroundRemoved).toBe(false);
    expect(result.warnings[0]).toMatch(/rembg CLI not found/);
    await expectSquarePng(result.dataUri);
  });

  it('local: uses the file written by rembg', async () => {
    const cutout = await transparentCutout();
    const execMock = jest.fn((_file, args: string[], _opts, cb) => {
      fs.writeFile(args[2], cutout).then(() => cb(null), cb);
    });
    const service = makeService(
      { PRODUCT_IMAGE_BG_PROVIDER: 'local' },
      { execFile: execMock },
    );

    const result = await service.processImage(await jpegWithBackground());

    expect(result.backgroundRemoved).toBe(true);
    await expectSquarePng(result.dataUri);
  });

  it('rejects invalid input', async () => {
    const service = makeService({});
    await expect(
      service.processImage('data:image/png;base64,AAAA'),
    ).rejects.toBeInstanceOf(ImageInputError);
    await expect(
      service.processImage(Buffer.from('not an image at all')),
    ).rejects.toBeInstanceOf(ImageInputError);
    await expect(service.processImage('ftp://x/y.png')).rejects.toBeInstanceOf(
      ImageInputError,
    );
  });
});

describe('normalizePackShot', () => {
  it('trims transparent borders and centres on a square canvas ≤ 800px', async () => {
    const { buffer, width, height } = await normalizePackShot(
      await transparentCutout(),
    );
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('png');
    expect([meta.width, meta.height]).toEqual([width, height]);
    expect(width).toBe(height);
    // 100x50 subject after trim -> ~6% margin each side
    expect(width).toBeGreaterThanOrEqual(110);
    expect(width).toBeLessThanOrEqual(116);
    // corners are transparent
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[info.channels - 1]).toBe(0);
  });

  it('caps large images at 800px', async () => {
    const big = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: '#3355aa' },
    })
      .composite([
        {
          input: {
            create: {
              width: 1500,
              height: 900,
              channels: 3,
              background: '#ffcc00',
            },
          },
          left: 100,
          top: 100,
        },
      ])
      .png()
      .toBuffer();
    const { buffer } = await normalizePackShot(big);
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);
  });
});

describe('remote image fetching (SSRF guard)', () => {
  const config = resolvePipelineConfig({});

  it.each([
    'http://127.0.0.1/a.png',
    'http://localhost/a.png',
    'http://[::1]/a.png',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.10/a.png',
  ])('rejects %s', async (url) => {
    const fetchMock = jest.fn();
    await expect(
      fetchRemoteImage(url, config, { fetch: fetchMock }),
    ).rejects.toBeInstanceOf(ImageInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    const fetchMock = jest.fn();
    await expect(
      fetchRemoteImage('https://evil.example/a.png', config, {
        fetch: fetchMock,
        lookup: () => Promise.resolve([{ address: '10.0.0.5' }]),
      }),
    ).rejects.toThrow(/private/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-checks redirect targets', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'http://127.0.0.1/secret' }),
    });
    await expect(
      fetchRemoteImage('https://cdn.example/a.png', config, {
        fetch: fetchMock as any,
        lookup: () => Promise.resolve([{ address: '93.184.216.34' }]),
      }),
    ).rejects.toThrow(/private/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('downloads public images', async () => {
    const png = await transparentCutout();
    const buf = await fetchRemoteImage('https://cdn.example/a.png', config, {
      fetch: jest.fn().mockResolvedValue(pngResponse(png)) as any,
      lookup: () => Promise.resolve([{ address: '93.184.216.34' }]),
    });
    expect(buf.equals(png)).toBe(true);
  });

  it('classifies addresses', () => {
    expect(isPrivateAddress('172.20.1.1')).toBe(true);
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });
});

describe('ImageProcessingService.processProductImages', () => {
  it('processes data-URI uploads, keeps URLs, de-duplicates image/images[0]', async () => {
    const service = makeService({});
    const upload = toDataUri(await jpegWithBackground(), 'image/jpeg');
    const url = 'https://cdn.example/x.jpg';

    const out = await service.processProductImages(
      { image: upload, images: [upload, url], name: 'Atta' },
      true,
    );

    expect(out.name).toBe('Atta');
    expect(out.images[0]).not.toBe(upload);
    expect(out.images[0].startsWith('data:image/png;base64,')).toBe(true);
    expect(out.image).toBe(out.images[0]);
    expect(out.images[1]).toBe(url);
    expect(out.imageProcessed).toBe(false); // the URL was not processed
  });

  it('marks fully processed uploads', async () => {
    const service = makeService({});
    const upload = toDataUri(await jpegWithBackground(), 'image/jpeg');
    const out = await service.processProductImages({ images: [upload] }, true);
    expect(out.imageProcessed).toBe(true);
  });

  it('defaults to off when the provider is none and leaves data alone', async () => {
    const service = makeService({});
    const upload = toDataUri(await jpegWithBackground(), 'image/jpeg');
    const out = await service.processProductImages({ image: upload });
    expect(out.image).toBe(upload);
    expect(out.imageProcessed).toBe(false);
    expect(await service.processProductImages({ name: 'x' } as any)).toEqual({
      name: 'x',
    });
  });

  it('never throws: keeps the original when processing fails', async () => {
    const service = makeService({});
    // valid data-URI syntax and PNG magic bytes, but a corrupt body
    const corrupt = toDataUri(
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        Buffer.alloc(40, 1),
      ]),
      'image/png',
    );
    const out = await service.processProductImages({ image: corrupt }, true);
    expect(out.image).toBe(corrupt);
    expect(out.imageProcessed).toBe(false);
  });
});

function toDataUri(buf: Buffer, mime: string) {
  return mime === 'image/png'
    ? toPngDataUri(buf)
    : `data:${mime};base64,${buf.toString('base64')}`;
}
