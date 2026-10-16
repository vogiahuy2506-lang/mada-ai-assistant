# MADA AI Assistant - Technical Documentation

> **Document Version**: 2.1.0
> **Last Updated**: August 2026
> **Status**: Production Ready
> **Production Server**: `server/` (port 3001)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Vector Database](#vector-database)
5. [RAG System](#rag-system)
6. [AI Guardrails](#ai-guardrails)
7. [Auto Scraping](#auto-scraping)
8. [Payment System](#payment-system)
9. [Database Schema](#database-schema)
10. [API Documentation](#api-documentation)
11. [Security](#security)
12. [Deployment](#deployment)
13. [Metrics & Logging](#metrics--logging)

---

## System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React + TypeScript + Tailwind              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │  Header  │  │ Sidebar │  │ ChatArea │            │    │
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
│  │  │  /api/chat│  │  /api/kb  │  │/api/payment│       │    │
│  │  └────────────┘  └────────────┘  └────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE LAYER                          │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  RAG Engine     │         │  Guardrails      │              │
│  │  ├─ VectorStore│         │  ├─ MedicalBlock │              │
│  │  └─ Gemini 2.5│         │  └─ ContentFilter│              │
│  └──────────────────┘         └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────────┐  ┌──────────────────�              │
│  │   Pinecone       │  │  Knowledge Base │              │
│  │   (Cloud)        │  │  (SQLite + FS) │              │
│  └──────────────────┘  └──────────────────┘              │
│  ┌──────────────────┐                                          │
│  │  In-Memory       │                                          │
│  │  Fallback (Dev) │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Tech Stack
- **React 18.3** - UI Library
- **TypeScript 5.5** - Type Safety
- **Tailwind CSS 3.4** - Styling
- **Zustand** - State Management
- **React Markdown** - Render AI responses
- **Lucide React** - Icons

### State Management

```typescript
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
- **Multi Vector DB** - Pinecone (cloud) + In-Memory fallback
- **TypeScript** - Type Safety

### Directory Structure

```
server/
├── index.ts              # Main server entry
├── lib/
│   ├── rag/
│   │   ├── ragEngine.ts     # RAG orchestration
│   │   ├── vectorStore.ts   # Multi-vector DB abstraction
│   │   ├── dataIngestion.ts # Data loading & scraping
│   │   ├── fileParsers.ts   # PDF/DOCX parsing
│   │   ├── ocrHelper.ts     # Image OCR
│   │   └── taxonomy.ts      # Auto-classification
│   ├── scraper/
│   │   └── scheduler.ts     # Auto scraping scheduler
│   ├── payments/
│   │   └── stripe.ts        # Stripe integration
│   ├── guardrails.ts        # Safety checks
│   └── db.ts               # SQLite database
├── routes/
│   ├── auth.ts             # Authentication
│   ├── users.ts            # User management
│   ├── knowledgeBase.ts    # Knowledge base API
│   ├── scraper.ts          # Scraper API
│   └── payments.ts         # Payment API
└── scripts/
    └── (no scripts needed)
```

---

## Vector Database

### Supported Providers

| Provider | Type | Use Case | Setup Required |
|----------|------|----------|---------------|
| **In-Memory** | In-memory | Development / fallback | None |
| **Pinecone** | Cloud | Production (cloud) | API Key |

### Configuration

```bash
# Gemini API Key (bắt buộc)
GEMINI_API_KEY=your_key_here
```

### Architecture

```
VectorStore (abstraction layer)
    │
    ├── Pinecone Provider (cloud)
    │       └── Scalable, no infrastructure
    │
    └── In-Memory Fallback (cosine similarity)
            └── Fast for dev/test, persistent trong data/chroma/documents.json
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
│ (Gemini/TF-IDF)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search    │
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
// TF-IDF + Hash-based embedding (Mock)
function createEmbedding(text: string): number[] {
  // 1. Tokenize and count frequencies
  // 2. Hash words to vector indices
  // 3. Normalize vector
  // 4. Return 384-dim vector (Mock) or 768-dim (Gemini)
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  return dot(a, b) / (|a| × |b|)
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
];
```

---

## Auto Scraping

### Features

- Cron job scheduling (hourly/daily/weekly)
- Web scraping with cheerio
- Auto-classification (ISO/WHO/WCAG)
- Progress tracking
- Error handling with retries

### Supported Sources

| Source | Frequency | Category |
|--------|-----------|----------|
| WHO - Disability & Health | Weekly | Health |
| W3C WCAG Guidelines | Weekly | Accessibility |
| Accessibility Guides | Weekly | General |
| CDC - Disability & Health | Weekly | Health |

### Usage

```bash
# Start scheduler
npx tsx server/lib/scraper/scheduler.ts start

# Run all scrapes once
npx tsx server/lib/scraper/scheduler.ts run

# Check status
npx tsx server/lib/scraper/scheduler.ts status
```

---

## Payment System

### Plans

| Plan | Price | Queries/Month | Documents | Features |
|------|-------|---------------|----------|----------|
| Free | 0 VND | 10 | 5 | Basic AI |
| Pro | 99,000 VND | 100 | 100 | Full RAG, Upload |
| Enterprise | 299,000 VND | Unlimited | Unlimited | Multi-user, SLA |

### Stripe Integration

```bash
# Required environment variables
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
```

### Features
- Checkout Sessions
- Billing Portal
- Webhook handling
- Usage tracking
- Quota management

---

## Database Schema

### Knowledge Base (SQLite)

```typescript
interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  content: string;
  source: string;
  source_type: 'pdf' | 'web' | 'text' | 'image' | 'docx';
  category: ATCategory;
  iso_codes: string[];
  wcag_level: string;
  confidence: number;
  status: 'draft' | 'published' | 'archived';
  chunk_count: number;
  indexed: boolean;
  created_at: string;
}
```

### Scheduled Sources

```typescript
interface ScheduledSource {
  id: string;
  url: string;
  name: string;
  type: 'web' | 'api';
  frequency: 'hourly' | 'daily' | 'weekly';
  status: 'active' | 'paused' | 'error';
  last_run: string;
  documents_added: number;
}
```

### Subscriptions (Stripe)

```typescript
interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due';
  current_period_start: string;
  current_period_end: string;
}
```

---

## API Documentation

### Health Check

```http
GET /api/health
```

### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Tôi cần thiết bị hỗ trợ người khiếm thị",
  "language": "vi",
  "conversationId": "optional-id"
}
```

### Knowledge Base

```http
# Upload file
POST /api/kb/upload

# Scrape URL
POST /api/kb/scrape
{ "url": "https://example.com" }

# Search
GET /api/knowledge/search?q=wheelchair
```

### Scraper

```http
# List sources
GET /api/scraper/sources

# Run scrape
POST /api/scraper/sources/:id/run

# Run all
POST /api/scraper/run-all
```

### Payments

```http
# Get plans
GET /api/payments/plans

# Create checkout
POST /api/payments/checkout
{ "planId": "pro", "userId": "xxx" }

# Get subscription
GET /api/payments/subscription/:userId

# Get usage
GET /api/payments/usage/:userId
```

---

## Security

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `STRIPE_SECRET_KEY` | For payments | Stripe API key |
| `PORT` | No | Server port (default: 3001) |

### Security Headers

```typescript
{
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

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
  -v ./data:/app/data \
  mada-ai:latest
```


### Migration

```bash
# Migrate to Pinecone
---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend (Vite) |
| `npm run server` | Start backend (Express) |
| `npm run dev:all` | Start both |
| `npm run build` | Production build |
| `npm run scraper:start` | Start scraper scheduler |
| `npm run scraper:run` | Run scraper once |

---

## Metrics & Logging

### Structured Logging

```typescript
import { logger, ragLogger, authLogger } from './lib/logger';

// Basic logging
logger.info('Server started', { port: 3001 });
logger.success('User logged in', { userId: '123' });
logger.warn('Rate limit exceeded', { ip: '192.168.1.1' });
logger.error('Database connection failed', error);

// Timed operations
await ragLogger.timed('query', async () => {
  return await ragEngine.query(query);
}, { queryLength: query.length });
```

### Metrics Collection

```typescript
import {
  recordRequestMetrics,
  recordRAGMetrics,
  recordGuardrailMetrics,
  recordAIMetrics,
  getMetricsSummary,
} from './lib/metrics';

// Record metrics
recordRequestMetrics('/api/chat', 'POST', 200, 150);
recordRAGMetrics(5, 0.95, 50, true);
recordGuardrailMetrics(true, undefined, 5);
recordAIMetrics(500, 'gemini-2.5-flash', 200, true);

// Get summary
const summary = getMetricsSummary();
```

### Metrics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/logs` | GET | View activity logs |
| `/api/admin/logs/sources` | GET | List log sources |
| `/api/admin/analytics` | GET | View analytics summary |

---

*Document version: 2.1.0*
*Last updated: 2026-08-05*
