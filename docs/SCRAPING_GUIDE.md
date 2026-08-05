# Hướng dẫn Cập nhật Dữ liệu Scraping Định kỳ

> **Document Version**: 1.0.0
> **Last Updated**: August 2026
> **Audience**: Data Managers, IT Staff

---

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Nguồn dữ liệu](#nguồn-dữ-liệu)
3. [Quy trình Scraping](#quy-trình-scraping)
4. [Lập lịch tự động](#lập-lịch-tự-động)
5. [Kiểm tra chất lượng](#kiểm-tra-chất-lượng)
6. [Xử lý sự cố](#xử-lý-sự-cố)

---

## Tổng quan

### Mục đích
Tài liệu này hướng dẫn cách cập nhật dữ liệu trong cơ sở tri thức (Knowledge Base) của MADA AI từ các nguồn web chính thức.

### Tần suất khuyến nghị
- **Hàng tuần**: Kiểm tra và cập nhật sản phẩm mới
- **Hàng tháng**: Cập nhật tiêu chuẩn và quy định
- **Hàng quý**: Đánh giá toàn diện chất lượng dữ liệu

---

## Nguồn dữ liệu

### 1. Nguồn chính thức

| Nguồn | URL | Tần suất | Ghi chú |
|--------|-----|----------|----------|
| MADA Portal | at.mada.org.qa | Tuần | Nguồn chính thức |
| WHO GATE | who.int/health-topics/assistive-technology | Tháng | Tiêu chuẩn quốc tế |
| ISO | iso.org | Quý | Tiêu chuẩn AT |
| W3C WAI | w3.org/WAI | Tháng | WCAG guidelines |

### 2. Nguồn bổ sung

| Nguồn | URL | Tần suất | Ghi chú |
|--------|-----|----------|----------|
| Apple Accessibility | apple.com/accessibility | Tháng | iOS/Mac AT |
| Microsoft Accessibility | microsoft.com/accessibility | Tháng | Windows AT |
| Google Accessibility | google.com/accessibility | Tháng | Android AT |
| AbleData | abledata.acl.gov | Tuần | Database AT Hoa Kỳ |

---

## Quy trình Scraping

### Bước 1: Chuẩn bị

```bash
# SSH vào server
ssh user@your-server

# Di chuyển vào thư mục dự án
cd /path/to/mada-ai-assistant

# Kiểm tra server đang chạy
curl http://localhost:3001/api/health
```

### Bước 2: Gọi API Ingestion

#### Scraping một URL:
```bash
curl -X POST http://localhost:3001/api/data/collect \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://at.mada.org.qa/products/vision",
    "type": "website"
  }'
```

#### Batch scraping nhiều URLs:
```bash
curl -X POST http://localhost:3001/api/data/batch \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {"type": "web", "content": "", "source": "https://at.mada.org.qa/products/vision"},
      {"type": "web", "content": "", "source": "https://at.mada.org.qa/products/hearing"},
      {"type": "web", "content": "", "source": "https://at.mada.org.qa/products/mobility"}
    ]
  }'
```

### Bước 3: Load Comprehensive Knowledge
```bash
curl -X POST http://localhost:3001/api/data/comprehensive
```

### Bước 4: Kiểm tra kết quả
```bash
curl http://localhost:3001/api/knowledge/stats
```

---

## Lập lịch tự động

### Sử dụng Cron Jobs (Linux)

#### 1. Tạo script scraping:
```bash
#!/bin/bash
# /opt/mada-scraping/weekly-update.sh

DATE=$(date +%Y-%m-%d)
LOG_FILE="/var/log/mada-scraping-${DATE}.log"

echo "[$(date)] Starting weekly scraping..." >> $LOG_FILE

# Load comprehensive knowledge
curl -X POST http://localhost:3001/api/data/comprehensive >> $LOG_FILE 2>&1

# Check stats
curl http://localhost:3001/api/knowledge/stats >> $LOG_FILE 2>&1

echo "[$(date)] Scraping completed" >> $LOG_FILE
```

#### 2. Cấp quyền thực thi:
```bash
chmod +x /opt/mada-scraping/weekly-update.sh
```

#### 3. Thêm vào crontab:
```bash
crontab -e

# Thêm dòng sau:
# Chạy vào Thứ Hai hàng tuần, lúc 2:00 AM
0 2 * * 1 /opt/mada-scraping/weekly-update.sh >> /var/log/cron-mada.log 2>&1
```

### Sử dụng GitHub Actions (CI/CD)

Tạo file `.github/workflows/scrape.yml`:

```yaml
name: Weekly Data Scraping

on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2 AM
  workflow_dispatch:  # Manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start server
        run: npm run server &
      
      - name: Wait for server
        run: sleep 10
      
      - name: Load comprehensive data
        run: |
          curl -X POST http://localhost:3001/api/data/comprehensive
      
      - name: Check stats
        run: |
          curl http://localhost:3001/api/knowledge/stats
```

---

## Kiểm tra chất lượng

### 1. Chạy QA Test Suite

```bash
# Chạy tất cả tests
npm run test:qa

# Hoặc chạy script trực tiếp
npx tsx server/tests/run-tests.ts
```

### 2. Kiểm tra độ phủ từ khóa

```bash
# Kiểm tra xem sản phẩm có trong knowledge base
curl "http://localhost:3001/api/knowledge/search?q=OrCam%20MyEye" | jq .

# Kiểm tra tiêu chuẩn
curl "http://localhost:3001/api/knowledge/search?q=ISO%209999%20wheelchair" | jq .
```

### 3. Đánh giá thủ công

| Tiêu chí | Mô tả | Điểm |
|-----------|--------|-------|
| Accuracy | Thông tin chính xác so với nguồn | /10 |
| Completeness | Đầy đủ thông tin sản phẩm | /10 |
| Freshness | Cập nhật gần đây | /10 |
| Relevance | Phù hợp với người dùng mục tiêu | /10 |

---

## Xử lý sự cố

### Lỗi thường gặp

#### 1. "Connection refused" khi scraping
```
Nguyên nhân: Server không chạy
Giải pháp: 
  systemctl start mada-ai
  hoặc
  npm run server &
```

#### 2. "Rate limited" từ website nguồn
```
Nguyên nhân: Gửi quá nhiều request
Giải pháp: 
  - Thêm delay giữa các request
  - Sử dụng proxy
  - Giảm tần suất scraping
```

#### 3. Dữ liệu không được index
```
Nguyên nhân: Nội dung không đủ dài hoặc format sai
Giải pháp:
  - Kiểm tra log ingestion
  - Xem chi tiết: /api/data/logs
```

### Logs location
```bash
# Server logs
cat /var/log/mada-server.log

# Ingestion logs
cat data/ingestion_log.json

# Nginx logs (nếu có proxy)
cat /var/log/nginx/access.log
```

---

## Checklist Cập nhật Định kỳ

### Hàng tuần:
- [ ] Kiểm tra MADA Portal có sản phẩm mới
- [ ] Chạy comprehensive data load
- [ ] Kiểm tra stats: `curl /api/knowledge/stats`
- [ ] Chạy sample QA tests
- [ ] Ghi log vào sổ theo dõi

### Hàng tháng:
- [ ] Cập nhật tiêu chuẩn WCAG/WHO
- [ ] Kiểm tra links còn hoạt động
- [ ] Đánh giá chất lượng dữ liệu
- [ ] Cập nhật README nếu cần

### Hàng quý:
- [ ] Đánh giá toàn diện QA test
- [ ] Cập nhật technical documentation
- [ ] Đào tạo lại nhân viên (nếu cần)
- [ ] Báo cáo cho Ban Quản lý

---

## Liên hệ Hỗ trợ

- **Email**: tech-support@mada.org.qa
- **Slack**: #mada-ai-support
- **On-call**: +974-XXXX-XXXX ( emergencies only)

---

**Document Author**: MADA AI Development Team
**Last Updated**: August 2026
