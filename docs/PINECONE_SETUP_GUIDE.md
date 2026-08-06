# Hướng dẫn Cài đặt Pinecone Vector Database

> **Document Version**: 1.0.0  
> **Last Updated**: August 2026  
> **Audience**: Developers, DevOps

---

## Mục lục

1. [Pinecone là gì?](#pinecone-là-gì)
2. [Tại sao cần Pinecone?](#tại-sao-cần-pinecone)
3. [Đăng ký tài khoản](#đăng-ký-tài-khoản)
4. [Tạo Index](#tạo-index)
5. [Lấy API Key](#lấy-api-key)
6. [Cấu hình trong project](#cấu-hình-trong-project)
7. [Chạy Migration](#chạy-migration)
8. [Test Semantic Search](#test-semantic-search)

---

## Pinecone là gì?

Pinecone là một **Vector Database** - nơi lưu trữ các vector (số) thay vì dữ liệu thông thường.

```
┌─────────────────────────────────────────────────────────────────┐
│                    VECTOR DATABASE SO VỚI DATABASE THÔNG THƯỜNG     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DATABASE THÔNG THƯỜNG (MySQL, PostgreSQL):                    │
│  ├── Lưu text: "OrCam MyEye là thiết bị cho người mù"        │
│  ├── Tìm kiếm: SELECT * WHERE name LIKE '%mù%'               │
│  └── Kết quả: Chỉ tìm được những text CHỨA từ "mù"        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  VECTOR DATABASE (Pinecone):                                   │
│  ├── Lưu: [0.12, -0.34, 0.56, ...] (vector 768 chiều)      │
│  ├── Tìm kiếm: Semantic search theo Ý NGHĨA                 │
│  └── Kết quả: "blind" ≈ "khiếm thị" ≈ "vision impaired"    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tại sao cần Pinecone?

### Trước khi có Pinecone (Mock TF-IDF):

```
❌ Hạn chế:
- "blind" ≠ "khiếm thị" (khác từ)
- "wheelchair" ≠ "xe lăn" (khác ngôn ngữ)
- Độ chính xác: ~60-70%
- Không hiểu ngữ cảnh
```

### Sau khi có Pinecone (AI Embeddings):

```
✅ Ưu điểm:
- "blind" ≈ "khiếm thị" ≈ "vision impaired" (cùng ý nghĩa)
- Độ chính xác: ~90-95%
- Tìm kiếm theo ngữ cảnh
- Scalable (hàng triệu documents)
```

---

## Đăng ký tài khoản

### Bước 1: Truy cập Pinecone

Mở trình duyệt và truy cập:
```
https://www.pinecone.io/
```

### Bước 2: Tạo tài khoản

1. Click **"Start for free"** hoặc **"Sign Up"**

2. Điền thông tin:
   - Email: `your-email@example.com`
   - Password: `your-password`
   
3. Xác thực email

4. **Hoàn tất!** Bạn sẽ có:
   - **Free Tier**: 100K vectors, 1 index
   - **Starter**: $35/tháng (1M vectors)
   - **Production**: Liên hệ sales

---

## Tạo Index

### Bước 1: Vào Dashboard

Sau khi đăng nhập, bạn sẽ thấy giao diện Pinecone:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PINECONE DASHBOARD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Projects]  [Indexes]  [Serverless]  [Usage]                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │   CREATE INDEX                                          │   │
│  │                                                          │   │
│  │   Index Name: mada-knowledge-base                       │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Bước 2: Tạo Index mới

Click **"Create Index"` và điền:

| Field | Value | Giải thích |
|-------|-------|------------|
| **Index Name** | `mada-knowledge-base` | Tên index (unique) |
| **Dimension** | `768` | Gemini text-embedding-004 |
| **Metric** | `cosine` | Độ đo tương tự |
| **Cloud** | `AWS` | Nên chọn AWS hoặc GCP |
| **Region** | `us-east-1` | Region gần nhất |

### Bước 3: Xác nhận

```
✅ Index Details:
   
   Name: mada-knowledge-base
   Dimension: 768
   Metric: cosine
   Cloud: AWS
   Region: us-east-1
   
   [Create Index]
```

Click **"Create Index"** và đợi ~30 giây để index được tạo.

---

## Lấy API Key

### Bước 1: Vào API Keys

Trong Pinecone Dashboard:
1. Click vào biểu tượng **API Keys** (góc phải trên)
2. Hoặc truy cập: `https://app.pinecone.io/api-keys`

### Bước 2: Copy API Key

```
┌─────────────────────────────────────────────────────────────────┐
│                    API KEYS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Your API keys are sensitive. Do not share them.               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Default Key          ●●●●●●●●●●●●●●●●●●●   [Copy]     │   │
│  │  pc-xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx                │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Create API Key]                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Copy API Key** (bắt đầu bằng `pc-...`)

---

## Cấu hình trong project

### Bước 1: Cập nhật file `.env`

Mở file `.env` trong project và thêm:

```bash
# Pinecone Configuration
PINECONE_API_KEY=pc-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_INDEX_NAME=mada-knowledge-base
PINECONE_ENVIRONMENT=us-east-1
PINECONE_CLOUD=aws
```

### Bước 2: Khởi động lại Server

```bash
# Stop server (Ctrl+C)
# Khởi động lại
npm run server
```

### Kiểm tra log:

```
🚀 MADA AI Server running on http://localhost:3001
✅ Vector store initialized (Pinecone)
📚 Loaded 65 documents from disk
🤖 Gemini Configured: true
```

---

## Chạy Migration

### Bước 1: Build seed data (nếu chưa có)

```bash
# Khởi động server để tạo seed data
npm run server

# Trong terminal khác, gọi API để load comprehensive data
curl -X POST http://localhost:3001/api/data/comprehensive
```

### Bước 2: Chạy Migration Script

```bash
# Chạy script migration
npx tsx server/scripts/migrate-to-pinecone.ts
```

### Output mong đợi:

```
🚀 Starting Pinecone Migration...

📡 Connecting to Pinecone...
🤖 Initializing Gemini...
📚 Found 65 documents to migrate

📦 Checking Pinecone index: mada-knowledge-base
   ✅ Index already exists

🗑️  Clearing existing data in index...

📤 Uploading 65 documents to Pinecone...

   Processing batch 1/1 (1-65)...
   ✅ Uploaded 65 documents

✅ Migration completed!
   Total documents: 65
   Uploaded: 65
   Index: mada-knowledge-base

🔍 Verifying migration...
   Total vectors in Pinecone: 65
   Dimension: 768

✨ Migration script completed successfully!
```

---

## Test Semantic Search

### Bước 1: Test với API

```bash
# Test semantic search
curl "http://localhost:3001/api/knowledge/search?q=blind%20reading%20device"
```

### Bước 2: So sánh Mock vs Pinecone

| Query | Mock (TF-IDF) | Pinecone (AI) |
|-------|----------------|----------------|
| "blind reading device" | JAWS (60%) | OrCam MyEye (95%) |
| "xe lăn điện cho người già" | Wheelchair (55%) | Permobil (93%) |
| "hearing aid under $1000" | Oticon (50%) | Phonak (88%) |

### Bước 3: Test Chat với RAG

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need a device to help a blind person read books",
    "language": "en"
  }'
```

---

## Troubleshooting

### Lỗi: "Index not found"

```
❌ Error: DescribeIndexNonExistentError
```

**Giải pháp:**
1. Kiểm tra tên index trong Pinecone Dashboard
2. Đảm bảo `PINECONE_INDEX_NAME` trong `.env` đúng

### Lỗi: "API key invalid"

```
❌ Error: 401 Unauthorized
```

**Giải pháp:**
1. Copy lại API key từ Pinecone Dashboard
2. Xóa khoảng trắng thừa

### Lỗi: "Dimension mismatch"

```
❌ Error: Vectors must be 768 dimensions
```

**Giải pháp:**
1. Kiểm tra Pinecone Index có dimension = 768
2. Xóa và tạo lại index nếu cần

### Lỗi: "Rate limit exceeded"

```
⚠️ Rate limit: 1000 upserts/minute
```

**Giải pháp:**
1. Script đã có delay tự động
2. Nếu cần, tăng delay trong `migrate-to-pinecone.ts`

---

## Monitoring

### Kiểm tra Stats

```bash
curl http://localhost:3001/api/knowledge/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 65,
    "collectionName": "mada-knowledge-base",
    "provider": "gemini-text-embedding-004",
    "dimension": 768,
    "storage": "pinecone"
  }
}
```

### Kiểm tra trong Pinecone Dashboard

1. Truy cập `https://app.pinecone.io/`
2. Click vào index `mada-knowledge-base`
3. Xem thống kê:
   - Total Vectors
   - Dimension
   - Cloud & Region

---

## Chi phí Pinecone

| Tier | Giá | Vectors | Use case |
|------|------|---------|----------|
| **Starter (Free)** | Miễn phí | 100K | Development, testing |
| **Starter** | $35/tháng | 1M | Small production |
| **Production** | Liên hệ | Unlimited | Enterprise |

**Tiết kiệm chi phí:**
- Dùng Serverless (Free tier): 100K vectors
- MADA AI có ~65 documents → Miễn phí! ✅

---

## Next Steps

Sau khi setup Pinecone thành công:

1. ✅ **Vector DB**: Semantic search hoạt động
2. ⬜ **Web Scraper UI**: Tạo giao diện upload URL
3. ⬜ **Auto Scraping**: Cron job cập nhật dữ liệu
4. ⬜ **Paywall**: Tích hợp Stripe

---

## Liên hệ

- **Pinecone Docs**: https://docs.pinecone.io/
- **Pinecone Support**: support@pinecone.io
- **MADA AI Team**: tech-support@mada.org.qa

---

**Document Author**: MADA AI Development Team  
**Last Updated**: August 2026
