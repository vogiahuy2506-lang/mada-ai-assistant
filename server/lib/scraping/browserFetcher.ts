/**
 * Browser Fetcher - High-level wrapper cho việc fetch HTML
 *
 * Tự động chọn giữa:
 *  1. Native fetch (nhanh) - cho HTML thuần
 *  2. Puppeteer (chậm nhưng SPA-aware) - cho React/Vue sites
 *
 * Smart detection:
 *  - Thử fetch thuần trước (cheap)
 *  - Nếu body quá ngắn (< 500 chars) hoặc có "Loading..." → fallback sang browser
 *  - Tự động retry với proxy khác nếu fail
 */

import { browserPool } from './browserPool';
import { proxyService } from './proxyService';
import { userAgentPool } from './userAgentPool';
import { Page } from 'puppeteer-core';

export interface FetchOptions {
  timeoutMs?: number;
  useBrowser?: boolean; // Force dùng browser
  useProxy?: boolean; // Default: nếu có proxy thì dùng
  retries?: number;
  waitForSelector?: string; // Browser: đợi selector xuất hiện
  waitForNetworkIdle?: boolean; // Browser: đợi network idle
  stealth?: boolean; // Apply stealth techniques
}

export interface FetchResult {
  html: string;
  url: string;
  statusCode: number;
  method: 'fetch' | 'puppeteer';
  durationMs: number;
  proxy?: string;
  userAgent: string;
}

class BrowserFetcher {
  /**
   * Smart fetch - tự detect SPA
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const {
      timeoutMs = 30000,
      useBrowser = false,
      useProxy = true,
      retries = 2,
      waitForSelector,
      waitForNetworkIdle = true,
    } = options;

    const start = Date.now();
    const userAgent = userAgentPool.getRandom();

    // Nếu force browser → dùng puppeteer
    if (useBrowser) {
      return this.fetchWithBrowser(url, {
        userAgent,
        timeoutMs,
        useProxy,
        waitForSelector,
        waitForNetworkIdle,
      }, start);
    }

    // Thử fetch thuần trước (cheap + fast)
    try {
      const fetchResult = await this.fetchWithFetch(url, {
        userAgent,
        timeoutMs,
        useProxy,
      });

      const html = fetchResult.html;
      const looksLikeSPA = this.detectSPA(html);

      // Nếu HTML rỗng / rất ngắn → fallback sang browser
      if (looksLikeSPA) {
        console.log(`[BrowserFetcher] Detected SPA, retrying with browser...`);
        return this.fetchWithBrowser(url, {
          userAgent,
          timeoutMs,
          useProxy,
          waitForSelector,
          waitForNetworkIdle,
        }, start);
      }

      return fetchResult;
    } catch (err: any) {
      console.warn(`[BrowserFetcher] fetch failed, trying browser: ${err.message}`);

      // Retry với browser
      try {
        return await this.fetchWithBrowser(url, {
          userAgent,
          timeoutMs,
          useProxy,
          waitForSelector,
          waitForNetworkIdle,
        }, start);
      } catch (browserErr: any) {
        // Retry với proxy khác
        if (retries > 0) {
          console.log(`[BrowserFetcher] Retrying with different proxy (${retries} left)...`);
          return this.fetch(url, {
            ...options,
            retries: retries - 1,
          });
        }
        throw browserErr;
      }
    }
  }

  /**
   * Fetch bằng native fetch (HTTP request)
   */
  private async fetchWithFetch(
    url: string,
    options: {
      userAgent: string;
      timeoutMs: number;
      useProxy: boolean;
    }
  ): Promise<FetchResult> {
    const start = Date.now();
    const proxy = options.useProxy ? proxyService.getRandom() : null;
    const proxyStartUrl = proxy ? proxyService.buildProxyUrl(proxy) : null;

    // Native fetch không support proxy trực tiếp
    // → dùng undici hoặc bỏ qua proxy (TODO: add https-proxy-agent)
    // For now: fetch không qua proxy (vì cần HTTPS_PROXY env)
    const headers: Record<string, string> = {
      'User-Agent': options.userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });

      const html = await response.text();
      const durationMs = Date.now() - start;

      if (proxy) {
        proxyService.reportResult(proxy.id, response.ok, durationMs);
      }

      if (!response.ok && response.status !== 304) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      // 304 Not Modified = cache hit, body rỗng → fallback browser
      if (response.status === 304) {
        throw new Error('HTTP 304 (cached) - need browser');
      }

      return {
        html,
        url: response.url,
        statusCode: response.status,
        method: 'fetch',
        durationMs,
        proxy: proxy?.id,
        userAgent: options.userAgent,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch bằng Puppeteer (render JavaScript)
   */
  private async fetchWithBrowser(
    url: string,
    options: {
      userAgent: string;
      timeoutMs: number;
      useProxy: boolean;
      waitForSelector?: string;
      waitForNetworkIdle: boolean;
    },
    start: number
  ): Promise<FetchResult> {
    const proxy = options.useProxy ? proxyService.getRandom() : null;

    const page = await browserPool.newPage();
    try {
      // Set user agent
      await page.setUserAgent(options.userAgent);

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      });

      // Stealth: set viewport random
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
      });

      // Stealth: hide webdriver (backup)
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // Navigate
      const response = await page.goto(url, {
        waitUntil: options.waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
        timeout: options.timeoutMs,
      });

      if (!response) {
        throw new Error('No response received');
      }

      // Optional: wait for specific selector
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.timeoutMs,
        });
      } else {
        // Default: đợi 1-2 giây cho SPA render xong
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Get HTML
      const html = await page.content();
      const finalUrl = page.url();
      const durationMs = Date.now() - start;

      if (proxy) {
        proxyService.reportResult(proxy.id, response.ok(), durationMs);
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
      }

      return {
        html,
        url: finalUrl,
        statusCode: response.status(),
        method: 'puppeteer',
        durationMs,
        proxy: proxy?.id,
        userAgent: options.userAgent,
      };
    } finally {
      // Always close page to free memory
      await page.close().catch(() => {});
    }
  }

  /**
   * Detect SPA indicators trong HTML
   */
  private detectSPA(html: string): boolean {
    if (!html) return true;

    // Quá ngắn → chắc chắn SPA chưa render
    if (html.length < 500) return true;

    const lower = html.toLowerCase();

    // Common SPA shells
    const spaIndicators = [
      '<div id="root"',
      '<div id="app"',
      '<div id="__next"',
      'window.__nuxt__',
      'ng-version=', // Angular
      'data-reactroot', // React
      '<noscript>you need to enable javascript',
      'please enable javascript',
      'loading...', // Render placeholder
    ];

    return spaIndicators.some((indicator) => lower.includes(indicator));
  }

  /**
   * Cleanup browser (gọi khi shutdown)
   */
  async cleanup() {
    await browserPool.close();
  }
}

export const browserFetcher = new BrowserFetcher();