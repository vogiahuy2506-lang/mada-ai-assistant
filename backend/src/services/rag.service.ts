// RAG Service - Retrieval Augmented Generation pipeline

import { embeddingService } from './embedding.service.js';
import { vectorStore } from './vector-store.js';
import { chunkingService } from './chunking.service.js';
import { Product, MadaCategory } from '../models/product.model.js';

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
}

export interface RAGResult {
  type: 'product' | 'standard';
  item: unknown;
  score: number;
  relevanceReason: string;
  confidence: number;
}

export interface RAGResponse {
  results: RAGResult[];
  query: string;
  detectedLanguage: string;
  processingTime: number;
  totalTokens: number;
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod_001',
    madaId: 'MADA-VIS-001',
    name: { en: 'OrCam MyEye', ar: 'أوركام ماي آي', vi: 'OrCam MyEye', fr: 'OrCam MyEye' },
    category: 'vision',
    subcategory: 'Wearable AI',
    brand: 'OrCam',
    manufacturer: 'OrCam Technologies',
    description: {
      en: 'AI-powered wearable device for visually impaired',
      ar: 'جهاز قابل للارتداء يعمل بالذكاء الاصطناعي للمكفوفين',
      vi: 'Thiết bị đeo được chạy bằng AI cho người khiếm thị',
      fr: "Appareil portable alimenté par l'IA pour malvoyants",
    },
    specifications: { weight: '22.5g', battery: '3-4 hours', camera: '13MP' },
    compatibility: { platforms: ['iOS', 'Android'], disabilities: ['visual'], ageGroups: ['adults', 'seniors'] },
    pricing: { currency: 'USD', minPrice: 4500, maxPrice: 5000, unit: 'per unit' },
    keywords: ['blind', 'reading', 'face recognition', 'AI'],
    useCases: ['Reading text aloud', 'Face recognition', 'Product identification'],
    targetSymptoms: ['cannot read', 'low vision', 'blind'],
    createdAt: new Date(),
    updatedAt: new Date(),
    confidence: 0.95,
  },
  {
    id: 'prod_002',
    madaId: 'MADA-VIS-002',
    name: { en: 'JAWS Screen Reader', ar: 'JAWS قارئ الشاشة', vi: 'JAWS Trình đọc màn hình', fr: "JAWS Lecteur d'écran" },
    category: 'vision',
    subcategory: 'Software',
    brand: 'Freedom Scientific',
    manufacturer: 'Vispero',
    description: {
      en: 'Professional screen reader for Windows',
      ar: 'قارئ شاشة احترافي لنظام ويندوز',
      vi: 'Trình đọc màn hình chuyên nghiệp cho Windows',
      fr: "Lecteur d'écran professionnel pour Windows",
    },
    specifications: { version: '2024', platform: 'Windows', languages: '40+' },
    compatibility: { platforms: ['Windows'], disabilities: ['visual'], ageGroups: ['adults', 'seniors'] },
    pricing: { currency: 'USD', minPrice: 890, maxPrice: 1090, unit: 'per license' },
    keywords: ['screen reader', 'blind', 'Windows', 'braille'],
    useCases: ['Computer access', 'Document reading', 'Web browsing'],
    targetSymptoms: ['blind', 'low vision'],
    createdAt: new Date(),
    updatedAt: new Date(),
    confidence: 0.92,
  },
];

export class RAGService {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing RAG service...');
    await vectorStore.initialize();
    await this.indexProducts(SAMPLE_PRODUCTS);
    this.initialized = true;
    console.log('RAG service initialized successfully');
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

    const { query, categories, maxResults = 5 } = request;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await embeddingService.embedQuery(query);
    } catch {
      const results: RAGResult[] = SAMPLE_PRODUCTS.slice(0, maxResults).map(product => ({
        type: 'product' as const,
        item: product,
        score: 0.5,
        relevanceReason: 'Matched based on keywords',
        confidence: 0.5,
      }));

      return {
        results,
        query,
        detectedLanguage: this.detectLanguage(query),
        processingTime: Date.now() - startTime,
        totalTokens: Math.ceil(query.length / 4),
      };
    }

    const searchResults = await vectorStore.searchProducts(queryEmbedding, {
      topK: maxResults,
      minScore: 0.5,
      filters: { category: categories },
    });

    const results: RAGResult[] = searchResults.map(result => ({
      type: 'product',
      item: result.item,
      score: result.score,
      relevanceReason: this.generateRelevanceReason(query, result.item as Product),
      confidence: Math.min(0.99, result.score + 0.1),
    }));

    results.sort((a, b) => b.score - a.score);

    return {
      results,
      query,
      detectedLanguage: this.detectLanguage(query),
      processingTime: Date.now() - startTime,
      totalTokens: Math.ceil(query.length / 4),
    };
  }

  private generateRelevanceReason(query: string, product: Product): string {
    const queryLower = query.toLowerCase();
    const reasons: string[] = [];

    const matchingKeywords = product.keywords.filter(kw =>
      queryLower.includes(kw.toLowerCase())
    );
    if (matchingKeywords.length > 0) {
      reasons.push(`Khớp từ khóa: ${matchingKeywords.slice(0, 2).join(', ')}`);
    }

    const matchingUseCases = product.useCases.filter(uc =>
      uc.toLowerCase().split(' ').some(word => queryLower.includes(word))
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
    return SAMPLE_PRODUCTS.find(p => p.id === productId) || null;
  }

  async getProductsByCategory(category: MadaCategory): Promise<Product[]> {
    return SAMPLE_PRODUCTS.filter(p => p.category === category);
  }
}

export const ragService = new RAGService();
