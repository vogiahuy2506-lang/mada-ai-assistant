// Content Guardrail - PII detection and harmful content moderation

import { GuardrailResult } from '../models/session.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ContentGuardrail');

// PII patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  phone: /(?:\+?84|0)[3|5|7|8|9][0-9]{8}\b/g,
  vietnamId: /\b\d{9,12}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  password: /\b(?:password|mật khẩu|pwd|pass)\s*[:=]\s*\S+/gi,
};

// Harmful content patterns
const HARMFUL_PATTERNS = {
  violence: [
    /\b(hack|crack|exploit|break in)\b/i,
    /\b(violence|killing|harm)\b/i,
  ],
  selfHarm: [
    /(tự\s*tử|tự\s*hại|tự\s*làm\s*đau)/iu,
    /\b(suicide|self-harm|self harm)\b/i,
  ],
  illegal: [
    /\b(bom|explosive|weapon)\b/i,
    /(đánh\s*cắp|trộm|cướp)/iu,
  ],
};

export class ContentGuardrail {
  private piiPatterns: Record<string, RegExp>;
  private harmfulPatterns: Record<string, RegExp[]>;

  constructor() {
    this.piiPatterns = PII_PATTERNS;
    this.harmfulPatterns = HARMFUL_PATTERNS;
  }

  private detectPII(text: string): string[] {
    const detectedPII: string[] = [];

    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        detectedPII.push(type);
        logger.debug('PII detected', { type, count: matches.length });
      }
    }

    return detectedPII;
  }

  private detectHarmfulContent(text: string): string | null {
    for (const [type, patterns] of Object.entries(this.harmfulPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          logger.warn('Harmful content detected', { type, pattern: pattern.source });
          return type;
        }
      }
    }
    return null;
  }

  async check(input: string): Promise<GuardrailResult> {
    logger.debug('Checking content guardrail', { inputLength: input.length });

    // Check for PII
    const piiTypes = this.detectPII(input);
    if (piiTypes.length > 0) {
      logger.info('PII detected in input', { types: piiTypes });
      // We warn but don't block - user might share contact for legitimate reasons
      return {
        passed: true,
        action: 'ALLOW',
        reason: 'PII detected but allowed (user may voluntarily share contact)',
        triggeredRule: 'PII_DETECTED',
        suggestions: [
          'Vui lòng không chia sẻ thông tin cá nhân nhạy cảm.',
          'Chúng tôi không lưu trữ thông tin liên hệ của bạn.',
        ],
      };
    }

    // Check for harmful content
    const harmfulType = this.detectHarmfulContent(input);
    if (harmfulType) {
      logger.warn('Harmful content detected, blocking', { type: harmfulType });
      return {
        passed: false,
        action: 'BLOCK',
        reason: `Harmful content detected: ${harmfulType}`,
        triggeredRule: `HARMFUL_${harmfulType.toUpperCase()}`,
        suggestions: [
          'Nội dung này không phù hợp.',
          'Vui lòng hỏi về chủ đề khác.',
        ],
      };
    }

    return {
      passed: true,
      action: 'ALLOW',
      reason: 'No concerning content detected',
    };
  }

  maskPII(text: string): string {
    let masked = text;

    // Mask emails
    masked = masked.replace(this.piiPatterns.email, '[EMAIL]');

    // Mask phone numbers
    masked = masked.replace(this.piiPatterns.phone, '[PHONE]');

    // Mask Vietnam IDs
    masked = masked.replace(this.piiPatterns.vietnamId, (match) => {
      if (match.length === 9 || match.length === 12) {
        return '[ID]';
      }
      return match;
    });

    // Mask passwords
    masked = masked.replace(this.piiPatterns.password, '[PASSWORD REDACTED]');

    return masked;
  }
}
