// Medical Guardrail - Blocks medical diagnosis requests

import { GuardrailResult } from '../models/session.model.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MedicalGuardrail');

// Patterns that indicate medical diagnosis requests
const MEDICAL_DIAGNOSIS_PATTERNS = [
  // Vietnamese patterns
  /\b(chẩn đoán|chẩn đoán giúp|được chẩn đoán là|bị chẩn đoán)\b/iu,
  /\b(bị mắc|phải mắc)\s+(?:bệnh|chứng|rối loạn)\b/iu,
  /\b(tôi là|người bị)\s*(?:bệnh|gì|chứng)\b/iu,
  /\b(xác định|biet|nhận biết)\s*(?:bệnh|tình trạng)\b/iu,

  // English patterns
  /\b(diagnos(is|ed|e|ing))\b/iu,
  /\b(i have|i was diagnosed with|i suffer from)\b/iu,
  /\b(what(?:'s| is) wrong with me|do i have)\b/iu,

  // Arabic patterns
  /\b(تشخيص|مرض|أعاني من)\b/iu,

  // French patterns
  /\b(diagnostic|diagnostiqué|j(?:e |')ai\s+(?:été\s+)?diagnostiqué)\b/iu,
];

// Patterns for treatment/medication requests
const TREATMENT_PATTERNS = [
  // Vietnamese
  /\b(kê đơn|đơn thuốc|điều trị|chữa trị|uống thuốc|dùng thuốc)\b/iu,
  /\b(thuốc gì|thuốc nào|tôi nên uống)\b/iu,
  /\b(phẫu thuật|tiểu phẫu|can thiệp y khoa)\b/iu,

  // English
  /\b(prescri(be|ption|bing)|treatment|medication|medicine|drug)\b/iu,
  /\b(should i take|what medicine|prescribe)\b/iu,

  // Arabic
  /\b(وصفة|علاج|دواء|عملية)\b/iu,

  // French
  /\b(médicament|ordonnance|traitement|prescription|opération)\b/iu,
];

// Symptom queries that might lead to diagnosis
const SYMPTOM_PATTERNS = [
  /\b(triệu chứng|biểu hiện|dấu hiệu)\b.*\b(gì| gì?)\b/iu,
  /\b(symptom(s)?|signs?)\b.*\b(mean|indicate|suggest)\b/iu,
  /\b(tại sao|vì sao|nguyên nhân là)\b.*\b(đau|sốt|ho|khó)\b/iu,
];

// Medical advice patterns
const MEDICAL_ADVICE_PATTERNS = [
  /\b(tư vấn|bác sĩ|chuyên gia y|tôi nên làm gì)\b/iu,
  /\b(bác sĩ|coworking with|must see a doctor)\b/iu,
];

export class MedicalGuardrail {
  private patterns: {
    diagnosis: RegExp[];
    treatment: RegExp[];
    symptoms: RegExp[];
    advice: RegExp[];
  };

  constructor() {
    this.patterns = {
      diagnosis: MEDICAL_DIAGNOSIS_PATTERNS,
      treatment: TREATMENT_PATTERNS,
      symptoms: SYMPTOM_PATTERNS,
      advice: MEDICAL_ADVICE_PATTERNS,
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

    // Check for diagnosis requests
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

    // Check for treatment requests
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

    // Check for symptom queries
    const symptomMatch = this.matchPatterns(input, this.patterns.symptoms);
    if (symptomMatch) {
      logger.info('Symptom query pattern detected', { pattern: symptomMatch.source });
      return {
        passed: false,
        action: 'REDIRECT',
        reason: 'Symptom analysis requires medical expertise',
        triggeredRule: 'MEDICAL_SYMPTOMS',
        suggestions: [
          'Tôi không phân tích triệu chứng y khoa.',
          'Vui lòng gặp bác sĩ để được tư vấn.',
        ],
      };
    }

    // Check for medical advice requests
    const adviceMatch = this.matchPatterns(input, this.patterns.advice);
    if (adviceMatch) {
      logger.info('Medical advice request detected', { pattern: adviceMatch.source });
      return {
        passed: true,
        action: 'ALLOW',
        reason: 'Request may contain medical terms but is not seeking diagnosis',
        triggeredRule: 'MEDICAL_ADVICE',
      };
    }

    // No medical patterns detected
    return {
      passed: true,
      action: 'ALLOW',
      reason: 'No medical diagnosis patterns detected',
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
