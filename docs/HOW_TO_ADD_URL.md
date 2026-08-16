# 📚 Hướng dẫn: Cách thêm URL cho AI học

Hệ thống có **Smart URL Importer** - paste link website, AI tự động cào và trích xuất sản phẩm vào kho tri thức.

---

## 🎯 Cách 1: Qua Admin UI (Khuyến nghị - dễ nhất)

### Bước 1: Đăng nhập admin
```
URL:   http://localhost:5173/admin/products
Email: admin@mada.vn
Pass:  admin123
```

### Bước 2: Tìm card "AI Import"
- Vào tab **"Sản phẩm"** (Products)
- Cuộn xuống đầu trang sẽ thấy card **"✨ AI Import / Smart URL Importer"**
- Click để mở rộng

### Bước 3: Paste URL + chọn category
Ví dụ URLs tốt để test:

| Trang | Ghi chú |
|-------|---------|
| `https://vi.wikipedia.org/wiki/Trợ_thiết_bị` | Bài viết (ít sản phẩm) |
| `https://en.wikipedia.org/wiki/Assistive_technology` | Tiếng Anh, nhiều data |
| `https://example-ecommerce-shop.com/products` | E-commerce thật (tốt nhất) |

### Bước 4: Click **"Preview"**
- AI sẽ scrape → extract products trong 5-30s
- Hiển thị danh sách sản phẩm tìm được:
  - Tên, giá, hình ảnh, brand, in stock
  - Method đã dùng (JSON-LD / HTML / Gemini AI)

### Bước 5: Review + **"Save All"**
- Kiểm tra danh sách OK
- Click "Lưu vào kho tri thức"
- AI sẽ index vào vector database → Chat sẽ biết trả lời về sản phẩm này

---

## 🎯 Cách 2: Qua API (Cho dev/automation)

### Preview (không lưu)
```bash
curl -X POST http://localhost:3001/api/scraper/import-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://example-shop.com/products",
    "defaultCategory": "mobility"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "...",
    "totalFound": 12,
    "method": "json-ld",       // ← AI dùng method nào
    "fetchMethod": "fetch",    // ← fetch hay puppeteer
    "durationMs": 173,
    "products": [
      {
        "id": "prod-1",
        "name": "Xe lăn điện XYZ",
        "price": 15000000,
        "currency": "VND",
        "imageUrl": "https://...",
        "brand": "ACME",
        "inStock": true,
        "url": "https://..."
      }
    ],
    "stats": {
      "withPrice": 10,
      "withImage": 8,
      "inStock": 9,
      "withBrand": 5
    }
  }
}
```

### Lưu vào DB
```bash
curl -X POST http://localhost:3001/api/scraper/import-url/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://example-shop.com/products",
    "defaultCategory": "mobility",
    "onlyValid": true
  }'
```

---

## 🧠 AI dùng 4 layers để cào data

| Layer | Trích xuất từ | Độ chính xác | Tốc độ |
|-------|---------------|--------------|--------|
| **1. JSON-LD** | Schema.org Product | 95%+ | 10ms |
| **2. HTML selectors** | `.product`, `[itemtype=Product]` | 80% | 50ms |
| **3. Gemini AI** | HTML tự do | 70% | 3-5s |
| **4. Puppeteer** | SPA (React/Vue) | - | 3-5s |

**Auto-fallback chain:**
1. Thử `fetch` (HTTP thuần, nhanh)
2. Nếu SPA → dùng `puppeteer` (render JS)
3. Nếu bị block → dùng proxy + rotated user-agent

---

## ⚠️ Sites nào hoạt động tốt?

### ✅ Tốt
- E-commerce có JSON-LD (Shopify, Magento sites)
- Wikipedia (info articles)
- ISO/WHO/W3C official pages
- Bất kỳ site nào có structured data

### ⚠️ Khó (cần proxy)
- Tiki.vn (anti-bot aggressive)
- Shopee.vn (Cloudflare)
- Lazada.vn (geo-restriction)
- Amazon.com (403 cho bot)

### ❌ Không scrape được
- Facebook, Instagram (login required)
- Sites có CAPTCHA
- Sites có TOS cấm scraping

---

## 🛠️ Setup Chrome/Puppeteer (Optional)

Nếu muốn scrape SPA (React/Vue):

```bash
# Cài Chrome (macOS)
brew install --cask google-chrome

# Hoặc Chromium
brew install --cask chromium
```

```bash
# File .env
PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

---

## 🔧 Set Proxy (Optional - bypass anti-bot)

```bash
# File .env
PROXY_ENABLED=true
PROXY_LIST="ip1:8080:user1:pass1,ip2:3128:user2:pass2"
```

**Recommended providers:**
- [Bright Data](https://brightdata.com/) - $500/tháng (rotating residential)
- [ScraperAPI](https://scraperapi.com/) - $49/tháng (5M requests)
- [Oxylabs](https://oxylabs.io/) - $300/tháng

---

## 📊 Workflow hoàn chỉnh

```
1. Admin paste URL trang sản phẩm
         ↓
2. Backend scrape HTML → parse JSON-LD / HTML / Gemini AI
         ↓
3. Trả về preview (admin review)
         ↓
4. Admin click "Save All"
         ↓
5. Backend save vào kb_products table + chunk + embed
         ↓
6. AI index vào Pinecone vector DB
         ↓
7. User chat → RAG search → AI trả lời với sản phẩm mới
```

**Thời gian:** ~5-30s cho 1 URL có < 50 sản phẩm.

---

## 🧪 Test ngay

```bash
# 1. Vào admin UI
http://localhost:5173/admin/products

# 2. Test với Wikipedia (chậm nhưng work)
URL: https://en.wikipedia.org/wiki/Assistive_technology
Category: assistive-tech

# 3. Hoặc dùng API (xem docs/SMART_URL_IMPORTER.md)
```

---

## 💡 Tips

1. **URL category-specific tốt hơn**: `/products?category=wheelchairs` thay vì `/products` (chung)
2. **JSON-LD sites là vàng**: Shopify, Magento, BigCommerce → extract gần như 100%
3. **Retry với category khác**: Nếu 0 sản phẩm, thử URL khác
4. **Batch nhỏ**: Chia 10-20 URLs/lần để tránh timeout
5. **Kiểm tra robots.txt**: Một số sites chặn scraping qua robots.txt

---

## 📞 Support

Nếu gặp lỗi:
1. Check backend log: `tail -f /tmp/server-fresh.log`
2. Check docs: `docs/SMART_URL_IMPORTER.md`
3. Test extraction engine: `npx tsx server/scripts/test-product-extractor.ts`