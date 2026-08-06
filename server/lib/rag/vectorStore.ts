/**
 * VectorStore - Multi-Provider Vector Database
 * 
 * Hỗ trợ 3 Vector Database providers:
 * 1. Mock (fallback): TF-IDF mock cho development khi không có DB
 * 2. Pinecone (cloud): Semantic search với AI embeddings - cloud hosted
 * 3. Milvus (local/cloud): High-performance vector DB - cần Docker
 * 
 * Priority: Mock → Milvus → Pinecone
 * (Dùng provider nào available đầu tiên)
 * 
 * Để chọn provider cụ thể, set trong .env:
 *   VECTOR_DB_PROVIDER=milvus    (local, cần Docker)
 *   VECTOR_DB_PROVIDER=pinecone  (cloud, cần API key)
 *   VECTOR_DB_PROVIDER=mock      (demo, không cần gì)
 * 
 * Hoặc để trống để dùng auto-detect (Milvus → Pinecone → Mock)
 */

// @ts-nocheck
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { pineconeConfig } from './pinecone';
import { milvusClient, milvusConfig, isMilvusConfigured } from './milvus';

// ============== EMBEDDING PROVIDER ==============

interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): boolean;
  dimension: number;
}

let activeProvider: EmbeddingProvider | null = null;

class MockEmbeddingProvider implements EmbeddingProvider {
  name = 'mock-tfidf';
  dimension = 384;

  isReady(): boolean { return true; }

  async embed(text: string): Promise<number[]> {
    return createSimpleEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(text => createSimpleEmbedding(text));
  }
}

class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini-text-embedding-004';
  dimension = 768;
  private genAI: any = null;

  constructor(apiKey: string) {
    try {
      import('@google/generative-ai').then((mod) => {
        this.genAI = new mod.GoogleGenerativeAI(apiKey);
      }).catch((err) => {
        console.warn('Failed to init Gemini embeddings:', err);
      });
    } catch (err) {
      console.warn('Failed to init Gemini embeddings:', err);
    }
  }

  isReady(): boolean { return this.genAI !== null; }

  async embed(text: string): Promise<number[]> {
    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const truncated = text.length > 8000 ? text.slice(0, 8000) : text;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(truncated);
      const values = result.embedding?.values;
      if (!values || !Array.isArray(values)) {
        throw new Error('Invalid embedding response');
      }
      return values;
    } catch (err: any) {
      console.error('Gemini embedContent failed:', err.message);
      return createSimpleEmbedding(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (activeProvider) return activeProvider;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'your_gemini_api_key_here') {
    const provider = new GeminiEmbeddingProvider(apiKey);
    if (provider.isReady()) {
      console.log('✅ Using Gemini embeddings');
      activeProvider = provider;
      return provider;
    }
  }

  console.log('⚠️  Using mock embeddings (set GEMINI_API_KEY để bật Gemini)');
  activeProvider = new MockEmbeddingProvider();
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
    tags?: string[];
  };
}

interface SearchResult {
  content: string;
  metadata: Document['metadata'];
  distance?: number;
  score?: number;
}

// ============== MOCK VECTOR FUNCTIONS ==============

function createSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount: Record<string, number> = {};
  
  words.forEach(word => {
    if (word.length > 2) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  const dimension = 384;
  const vector = new Array(dimension).fill(0);
  
  Object.keys(wordCount).slice(0, 50).forEach((word, i) => {
    const hash = crypto.createHash('md5').update(word).digest();
    for (let j = 0; j < Math.min(16, dimension); j++) {
      const idx = (hash[j % hash.length] + i * 7 + j * 13) % dimension;
      vector[idx] += (wordCount[word] / words.length) * (hash[j] / 255);
    }
  });
  
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
}

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

export type VectorDBProvider = 'mock' | 'pinecone' | 'milvus' | 'auto';

class VectorStore {
  // Provider instances
  private pinecone: any = null;
  private pineconeIndex: any = null;
  
  // State
  private isInitialized = false;
  private activeDbProvider: VectorDBProvider = 'mock';
  private dataDir: string = '';
  
  // In-memory store (backup khi không có vector DB)
  private inMemoryStore: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.dataDir = path.join(process.cwd(), 'data', 'chroma');
      fs.mkdirSync(this.dataDir, { recursive: true });

      // Load in-memory data từ disk
      await this.loadInMemoryData();

      // Detect và initialize provider
      const preferredProvider = (process.env.VECTOR_DB_PROVIDER || 'auto') as VectorDBProvider;
      
      if (preferredProvider === 'auto') {
        await this.initializeAutoProvider();
      } else {
        await this.initializeProvider(preferredProvider);
      }

      this.isInitialized = true;
      console.log(`✅ Vector store initialized (${this.activeDbProvider})`);
      
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      this.activeDbProvider = 'mock';
      this.isInitialized = true;
    }
  }

  private async initializeAutoProvider(): Promise<void> {
    console.log('🔍 Auto-detecting Vector DB provider...');
    
    // Thử Milvus trước (local, fast)
    try {
      await this.initializeProvider('milvus');
      return;
    } catch (e) {
      console.log('⚠️  Milvus not available, trying Pinecone...');
    }

    // Thử Pinecone
    try {
      await this.initializeProvider('pinecone');
      return;
    } catch (e) {
      console.log('⚠️  Pinecone not available, using Mock...');
    }

    this.activeDbProvider = 'mock';
    console.log('⚠️  Using in-memory mock vector store');
  }

  private async initializeProvider(provider: VectorDBProvider): Promise<void> {
    switch (provider) {
      case 'milvus':
        await this.initializeMilvus();
        break;
      case 'pinecone':
        await this.initializePinecone();
        break;
      default:
        this.activeDbProvider = 'mock';
    }
  }

  private async initializeMilvus(): Promise<void> {
    if (!isMilvusConfigured()) {
      throw new Error('Milvus not configured');
    }

    console.log(`🔌 Connecting to Milvus at ${milvusConfig.address}...`);
    
    const connected = await milvusClient.connect();
    if (!connected) {
      throw new Error('Failed to connect to Milvus');
    }

    // Create collection if not exists
    await milvusClient.createCollection();
    await milvusClient.loadCollection();

    this.activeDbProvider = 'milvus';
    console.log(`✅ Connected to Milvus (collection: ${milvusConfig.collectionName})`);
  }

  private async initializePinecone(): Promise<void> {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey || apiKey === 'your_pinecone_api_key_here') {
      throw new Error('Pinecone not configured');
    }

    try {
      this.pinecone = new Pinecone({ apiKey });
      this.pineconeIndex = this.pinecone.Index(pineconeConfig.indexName);
      this.activeDbProvider = 'pinecone';
      console.log(`✅ Connected to Pinecone index: ${pineconeConfig.indexName}`);
    } catch (error) {
      console.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  private async loadInMemoryData(): Promise<void> {
    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
        data.forEach((doc: any) => {
          this.inMemoryStore.set(doc.id, {
            ...doc,
            embedding: createSimpleEmbedding(doc.content),
          });
        });
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

    // Add to Milvus if using
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      try {
        const embeddings = await provider.embedBatch(documents.map(d => d.content));
        const vectors = documents.map((doc, i) => ({
          id: doc.id,
          content: doc.content,
          embedding: embeddings[i],
          source: doc.metadata.source,
          type: doc.metadata.type,
          title: doc.metadata.title || '',
          category: doc.metadata.category || '',
        }));
        await milvusClient.insert(vectors);
      } catch (err) {
        console.error('Failed to add to Milvus:', err);
      }
    }

    // Add to Pinecone if using
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
          },
        }));
        await this.pineconeIndex.upsert(vectors);
      } catch (err) {
        console.error('Failed to add to Pinecone:', err);
      }
    }

    this.saveMetadataToDisk();
    console.log(`✅ Added ${documents.length} documents (total: ${this.inMemoryStore.size})`);
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    const provider = getEmbeddingProvider();
    const queryEmbedding = await provider.embed(query);

    // Search Milvus if using
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      try {
        const results = await milvusClient.search(queryEmbedding, topK);
        return results.map((r: any) => ({
          content: r.content,
          metadata: {
            source: r.source,
            type: r.type,
            title: r.title,
            category: r.category,
            createdAt: new Date().toISOString(),
          },
          distance: r.distance,
          score: 1 - (r.distance || 0),
        }));
      } catch (err) {
        console.error('Milvus search failed:', err);
      }
    }

    // Search Pinecone if using
    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      try {
        const results = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
        });
        return (results.matches || []).map((match: any) => ({
          content: match.metadata?.content || '',
          metadata: {
            source: match.metadata?.source || '',
            type: match.metadata?.type || 'text',
            title: match.metadata?.title || '',
            category: match.metadata?.category || '',
            createdAt: new Date().toISOString(),
          },
          distance: match.distance,
          score: 1 - (match.distance || 0),
        }));
      } catch (err) {
        console.error('Pinecone search failed:', err);
      }
    }

    // Default: In-memory search
    return this.searchInMemory(queryEmbedding, topK);
  }

  private searchInMemory(queryEmbedding: number[], topK: number): SearchResult[] {
    const results: Array<{ doc: any; score: number }> = [];

    this.inMemoryStore.forEach(doc => {
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

    // Re-embed all documents
    for (const [id, doc] of this.inMemoryStore) {
      try {
        const embedding = await provider.embed(doc.content);
        this.inMemoryStore.set(id, { ...doc, embedding });
      } catch (err: any) {
        console.error(`Failed to re-embed ${id}:`, err.message);
      }
    }

    // Sync to Milvus if using
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      console.log('   Syncing to Milvus...');
      await milvusClient.flush();
    }

    this.saveMetadataToDisk();
    console.log(`✅ Re-indexed ${this.inMemoryStore.size} documents`);
    return { count: this.inMemoryStore.size, provider: this.activeDbProvider };
  }

  async deleteDocument(id: string): Promise<void> {
    this.inMemoryStore.delete(id);
    
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      await milvusClient.deleteById([id]);
    }
    
    if (this.activeDbProvider === 'pinecone' && this.pineconeIndex) {
      await this.pineconeIndex.deleteOne(id);
    }
    
    this.saveMetadataToDisk();
  }

  async getStats(): Promise<any> {
    const provider = getEmbeddingProvider();
    
    let totalDocuments = this.inMemoryStore.size;
    let extraStats = {};

    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      try {
        const stats = await milvusClient.getCollectionStats();
        totalDocuments = stats.rowCount;
        extraStats = { milvusStats: stats };
      } catch {}
    }

    return {
      totalDocuments,
      collectionName: this.activeDbProvider === 'milvus' ? milvusConfig.collectionName : pineconeConfig.indexName,
      isInitialized: this.isInitialized,
      provider: this.activeDbProvider,
      dimension: provider.dimension,
      storage: this.activeDbProvider,
      ...extraStats,
    };
  }

  async clear(): Promise<void> {
    this.inMemoryStore.clear();
    
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      await milvusClient.dropCollection();
      await milvusClient.createCollection();
      await milvusClient.loadCollection();
    }
    
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
    if (this.activeDbProvider === 'milvus' && milvusClient.isReady()) {
      await milvusClient.disconnect();
    }
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
