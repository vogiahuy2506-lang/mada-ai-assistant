// Scope Guardrail - Ensures requests are within AT scope

import { GuardrailResult } from '../models/session.model.js';
import { MadaCategory } from '../models/product.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ScopeGuardrail');

// Topics that are within MADA AT scope
const WITHIN_SCOPE_KEYWORDS = [
  // Vietnamese
  'thiết bị hỗ trợ', 'công nghệ hỗ trợ', 'hỗ trợ tiếp cận', 'mada',
  'wheelchair', 'xe lăn', 'máy đọc', 'phần mềm hỗ trợ',
  'chữ nổi', 'chữ Braille', 'khiếm thị', 'khiếm слух',
  'tự kỷ', 'chậm phát triển', 'cognitive', 'mobility',
  'blind', 'deaf', 'assistive', 'accessibility', 'a11y',

  // English
  'assistive technology', 'AT device', 'accessible', 'disability',
  'screen reader', 'JAWS', 'NVDA', 'OrCam', 'hearing aid',
  ' AAC ', 'augmentative communication', 'prosthetic',

  // Arabic
  'التكنولوجيا المساعدة', 'أجهزة مساعدة', 'إمكانية الوصول', 'إعاقة',

  // French
  'technologie d\'assistance', 'appareil d\'assistance', 'accessibilité',
  'handicap', 'prothèse', 'appareillage',
];

// Keywords that should trigger scope redirection
const OUT_OF_SCOPE_KEYWORDS: Record<string, { keywords: string[]; redirect: string }> = {
  legal_advice: {
    keywords: [
      'tư vấn pháp lý', 'luật sư', 'kiện tụng', 'quyền nuôi con',
      'legal advice', 'lawyer', 'attorney', 'lawsuit', 'custody',
      'مشورة قانونية', 'محام', 'قضية',
      'conseil juridique', 'avocat', 'procès',
    ],
    redirect: 'Tôi không cung cấp tư vấn pháp lý. Tôi chuyên về Công nghệ Hỗ trợ.',
  },
  financial_advice: {
    keywords: [
      'đầu tư', 'chứng khoán', 'crypto', 'tiết kiệm', 'ngân hàng',
      'investment', 'stock', 'crypto', 'savings', 'bank',
      'استثمار', 'أسهم', 'توفير', 'بنك',
      'investissement', 'bourse', 'épargne', 'banque',
    ],
    redirect: 'Tôi không tư vấn tài chính. Tôi có thể cung cấp thông tin về giá thiết bị AT.',
  },
  therapy: {
    keywords: [
      'liệu pháp', 'tâm lý trị liệu', 'hypnotherapy', '催眠',
      'therapy', 'psychotherapy', 'hypnotherapy', 'counseling',
      'علاج نفسي', 'تحليل نفسي',
      'thérapie', 'psychothérapie', 'hypnose',
    ],
    redirect: 'Tôi không cung cấp liệu pháp điều trị. Tôi có thể giới thiệu giải pháp công nghệ phù hợp.',
  },
  insurance: {
    keywords: [
      'bảo hiểm', 'claim', 'indemnity', 'compensation',
      'insurance', 'coverage', 'claim',
      'تأمين', 'مطالبة',
      'assurance', 'réclamation',
    ],
    redirect: 'Tôi không xử lý bảo hiểm. Tôi có thể giúp bạn tìm thiết bị AT phù hợp.',
  },
};

export class ScopeGuardrail {
  private withinScopePatterns: RegExp[];
  private outOfScopeMap: Map<string, { keywords: string[]; redirect: string }>;

  constructor() {
    this.withinScopePatterns = WITHIN_SCOPE_KEYWORDS.map(
      kw => new RegExp(kw, 'iu')
    );
    this.outOfScopeMap = new Map(Object.entries(OUT_OF_SCOPE_KEYWORDS));
  }

  private checkWithinScope(text: string): boolean {
    return this.withinScopePatterns.some(pattern => pattern.test(text));
  }

  private checkOutOfScope(text: string): string | null {
    for (const [key, config] of this.outOfScopeMap.entries()) {
      for (const keyword of config.keywords) {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          return key;
        }
      }
    }
    return null;
  }

  async check(input: string): Promise<GuardrailResult> {
    logger.debug('Checking scope guardrail', { input: input.substring(0, 100) });

    // Check if within scope
    const isWithinScope = this.checkWithinScope(input);

    if (isWithinScope) {
      return {
        passed: true,
        action: 'ALLOW',
        reason: 'Request is within AT scope',
      };
    }

    // Check if out of scope
    const outOfScopeType = this.checkOutOfScope(input);
    if (outOfScopeType) {
      const config = this.outOfScopeMap.get(outOfScopeType)!;
      logger.info('Out of scope request detected', { type: outOfScopeType });

      return {
        passed: false,
        action: 'REDIRECT',
        reason: `Request is outside AT scope: ${outOfScopeType}`,
        triggeredRule: `SCOPE_${outOfScopeType.toUpperCase()}`,
        redirectTo: 'assistive_technology',
        suggestions: [
          'Bạn có thể hỏi về thiết bị công nghệ hỗ trợ.',
          'Tôi giới thiệu các giải pháp AT cho nhu cầu của bạn.',
        ],
        customResponse: config.redirect,
      };
    }

    // Neutral case - might be general conversation
    return {
      passed: true,
      action: 'ALLOW',
      reason: 'Request appears neutral, within AT scope allowed',
    };
  }

  getScopeCategories(): MadaCategory[] {
    return ['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living', 'education'];
  }
}
