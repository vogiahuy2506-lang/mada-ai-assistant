# MADA AI Assistant

> **Hệ thống Tư vấn Công nghệ Hỗ trợ (Assistive Technology) bằng Trí tuệ Nhân tạo**

MADA AI Assistant là một ứng dụng web AI-powered được phát triển để hỗ trợ người khuyết tật và các chuyên gia tìm kiếm thông tin về thiết bị công nghệ hỗ trợ (AT).

![Status](https://img.shields.io/badge/Status-Production-blue)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4.10-06B6D4)
![Node](https://img.shields.io/badge/Node-18+-339933)

---

## 🎯 Tính năng chính

### 1. AI Chat với RAG
- Tích hợp **Gemini 2.5 Flash** cho phản hồi nhanh
- **RAG (Retrieval-Augmented Generation)** với semantic search
- **Confidence Score** hiển thị cho mỗi câu trả lời

### 2. Quản lý Knowledge Base
- Upload file (PDF, DOCX, TXT, CSV)
- Web scraping tự động
- OCR cho hình ảnh
- Auto-classification theo tiêu chuẩn ISO/WHO/WCAG

### 3. Auto Scraping
- Cron job tự động scrape dữ liệu
- Hỗ trợ 7 danh mục AT chính

### 4. Thanh toán (Stripe)
- 3 gói subscription: Free, Pro, Enterprise
- Quản lý quota và usage
- Checkout và Portal integration

### 5. Multi-Vector Database
- **Mock** - Development (không cần setup)
- **Pinecone** - Cloud vector database
- **Milvus** - Self-hosted vector database (Docker)

---

## 🚀 Bắt đầu nhanh

### 1. Cài đặt

```bash
# Clone repository
cd "/Users/vohuy/Downloads/MADA AI ASSISTANT/mada-ai-assistant"

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. Cấu hình

Chỉnh sửa file `.env`:

```env
# Gemini API Key (bắt buộc)
GEMINI_API_KEY=your_gemini_api_key_here

# Vector Database (tùy chọn)
VECTOR_DB_PROVIDER=mock  # hoặc pinecone, milvus
```

### 3. Chạy ứng dụng

```bash
# Chạy cả frontend + backend
npm run dev:all

# Hoặc chạy riêng:
npm run server  # Backend (port 3001)
npm run dev    # Frontend (port 5173)
```

### 4. Truy cập

```
Frontend: http://localhost:5173
Backend:  http://localhost:3001
API:      http://localhost:3001/api/health
```

---

## 📁 Cấu trúc dự án

```
mada-ai-assistant/
├── src/
│   ├── components/          # React components
│   ├── pages/              # Page components
│   │   ├── ChatPage.tsx
│   │   ├── DataManagerPage.tsx
│   │   ├── PricingPage.tsx
│   │   └── admin/          # Admin pages
│   ├── stores/             # Zustand state
│   ├── lib/                # Utilities
│   └── App.tsx
├── server/
│   ├── index.ts             # Express server
│   ├── lib/
│   │   ├── rag/            # RAG engine
│   │   │   ├── ragEngine.ts
│   │   │   ├── vectorStore.ts
│   │   │   ├── dataIngestion.ts
│   │   │   ├── fileParsers.ts
│   │   │   └── taxonomy.ts
│   │   ├── scraper/        # Auto scraping
│   │   │   └── scheduler.ts
│   │   ├── payments/       # Stripe integration
│   │   │   └── stripe.ts
│   │   ├── guardrails.ts   # Safety
│   │   └── auth.ts         # Auth utilities
│   └── routes/
│       ├── auth.ts
│       ├── users.ts
│       ├── knowledgeBase.ts
│       ├── scraper.ts
│       └── payments.ts
├── scripts/
│   └── setup-milvus.sh     # Milvus setup
├── docs/
│   ├── TECHNICAL_DOCUMENTATION.md
│   ├── MILVUS_SETUP_GUIDE.md
│   └── SCRAPING_GUIDE.md
└── data/                   # SQLite DB, uploads
```

---

## 🗄️ Vector Database Options

### Option 1: Mock (Mặc định)
Không cần setup, chạy ngay.

```env
VECTOR_DB_PROVIDER=mock
```

### Option 2: Pinecone (Cloud)
Cần tài khoản Pinecone.

```env
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your_key_here
PINECONE_INDEX_NAME=mada-knowledge-base
```

### Option 3: Milvus (Docker)
Cần Docker Desktop.

```bash
# Khởi động Milvus
./scripts/setup-milvus.sh start

# Hoặc dùng npm script
npm run milvus:start

# Migration dữ liệu
npm run milvus:migrate
```

Xem chi tiết: [docs/MILVUS_SETUP_GUIDE.md](docs/MILVUS_SETUP_GUIDE.md)

---

## 💳 Thanh toán Stripe

### Setup

1. Tạo tài khoản Stripe: https://dashboard.stripe.com/
2. Lấy API keys từ Developers → API keys
3. Tạo Products và Prices trong Stripe Dashboard
4. Thêm vào .env:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/plans` | Lấy danh sách gói |
| POST | `/api/payments/checkout` | Tạo checkout session |
| POST | `/api/payments/portal` | Tạo billing portal |
| GET | `/api/payments/subscription/:userId` | Lấy subscription |
| GET | `/api/payments/usage/:userId` | Lấy usage stats |
| POST | `/api/payments/webhook` | Stripe webhook |

---

## 🔄 Auto Scraping

### Setup

Cron job chạy tự động scrape dữ liệu định kỳ.

```bash
# Chạy scheduler
npx tsx server/lib/scraper/scheduler.ts start

# Chạy scrape một lần
npx tsx server/lib/scraper/scheduler.ts run

# Xem status
npx tsx server/lib/scraper/scheduler.ts status
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scraper/sources` | Lấy danh sách nguồn |
| POST | `/api/scraper/sources` | Thêm nguồn mới |
| POST | `/api/scraper/sources/:id/run` | Chạy scrape cho 1 nguồn |
| POST | `/api/scraper/run-all` | Chạy tất cả nguồn |
| GET | `/api/scraper/status` | Trạng thái scheduler |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET | `/api/auth/me` | Lấy thông tin user |

### Knowledge Base
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb/items` | Lấy danh sách items |
| POST | `/api/kb/upload` | Upload file |
| POST | `/api/kb/scrape` | Scrape URL |
| POST | `/api/kb/text` | Thêm text |
| GET | `/api/kb/stats` | Thống kê KB |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Chat với AI |
| GET | `/api/knowledge/search` | Semantic search |
| POST | `/api/recommend` | Gợi ý sản phẩm |

### Consultation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/consultation` | Gửi yêu cầu tư vấn |
| GET | `/api/consultation` | Lấy danh sách yêu cầu |

---

## 🔐 Default Users

| Email | Password | Role |
|-------|----------|------|
| admin@mada.vn | Admin@123 | admin |
| expert@mada.vn | Expert@123 | expert |
| data@mada.vn | Data@123 | data_manager |
| user@mada.vn | User@123 | user |

**Thay đổi password trong production!**

---

## 🎛️ Scripts

```bash
# Development
npm run dev           # Frontend (Vite)
npm run server       # Backend (Express)
npm run dev:all      # Cả hai

# Build
npm run build         # Production build
npm run lint         # Check linting

# Milvus
npm run milvus:start    # Khởi động Milvus (Docker)
npm run milvus:stop     # Dừng Milvus
npm run milvus:status   # Kiểm tra trạng thái
npm run milvus:logs     # Xem logs
npm run milvus:health   # Health check

# Data
curl -X POST http://localhost:3001/api/data/sample    # Load sample data
curl -X POST http://localhost:3001/api/data/seed      # Load seed data
curl -X POST http://localhost:3001/api/data/comprehensive  # Load full KB
```

---

## 📊 Tiêu chuẩn tuân thủ

- **WCAG 2.1 Level AA** - Web Accessibility
- **ISO 9999:2022** - Assistive Products Classification
- **WHO GATE** - Global Assistive Technology Initiative
- **GDPR** - Data Protection (EU)

---

## 🐳 Docker Deployment

### Full Stack với Milvus

```bash
# Khởi động Milvus
./scripts/setup-milvus.sh start

# Build và chạy app
docker-compose up -d

# Migration dữ liệu
npm run milvus:migrate

# Khởi động server
npm run server
```

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production

# Gemini
GEMINI_API_KEY=xxx

# Vector DB
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# CORS
CORS_ORIGINS=https://yourdomain.com
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests for RAG engine
npm run test:unit

# Run with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Install Playwright browsers
npx playwright install --with-deps chromium

# Run E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/consultation.spec.ts
```

### Test Coverage

- **RAG Engine**: Query processing, language support, search results, error handling
- **Consultation Flow**: Modal, form validation, submission, close
- **Accessibility**: Keyboard navigation, ARIA labels, skip links
- **Image Proxy**: URL validation, thumbnail handling

---

## 🔄 CI/CD Pipeline

### GitHub Actions

Pipeline tự động chạy:

1. **Lint & Type Check** - ESLint, TypeScript compiler
2. **Unit Tests** - Vitest unit tests
3. **E2E Tests** - Playwright E2E tests
4. **Build** - Vite build, TypeScript compile
5. **Docker** - Build & push images
6. **Deploy** - Staging/Production

### Setup Secrets

Thêm trong GitHub Settings → Secrets:

```
GEMINI_API_KEY
PINECONE_API_KEY
DOCKER_USERNAME
DOCKER_PASSWORD
STAGING_HOST
STAGING_USER
STAGING_SSH_KEY
PRODUCTION_HOST
PRODUCTION_USER
PRODUCTION_SSH_KEY
```

---

## 🐳 Docker Deployment

### Quick Start

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Start with Milvus (optional)
docker-compose --profile with-milvus up -d

# Start with monitoring (optional)
docker-compose --profile monitoring up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 5173 | React Vite app |
| backend | 3000 | Express API server |
| milvus | 19530 | Vector database (optional) |
| prometheus | 9090 | Metrics (optional) |
| grafana | 3001 | Dashboards (optional) |

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Gemini
GEMINI_API_KEY=xxx

# Vector DB
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# CORS
CORS_ORIGINS=https://yourdomain.com
```

---

## 📝 Changelog

### v1.0.0 (August 2026)
- ✅ Multi-vector database support (Mock, Pinecone, Milvus)
- ✅ Auto scraping với Cron
- ✅ Stripe payment integration
- ✅ Upload file (PDF, DOCX, TXT, CSV)
- ✅ Web scraping
- ✅ OCR cho hình ảnh
- ✅ 7 danh mục AT
- ✅ Safety guardrails
- ✅ Multi-language (VI, EN, AR, FR)

---

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

---

## 📧 Liên hệ

- **MADA Center Qatar**: at.mada.org.qa
- **Email**: info@mada.org.qa

---

## 📄 License

MIT License - xem [LICENSE](LICENSE) để biết thêm chi tiết.

---

**Made with ❤️ by MADA AI Team**
