# MADA Knowledge Base Crawler - Hướng dẫn chính xác

## ⚠️ Yêu cầu quan trọng

- **Phải chạy trên máy có internet** (sandbox AI bị chặn network, không crawl được).
- Crawler tôn trọng rate-limit (1.5s/request) nhưng vẫn nên chạy ngoài giờ cao điểm.

## Cấu trúc 7 danh mục MADA (URL thật)

| # | Slug | URL | ISO 9999 hint |
|---|---|---|---|
| 1 | `sensory-hearing` | https://at.mada.org.qa/technology-category/body-function/sensory-hearing/ | 22.06.06, 22.09.06, 22.18.03 |
| 2 | `sensory-vision` | https://at.mada.org.qa/technology-category/body-function/sensory-vision/ | 22.03.06, 22.06.12, 22.06.15 |
| 3 | `voice-and-speech` | https://at.mada.org.qa/technology-category/body-function/voice-and-speech/ | 05.15.06, 05.15.12, 22.21.12 |
| 4 | `mental-cognitive` | https://at.mada.org.qa/technology-category/body-function/mental-cognitive/ | 05.06.15, 05.09.03, 05.18.06 |
| 5 | `neuromusculoskeletal-movement` | https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/ | 04.24, 06.06, 12.31.03 |
| 6 | `mobility-and-transportation` | https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/ | 12.21.06, 12.21.09 |
| 7 | `regulatory-standards` | https://at.mada.org.qa/assistive-technology-portal/ | (tổng hợp) |

## Cách chạy

### 1. Test trước (không crawl, chỉ in config)

```bash
cd "/Users/vohuy/Downloads/MADA AI ASSISTANT/mada-ai-assistant"
npx tsx server/scripts/crawl-mada.ts --dry-run
```

### 2. Crawl 1 danh mục để kiểm tra chất lượng

```bash
npx tsx server/scripts/crawl-mada.ts --category sensory-hearing
```

Thời gian dự kiến: ~30-60 giây cho danh mục có < 30 sản phẩm.

### 3. Crawl toàn bộ 7 danh mục (khuyến nghị chạy ngoài giờ)

```bash
npx tsx server/scripts/crawl-mada.ts
```

Thời gian dự kiến: 5-15 phút (tùy tốc độ mạng và số trang pagination).

### 4. Crawl tiếng Ả Rập (tùy chọn)

Hiện tại crawler chỉ hỗ trợ EN. Để crawl AR, cần fork thêm logic cho `/ar/...` paths.

## Output files

Sau khi crawl xong, 3 file sẽ được tạo trong `data/`:

| File | Nội dung | Dùng cho |
|---|---|---|
| `mada-knowledge-base-full.json` | Structured data: title, description, content, images, attachments, ISO codes cho TỪNG sản phẩm | Debug, audit |
| `mada-rag-chunks.json` | Text chunks đã được merge markdown, sẵn cho embedding | RAG ingestion |
| `mada-crawl-report.json` | Stats: thời gian, số sản phẩm crawl được, errors | Monitoring |

## Bước tiếp theo: Ingest vào Vector Store

```bash
# Ingest vào SQLite + Milvus/Pinecone
npx tsx server/scripts/ingest-scraped.ts
```

Hoặc qua Admin UI: trỏ tới `data/mada-rag-chunks.json` rồi click **Ingest All**.

## Fix bug đã biết

Lỗi **title bị lẫn "Date: December 25, 2022"** đã được fix:
- Trong `crawl-mada.ts`: regex `/Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}` strip đúng phần ngày tháng.
- Backup dữ liệu cũ (lỗi): `backup/2025-08-17/mada-scrape-results.json` (KHÔNG xóa).
- Data mới clean: `data/mada-knowledge-base.json` (87 sản phẩm đã strip date).

## Validation checklist (chạy xong kiểm tra)

- [ ] Tổng sản phẩm ≥ 80 (hiện có 87 list items; nếu <80 → bot nào đó fail)
- [ ] `regulatory-standards` ≥ 5 items (portal page có nhiều mục tiêu chuẩn)
- [ ] Title KHÔNG chứa "Date:" ở bất kỳ record nào
- [ ] Mỗi sản phẩm có `description` ≥ 50 chars
- [ ] `isoCodes` populated cho ≥ 50% sản phẩm (heuristic + category hints)
- [ ] Số lỗi < 10% tổng (acceptable rate với MADA WordPress)

## Nếu crawl fail

1. Kiểm tra `data/mada-crawl-report.json` → `errors[]` để xem sản phẩm nào fail.
2. Kiểm tra máy có internet: `curl -I https://at.mada.org.qa/`
3. Nếu MADA block IP: giảm delay bằng `--delay 5000` (edit file), đợi 24h.
4. Nếu 1 sản phẩm fail: skip an toàn, vẫn lưu những cái còn lại.

## Revert an toàn (nếu cần)

KHÔNG xóa các file sau (đây là backup):

```
backup/2025-08-17/mada-scrape-results.json   # data cũ (lỗi date)
backup/2025-08-17/madaBots.ts                # bots config
backup/2025-08-17/ragEngine.ts               # RAG engine
backup/2025-08-17/server.index.ts            # server entry
```

Các file MỚI (an toàn xóa nếu muốn revert):
```
data/mada-knowledge-base.json              # KB cleaned (87 items)
data/mada-knowledge-base-full.json        # KB + detail (tạo sau khi crawl)
data/mada-rag-chunks.json                 # RAG chunks (tạo sau khi crawl)
data/mada-crawl-report.json               # report (tạo sau khi crawl)
server/scripts/crawl-mada.ts              # script mới
```
