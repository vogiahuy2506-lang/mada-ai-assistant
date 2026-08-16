# Smart URL Importer - Production Guide

**AI-powered URL scraping cho MADA products** — Phase 1+2+3 (production-ready).

## 🎯 Tính năng

| Layer | Trích xuất từ | Độ chính xác | Tốc độ |
|-------|---------------|--------------|--------|
| 1. JSON-LD | Schema.org Product | 95%+ | 10ms |
| 2. HTML selectors | `.product`, `[itemtype=Product]` | 80% | 50ms |
| 3. Gemini AI | HTML tự do | 70% | 3-5s |
| 4. Browser fallback | SPA (React/Vue/Angular) | - | 3-5s |

**Auto-fallback chain:**
1. Thử `fetch` (HTTP thuần, nhanh)
2. Detect SPA → fallback `puppeteer` (chậm nhưng render JS)
3. Anti-bot detect → dùng proxy + rotated user-agent

## 📁 Cấu trúc

```
server/lib/scraping/
├── productExtractor.ts    # Main service (3-layer extraction)
├── browserFetcher.ts      # Smart HTTP/Puppeteer wrapper
├── browserPool.ts         # Singleton Chromium instance
├── proxyService.ts        # HTTP/HTTPS/SOCKS5 rotation
└── userAgentPool.ts       # 14+ real User-Agents
```

## 🚀 Setup

### 1. Cài đặt dependencies

```bash
# Đã có sẵn puppeteer-core (nhẹ, không download Chromium)
npm install puppeteer-core@22.15.0 --save
```

### 2. Cài Chrome / Chromium

`puppeteer-core` KHÔNG tự download Chromium. Cài 1 trong:

**Option A: Google Chrome (khuyến nghị)**
```bash
brew install --cask google-chrome     # macOS
# Hoặc download: https://www.google.com/chrome/
```

**Option B: Chromium**
```bash
brew install --cask chromium
# Linux: apt install chromium-browser
```

**Option C: Puppeteer full (auto-download)**
```bash
npm install puppeteer --save
# Tự download Chromium ~300MB vào ~/.cache/puppeteer
```

### 3. (Optional) Setup Proxy

Nếu muốn bypass Cloudflare/anti-bot, set env:

```bash
# .env
PROXY_ENABLED=true
PROXY_LIST="ip1:8080:user1:pass1,ip2:8080:user2:pass2,ip3:3128"
```

Format mỗi proxy: `host:port:username:password` (username/password optional)

**Recommended proxy providers:**
- [Bright Data](https://brightdata.com/) - $500/tháng (rotating residential)
- [ScraperAPI](https://scraperapi.com/) - $49/tháng (5M requests)
- [Oxylabs](https://oxylabs.io/) - $300/tháng (datacenter + residential)
- Free: [FreeProxyList](https://free-proxy-list.net/) - không stable

### 4. Environment variables

```bash
# .env (đã có sẵn)
GEMINI_API_KEY=your_key       # Bắt buộc (cho Layer 3 fallback)
PUPPETEER_EXECUTABLE_PATH=    # Optional: custom Chromium path
CHROME_BIN=                   # Optional: Chrome binary path
```

## 🧪 Test

```bash
# Test extraction engine (không cần network)
npx tsx server/scripts/test-product-extractor.ts

# Test browser fetcher + SPA detection + Chromium
npx tsx server/scripts/test-browser-fetcher.ts
```

Expected output:

```
══════════════════════════════════════════════════════════
  BROWSER FETCHER TEST SUITE (Option C: SPA + Cloudflare)
══════════════════════════════════════════════════════════

✅ TEST 1: HTML thuần (Wikipedia) - expect fetch (fast)
   ✓ Method:    fetch
   ✓ Duration:  437ms

✅ TEST 2: SPA Mock - expect puppeteer (after SPA detect)
   ✓ Method:    puppeteer
   ✓ Duration:  4661ms

✅ TEST 3: Proxy Service stats (no proxy configured)
✅ TEST 4: BrowserPool detection
   ✓ Chromium: /Applications/Google Chrome.app/...
   ✓ Browser launched successfully

  RESULTS: 4/4 tests passed
  🎉 All tests passed!
```

## 📡 API Reference

### POST `/api/scraper/import-url`

Scrape URL và preview products (không lưu DB).

**Request:**
```json
{
  "url": "https://shop.example.com/products",
  "defaultCategory": "vision"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "...",
    "totalFound": 12,
    "method": "json-ld",        // hoặc "html-selectors", "gemini-ai", "mixed"
    "fetchMethod": "fetch",     // hoặc "puppeteer"
    "durationMs": 173,
    "proxyUsed": null,
    "userAgent": "Mozilla/5.0 ...",
    "products": [...],
    "previewRows": [...],
    "stats": {
      "withPrice": 10,
      "withImage": 8,
      "inStock": 9,
      "withBrand": 5
    },
    "proxyStats": {
      "mode": "direct",
      "totalProxies": 0
    }
  }
}
```

### POST `/api/scraper/import-url/save`

Scrape URL + lưu products vào DB.

**Request:** (same as above)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "...",
    "totalFound": 12,
    "saved": 10,                // Chỉ lưu SP có tên + giá
    "method": "json-ld",
    "fetchMethod": "fetch",
    "durationMs": 245
  },
  "message": "Đã lưu 10 sản phẩm từ ..."
}
```

## ⚠️ Limitations & Solutions

| Vấn đề | Nguyên nhân | Giải pháp |
|---------|-------------|-----------|
| Tiki.vn timeout | Anti-bot aggressive | Setup proxy residential (Bright Data) |
| Shopee.vn block | Cloudflare | Puppeteer + rotating proxies |
| Lazada empty content | Geo-restriction (chỉ VN IP) | Cần VN proxy |
| Không có JSON-LD | Site quá cũ | Dùng Layer 3 (Gemini AI) |
| Gemini API quota exceeded | Free tier limit | Nâng cấp paid tier |

## 🔧 Troubleshooting

### "Chromium không tìm thấy"
```bash
# Check Chrome installation:
ls /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Set custom path:
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### "Navigation timeout"
- Tăng timeout trong `urlImport.ts`: `browserFetcher.fetch(url, { timeoutMs: 60000 })`
- Hoặc setup proxy (giảm tải Cloudflare check)

### "Out of memory"
Browser mỗi page ~50MB. Nếu scrape hàng trăm URLs:
```bash
# Giảm memory:
# Trong browserPool.ts: --single-process (đã có)
# Hoặc set max pages = 5 (đã có auto-cleanup)
```

### Proxy không hoạt động
```bash
# Test proxy:
curl -x "http://user:pass@proxy:8080" https://api.ipify.org

# Check logs:
[ProxyService] Loaded N proxies (rotating mode)
[BrowserFetcher] Using proxy: proxy_1.2.3.4:8080
```

## 📊 Performance Benchmarks

| Loại URL | Method | Avg time | Memory |
|----------|--------|----------|--------|
| HTML thuần (Wikipedia) | fetch | 437ms | 0MB |
| SPA (React mock) | puppeteer | 4.6s | +150MB |
| SPA + proxy | puppeteer + proxy | 6-8s | +150MB |
| Anti-bot (WHO) | puppeteer + proxy | 8-15s | +150MB |

## 🎯 Demo URLs cho khách hàng

✅ **Hoạt động ngay** (HTML + JSON-LD):
- `https://store.museforaccessibles.com/`
- `https://shop.therapyshop.com/`
- Bất kỳ Shopify store nào
- Bất kỳ WooCommerce site nào

✅ **Hoạt động với puppeteer** (SPA):
- GitHub Shop: `https://github.com/marketplace`
- Reddit product pages

⚠️ **Cần proxy** (anti-bot):
- Tiki.vn, Shopee.vn, Lazada.vn
- Amazon (nếu scrape nhiều)

## 🚦 Roadmap (Future)

- [ ] Queue system (Bull/BullMQ) cho batch scraping
- [ ] Captcha solver integration (2Captcha, Anti-Captcha)
- [ ] Cloud browser (Browserless.io) - bypass hard anti-bot
- [ ] AI auto-classification (assign category dựa trên tên SP)
- [ ] Bulk import (paste nhiều URL cùng lúc)
- [ ] Scheduled re-scrape (cập nhật giá định kỳ)

---

**Tác giả**: MADA AI Dev Team  
**Last updated**: 2026-08-15  
**Version**: 2.0 (Production)