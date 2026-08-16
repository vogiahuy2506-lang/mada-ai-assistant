/**
 * User Agent Pool
 *
 * Rotate giữa các User-Agent thật (Chrome, Firefox, Safari, Edge)
 * từ nhiều OS + version khác nhau để bypass User-Agent filtering.
 *
 * Cập nhật: 2025 - Chrome 132+, Firefox 134+, Safari 18+
 */

const USER_AGENTS = [
  // Chrome trên Windows (chiếm 70% desktop traffic)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',

  // Chrome trên macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

  // Firefox trên Windows/Mac
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',

  // Safari trên macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',

  // Edge trên Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0',

  // Mobile Chrome (iOS + Android)
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',

  // Mobile Safari
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
];

class UserAgentPool {
  private currentIndex = 0;

  /**
   * Lấy User-Agent kế tiếp (xoay vòng)
   */
  next(): string {
    const ua = USER_AGENTS[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % USER_AGENTS.length;
    return ua;
  }

  /**
   * Lấy User-Agent random (tránh pattern detection)
   */
  getRandom(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Lấy User-Agent theo device type
   */
  getByDevice(device: 'desktop' | 'mobile' | 'all' = 'all'): string {
    const filtered = USER_AGENTS.filter((ua) => {
      if (device === 'desktop') return !ua.includes('Mobile');
      if (device === 'mobile') return ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android');
      return true;
    });
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Lấy thông tin OS từ User-Agent
   */
  parse(ua: string): { os: string; browser: string; device: 'mobile' | 'desktop' } {
    const device = ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android') ? 'mobile' : 'desktop';
    let os = 'Unknown';
    if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone OS') || ua.includes('iOS')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    let browser = 'Unknown';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Chrome/') && ua.includes('Safari/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && ua.includes('Version/')) browser = 'Safari';

    return { os, browser, device };
  }

  get size(): number {
    return USER_AGENTS.length;
  }
}

export const userAgentPool = new UserAgentPool();