// Vector Store Factory
// Provides unified interface for vector storage (in-memory or Pinecone)

import { vectorStore as inMemoryVectorStore } from '../services/vector-store.js';
import { pineconeVectorDB, type VectorMetadata } from './pinecone.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VectorStoreFactory');

export type VectorStoreType = 'memory' | 'pinecone';

export interface SearchOptions {
  topK: number;
  minScore: number;
  filters?: {
    category?: string[];
    language?: string[];
  };
}

export interface IndexedItem {
  id: string;
  type: 'product' | 'standard';
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/**
 * VectorStoreFactory - Unified interface for vector storage
 * 
 * Supports:
 * - In-memory store (development)
 * - Pinecone (production)
 * 
 * Automatically falls back to in-memory if Pinecone is unavailable
 */
class VectorStoreFactory {
  private storeType: VectorStoreType = 'memory';
  private initialized: boolean = false;

  /**
   * Initialize the vector store
   * Automatically detects whether to use Pinecone or in-memory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if Pinecone is configured
    const pineconeHealth = await pineconeVectorDB.healthCheck();

    if (pineconeHealth.pineconeConnected && pineconeHealth.status === 'healthy') {
      this.storeType = 'pinecone';
      
      // Ensure Pinecone index exists
      const indexReady = await pineconeVectorDB.ensureIndex();
      
      if (indexReady) {
        logger.info('Vector store initialized with Pinecone', {
          indexName: pineconeHealth.indexName,
          totalVectors: pineconeHealth.stats?.totalVectors,
        });
        this.initialized = true;
        return;
      }
    }

    // Fallback to in-memory
    this.storeType = 'memory';
    await inMemoryVectorStore.initialize();
    logger.info('Vector store initialized with in-memory store');
    this.initialized = true;
  }

  /**
   * Get the current store type
   */
  getStoreType(): VectorStoreType {
    return this.storeType;
  }

  /**
   * Check if using Pinecone
   */
  isUsingPinecone(): boolean {
    return this.storeType === 'pinecone';
  }

  /**
   * Insert items into the vector store
   */
  async insert(items: IndexedItem[]): Promise<void> {
    if (this.storeType === 'pinecone') {
      await pineconeVectorDB.upsert(
        items.map((item) => ({
          id: item.id,
          values: item.embedding,
          metadata: {
            ...item.metadata,
            content: item.content,
            type: item.type,
          } as unknown as VectorMetadata,
        }))
      );
    } else {
      await inMemoryVectorStore.upsert(items);
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<{ id: string; score: number; metadata: Record<string, unknown> }[]> {
    if (this.storeType === 'pinecone') {
      const filter: Record<string, string | string[]> = {};
      
      if (options.filters?.category) {
        filter.category = options.filters.category;
      }
      
      const results = await pineconeVectorDB.query(queryEmbedding, {
        topK: options.topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        includeMetadata: true,
      });

      return results
        .filter((r) => r.score >= options.minScore)
        .map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata as unknown as Record<string, unknown>,
        }));
    } else {
      return inMemoryVectorStore.search(queryEmbedding, options) as Promise<
        { id: string; score: number; metadata: Record<string, unknown> }[]
      >;
    }
  }

  /**
   * Search products specifically
   */
  async searchProducts(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<{ id: string; score: number; metadata: Record<string, unknown> }[]> {
    return this.search(queryEmbedding, options);
  }

  /**
   * Delete items by IDs
   */
  async delete(ids: string[]): Promise<void> {
    if (this.storeType === 'pinecone') {
      await pineconeVectorDB.delete(ids);
    } else {
      await inMemoryVectorStore.delete(ids);
    }
  }

  /**
   * Delete all items
   */
  async deleteAll(): Promise<void> {
    if (this.storeType === 'pinecone') {
      await pineconeVectorDB.deleteAll();
    } else {
      await inMemoryVectorStore.clear();
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    storeType: VectorStoreType;
    totalItems: number;
    totalEmbeddings: number;
    pineconeStats?: { totalVectors: number; indexFullness: number };
  }> {
    if (this.storeType === 'pinecone') {
      const pineconeStats = await pineconeVectorDB.getStats();
      return {
        storeType: this.storeType,
        totalItems: pineconeStats?.totalVectors || 0,
        totalEmbeddings: pineconeStats?.totalVectors || 0,
        pineconeStats: pineconeStats
          ? {
              totalVectors: pineconeStats.totalVectors,
              indexFullness: pineconeStats.indexFullness,
            }
          : undefined,
      };
    } else {
      const memoryStats = await inMemoryVectorStore.getStats();
      return {
        storeType: this.storeType,
        totalItems: memoryStats.totalItems,
        totalEmbeddings: memoryStats.totalEmbeddings,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    storeType: VectorStoreType;
    pineconeConnected?: boolean;
    memoryUsed?: boolean;
  }> {
    if (this.storeType === 'pinecone') {
      const pineconeHealth = await pineconeVectorDB.healthCheck();
      return {
        status: pineconeHealth.status,
        storeType: this.storeType,
        pineconeConnected: pineconeHealth.pineconeConnected,
      };
    } else {
      return {
        status: 'healthy',
        storeType: this.storeType,
        memoryUsed: true,
      };
    }
  }
}

// Singleton instance
export const vectorStoreFactory = new VectorStoreFactory();
