# MADA AI Assistant - Technical Documentation

> **Document Version**: 1.0.0
> **Last Updated**: August 2026
> **Status**: Production Ready

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [RAG System](#rag-system)
5. [AI Guardrails](#ai-guardrails)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Security](#security)
9. [Deployment](#deployment)
10. [Monitoring & Logging](#monitoring--logging)

---

## System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React + TypeScript + Tailwind              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │  Header  │  │ Sidebar  │  │ ChatArea  │            │    │
│  │  └──────────┘  └──────────┘  └──────────┘            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Express.js + TypeScript                     │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │
│  │  │  /api/chat │  │ /api/recommend │ │ /api/consult │     │    │
│  │  └────────────┘  └────────────┘  └────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE LAYER                          │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  RAG Engine     │         │  Guardrails     │              │
│  │  ├─ VectorStore │         │  ├─ MedicalBlock │              │
│  │  └─ Gemini 2.5  │         │  └─ ContentFilter│              │
│  └──────────────────┘         └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  ChromaDB        │         │  Knowledge Base  │              │
│  │  (Embeddings)   │         │  (JSON Files)   │              │
│  └──────────────────┘         └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Tech Stack
- **React 18.2** - UI Library
- **TypeScript 5.3** - Type Safety
- **Tailwind CSS 3.4** - Styling
- **Zustand** - State Management
- **React Markdown** - Render AI responses

### State Management

```typescript
// Store Structure
interface AppState {
  // Language
  language: 'vi' | 'en' | 'ar' | 'fr';
  setLanguage: (lang: Language) => void;

  // View Mode
  viewMode: 'end_user' | 'at_specialist';
  toggleViewMode: () => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: Message) => void;

  // Consultation Modal
  isModalOpen: boolean;
  openModal: () => void;
}
```

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | < 640px | Smartphones |
| Tablet | 640px - 1024px | iPads, tablets |
| Desktop | > 1024px | Computers |

---

## Backend Architecture

### Tech Stack
- **Node.js 20** - Runtime
- **Express.js** - API Framework
- **Gemini SDK** - AI Integration
- **ChromaDB** - Vector Database
- **TypeScript** - Type Safety

### Directory Structure

```
server/
├── index.ts              # Main server entry
├── lib/
│   ├── rag/
│   │   ├── ragEngine.ts     # RAG orchestration
│   │   ├── vectorStore.ts   # Vector DB operations
│   │   └── dataIngestion.ts # Data loading
│   └── guardrails.ts        # Safety checks
└── tests/
    └── qa-test-suite.ts    # QA tests
```

---

## RAG System

### How It Works

```
User Query
    │
    ▼
┌─────────────────┐
│ Query Embedding │
│ (TF-IDF + Hash)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │
│ (Cosine Sim)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Building│
│ (Top K Docs)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gemini 2.5      │
│ (Generate)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Guardrails      │
│ (Safety Check)  │
└────────┬────────┘
         │
         ▼
Response + Confidence
```

### Embedding Algorithm

```typescript
// TF-IDF + Hash-based embedding
function createEmbedding(text: string): number[] {
  // 1. Tokenize and count frequencies
  // 2. Hash words to vector indices
  // 3. Normalize vector
  // 4. Return 384-dim vector
}
```

### Similarity Calculation

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  // Cosine(a, b) = (a · b) / (|a| × |b|)
}
```

---

## AI Guardrails

### Safety Features

1. **Medical Diagnosis Detection**
   - Blocks: diagnosis, prescriptions, medical advice
   - Languages: Vietnamese, English, Arabic, French

2. **Out-of-Scope Detection**
   - Blocks: hacking, finance, gambling
   - Redirects to AT topics

3. **Content Validation**
   - Checks responses before sending
   - Ensures no harmful content

### Guardrail Patterns

```typescript
const MEDICAL_PATTERNS = [
  /chẩn đoán.*(bệnh|nặng|nhẹ)/i,
  /uống thuốc.*(gì|bao nhiêu)/i,
  /bác sĩ|bệnh viện|phẫu thuật/i,
  // ... more patterns
];
```

---

## Database Schema

### Knowledge Base (JSON)

```typescript
interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;      // Markdown content
  source: string;       // Source URL
  category: ATCategory;
  standards: string[];   // ISO, WCAG references
  createdAt: string;
}
```

### ChromaDB Collection

```typescript
interface ChromaDocument {
  id: string;
  content: string;
  embedding: number[];   // 384-dim vector
  metadata: {
    source: string;
    category: string;
    standards: string[];
  };
}
```

### Consultation Requests

```typescript
interface ConsultationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  content: string;
  aiResponse?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  resolvedAt?: string;
}
```

---

## API Documentation

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-03T10:00:00.000Z",
  "ragEnabled": true,
  "geminiConfigured": true
}
```

### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Tôi cần thiết bị hỗ trợ người khiếm thị",
  "language": "vi",
  "conversationId": "optional-conversation-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "Dựa trên nhu cầu của bạn...",
    "confidence": 95,
    "sources": [...],
    "contextUsed": true,
    "conversationId": "abc-123"
  }
}
```

### Recommend

```http
POST /api/recommend
Content-Type: application/json

{
  "query": "wheelchair for elderly",
  "category": "mobility",
  "maxResults": 5
}
```

### Consultation

```http
POST /api/consultations
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "email": "email@example.com",
  "phone": "+84 123 456 789",
  "message": "Tôi cần tư vấn về xe lăn cho người già"
}
```

---

## Security

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | development/production |

### Security Headers

```typescript
// Applied in production
{
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

### Rate Limiting

- API endpoints: 10 requests/second
- Chat endpoint: 5 requests/second
- Bulk uploads: 2 requests/minute

---

## Deployment

### Docker

```bash
# Build image
docker build -t mada-ai:latest .

# Run container
docker run -d \
  -p 3001:3001 \
  -e GEMINI_API_KEY=your_key \
  mada-ai:latest
```

### Environment Variables

```bash
# .env file
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
NODE_ENV=production
```

### Health Check

```bash
curl http://localhost:3001/api/health
```

---

## Monitoring & Logging

### Logs

```typescript
// Server logs
console.log('🚀 RAG system ready');
console.log('🛡️ Guardrails system ready');
console.log('✅ Added 24 documents to vector store');
```

### Metrics to Track

1. **Response Time** - Target < 2s
2. **Confidence Score** - Target > 85%
3. **Error Rate** - Target < 1%
4. **Guardrail Triggers** - Monitor patterns

---

## Performance Optimization

### Frontend

- [x] Code splitting by route
- [x] Lazy loading components
- [x] Image optimization
- [x] CSS purging (Tailwind)

### Backend

- [x] Vector caching
- [x] Connection pooling
- [x] Response compression
- [x] Request batching

### Database

- [x] In-memory vector store
- [x] Document persistence
- [x] Efficient indexing

---

## Troubleshooting

### Common Issues

1. **"Gemini API key not configured"**
   - Solution: Add `GEMINI_API_KEY` to `.env`

2. **"Vector store not initialized"**
   - Solution: Restart server after adding documents

3. **"CORS error"**
   - Solution: Check backend is running on correct port

### Debug Mode

```bash
# Enable debug logs
DEBUG=* npm run server
```

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| RAG | Retrieval-Augmented Generation |
| AT | Assistive Technology |
| WCAG | Web Content Accessibility Guidelines |
| ISO | International Organization for Standardization |
| WHO | World Health Organization |

### References

- [Gemini API Documentation](https://ai.google.dev/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ISO 9999:2022](https://www.iso.org/standard/76953.html)
- [WHO GATE Program](https://www.who.int/health-topics/assistive-technology)

---

**Document Author**: MADA AI Development Team
**Last Updated**: August 2026
