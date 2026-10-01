/**
 * MADA AI Guardrails System - Enhanced Version
 * 
 * Lớp kiểm duyệt nội dung để:
 * 1. Từ chối chẩn đoán y khoa
 * 2. Chuyển hướng câu hỏi về AT solutions
 * 3. Đảm bảo phạm vi hoạt động
 * 4. Phát hiện PII và nội dung độc hại
 */

// ============================================================================
// MEDICAL GUARDRAIL - Block medical diagnosis requests
// ============================================================================

const MEDICAL_DIAGNOSIS_PATTERNS = [
  // Vietnamese: explicit diagnosis requests
  /\b(chẩn đoán|chẩn đoán giúp|chuẩn đoán giúp|được chẩn đoán là|bị chẩn đoán)\b/iu,
  /\b(chẩn đoán|chuan đoán)\s+(?:giúp|nào|bệnh gì|là)\b/iu,
  /\b(tôi có phải|bạn nghĩ|tôi bị phải)\b.*\b(bệnh|bệnh gì)\b/iu,

  // English: explicit diagnosis requests
  /\b(diagnos(is|ed|e|ing)|can you diagnose|help me diagnose)\b/iu,
  /\b(i have|i was diagnosed with|i suffer from)\b/iu,
  /\b(what(?:'s| is) wrong with me|do i have|what disease do i)\b/iu,
  /\b(should i take|what medicine|prescribe)\b/iu,

  // Arabic: explicit diagnosis requests
  /\b(تشخيص|مرض|أعاني من|علاج|وصفة|عملية|سرطان|سكري)\b/iu,

  // French: explicit diagnosis requests
  /\b(diagnostic|diagnostiqué|j(?:e |')ai\s+(?:été\s+)?diagnostiqué)\b/iu,
];

// ============================================================================
// SCOPE GUARDRAIL - Ensure requests are within AT scope
// ============================================================================

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

const OUT_OF_SCOPE_MAP: Record<string, { keywords: string[]; redirect: string }> = {
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

// ============================================================================
// CONTENT GUARDRAIL - PII detection and harmful content
// ============================================================================

const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  phone: /(?:\+?84|0)[3|5|7|8|9][0-9]{8}\b/g,
  vietnamId: /\b\d{9,12}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  password: /\b(?:password|mật khẩu|pwd|pass)\s*[:=]\s*\S+/gi,
};

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

// ============================================================================
// RESPONSES
// ============================================================================

const MEDICAL_REDIRECT_RESPONSES = {
  vi: `⚠️ **Lưu ý quan trọng**

Tôi là **MADA AI Assistant** - chuyên gia về **Công nghệ Hỗ trợ (Assistive Technology)**. Tôi **KHÔNG** phải là bác sĩ hay chuyên gia y tế và **KHÔNG thể** đưa ra:

- Chẩn đoán bệnh
- Đơn thuốc hay liều lượng thuốc
- Tư vấn điều trị y khoa

**Tuy nhiên**, tôi có thể giúp bạn về:
- 🖥️ Thiết bị hỗ trợ sử dụng máy tính (JAWS, NVDA, VoiceOver)
- 👓 Thiết bị hỗ trợ người khiếm thị
- 👂 Thiết bị hỗ trợ người điếc
- 🦽 Thiết bị di chuyển (xe lăn, nạng, khung đi)
- 🧠 Thiết bị hỗ trợ nhận thức
- 📚 Tiêu chuẩn WCAG, ISO 9999

Bạn có muốn tôi tư vấn về **thiết bị công nghệ hỗ trợ** phù hợp với tình trạng của bạn hoặc người thân không?`,

  en: `⚠️ **Important Notice**

I am **MADA AI Assistant** - an expert in **Assistive Technology (AT)**, not a medical professional. I **CANNOT** provide:

- Medical diagnosis
- Prescriptions or medication advice
- Medical treatment recommendations

**However**, I **CAN** help you with:
- 🖥️ Computer access technology (JAWS, NVDA, VoiceOver)
- 👓 Visual aids for blind/low vision
- 👂 Hearing assistive devices
- 🦽 Mobility devices (wheelchairs, walkers)
- 🧠 Cognitive support tools
- 📚 Accessibility standards (WCAG, ISO 9999)

Would you like me to help you find **assistive technology solutions** for your or your loved one's needs?`,

  ar: `⚠️ **تنبيه مهم**

أنا **MADA AI Assistant** - خبير في **التكنولوجيا المساعدة (AT)**، ولست متخصصًا طبيًا. لا أستطيع تقديم:

- تشخيص طبي
- وصفات أو نصائح أدوية
- توصيات علاجية طبية

**ولكن**، يمكنني مساعدتك في:
- 🖥️ تقنية الوصول للكمبيوتر
- 👓 أجهزة مساعدة بصرية
- 👂 أجهزة مساعدة للسمع
- 🦽 أجهزة التنقل
- 🧠 أدوات الدعم المعرفي
- 📚 معايير إمكانية الوصول

هل تريد مني مساعدتك في العثور على **حلول التكنولوجيا المساعدة** المناسبة لاحتياجاتك؟`,

  fr: `⚠️ **Avis Important**

Je suis **MADA AI Assistant** - expert en **Technologie d'Assistance (AT)**, pas un professionnel médical. Je **NE PEUX PAS** fournir:

- Diagnostic médical
- Ordonnances ou conseils médicamenteux
- Recommandations de traitement médical

**Cependant**, je **PEUX** vous aider avec:
- 🖥️ Technologie d'accès informatique
- 👓 Aides visuelles
- 👂 Aides auditives
- 🦽 Dispositifs de mobilité
- 🧠 Outils de soutien cognitif
- 📚 Normes d'accessibilité

Souhaitez-vous que je vous aide à trouver des **solutions de technologie d'assistance** adaptées à vos besoins?`,
};

const OUT_OF_SCOPE_RESPONSE_VI = `⚠️ **Câu hỏi nằm ngoài phạm vi tư vấn**

Tôi là MADA AI Assistant chuyên về **Công nghệ Hỗ trợ**. Câu hỏi của bạn không thuộc lĩnh vực tôi có thể hỗ trợ.

Vui lòng hỏi về:
- Thiết bị AT cho người khuyết tật
- Tiêu chuẩn accessibility
- Giải pháp công nghệ hỗ trợ`;

const OUT_OF_SCOPE_RESPONSE_EN = `⚠️ **Out of Scope**

I'm MADA AI Assistant, specialized in **Assistive Technology**. Your question is outside my area of expertise.

Please ask about:
- AT devices for people with disabilities
- Accessibility standards
- Assistive technology solutions`;

const HARMFUL_CONTENT_RESPONSE_VI = `⚠️ **Nội dung không phù hợp**

Tôi không thể xử lý yêu cầu này vì nó chứa nội dung không phù hợp.

Vui lòng hỏi về **thiết bị công nghệ hỗ trợ** hoặc các chủ đề liên quan đến MADA.`;

const HARMFUL_CONTENT_RESPONSE_EN = `⚠️ **Inappropriate Content**

I cannot process this request because it contains inappropriate content.

Please ask about **assistive technology devices** or topics related to MADA.`;

// ============================================================================
// MAIN CLASS
// ============================================================================

export interface GuardrailsResult {
  isSafe: boolean;
  shouldRedirect: boolean;
  redirectResponse?: string;
  detectedPattern?: string;
  suggestedTopic?: string;
  piiDetected?: string[];
}

export class GuardrailsSystem {
  initialize(): void {
    console.log('🛡️ Guardrails system initialized');
  }

  // ==========================================================================
  // MEDICAL DETECTION
  // ==========================================================================

  private containsMedicalDiagnosis(query: string): boolean {
    return MEDICAL_DIAGNOSIS_PATTERNS.some(pattern => pattern.test(query));
  }

  // ==========================================================================
  // SCOPE DETECTION
  // ==========================================================================

  private detectATIntent(query: string): boolean {
    const queryLower = query.toLowerCase();
    return WITHIN_SCOPE_KEYWORDS.some(keyword => queryLower.includes(keyword.toLowerCase()));
  }

  private checkOutOfScope(query: string): { type: string; redirect: string } | null {
    const queryLower = query.toLowerCase();
    
    for (const [type, config] of Object.entries(OUT_OF_SCOPE_MAP)) {
      for (const keyword of config.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          return { type, redirect: config.redirect };
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // CONTENT MODERATION
  // ==========================================================================

  private detectPII(query: string): string[] {
    const detectedPII: string[] = [];

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(query)) {
        detectedPII.push(type);
      }
    }

    return detectedPII;
  }

  private detectHarmfulContent(query: string): string | null {
    for (const [type, patterns] of Object.entries(HARMFUL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return type;
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // MAIN ANALYSIS
  // ==========================================================================

  analyzeQuery(
    query: string,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi'
  ): GuardrailsResult {
    const result: GuardrailsResult = {
      isSafe: true,
      shouldRedirect: false,
    };

    // Step 1: Check for harmful content (block immediately)
    const harmfulType = this.detectHarmfulContent(query);
    if (harmfulType) {
      console.warn(`⚠️ Guardrails: Harmful content detected (${harmfulType})`);
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: language === 'vi' ? HARMFUL_CONTENT_RESPONSE_VI : HARMFUL_CONTENT_RESPONSE_EN,
        detectedPattern: `harmful_content_${harmfulType}`,
        suggestedTopic: 'assistive_technology',
      };
    }

    // Step 2: Check for medical diagnosis (redirect)
    if (this.containsMedicalDiagnosis(query)) {
      console.warn('⚠️ Guardrails: Medical diagnosis pattern detected');
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: MEDICAL_REDIRECT_RESPONSES[language] || MEDICAL_REDIRECT_RESPONSES['en'],
        detectedPattern: 'medical_diagnosis',
        suggestedTopic: 'assistive_technology',
      };
    }

    // Step 3: Check out of scope
    const outOfScope = this.checkOutOfScope(query);
    if (outOfScope) {
      console.warn(`⚠️ Guardrails: Out of scope (${outOfScope.type})`);
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: language === 'vi' ? OUT_OF_SCOPE_RESPONSE_VI : OUT_OF_SCOPE_RESPONSE_EN,
        detectedPattern: `out_of_scope_${outOfScope.type}`,
        suggestedTopic: 'assistive_technology',
      };
    }

    // Step 4: Check for PII (warn but allow)
    const piiDetected = this.detectPII(query);
    if (piiDetected.length > 0) {
      console.info(`ℹ️ Guardrails: PII detected (${piiDetected.join(', ')})`);
      result.piiDetected = piiDetected;
    }

    // Query is safe
    return result;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  validateResponse(response: string): boolean {
    // Check for potentially harmful content in response
    const harmfulPatterns = [
      /diagnos.*precise/i,
      /definitively.*confirm/i,
      /prescribe.*medication/i,
      /you.*have.*disease/i,
    ];

    return !harmfulPatterns.some(pattern => pattern.test(response));
  }

  calculateSafetyScore(query: string): number {
    let score = 100;

    // Deduct for medical diagnosis patterns
    if (this.containsMedicalDiagnosis(query)) score -= 50;

    // Deduct for out-of-scope
    if (this.checkOutOfScope(query)) score -= 30;

    // Deduct for harmful content
    if (this.detectHarmfulContent(query)) score -= 50;

    // Bonus for AT-related keywords
    if (this.detectATIntent(query)) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  maskPII(text: string): string {
    let masked = text;

    // Mask emails
    masked = masked.replace(PII_PATTERNS.email, '[EMAIL]');

    // Mask phone numbers
    masked = masked.replace(PII_PATTERNS.phone, '[PHONE]');

    // Mask Vietnam IDs
    masked = masked.replace(PII_PATTERNS.vietnamId, (match) => {
      if (match.length === 9 || match.length === 12) {
        return '[ID]';
      }
      return match;
    });

    // Mask passwords
    masked = masked.replace(PII_PATTERNS.password, '[PASSWORD REDACTED]');

    return masked;
  }
}

// Singleton instance
export const guardrails = new GuardrailsSystem();
