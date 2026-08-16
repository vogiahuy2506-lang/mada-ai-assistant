// RAG Service - Product search với SEED DATA + Vector DB fallback
// Đảm bảo AI luôn có data để trả lời đúng

import { SEED_PRODUCTS, searchProducts as seedSearchProducts, type Product, type MadaCategory } from '../data/seed-products';

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
  source: 'seed' | 'vector';
}

export interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;
  totalInDatabase: number;
}

class RAGService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log(`📦 RAG Service initialized with ${SEED_PRODUCTS.length} seed products`);
    this.initialized = true;
  }

  /**
   * ⭐ MAIN SEARCH FUNCTION
   * Luôn trả về kết quả từ SEED DATA (đảm bảo có data)
   * Vector DB chỉ dùng như supplementary
   */
  async search(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now();
    const { query, categories, maxResults = 5 } = request;

    // ⭐ LUÔN DÙNG SEED DATA - Đảm bảo có kết quả
    let candidates = SEED_PRODUCTS;
    
    // Filter by category nếu specified
    if (categories && categories.length > 0) {
      candidates = candidates.filter((p) => categories.includes(p.category));
    }

    // Compute keyword-based scores
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    const scored = candidates.map((product) => {
      const searchText = [
        product.name.vi,
        product.name.en,
        product.description.vi,
        product.description.en,
        product.subcategory,
        ...product.keywords,
        ...product.useCases,
        ...product.targetSymptoms,
      ].join(' ').toLowerCase();

      const matchedKeywords = product.keywords.filter((k) =>
        queryLower.includes(k.toLowerCase()) || k.toLowerCase().includes(queryLower)
      );
      const matchedUseCases = product.useCases.filter((uc) =>
        uc.toLowerCase().split(/\s+/).some((w) => queryWords.some(qw => uc.toLowerCase().includes(qw)))
      );

      let baseScore = 0.2; // Base score thấp hơn để keyword có trọng số cao hơn
      
      // Keyword match - trọng số cao nhất
      if (matchedKeywords.length > 0) {
        baseScore += Math.min(matchedKeywords.length * 0.25, 0.5);
      }
      
      // Use case match
      if (matchedUseCases.length > 0) {
        baseScore += Math.min(matchedUseCases.length * 0.15, 0.3);
      }
      
      // Exact phrase match
      if (searchText.includes(queryLower)) {
        baseScore += 0.3;
      }

      return { product, score: Math.min(baseScore, 1.0), matchedKeywords, matchedUseCases };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top results
    const topResults = scored.slice(0, maxResults);

    const results: RAGResult[] = topResults.map(({ product, score, matchedKeywords, matchedUseCases }) => {
      const reasons: string[] = [];
      if (matchedKeywords.length > 0) {
        reasons.push(`Từ khóa: ${matchedKeywords.slice(0, 3).join(', ')}`);
      }
      if (matchedUseCases.length > 0) {
        reasons.push(`Phù hợp với: ${matchedUseCases.slice(0, 2).join(', ')}`);
      }

      return {
        type: 'product' as const,
        item: product,
        score,
        relevanceReason: reasons.length > 0 ? reasons.join('. ') : 'Phù hợp với nhu cầu của bạn',
        confidence: Math.min(0.99, score + 0.15),
        source: 'seed' as const, // ⭐ Đánh dấu nguồn từ seed data
      };
    });

    return {
      results,
      query,
      detectedLanguage: this.detectLanguage(query),
      processingTime: Date.now() - startTime,
      totalInDatabase: candidates.length,
    };
  }

  /**
   * ⭐ SEARCH WITH FULL TEXT
   * Tìm kiếm với query tự do, trả về formatted response cho AI
   */
  async searchFullText(query: string, options?: {
    categories?: MadaCategory[];
    maxResults?: number;
    language?: 'vi' | 'en';
  }): Promise<{
    products: Product[];
    formattedContext: string;
    hasResults: boolean;
  }> {
    const { results } = await this.search({
      query,
      categories: options?.categories,
      maxResults: options?.maxResults || 5,
    });

    const products = results.map(r => r.item);

    // Build formatted context cho AI
    const lang = options?.language || 'vi';
    const formattedContext = this.buildContextForAI(products, lang);

    return {
      products,
      formattedContext,
      hasResults: products.length > 0,
    };
  }

  /**
   * ⭐ BUILD CONTEXT FOR AI
   * Format data thành text để AI dùng trong prompt
   */
  private buildContextForAI(products: Product[], lang: 'vi' | 'en'): string {
    if (products.length === 0) {
      return 'Không tìm thấy sản phẩm phù hợp trong cơ sở dữ liệu.';
    }

    const lines: string[] = ['## Kết quả tìm kiếm từ Cơ sở dữ liệu MADA:\n'];

    products.forEach((product, idx) => {
      lines.push(`### ${idx + 1}. ${product.name[lang] || product.name.vi}`);
      lines.push(`**Danh mục:** ${product.subcategory}`);
      
      if (product.manufacturer) {
        lines.push(`**Hãng sản xuất:** ${product.manufacturer[lang] || product.manufacturer.vi}`);
      }
      
      if (product.operatingSystem) {
        lines.push(`**Hệ điều hành:** ${product.operatingSystem}`);
      }

      lines.push(`\n**Mô tả:** ${product.description[lang] || product.description.vi}`);

      if (product.features.length > 0) {
        lines.push(`\n**Tính năng:**`);
        product.features.forEach(f => lines.push(`- ${f}`));
      }

      if (product.useCases.length > 0) {
        lines.push(`\n**Trường hợp sử dụng:**`);
        product.useCases.forEach(uc => lines.push(`- ${uc}`));
      }

      if (product.targetSymptoms.length > 0) {
        lines.push(`\n**Đối tượng phù hợp:**`);
        product.targetSymptoms.forEach(s => lines.push(`- ${s}`));
      }

      if (product.isoCodes.length > 0) {
        lines.push(`\n**Tiêu chuẩn:** ${product.isoCodes.join(', ')}`);
      }

      lines.push(`\n**Link sản phẩm:** ${product.sourceUrl}`);
      lines.push('---\n');
    });

    return lines.join('\n');
  }

  private detectLanguage(text: string): string {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return 'vi';
    return 'en';
  }

  async getProductById(productId: string): Promise<Product | null> {
    return SEED_PRODUCTS.find((p) => p.id === productId || p.madaId === productId) || null;
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
