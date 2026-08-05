// RAG Service - Retrieval Augmented Generation pipeline

import { embeddingService } from './embedding.service.js';
import { vectorStore } from './vector-store.js';
import { chunkingService } from './chunking.service.js';
import { rerankService, type RerankableItem } from './rerank.service.js';
import { Product, MadaCategory } from '../models/product.model.js';
import { SEED_PRODUCTS } from '../data/seed-products.js';

export interface RAGRequest {
  query: string;
  language?: string;
  categories?: MadaCategory[];
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    platform?: string;
  };
  maxResults?: number;
  useRerank?: boolean;
}

export interface RAGResult {
  type: 'product' | 'standard';
  item: Product;
  score: number;
  rerankScore?: number;
  relevanceReason: string;
  confidence: number;
}

export interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;
  totalTokens: number;
  usedRerank: boolean;
}

export class RAGService {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing RAG service...');
    await vectorStore.initialize();
    await this.indexProducts(SEED_PRODUCTS);
    this.initialized = true;
    console.log(`RAG service initialized with ${SEED_PRODUCTS.length} seed products`);
  }

  private async indexProducts(products: Product[]): Promise<void> {
    for (const product of products) {
      const chunks = chunkingService.chunkProduct(
        product.id,
        {
          name: product.name.vi,
          description: product.description.vi,
          specifications: product.specifications,
          useCases: product.useCases,
          keywords: product.keywords,
        },
        'vi'
      );

      try {
        const embeddings = await embeddingService.embedBatch(chunks.map(c => c.content));
        for (let i = 0; i < chunks.length; i++) {
          chunks[i].embedding = embeddings[i];
        }
      } catch {
        console.warn('Embedding generation failed, skipping embeddings');
      }

      await vectorStore.insert(chunks);
    }
    console.log('Products indexed:', products.length);
  }

  async search(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    const { query, categories, maxResults = 5, useRerank = true } = request;

    // Step 1: Filter candidates from seed products
    let candidates = SEED_PRODUCTS;
    if (categories && categories.length > 0) {
      candidates = candidates.filter((p) => categories.includes(p.category));
    }

    // Step 2: Compute initial scores via keyword overlap
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    const scored: RerankableItem[] = candidates.map((product) => {
      const searchText = [
        product.name.vi,
        product.description.vi,
        product.subcategory,
        ...product.keywords,
        ...product.useCases,
        ...product.targetSymptoms,
      ]
        .join(' ')
        .toLowerCase();

      const matchedKeywords = product.keywords.filter((k) =>
        queryLower.includes(k.toLowerCase())
      );
      const matchedUseCases = product.useCases.filter((uc) =>
        uc.toLowerCase().split(/\s+/).some((w) => queryWords.includes(w))
      );

      let baseScore = 0.3;
      baseScore += matchedKeywords.length * 0.15;
      baseScore += matchedUseCases.length * 0.1;
      if (searchText.includes(queryLower)) baseScore += 0.2;

      return {
        id: product.id,
        content: `${product.name.vi} - ${product.description.vi}. Use cases: ${product.useCases.join(', ')}. Keywords: ${product.keywords.join(', ')}`,
        score: Math.min(baseScore, 1.0),
        metadata: { product },
      };
    });

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Step 3: Optionally rerank top candidates via Gemini
    let topCandidates = scored.slice(0, 20);
    let rerankApplied = false;

    if (useRerank && rerankService.isReady() && topCandidates.length > maxResults) {
      try {
        const reranked = await rerankService.rerank(query, topCandidates, {
          topN: maxResults,
          minScore: 0.3,
        });
        topCandidates = reranked.map((r) => ({
          ...r.item,
          score: r.rerankScore,
          metadata: {
            ...r.item.metadata,
            rerankReason: r.reason,
            originalScore: r.originalScore,
          },
        }));
        rerankApplied = true;
      } catch {
        // Fall back to original scores silently
      }
    } else {
      topCandidates = topCandidates.slice(0, maxResults);
    }

    const results: RAGResult[] = topCandidates.map((item) => {
      const product =
        (item.metadata?.product as Product) ??
        SEED_PRODUCTS.find((p) => p.id === item.id)!;
      const finalScore = item.score ?? 0.5;
      const reason =
        (item.metadata?.rerankReason as string | undefined) ??
        this.generateRelevanceReason(query, product);

      return {
        type: 'product' as const,
        item: product,
        score: finalScore,
        rerankScore: item.metadata?.originalScore as number | undefined,
        relevanceReason: reason,
        confidence: Math.min(0.99, finalScore + 0.1),
      };
    });

    return {
      results,
      query,
      detectedLanguage: this.detectLanguage(query),
      processingTime: Date.now() - startTime,
      totalTokens: Math.ceil(query.length / 4),
      usedRerank: rerankApplied,
    };
  }

  private generateRelevanceReason(query: string, product: Product): string {
    const queryLower = query.toLowerCase();
    const reasons: string[] = [];

    const matchingKeywords = product.keywords.filter((kw) =>
      queryLower.includes(kw.toLowerCase())
    );
    if (matchingKeywords.length > 0) {
      reasons.push(`Khớp từ khóa: ${matchingKeywords.slice(0, 2).join(', ')}`);
    }

    const matchingUseCases = product.useCases.filter((uc) =>
      uc.toLowerCase().split(' ').some((word) => queryLower.includes(word))
    );
    if (matchingUseCases.length > 0) {
      reasons.push(`Phù hợp với: ${matchingUseCases[0]}`);
    }

    return reasons.length > 0 ? reasons.join('. ') : 'Phù hợp với nhu cầu của bạn';
  }

  private detectLanguage(text: string): string {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return 'vi';
    return 'en';
  }

  async getProductById(productId: string): Promise<Product | null> {
    return SEED_PRODUCTS.find((p) => p.id === productId) || null;
  }

  async getProductsByCategory(category: MadaCategory): Promise<Product[]> {
    return SEED_PRODUCTS.filter((p) => p.category === category);
  }

  async getAllProducts(): Promise<Product[]> {
    return SEED_PRODUCTS;
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
    const byCategory: Record<string, number> = {};
    for (const p of SEED_PRODUCTS) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    }
    return { total: SEED_PRODUCTS.length, byCategory };
  }
}

export const ragService = new RAGService();
