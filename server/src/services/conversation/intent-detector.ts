/**
 * MADA AT ASSISTANT - Intent Detector
 * 
 * Phát hiện ý định/câu hỏi của user để tăng độ chính xác của response
 */

import type { SupportedLanguage } from './system-instructions';

/** Các loại intent chính */
export type IntentType =
  | 'product_inquiry'        // Hỏi về sản phẩm cụ thể
  | 'category_exploration'   // Khám phá danh mục
  | 'comparison'             // So sánh sản phẩm
  | 'recommendation_request' // Yêu cầu gợi ý
  | 'price_inquiry'          // Hỏi về giá
  | 'compatibility_check'    // Kiểm tra tương thích
  | 'standards_question'     // Hỏi về tiêu chuẩn
  | 'medical_symptoms'       // Mô tả triệu chứng y tế
  | 'general_greeting'       // Chào hỏi
  | 'help_request'           // Yêu cầu hỗ trợ
  | 'feedback'              // Phản hồi/đánh giá
  | 'out_of_scope'          // Ngoài phạm vi AT
  | 'unknown';               // Không xác định được

/** Kết quả intent detection */
export interface IntentResult {
  primary: IntentType;
  confidence: number;
  category?: string;        // Danh mục AT: vision, hearing, mobility...
  entities?: string[];      // Tên sản phẩm, thương hiệu được phát hiện
  context?: string[];        // Ngữ cảnh bổ sung
  requiresProfessional?: boolean;  // Cần chuyên gia y tế
  language: SupportedLanguage;
}

/** AT Categories */
export const AT_CATEGORIES = {
  vision: ['blind', 'visual', 'sight', 'eyes', 'see', 'read', 'khiếm thị', 'thị giác', 'mù', 'đọc', 'nhìn', 'braille', 'orcam', 'jaws', 'nvda'],
  hearing: ['deaf', 'hear', 'listening', 'ears', 'sound', 'hearing', 'khiếm thính', 'thính giác', 'điếc', 'nghe', 'máy trợ thính', 'phonak'],
  mobility: ['wheelchair', 'mobility', 'walk', 'movement', 'physical', 'disability', 'xe lăn', 'vận động', 'đi lại', 'prosthetic', 'chi giả'],
  communication: ['speak', 'speech', 'talk', 'communicate', 'aac', 'communication', 'giao tiếp', 'nói', 'nói chuyện', 'tổng hợp giọng nói'],
  cognition: ['memory', 'cognitive', 'learn', 'remember', 'think', 'nhận thức', 'trí nhớ', 'học', 'ghi nhớ', 'alzheimers', 'dementia'],
  daily_living: ['eat', 'bathroom', 'dress', 'daily', 'cooking', 'ăn', 'sinh hoạt', 'nấu ăn', 'mặc quần áo'],
  education: ['learn', 'education', 'study', 'school', 'reading', 'writing', 'học', 'giáo dục', 'đọc', 'viết', 'trường học']
};

/** Intent patterns cho từng ngôn ngữ */
const INTENT_PATTERNS = {
  product_inquiry: {
    vi: [/\b(tìm|muốn biết|hỏi về|xem|giới thiệu)\s+(.+\s+)?(sản phẩm|thiết bị|máy|phần mềm|app|ứng dụng)/i, /orcam| jaws| nvda| voiceover| phonak| oticon| tobi[iy]| whill| permobil/i],
    en: [/\b(find|looking for|want to know|ask about|show|introduce)\s+(.+\s+)?(product|device|software|app|tool)/i, /\b(OrCam|JAWS|NVDA|VoiceOver|Phonak|Oticon|Tobii|WHILL|Permobil)\b/i],
    ar: [/يبحث عن|يريد أن يعرف|يسأل عن|يعرض|يحتاج/i],
    fr: [/\b(trouver|chercher|savoir|demander|montrer|présenter)\s+(.+\s+)?(produit|appareil|logiciel|application|outil)/i]
  },
  
  category_exploration: {
    vi: [/\b(khám phá|danh mục|loại|tìm hiểu|tổng quan)\s+(về\s+)?(thiết bị|sản phẩm)/i, /\bthiết bị\s+(hỗ trợ|cho)\s+(người|việc)/i],
    en: [/\b(explore|category|types|overview|find out about)\s+(.+\s+)?(devices|products|assistive)/i],
    ar: [/يستكشف|فئة|أنواع|نظرة عامة/i],
    fr: [/\b(explorer|catégorie|types|aperçu|découvrir)\s+(.+\s+)?(appareils|produits|assistifs)/i]
  },
  
  comparison: {
    vi: [/\b(so sánh|khác nhau|ưu nhược điểm|giống hay khác|tốt hơn|xấu hơn)\b/i, /\b(so với|hay|bằng)\b/i],
    en: [/\b(compare|comparison|difference|pros cons|better|worse|versus|vs\.?)\b/i],
    ar: [/يقارن|مقارنة|افضل|اسوأ/i],
    fr: [/\b(comparer|comparaison|différence|avantages|inconvénients|mieux|pire|contre)\b/i]
  },
  
  recommendation_request: {
    vi: [/\b(gợi ý|đề xuất|recommend|tư vấn|cho tôi|phù hợp)\b/i, /\b(bạn|anh|chị)\s+(nghĩ|khuyên)\b/i],
    en: [/\b(suggest|recommend|advice|think|would you recommend|could suggest)\b/i],
    ar: [/يقترح|يوصي|نصيحة|يرشح/i],
    fr: [/\b(suggérer|recommander|conseil|penser|pourriez-vous suggérer)\b/i]
  },
  
  price_inquiry: {
    vi: [/\b(giá|chi phí|bao nhiêu|price|cost|mua|expensive|cheap|rẻ|đắt)/i],
    en: [/\b(price|cost|how much|buy|purchase|expensive|cheap|affordable)/i],
    ar: [/يبحث عن|يريد أن يعرف|يسأل عن|يعرض|يحتاج/i],
    fr: [/\b(prix|coût|combien|acheter|cher|pas cher|abordable)/i]
  },
  
  compatibility_check: {
    vi: [/\b(tương thích|compatible|dùng được|chạy được|install|cài đặt|windows|mac|ios|android)/i],
    en: [/\b(compatible|works with|run on|install|supports|windows|mac|ios|android)/i],
    ar: [/متوافق|يعمل على|يثبت|ويندوز|ماك/i, /iOS|iPad|iPhone/],
    fr: [/\b(compatible|fonctionne|installer|supporte|windows|mac|ios|android)/i]
  },
  
  standards_question: {
    vi: [/\b(tiêu chuẩn|standard|wcag|iso|w3c|accessibility|tiếp cận)/i],
    en: [/\b(standard|wcag|iso|w3c|accessibility|accessible|guideline)/i],
    ar: [/معيار|معايير|WCAG|ISO|إمكانية الوصول/i],
    fr: [/\b(norme|normes|wcag|iso|accessibilité|accessible|directives)/i]
  },
  
  medical_symptoms: {
    vi: [/\b(bệnh|chứng|triệu chứng|biểu hiện|đau|sốt|ho|khó thở|tê|mất cảm giác|diagnosed|bị)/i],
    en: [/\b(disease|condition|symptom|diagnosed|have|suffering|pain|fever|cough|breathing|difficult|numbness)/i],
    ar: [/مرض|عرض|يشعر|الألم|حمى|سعال|صعوبة التنفس/i],
    fr: [/\b(maladie|condition|symptôme|diagnostiqué|souffrir|douleur|fièvre|toux|respiration)/i]
  },
  
  general_greeting: {
    vi: [/\b(chào|hi|hello|hey|xin chào|good morning|good afternoon|good evening)/i],
    en: [/\b(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings)/i],
    ar: [/مرحبا|اهلا|صباح الخير|مساء الخير/i],
    fr: [/\b(salut|bonjour|bonsoir|hey|coucou)/i]
  },
  
  help_request: {
    vi: [/\b(giúp|help|hỗ trợ|trợ giúp|giúp tôi|cần giúp đỡ)\b/i],
    en: [/\b(help|support|assist|need help|can you|could you)\b/i],
    ar: [/مساعدة|يساعد|يحتاج مساعدة/i],
    fr: [/\b(aide|support|assistance|aider|besoin d'aide)\b/i]
  }
};

/**
 * Detect intent từ user message
 */
export function detectIntent(
  message: string,
  language: SupportedLanguage = 'en'
): IntentResult {
  const lowerMessage = message.toLowerCase();
  const scores: Record<IntentType, number> = {
    product_inquiry: 0,
    category_exploration: 0,
    comparison: 0,
    recommendation_request: 0,
    price_inquiry: 0,
    compatibility_check: 0,
    standards_question: 0,
    medical_symptoms: 0,
    general_greeting: 0,
    help_request: 0,
    feedback: 0,
    out_of_scope: 0,
    unknown: 0
  };
  
  // Detect category
  let detectedCategory: string | undefined;
  for (const [category, keywords] of Object.entries(AT_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        detectedCategory = category;
        break;
      }
    }
    if (detectedCategory) break;
  }
  
  // Score each intent
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const langPatterns = patterns[language] || patterns.en;
    for (const pattern of langPatterns) {
      if (pattern.test(lowerMessage)) {
        scores[intent as IntentType] += 1;
      }
    }
  }
  
  // Medical symptoms get high priority (safety)
  if (scores.medical_symptoms > 0) {
    // Boost medical symptoms
    scores.medical_symptoms += 2;
  }
  
  // Find highest scoring intent
  let maxScore = 0;
  let primaryIntent: IntentType = 'unknown';
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryIntent = intent as IntentType;
    }
  }
  
  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(0.99, 0.5 + (maxScore / totalScore) * 0.5) : 0.3;
  
  // Extract entities (product names, brands)
  const entities = extractEntities(message);
  
  // Determine if professional consultation is needed
  const requiresProfessional = primaryIntent === 'medical_symptoms' || 
    scores.medical_symptoms >= 2;
  
  return {
    primary: primaryIntent,
    confidence,
    category: detectedCategory,
    entities,
    requiresProfessional,
    language
  };
}

/**
 * Extract entities from message
 */
function extractEntities(message: string): string[] {
  const entities: string[] = [];
  
  // Known product names and brands
  const knownProducts = [
    'OrCam', 'MyEye', 'JAWS', 'NVDA', 'VoiceOver', 'TalkBack',
    'Phonak', 'Oticon', 'Widex', 'Resound', 'Signia',
    'Tobii', 'Dynavox', 'PRC', 'Saltillo', 'Proloquo2Go',
    'WHILL', 'Permobil', 'Quickie', 'Invacare', 'Ottobock', 'Össur',
    'Aira', 'Envision', 'Google', 'Apple', 'Microsoft',
    'ZoomText', 'Dragon', 'Kurzweil', 'Read&Write',
    'WCAG', 'ISO', 'ADA', 'Section 508'
  ];
  
  for (const product of knownProducts) {
    if (message.toLowerCase().includes(product.toLowerCase())) {
      entities.push(product);
    }
  }
  
  return Array.from(new Set(entities)); // Remove duplicates
}

/**
 * Get intent display name
 */
export function getIntentDisplayName(intent: IntentType, language: SupportedLanguage = 'vi'): string {
  const names: Record<SupportedLanguage, Record<IntentType, string>> = {
    vi: {
      product_inquiry: 'Hỏi về sản phẩm',
      category_exploration: 'Khám phá danh mục',
      comparison: 'So sánh sản phẩm',
      recommendation_request: 'Yêu cầu gợi ý',
      price_inquiry: 'Hỏi về giá',
      compatibility_check: 'Kiểm tra tương thích',
      standards_question: 'Hỏi về tiêu chuẩn',
      medical_symptoms: 'Mô tả triệu chứng y tế',
      general_greeting: 'Chào hỏi',
      help_request: 'Yêu cầu hỗ trợ',
      feedback: 'Phản hồi',
      out_of_scope: 'Ngoài phạm vi AT',
      unknown: 'Không xác định'
    },
    en: {
      product_inquiry: 'Product Inquiry',
      category_exploration: 'Category Exploration',
      comparison: 'Product Comparison',
      recommendation_request: 'Recommendation Request',
      price_inquiry: 'Price Inquiry',
      compatibility_check: 'Compatibility Check',
      standards_question: 'Standards Question',
      medical_symptoms: 'Medical Symptoms',
      general_greeting: 'Greeting',
      help_request: 'Help Request',
      feedback: 'Feedback',
      out_of_scope: 'Out of Scope',
      unknown: 'Unknown'
    },
    ar: {
      product_inquiry: 'استفسار عن المنتج',
      category_exploration: 'استكشاف الفئة',
      comparison: 'مقارنة المنتجات',
      recommendation_request: 'طلب توصية',
      price_inquiry: 'استفسار عن السعر',
      compatibility_check: 'فحص التوافق',
      standards_question: 'سؤال عن المعايير',
      medical_symptoms: 'أعراض طبية',
      general_greeting: 'تحية',
      help_request: 'طلب مساعدة',
      feedback: 'ملاحظات',
      out_of_scope: 'خارج النطاق',
      unknown: 'غير معروف'
    },
    fr: {
      product_inquiry: 'Demande de produit',
      category_exploration: 'Exploration de catégorie',
      comparison: 'Comparaison de produits',
      recommendation_request: 'Demande de recommandation',
      price_inquiry: 'Demande de prix',
      compatibility_check: 'Vérification de compatibilité',
      standards_question: 'Question sur les normes',
      medical_symptoms: 'Symptômes médicaux',
      general_greeting: 'Salutation',
      help_request: "Demande d'aide",
      feedback: 'Retour',
      out_of_scope: 'Hors scope',
      unknown: 'Inconnu'
    }
  };
  
  return names[language]?.[intent] || names.en[intent] || intent;
}
