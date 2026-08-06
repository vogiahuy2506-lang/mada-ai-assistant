# Hướng dẫn Cài đặt Milvus Vector Database

> **Document Version**: 1.0.0  
> **Last Updated**: August 2026  
> **Audience**: Developers, DevOps

---

## Mục lục

1. [Milvus là gì?](#milvus-là-gì)
2. [Tại sao nên dùng Milvus?](#tại-sao-nên-dùng-milvus)
3. [Cài đặt Docker](#cài-đặt-docker)
4. [Chạy Milvus](#chạy-milvus)
5. [Kiểm tra kết nối](#kiểm-tra-kết-nối)
6. [Chạy Migration](#chạy-migration)
7. [Troubleshooting](#troubleshooting)

---

## Milvus là gì?

Milvus là một **vector database mã nguồn mở** được thiết kế cho:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MILVUS OVERVIEW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🏗️  ARCHITECTURE:                                            │
│  ├── Milvus Lite - Embedded trong app (đang dùng)           │
│  ├── Milvus Standalone - 1 Docker container                    │
│  └── Milvus Cluster - Multi-node, production scale              │
│                                                                  │
│  📊 FEATURES:                                                   │
│  ├── ✅ Billion-scale vectors                                   │
│  ├── ✅ Multiple index types (HNSW, IVF, ANNOY)           │
│  ├── ✅ Hybrid search (vector + metadata)                     │
│  ├── ✅ ANSI SQL-like queries                                  │
│  ├── ✅ Time travel (query versions)                           │
│  └── ✅ Horizontal scaling                                      │
│                                                                  │
│  💰 COST:                                                      │
│  ├── Self-hosted: Miễn phí ✅                                │
│  └── Milvus Cloud: Pay-per-use                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tại sao nên dùng Milvus?

### So sánh với các giải pháp khác

| Feature | Milvus | Pinecone | ChromaDB |
|---------|--------|----------|-----------|
| **Hosting** | Local/Cloud | Cloud only | Local only |
| **Scale** | Billion+ | 100M | Million |
| **Index Types** | 8+ types | 1 type | 2 types |
| **Open Source** | ✅ | ❌ | ✅ |
| **Setup** | Docker | API Key | npm |
| **Cost** | Miễn phí (self) | $35+/tháng | Miễn phí |

### Khi nào nên dùng Milvus?

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHEN TO USE MILVUS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ NÊN DÙNG Milvus khi:                                      │
│  ├── Cần scale lớn (> 1M vectors)                           │
│  ├── Cần index types khác nhau (HNSW, IVF)                  │
│  ├── Cần hybrid search (vector + metadata filter)            │
│  ├── Muốn self-host (không phụ thuộc cloud)                │
│  └── Cần open source (customizable)                          │
│                                                                  │
│  ❌ KHÔNG NÊN dùng Milvus khi:                               │
│  ├── Dự án nhỏ, prototype nhanh (dùng ChromaDB)           │
│  ├── Không muốn quản lý infrastructure                      │
│  └── Cần managed service không tự maintain                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cài đặt Docker

Milvus cần Docker để chạy. Đây là hướng dẫn cài đặt nhanh.

### Bước 1: Tải Docker Desktop

Truy cập: https://docs.docker.com/desktop/download/mac-install/

Chọn **Apple Silicon** hoặc **Intel** tùy máy của bạn.

### Bước 2: Cài đặt

```bash
# Mở file .dmg đã tải
open Docker.dmg

# Kéo Docker vào Applications
# Sau đó khởi động Docker từ Applications
```

### Bước 3: Xác nhận Docker đã chạy

```bash
docker --version
# Docker version 27.x.x

docker ps
# CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
```

---

## Chạy Milvus

### Cách 1: Script tự động (Khuyến nghị)

Tôi đã tạo script tự động. Chạy lệnh sau trong thư mục project:

```bash
cd /Users/vohuy/Downloads/MADA\ AI\ ASSISTANT/mada-ai-assistant

# Tạo thư mục cho Milvus data
mkdir -p volumes/milvus volumes/etcd volumes/minio

# Chạy Milvus bằng script
npm run milvus:start
```

### Cách 2: Chạy thủ công từng container

Nếu cách 1 không hoạt động, chạy từng lệnh sau:

#### Bước 1: Chạy etcd (metadata store)

```bash
docker run -d \
  --name milvus-etcd \
  -p 2379:2379 \
  -v $(pwd)/volumes/etcd:/etcd \
  milvusdb/etcd:latest \
  etcd -advertise-client-urls=http://127.0.0.1:2379 \
  etcd -listen-client-urls=http://0.0.0.0:2379 \
  --data-dir=/etcd
```

#### Bước 2: Chạy MinIO (storage)

```bash
docker run -d \
  --name milvus-minio \
  -p 9001:9001 \
  -p 9091:9091 \
  -v $(pwd)/volumes/minio:/minio_data \
  minio/minio:latest \
  server /minio_data --console-address ":9091" -address ":9001"
```

#### Bước 3: Chạy Milvus Standalone

```bash
docker run -d \
  --name milvus-standalone \
  -p 19530:19530 \
  -p 9091:9091 \
  -v $(pwd)/volumes/milvus:/var/lib/milvus \
  milvusdb/milvus:latest \
  milvus run standalone
```

### Kiểm tra containers đang chạy

```bash
docker ps
```

**Kết quả mong đợi:**
```
CONTAINER ID   IMAGE                    STATUS          PORTS
xxxxxxxxxxxx   milvusdb/milvus         Up 2 minutes    0.0.0.0:19530->19530/tcp
xxxxxxxxxxxx   minio/minio             Up 3 minutes    0.0.0.0:9001->9001/tcp
xxxxxxxxxxxx   milvusdb/etcd           Up 4 minutes    0.0.0.0:2379->2379/tcp
```

---

## Kiểm tra kết nối

### Bước 1: Test bằng Milvus Client

```bash
# Chạy Milvus Attu (web UI)
docker run -d \
  --name milvus-attu \
  -p 3000:3000 \
  -e MILVUS_URL=http://localhost:19530 \
  zilliz/attu:latest
```

Sau đó mở trình duyệt: http://localhost:3000

### Bước 2: Test bằng lệnh

```bash
# Kiểm tra Milvus đang listen
curl http://localhost:19530/healthz
```

**Kết quả mong đợi:**
```json
{"status":"ok"}
```

### Bước 3: Test từ MADA AI Server

```bash
# Khởi động server
npm run server
```

**Log mong đợi:**
```
🚀 MADA AI Server running on http://localhost:3001
🔍 Auto-detecting Vector DB provider...
✅ Connected to Milvus at localhost:19530
✅ Milvus ready with collection: mada_knowledge_base
📚 Loaded 65 documents from disk
✅ Vector store initialized (milvus)
```

---

## Chạy Migration

### Bước 1: Tạo seed data (nếu chưa có)

```bash
# Khởi động server để tạo seed data
npm run server

# Trong terminal khác, gọi API để load comprehensive data
curl -X POST http://localhost:3001/api/data/comprehensive
```

### Bước 2: Chạy Migration Script

```bash
# Stop server trước (Ctrl+C)

# Chạy migration
npx tsx server/scripts/migrate-to-milvus.ts
```

### Output mong đợi:

```
🚀 Starting Milvus Migration...

📡 Connecting to Milvus at localhost:19530...
✅ Connected to Milvus

📚 Found 65 documents to migrate

🗑️  Cleaning up existing collection...
   ✅ Old collection dropped

📦 Creating collection...
   ✅ Collection schema created

🔍 Creating index...
   ✅ Index created (IVF_FLAT, COSINE)

📂 Loading collection...
   ✅ Collection loaded

🤖 Initializing Gemini for embeddings...
   ✅ Gemini initialized

📤 Inserting 65 documents...

   Batch 1/1 (1-65): ✅ Inserted 65 documents

💾 Flushing data to make it searchable...
   ✅ Data flushed

✅ Migration completed!
   Total documents: 65
   Inserted: 65
   Collection: mada_knowledge_base
   Address: localhost:19530

✨ Migration script completed successfully!
```

---

## Stop Milvus

### Khi không cần dùng nữa

```bash
# Stop containers
docker stop milvus-standalone milvus-minio milvus-etcd

# Hoặc xóa hẳn containers
docker rm -f milvus-standalone milvus-minio milvus-etcd milvus-attu
```

### Xóa data (nếu cần reset)

```bash
# Xóa volumes
rm -rf volumes/milvus volumes/etcd volumes/minio

# Xóa containers
docker rm -f milvus-standalone milvus-minio milvus-etcd
```

---

## Restart Milvus (sau khi đã setup)

```bash
# Chỉ cần start lại containers
docker start milvus-etcd
docker start milvus-minio
docker start milvus-standalone

# Verify
curl http://localhost:19530/healthz
```

---

## Troubleshooting

### Lỗi: "Cannot connect to Milvus"

```
❌ Error: Cannot connect to Milvus at localhost:19530
```

**Giải pháp:**
```bash
# Kiểm tra containers có đang chạy không
docker ps

# Nếu không, start lại
docker start milvus-etcd milvus-minio milvus-standalone

# Đợi 10-20 giây rồi thử lại
```

### Lỗi: "Port already in use"

```
❌ Error: Ports are already allocated
```

**Giải pháp:**
```bash
# Tìm process đang dùng port
lsof -i :19530

# Hoặc stop container cũ
docker rm -f milvus-standalone
```

### Lỗi: "Out of memory"

```
❌ Error: Cannot allocate memory
```

**Giải pháp:**
```bash
# Tăng memory cho Docker
# Docker Desktop → Settings → Resources → Memory: 8GB+
```

### Lỗi: "etcd connection failed"

```
❌ Error: context deadline exceeded
```

**Giải pháp:**
```bash
# Restart etcd trước
docker restart milvus-etcd
docker restart milvus-minio
docker restart milvus-standalone
```

### Kiểm tra logs

```bash
# Xem logs của Milvus
docker logs milvus-standalone --tail 50

# Xem logs của etcd
docker logs milvus-etcd --tail 20

# Xem logs của MinIO
docker logs milvus-minio --tail 20
```

---

## Monitoring

### Milvus Attu (Web UI)

Sau khi start Attu:
```
URL: http://localhost:3000
```

Features:
- Xem collections
- Query vectors
- Xem index stats
- Monitor performance

### Cổng kết nối

| Service | Port | Mô tả |
|---------|------|--------|
| Milvus | 19530 | gRPC connection |
| Milvus | 9091 | Milvus health/management |
| MinIO Console | 9001 | Storage dashboard |
| etcd | 2379 | Metadata store |

---

## Performance Tips

### Index Types

| Index | Speed | Accuracy | Memory | Use case |
|-------|-------|----------|--------|----------|
| **FLAT** | Slow | 100% | High | Benchmark |
| **IVF_FLAT** | Medium | ~95% | Medium | Balanced |
| **IVF_SQ8** | Fast | ~90% | Low | Large data |
| **HNSW** | Fastest | ~98% | High | Real-time |
| **ANNOY** | Fast | ~90% | Medium | trees |

### Optimization Tips

1. **Batch size**: Insert 500-1000 vectors/batch
2. **Index nlist**: 4N (N = số vectors) cho IVF
3. **Memory**: Cần ~1GB RAM cho 1M vectors với IVF_FLAT
4. **SSD**: Milvus cần SSD để đạt performance tốt

---

## Chi phí

| Component | Cost |
|-----------|------|
| Docker | Miễn phí |
| Milvus | Miễn phí |
| MinIO | Miễn phí |
| etcd | Miễn phí |
| **Tổng** | **$0** ✅ |

**So sánh với Pinecone:**
- Pinecone Starter: $35/tháng
- Milvus self-hosted: $0

---

## Next Steps

Sau khi setup Milvus thành công:

1. ✅ **Vector DB**: Milvus hoạt động
2. ⬜ **Web Scraper UI**: Tạo giao diện upload URL
3. ⬜ **Auto Scraping**: Cron job cập nhật dữ liệu
4. ⬜ **Paywall**: Tích hợp Stripe

---

## Commands Reference

```bash
# === QUICK START ===
mkdir -p volumes/milvus volumes/etcd volumes/minio

docker run -d --name milvus-etcd \
  -p 2379:2379 \
  -v $(pwd)/volumes/etcd:/etcd \
  milvusdb/etcd:latest \
  etcd -advertise-client-urls=http://127.0.0.1:2379 \
  etcd -listen-client-urls=http://0.0.0.0:2379 --data-dir=/etcd

docker run -d --name milvus-minio \
  -p 9001:9001 -p 9091:9091 \
  -v $(pwd)/volumes/minio:/minio_data \
  minio/minio:latest \
  server /minio_data --console-address ":9091" -address ":9001"

docker run -d --name milvus-standalone \
  -p 19530:19530 -p 9091:9091 \
  -v $(pwd)/volumes/milvus:/var/lib/milvus \
  milvusdb/milvus:latest \
  milvus run standalone

# === VERIFY ===
curl http://localhost:19530/healthz

# === STOP ===
docker stop milvus-standalone milvus-minio milvus-etcd

# === REMOVE ===
docker rm -f milvus-standalone milvus-minio milvus-etcd
```

---

## Liên hệ

- **Milvus Docs**: https://milvus.io/docs
- **Milvus GitHub**: https://github.com/milvus-io/milvus
- **MADA AI Team**: tech-support@mada.org.qa

---

**Document Author**: MADA AI Development Team  
**Last Updated**: August 2026
