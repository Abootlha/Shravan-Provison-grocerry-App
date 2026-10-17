import { lookup as nodeLookup } from 'dns/promises';
import { isIP } from 'net';
import {
  assertPublicUrl,
  isPrivateAddress,
} from '../../products/image-processing/product-image-pipeline';
import { ScrapeBlockedError } from './product-extractor';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_REDIRECTS = 5;
export const MAX_PAGE_BYTES = 8 * 1024 * 1024;

export interface FetchPageOptions {
  timeoutMs: number;
  fetch?: typeof fetch;
  lookup?: (host: string) => Promise<{ address: string }[]>;
}

/**
 * Downloads a product page as HTML. Same SSRF guard as product images:
 * http(s) only and every redirect hop must resolve to a public address.
 */
export async function fetchPage(
  raw: string,
  options: FetchPageOptions,
): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const lookup =
    options.lookup ?? ((host: string) => nodeLookup(host, { all: true }));
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, lookup);
    const res = await doFetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, url).toString();
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 202) {
      throw new ScrapeBlockedError(
        `The site blocked the scraper (HTTP ${res.status}). Try again later or add this product by hand.`,
      );
    }
    if (!res.ok) {
      throw new Error(`The page could not be loaded (HTTP ${res.status}).`);
    }
    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_PAGE_BYTES) throw new Error('The page is too large.');
    const html = await res.text();
    if (html.length > MAX_PAGE_BYTES) throw new Error('The page is too large.');
    return html;
  }
  throw new Error('Too many redirects.');
}

/**
 * Optional headless-browser loader for pages that only render client side.
 * `playwright` is not a dependency: install it on the server
 * (`npm i playwright && npx playwright install chromium`) to enable this.
 * Returns null when it is not installed.
 */
export async function renderWithBrowser(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  let playwright: any;
  try {
    // A variable specifier keeps TypeScript from requiring the types.
    const moduleName = 'playwright';
    playwright = await import(moduleName);
  } catch {
    return null;
  }
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'en-IN',
    });
    const page = await context.newPage();
    // Never let the page reach loopback/private hosts (by literal address).
    await page.route('**/*', (route: any) => {
      try {
        const host = new URL(route.request().url()).hostname.replace(
          /^\[|\]$/g,
          '',
        );
        if (
          host === 'localhost' ||
          host.endsWith('.localhost') ||
          host.endsWith('.internal') ||
          (isIP(host) && isPrivateAddress(host))
        ) {
          return route.abort();
        }
      } catch {
        return route.abort();
      }
      return route.continue();
    });
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    const status = response?.status() ?? 0;
    if (status === 403 || status === 429) {
      throw new ScrapeBlockedError(
        `The site blocked the scraper (HTTP ${status}). Try again later or add this product by hand.`,
      );
    }
    await page.waitForTimeout(2500);
    return await page.content();
  } finally {
    await browser.close().catch(() => undefined);
  }
}
