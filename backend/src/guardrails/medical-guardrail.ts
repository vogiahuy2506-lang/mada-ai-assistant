// Medical Guardrail - Blocks medical diagnosis requests
// Optimized to be more lenient with legitimate AT questions

import { GuardrailResult } from '../models/session.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MedicalGuardrail');

// Patterns that indicate CLEAR medical diagnosis requests - ONLY these are blocked
const MEDICAL_DIAGNOSIS_PATTERNS = [
  // Vietnamese patterns - more specific
  /\b(chẩn đoán giúp|tôi bị\s+(?:bệnh|chứng)\s+\w+|được chẩn đoán là|bị chẩn đoán)\b/iu,
  /\b(tôi nghĩ|tôi có phải|tôi là bệnh)\b.*\b(không|đúng không)\b/iu,
  /\b(tôi bị|bệnh của tôi là|chứng của tôi là)\b/iu,

  // English patterns - more specific
  /\b(diagnose me|can you diagnose|i need a diagnosis|what disease do i have)\b/iu,
  /\b(do i have\s+(?:diabetes|cancer|hiv|any disease))\b/iu,
  /\b(my diagnosis is|diagnostic)\s*(?:for|me|please)\b/iu,

  // Arabic patterns
  /\b(ماهو مرض|أعاني من مرض|مرضي هو)\b/iu,

  // French patterns
  /\b(diagnostiquer|quel maladie|j'ai une maladie)\b/iu,
];

// Patterns for treatment/medication requests - REDIRECT not block
const TREATMENT_PATTERNS = [
  // Vietnamese
  /\b(kê đơn thuốc|đơn thuốc cho|thuốc điều trị|bác sĩ kê)\b/iu,
  /\b(uống thuốc gì|thuốc nào cho|dùng thuốc)\b.*\b(để|mà)\b/iu,
  /\b(phẫu thuật cho|can thiệp y khoa cho)\b/iu,

  // English
  /\b(prescribe me|prescription for|what medication|what drug should i take)\b/iu,
  /\b(medical treatment for|should i take.*medicine)\b/iu,

  // Arabic
  /\b(وصفة طبية|دواء لهذا|علاج لهذا المرض)\b/iu,

  // French
  /\b(ordonnance pour|médicament pour|quel médicament)\b/iu,
];

// AT-related symptom queries that should be ALLOWED
const AT_RELATED_PATTERNS = [
  // These are legitimate AT questions
  /\b(thiết bị|phần mềm|app|công nghệ)\b.*\b(cho|giúp)\b.*\b(khó khăn|vấn đề|tình trạng)\b/iu,
  /\b(device|software|app|tool)\b.*\b(for|help|assist)\b.*\b(difficulty|problem|condition)\b/iu,
  /\b(cần|hỗ trợ|help|need|support)\b.*\b(với|for|with)\b.*\b(hoạt động|functioning|moving|seeing|hearing)\b/iu,
  /\b(gặp khó khăn|having trouble|difficulty with)\b/iu,
];

export class MedicalGuardrail {
  private patterns: {
    diagnosis: RegExp[];
    treatment: RegExp[];
    atRelated: RegExp[];
  };

  constructor() {
    this.patterns = {
      diagnosis: MEDICAL_DIAGNOSIS_PATTERNS,
      treatment: TREATMENT_PATTERNS,
      atRelated: AT_RELATED_PATTERNS,
    };
  }

  private matchPatterns(text: string, patterns: RegExp[]): RegExp | null {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return pattern;
      }
    }
    return null;
  }

  async check(input: string): Promise<GuardrailResult> {
    logger.debug('Checking medical guardrail', { input: input.substring(0, 100) });

    // FIRST: Check if it's an AT-related question - ALLOW these
    const atRelatedMatch = this.matchPatterns(input, this.patterns.atRelated);
    if (atRelatedMatch) {
      logger.debug('AT-related question detected, allowing', { pattern: atRelatedMatch.source });
      return {
        passed: true,
        action: 'ALLOW',
        reason: 'AT-related question with potential symptom mention, allowed',
      };
    }

    // SECOND: Check for clear diagnosis requests - BLOCK these
    const diagnosisMatch = this.matchPatterns(input, this.patterns.diagnosis);
    if (diagnosisMatch) {
      logger.info('Medical diagnosis pattern detected', { pattern: diagnosisMatch.source });
      return {
        passed: false,
        action: 'BLOCK',
        reason: 'Medical diagnosis requests are not permitted',
        triggeredRule: 'MEDICAL_DIAGNOSIS',
        suggestions: [
          'Tôi không thể chẩn đoán y khoa. Tôi có thể giúp bạn tìm thiết bị công nghệ hỗ trợ.',
          'Vui lòng tham khảo ý kiến bác sĩ chuyên khoa.',
        ],
      };
    }

    // THIRD: Check for treatment requests - REDIRECT
    const treatmentMatch = this.matchPatterns(input, this.patterns.treatment);
    if (treatmentMatch) {
      logger.info('Treatment request pattern detected', { pattern: treatmentMatch.source });
      return {
        passed: false,
        action: 'REDIRECT',
        reason: 'Medical treatment requests should be directed to healthcare professionals',
        triggeredRule: 'MEDICAL_TREATMENT',
        suggestions: [
          'Về điều trị y khoa, tôi khuyên bạn tham khảo ý kiến bác sĩ.',
          'Tôi có thể giúp bạn về giải pháp công nghệ hỗ trợ.',
        ],
      };
    }

    // DEFAULT: Allow through
    return {
      passed: true,
      action: 'ALLOW',
      reason: 'No medical diagnosis or treatment patterns detected',
    };
  }

  getBlockedResponse(language: string = 'vi'): string {
    const responses: Record<string, string> = {
      vi: `Tôi là **Mada AT Assistant** - chuyên gia về Công nghệ Hỗ trợ, không phải bác sĩ.

Về chẩn đoán và điều trị y khoa, tôi khuyên bạn:
• Tham khảo ý kiến bác sĩ chuyên khoa
• Liên hệ cơ sở y tế gần nhất

Tuy nhiên, tôi có thể giúp bạn về:
• Thiết bị hỗ trợ cho tình trạng của bạn
• Giải pháp tiếp cận kỹ thuật số
• Phần mềm hỗ trợ phù hợp

Bạn muốn tôi giúp gì về Công nghệ Hỗ trợ?`,

      en: `I am **Mada AT Assistant** - an Assistive Technology specialist, not a medical professional.

For medical diagnosis and treatment, I recommend:
• Consult a qualified healthcare professional
• Contact your nearest medical facility

However, I can help you with:
• Assistive devices for your needs
• Digital accessibility solutions
• Suitable support software

How can I assist you with Assistive Technology?`,

      ar: `أنا **Mada AT Assistant** - متخصص في التكنولوجيا المساعدة، ولست طبيبًا.

لل تشخيص والعلاج الطبي، أنصحك:
• استشارة أخصائي رعاية صحية مؤهل
• الاتصال بأقرب منشأة طبية

ومع ذلك، يمكنني مساعدتك في:
• الأجهزة المساعدة لاحتياجاتك
• حلول الوصول الرقمي
• برامج الدعم المناسبة

كيف يمكنني مساعدتك في التكنولوجيا المساعدة؟`,

      fr: `Je suis **Mada AT Assistant** - un spécialiste de la technologie d'assistance, pas un professionnel médical.

Pour le diagnostic et le traitement médical, je vous recommande:
• Consulter un professionnel de santé qualifié
• Contacter l'établissement médical le plus proche

Cependant, je peux vous aider avec:
• Des appareils d'assistance pour vos besoins
• Des solutions d'accessibilité numérique
• Des logiciels de support appropriés

Comment puis-je vous aider avec la technologie d'assistance?`,
    };

    return responses[language] || responses.vi;
  }
}
