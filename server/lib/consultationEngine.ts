/**
 * Consultation Engine
 * Hệ thống tư vấn sản phẩm với hỏi lại khách hàng
 * 
 * Tính năng:
 * 1. Phân tích yêu cầu ban đầu của khách hàng
 * 2. Sinh câu hỏi follow-up để làm rõ nhu cầu
 * 3. Thu thập thông tin qua nhiều lượt hỏi
 * 4. Đề xuất sản phẩm phù hợp nhất dựa trên tất cả thông tin
 */

import { ragEngine } from './rag/ragEngine';

// Language-specific question templates
interface FollowUpTemplate {
  condition: string;      // regex pattern to match condition keywords
  questions: {
    vi: string[];
    en: string[];
    ar: string[];
    fr: string[];
  };
}

const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  // Đau/痛/Pain
  {
    condition: '(đau|đau đớn|đau nhức|khó chịu|đau chỗ|chỗ đau)',
    questions: {
      vi: [
        '🤔 Bạn đau ở vị trí nào trên cơ thể? (đầu, cổ, lưng, chân, tay...)',
        '💡 Mức độ đau như thế nào? (nhẹ, vừa, nặng)',
        '⏰ Đau khi nào? (khi vận động, khi nghỉ, cả ngày...)'
      ],
      en: [
        '🤔 Where exactly does it hurt? (head, neck, back, legs, arms...)',
        '💡 How severe is the pain? (mild, moderate, severe)',
        '⏰ When does it hurt? (during movement, at rest, all day...)'
      ],
      ar: [
        '🤔 أين تشعر بالألم بالضبط؟ (الرأس، الرقبة، الظهر، الساقين، الذراعين...)',
        '💡 ما مدى شدة الألم؟ (خفيف، متوسط، شديد)',
        '⏰ متى يحدث الألم؟ (أثناء الحركة، في الراحة، طوال اليوم...)'
      ],
      fr: [
        '🤔 Où exactement avez-vous mal ? (tête, cou, dos, jambes, bras...)',
        '💡 Quelle est l\'intensité de la douleur ? (légère, modérée, forte)',
        '⏰ Quand avez-vous mal ? (pendant le mouvement, au repos, toute la journée...)'
      ]
    }
  },
  // Khó nghe/听力/Hearing
  {
    condition: '(khó nghe|nghe kém|điếc|thính|nghe không rõ|khiếm thính)',
    questions: {
      vi: [
        '👂 Mức độ khó nghe của bạn như thế nào? (nghe kém nhẹ, trung bình, nặng)',
        '💬 Bạn có gặp khó khăn khi nghe trong môi trường ồn ào không?',
        '🎧 Bạn đã từng sử dụng thiết bị hỗ trợ nghe chưa?'
      ],
      en: [
        '👂 What is your hearing ability level? (mild, moderate, severe hearing loss)',
        '💬 Do you have difficulty hearing in noisy environments?',
        '🎧 Have you ever used hearing assistive devices before?'
      ],
      ar: [
        '👂 ما هو مستوى قدرتك على السمع؟ (ضعف سمع خفيف، متوسط، شديد)',
        '💬 هل تجد صعوبة في السمع في البيئات الصاخبة؟',
        '🎧 هل استخدمت أي أجهزة مساعدة للسمع من قبل؟'
      ],
      fr: [
        '👂 Quel est votre niveau d\'audition ? (perte auditive légère, modérée, sévère)',
        '💬 Avez-vous des difficultés à entendre dans les environnements bruyants ?',
        '🎧 Avez-vous déjà utilisé des appareils auditifs auparavant ?'
      ]
    }
  },
  // Khó nhìn/视力/Vision
  {
    condition: '(khó nhìn|mù|thị lực kém|khiếm thị|thị giác|blind)',
    questions: {
      vi: [
        '👁️ Mức độ khó nhìn của bạn như thế nào? (nhìn mờ, nhìn hạn chế, không nhìn được)',
        '📖 Bạn có cần hỗ trợ để đọc sách hoặc tài liệu không?',
        '🏠 Bạn có gặp khó khăn khi di chuyển trong nhà hoặc ngoài đường không?'
      ],
      en: [
        '👁️ What is your vision impairment level? (blurred vision, limited sight, no vision)',
        '📖 Do you need assistance reading books or documents?',
        '🏠 Do you have difficulty moving around at home or outdoors?'
      ],
      ar: [
        '👁️ ما هو مستوى ضعف بصرك؟ (رؤية ضبابية، رؤية محدودة، عدم الرؤية)',
        '📖 هل تحتاج إلى مساعدة في قراءة الكتب أو المستندات؟',
        '🏠 هل تجد صعوبة في التنقل في المنزل أو في الخارج؟'
      ],
      fr: [
        '👁️ Quel est votre niveau de déficience visuelle ? (vision floue, vue limitée, pas de vision)',
        '📖 Avez-vous besoin d\'aide pour lire des livres ou des documents ?',
        '🏠 Avez-vous des difficultés à vous déplacer à la maison ou à l\'extérieur ?'
      ]
    }
  },
  // Khó di chuyển/移动/Mobility
  {
    condition: '(di chuyển|xe lăn|nạng|gậy|walker|wheelchair|vận động)',
    questions: {
      vi: [
        '🦽 Bạn cần hỗ trợ di chuyển trong nhà, ngoài đường, hay cả hai?',
        '🏃 Bạn có thể đứng và đi được một đoạn ngắn không?',
        '⚖️ Cân nặng của bạn khoảng bao nhiêu? (để chọn thiết bị phù hợp)'
      ],
      en: [
        '🦽 Do you need mobility assistance indoors, outdoors, or both?',
        '🏃 Can you stand and walk short distances?',
        '⚖️ What is your weight? (to select appropriate equipment)'
      ],
      ar: [
        '🦽 هل تحتاج إلى مساعدة في التنقل داخل المنزل أو خارجه أم كليهما؟',
        '🏃 هل يمكنك الوقوف والمشي لمسافات قصيرة؟',
        '⚖️ كم وزنك؟ (لاختيار الجهاز المناسب)'
      ],
      fr: [
        '🦽 Avez-vous besoin d\'aide à la mobilité à l\'intérieur, à l\'extérieur, ou les deux ?',
        '🏃 Pouvez-vous vous lever et marcher sur de courtes distances ?',
        '⚖️ Quel est votre poids ? (pour sélectionner l\'équipement approprié)'
      ]
    }
  },
  // Khó giao tiếp/沟通/Communication
  {
    condition: '(giao tiếp|nói| Speech|communication|aac|nói không ra)',
    questions: {
      vi: [
        '💬 Bạn có thể nói được không? (nói được ít, nói không rõ, không nói được)',
        '🖊️ Bạn có thể viết hoặc sử dụng tay không?',
        '👀 Bạn có thể sử dụng mắt để điều khiển thiết bị không?'
      ],
      en: [
        '💬 Can you speak? (a little, unclear speech, cannot speak)',
        '🖊️ Can you write or use your hands?',
        '👀 Can you use your eyes to control a device?'
      ],
      ar: [
        '💬 هل تستطيع الكلام؟ (قليلاً، كلام غير واضح، لا تستطيع الكلام)',
        '🖊️ هل يمكنك الكتابة أو استخدام يديك؟',
        '👀 هل يمكنك استخدام عينيك للتحكم في جهاز؟'
      ],
      fr: [
        '💬 Pouvez-vous parler ? (un peu, discours peu clair, ne peut pas parler)',
        '🖊️ Pouvez-vous écrire ou utiliser vos mains ?',
        '👀 Pouvez-vous utiliser vos yeux pour contrôler un appareil ?'
      ]
    }
  },
  // Trẻ em/Children
  {
    condition: '(trẻ|con|em bé|bé|child|kid|children)',
    questions: {
      vi: [
        '👶 Độ tuổi của trẻ là bao nhiêu?',
        '📚 Trẻ có đang đi học không? (mầm non, tiểu học, trung học...)',
        '🎮 Trẻ có khả năng sử dụng thiết bị điện tử không?'
      ],
      en: [
        '👶 How old is the child?',
        '📚 Is the child currently in school? (preschool, elementary, secondary...)',
        '🎮 Can the child use electronic devices?'
      ],
      ar: [
        '👶 كم عمر الطفل؟',
        '📚 هل الطفل يذهب إلى المدرسة حالياً؟ (ما قبل المدرسة، الابتدائية، الثانوية...)',
        '🎮 هل يستطيع الطفل استخدام الأجهزة الإلكترونية؟'
      ],
      fr: [
        '👶 Quel âge a l\'enfant ?',
        '📚 L\'enfant va-t-il à l\'école ? (maternelle, primaire, secondaire...)',
        '🎮 L\'enfant peut-il utiliser des appareils électroniques ?'
      ]
    }
  },
  // Người già/Elderly
  {
    condition: '(già|ông|bà|elder|elderly|người cao tuổi|older)',
    questions: {
      vi: [
        '👴 Người cao tuổi bao nhiêu tuổi?',
        '💊 Có đang dùng thuốc gì có thể ảnh hưởng không? (thính giác, thị giác...)',
        '🏠 Người cao tuổi sống một mình hay có người chăm sóc?'
      ],
      en: [
        '👴 How old is the elderly person?',
        '💊 Are they taking any medications that might affect? (hearing, vision...)',
        '🏠 Does the elderly person live alone or with a caregiver?'
      ],
      ar: [
        '👴 كم عمر الشخص المسن؟',
        '💊 هل يتناول أدوية قد تؤثر على؟ (السمع، البصر...)',
        '🏠 هل يعيش الشخص المسن بمفرده أم مع مقدم رعاية؟'
      ],
      fr: [
        '👴 Quel âge a la personne âgée ?',
        '💊 Prend-elle des médicaments qui pourraient affecter ? (audition, vision...)',
        '🏠 La personne âgée vit-elle seule ou avec un aidant ?'
      ]
    }
  }
];

// Consultation session storage
interface ConsultationAnswer {
  question: string;
  answer: string;
  timestamp: string;
}

interface ConsultationSession {
  id: string;
  userMessage: string;
  language: string;
  answers: ConsultationAnswer[];
  currentPhase: 'initial' | 'gathering' | 'recommending';
  questionsAsked: number;
  category?: string;
  createdAt: string;
}

// In-memory storage (in production, use Redis or DB)
const consultationSessions = new Map<string, ConsultationSession>();

/**
 * Detect category from user message
 */
function detectCategory(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  
  const categoryPatterns: Record<string, string[]> = {
    hearing: ['deaf', 'hear', 'ear', 'sound', 'điếc', 'thính', 'thính giác', 'hearing loss', 'audio', 'fm system', 'سماعة', 'سمع'],
    vision: ['blind', 'visual', 'eye', 'sight', 'mắt', 'thị giác', 'blindness', 'low vision', 'braille', 'أعمى', 'بصر'],
    mobility: ['wheelchair', 'walk', 'move', 'physical', 'mobility', 'vận động', 'di chuyển', 'xe lăn', 'كرسي متحرك'],
    communication: ['speak', 'talk', 'communicate', 'voice', 'speech', 'giao tiếp', 'ngôn ngữ', 'aac', 'تكلم', 'كلام'],
    cognition: ['memory', 'learn', 'cognitive', 'think', 'nhận thức', 'học tập', 'memoria', 'aprendizaje'],
    daily_living: ['daily', 'living', 'self-care', 'sinh hoạt', 'ăn uống', 'daily living', 'vêtir'],
  };
  
  for (const [category, keywords] of Object.entries(categoryPatterns)) {
    if (keywords.some(kw => lowerMsg.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  
  return null;
}

/**
 * Get follow-up questions based on detected category and condition
 * Priority: 1. Explicit botCategory from frontend (context-aware) 2. Template matching 3. Category fallback
 */
function getFollowUpQuestions(category: string | null, message: string, language: string): string[] {
  const lang = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  
  // If we have an explicit category from bot context (vision/hearing/etc), prioritize it
  // This ensures Vision bot asks Vision questions, Hearing bot asks Hearing questions
  // This prevents generic templates (like elderly) from overriding the bot's domain
  if (category && ['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living'].includes(category)) {
    const categoryQuestions: Record<string, Record<string, string[]>> = {
      hearing: {
        vi: [
          '👂 Bạn gặp vấn đề về thính giác từ khi nào?',
          '💬 Bạn có hay phải xin người khác nhắc lại không?',
          '🎧 Bạn có thường xuyên tiếp xúc với tiếng ồn không?'
        ],
        en: [
          '👂 How long have you had hearing difficulties?',
          '💬 Do you often ask others to repeat themselves?',
          '🎧 Are you regularly exposed to loud noises?'
        ],
        ar: [
          '👂 منذ متى وأنت تعاني من صعوبات في السمع؟',
          '💬 هل تطلب من الآخرين تكرار ما قالوه غالباً؟',
          '🎧 هل تتعرض بانتظام للضوضاء العالية؟'
        ],
        fr: [
          '👂 Depuis combien de temps avez-vous des difficultés auditives ?',
          '💬 Demandez-vous souvent aux autres de se répéter ?',
          '🎧 Êtes-vous régulièrement exposé(e) à des bruits forts ?'
        ]
      },
      vision: {
        vi: [
          '👁️ Vấn đề thị giác của bạn xuất hiện từ khi nào?',
          '📖 Bạn có gặp khó khăn khi đọc chữ nhỏ không?',
          '🌙 Bạn có gặp khó khăn khi nhìn vào ban đêm không?'
        ],
        en: [
          '👁️ When did your vision problems start?',
          '📖 Do you have difficulty reading small text?',
          '🌙 Do you have difficulty seeing at night?'
        ],
        ar: [
          '👁️ متى بدأت مشاكل البصر لديك؟',
          '📖 هل تجد صعوبة في قراءة النص الصغير؟',
          '🌙 هل تجد صعوبة في الرؤية ليلاً؟'
        ],
        fr: [
          '👁️ Quand vos problèmes de vision ont-ils commencé ?',
          '📖 Avez-vous des difficultés à lire de petits textes ?',
          '🌙 Avez-vous des difficultés à voir la nuit ?'
        ]
      },
      mobility: {
        vi: [
          '🦽 Bạn cần hỗ trợ vận động trong sinh hoạt hàng ngày như thế nào?',
          '🏠 Nhà bạn có nhiều cầu thang không?',
          '🚗 Bạn có cần hỗ trợ khi ra ngoài đường không?'
        ],
        en: [
          '🦽 How much mobility assistance do you need in daily activities?',
          '🏠 Does your home have many stairs?',
          '🚗 Do you need assistance when going outside?'
        ],
        ar: [
          '🦽 كم من المساعدة في الحركة تحتاج في الأنشطة اليومية؟',
          '🏠 هل منزلك يحتوي على العديد من السلالم؟',
          '🚗 هل تحتاج إلى مساعدة عند الخروج؟'
        ],
        fr: [
          '🦽 De combien d\'aide à la mobilité avez-vous besoin dans les activités quotidiennes ?',
          '🏠 Votre maison a-t-elle beaucoup d\'escaliers ?',
          '🚗 Avez-vous besoin d\'aide pour sortir ?'
        ]
      },
      communication: {
        vi: [
          '💬 Bạn gặp khó khăn trong việc giao tiếp như thế nào?',
          '🖊️ Bạn có thể sử dụng thiết bị cảm ứng không?',
          '👀 Bạn có thể điều khiển bằng mắt không?'
        ],
        en: [
          '💬 How do you have difficulty communicating?',
          '🖊️ Can you use touch devices?',
          '👀 Can you control things with your eyes?'
        ],
        ar: [
          '💬 ما هي صعوبة التواصل التي تواجهها؟',
          '🖊️ هل يمكنك استخدام الأجهزة التي تعمل باللمس؟',
          '👀 هل يمكنك التحكم بالأجهزة بالعينين؟'
        ],
        fr: [
          '💬 Comment avez-vous des difficultés à communiquer ?',
          '🖊️ Pouvez-vous utiliser des appareils tactiles ?',
          '👀 Pouvez-vous contrôler des choses avec vos yeux ?'
        ]
      },
      cognition: {
        vi: [
          '🧠 Bạn gặp khó khăn gì về nhận thức? (trí nhớ, tập trung, học tập...)',
          '📋 Bạn có cần nhắc nhở các hoạt động hàng ngày không?',
          '👨‍👩‍👧 Bạn có người hỗ trợ chăm sóc không?'
        ],
        en: [
          '🧠 What cognitive difficulties do you have? (memory, focus, learning...)',
          '📋 Do you need reminders for daily activities?',
          '👨‍👩‍👧 Do you have a caregiver to support you?'
        ],
        ar: [
          '🧠 ما هي الصعوبات المعرفية التي تواجهها؟ (الذاكرة، التركيز، التعلم...)',
          '📋 هل تحتاج إلى تذكيرات للأنشطة اليومية؟',
          '👨‍👩‍👧 هل لديك مقدم رعاية يدعمك؟'
        ],
        fr: [
          '🧠 Quelles difficultés cognitives avez-vous ? (mémoire, concentration, apprentissage...)',
          '📋 Avez-vous besoin de rappels pour les activités quotidiennes ?',
          '👨‍👩‍👧 Avez-vous un aidant pour vous soutenir ?'
        ]
      },
      daily_living: {
        vi: [
          '🏠 Bạn gặp khó khăn gì trong sinh hoạt hàng ngày?',
          '🍽️ Bạn có cần hỗ trợ khi ăn uống, mặc quần áo không?',
          '🛁 Bạn có cần hỗ trợ khi tắm rửa, vệ sinh cá nhân không?'
        ],
        en: [
          '🏠 What daily living activities do you have difficulty with?',
          '🍽️ Do you need assistance with eating or dressing?',
          '🛁 Do you need assistance with bathing or personal hygiene?'
        ],
        ar: [
          '🏠 ما هي أنشطة الحياة اليومية التي تواجه فيها صعوبة؟',
          '🍽️ هل تحتاج إلى مساعدة في الأكل أو ارتداء الملابس؟',
          '🛁 هل تحتاج إلى مساعدة في الاستحمام أو النظافة الشخصية؟'
        ],
        fr: [
          '🏠 Quelles activités de la vie quotidienne vous posent des difficultés ?',
          '🍽️ Avez-vous besoin d\'aide pour manger ou vous habiller ?',
          '🛁 Avez-vous besoin d\'aide pour vous baigner ou l\'hygiène personnelle ?'
        ]
      }
    };
    
    return categoryQuestions[category]?.[lang] || categoryQuestions[category]?.vi || [];
  }
  
  // First, check templates (for specific conditions like pain, hearing loss, etc.)
  for (const template of FOLLOW_UP_TEMPLATES) {
    const regex = new RegExp(template.condition, 'i');
    if (regex.test(message)) {
      return template.questions[lang] || template.questions.vi;
    }
  }
  
  // First, check templates
  const genericQuestions: Record<string, string[]> = {
    vi: [
      '🤔 Bạn có thể cho mình biết thêm chi tiết về nhu cầu của bạn không?',
      '⏰ Vấn đề này ảnh hưởng đến cuộc sống hàng ngày như thế nào?',
      '💼 Bạn có ngân sách giới hạn cho thiết bị không?'
    ],
    en: [
      '🤔 Can you tell me more about your needs?',
      '⏰ How does this issue affect your daily life?',
      '💼 Do you have a budget limit for the device?'
    ],
    ar: [
      '🤔 هل يمكنك إخباري بمزيد من التفاصيل عن احتياجاتك؟',
      '⏰ كيف تؤثر هذه المشكلة على حياتك اليومية؟',
      '💼 هل لديك حد ميزانية للجهاز؟'
    ],
    fr: [
      '🤔 Pouvez-vous m\'en dire plus sur vos besoins ?',
      '⏰ Comment ce problème affecte-t-il votre vie quotidienne ?',
      '💼 Avez-vous une limite de budget pour l\'appareil ?'
    ]
  };
  
  return genericQuestions[lang] || genericQuestions.vi;
}

/**
 * Get context from RAG for better question generation
 * This allows AI to ask questions beyond MADA KB
 */
async function getRAGContextForConsultation(
  userMessage: string,
  category?: string
): Promise<string> {
  try {
    // Query RAG with a focus on getting device categories and general AT info
    const query = category 
      ? `Thiết bị AT danh mục ${category}: ${userMessage}`
      : `Thiết bị công nghệ hỗ trợ: ${userMessage}`;
    
    const ragResponse = await ragEngine.query(query, [], {
      systemInstruction: 'List relevant assistive technology devices and their key characteristics. Focus on device types, not detailed specs.',
      language: 'vi',
      topK: 3,
    });
    
    if (ragResponse.sources && ragResponse.sources.length > 0) {
      // Extract key info from sources
      const deviceInfo = ragResponse.sources
        .slice(0, 2)
        .map((s, i) => {
          const meta = s.metadata || {};
          return `${i + 1}. ${meta.title || 'Thiết bị'}: ${(s.content || '').slice(0, 150)}...`;
        })
        .join('\n');
      
      return `\n\n📦 THIẾT BỊ LIÊN QUAN:\n${deviceInfo}`;
    }
    
    return '';
  } catch (error) {
    console.log('[Consultation] RAG context error:', error);
    return '';
  }
}

/**
 * Generate AI-powered follow-up questions
 */
async function generateAIFollowUpQuestions(
  context: {
    userMessage: string;
    language: string;
    previousQuestions: string[];
    previousAnswers: string[];
    category?: string;
  }
): Promise<string[]> {
  const { userMessage, language, previousQuestions, previousAnswers, category } = context;
  
  // Check if Gemini API is available
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
    // Fallback to template-based questions
    return getFollowUpQuestions(category || detectCategory(userMessage), userMessage, language);
  }
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  
  const langCode = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  
  // Get additional context from RAG (MADA KB)
  const ragContext = await getRAGContextForConsultation(userMessage, category);
  
  const promptTemplates: Record<string, string> = {
    vi: `Bạn là BÁC SĨ TƯ VẤN CHUYÊN NGHIỆP về Công nghệ Hỗ trợ (AT) cho người khuyết tật.
NHIỆM VỤ: Hỏi những câu hỏi CHUYÊN SÂU để hiểu rõ nhu cầu và đề xuất thiết bị PHÙ HỢP NHẤT.

NGỮ CẢNH:
- Câu hỏi ban đầu: "${userMessage}"
- Danh mục phát hiện: ${category || 'chưa xác định'}
${ragContext ? ragContext : ''}

LỊCH SỬ HỎI-ĐÁP:
${previousQuestions.length > 0 ? previousQuestions.map((q, i) => `Q${i + 1}: "${q}"\nA${i + 1}: "${previousAnswers[i] || 'chưa trả lời'}"`).join('\n') : 'Chưa có câu hỏi trước đó'}

YÊU CẦU QUAN TRỌNG:
1. HỎI về TRIỆU CHỨNG: "Bạn gặp khó khăn này từ khi nào? Có tiến triển không?"
2. HỎI về MÔI TRƯỜNG: "Bạn sống ở đâu? Nhà có thang máy không?"
3. HỎI về NGÂN SÁCH: "Bạn có ngân sách giới hạn không? (để mình gợi ý phù hợp)"
4. HỎI về MỤC TIÊU: "Bạn muốn cải thiện điều gì trước tiên?"
5. HỎI về ĐIỀU KIỆN: "Bạn có bệnh lý kèm theo nào không?"

QUY TẮC:
- MỖI câu hỏi phải KHÁC với các câu đã hỏi
- Ưu tiên câu hỏi giúp THU HẸP lựa chọn thiết bị
- Câu hỏi phải CỤ THỂ, không chung chung
- HỎI thêm về CUỘC SỐNG HÀNG NGÀY nếu chưa rõ

CHỈ TRẢ VỀ JSON:
{"questions": ["câu hỏi 1", "câu hỏi 2", "câu hỏi 3"]}
KHÔNG giải thích gì thêm, CHỈ JSON.`,

    en: `You are a PROFESSIONAL AT CONSULTANT specializing in Assistive Technology.
TASK: Ask DEEP QUESTIONS to understand needs and recommend the MOST SUITABLE devices.

CONTEXT:
- Initial question: "${userMessage}"
- Detected category: ${category || 'undetermined'}
${ragContext ? ragContext.replace('📦', '📦').replace('THIẾT BỊ LIÊN QUAN', 'RELATED DEVICES') : ''}

Q&A HISTORY:
${previousQuestions.length > 0 ? previousQuestions.map((q, i) => `Q${i + 1}: "${q}"\nA${i + 1}: "${previousAnswers[i] || 'no answer yet'}"`).join('\n') : 'No previous questions'}

IMPORTANT REQUIREMENTS:
1. ASK about SYMPTOMS: "How long have you experienced this? Is it getting worse?"
2. ASK about ENVIRONMENT: "Where do you live? Does your home have stairs/elevator?"
3. ASK about BUDGET: "Do you have a budget limit? (so I can suggest appropriate options)"
4. ASK about GOALS: "What would you like to improve first?"
5. ASK about CONDITIONS: "Do you have any related medical conditions?"

RULES:
- Each question must be DIFFERENT from previous questions
- Prioritize questions that NARROW DOWN device options
- Questions must be SPECIFIC, not vague
- ASK about DAILY LIFE if not clear yet

RESPOND ONLY IN JSON:
{"questions": ["question 1", "question 2", "question 3"]}
NO explanations, ONLY JSON.`,

    ar: `أنت مستشار محترف للتكنولوجيا المساعدة (AT).
المهمة: اطرح أسئلة عميقة لفهم الاحتياجات والتوصية بالأجهزة الأكثر ملاءمة.

السياق:
- السؤال الأولي: "${userMessage}"
- الفئة المكتشفة: ${category || 'غير محدد'}

سجل الأسئلة والأجوبة:
${previousQuestions.length > 0 ? previousQuestions.map((q, i) => `س${i + 1}: "${q}"\nج${i + 1}: "${previousAnswers[i] || 'لم تتم الإجابة'}"`).join('\n') : 'لا توجد أسئلة سابقة'}

المتطلبات المهمة:
1. اسأل عن الأعراض: متى بدأت هذه المشكلة؟
2. اسأل عن البيئة: أين تعيش؟ هل منزلك به سلالم؟
3. اسأل عن الميزانية: هل لديك حد ميزانية؟
4. اسأل عن الأهداف: ما الذي تريد تحسينه أولاً؟
5. اسأل عن الظروف: هل لديك حالات طبية أخرى؟

الرد JSON فقط:
{"questions": ["السؤال 1", "السؤال 2", "السؤال 3"]}`,

    fr: `Vous êtes un conseiller professionnel en Technologie d'Assistance (TA).
TÂCHE: Posez des questions APPROFONDIES pour comprendre les besoins et recommander les appareils les PLUS ADAPTÉS.

CONTEXTE:
- Question initiale: "${userMessage}"
- Catégorie détectée: ${category || 'non déterminé'}

Historique Q&R:
${previousQuestions.length > 0 ? previousQuestions.map((q, i) => `Q${i + 1}: "${q}"\nR${i + 1}: "${previousAnswers[i] || 'sans réponse'}"`).join('\n') : 'Aucune question précédente'}

EXIGENCES IMPORTANTES:
1. DEMANDEZ sur les SYMPTÔMES: Depuis quand avez-vous ce problème?
2. DEMANDEZ sur l'ENVIRONNEMENT: Où vivez-vous? Votre maison a-t-elle des escaliers?
3. DEMANDEZ sur le BUDGET: Avez-vous une limite de budget?
4. DEMANDEZ sur les OBJECTIFS: Qu'aimeriez-vous améliorer en premier?
5. DEMANDEZ sur les CONDITIONS: Avez-vous d'autres conditions médicales?

Répondez UNIQUEMENT en JSON:
{"questions": ["question 1", "question 2", "question 3"]}`
  };
  
  const prompt = promptTemplates[langCode] || promptTemplates.vi;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.8,  // Tăng temperature để sáng tạo hơn
            maxOutputTokens: 2048  // Tăng để câu hỏi dài hơn
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    responseText = responseText.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
    
    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions.slice(0, 3);
      }
    }
    
    // Fallback
    return getFollowUpQuestions(category || detectCategory(userMessage), userMessage, language);
    
  } catch (error) {
    console.error('[Consultation Engine] AI question generation failed:', error);
    // Fallback to template-based questions
    return getFollowUpQuestions(category || detectCategory(userMessage), userMessage, language);
  }
}

/**
 * Generate product recommendations based on consultation context
 */
async function generateRecommendations(
  sessionId: string,
  language: string
): Promise<{
  recommendations: any[];
  explanation: string;
  confidence: number;
}> {
  const session = consultationSessions.get(sessionId);
  if (!session) {
    return { recommendations: [], explanation: '', confidence: 0 };
  }
  
  const lang = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  
  // Build context from all answers
  const contextText = session.answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
  
  // Create a comprehensive query for RAG
  const ragQuery = `Tìm thiết bị công nghệ hỗ trợ phù hợp.
Yêu cầu: ${session.userMessage}

Thông tin bổ sung:
${contextText}

Danh mục: ${session.category || 'general'}`;
  
  try {
    const ragResponse = await ragEngine.query(ragQuery, [], {
      systemInstruction: `Bạn là chuyên gia tư vấn thiết bị AT. Dựa trên thông tin thu thập được, hãy đề xuất 2-3 thiết bị phù hợp nhất.`,
      language: lang,
      topK: 5,
    });
    
    // Get products from RAG sources
    const recommendations: any[] = [];
    
    if (ragResponse.sources && ragResponse.sources.length > 0) {
      for (const source of ragResponse.sources.slice(0, 3)) {
        const meta = source.metadata || {};
        // Get image URL from metadata (stored by syncKbProducts.ts)
        let imageUrl = '';
        try {
          const parsedMeta = typeof source.metadata === 'string' 
            ? JSON.parse(source.metadata) 
            : (source.metadata || {});
          imageUrl = parsedMeta.thumbnailUrl || parsedMeta.imageUrl || parsedMeta.galleryImages?.[0] || '';
        } catch { /* ignore */ }

        // Apply proxy for MADA images
        let finalImageUrl = '';
        if (imageUrl) {
          if (imageUrl.includes('mada.org.qa') || imageUrl.includes('cdn.at.mada.org.qa')) {
            finalImageUrl = `/api/mada-image?url=${encodeURIComponent(imageUrl)}`;
          } else {
            finalImageUrl = imageUrl;
          }
        }

        recommendations.push({
          id: (meta as any).id || `rec-${recommendations.length}`,
          title: meta.title || 'Thiết bị hỗ trợ',
          description: (source.content || '').slice(0, 200),
          category: session.category || 'general',
          confidence: (source as any).rerankScore || (source as any).score || 0.7,
          source_url: meta.source || '',
          image_url: finalImageUrl,
        });
      }
    }
    
    // Generate explanation
    const explanationTemplates: Record<string, string> = {
      vi: `Dựa trên thông tin bạn cung cấp, đây là những gợi ý thiết bị phù hợp nhất cho nhu cầu của bạn.`,
      en: `Based on the information you provided, here are the most suitable device suggestions for your needs.`,
      ar: `بناءً على المعلومات التي قدمتها، إليك اقتراحات الأجهزة الأكثر ملاءمة لاحتياجاتك.`,
      fr: `Basé sur les informations que vous avez fournies, voici les suggestions d'appareils les plus appropriées pour vos besoins.`
    };
    
    return {
      recommendations,
      explanation: explanationTemplates[lang] || explanationTemplates.vi,
      confidence: ragResponse.confidence || 0.7,
    };
    
  } catch (error) {
    console.error('[Consultation Engine] Recommendation generation failed:', error);
    return { recommendations: [], explanation: '', confidence: 0 };
  }
}

/**
 * Create a new consultation session
 */
export function createConsultationSession(
  userMessage: string,
  language: string
): {
  sessionId: string;
  session: ConsultationSession;
} {
  const sessionId = `consult-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = detectCategory(userMessage);
  
  const session: ConsultationSession = {
    id: sessionId,
    userMessage,
    language,
    answers: [],
    currentPhase: 'initial',
    questionsAsked: 0,
    category: category || undefined,
    createdAt: new Date().toISOString(),
  };
  
  consultationSessions.set(sessionId, session);
  
  return { sessionId, session };
}

/**
 * Get next questions for a consultation session
 */
export async function getConsultationQuestions(
  sessionId: string
): Promise<{
  questions: string[];
  session: ConsultationSession;
}> {
  const session = consultationSessions.get(sessionId);
  if (!session) {
    throw new Error('Consultation session not found');
  }
  
  // Get previous questions and answers
  const previousQuestions = session.answers.map(a => a.question);
  const previousAnswers = session.answers.map(a => a.answer);
  
  // Generate AI-powered questions or use templates
  const questions = await generateAIFollowUpQuestions({
    userMessage: session.userMessage,
    language: session.language,
    previousQuestions,
    previousAnswers,
    category: session.category,
  });
  
  // Limit to 2-3 questions
  const selectedQuestions = questions.slice(0, 3);
  
  // Update session
  session.currentPhase = 'gathering';
  session.questionsAsked += selectedQuestions.length;
  
  return {
    questions: selectedQuestions,
    session,
  };
}

/**
 * Process user's answer to a consultation question
 */
export function recordConsultationAnswer(
  sessionId: string,
  question: string,
  answer: string
): ConsultationSession {
  const session = consultationSessions.get(sessionId);
  if (!session) {
    throw new Error('Consultation session not found');
  }
  
  session.answers.push({
    question,
    answer,
    timestamp: new Date().toISOString(),
  });
  
  consultationSessions.set(sessionId, session);
  
  return session;
}

/**
 * Check if consultation should move to recommendation phase
 * Returns true if enough questions have been asked (3-5) or user indicates readiness
 */
export function shouldRecommend(
  sessionId: string,
  userReady?: boolean
): boolean {
  const session = consultationSessions.get(sessionId);
  if (!session) return false;
  
  // User explicitly says they're ready
  if (userReady) return true;
  
  // Enough questions asked
  if (session.answers.length >= 3) return true;
  
  // Category detected and at least 2 answers
  if (session.category && session.answers.length >= 2) return true;
  
  return false;
}

/**
 * Complete consultation and generate final recommendations
 */
export async function completeConsultation(
  sessionId: string
): Promise<{
  session: ConsultationSession;
  recommendations: any[];
  explanation: string;
  confidence: number;
}> {
  const session = consultationSessions.get(sessionId);
  if (!session) {
    throw new Error('Consultation session not found');
  }
  
  session.currentPhase = 'recommending';
  consultationSessions.set(sessionId, session);
  
  const { recommendations, explanation, confidence } = await generateRecommendations(sessionId, session.language);
  
  return {
    session,
    recommendations,
    explanation,
    confidence,
  };
}

/**
 * Get consultation session by ID
 */
export function getConsultationSession(sessionId: string): ConsultationSession | null {
  return consultationSessions.get(sessionId) || null;
}

/**
 * Clear consultation session
 */
export function clearConsultationSession(sessionId: string): boolean {
  return consultationSessions.delete(sessionId);
}

/**
 * Get consultation session status
 */
export function getConsultationStatus(sessionId: string): {
  exists: boolean;
  phase?: 'initial' | 'gathering' | 'recommending';
  answersCount?: number;
  questionsAsked?: number;
} {
  const session = consultationSessions.get(sessionId);
  if (!session) {
    return { exists: false };
  }
  
  return {
    exists: true,
    phase: session.currentPhase,
    answersCount: session.answers.length,
    questionsAsked: session.questionsAsked,
  };
}

export { detectCategory, getFollowUpQuestions };
