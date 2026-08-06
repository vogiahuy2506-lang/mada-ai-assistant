# TUẦN 2: Backend, AI Agent Core & RAG Retrieval Engine

> **Status**: ✅ Implementation Complete (với một số notes)
> **Last Updated**: 2026-08-05
> **Production**: `server/` (port 3001)

> ⚠️ **Note**: Week2 spec code đã được reference trong `backend/src/`, nhưng production sử dụng `server/`. Đã consolidate và update documentation.

## 📦 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                            │
│                    localhost:5173 / localhost:3000                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP/WebSocket
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          API Gateway (Express)                          │
│                     localhost:8080 / :3001                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ /api/chat   │  │ /api/rag    │  │ /api/session│  │ /api/health     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│  AI Agent Engine │  │   RAG Pipeline   │  │   Safety & Guardrails  │
│  (Gemini 2.5)    │  │  (Vector Store)  │  │   (Content Moderation)  │
└──────────────────┘  └──────────────────┘  └──────────────────────────┘
```

---

## 1. AI AGENT ENGINE (40%)

### 1.1 Gemini SDK Integration

**File:** `backend/src/agents/gemini-agent.ts`

```typescript
interface GeminiAgentConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature: number;        // 0.1 - 0.7
  maxTokens: number;          // 8192
  topP: number;               // 0.95
  topK: number;               // 40
  systemInstruction: string;   // Xem bên dưới
}
```

**System Instruction chuẩn:**

```
# MADA AT ASSISTANT - System Instructions

## Role Definition
Bạn là "Mada AT Assistant" - một chuyên gia về Công nghệ Hỗ trợ (Assistive Technology).
- ĐÂY LÀ SẢN PHẨM CÔNG NGHỆ, KHÔNG PHẢI TỔ CHỨC Y TẾ
- KHÔNG BAO GIỜ xưng là bác sĩ, nhân viên y tế, hay đại diện MADA
- KHÔNG BAO GIỜ đưa ra chẩn đoán y khoa

## Nguyên tắc cốt lõi
1. Tập trung vào GIẢI PHÁP CÔNG NGHỆ HỖ TRỢ
2. Đề xuất thiết bị, phần mềm, ứng dụng phù hợp
3. Giải thích cách tiếp cận kỹ thuật số (Digital Accessibility)
4. Luôn khuyến khích tư vấn chuyên gia khi cần

## Ngôn ngữ hỗ trợ
- Tiếng Việt (mặc định)
- Tiếng Anh (English)
- Tiếng Ả Rập (العربية)
- Tiếng Pháp (Français)

## Danh mục sản phẩm MADA
1. Vision - Thiết bị hỗ trợ thị giác (OrCam, JAWS, NVDA, Braille displays)
2. Hearing - Thiết bị hỗ trợ thính giác (Hearing aids, FM systems, captions)
3. Mobility - Thiết bị vận động (Wheelchairs, stair climbers, prosthetics)
4. Communication - Thiết bị giao tiếp (AAC devices, speech synthesizers)
5. Cognition - Hỗ trợ nhận thức (Memory aids, cognitive assistants)
6. Daily Living - Sinh hoạt hàng ngày (Eating aids, bathroom aids)
7. Education - Hỗ trợ giáo dục (Reading software, accessible materials)

## Response Format
Luôn trả lời theo format:
- Đoạn giới thiệu ngắn (1-2 câu)
- Các đề xuất cụ thể với sản phẩm
- Bước hành động tiếp theo
- Lưu ý thăm khám chuyên gia nếu phù hợp

## Safety Rules
- TỪ CHỐI: Chẩn đoán bệnh, kê đơn thuốc, tư vấn điều trị y khoa
- CHUYỂN HƯỚNG: Hỏi về triệu chứng → Đề xuất gặp chuyên gia y tế
- GIỚI HẠN: Không đưa ra thông tin y khoa chi tiết
```

### 1.2 Session Management

**File:** `backend/src/services/session.service.ts`

```typescript
interface ChatSession {
  id: string;                    // UUID v4
  userId: string;                // Anonymous hoặc authenticated
  messages: ChatMessage[];      // Lịch sử hội thoại
  context: ConversationContext; // Ngữ cảnh
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;              // TTL: 24 giờ
  metadata: {
    language: string;           // 'vi', 'en', 'ar', 'fr'
    deviceType: string;         // 'mobile', 'desktop'
    userAgent: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];    // Ảnh, file upload
  ragContext?: RAGContext[];     // Kết quả retrieval
  confidence?: number;           // 0.0 - 1.0
  createdAt: Date;
}

interface ConversationContext {
  detectedNeeds: string[];      // ['vision', 'mobility']
  discussedProducts: string[];    // ['OrCam MyEye', 'JAWS']
  questionsAsked: number;
  followUpCount: number;
  lastTopic: string;
}
```

**Session Lifecycle:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATE    │────▶│    READ    │────▶│   UPDATE    │
│  Session    │     │  Session    │     │  Session    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │           ┌─────────────┐             │
       └──────────▶│   DELETE    │◀────────────┘
                   │  (expired)  │
                   └─────────────┘
```

### 1.3 Multi-turn Context Handler

**File:** `backend/src/services/context.service.ts`

```typescript
interface ContextWindowConfig {
  maxTokens: number;           // 128,000 cho Gemini 2.5
  systemPromptTokens: number;   // ~2,000
  reservedForResponse: number;  // ~4,000
  availableForHistory: number;   // ~122,000
}

// Chiến lược quản lý context
class ContextManager {
  // 1. Truncate: Cắt tin nhắn cũ nhất nếu vượt limit
  // 2. Summarize: Tóm tắt lịch sử cũ
  // 3. RAG-filter: Chỉ giữ lại tin nhắn có RAG context liên quan

  truncateMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    // Implementation
  }

  summarizeHistory(messages: ChatMessage[]): string {
    // "User đã hỏi về thiết bị cho khiếm thị, đã đề cập OrCam và JAWS"
  }
}
```

---

## 2. RAG RETRIEVAL PIPELINE (30%)

### 2.1 Document Schema

**File:** `backend/src/models/product.model.ts`

```typescript
interface Product {
  id: string;
  madaId: string;               // MADA-XXX-001
  name: {
    en: string;
    ar: string;
    vi: string;
    fr: string;
  };
  category: MadaCategory;
  subcategory: string;
  brand: string;
  manufacturer: string;

  // Technical specs
  specifications: {
    [key: string]: string;      // "weight": "250g"
  };

  // Compatibility
  compatibility: {
    platforms: string[];        // ['iOS', 'Android', 'Windows']
    disabilities: string[];     // ['visual', 'physical']
    ageGroups: string[];       // ['children', 'adults', 'seniors']
  };

  // Pricing
  pricing: {
    currency: string;
    minPrice: number;
    maxPrice: number;
    unit: string;              // 'per unit', 'per pair', 'subscription'
  };

  // RAG fields
  vectorEmbedding?: number[];   // 768 dimensions
  keywords: string[];          // ['blind', 'reading', 'portable']
  useCases: string[];          // Mô tả tình huống sử dụng
  targetSymptoms: string[];    // ['cannot read print', 'low vision']

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  confidence: number;           // Điểm tin cậy của sản phẩm (0-1)
}

type MadaCategory =
  | 'vision'
  | 'hearing'
  | 'mobility'
  | 'communication'
  | 'cognition'
  | 'daily_living'
  | 'education';
```

### 2.2 Standards Schema

**File:** `backend/src/models/standard.model.ts`

```typescript
interface AccessibilityStandard {
  id: string;
  code: string;                 // 'WCAG 2.1', 'ISO 9999'
  name: {
    en: string;
    ar: string;
    vi: string;
  };
  description: {
    en: string;
    ar: string;
    vi: string;
  };
  category: MadaCategory[];
  level?: string;              // 'A', 'AA', 'AAA' cho WCAG

  // Vector embedding
  vectorEmbedding?: number[];

  // Related products
  relatedProducts: string[];   // Product IDs
}
```

### 2.3 Chunking Strategy

**File:** `backend/src/services/chunking.service.ts`

```typescript
interface ChunkConfig {
  chunkSize: number;            // 512 tokens
  chunkOverlap: number;         // 64 tokens (12.5%)
  minChunkLength: number;       // 50 tokens
  maxChunkLength: number;       // 1024 tokens
}

// Chiến lược chunking
const CHUNKING_STRATEGY = {
  // 1. Recursive Character Splitting
  separators: ['\n\n', '\n', '. ', ' ', ''],

  // 2. Semantic Chunking (nhóm theo ý)
  semanticThreshold: 0.7,       // Cosine similarity threshold

  // 3. Hybrid: Recursive + Semantic
  hybridMode: true,
};

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  contentHash: string;          // SHA-256 để deduplicate
  tokenCount: number;
  embedding: number[];
  metadata: {
    source: string;
    pageNumber?: number;
    section?: string;
    language: string;
  };
}
```

### 2.4 Embedding Service

**File:** `backend/src/services/embedding.service.ts`

```typescript
interface EmbeddingConfig {
  model: 'text-embedding-004' | 'embedding-001';
  dimensions: 768 | 1024;
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
}

class EmbeddingService {
  private client: any;

  // Batch embedding cho documents
  async embedDocuments(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    // Batch size: 100 chunks/request
    // Rate limit: 60 requests/minute
  }

  // Single embedding cho query
  async embedQuery(query: string): Promise<number[]> {
    // Normalize: lowercase, remove extra spaces
  }
}
```

### 2.5 Vector Store Interface

**File:** `backend/src/services/vector-store.interface.ts`

```typescript
interface VectorStore {
  // Initialize
  initialize(): Promise<void>;

  // CRUD operations
  insert(documents: DocumentChunk[]): Promise<void>;
  upsert(documents: DocumentChunk[]): Promise<void>;
  delete(ids: string[]): Promise<void>;

  // Search
  search(query: number[], options: SearchOptions): Promise<SearchResult[]>;

  // Admin
  getStats(): Promise<StoreStats>;
  healthCheck(): Promise<boolean>;
}

interface SearchOptions {
  topK: number;                // Số lượng kết quả (mặc định: 10)
  minScore: number;            // Ngưỡng similarity (mặc định: 0.5)
  filters?: {
    category?: string[];
    language?: string[];
    priceRange?: [number, number];
  };
  rerank?: boolean;            // Bật re-ranking
  hybridSearch?: boolean;      // Kết hợp keyword + vector
}

interface SearchResult {
  id: string;
  score: number;               // 0.0 - 1.0 (cosine similarity)
  content: string;
  metadata: Record<string, any>;
  rerankScore?: number;        // Sau khi re-ranking
}
```

### 2.6 RAG Retrieval Flow

**File:** `backend/src/services/rag.service.ts`

```typescript
interface RAGRequest {
  query: string;
  language?: string;            // Auto-detect nếu không specify
  categories?: MadaCategory[]; // Filter theo category
  filters?: SearchOptions['filters'];
  maxResults?: number;          // Mặc định: 5
}

interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;       // milliseconds
  totalTokens: number;
}

interface RAGResult {
  type: 'product' | 'standard' | 'guide';
  item: Product | AccessibilityStandard;
  score: number;               // 0.0 - 1.0
  relevanceReason: string;     // "Khớp với 'khiếm thị' và 'đọc sách'"
  confidence: number;          // 0.0 - 1.0
}

// Pipeline flow:
// 1. Query Understanding (detect category, language)
// 2. Query Embedding
// 3. Vector Search
// 4. (Optional) Re-ranking với cross-encoder
// 5. (Optional) Knowledge Graph lookup
// 6. Combine & format context
```

### 2.7 Re-ranking Service

**File:** `backend/src/services/rerank.service.ts`

```typescript
interface RerankConfig {
  model: string;               // 'cross-encoder/ms-marco'
  topN: number;                // Giữ lại top N sau rerank
  batchSize: number;
}

// Cross-encoder reranking
// Input: [query, document] → relevance score
// Dùng khi vector search trả >10 results
```

---

## 3. SAFETY & GUARDRAILS (15%)

### 3.1 Guardrails Architecture

**File:** `backend/src/guardrails/index.ts`

```typescript
interface GuardrailResult {
  passed: boolean;
  action: 'ALLOW' | 'REDIRECT' | 'BLOCK' | 'ESCALATE';
  reason: string;
  suggestions?: string[];      // Gợi ý rephrase
  redirectTo?: string;          // Topic để chuyển hướng
}

// Guardrail layers
interface GuardrailLayer {
  name: string;
  priority: number;
  check(input: string): Promise<GuardrailResult>;
  response?: string;           // Custom response khi fail
}
```

### 3.2 Medical Diagnosis Guardrail

**File:** `backend/src/guardrails/medical-guardrail.ts`

```typescript
// Patterns cần REJECT
const MEDICAL_PATTERNS = {
  // Chuẩn đoán
  diagnosis: [
    /\b(chẩn đoán|diagnosed|bị (?:bệnh|gì|chứng))\b/i,
    /\b(mắc|phải)\s+(?:bệnh|chứng|rối loạn)\b/i,
  ],

  // Thuốc & điều trị
  treatment: [
    /\b(kê đơn|đơn thuốc|prescription)\b/i,
    /\b(uống thuốc|dùng thuốc|dược phẩm)\b/i,
    /\b(phẫu thuật|tiểu phẫu|can thiệp y khoa)\b/i,
  ],

  // Triệu chứng y tế
  symptoms: [
    /\b(triệu chứng|symptom|biểu hiện)\b/i,
    /\b(đau nhức|sốt|ho|khó thở)\b/i,
  ],
};

// Response khi bị block
const MEDICAL_BLOCK_RESPONSE = {
  vi: `Tôi là Mada AT Assistant - chuyên gia về Công nghệ Hỗ trợ, không phải bác sĩ.

Về chẩn đoán và điều trị y khoa, tôi khuyên bạn:
• Tham khảo ý kiến bác sĩ chuyên khoa
• Liên hệ cơ sở y tế gần nhất

Tuy nhiên, tôi có thể giúp bạn về:
• Thiết bị hỗ trợ cho tình trạng của bạn
• Giải pháp tiếp cận kỹ thuật số
• Phần mềm hỗ trợ phù hợp

Bạn muốn tôi giúp gì về Công nghệ Hỗ trợ?`,

  en: `I am Mada AT Assistant - an Assistive Technology specialist, not a medical professional.

For medical diagnosis and treatment, I recommend:
• Consult a qualified healthcare professional
• Contact your nearest medical facility

However, I can help you with:
• Assistive devices for your needs
• Digital accessibility solutions
• Suitable support software

How can I assist you with Assistive Technology?`,
};
```

### 3.3 Scope Guardrail

**File:** `backend/src/guardrails/scope-guardrail.ts`

```typescript
// Các topic được phép
const WITHIN_SCOPE = {
  categories: [
    'vision', 'hearing', 'mobility',
    'communication', 'cognition',
    'daily_living', 'education'
  ],
  topics: [
    'assistive technology', 'thiết bị hỗ trợ',
    'accessibility', 'tiếp cận',
    'adaptive devices', 'software',
    'mada products', 'catalog'
  ],
};

// Các topic cần chuyển hướng
const REDIRECT_MAP = {
  'medical_diagnosis': 'Tôi không thể chẩn đoán y khoa. Tôi có thể giúp bạn tìm thiết bị hỗ trợ phù hợp.',
  'legal_advice': 'Tôi không cung cấp tư vấn pháp lý. Tôi chuyên về Công nghệ Hỗ trợ.',
  'financial_advice': 'Tôi không tư vấn tài chính. Tôi có thể cung cấp thông tin về giá thiết bị AT.',
  'therapy': 'Tôi không cung cấp liệu pháp điều trị. Tôi có thể giới thiệu giải pháp công nghệ phù hợp.',
};
```

### 3.4 Content Moderation Guardrail

**File:** `backend/src/guardrails/content-guardrail.ts`

```typescript
// PII Detection
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\b\d{10,11}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  vietnamId: /\b\d{9,12}\b/,
};

// Harmful content patterns
const HARMFUL_PATTERNS = {
  violence: [/\bhack\b/i, /\binject\b/i, /\bexploit\b/i],
  selfHarm: [/\btự tử\b/i, /\btự hại\b/i],
  illegal: [/\bbom\b/i, /\bđánh cắp\b/i],
};
```

---

## 4. API LAYER (10%)

### 4.1 API Endpoints

**Base URL:** `/api/v1`

#### POST /api/v1/chat

```typescript
// Request
interface ChatRequest {
  message: string;
  sessionId?: string;           // Tạo mới nếu không có
  language?: string;             // 'vi', 'en', 'ar', 'fr'
  attachments?: File[];         // Ảnh, file
}

// Response
interface ChatResponse {
  sessionId: string;
  message: string;              // Tin nhắn AI
  confidence: number;            // 0.0 - 1.0
  sources: RAGResult[];          // Nguồn tham khảo
  detectedCategory?: string;     // Category được detect
  suggestions: string[];         // Gợi ý tiếp theo
  guardrailAction?: string;      // Nếu có guardrail trigger
  metadata: {
    tokensUsed: number;
    processingTimeMs: number;
    model: string;
  };
}
```

#### GET /api/v1/session/:id

```typescript
// Response
interface SessionResponse {
  id: string;
  messages: ChatMessage[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
}
```

#### DELETE /api/v1/session/:id

```typescript
// Xóa session (logout)
```

#### POST /api/v1/rag/search

```typescript
// Request
interface RAGSearchRequest {
  query: string;
  categories?: string[];
  filters?: SearchOptions['filters'];
  topK?: number;
}

// Response
interface RAGSearchResponse {
  results: RAGResult[];
  query: string;
  totalResults: number;
}
```

#### GET /api/v1/health

```typescript
// Response
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    gemini: boolean;
    vectorStore: boolean;
    session: boolean;
  };
  timestamp: string;
}
```

### 4.2 Error Handling

**File:** `backend/src/middleware/error-handler.ts`

```typescript
interface APIError {
  code: string;                  // 'RATE_LIMITED', 'INVALID_REQUEST'
  message: string;
  details?: any;
  statusCode: number;
}

// Error codes
const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
```

### 4.3 Rate Limiting

**File:** `backend/src/middleware/rate-limiter.ts`

```typescript
interface RateLimitConfig {
  windowMs: number;              // 60,000 (1 phút)
  maxRequests: number;            // 30 requests/phút
  maxTokens: number;              // 10,000 tokens/phút
}

// Per-IP rate limiting
// Per-session rate limiting
```

---

## 5. TESTING & MONITORING (5%)

### 5.1 Unit Tests

**File:** `backend/tests/guardrails.test.ts`

```typescript
describe('Medical Guardrail', () => {
  it('should BLOCK medical diagnosis requests', async () => {
    const result = await guardrail.check('Tôi bị tiểu đường, chẩn đoán giúp tôi');
    expect(result.action).toBe('BLOCK');
  });

  it('should ALLOW AT-related requests', async () => {
    const result = await guardrail.check('Thiết bị nào cho người khiếm thị?');
    expect(result.action).toBe('ALLOW');
  });

  it('should REDIRECT treatment questions', async () => {
    const result = await guardrail.check('Tôi nên uống thuốc gì?');
    expect(result.action).toBe('REDIRECT');
  });
});
```

### 5.2 Logging

**File:** `backend/src/utils/logger.ts`

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  sessionId?: string;
  userId?: string;
  action: string;
  duration?: number;
  metadata?: Record<string, any>;
}

// Structured logging (JSON format)
```

### 5.3 Metrics

```typescript
interface Metrics {
  // Request metrics
  requestCount: Counter;
  requestDuration: Histogram;

  // AI metrics
  confidenceScores: Histogram;
  tokensUsed: Counter;
  modelErrors: Counter;

  // RAG metrics
  retrievalLatency: Histogram;
  retrievalAccuracy: Gauge;

  // Guardrail metrics
  guardrailTriggers: Counter;
  blockRate: Gauge;
}
```

---

## 6. FILE STRUCTURE

```
backend/
├── src/
│   ├── agents/
│   │   └── gemini-agent.ts          # AI Agent Engine
│   ├── services/
│   │   ├── session.service.ts       # Session management
│   │   ├── context.service.ts        # Context window handler
│   │   ├── rag.service.ts            # RAG pipeline
│   │   ├── embedding.service.ts      # Embedding generation
│   │   ├── vector-store.ts           # Vector DB operations
│   │   ├── rerank.service.ts         # Re-ranking
│   │   └── chunking.service.ts      # Document chunking
│   ├── guardrails/
│   │   ├── index.ts                  # Guardrail orchestrator
│   │   ├── medical-guardrail.ts      # Medical diagnosis check
│   │   ├── scope-guardrail.ts       # Topic scope check
│   │   └── content-guardrail.ts     # Content moderation
│   ├── models/
│   │   ├── product.model.ts          # Product schema
│   │   ├── standard.model.ts         # Standard schema
│   │   └── session.model.ts          # Session schema
│   ├── routes/
│   │   ├── chat.routes.ts            # /api/v1/chat
│   │   ├── rag.routes.ts             # /api/v1/rag
│   │   ├── session.routes.ts         # /api/v1/session
│   │   └── health.routes.ts          # /api/v1/health
│   ├── middleware/
│   │   ├── error-handler.ts          # Error handling
│   │   ├── rate-limiter.ts           # Rate limiting
│   │   ├── auth.ts                   # Auth (optional)
│   │   └── logger.ts                 # Request logging
│   ├── utils/
│   │   ├── logger.ts                 # Structured logging
│   │   ├── metrics.ts                # Prometheus metrics
│   │   └── validation.ts             # Input validation
│   ├── config/
│   │   ├── gemini.config.ts          # Gemini settings
│   │   ├── rag.config.ts             # RAG settings
│   │   └── app.config.ts             # App settings
│   └── index.ts                      # Entry point
├── tests/
│   ├── agents/
│   │   └── gemini-agent.test.ts
│   ├── guardrails/
│   │   ├── medical-guardrail.test.ts
│   │   ├── scope-guardrail.test.ts
│   │   └── content-guardrail.test.ts
│   ├── services/
│   │   ├── rag.service.test.ts
│   │   └── session.service.test.ts
│   └── routes/
│       └── chat.routes.test.ts
├── data/
│   ├── products/                     # Product data (JSON)
│   ├── standards/                    # Standards data
│   └── embeddings/                  # Pre-computed embeddings
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 7. DEPENDENCIES

```json
{
  "dependencies": {
    // Core
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",

    // AI & GenAI
    "@google/generative-ai": "^0.21.0",

    // Vector DB
    "@pinecone-database/pinecone": "^3.0.0",
    // HOẶC
    "chromadb": "^1.8.0",
    // HOẶC Supabase (pgvector)

    // Embedding
    "@google/generative-ai": "^0.21.0", // Dùng Gemini embedding

    // Session & Cache
    "ioredis": "^5.3.2",
    "uuid": "^9.0.0",

    // Validation
    "zod": "^3.22.0",
    "joi": "^17.12.0",

    // Logging
    "winston": "^3.11.0",
    "pino": "^8.19.0",

    // Monitoring
    "prom-client": "^15.1.0",

    // Utilities
    "dotenv": "^16.4.0",
    "node-cache": "^5.1.2"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/uuid": "^9.0.7",
    "vitest": "^1.2.0",
    "supertest": "^6.3.4",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.3"
  }
}
```

---

## 8. IMPLEMENTATION TIMELINE

| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Setup project structure | Backend skeleton |
| Day 2 | Gemini SDK integration | Working AI chat |
| Day 3 | Session management | Multi-turn chat |
| Day 4 | RAG Pipeline | Vector DB + Search |
| Day 5 | Guardrails | Safety checks |
| Day 6 | API endpoints | Full API |
| Day 7 | Testing + Monitoring | Tests + Logs |

---

## 10. IMPLEMENTATION STATUS & NOTES

### Current Architecture Status

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| **Production Server** | ✅ Active | `server/` (port 3001) | Đang chạy production |
| **Week2 Spec Code** | 🔄 Reference | `backend/src/` | Chưa tích hợp vào production |
| **Re-ranking Service** | ✅ Integrated | `server/lib/rag/rerankService.ts` | Đã tích hợp từ Week2 spec |
| **Guardrails** | ✅ Enhanced | `server/lib/guardrails.ts` | Đã cập nhật với patterns từ Week2 |
| **Logging** | ✅ Added | `server/lib/logger.ts` | Structured logging |
| **Metrics** | ✅ Added | `server/lib/metrics.ts` | Basic metrics collection |

### Integration Notes

1. **Duplicate Code**: `backend/src/` và `server/` có duplicate logic
   - Đã consolidate: giữ `server/` làm production
   - Đã merge: re-ranking, guardrails patterns vào `server/`
   - `backend/src/` vẫn giữ lại để reference

2. **Frontend**: Sử dụng Vite (localhost:5173), KHÔNG phải Next.js
   - Week2 spec ghi Next.js là outdated

3. **Database**: SQLite (không phải Redis)
   - Phù hợp cho development và small-scale production

### File Structure (Actual)

```
server/
├── index.ts                    # Main entry (production)
├── lib/
│   ├── rag/
│   │   ├── ragEngine.ts       # RAG engine với Gemini
│   │   ├── vectorStore.ts     # Vector store abstraction
│   │   ├── rerankService.ts   # ✅ NEW: Re-ranking với Gemini
│   │   ├── fileParsers.ts     # PDF/DOCX parsing
│   │   ├── dataIngestion.ts   # Data loading
│   │   └── taxonomy.ts        # Auto-classification
│   ├── scraper/
│   │   └── scheduler.ts       # Cron job scraping
│   ├── payments/
│   │   └── stripe.ts         # Stripe integration
│   ├── guardrails.ts         # ✅ ENHANCED: Medical + Scope + Content
│   ├── logger.ts             # ✅ NEW: Structured logging
│   ├── metrics.ts            # ✅ NEW: Metrics collection
│   └── db.ts                # SQLite database
└── routes/
    ├── auth.ts, users.ts, knowledgeBase.ts, scraper.ts, payments.ts

backend/src/                   # Reference implementation
├── agents/, services/, guardrails/, models/, routes/
└── Chưa được tích hợp vào production
```

---

## 11. SUCCESS CRITERIA

### AI Agent
- [ ] Response time < 3 giây
- [ ] Confidence score 82-99%
- [ ] Hỗ trợ 4 ngôn ngữ
- [ ] Multi-turn conversation works

### RAG Pipeline
- [ ] Semantic search latency < 500ms
- [ ] Recall > 90% (relevant results)
- [ ] Precision > 70% (results are relevant)
- [ ] Handles 1000+ products

### Safety
- [ ] 100% block medical diagnosis
- [ ] 0% false positive (hợp lệ bị block)
- [ ] Graceful redirect messages

### API
- [ ] 99.9% uptime
- [ ] Rate limiting hoạt động
- [ ] Error responses < 1%
- [ ] Health check works

---

*Document version: 1.0*
*Last updated: 2026-08-04*
