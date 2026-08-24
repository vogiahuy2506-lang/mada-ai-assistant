// RAG Service - Product search với DATABASE + SEED DATA fallback
// Đọc từ kb_products (status=published) để AI luôn có data mới nhất

import { SEED_PRODUCTS, type Product, type MadaCategory } from '../data/seed-products';
import db from '../../lib/db';

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
  source: 'database' | 'seed';
}

export interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;
  totalInDatabase: number;
}

/** Map database category → MadaCategory */
function mapCategory(cat: string): MadaCategory {
  const mapping: Record<string, MadaCategory> = {
    vision: 'vision',
    hearing: 'hearing',
    communication: 'communication',
    mobility: 'mobility',
    cognition: 'cognition',
    daily_living: 'daily_living',
    daily: 'daily_living',
    web_accessibility: 'web_accessibility',
    general: 'general',
  };
  return mapping[cat] || 'general';
}

class RAGService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log(`📦 RAG Service initialized`);
    this.initialized = true;
  }

  /**
   * ⭐ GET ALL PUBLISHED PRODUCTS FROM DATABASE
   */
  private getDatabaseProducts(): Product[] {
    try {
      const rows = db.prepare(`
        SELECT id, title, title_en, description, description_en, content,
               category, brand, model, price_range, source_url, product_url,
               image_url, iso_codes, wcag_level, who_gate_area, language
        FROM kb_products
        WHERE status = 'published'
      `).all() as any[];

      return rows.map(row => ({
        id: row.id,
        name: { vi: row.title || '', en: row.title_en || row.title || '' },
        description: {
          vi: row.description || row.content?.slice(0, 500) || '',
          en: row.description_en || '',
        },
        category: mapCategory(row.category) as MadaCategory,
        subcategory: row.category || 'general',
        brand: row.brand || '',
        model: row.model || '',
        priceRange: row.price_range || '',
        imageUrl: row.image_url || '',
        sourceUrl: row.source_url || row.product_url || '',
        isoCodes: Array.isArray(row.iso_codes) ? row.iso_codes : [],
        wcagLevel: row.wcag_level || '',
        whoGateArea: row.who_gate_area || '',
        keywords: [],
        useCases: [],
        targetSymptoms: [],
        language: row.language || 'vi',
      }));
    } catch (err) {
      console.error('[RAG] Error fetching database products:', err);
      return [];
    }
  }

  /**
   * ⭐ MAIN SEARCH FUNCTION
   * Đọc từ DATABASE trước, fallback sang SEED DATA
   */
  async search(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now();
    const { query, categories, maxResults = 5 } = request;

    // ⭐ ĐỌC TỪ DATABASE (published products)
    let candidates = this.getDatabaseProducts();
    let sourceLabel: 'database' | 'seed' = 'database';

    // Nếu database trống → fallback sang SEED DATA
    if (candidates.length === 0) {
      candidates = SEED_PRODUCTS;
      sourceLabel = 'seed';
      console.log('[RAG] Database empty, using seed data as fallback');
    }

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
        product.brand,
        product.model,
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

      let baseScore = 0.2;

      // Exact title match
      if (product.name.vi.toLowerCase().includes(queryLower) ||
          product.name.en.toLowerCase().includes(queryLower)) {
        baseScore += 0.5;
      }

      // Keyword match
      if (matchedKeywords.length > 0) {
        baseScore += Math.min(matchedKeywords.length * 0.25, 0.5);
      }

      // Use case match
      if (matchedUseCases.length > 0) {
        baseScore += Math.min(matchedUseCases.length * 0.15, 0.3);
      }

      // Brand match
      if (product.brand && product.brand.toLowerCase().includes(queryLower)) {
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
      if (product.brand) {
        reasons.push(`Thương hiệu: ${product.brand}`);
      }
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
        source: sourceLabel,
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

      const catLabel = this.getCategoryLabel(product.category);
      lines.push(`**Danh mục MADA:** ${catLabel}`);
      lines.push(`**Danh mục con:** ${product.subcategory || product.category}`);

      if (product.brand) {
        lines.push(`**Thương hiệu/Hãng:** ${product.brand}`);
      }

      if (product.priceRange) {
        lines.push(`**Giá tham khảo:** ${product.priceRange}`);
      }

      lines.push(`\n**Mô tả:** ${product.description[lang] || product.description.vi}`);

      if (product.features && product.features.length > 0) {
        lines.push(`\n**Tính năng:**`);
        product.features.forEach(f => lines.push(`- ${f}`));
      }

      if (product.useCases && product.useCases.length > 0) {
        lines.push(`\n**Trường hợp sử dụng:**`);
        product.useCases.forEach(uc => lines.push(`- ${uc}`));
      }

      if (product.targetSymptoms && product.targetSymptoms.length > 0) {
        lines.push(`\n**Đối tượng phù hợp:**`);
        product.targetSymptoms.forEach(s => lines.push(`- ${s}`));
      }

      if (product.isoCodes && product.isoCodes.length > 0) {
        lines.push(`\n**Tiêu chuẩn ISO:** ${product.isoCodes.join(', ')}`);
      }

      if (product.wcagLevel) {
        lines.push(`**WCAG Level:** ${product.wcagLevel}`);
      }

      if (product.imageUrl) {
        lines.push(`\n**Hình ảnh:** ${product.imageUrl}`);
      }

      if (product.sourceUrl) {
        lines.push(`**Link sản phẩm:** ${product.sourceUrl}`);
      }

      lines.push('---\n');
    });

    return lines.join('\n');
  }

  /** Map category → label */
  private getCategoryLabel(cat: MadaCategory): string {
    const labels: Record<MadaCategory, string> = {
      vision: '👁️ Thị giác',
      hearing: '🔊 Thính giác',
      communication: '💬 Giao tiếp',
      mobility: '🦽 Vận động',
      cognition: '🧠 Nhận thức',
      daily_living: '🏠 Sinh hoạt',
      web_accessibility: '🌐 Web A11y',
      general: '📋 Tổng quát',
    };
    return labels[cat] || cat;
  }

  private detectLanguage(text: string): string {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return 'vi';
    return 'en';
  }

  async getProductById(productId: string): Promise<Product | null> {
    const products = this.getDatabaseProducts();
    return products.find(p => p.id === productId) || null;
  }

  async getProductsByCategory(category: MadaCategory): Promise<Product[]> {
    const products = this.getDatabaseProducts();
    return products.filter(p => p.category === category);
  }

  async getAllProducts(): Promise<Product[]> {
    return this.getDatabaseProducts();
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
    const products = this.getDatabaseProducts();
    const byCategory: Record<string, number> = {};
    for (const p of products) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    }
    return { total: products.length, byCategory };
  }
}

export const ragService = new RAGService();
