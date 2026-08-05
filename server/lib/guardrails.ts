/**
 * MADA AI Guardrails System
 * 
 * Lớp kiểm duyệt nội dung để:
 * 1. Từ chối chẩn đoán y khoa
 * 2. Chuyển hướng câu hỏi về AT solutions
 * 3. Đảm bảo phạm vi hoạt động
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Medical-related patterns to detect and block
const MEDICAL_DIAGNOSIS_PATTERNS = [
  // Vietnamese patterns
  /\b(chẩn đoán|chuan đoán|bệnh|gây ra|bệnh lý|biến chứng|triệu chứng)\b.*\b(nặng|nhẹ|nguy hiểm|cấp tính|mãn tính)\b/i,
  /\b(tôi bị|tôi có|dấu hiệu|có phải là|mắc)\b.*\b(bệnh|ung thư|tiểu đường|cao huyết áp|tim mạch)\b/i,
  /\b(thuốc|điều trị|chữa trị|uống thuốc|liều lượng)\b.*\b(gì|không|nào|bao nhiêu)\b/i,
  /\b(bác sĩ|bệnh viện|phẫu thuật|đi khám|xét nghiệm)\b/i,
  /\b(máu|đường huyết|huyết áp|cholesterol|vitamin|khoáng chất)\b/i,
  
  // English patterns
  /\b(diagnos|diagnostic|medical|diagnosis|prognosis|disease|symptoms)\b.*\b(serious|severe|cancer|diabetes|heart|terminal)\b/i,
  /\b(treatment|medication|prescription|dosage|surgery|chemotherapy)\b/i,
  /\b(blood pressure|sugar|cholesterol|vitamin|deficiency)\b/i,
  
  // Arabic patterns
  /\b(تشخيص|مرض|علاج|دواء|عملية|سرطان|سكري)\b/i,
  
  // French patterns
  /\b(diagnostic|médical|maladie|traitement|médicament|opération)\b/i,
];

// AT-related keywords to identify user needs
const AT_KEYWORDS = [
  'thiết bị', 'công nghệ hỗ trợ', 'máy', 'dụng cụ', 'phần mềm', '工具', 'app', 'ứng dụng',
  'đọc màn hình', 'phóng to', 'xe lăn', 'máy trợ thính', 'kính', 'màn hình braille',
  'wheelchair', 'hearing aid', 'screen reader', 'magnifier', 'braille', 'prosthetic',
  'khiếm thị', 'điếc', 'câm', 'liệt', 'tự kỷ', 'down syndrome', 'mù', 'điếc',
  'blind', 'deaf', 'mute', 'paralyzed', 'autism', 'disability', 'handicap',
  'người già', 'người cao tuổi', 'elderly', 'senior', 'aged',
];

// Redirect responses for medical questions
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

// Out-of-scope patterns
const OUT_OF_SCOPE_PATTERNS = [
  /\b(hack|crack|pirate|illegal|crime|weapon)\b/i,
  /\b(machine learning|train model|create ai|build chatbot)\b/i,
  /\b(code|programming|software development|app development)\b/i,
  /\b(finance|invest|stock|crypto|trading)\b/i,
  /\b(gaming|gamble|casino|betting)\b/i,
];

export interface GuardrailsResult {
  isSafe: boolean;
  shouldRedirect: boolean;
  redirectResponse?: string;
  detectedPattern?: string;
  suggestedTopic?: string;
}

export class GuardrailsSystem {
  private genAI: GoogleGenerativeAI | null = null;
  private isConfigured = false;

  initialize(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.isConfigured = true;
    }
  }

  /**
   * Check if the user query contains medical diagnosis requests
   */
  private containsMedicalDiagnosis(query: string): boolean {
    return MEDICAL_DIAGNOSIS_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Check if the user query is out of scope
   */
  private isOutOfScope(query: string): boolean {
    return OUT_OF_SCOPE_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Detect if user is asking about AT-related needs
   */
  detectATIntent(query: string): boolean {
    const queryLower = query.toLowerCase();
    return AT_KEYWORDS.some(keyword => queryLower.includes(keyword.toLowerCase()));
  }

  /**
   * Analyze query and determine if it should be handled by guardrails
   */
  analyzeQuery(
    query: string,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi'
  ): GuardrailsResult {
    // Check for medical diagnosis requests
    if (this.containsMedicalDiagnosis(query)) {
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: MEDICAL_REDIRECT_RESPONSES[language] || MEDICAL_REDIRECT_RESPONSES['en'],
        detectedPattern: 'medical_diagnosis',
        suggestedTopic: 'assistive_technology',
      };
    }

    // Check for out-of-scope requests
    if (this.isOutOfScope(query)) {
      return {
        isSafe: false,
        shouldRedirect: true,
        redirectResponse: language === 'vi' 
          ? `⚠️ **Câu hỏi nằm ngoài phạm vi tư vấn**

Tôi là MADA AI Assistant chuyên về **Công nghệ Hỗ trợ**. Câu hỏi của bạn không thuộc lĩnh vực tôi có thể hỗ trợ.

Vui lòng hỏi về:
- Thiết bị AT cho người khuyết tật
- Tiêu chuẩn accessibility
- Giải pháp công nghệ hỗ trợ`
          : `⚠️ **Out of Scope**

I'm MADA AI Assistant, specialized in **Assistive Technology**. Your question is outside my area of expertise.

Please ask about:
- AT devices for people with disabilities
- Accessibility standards
- Assistive technology solutions`,
        detectedPattern: 'out_of_scope',
        suggestedTopic: 'assistive_technology',
      };
    }

    // Query is safe to process
    return {
      isSafe: true,
      shouldRedirect: false,
    };
  }

  /**
   * Enhanced content generation with safety checks
   */
  async generateWithGuardrails(
    query: string,
    context: string,
    _conversationHistory: Array<{ role: string; content: string }>,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi'
  ): Promise<string> {
    // Analyze query first
    const analysis = this.analyzeQuery(query, language);
    
    if (!analysis.isSafe && analysis.shouldRedirect) {
      return analysis.redirectResponse!;
    }

    // If configured with Gemini, use enhanced generation
    if (this.isConfigured && this.genAI) {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
      });

      const enhancedPrompt = `${context}

---

## Safety Reminder:
- Do NOT provide medical diagnosis
- Do NOT prescribe medications
- If user asks about medical issues, redirect to AT solutions
- Focus on Assistive Technology recommendations`;

      try {
        const result = await model.generateContent(enhancedPrompt);
        return result.response.text();
      } catch (error) {
        console.error('Guardrails generation error:', error);
        return context;
      }
    }

    // Fallback to provided context
    return context;
  }

  /**
   * Validate response before sending to user
   */
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

  /**
   * Get safety score for logging/monitoring
   */
  calculateSafetyScore(query: string): number {
    let score = 100; // Start with max score

    // Deduct for medical patterns
    if (this.containsMedicalDiagnosis(query)) {
      score -= 50;
    }

    // Deduct for out-of-scope patterns
    if (this.isOutOfScope(query)) {
      score -= 30;
    }

    // Bonus for AT-related keywords
    if (this.detectATIntent(query)) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Singleton instance
export const guardrails = new GuardrailsSystem();

// Initialize guardrails
if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
  guardrails.initialize();
}
