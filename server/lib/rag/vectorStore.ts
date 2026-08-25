/**
 * VectorStore - Pinecone Vector Database
 *
 * Single-provider: Pinecone (cloud). Cần PINECONE_API_KEY trong .env.
 *
 * Khi không có Pinecone, fallback về in-memory cosine search (chỉ dùng dev/test).
 */

// @ts-nocheck
import path from 'path';
import fs from 'fs';
import { Pinecone } from '@pinecone-database/pinecone';
import { pineconeConfig } from './pinecone';

// ============== EMBEDDING PROVIDER ==============

interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): boolean;
  dimension: number;
}

let activeProvider: EmbeddingProvider | null = null;

class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini-embedding-001';
  dimension = 768;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isReady(): boolean { return !!this.apiKey; }

  async embed(text: string): Promise<number[]> {
    const truncated = text.length > 8000 ? text.slice(0, 8000) : text;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    // gemini-embedding-001 defaults to 3072 dims. Pin to 768 to match existing Pinecone schema.
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text: truncated }] },
      outputDimensionality: 768,
    });
    const values = result.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Invalid embedding response');
    }
    return values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (activeProvider) return activeProvider;

  const apiKey = process.env.GEMINI_API_KEY;
  // Accept both old (AIza...) and new (AQ...) Google AI Studio API keys.
  // Old format: starts with "AIza" (39 chars total).
  // New format: starts with "AQ." (~59 chars) — issued by newer AI Studio flows.
  // We just check that the key exists and has a sane minimum length to catch empty/placeholder values.
  const isValidGeminiKey = !!apiKey && apiKey.length >= 30 && apiKey !== 'YOUR_KEY_HERE';
  if (!isValidGeminiKey) {
    if (apiKey) {
      console.error('❌ GEMINI_API_KEY có vẻ không hợp lệ (length=' + apiKey.length + ')');
    } else {
      console.error('❌ GEMINI_API_KEY chưa được set trong .env');
    }
    console.error('   Lấy key mới tại: https://aistudio.google.com/apikey');
    throw new Error('GEMINI_API_KEY is missing or invalid. Set it in .env to enable embeddings.');
  }
  console.log('✅ Using Gemini embeddings: ' + apiKey.substring(0, 10) + '...');
  activeProvider = new GeminiEmbeddingProvider(apiKey!);
  return activeProvider;
}

// ============== DOCUMENT TYPES ==============

export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: 'pdf' | 'web' | 'text' | 'manual' | 'image' | 'docx';
    title?: string;
    createdAt: string;
    itemId?: string;
    category?: string;
    /** ⭐ MADA category slug (e.g. 'sensory-hearing') để filter RAG theo domain */
    madaCategory?: string;
    /** ⭐ Bot ID (e.g. 'bot-hearing') để filter RAG theo agent */
    botId?: string;
    tags?: string[];
    // MADA-specific
    thumbnailUrl?: string;
    galleryImages?: string[];
    postId?: string;
    slug?: string;
    product_url?: string;
    brand?: string;
  };
}

export interface SearchFilter {
  /** Filter theo botId, e.g. 'bot-hearing' */
  botId?: string;
  /** Filter theo madaCategory slug, e.g. 'sensory-hearing' */
  madaCategory?: string;
}

export interface SearchOptions {
  topK?: number;
  filter?: SearchFilter;
}

interface SearchResult {
  content: string;
  metadata: Document['metadata'];
  distance?: number;
  score?: number;
}

// ============== SIMILARITY ==============

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

// ============== VECTOR STORE MAIN CLASS ==============

export type VectorDBProvider = 'pinecone' | 'memory';

class VectorStore {
  // Provider instances
  private pinecone: any = null;
  private pineconeIndex: any = null;

  // State
  private isInitialized = false;
  private activeDbProvider: VectorDBProvider = 'memory';
  private dataDir: string = '';

  // In-memory store (fallback khi không có Pinecone — dùng cho dev/test)
  private inMemoryStore: Map<string, any> = new Map();

  // LRU cache query embeddings (tiết kiệm 300-800ms / hit)
  private embeddingCache: Map<string, { vec: number[]; ts: number }> = new Map();
  private static readonly CACHE_MAX = 200;
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút

  private getCachedEmbedding(query: string): number[] | null {
    const key = query.trim().toLowerCase().slice(0, 200);
    const cached = this.embeddingCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.ts > VectorStore.CACHE_TTL_MS) {
      this.embeddingCache.delete(key);
      return null;
    }
    return cached.vec;
  }

  private setCachedEmbedding(query: string, vec: number[]): void {
    const key = query.trim().toLowerCase().slice(0, 200);
    if (this.embeddingCache.size >= VectorStore.CACHE_MAX) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(key, { vec, ts: Date.now() });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.dataDir = path.join(process.cwd(), 'data', 'chroma');
      fs.mkdirSync(this.dataDir, { recursive: true });

      // Load in-memory data từ disk (cũng dùng làm mirror cho Pinecone)
      await this.loadInMemoryData();

      // Thử initialize Pinecone; nếu fail thì fallback in-memory
      try {
        await this.initializePinecone();
      } catch (e) {
        console.warn('⚠️  Pinecone unavailable — falling back to in-memory vector store');
        this.activeDbProvider = 'memory';
      }

      this.isInitialized = true;
      console.log(`✅ Vector store initialized (${this.activeDbProvider})`);

    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  private async initializePinecone(): Promise<void> {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey || apiKey === 'your_pinecone_api_key_here') {
      throw new Error('Pinecone not configured');
    }

    this.pinecone = new Pinecone({ apiKey });
    this.pineconeIndex = this.pinecone.Index(pineconeConfig.indexName);
    this.activeDbProvider = 'pinecone';
    console.log(`✅ Connected to Pinecone index: ${pineconeConfig.indexName}`);
  }

  private async loadInMemoryData(): Promise<void> {
    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
        const provider = getEmbeddingProvider();
        for (const doc of data) {
          if (!doc.embedding) {
            try {
              doc.embedding = await provider.embed(doc.content);
            } catch (e) {
              console.warn(`⚠️ Skipped doc ${doc.id} — failed to compute embedding`);
              continue;
            }
          }
          this.inMemoryStore.set(doc.id, doc);
        }
        console.log(`📚 Loaded ${this.inMemoryStore.size} documents from disk`);
      } catch (e) {
        console.log('📚 Starting with empty knowledge base');
      }
    }
  }

  private saveMetadataToDisk(): void {
    if (!this.dataDir) return;

    const docsPath = path.join(this.dataDir, 'documents.json');
    const docs = Array.from(this.inMemoryStore.values()).map(({ embedding, ...doc }) => doc);
    fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2));
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const provider = getEmbeddingProvider();

    // Always update in-memory store
    for (const doc of documents) {
      const embedding = await provider.embed(doc.content);
      this.inMemoryStore.set(doc.id, { ...doc, embedding });
    }

    // Sync to Pinecone if using
    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      try {
        const embeddings = await provider.embedBatch(documents.map(d => d.content));
        const vectors = documents.map((doc, i) => ({
          id: doc.id,
          values: embeddings[i],
          metadata: {
            content: doc.content.slice(0, 1000),
            source: doc.metadata.source,
            type: doc.metadata.type,
            title: doc.metadata.title || '',
            category: doc.metadata.category || '',
            madaCategory: doc.metadata.madaCategory || '',
            botId: doc.metadata.botId || '',
          },
        }));
        await this.pineconeIndex.upsert({ records: vectors });
      } catch (err) {
        console.error('Failed to add to Pinecone:', err);
      }
    }

    this.saveMetadataToDisk();
    console.log(`✅ Added ${documents.length} documents (total: ${this.inMemoryStore.size})`);
  }

  async search(query: string, topKOrOptions: number | SearchOptions = 5): Promise<SearchResult[]> {
    // Backward compat: cho phép search(query, topK) hoặc search(query, {topK, filter})
    const opts: SearchOptions = typeof topKOrOptions === 'number'
      ? { topK: topKOrOptions }
      : topKOrOptions;
    const topK = opts.topK || 5;
    const filter = opts.filter;

    const provider = getEmbeddingProvider();
    const cachedVec = this.getCachedEmbedding(query);
    const queryEmbedding = cachedVec || await provider.embed(query);
    if (!cachedVec) this.setCachedEmbedding(query, queryEmbedding);

    // Search Pinecone if using
    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      try {
        const pineconeFilter = filter ? this.buildPineconeFilter(filter) : undefined;
        const results = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
          filter: pineconeFilter,
        });
        return (results.matches || []).map((match: any) => ({
          content: match.metadata?.content || '',
          metadata: {
            source: match.metadata?.source || '',
            type: match.metadata?.type || 'text',
            title: match.metadata?.title || '',
            category: match.metadata?.category || '',
            madaCategory: match.metadata?.madaCategory || '',
            botId: match.metadata?.botId || '',
            createdAt: new Date().toISOString(),
            thumbnailUrl: match.metadata?.thumbnailUrl || '',
            galleryImages: match.metadata?.galleryImages || '',
          },
          distance: match.distance,
          score: 1 - (match.distance || 0),
        }));
      } catch (err) {
        console.error('Pinecone search failed:', err);
      }
    }

    // Fallback: In-memory search (with filter)
    return this.searchInMemory(queryEmbedding, topK, filter);
  }

  /**
   * Build Pinecone metadata filter từ SearchFilter
   */
  private buildPineconeFilter(filter: SearchFilter): any {
    const conditions: any[] = [];
    if (filter.botId) conditions.push({ botId: { '$eq': filter.botId } });
    if (filter.madaCategory) conditions.push({ madaCategory: { '$eq': filter.madaCategory } });
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return { '$and': conditions };
  }

  private searchInMemory(queryEmbedding: number[], topK: number, filter?: SearchFilter): SearchResult[] {
    const results: Array<{ doc: any; score: number }> = [];

    this.inMemoryStore.forEach(doc => {
      if (filter?.botId && doc.metadata?.botId !== filter.botId) return;
      if (filter?.madaCategory && doc.metadata?.madaCategory !== filter.madaCategory) return;

      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      results.push({ doc, score: similarity });
    });

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map(({ doc, score }) => ({
      content: doc.content,
      metadata: doc.metadata,
      score,
      distance: 1 - score,
    }));
  }

  async reindexAll(): Promise<{ count: number; provider: string }> {
    const provider = getEmbeddingProvider();
    console.log(`🔄 Re-indexing ${this.inMemoryStore.size} documents...`);

    for (const [id, doc] of this.inMemoryStore) {
      try {
        const embedding = await provider.embed(doc.content);
        this.inMemoryStore.set(id, { ...doc, embedding });
      } catch (err: any) {
        console.error(`Failed to re-embed ${id}:`, err.message);
      }
    }

    this.saveMetadataToDisk();
    console.log(`✅ Re-indexed ${this.inMemoryStore.size} documents`);
    return { count: this.inMemoryStore.size, provider: this.activeDbProvider };
  }

  async deleteDocument(id: string): Promise<void> {
    this.inMemoryStore.delete(id);

    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      await this.pineconeIndex.deleteOne(id);
    }

    this.saveMetadataToDisk();
  }

  /** Liệt kê documents của 1 agent (dựa trên metadata.agentId). Trả về metadata + content preview, không bao gồm embedding. */
  async listByAgent(agentId: string, options: { limit?: number } = {}): Promise<Array<{ id: string; title: string; content: string; source: string; metadata: any }>> {
    const limit = options.limit || 100;
    const docs: Array<{ id: string; title: string; content: string; source: string; metadata: any }> = [];
    for (const [id, doc] of this.inMemoryStore) {
      if (doc?.metadata?.agentId === agentId) {
        docs.push({
          id,
          title: doc.title || '',
          content: (doc.content || '').slice(0, 500),
          source: doc.source || doc.metadata?.source || '',
          metadata: doc.metadata || {},
        });
      }
    }
    // Sort mới nhất trước (theo crawledAt nếu có)
    docs.sort((a, b) => (b.metadata?.crawledAt || '').localeCompare(a.metadata?.crawledAt || ''));
    return docs.slice(0, limit);
  }

  /** Đếm documents của 1 agent. */
  async countByAgent(agentId: string): Promise<number> {
    let n = 0;
    for (const [, doc] of this.inMemoryStore) {
      if (doc?.metadata?.agentId === agentId) n++;
    }
    return n;
  }

  /** Cập nhật metadata (title) của 1 document trong KB. Trả về true nếu tìm thấy. */
  async updateDocument(id: string, updates: { title?: string }): Promise<boolean> {
    const doc = this.inMemoryStore.get(id);
    if (!doc) return false;

    const updated = { ...doc };
    if (updates.title !== undefined) {
      updated.title = updates.title;
      if (updated.metadata && typeof updated.metadata === 'object') {
        updated.metadata = { ...updated.metadata, customTitle: true };
      }
    }
    this.inMemoryStore.set(id, updated);

    // Sync to Pinecone metadata (không re-embed)
    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      try {
        await this.pineconeIndex.update({
          id,
          metadata: { ...(updated.metadata || {}), title: updated.title },
        });
      } catch (e) {
        console.warn('⚠️ Pinecone metadata update failed:', (e as Error).message);
      }
    }

    // Persist to disk
    this.saveMetadataToDisk();
    return true;
  }

  async getStats(): Promise<any> {
    const provider = getEmbeddingProvider();

    return {
      totalDocuments: this.inMemoryStore.size,
      indexName: pineconeConfig.indexName,
      isInitialized: this.isInitialized,
      provider: this.activeDbProvider,
      dimension: provider.dimension,
      storage: this.activeDbProvider,
    };
  }

  async clear(): Promise<void> {
    this.inMemoryStore.clear();

    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      await this.pineconeIndex.deleteAll();
    }

    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
    }

    console.log('🗑️ Vector store cleared');
  }

  async shutdown(): Promise<void> {
    console.log('🔌 Vector store disconnected');
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

// ============== HELPER FUNCTIONS ==============

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let startIndex = 0;

  while (startIndex < words.length) {
    const chunk = words.slice(startIndex, startIndex + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    startIndex += chunkSize - overlap;
  }

  return chunks;
}

export function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
