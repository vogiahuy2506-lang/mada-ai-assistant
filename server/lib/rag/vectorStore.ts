/**
 * VectorStore - In-Memory Vector Database
 *
 * Đã xoá Pinecone - chỉ dùng in-memory cosine search.
 * Data được persist vào data/chroma/documents.json
 */

// @ts-nocheck
import path from 'path';
import fs from 'fs';

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

export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (activeProvider) return activeProvider;

  const apiKey = process.env.GEMINI_API_KEY;
  const isValidGeminiKey = !!apiKey && apiKey.length >= 30 && apiKey !== 'YOUR_KEY_HERE';
  if (!isValidGeminiKey) {
    if (apiKey) {
      console.warn('⚠️ GEMINI_API_KEY có vẻ không hợp lệ (length=' + apiKey.length + ') - RAG sẽ bị vô hiệu hóa');
    } else {
      console.warn('⚠️ GEMINI_API_KEY chưa được set trong .env - RAG sẽ bị vô hiệu hóa');
    }
    console.warn('   Lấy key mới tại: https://aistudio.google.com/apikey');
    return null;
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
    type: 'pdf' | 'web' | 'text' | 'manual' | 'image' | 'docx' | 'xlsx' | 'csv';
    title?: string;
    createdAt: string;
    itemId?: string;
    category?: string;
    madaCategory?: string;
    botId?: string;
    agentId?: string;
    tags?: string[];
    thumbnailUrl?: string;
    galleryImages?: string[];
    postId?: string;
    slug?: string;
    product_url?: string;
    brand?: string;
  };
}

export interface SearchFilter {
  botId?: string;
  madaCategory?: string;
  agentId?: string;
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

class VectorStore {
  // State
  private isInitialized = false;
  private dataDir: string = '';

  // In-memory store
  private inMemoryStore: Map<string, any> = new Map();

  // LRU cache query embeddings
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

      await this.loadInMemoryData();

      const provider = getEmbeddingProvider();
      if (!provider) {
        console.warn('⚠️  Embedding provider unavailable — RAG will be limited');
      } else {
        console.log(`✅ Using Gemini embeddings (dimension: ${provider.dimension})`);
      }

      this.isInitialized = true;
      console.log(`✅ Vector store initialized (in-memory, ${this.inMemoryStore.size} docs)`);

    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      this.isInitialized = true;
    }
  }

  private async loadInMemoryData(): Promise<void> {
    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
        const provider = getEmbeddingProvider();
        let embeddedCount = 0;
        let skippedCount = 0;
        for (const doc of data) {
          if (!doc.embedding) {
            if (!provider) {
              skippedCount++;
              continue;
            }
            // ⭐ OPTIMIZATION: Skip embedding computation during init to avoid hangs
            // Embeddings will be computed lazily on-demand
            skippedCount++;
            continue;
          }
          this.inMemoryStore.set(doc.id, doc);
          embeddedCount++;
        }
        console.log(`📚 Loaded ${this.inMemoryStore.size} documents (${embeddedCount} with embeddings, ${skippedCount} pending)`);
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

    for (const doc of documents) {
      if (!provider) {
        this.inMemoryStore.set(doc.id, { ...doc, embedding: [] });
        continue;
      }
      try {
        const embedding = await provider.embed(doc.content);
        this.inMemoryStore.set(doc.id, { ...doc, embedding });
      } catch (e) {
        console.warn(`⚠️ Failed to embed doc ${doc.id}:`, (e as Error).message);
        this.inMemoryStore.set(doc.id, { ...doc, embedding: [] });
      }
    }

    this.saveMetadataToDisk();
    console.log(`✅ Added ${documents.length} documents (total: ${this.inMemoryStore.size})`);
  }

  async search(query: string, topKOrOptions: number | SearchOptions = 5): Promise<SearchResult[]> {
    const opts: SearchOptions = typeof topKOrOptions === 'number'
      ? { topK: topKOrOptions }
      : topKOrOptions;
    const topK = opts.topK || 5;
    const filter = opts.filter;

    const provider = getEmbeddingProvider();
    if (!provider) {
      console.warn('⚠️ Embedding provider not available - returning empty results');
      return [];
    }

    const cachedVec = this.getCachedEmbedding(query);
    let queryEmbedding: number[];
    try {
      queryEmbedding = cachedVec || await provider.embed(query);
      if (!cachedVec) this.setCachedEmbedding(query, queryEmbedding);
    } catch (e) {
      console.error('⚠️ Failed to embed query:', (e as Error).message);
      return [];
    }

    return this.searchInMemory(queryEmbedding, topK, filter);
  }

  private searchInMemory(queryEmbedding: number[], topK: number, filter?: SearchFilter): SearchResult[] {
    const results: Array<{ doc: any; score: number }> = [];

    this.inMemoryStore.forEach(doc => {
      if (filter?.botId && doc.metadata?.botId !== filter.botId) return;
      if (filter?.madaCategory && doc.metadata?.madaCategory !== filter.madaCategory) return;
      if (filter?.agentId && doc.metadata?.agentId !== filter.agentId) return;

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
    if (!provider) {
      console.warn('⚠️ Embedding provider not available - skipping reindex');
      return { count: 0, provider: 'none' };
    }
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
    return { count: this.inMemoryStore.size, provider: 'memory' };
  }

  async deleteDocument(id: string): Promise<void> {
    this.inMemoryStore.delete(id);
    this.saveMetadataToDisk();
  }

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
    docs.sort((a, b) => (b.metadata?.crawledAt || '').localeCompare(a.metadata?.crawledAt || ''));
    return docs.slice(0, limit);
  }

  async countByAgent(agentId: string): Promise<number> {
    let n = 0;
    for (const [, doc] of this.inMemoryStore) {
      if (doc?.metadata?.agentId === agentId) n++;
    }
    return n;
  }

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
    this.saveMetadataToDisk();
    return true;
  }

  async getStats(): Promise<any> {
    const provider = getEmbeddingProvider();

    return {
      totalDocuments: this.inMemoryStore.size,
      isInitialized: this.isInitialized,
      provider: 'memory',
      dimension: provider?.dimension || 768,
      storage: 'in-memory',
      embeddingAvailable: !!provider,
    };
  }

  async clear(): Promise<void> {
    this.inMemoryStore.clear();
    this.embeddingCache.clear();

    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
    }

    console.log('🗑️ Vector store cleared');
  }

  async shutdown(): Promise<void> {
    console.log('🔌 Vector store disconnected');
  }

  // ============== HYBRID SEARCH (BM25 + Vector) ==============

  private async searchBM25(query: string, topK: number, filter?: SearchFilter): Promise<Array<{ doc: any; bm25Score: number }>> {
    const results: Array<{ doc: any; bm25Score: number }> = [];
    
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return results;

    const docCount = this.inMemoryStore.size;
    if (docCount === 0) return results;

    const termDocFreq: Map<string, number> = new Map();
    const termDocLengths: Map<string, number[]> = new Map();
    
    this.inMemoryStore.forEach(doc => {
      if (filter?.botId && doc.metadata?.botId !== filter.botId) return;
      if (filter?.madaCategory && doc.metadata?.madaCategory !== filter.madaCategory) return;
      if (filter?.agentId && doc.metadata?.agentId !== filter.agentId) return;
      
      const content = (doc.content || '').toLowerCase();
      const terms = content.split(/\s+/).filter(t => t.length > 2);
      
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);
      }
      
      for (const term of queryTerms) {
        if (!termDocLengths.has(term)) termDocLengths.set(term, []);
        termDocLengths.get(term)!.push(terms.length);
      }
    });

    const k1 = 1.5;
    const b = 0.75;
    
    const avgDocLengths: Map<string, number> = new Map();
    for (const [term, lengths] of termDocLengths) {
      avgDocLengths.set(term, lengths.reduce((a, b) => a + b, 0) / lengths.length);
    }

    this.inMemoryStore.forEach(doc => {
      if (filter?.botId && doc.metadata?.botId !== filter.botId) return;
      if (filter?.madaCategory && doc.metadata?.madaCategory !== filter.madaCategory) return;
      if (filter?.agentId && doc.metadata?.agentId !== filter.agentId) return;
      
      const content = (doc.content || '').toLowerCase();
      const docLength = content.split(/\s+/).length;
      
      let score = 0;
      for (const term of queryTerms) {
        const termFreq = (content.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        if (termFreq === 0) continue;
        
        const df = termDocFreq.get(term) || 1;
        const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);
        
        const avgDL = avgDocLengths.get(term) || 1;
        const termWeight = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * docLength / avgDL));
        
        score += idf * termWeight;
      }
      
      if (score > 0) {
        results.push({ doc, bm25Score: score });
      }
    });

    results.sort((a, b) => b.bm25Score - a.bm25Score);
    
    return results.slice(0, topK * 2);
  }

  async hybridSearch(
    query: string, 
    topK: number = 10, 
    filter?: SearchFilter,
    vectorWeight: number = 0.7,
    bm25Weight: number = 0.3
  ): Promise<SearchResult[]> {
    const provider = getEmbeddingProvider();
    
    let vectorResults: SearchResult[] = [];
    if (provider) {
      try {
        vectorResults = await this.search(query, topK * 2, filter);
      } catch (e) {
        console.warn('⚠️ Vector search failed in hybrid:', (e as Error).message);
      }
    }
    
    let bm25Results: Array<{ doc: any; bm25Score: number }> = [];
    try {
      bm25Results = await this.searchBM25(query, topK * 2, filter);
    } catch (e) {
      console.warn('⚠️ BM25 search failed in hybrid:', (e as Error).message);
    }
    
    const RRF_K = 60;
    const fusedScores: Map<string, { doc: any; fusedScore: number; vectorScore?: number; bm25Score?: number }> = new Map();
    
    vectorResults.forEach((result, rank) => {
      const id = result.metadata?.itemId || result.metadata?.source || `vec-${rank}`;
      const rrfScore = vectorWeight / (RRF_K + rank + 1);
      fusedScores.set(id, { 
        doc: result, 
        fusedScore: rrfScore, 
        vectorScore: result.score 
      });
    });
    
    bm25Results.forEach(({ doc, bm25Score }, rank) => {
      const id = doc.metadata?.itemId || doc.metadata?.source || `bm25-${rank}`;
      const rrfScore = bm25Weight / (RRF_K + rank + 1);
      
      if (fusedScores.has(id)) {
        fusedScores.get(id)!.fusedScore += rrfScore;
        fusedScores.get(id)!.bm25Score = bm25Score;
      } else {
        fusedScores.set(id, { 
          doc, 
          fusedScore: rrfScore, 
          bm25Score 
        });
      }
    });
    
    const sortedResults = Array.from(fusedScores.values())
      .sort((a, b) => b.fusedScore - a.fusedScore)
      .slice(0, topK)
      .map(({ doc, fusedScore, vectorScore, bm25Score }) => ({
        content: doc.content || doc,
        metadata: doc.metadata || {},
        score: fusedScore,
        vectorScore,
        bm25Score,
        distance: 1 - fusedScore,
      }));
    
    return sortedResults;
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
