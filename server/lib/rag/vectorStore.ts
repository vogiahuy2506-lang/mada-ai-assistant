import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const COLLECTION_NAME = 'mada_knowledge_base';

// ============== EMBEDDING PROVIDER ==============

interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
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
}

class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini-text-embedding-004';
  dimension = 768;
  private genAI: any = null;

  constructor(apiKey: string) {
    void apiKey; // suppress unused warning
    try {
      // Lazy import để tránh crash nếu chưa cài
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

    // Cắt text nếu quá dài (model giới hạn ~2048 tokens)
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
      // Fallback to mock nếu Gemini lỗi
      return createSimpleEmbedding(text);
    }
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
  };
}

interface SearchResult {
  content: string;
  metadata: Document['metadata'];
  distance?: number;
}

// Simple text embedding using TF-IDF-like approach
function createSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount: Record<string, number> = {};
  
  // Count word frequencies
  words.forEach(word => {
    if (word.length > 2) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  // Create a simple hash-based vector (for demo purposes)
  const dimension = 384; // Standard embedding dimension
  const vector = new Array(dimension).fill(0);
  
  // Use word hashes to populate vector
  Object.keys(wordCount).slice(0, 50).forEach((word, i) => {
    const hash = crypto.createHash('md5').update(word).digest();
    for (let j = 0; j < Math.min(16, dimension); j++) {
      const idx = (hash[j % hash.length] + i * 7 + j * 13) % dimension;
      vector[idx] += (wordCount[word] / words.length) * (hash[j] / 255);
    }
  });
  
  // Normalize
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

class VectorStore {
  private documents: Map<string, Document & { embedding: number[] }> = new Map();
  private isInitialized = false;
  private dataDir: string = '';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize data directory
      this.dataDir = path.join(process.cwd(), 'data', 'chroma');
      fs.mkdirSync(this.dataDir, { recursive: true });

      // Load existing documents from disk
      const docsPath = path.join(this.dataDir, 'documents.json');
      if (fs.existsSync(docsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
          data.forEach((doc: any) => {
            this.documents.set(doc.id, {
              ...doc,
              embedding: createSimpleEmbedding(doc.content),
            });
          });
          console.log(`📚 Loaded ${this.documents.size} existing documents`);
        } catch (e) {
          console.log('📚 Starting with empty knowledge base');
        }
      }

      this.isInitialized = true;
      console.log('✅ Vector store initialized');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      this.isInitialized = true; // Continue anyway with in-memory store
    }
  }

  private saveToDisk(): void {
    if (!this.dataDir) return;
    
    const docsPath = path.join(this.dataDir, 'documents.json');
    const docs = Array.from(this.documents.values()).map(({ embedding, ...doc }) => doc);
    fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2));
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const provider = getEmbeddingProvider();
    // Embed async
    for (const doc of documents) {
      const embedding = await provider.embed(doc.content);
      this.documents.set(doc.id, { ...doc, embedding });
    }
    this.saveToDisk();
    console.log(`✅ Added ${documents.length} documents via ${provider.name} (total: ${this.documents.size})`);
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    const provider = getEmbeddingProvider();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const queryEmbedding = await provider.embed(query);

    // Normalize query embedding nếu dimension khác nhau (Gemini = 768, mock = 384)
    const targetDim = this.documents.values().next().value?.embedding?.length || provider.dimension;
    const normalizedQuery = this.normalizeDimension(queryEmbedding, targetDim);

    const results: Array<{ doc: Document & { embedding: number[] }; score: number; similarity: number; keywordMatch: number }> = [];

    this.documents.forEach(doc => {
      const docEmb = this.normalizeDimension(doc.embedding, targetDim);
      const similarity = cosineSimilarity(normalizedQuery, docEmb);
      const docContent = doc.content.toLowerCase();
      const docTitle = (doc.metadata.title || '').toLowerCase();

      let keywordMatch = 0;
      queryWords.forEach(word => {
        if (docContent.includes(word)) keywordMatch += 1;
        if (docTitle.includes(word)) keywordMatch += 3;
      });
      keywordMatch = keywordMatch / (queryWords.length * 4 || 1);

      const score = keywordMatch * 0.5 + similarity * 0.5;
      results.push({ doc, score, similarity, keywordMatch });
    });

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map(({ doc, similarity }) => ({
      content: doc.content,
      metadata: doc.metadata,
      distance: 1 - similarity,
      score: similarity,
    }));
  }

  /**
   * Pad/trim vector về cùng dimension (fix mismatch giữa mock & Gemini)
   */
  private normalizeDimension(vec: number[], targetDim: number): number[] {
    if (vec.length === targetDim) return vec;
    if (vec.length > targetDim) return vec.slice(0, targetDim);
    return [...vec, ...new Array(targetDim - vec.length).fill(0)];
  }

  /**
   * Re-embed toàn bộ knowledge base (khi đổi provider hoặc model)
   */
  async reindexAll(): Promise<{ count: number; provider: string }> {
    // Force reset provider để pick up env mới
    activeProvider = null;
    const provider = getEmbeddingProvider();
    console.log(`🔄 Re-indexing ${this.documents.size} documents with ${provider.name}...`);

    let count = 0;
    for (const [id, doc] of this.documents) {
      try {
        const embedding = await provider.embed(doc.content);
        this.documents.set(id, { ...doc, embedding });
        count++;
      } catch (err: any) {
        console.error(`Failed to re-embed ${id}:`, err.message);
      }
    }
    this.saveToDisk();
    console.log(`✅ Re-indexed ${count} documents`);
    return { count, provider: provider.name };
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
    this.saveToDisk();
  }

  async getStats(): Promise<{
    totalDocuments: number;
    collectionName: string;
    isInitialized: boolean;
    provider: string;
    dimension: number;
  }> {
    const provider = getEmbeddingProvider();
    return {
      totalDocuments: this.documents.size,
      collectionName: COLLECTION_NAME,
      isInitialized: this.isInitialized,
      provider: provider.name,
      dimension: provider.dimension,
    };
  }

  async clear(): Promise<void> {
    this.documents.clear();
    
    // Clear disk
    const docsPath = path.join(this.dataDir, 'documents.json');
    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
    }
    
    console.log('🗑️ Vector store cleared');
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

// Helper functions
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
