// RAG Service - Product search with keyword + vector similarity (improved from backend)

import { SEED_PRODUCTS, type Product, type MadaCategory } from '../data/seed-products';
import { chunkingService } from './chunking.service';

export interface RAGRequest {
  query: string;
  language?: string;
  categories?: MadaCategory[];
  maxResults?: number;
}

export interface RAGResult {
  type: 'product';
  item: Product;
  score: number;
  relevanceReason: string;
  confidence: number;
}

export interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;
}

class RAGService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log(`📦 RAG Service initialized with ${SEED_PRODUCTS.length} seed products`);
    this.initialized = true;
  }

  async search(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now();
    const { query, categories, maxResults = 5 } = request;

    // Filter by category if specified
    let candidates = SEED_PRODUCTS;
    if (categories && categories.length > 0) {
      candidates = candidates.filter((p) => categories.includes(p.category));
    }

    // Compute keyword-based scores
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    const scored = candidates.map((product) => {
      const searchText = [
        product.name.vi,
        product.description.vi,
        product.subcategory,
        ...product.keywords,
        ...product.useCases,
        ...product.targetSymptoms,
      ].join(' ').toLowerCase();

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

      return { product, score: Math.min(baseScore, 1.0), matchedKeywords, matchedUseCases };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top results
    const topResults = scored.slice(0, maxResults);

    const results: RAGResult[] = topResults.map(({ product, score, matchedKeywords, matchedUseCases }) => {
      const reasons: string[] = [];
      if (matchedKeywords.length > 0) {
        reasons.push(`Khớp từ khóa: ${matchedKeywords.slice(0, 2).join(', ')}`);
      }
      if (matchedUseCases.length > 0) {
        reasons.push(`Phù hợp với: ${matchedUseCases[0]}`);
      }

      return {
        type: 'product' as const,
        item: product,
        score,
        relevanceReason: reasons.length > 0 ? reasons.join('. ') : 'Phù hợp với nhu cầu của bạn',
        confidence: Math.min(0.99, score + 0.1),
      };
    });

    return {
      results,
      query,
      detectedLanguage: this.detectLanguage(query),
      processingTime: Date.now() - startTime,
    };
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
