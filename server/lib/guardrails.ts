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

// Pattern cho câu hỏi về triệu chứng/bệnh (Dạng: "tôi có bị X không?" - hỏi về bệnh)
const MEDICAL_SYMPTOM_QUESTION_PATTERNS = [
  // Tiếng Việt: hỏi về việc "có bị" một bệnh/triệu chứng không
  /\b(tôi|mình)\s+(?:có\s+)?(?:bị\s+)?(?:phải\s+)?(?:cận|loạn thị|viễn thị|lác|mù|điếc|khiếm thị|khiếm thính)\s+(?:không|kô|hem|hok)\b/iu,
  /\b(?:tôi|mình)\s+(?:có\s+)?bị\s+(?:bệnh\s+)?(?:gì|cận|loạn|viễn|lác|thị)\b/iu,
  /\b(?:có\s+)?(?:phải\s+)?(?:bị\s+)?(?:cận|loạn|viễn|lác)\s+(?:không|kô|hem|hok|bệnh\s+gì)\b/iu,
  /\b(?:có\s+)?(?:phải\s+)?(?:bị\s+)?(?:tự\s+kỷ|autism|down\s+syndrome|adhd)\s+(?:không|kô|hem|hok)\b/iu,
  /\b(?:có\s+)?(?:phải\s+)?(?:bị\s+)?(?:chóng mặt|hoa mắt|ù tai|đau đầu|mất ngủ)\s+(?:không|kô|hem|hok)\b/iu,
  /\b(?:tôi|mình)\s+(?:có\s+)?(?:phải\s+)?(?:bị\s+)?(?:bệnh\s+)?(?:gì|paralysis|stroke|stroke)\b/iu,
  // Tiếng Anh: hỏi "do I have X"
  /\bdo\s+i\s+have\s+(?:nearsightedness|myopia|farsightedness|hyperopia|astigmatism|blindness|deafness|glaucoma|cataract|alzheimer|dementia|autism|adhd|paralysis)\b/iu,
  /\bam\s+i\s+(?:blind|deaf|disabled|paralyzed)\b/iu,
  /\bcan\s+you\s+tell\s+me\s+if\s+i\s+(?:have|am|suffer)\b/iu,
  // Tiếng Anh: hỏi "what's wrong with me"
  /\bwhat(?:'s| is)\s+wrong\s+with\s+(?:me|my\s+(?:eyes|ears|body|legs|arms))\b/iu,
];

// Pattern cho yêu cầu tư vấn AT (Dạng: "tôi bị X, có thiết bị nào?" - đã biết bệnh, hỏi về giải pháp)
const AT_CONSULTATION_PATTERNS = [
  // Tiếng Việt: đã xác định bệnh, hỏi về thiết bị
  /\b(?:vì|tại|vì\s+tôi|tại\s+tôi)\s+(?:tôi|mình)\s+(?:bị\s+)?(?:cận|loạn thị|viễn thị|lác|mù|điếc|khiếm thị|khiếm thính)\b/iu,
  /\b(?:vì|tại)\s+(?:tôi|mình)\s+(?:bị\s+)?(?:tự\s+kỷ|autism|down\s+syndrome|adhd)\b/iu,
  /\b(?:vì|tại)\s+(?:bị|bệnh)\s+(?:cận|loạn|viễn|lác|thị|paralysis)\b/iu,
  /\b(?:cho|tặng|người)\s+(?:bị|có)\s+(?:cận|loạn|viễn|lác|mù|điếc)\b/iu,
  // Tiếng Anh
  /\b(?:because\s+)?i\s+(?:have|am|suffer\s+from|was\s+diagnosed\s+with)\s+(?:nearsightedness|myopia|glaucoma|autism|adhd|paralysis)\b/iu,
  /\bfor\s+someone\s+(?:with|who\s+is|who\s+has)\s+(?:blind|deaf|disabled)\b/iu,
  /\b(?:I|my)\s+(?:eyes|ears|vision|hearing)\s+(?:is|are)\s+(?:bad|poor|weak|impaired)\b/iu,
];

// Pattern cho chẩn đoán y khoa rõ ràng
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
  // ⭐ Education AT keywords - học tập cho người khuyết tật
  'học sinh', 'sinh viên', 'học tập', 'giáo dục', 'trường học',
  'student', 'learn', 'education', 'school', 'studying',
  'người khuyết tật', 'người bị', 'người có', 'người mù', 'người điếc',
  'atlas', 'tài liệu', 'sách nói', 'audiobook', 'đọc sách',
  'accessibility', 'accessible', 'inclusive education', 'udl',

  // English
  'assistive technology', 'AT device', 'accessible', 'disability',
  'screen reader', 'JAWS', 'NVDA', 'OrCam', 'hearing aid',
  'aac', 'augmentative communication', 'prosthetic',
  'visually impaired', 'low vision', 'hard of hearing',
  'learning disability', 'dyslexia', 'adhd', 'autism',

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

// Response cho câu hỏi về triệu chứng (không phải tư vấn AT)
const SYMPTOM_QUESTION_RESPONSES = {
  vi: `⚠️ **Câu hỏi về triệu chứng/bệnh lý**

Xin lỗi, tôi không thể trả lời câu hỏi về triệu chứng hay tình trạng sức khỏe của bạn.

**Tôi là ai?**
Tôi là **MADA AI Assistant** - chuyên về **Công nghệ Hỗ trợ (Assistive Technology - AT)**, không phải bác sĩ hay chuyên gia y tế.

**Tôi có thể giúp gì?**
- Giới thiệu thiết bị AT phù hợp với tình trạng ĐÃ ĐƯỢC CHẨN ĐOÁN
- Tư vấn về giải pháp công nghệ hỗ trợ
- Cung cấp thông tin về tiêu chuẩn WCAG, ISO 9999

**Bạn nên làm gì?**
Để được chẩn đoán chính xác, bạn nên:
1. 🏥 Đến bệnh viện hoặc phòng khám chuyên khoa
2. 👨‍⚕️ Gặp bác sĩ chuyên khoa phù hợp
3. 📋 Làm các xét nghiệm theo hướng dẫn

**Nếu bạn đã biết tình trạng của mình**, tôi có thể tư vấn về thiết bị AT phù hợp. Ví dụ:
- "Tôi bị cận, có thiết bị nào hỗ trợ đọc sách không?" ✅
- "Tôi bị điếc, có thiết bị giao tiếp nào không?" ✅`,

  en: `⚠️ **Question about symptoms/medical condition**

Sorry, I cannot answer questions about your symptoms or health condition.

**Who am I?**
I am **MADA AI Assistant** - specialized in **Assistive Technology (AT)**, not a doctor or medical professional.

**What can I help with?**
- Introducing AT devices suitable for your ALREADY DIAGNOSED condition
- Consulting on assistive technology solutions
- Providing information about WCAG, ISO 9999 standards

**What should you do?**
For accurate diagnosis, you should:
1. 🏥 Visit a hospital or specialized clinic
2. 👨‍⚕️ Consult with an appropriate specialist
3. 📋 Take recommended tests

**If you already know your condition**, I can consult on suitable AT devices. For example:
- "I have nearsightedness, what devices can help me read?" ✅
- "I'm deaf, what communication devices are available?" ✅`,

  ar: `⚠️ **سؤال عن الأعراض/الحالة الطبية**

عذرًا، لا أستطيع الإجابة على أسئلة حول أعراضك أو حالتك الصحية.

أنا **MADA AI Assistant** - متخصص في **التكنولوجيا المساعدة (AT)**، ولست طبيبًا.

يمكنني المساعدة في:
- تقديم أجهزة AT المناسبة لحالتك المُشخصة
- استشارات حول حلول التكنولوجيا المساعدة

**ماذا يجب أن تفعل؟**
1. 🏥 زيارة مستشفى أو عيادة متخصصة
2. 👨‍⚕️ استشارة طبيب مختص
3. 📋 إجراء الفحوصات اللازمة`,

  fr: `⚠️ **Question sur les symptômes/état médical**

Désolé, je ne peux pas répondre aux questions sur vos symptômes ou votre état de santé.

Je suis **MADA AI Assistant** - spécialisé en **Technologie d'Assistance (TA)**, pas un médecin.

Je peux vous aider avec:
- Présentation d'appareils TA adaptés à votre état diagnostiqué
- Consultations sur les solutions technologiques

**Que devez-vous faire?**
1. 🏥 Visiter un hôpital ou une clinique spécialisée
2. 👨‍⚕️ Consulter un spécialiste
3. 📋 Effectuer les examens nécessaires`,
};

const OUT_OF_SCOPE_RESPONSE_VI = `🤖 **Mình có thể giúp gì cho bạn?**

Câu hỏi của bạn có thể hơi khác so với các chủ đề chuyên sâu của MADA, nhưng mình vẫn có thể gợi ý một số hướng:

**Các chủ đề MADA có thể hỗ trợ:**
- 🖥️ Thiết bị AT cho người khuyết tật (thị giác, thính giác, vận động...)
- 📚 Tiêu chuẩn accessibility (WCAG, ISO 9999)
- 🔧 Giới thiệu sản phẩm công nghệ hỗ trợ

**Bạn có thể thử hỏi cụ thể hơn:**
- "Có thiết bị nào cho người khiếm thị đọc sách không?"
- "Máy trợ thính giá bao nhiêu?"
- "Xe lăn điện có những loại nào?"

Mình sẵn sàng tư vấn về **thiết bị công nghệ hỗ trợ** bất cứ lúc nào! 😊`;

const OUT_OF_SCOPE_RESPONSE_EN = `🤖 **How Can I Help You?**

Your question might be slightly different from MADA's core topics, but I can still suggest some directions:

**MADA topics I can support:**
- 🖥️ AT devices for people with disabilities (vision, hearing, mobility...)
- 📚 Accessibility standards (WCAG, ISO 9999)
- 🔧 Assistive technology product recommendations

**Try asking more specifically:**
- "What devices help visually impaired people read books?"
- "How much do hearing aids cost?"
- "What types of wheelchairs are available?"

I'm ready to consult on **assistive technology** anytime! 😊`;

const OUT_OF_SCOPE_RESPONSE_AR = `🤖 **كيف يمكنني مساعدتك؟**

سؤالك قد يختلف قليلاً عن الموضوعات الأساسية لمادا، لكن لا يزال بإمكاني تقديم بعض الاقتراحات:

**مواضيع مادا التي يمكنني دعمها:**
- 🖥️ أجهزة TA للأشخاص ذوي الإعاقة
- 📚 معايير إمكانية الوصول (WCAG، ISO 9999)
- 🔧 توصيات منتجات التكنولوجيا المساعدة

**جرب السؤال بشكل أكثر تحديدًا:**
- "ما الأجهزة التي تساعد ضعاف البصر على القراءة؟"
- "كم تكلفة سماعات الأذن؟"

أنا مستعد للاستشارة في **التكنولوجيا المساعدة** في أي وقت! 😊`;

const OUT_OF_SCOPE_RESPONSE_FR = `🤖 **Comment puis-je vous aider?**

Votre question peut être légèrement différente des sujets principaux de MADA, mais je peux toujours vous suggérer quelques directions:

**Sujets MADA que je peux soutenir:**
- 🖥️ Appareils TA pour personnes handicapées
- 📚 Normes d'accessibilité (WCAG, ISO 9999)
- 🔧 Recommandations de produits de technologie d'assistance

**Essayez de poser des questions plus spécifiques:**
- "Quels appareils aident les malvoyants à lire?"
- "Combien coûtent les appareils auditifs?"

Je suis prêt à consulter sur la **technologie d'assistance** à tout moment! 😊`;

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

  // Check if query is asking about medical symptoms (for redirect)
  private containsMedicalSymptomQuestion(query: string): boolean {
    return MEDICAL_SYMPTOM_QUESTION_PATTERNS.some(pattern => pattern.test(query));
  }

  // Check if query is an AT consultation (already know condition, asking about devices)
  private isATConsultation(query: string): boolean {
    return AT_CONSULTATION_PATTERNS.some(pattern => pattern.test(query));
  }

  // Get response for symptom questions
  private getSymptomQuestionResponse(language: string): string {
    return SYMPTOM_QUESTION_RESPONSES[language as keyof typeof SYMPTOM_QUESTION_RESPONSES] || SYMPTOM_QUESTION_RESPONSES['en'];
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

    // Step 2b: Check for medical symptom questions (redirect to medical professional)
    // Only redirect if it's NOT an AT consultation (i.e., asking "do I have X?" not "I have X, what devices help?")
    if (this.containsMedicalSymptomQuestion(query) && !this.isATConsultation(query)) {
      console.warn('⚠️ Guardrails: Medical symptom question detected (not AT consultation)');
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: this.getSymptomQuestionResponse(language),
        detectedPattern: 'medical_symptom_question',
        suggestedTopic: 'assistive_technology',
      };
    }

    // Step 3: Check out of scope
  const outOfScope = this.checkOutOfScope(query);
  if (outOfScope) {
    console.warn(`⚠️ Guardrails: Out of scope (${outOfScope.type})`);
    // Use full localized response
    const outOfScopeResponses: Record<string, string> = {
      vi: OUT_OF_SCOPE_RESPONSE_VI,
      en: OUT_OF_SCOPE_RESPONSE_EN,
      ar: OUT_OF_SCOPE_RESPONSE_AR,
      fr: OUT_OF_SCOPE_RESPONSE_FR,
    };
    return {
      isSafe: false,
      shouldRedirect: true,
      redirectResponse: outOfScopeResponses[language] || OUT_OF_SCOPE_RESPONSE_EN,
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

    // Deduct for medical symptom questions (not AT consultation)
    if (this.containsMedicalSymptomQuestion(query) && !this.isATConsultation(query)) score -= 30;

    // Deduct for out-of-scope
    if (this.checkOutOfScope(query)) score -= 30;

    // Deduct for harmful content
    if (this.detectHarmfulContent(query)) score -= 50;

    // Bonus for AT-related keywords
    if (this.detectATIntent(query)) score += 10;

    // Bonus for AT consultation patterns
    if (this.isATConsultation(query)) score += 15;

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
