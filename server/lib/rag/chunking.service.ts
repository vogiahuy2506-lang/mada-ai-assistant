// Chunking Service - Document chunking for RAG (from backend/src/services/chunking.service)

import { createHash } from 'crypto';

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
  minChunkLength: number;
  maxChunkLength: number;
}

const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
  minChunkLength: 50,
  maxChunkLength: 2048,
};

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  embedding?: number[];
  metadata: {
    source: string;
    pageNumber?: number;
    section?: string;
    language: string;
  };
}

export class ChunkingService {
  private config: ChunkConfig;

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private generateId(content: string, index: number): string {
    const hash = createHash('sha256')
      .update(content.substring(0, 100) + index)
      .digest('hex')
      .substring(0, 16);
    return `chunk_${hash}`;
  }

  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter(s => s.trim().length > 0);
  }

  private getOverlapText(text: string): string {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length <= 1) return '';
    const overlapSentences = sentences.slice(-Math.ceil(this.config.chunkOverlap / 50));
    return overlapSentences.join('. ') + '. ';
  }

  chunkDocument(
    documentId: string,
    content: string,
    metadata: Chunk['metadata']
  ): Chunk[] {
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    const sentences = this.splitIntoSentences(cleanContent);

    const chunks: Chunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const testChunk = currentChunk ? `${currentChunk}. ${sentence}` : sentence;

      if (this.estimateTokens(testChunk) <= this.config.chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk.trim().length >= this.config.minChunkLength) {
          chunks.push({
            id: this.generateId(currentChunk, chunkIndex),
            documentId,
            content: currentChunk.trim(),
            contentHash: this.generateHash(currentChunk),
            tokenCount: this.estimateTokens(currentChunk),
            metadata,
          });
          chunkIndex++;
        }
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + sentence;
      }
    }

    if (currentChunk.trim().length >= this.config.minChunkLength) {
      chunks.push({
        id: this.generateId(currentChunk, chunkIndex),
        documentId,
        content: currentChunk.trim(),
        contentHash: this.generateHash(currentChunk),
        tokenCount: this.estimateTokens(currentChunk),
        metadata,
      });
    }

    return chunks;
  }

  chunkProduct(
    productId: string,
    productData: {
      name: string;
      description: string;
      specifications: Record<string, string>;
      useCases: string[];
      keywords: string[];
    },
    language: string = 'vi'
  ): Chunk[] {
    const chunks: Chunk[] = [];

    const introContent = `${productData.name}\n\n${productData.description}`;
    chunks.push(...this.chunkDocument(
      productId,
      introContent,
      { source: 'product_intro', section: 'introduction', language }
    ));

    const specLines = Object.entries(productData.specifications)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    if (specLines) {
      chunks.push(...this.chunkDocument(
        productId,
        `Thông số kỹ thuật:\n${specLines}`,
        { source: 'product_specs', section: 'specifications', language }
      ));
    }

    if (productData.useCases.length > 0) {
      const useCasesContent = `Tình huống sử dụng:\n${productData.useCases.map((uc, i) => `${i + 1}. ${uc}`).join('\n')}`;
      chunks.push(...this.chunkDocument(
        productId,
        useCasesContent,
        { source: 'product_usecases', section: 'use_cases', language }
      ));
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
