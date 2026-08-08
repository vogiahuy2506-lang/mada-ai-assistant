// Pinecone Vector Database Configuration
// Production-ready vector store for MADA AT products

import { Pinecone } from '@pinecone-database/pinecone';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PineconeVectorDB');

// Pinecone configuration
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'mada-products';
const PINECONE_DIMENSION = parseInt(process.env.PINECONE_DIMENSION || '768', 10);
const PINECONE_METRIC = process.env.PINECONE_METRIC || 'cosine';

export interface VectorMetadata {
  productId: string;
  category: string;
  name: string;
  description: string;
  keywords: string[];
  language: string;
  indexedAt: string;
}

export interface SearchResult<T> {
  id: string;
  score: number;
  metadata: T;
}

/**
 * PineconeVectorDB - Production vector database using Pinecone
 * 
 * Features:
 * - Cloud-based vector storage
 * - Scalable semantic search
 * - Metadata filtering
 * - Serverless indexes
 */
export class PineconeVectorDB {
  private client: Pinecone | null = null;
  private indexName: string;
  private initialized: boolean = false;

  constructor() {
    this.indexName = PINECONE_INDEX_NAME;
    this.initializeClient();
  }

  /**
   * Initialize Pinecone client
   */
  private initializeClient(): void {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey) {
      logger.warn('Pinecone API key not provided. Using fallback in-memory vector store.');
      this.initialized = false;
      return;
    }

    try {
      this.client = new Pinecone({
        apiKey,
      });
      logger.info('Pinecone client initialized', { indexName: this.indexName });
    } catch (error) {
      logger.error('Failed to initialize Pinecone client', { error });
      this.initialized = false;
    }
  }

  /**
   * Check if Pinecone is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Create index if it doesn't exist
   */
  async ensureIndex(): Promise<boolean> {
    if (!this.client) {
      logger.warn('Pinecone client not available');
      return false;
    }

    try {
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(
        (idx) => idx.name === this.indexName
      );

      if (!indexExists) {
        await this.client.createIndex({
          name: this.indexName,
          dimension: PINECONE_DIMENSION,
          metric: PINECONE_METRIC as 'cosine' | 'euclidean' | 'dotproduct',
          spec: {
            serverless: {
              cloud: (process.env.PINECONE_CLOUD as 'aws' | 'gcp' | 'azure') || 'aws',
              region: process.env.PINECONE_REGION || 'us-east-1',
            },
          },
        });

        // Wait for index to be ready
        await this.waitForIndex();

        logger.info('Pinecone index created', {
          indexName: this.indexName,
          dimension: PINECONE_DIMENSION,
          metric: PINECONE_METRIC,
        });
      }

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to create Pinecone index', { error });
      return false;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndex(maxWaitMs: number = 60000): Promise<void> {
    if (!this.client) return;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const description = await this.client.describeIndex(this.indexName);
        if (description.status?.ready) {
          return;
        }
      } catch {
        // Index might not exist yet
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timeout waiting for Pinecone index');
  }

  /**
   * Upsert vectors to Pinecone
   */
  async upsert(
    vectors: {
      id: string;
      values: number[];
      metadata?: VectorMetadata;
    }[]
  ): Promise<void> {
    if (!this.client || !this.initialized) {
      logger.warn('Pinecone not available, skipping upsert');
      return;
    }

    try {
      const index = this.client.index(this.indexName);

      // Batch upserts to avoid exceeding limits
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
        logger.debug('Batch upserted', { count: batch.length, startIndex: i });
      }

      logger.info('Vectors upserted to Pinecone', { count: vectors.length });
    } catch (error) {
      logger.error('Failed to upsert vectors to Pinecone', { error });
      throw error;
    }
  }

  /**
   * Query vectors from Pinecone
   */
  async query(
    queryVector: number[],
    options: {
      topK?: number;
      filter?: Record<string, string | string[]>;
      includeMetadata?: boolean;
    } = {}
  ): Promise<SearchResult<VectorMetadata>[]> {
    if (!this.client || !this.initialized) {
      logger.warn('Pinecone not available, returning empty results');
      return [];
    }

    try {
      const index = this.client.index(this.indexName);
      const topK = options.topK || 10;

      const queryResponse = await index.query({
        vector: queryVector,
        topK,
        filter: options.filter,
        includeMetadata: options.includeMetadata !== false,
      });

      return (queryResponse.matches || []).map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
      }));
    } catch (error) {
      logger.error('Failed to query Pinecone', { error });
      return [];
    }
  }

  /**
   * Delete vectors by IDs
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.client || !this.initialized) {
      return;
    }

    try {
      const index = this.client.index(this.indexName);
      await index.deleteMany(ids);
      logger.info('Vectors deleted from Pinecone', { count: ids.length });
    } catch (error) {
      logger.error('Failed to delete vectors from Pinecone', { error });
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexFullness: number;
  } | null> {
    if (!this.client || !this.initialized) {
      return null;
    }

    try {
      const index = this.client.index(this.indexName);
      const stats = await index.describeIndexStats();

      return {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || PINECONE_DIMENSION,
        indexFullness: stats.indexFullness || 0,
      };
    } catch (error) {
      logger.error('Failed to get Pinecone stats', { error });
      return null;
    }
  }

  /**
   * Delete all vectors (for reindexing)
   */
  async deleteAll(): Promise<void> {
    if (!this.client || !this.initialized) {
      return;
    }

    try {
      const index = this.client.index(this.indexName);
      await index.deleteAll();
      logger.info('All vectors deleted from Pinecone');
    } catch (error) {
      logger.error('Failed to delete all vectors', { error });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    pineconeConnected: boolean;
    indexName: string;
    stats: { totalVectors: number } | null;
  }> {
    if (!this.isAvailable()) {
      return {
        status: 'unhealthy',
        pineconeConnected: false,
        indexName: this.indexName,
        stats: null,
      };
    }

    try {
      const stats = await this.getStats();
      return {
        status: stats && stats.totalVectors > 0 ? 'healthy' : 'degraded',
        pineconeConnected: true,
        indexName: this.indexName,
        stats: stats ? { totalVectors: stats.totalVectors } : null,
      };
    } catch {
      return {
        status: 'degraded',
        pineconeConnected: true,
        indexName: this.indexName,
        stats: null,
      };
    }
  }
}

// Singleton instance
export const pineconeVectorDB = new PineconeVectorDB();
