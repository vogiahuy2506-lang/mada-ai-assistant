# MADA AI Assistant

> **Hệ thống Tư vấn Công nghệ Hỗ trợ (Assistive Technology) bằng Trí tuệ Nhân tạo**

MADA AI Assistant là một ứng dụng web AI-powered được phát triển để hỗ trợ người khuyết tật và các chuyên gia tìm kiếm thông tin về thiết bị công nghệ hỗ trợ (AT).

![MADA AI](https://img.shields.io/badge/Status-Production-blue)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.0-3178C6)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4.0-06B6D4)
![Gemini](https://img.shields.io/badge/Gemini-2.5-FABB05)

## 🎯 Tính năng chính

### 1. AI Agent Engine
- Tích hợp **Gemini 2.5 Flash** cho phản hồi nhanh và chính xác
- **RAG (Retrieval-Augmented Generation)** với semantic search
- **Confidence Score** 82-99% cho mỗi câu trả lời

### 2. 7 Danh mục Công nghệ Hỗ trợ
- 👁️ **Vision** - Thiết bị hỗ trợ thị giác
- 👂 **Hearing** - Thiết bị hỗ trợ thính giác
- 🦽 **Mobility** - Thiết bị vận động
- 🧠 **Cognition** - Thiết bị hỗ trợ nhận thức
- 💬 **Communication** - Thiết bị giao tiếp
- 🏠 **Daily Living** - Hỗ trợ sinh hoạt
- 📚 **Education** - Giáo dục

### 3. Hai Chế độ Xem
- **End-User Mode** - Giao diện thân thiện cho người dùng phổ thông
- **AT Specialist Mode** - Chế độ chuyên sâu với tiêu chuẩn ISO/WCAG/WHO

### 4. Đa ngôn ngữ
- 🇻🇳 Tiếng Việt
- 🇺🇸 English
- 🇸🇦 العربية
- 🇫🇷 Français

### 5. Safety Guardrails
- Tự động từ chối chẩn đoán y khoa
- Chuyển hướng đến chuyên gia khi cần
- Kiểm duyệt nội dung an toàn

## 🚀 Bắt đầu nhanh

### Yêu cầu
- Node.js 18+
- npm 9+

### Cài đặt

```bash
# Clone repository
git clone https://github.com/your-org/mada-ai-assistant.git
cd mada-ai-assistant

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your Gemini API key
# GEMINI_API_KEY=your_api_key_here

# Start development server
npm run dev
```

### Chạy Backend

```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
npm run dev
```

### Docker Deployment

```bash
# Build and run with Docker
docker-compose up -d

# Or with custom environment
GEMINI_API_KEY=your_key docker-compose up -d
```

## 📁 Cấu trúc dự án

```
mada-ai-assistant/
├── src/
│   ├── components/          # React components
│   ├── pages/              # Page components
│   ├── stores/             # Zustand state management
│   ├── styles/              # CSS styles (Tailwind + accessibility)
│   ├── types/              # TypeScript definitions
│   └── App.tsx             # Main app component
├── server/
│   ├── index.ts            # Express server
│   ├── lib/
│   │   ├── rag/            # RAG engine
│   │   │   ├── ragEngine.ts
│   │   │   ├── vectorStore.ts
│   │   │   └── dataIngestion.ts
│   │   └── guardrails.ts   # Safety guardrails
│   └── tests/
│       └── qa-test-suite.ts # QA test suite
├── nginx/                   # Nginx config
├── docker-compose.yml
├── Dockerfile
└── vercel.json
```

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | Chat với AI |
| POST | `/api/recommend` | Gợi ý sản phẩm |
| POST | `/api/data/comprehensive` | Load knowledge base |
| GET | `/api/knowledge/stats` | Knowledge base stats |
| POST | `/api/consultations` | Gửi yêu cầu tư vấn |

## 📊 Tiêu chuẩn tuân thủ

- **WCAG 2.2 Level AA** - Web Accessibility
- **ISO 9999:2022** - Assistive Products Classification
- **WHO GATE** - Global Assistive Technology Initiative

## 🧪 Testing

```bash
# Run QA tests
npx tsx server/tests/run-tests.ts

# Run with custom API
API_URL=https://your-api.com npx tsx server/tests/run-tests.ts
```

## 🚢 Deployment

### Docker
```bash
./deploy.sh docker
```

### Vercel
```bash
./deploy.sh vercel
```

### Google Cloud Run
```bash
GCP_PROJECT_ID=your-project ./deploy.sh gcp
```

## 📝 License

MIT License - xem [LICENSE](LICENSE) để biết thêm chi tiết.

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📧 Liên hệ

- **MADA Center Qatar**: at.mada.org.qa
- **Email**: info@mada.org.qa

---

**Made with ❤️ by MADA AI Team**
