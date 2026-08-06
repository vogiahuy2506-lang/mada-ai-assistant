// Scope Guardrail - Ensures requests are within AT scope
// Optimized to be more inclusive of legitimate AT questions

import { GuardrailResult } from '../models/session.model.js';
import { MadaCategory } from '../models/product.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ScopeGuardrail');

// Topics that are within MADA AT scope - EXPANDED
const WITHIN_SCOPE_KEYWORDS = [
  // Vietnamese - expanded
  'thiết bị', 'công nghệ', 'hỗ trợ', 'mada', 'tiếp cận',
  'wheelchair', 'xe lăn', 'máy đọc', 'phần mềm',
  'chữ nổi', 'chữ Braille', 'khiếm thị', 'khiếm thính',
  'tự kỷ', 'chậm phát triển', 'cognitive', 'mobility',
  'blind', 'deaf', 'assistive', 'accessibility', 'a11y',
  'người khuyết tật', 'disability', 'special needs',
  'trẻ em', 'người già', 'elderly', 'children',
  'học tập', 'learning', 'giáo dục', 'education',
  'giao tiếp', 'communication', 'speech', 'voice',
  'thị giác', 'thính giác', 'vận động',
  'trí nhớ', 'nhận thức', 'cognition',
  'sinh hoạt', 'daily living', ' Independence',
  'điếc', 'câm', 'mù', 'hành lang',
  'nhận dạng', 'giọng nói', 'speech recognition',
  'tổng hợp', 'text to speech', 'tts',
  'bàn phím', 'keyboard', 'chuột', 'mouse',
  'màn hình', 'screen', 'hiển thị', 'display',

  // English - expanded
  'assistive technology', 'AT device', 'accessible', 'disability',
  'screen reader', 'JAWS', 'NVDA', 'OrCam', 'hearing aid',
  ' AAC ', 'augmentative communication', 'prosthetic',
  'adaptive', 'accommodation', 'inclusive',
  'vision', 'visual', 'hearing', 'auditory',
  'motor', 'physical', 'cognitive', 'learning',
  'Braille', 'magnifier', 'amplification',
  'iPad', 'tablet', 'smartphone', 'app',
  'software', 'hardware', 'device',
  'tool', 'aid', 'support', 'help',

  // Arabic
  'التكنولوجيا المساعدة', 'أجهزة مساعدة', 'إمكانية الوصول', 'إعاقة',
  'معين', 'دعم', 'accessible',

  // French
  'technologie d\'assistance', 'appareil d\'assistance', 'accessibilité',
  'handicap', 'prothèse', 'appareillage',
  'aide', 'soutien', 'dispositif',
];

// Keywords that should trigger scope redirection - ONLY clear non-AT topics
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
      'đầu tư chứng khoán', 'crypto trading', 'forex',
      'stock investment', 'crypto trading', 'forex trading',
      'استثمار أسهم', 'تداول العملات',
      'investissement bourse', 'trading forex',
    ],
    redirect: 'Tôi không tư vấn đầu tư tài chính. Tôi có thể cung cấp thông tin về giá thiết bị AT.',
  },
  therapy: {
    keywords: [
      'liệu pháp tâm lý', 'hypnotherapy', 'psychotherapy treatment',
      'psychotherapy', 'hypnotherapy',
      'علاج نفسي', 'تحليل نفسي',
      'thérapie analytique', 'hypnose thérapeutique',
    ],
    redirect: 'Tôi không cung cấp liệu pháp tâm lý. Tôi có thể giới thiệu giải pháp công nghệ phù hợp.',
  },
  // REMOVED: insurance - too broad
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

    // Check if out of scope FIRST (more specific)
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

    // Check if within scope
    const isWithinScope = this.checkWithinScope(input);

    if (isWithinScope) {
      return {
        passed: true,
        action: 'ALLOW',
        reason: 'Request is within AT scope',
      };
    }

    // DEFAULT: Allow most requests through
    // Only block clearly non-AT topics that were checked above
    // This is the key change - be permissive by default
    return {
      passed: true,
      action: 'ALLOW',
      reason: 'Request appears to be general conversation, allowed by default',
    };
  }

  getScopeCategories(): MadaCategory[] {
    return ['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living', 'education'];
  }
}
