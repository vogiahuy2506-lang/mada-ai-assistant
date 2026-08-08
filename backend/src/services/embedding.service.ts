// Embedding Service - Gemini Embeddings Integration
// Replaces fake simulation with actual Gemini embeddings API

import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiConfig } from '../config/app.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('EmbeddingService');

// Gemini embedding model configuration
const EMBEDDING_MODEL = 'gemini-embedding-exp-03-07';
const DEFAULT_DIMENSIONS = 768;

export class EmbeddingService {
  private client: GoogleGenerativeAI | null = null;
  private dimensions: number;
  private useRealEmbeddings: boolean = false;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

  constructor(dimensions: number = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions;
    this.initializeClient();
  }

  private initializeClient(): void {
    if (geminiConfig.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(geminiConfig.apiKey);
        this.model = this.client.getGenerativeModel({
          model: EMBEDDING_MODEL,
        });
        this.useRealEmbeddings = true;
        logger.info('Gemini Embedding client initialized', {
          model: EMBEDDING_MODEL,
          dimensions: this.dimensions,
        });
      } catch (error) {
        logger.warn('Failed to initialize Gemini Embedding client, falling back to simulation', { error });
        this.useRealEmbeddings = false;
      }
    } else {
      logger.warn('No Gemini API key provided, using simulated embeddings');
      this.useRealEmbeddings = false;
    }
  }

  /**
   * Generate embedding for a single text using Gemini Embeddings API
   * Falls back to simulation if API is unavailable
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.useRealEmbeddings || !this.model) {
      return this.simulateEmbedding(text);
    }

    try {
      // Use Gemini's embedContent method
      const result = await this.model.embedContent({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      });

      let embedding = result.embedding?.values || [];

      // Resize to expected dimensions if needed
      if (embedding.length !== this.dimensions) {
        embedding = this.resizeEmbedding(embedding, this.dimensions);
      }

      return embedding;
    } catch (error) {
      logger.error('Gemini embedding failed, falling back to simulation', { error });
      return this.simulateEmbedding(text);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling embedText multiple times
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.useRealEmbeddings || !this.model) {
      return texts.map(text => this.simulateEmbedding(text));
    }

    try {
      // Process in parallel with concurrency limit
      const batchSize = 5;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(async (text) => {
          const result = await this.model!.embedContent({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
          });
          let embedding = result.embedding?.values || [];
          if (embedding.length !== this.dimensions) {
            embedding = this.resizeEmbedding(embedding, this.dimensions);
          }
          return embedding;
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      logger.debug('Batch embedding completed', { count: texts.length });
      return results;
    } catch (error) {
      logger.error('Batch embedding failed, falling back to simulation', { error });
      return texts.map(text => this.simulateEmbedding(text));
    }
  }

  /**
   * Generate embedding for query text
   * Uses RETRIEVAL_QUERY task type for better query matching
   */
  async embedQuery(query: string): Promise<number[]> {
    if (!this.useRealEmbeddings || !this.model) {
      return this.simulateEmbedding(query);
    }

    try {
      const result = await this.model.embedContent({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
      });

      let embedding = result.embedding?.values || [];

      if (embedding.length !== this.dimensions) {
        embedding = this.resizeEmbedding(embedding, this.dimensions);
      }

      return embedding;
    } catch (error) {
      logger.error('Query embedding failed, falling back to simulation', { error });
      return this.simulateEmbedding(query);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      logger.warn('Vector dimensions mismatch in cosine similarity', {
        aLength: a.length,
        bLength: b.length,
      });
      return 0;
    }

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

  /**
   * Check if real embeddings are being used
   */
  isUsingRealEmbeddings(): boolean {
    return this.useRealEmbeddings;
  }

  /**
   * Health check for embedding service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded'; usingRealEmbeddings: boolean }> {
    return {
      status: this.useRealEmbeddings ? 'healthy' : 'degraded',
      usingRealEmbeddings: this.useRealEmbeddings,
    };
  }

  // =========================================================================
  // SIMULATION FALLBACK (for development/testing without API key)
  // =========================================================================

  /**
   * Simulated embedding for development without API key
   * Creates deterministic vectors based on text content
   */
  private simulateEmbedding(text: string): number[] {
    const embedding = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word, idx) => {
      for (let i = 0; i < Math.min(word.length, 10); i++) {
        const hash = (word.charCodeAt(i) * (idx + 1) * 31) % this.dimensions;
        embedding[hash] += 0.1;
      }
    });

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * Resize embedding vector to target dimensions
   * Truncates or pads as needed
   */
  private resizeEmbedding(embedding: number[], targetDimensions: number): number[] {
    if (embedding.length === targetDimensions) {
      return embedding;
    }

    if (embedding.length > targetDimensions) {
      // Truncate
      return embedding.slice(0, targetDimensions);
    }

    // Pad with zeros
    const padded = [...embedding];
    while (padded.length < targetDimensions) {
      padded.push(0);
    }
    return padded;
  }
}

export const embeddingService = new EmbeddingService();
