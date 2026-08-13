// ChromaDB Integration - Vector Database for RAG

export interface ChromaConfig {
  url?: string;
  collectionName?: string;
  distanceFunction?: 'cosine' | 'euclidean' | 'ip';
}

export interface ChromaDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: Required<ChromaConfig> = {
  url: 'http://localhost:8000',
  collectionName: 'mada_knowledge_base',
  distanceFunction: 'cosine',
};

class ChromaDBClient {
  private config: Required<ChromaConfig>;
  private initialized = false;

  constructor(config: ChromaConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if ChromaDB is available
      const response = await fetch(`${this.config.url}/v1/heartbeat`);
      if (response.ok) {
        console.log('✅ ChromaDB connected successfully');
        this.initialized = true;
      } else {
        console.warn('⚠️ ChromaDB not available');
      }
    } catch {
      console.warn('⚠️ ChromaDB not available');
    }
  }

  async createCollection(): Promise<void> {
    try {
      await fetch(`${this.config.url}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.config.collectionName,
          get_or_create: true,
        }),
      });
    } catch (error) {
      console.error('Failed to create ChromaDB collection:', error);
    }
  }

  async addDocuments(documents: ChromaDocument[]): Promise<void> {
    if (!this.initialized) {
      console.warn('ChromaDB not initialized');
      return;
    }

    try {
      const ids = documents.map(d => d.id);
      const embeddings = documents.map(d => d.embedding);
      const metadatas = documents.map(d => d.metadata || {});
      const documents_text = documents.map(d => d.content);

      await fetch(`${this.config.url}/api/v1/collections/${this.config.collectionName}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          embeddings,
          metadatas,
          documents: documents_text,
        }),
      });
    } catch (error) {
      console.error('Failed to add documents to ChromaDB:', error);
    }
  }

  async search(queryEmbedding: number[], topK: number = 5): Promise<ChromaDocument[]> {
    if (!this.initialized) {
      console.warn('ChromaDB not initialized');
      return [];
    }

    try {
      const response = await fetch(
        `${this.config.url}/api/v1/collections/${this.config.collectionName}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query_embeddings: [queryEmbedding],
            n_results: topK,
            include: ['documents', 'metadatas', 'distances'],
          }),
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const results: ChromaDocument[] = [];

      if (data.ids && data.ids[0]) {
        for (let i = 0; i < data.ids[0].length; i++) {
          results.push({
            id: data.ids[0][i],
            content: data.documents[0][i] || '',
            embedding: queryEmbedding, // ChromaDB doesn't return embeddings in query
            metadata: data.metadatas?.[0]?.[i] || { distance: data.distances?.[0]?.[i] },
          });
        }
      }

      return results;
    } catch (error) {
      console.error('ChromaDB search failed:', error);
      return [];
    }
  }

  async deleteCollection(): Promise<void> {
    try {
      await fetch(`${this.config.url}/api/v1/collections/${this.config.collectionName}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete ChromaDB collection:', error);
    }
  }

  async getCollectionSize(): Promise<number> {
    if (!this.initialized) return 0;

    try {
      const response = await fetch(
        `${this.config.url}/api/v1/collections/${this.config.collectionName}/count`,
        { method: 'GET' }
      );
      if (response.ok) {
        const data = await response.json();
        return data.count || 0;
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const chromaDB = new ChromaDBClient({
  url: process.env.CHROMADB_URL || 'http://localhost:8000',
  collectionName: process.env.CHROMADB_COLLECTION || 'mada_knowledge_base',
});
