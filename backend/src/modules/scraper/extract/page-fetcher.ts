import { lookup as nodeLookup } from 'dns/promises';
import { isIP } from 'net';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  assertPublicUrl,
  isPrivateAddress,
} from '../../products/image-processing/product-image-pipeline';
import {
  detectSite,
  looksBlocked,
  ScrapeBlockedError,
} from './product-extractor';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MAX_REDIRECTS = 5;
export const MAX_PAGE_BYTES = 8 * 1024 * 1024;

export interface FetchPageOptions {
  timeoutMs: number;
  fetch?: typeof fetch;
  lookup?: (host: string) => Promise<{ address: string }[]>;
  proxyUrl?: string;
  apiKey?: string;
}

/**
 * Downloads a product page as HTML. Supports:
 * 1. Direct fetch with stealth headers.
 * 2. ScraperAPI (if apiKey provided) for rotating Indian residential IPs.
 * 3. HTTP/HTTPS proxy (if proxyUrl provided).
 */
export async function fetchPage(
  raw: string,
  options: FetchPageOptions,
): Promise<string> {
  const lookup =
    options.lookup ?? ((host: string) => nodeLookup(host, { all: true }));

  // 1. ScraperAPI integration: automatically routes via residential IPs & bypasses Cloudflare/Akamai/AWS WAF
  if (options.apiKey) {
    await assertPublicUrl(raw, lookup);
    const site = detectSite(raw);
    const isZepto = site === 'zepto';
    const doFetch = options.fetch ?? fetch;

    const fetchViaScraperApi = async (renderJs: boolean) => {
      const scraperUrl = `https://api.scraperapi.com?api_key=${encodeURIComponent(
        options.apiKey!,
      )}&url=${encodeURIComponent(raw)}&country_code=in${renderJs ? '&render=true' : ''}`;
      const res = await doFetch(scraperUrl, {
        signal: AbortSignal.timeout(Math.max(options.timeoutMs, 60000)),
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          throw new ScrapeBlockedError(
            `Scraper proxy service blocked or rate-limited (HTTP ${res.status}).`,
          );
        }
        throw new Error(`Scraper proxy service failed (HTTP ${res.status}).`);
      }
      return res.text();
    };

    // Zepto always requires JS rendering due to AWS WAF challenge & client-side hydration
    let html = await fetchViaScraperApi(isZepto);
    if (!isZepto && looksBlocked(html)) {
      // Retry once with render=true to solve JS challenge (e.g. Cloudflare / WAF)
      try {
        const rendered = await fetchViaScraperApi(true);
        if (!looksBlocked(rendered)) html = rendered;
      } catch {
        // Fall back to original result or throw below
      }
    }

    if (html.length > MAX_PAGE_BYTES) throw new Error('The page is too large.');
    if (looksBlocked(html)) {
      throw new ScrapeBlockedError(
        'The site blocked the scraper (bot protection challenge).',
      );
    }
    return html;
  }

  // 2. Custom HTTP/HTTPS/SOCKS Proxy integration
  if (options.proxyUrl) {
    const url = await assertPublicUrl(raw, lookup);
    const agent = new HttpsProxyAgent(options.proxyUrl);
    try {
      const response = await axios.get(url.toString(), {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: options.timeoutMs,
        maxRedirects: MAX_REDIRECTS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        },
        responseType: 'text',
        validateStatus: (status) => status < 400,
      });
      const html = String(response.data);
      if (html.length > MAX_PAGE_BYTES) throw new Error('The page is too large.');
      if (looksBlocked(html)) {
        throw new ScrapeBlockedError(
          'The site blocked the scraper (bot protection challenge).',
        );
      }
      return html;
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403 || status === 429 || status === 202) {
        throw new ScrapeBlockedError(
          `The site blocked the scraper (HTTP ${status}). Try again later or add this product by hand.`,
        );
      }
      throw err;
    }
  }

  // 3. Direct fetch with realistic browser headers & SSRF guard
  const doFetch = options.fetch ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, lookup);
    const res = await doFetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        'Sec-Ch-Ua':
          '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
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
 * Headless-browser loader with anti-automation suppression and proxy support.
 */
export async function renderWithBrowser(
  url: string,
  timeoutMs: number,
  proxyUrl?: string,
): Promise<string | null> {
  let playwright: any;
  try {
    const moduleName = 'playwright';
    playwright = await import(moduleName);
  } catch {
    return null;
  }

  let proxyConfig:
    | { server: string; username?: string; password?: string }
    | undefined;
  if (proxyUrl) {
    try {
      const parsed = new URL(proxyUrl);
      proxyConfig = {
        server: `${parsed.protocol}//${parsed.host}`,
        username: parsed.username
          ? decodeURIComponent(parsed.username)
          : undefined,
        password: parsed.password
          ? decodeURIComponent(parsed.password)
          : undefined,
      };
    } catch {
      proxyConfig = { server: proxyUrl };
    }
  }

  const launchArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-infobars',
    '--window-size=1920,1080',
  ];

  const browser = await playwright.chromium.launch({
    headless: true,
    args: launchArgs,
    proxy: proxyConfig,
  });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'en-IN',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
      },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

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
    await page.waitForTimeout(3000);
    const content = await page.content();
    const status = response?.status() ?? 0;
    if (looksBlocked(content) || (status === 403 && content.length < 1000)) {
      throw new ScrapeBlockedError(
        `The site blocked the scraper (HTTP ${status || 403}). Try again later or add this product by hand.`,
      );
    }
    return content;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
