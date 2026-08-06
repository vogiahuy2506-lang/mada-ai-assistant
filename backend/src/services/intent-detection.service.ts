// Intent Detection Service - Analyze user intent from messages
import { createLogger } from '../utils/logger.js';

const logger = createLogger('IntentDetection');

export type IntentType = 
  | 'product_inquiry'      // Hỏi về sản phẩm cụ thể
  | 'comparison'           // Muốn so sánh
  | 'how_to'              // Cần hướng dẫn
  | 'recommendation'       // Cần tư vấn
  | 'troubleshooting'      // Gặp vấn đề
  | 'general'              // Câu hỏi chung
  | 'price_inquiry'        // Hỏi về giá
  | 'feature_request'      // Hỏi tính năng
  | 'compatibility'        // Hỏi về tương thích
  | 'setup_help';          // Cần hỗ trợ cài đặt

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  entities: {
    products?: string[];
    categories?: string[];
    brands?: string[];
    features?: string[];
  };
  suggestedCategories?: string[];
  language?: string;
}

interface IntentPattern {
  patterns: RegExp[];
  intent: IntentType;
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Comparison patterns
  {
    patterns: [
      /\b(so sánh|compare|difference|giống|khác|better|worse|tốt hơn|xấu hơn|vs|với|or|hoặc)\b/i,
      /\b(nên chọn|which one|which is|what's better|what's the best)\b/i,
    ],
    intent: 'comparison',
    weight: 1.0,
  },
  
  // How-to patterns
  {
    patterns: [
      /\b(cách|làm sao|như thế nào|how to|how do|hướng dẫn|guide|tutorial|steps|cài đặt|setup|install|configure)\b/i,
      /\b(sử dụng|use|using|start|begin|bắt đầu|tôi có thể|i can|i could)\b/i,
    ],
    intent: 'how_to',
    weight: 0.9,
  },
  
  // Troubleshooting patterns
  {
    patterns: [
      /\b(lỗi|problem|issue|không hoạt động|not working|broken|fix|repair|sửa|lỗi|error|doesn't work)\b/i,
      /\b(không được|can't|cannot|unable|fails|failed|không thể)\b/i,
    ],
    intent: 'troubleshooting',
    weight: 0.9,
  },
  
  // Product inquiry patterns
  {
    patterns: [
      /\b(sản phẩm|product|thiết bị|device|phần mềm|software|app|ứng dụng|application)\b/i,
      /\b(tên|name|gọi là|called|nói về|about|thông tin|information)\b/i,
    ],
    intent: 'product_inquiry',
    weight: 0.7,
  },
  
  // Price inquiry patterns
  {
    patterns: [
      /\b(giá|price|cost|bao nhiêu|much|đắt|cheap|rẻ|mắc|$$$|\$|USD|EUR)\b/i,
      /\b(miễn phí|free|free|tính phí|paid)\b/i,
    ],
    intent: 'price_inquiry',
    weight: 0.8,
  },
  
  // Recommendation patterns
  {
    patterns: [
      /\b(gợi ý|suggest|recommend|tư vấn|advise|advice|nên|một số|some)\b/i,
      /\b(tôi cần|i need|looking for|tìm kiếm|search|want|muốn)\b/i,
      /\b(phù hợp|suitable|fit|appropriate|cho|tặng|với)\b/i,
    ],
    intent: 'recommendation',
    weight: 0.7,
  },
  
  // Feature request patterns
  {
    patterns: [
      /\b(tính năng|feature|function|có thể|can|capability|ability|hỗ trợ|support)\b/i,
      /\b(làm được gì|what can|what does|điều gì|what)\b/i,
    ],
    intent: 'feature_request',
    weight: 0.7,
  },
  
  // Compatibility patterns
  {
    patterns: [
      /\b(tương thích|compatible|compatibility|với|with|works|hoạt động|chạy|run)\b/i,
      /\b(iphone|android|windows|mac|linux|ios|android)\b/i,
    ],
    intent: 'compatibility',
    weight: 0.8,
  },
  
  // Setup help patterns
  {
    patterns: [
      /\b(cài đặt|setup|install|configure|config|setting|thiết lập)\b/i,
      /\b(bắt đầu|start|getting started|first time|lần đầu)\b/i,
    ],
    intent: 'setup_help',
    weight: 0.8,
  },
];

const CATEGORY_KEYWORDS: Record<string, RegExp[]> = {
  vision: [
    /\b(mắt|eye|blind|khiếm thị|sight|vision|thị giác|braille|jaws|nvda|orcam|screen reader|đọc màn hình)\b/i,
  ],
  hearing: [
    /\b(tai|ear|điếc|deaf|hearing|thính giác|hearing aid|trợ thính|cochlear|caption|phụ đề)\b/i,
  ],
  mobility: [
    /\b(xe lăn|wheelchair|mobility|vận động|paralysis|liệt|prosthetic|crutch|nạng|cane)\b/i,
  ],
  communication: [
    /\b(giao tiếp|communication|aac|speech|giọng nói|voice|nói|talk|say)\b/i,
  ],
  cognition: [
    /\b(trí nhớ|memory|nhận thức|cognition|dyslexia|autism|tự kỷ|adhd)\b/i,
  ],
  daily_living: [
    /\b(ăn uống|eating|daily|sinh hoạt|bathroom|nhà tắm|kitchen|bếp)\b/i,
  ],
  education: [
    /\b(học|education|school|trường|learning|study|đọc|reading|writing|viết)\b/i,
  ],
};

const PRODUCT_KEYWORDS: Record<string, string[]> = {
  'OrCam MyEye': ['orcam', 'myeye', 'orcam myeye'],
  'JAWS': ['jaws', 'jaws screen reader'],
  'NVDA': ['nvda', 'nonvisual desktop'],
  'Phonak': ['phonak', 'paradise'],
  'Oticon': ['oticon', 'more hearing'],
  'Roger Pen': ['roger pen', 'roger'],
  'Permobil': ['permobil', 'f5'],
  'Proloquo2Go': ['proloquo', 'proloquo2go'],
  'TD I-13': ['td i-13', 'tobii', 'dynavox'],
};

const BRAND_KEYWORDS: Record<string, string[]> = {
  'OrCam Technologies': ['orcam'],
  'Freedom Scientific': ['freedom scientific', 'fs'],
  'NV Access': ['nv access', 'nvda'],
  'Phonak': ['phonak'],
  'Oticon': ['oticon'],
  'Tobii Dynavox': ['tobii', 'dynavox'],
  'AssistiveWare': ['assistiveware'],
  'Permobil': ['permobil'],
};

export class IntentDetectionService {
  detectIntent(message: string, language?: string): IntentResult {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Detect language if not provided
    const detectedLanguage = language || this.detectLanguage(normalizedMessage);
    
    // Calculate intent scores
    const intentScores: Map<IntentType, { score: number; weight: number }> = new Map();
    
    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedMessage)) {
          const current = intentScores.get(pattern.intent) || { score: 0, weight: 0 };
          current.score += pattern.weight;
          current.weight += 1;
          intentScores.set(pattern.intent, current);
        }
      }
    }
    
    // Determine primary intent
    let primaryIntent: IntentType = 'general';
    let maxScore = 0;
    
    for (const [intent, { score }] of intentScores) {
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }
    
    // Calculate confidence based on pattern matches
    const confidence = Math.min(0.99, Math.max(0.5, maxScore / 2));
    
    // Extract entities
    const entities = this.extractEntities(normalizedMessage);
    
    // Detect categories
    const categories = this.detectCategories(normalizedMessage);
    
    logger.debug('Intent detected', { 
      intent: primaryIntent, 
      confidence, 
      entities,
      categories 
    });
    
    return {
      intent: primaryIntent,
      confidence,
      entities,
      suggestedCategories: categories,
      language: detectedLanguage,
    };
  }
  
  private detectLanguage(text: string): string {
    // Vietnamese patterns
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
      return 'vi';
    }
    
    // Arabic patterns
    if (/[\u0600-\u06ff]/.test(text)) {
      return 'ar';
    }
    
    // French patterns (basic)
    if (/\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|c'est|est|que|qui)\b/i.test(text)) {
      return 'fr';
    }
    
    return 'en';
  }
  
  private extractEntities(message: string): IntentResult['entities'] {
    const entities: IntentResult['entities'] = {};
    
    // Extract products
    const products: string[] = [];
    for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
      if (keywords.some(kw => message.includes(kw))) {
        products.push(product);
      }
    }
    if (products.length > 0) entities.products = products;
    
    // Extract brands
    const brands: string[] = [];
    for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
      if (keywords.some(kw => message.includes(kw))) {
        brands.push(brand);
      }
    }
    if (brands.length > 0) entities.brands = brands;
    
    return entities;
  }
  
  private detectCategories(message: string): string[] {
    const detected: string[] = [];
    
    for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
      if (patterns.some(pattern => pattern.test(message))) {
        detected.push(category);
      }
    }
    
    return detected;
  }
  
  // Get response style based on intent
  getResponseGuidance(intent: IntentType): {
    shouldIncludeProducts: boolean;
    shouldIncludeSteps: boolean;
    shouldIncludeComparison: boolean;
    shouldIncludePrice: boolean;
    responseLength: 'short' | 'medium' | 'long';
  } {
    switch (intent) {
      case 'comparison':
        return {
          shouldIncludeProducts: true,
          shouldIncludeSteps: false,
          shouldIncludeComparison: true,
          shouldIncludePrice: true,
          responseLength: 'long',
        };
      
      case 'how_to':
      case 'setup_help':
        return {
          shouldIncludeProducts: false,
          shouldIncludeSteps: true,
          shouldIncludeComparison: false,
          shouldIncludePrice: false,
          responseLength: 'medium',
        };
      
      case 'troubleshooting':
        return {
          shouldIncludeProducts: false,
          shouldIncludeSteps: true,
          shouldIncludeComparison: false,
          shouldIncludePrice: false,
          responseLength: 'medium',
        };
      
      case 'product_inquiry':
      case 'recommendation':
        return {
          shouldIncludeProducts: true,
          shouldIncludeSteps: false,
          shouldIncludeComparison: false,
          shouldIncludePrice: true,
          responseLength: 'medium',
        };
      
      case 'price_inquiry':
        return {
          shouldIncludeProducts: true,
          shouldIncludeSteps: false,
          shouldIncludeComparison: true,
          shouldIncludePrice: true,
          responseLength: 'short',
        };
      
      default:
        return {
          shouldIncludeProducts: true,
          shouldIncludeSteps: false,
          shouldIncludeComparison: false,
          shouldIncludePrice: true,
          responseLength: 'medium',
        };
    }
  }
}

export const intentDetectionService = new IntentDetectionService();
