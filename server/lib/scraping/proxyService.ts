/**
 * Proxy Service - HTTP/HTTPS/SOCKS5 proxy rotation
 *
 * Features:
 *  - Load proxies từ PROXY_LIST env var (format: ip:port:user:pass,...)
 *  - Fallback sang direct connection nếu không có proxy
 *  - Health check + auto-retry nếu proxy fail
 *  - Metrics: success/fail rate per proxy
 *  - Smart selection: random + weighted (ưu tiên proxy healthy)
 *
 * Setup:
 *   PROXY_LIST="ip1:8080:user1:pass1,ip2:8080:user2:pass2"
 *   PROXY_ENABLED=true
 *
 * Nếu không set → dùng direct connection (no proxy)
 */

interface ProxyConfig {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  region?: string;
  // Health metrics
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgLatencyMs: number;
  lastUsedAt: number;
  lastSuccessAt: number;
  isHealthy: boolean;
}

interface ProxyStats {
  totalProxies: number;
  enabled: boolean;
  mode: 'direct' | 'rotating';
  healthyCount: number;
  unhealthyCount: number;
  successRate: number;
  avgLatencyMs: number;
}

class ProxyService {
  private proxies: ProxyConfig[] = [];
  private enabled: boolean = false;
  private currentIndex: number = 0;

  constructor() {
    this.loadFromEnv();
  }

  /**
   * Load proxies từ PROXY_LIST env var
   * Format: "ip1:port:user:pass,ip2:port:user:pass"
   */
  private loadFromEnv() {
    const proxyList = process.env.PROXY_LIST?.trim();
    const enabled = process.env.PROXY_ENABLED === 'true';

    if (!enabled || !proxyList) {
      this.enabled = false;
      console.log('[ProxyService] Direct mode (no proxy)');
      return;
    }

    const items = proxyList.split(',').map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const parts = item.split(':');
      if (parts.length < 2) continue;
      const [host, port, username, password] = parts;
      const proxy: ProxyConfig = {
        id: `proxy_${host}:${port}`,
        host,
        port: parseInt(port, 10),
        username,
        password,
        protocol: 'http',
        totalRequests: 0,
        successCount: 0,
        failCount: 0,
        avgLatencyMs: 0,
        lastUsedAt: 0,
        lastSuccessAt: 0,
        isHealthy: true,
      };
      this.proxies.push(proxy);
    }

    if (this.proxies.length > 0) {
      this.enabled = true;
      console.log(`[ProxyService] Loaded ${this.proxies.length} proxies (rotating mode)`);
    } else {
      console.log('[ProxyService] No valid proxies in PROXY_LIST, using direct mode');
    }
  }

  /**
   * Get next proxy (round-robin) hoặc null nếu không có
   */
  getNext(): ProxyConfig | null {
    if (!this.enabled || this.proxies.length === 0) return null;

    // Filter healthy proxies (success rate > 30%)
    const healthy = this.proxies.filter((p) => this.isProxyHealthy(p));
    const pool = healthy.length > 0 ? healthy : this.proxies;

    const proxy = pool[this.currentIndex % pool.length];
    this.currentIndex++;
    proxy.lastUsedAt = Date.now();
    return proxy;
  }

  /**
   * Get random proxy (weighted by health)
   */
  getRandom(): ProxyConfig | null {
    if (!this.enabled || this.proxies.length === 0) return null;

    const healthy = this.proxies.filter((p) => this.isProxyHealthy(p));
    const pool = healthy.length > 0 ? healthy : this.proxies;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Check if proxy is healthy (success rate > 30% AND used > 5 times)
   */
  private isProxyHealthy(p: ProxyConfig): boolean {
    if (p.totalRequests < 5) return true; // Chưa đủ data → assume healthy
    const successRate = p.successCount / p.totalRequests;
    return successRate > 0.3 && p.avgLatencyMs < 30000;
  }

  /**
   * Report proxy success/failure (update metrics)
   */
  reportResult(proxyId: string, success: boolean, latencyMs: number) {
    const proxy = this.proxies.find((p) => p.id === proxyId);
    if (!proxy) return;

    proxy.totalRequests++;
    if (success) {
      proxy.successCount++;
      proxy.lastSuccessAt = Date.now();
    } else {
      proxy.failCount++;
    }

    // Update avg latency (exponential moving average)
    if (proxy.avgLatencyMs === 0) {
      proxy.avgLatencyMs = latencyMs;
    } else {
      proxy.avgLatencyMs = proxy.avgLatencyMs * 0.7 + latencyMs * 0.3;
    }

    proxy.isHealthy = this.isProxyHealthy(proxy);
  }

  /**
   * Build fetch URL with proxy credentials (basic auth in URL)
   * Format: http://user:pass@host:port
   */
  buildProxyUrl(proxy: ProxyConfig): string {
    if (proxy.username && proxy.password) {
      return `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Get Puppeteer proxy config
   */
  getPuppeteerProxy(proxy: ProxyConfig): { server: string; username?: string; password?: string } {
    const config: any = {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
    };
    if (proxy.username && proxy.password) {
      config.username = proxy.username;
      config.password = proxy.password;
    }
    return config;
  }

  /**
   * Get stats
   */
  getStats(): ProxyStats {
    if (!this.enabled || this.proxies.length === 0) {
      return {
        totalProxies: 0,
        enabled: false,
        mode: 'direct',
        healthyCount: 0,
        unhealthyCount: 0,
        successRate: 0,
        avgLatencyMs: 0,
      };
    }

    const total = this.proxies.length;
    const healthy = this.proxies.filter((p) => p.isHealthy).length;
    const totalRequests = this.proxies.reduce((sum, p) => sum + p.totalRequests, 0);
    const totalSuccess = this.proxies.reduce((sum, p) => sum + p.successCount, 0);
    const avgLatency =
      total > 0
        ? this.proxies.reduce((sum, p) => sum + p.avgLatencyMs, 0) / total
        : 0;

    return {
      totalProxies: total,
      enabled: true,
      mode: 'rotating',
      healthyCount: healthy,
      unhealthyCount: total - healthy,
      successRate: totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0,
      avgLatencyMs: Math.round(avgLatency),
    };
  }

  /**
   * Manual setup (for testing hoặc admin override)
   */
  setProxies(proxies: Array<{ host: string; port: number; username?: string; password?: string; protocol?: 'http' | 'https' | 'socks5' }>) {
    this.proxies = proxies.map((p, i) => ({
      id: `proxy_${i}_${p.host}:${p.port}`,
      host: p.host,
      port: p.port,
      username: p.username,
      password: p.password,
      protocol: p.protocol || 'http',
      totalRequests: 0,
      successCount: 0,
      failCount: 0,
      avgLatencyMs: 0,
      lastUsedAt: 0,
      lastSuccessAt: 0,
      isHealthy: true,
    }));
    this.enabled = true;
    console.log(`[ProxyService] Manual setup: ${this.proxies.length} proxies`);
  }

  isEnabled(): boolean {
    return this.enabled && this.proxies.length > 0;
  }

  getProxyCount(): number {
    return this.proxies.length;
  }
}

export const proxyService = new ProxyService();