# MADA AI Architecture

## Overview

MADA AI is an Assistive Technology (AT) consultation assistant that combines RAG (Retrieval Augmented Generation) with a comprehensive knowledge base.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      React Frontend (Vite)                        │      │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │      │
│   │  │ChatPage  │  │DataMgr  │  │Dashboard │  │Settings  │       │      │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │      │
│   └─────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST API
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND LAYER                                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    Express.js Server (Node.js)                     │      │
│   │                                                                     │      │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │      │
│   │   │  Auth API   │  │  Chat API   │  │  KB API    │              │      │
│   │   └─────────────┘  └─────────────┘  └─────────────┘              │      │
│   │                                                                     │      │
│   │   ┌─────────────────────────────────────────────────┐             │      │
│   │   │              RAG Pipeline                       │             │      │
│   │   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  │             │      │
│   │   │  │Guardrails │──│VectorStore│──│ Gemini AI │  │             │      │
│   │   │  └───────────┘  └───────────┘  └───────────┘  │             │      │
│   │   │                                             │             │      │
│   │   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  │             │      │
│   │   │  │ContentDet │  │  Chunking │  │ Embedding │  │             │      │
│   │   │  └───────────┘  └───────────┘  └───────────┘  │             │      │
│   │   └─────────────────────────────────────────────────┘             │      │
│   └─────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                       │
│                                                                             │
│   ┌─────────────────────┐     ┌─────────────────────┐                       │
│   │    Vector DB       │     │   SQLite Database   │                       │
│   │  ┌───────────────┐ │     │  ┌───────────────┐ │                       │
│   │  │   Milvus     │ │     │  │    Users      │ │                       │
│   │  │   ChromaDB   │ │     │  │   Sessions    │ │                       │
│   │  │   Pinecone   │ │     │  │ Consultations │ │                       │
│   │  └───────────────┘ │     │  └───────────────┘ │                       │
│   └─────────────────────┘     └─────────────────────┘                       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────┐                  │
│   │              Knowledge Base (In-Memory + Indexed)    │                  │
│   │  • WHO GATE APL Products (22 products)              │                  │
│   │  • ISO 9999 Standards                               │                  │
│   │  • WCAG 2.1 Guidelines                             │                  │
│   │  • Medical Device Regulations                       │                  │
│   └─────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + Vite + TypeScript)

- **ChatPage.tsx**: Main chat interface with multi-language support
- **DataManagerPage.tsx**: Knowledge base management (upload, scrape, classify)
- **DashboardPage.tsx**: Analytics and statistics
- **SettingsPage.tsx**: Configuration and preferences

### Backend (Express.js + TypeScript)

#### API Routes

| Route | Description |
|-------|-------------|
| `/api/auth/*` | Authentication (login, register, JWT) |
| `/api/chat` | RAG-powered chat endpoint |
| `/api/kb/*` | Knowledge base operations |
| `/api/scraper/*` | Web scraping for content |
| `/api/data/*` | Data ingestion and seeding |
| `/api/admin/*` | Admin analytics and logs |

#### RAG Pipeline

```
User Query
    │
    ▼
┌─────────────┐
│  Guardrails │ ←── Safety check (medical diagnosis, scope)
└─────────────┘
    │
    ▼
┌─────────────────┐
│ ContentDetector │ ←── AI-powered content type detection
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Vector Search  │ ←── Milvus / ChromaDB / Pinecone / Mock
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Gemini LLM    │ ←── Generate response with context
└─────────────────┘
    │
    ▼
Response
```

### Vector DB Options

1. **Milvus** (Recommended for production)
   - Docker: `docker-compose --profile with-vector up -d milvus`
   - UI: Attractiveness on port 3000

2. **ChromaDB** (For development)
   - Docker: `docker-compose --profile with-chroma up -d chromadb`
   - HTTP API on port 8000

3. **Pinecone** (Cloud-based)
   - Requires `PINECONE_API_KEY` and `PINECONE_ENVIRONMENT`

4. **Mock** (Default, no external service)
   - In-memory similarity search
   - Good for development

## Data Flow

### Knowledge Ingestion Flow

```
Upload/File/URL
    │
    ▼
┌─────────────────┐
│   File Parser   │ ←── PDF, DOCX, TXT support
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ContentDetector  │ ←── AI classification
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Chunking Svc   │ ←── Split into 512-token chunks
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Embedding Svc  │ ←── Gemini embeddings
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Vector DB     │ ←── Store for retrieval
└─────────────────┘
    │
    ▼
Knowledge Base
```

### Chat Flow

```
User Message
    │
    ▼
┌─────────────────┐
│  Guardrails    │ ←── Safety/Scope check
└─────────────────┘
    │
    ▼ (if passed)
┌─────────────────┐
│ Query Embedding │ ←── Gemini embeddings
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Vector Search   │ ←── Top-K similar chunks
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Gemini LLM    │ ←── Generate with context
└─────────────────┘
    │
    ▼
Response + Sources
```

## Security

### Guardrails

- **Medical Guardrail**: Blocks medical diagnosis requests
- **Scope Guardrail**: Redirects out-of-scope questions

### Authentication

- JWT-based authentication
- bcrypt password hashing
- Rate limiting on API endpoints

## Deployment

### Docker

```bash
# Basic (no vector DB)
docker-compose up -d app

# With Milvus
docker-compose --profile with-vector up -d

# With ChromaDB
docker-compose --profile with-chroma up -d

# Full stack with proxy
docker-compose --profile with-vector up -d nginx
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `VECTOR_DB_PROVIDER` | Vector DB: milvus/chroma/pinecone/mock | mock |
| `MILVUS_HOST` | Milvus server host | localhost |
| `CHROMADB_URL` | ChromaDB server URL | localhost:8000 |
| `PINECONE_API_KEY` | Pinecone API key | - |
| `NODE_ENV` | Environment | production |

## Monitoring

### Health Check

```bash
curl http://localhost:3001/api/health
```

### Admin Analytics

```bash
curl http://localhost:3001/api/admin/analytics
```

## Future Enhancements

1. [ ] Multi-user authentication with roles
2. [ ] Real-time WebSocket chat
3. [ ] Advanced analytics dashboard
4. [ ] Document versioning
5. [ ] Feedback loop for model improvement
6. [ ] Multi-language knowledge bases
