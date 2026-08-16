/**
 * Browser Pool - Quản lý Puppeteer instances
 *
 * Singleton browser với reuse strategy:
 *  - 1 browser process duy nhất (tiết kiệm RAM)
 *  - Nhiều pages cùng lúc (parallel scraping)
 *  - Auto-restart nếu browser crash
 *  - Auto-detect Chromium binary từ nhiều nguồn
 *
 * Memory: ~150MB cho 1 browser, ~50MB/page
 *
 * CHROMIUM_DETECTION:
 *  1. PUPPETEER_EXECUTABLE_PATH env
 *  2. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome (macOS default)
 *  3. /usr/bin/google-chrome / chromium
 *  4. CHROME_BIN env
 *  5. Return null → caller phải install puppeteer full
 */

import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer-core';

class BrowserPool {
  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;
  private lastUsedAt: number = 0;
  private pageCount: number = 0;
  private maxIdleMs: number = 5 * 60 * 1000; // 5 phút idle → close

  /**
   * Detect Chromium binary path
   */
  async detectExecutablePath(): Promise<string | null> {
    const os = process.platform;
    const candidates: string[] = [];

    // 1. Env override
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
    }
    if (process.env.CHROME_BIN) {
      candidates.push(process.env.CHROME_BIN);
    }

    // 2. macOS default
    if (os === 'darwin') {
      candidates.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
      );
    }

    // 3. Linux
    if (os === 'linux') {
      candidates.push(
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium'
      );
    }

    // 4. Windows
    if (os === 'win32') {
      candidates.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      );
    }

    // Check if any candidate exists
    const fs = await import('fs');
    for (const path of candidates) {
      try {
        await fs.promises.access(path, fs.constants.X_OK);
        console.log(`[BrowserPool] Detected Chromium: ${path}`);
        return path;
      } catch {
        // File doesn't exist or not executable
      }
    }

    return null;
  }

  /**
   * Get or launch browser instance
   */
  async getBrowser(): Promise<Browser> {
    // Return existing browser nếu còn healthy
    if (this.browser && this.browser.connected) {
      this.lastUsedAt = Date.now();
      return this.browser;
    }

    // Tránh race condition: nếu đang launch thì đợi
    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launchPromise = this.launch();
    try {
      this.browser = await this.launchPromise;
      this.lastUsedAt = Date.now();
      return this.browser;
    } finally {
      this.launchPromise = null;
    }
  }

  /**
   * Launch browser với stealth flags
   */
  private async launch(): Promise<Browser> {
    const executablePath = await this.detectExecutablePath();

    if (!executablePath) {
      throw new Error(
        'Chromium không tìm thấy. Cài 1 trong:\n' +
          '  - Google Chrome: https://www.google.com/chrome/\n' +
          '  - Set PUPPETEER_EXECUTABLE_PATH env\n' +
          '  - Hoặc cài puppeteer full: npm install puppeteer (sẽ tự download Chromium)'
      );
    }

    const options: any = {
      executablePath,
      headless: true,
      // Args bypass detection + tiết kiệm RAM
      args: [
        '--no-sandbox', // Docker compatibility
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Ẩn navigator.webdriver
        '--disable-dev-shm-usage', // Docker low /dev/shm
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Tốn ít RAM hơn (trade-off: ít parallel)
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled'],
    };

    console.log('[BrowserPool] Launching Chromium...');
    const browser = await puppeteer.launch(options);
    console.log('[BrowserPool] Chromium ready');

    // Setup graceful shutdown
    browser.on('disconnected', () => {
      console.warn('[BrowserPool] Browser disconnected');
      this.browser = null;
    });

    return browser;
  }

  /**
   * Create new page with stealth scripts
   */
  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Inject stealth scripts BEFORE navigation
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['vi-VN', 'vi', 'en-US', 'en'],
      });

      // Mock plugins length (Chrome thật có 3+ plugins)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Chrome runtime
      (window as any).chrome = { runtime: {} };
    });

    this.pageCount++;
    return page;
  }

  /**
   * Close browser (graceful shutdown)
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('[BrowserPool] Browser closed');
      } catch (err) {
        console.error('[BrowserPool] Error closing browser:', err);
      }
      this.browser = null;
      this.pageCount = 0;
    }
  }

  /**
   * Auto-cleanup idle browser (call periodically)
   */
  async cleanupIdle(): Promise<void> {
    if (!this.browser) return;
    if (Date.now() - this.lastUsedAt > this.maxIdleMs && this.pageCount === 0) {
      console.log('[BrowserPool] Closing idle browser');
      await this.close();
    }
  }

  getStats() {
    return {
      isRunning: !!this.browser?.connected,
      pageCount: this.pageCount,
      lastUsedAt: this.lastUsedAt,
      idleFor: this.lastUsedAt ? Date.now() - this.lastUsedAt : 0,
    };
  }
}

export const browserPool = new BrowserPool();

// Graceful shutdown
process.on('SIGTERM', () => browserPool.close());
process.on('SIGINT', () => browserPool.close());