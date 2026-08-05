// Vector Store - In-memory vector database (can be replaced with Pinecone/Supabase)

import { Chunk } from './chunking.service.js';
import { Product } from '../models/product.model.js';
import { Standard } from '../models/standard.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VectorStore');

export interface SearchOptions {
  topK: number;
  minScore: number;
  filters?: {
    category?: string[];
    language?: string[];
  };
}

export interface SearchResult<T> {
  id: string;
  item: T;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface IndexedItem {
  id: string;
  type: 'product' | 'standard';
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private items: Map<string, IndexedItem> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  async initialize(): Promise<void> {
    logger.info('Vector store initialized (in-memory)');
  }

  async insert(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        this.embeddings.set(chunk.id, chunk.embedding);
        this.items.set(chunk.id, {
          id: chunk.id,
          type: 'product',
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        });
      } else {
        // Store without embedding (for keyword search fallback)
        this.items.set(chunk.id, {
          id: chunk.id,
          type: 'product',
          content: chunk.content,
          embedding: [],
          metadata: chunk.metadata,
        });
      }
    }
    logger.debug('Chunks inserted', { count: chunks.length });
  }

  async upsert(items: IndexedItem[]): Promise<void> {
    for (const item of items) {
      this.items.set(item.id, item);
      if (item.embedding && item.embedding.length > 0) {
        this.embeddings.set(item.id, item.embedding);
      }
    }
    logger.debug('Items upserted', { count: items.length });
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.items.delete(id);
      this.embeddings.delete(id);
    }
    logger.debug('Items deleted', { count: ids.length });
  }

  async search(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult<unknown>[]> {
    const results: SearchResult<unknown>[] = [];

    for (const [id, item] of this.items.entries()) {
      const embedding = this.embeddings.get(id);
      
      // Skip items without embeddings
      if (!embedding || embedding.length === 0) continue;
      
      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryEmbedding, embedding);

      if (score >= options.minScore) {
        // Apply filters
        if (options.filters) {
          if (options.filters.category) {
            const itemCategory = item.metadata.category as string;
            if (!options.filters.category.includes(itemCategory)) {
              continue;
            }
          }
          if (options.filters.language) {
            const itemLanguage = item.metadata.language as string;
            if (!options.filters.language.includes(itemLanguage)) {
              continue;
            }
          }
        }

        results.push({
          id,
          item: item.metadata,
          score,
          content: item.content,
          metadata: item.metadata,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, options.topK);
  }

  async searchProducts(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult<Product>[]> {
    const allResults = await this.search(queryEmbedding, options);
    return allResults as SearchResult<Product>[];
  }

  async searchStandards(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult<Standard>[]> {
    const allResults = await this.search(queryEmbedding, options);
    return allResults as SearchResult<Standard>[];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async getStats(): Promise<{
    totalItems: number;
    totalEmbeddings: number;
    byType: Record<string, number>;
  }> {
    const byType: Record<string, number> = {};

    for (const item of this.items.values()) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return {
      totalItems: this.items.size,
      totalEmbeddings: this.embeddings.size,
      byType,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async clear(): Promise<void> {
    this.items.clear();
    this.embeddings.clear();
    logger.info('Vector store cleared');
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
