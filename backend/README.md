# MADA AI Backend

## Setup

```bash
cd backend
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `GEMINI_API_KEY` - Your Google Gemini API key

## Development

```bash
npm run dev
```

Server will start on http://localhost:8080

## Build

```bash
npm run build
npm start
```

## Docker

```bash
# Build
docker build -t mada-ai-backend .

# Run with docker-compose
docker-compose up -d

# Stop
docker-compose down
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /api/v1/health` - Detailed health check
- `GET /api/v1/health/metrics` - Prometheus metrics

### Chat
- `POST /api/v1/chat` - Send chat message
- `GET /api/v1/chat/session/:id` - Get session
- `DELETE /api/v1/chat/session/:id` - Delete session

### RAG Search
- `POST /api/v1/rag/search` - Search products
- `GET /api/v1/rag/categories` - List categories
- `GET /api/v1/rag/product/:id` - Get product

## API Examples

### Send Chat Message

```bash
curl -X POST http://localhost:8080/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Thiết bị nào cho người khiếm thị?",
    "language": "vi"
  }'
```

### Search Products

```bash
curl -X POST http://localhost:8080/api/v1/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "thiết bị đọc sách cho người mù",
    "topK": 5
  }'
```
