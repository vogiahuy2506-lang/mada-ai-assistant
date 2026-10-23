// User Roles
export type UserRole = 'admin' | 'super_admin' | 'data_manager' | 'expert' | 'user';

// Plan tier for paywall
export type UserPlan = 'free' | 'pro' | 'enterprise';

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  plan: UserPlan;
  quotaUsed: number;
  quotaLimit: number; // -1 = unlimited
  provider?: 'email' | 'google';
  createdAt: Date;
  lastLogin?: Date;
}

// Assistive Technology Categories (ISO 9999)
export type ATCategory = 
  | 'vision'           // Thiết bị thị giác
  | 'hearing'          // Thiết bị nghe
  | 'mobility'         // Thiết bị vận động
  | 'cognition'        // Thiết bị nhận thức
  | 'communication'   // Thiết bị giao tiếp
  | 'daily_living'    // Hỗ trợ sinh hoạt
  | 'education';      // Giáo dục

// Product/Equipment
export interface Product {
  id: string;
  name: string;
  nameVi: string;
  nameEn: string;
  description: string;
  descriptionVi: string;
  descriptionEn: string;
  category: ATCategory;
  image?: string;
  specifications: Record<string, string>;
  isoStandard?: string;
  wcagStandard?: string;
  whoStandard?: string;
  madaPortalUrl?: string;
  priceRange?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Knowledge Base Entry
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  sourceType: 'website' | 'pdf' | 'doc' | 'manual';
  category: ATCategory;
  standards: {
    iso?: string;
    wcag?: string;
    who?: string;
  };
  embeddings?: number[];
  createdAt: Date;
  updatedAt: Date;
}

// Chat Message
export interface Source {
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  products?: Product[];
  standards?: string[];
  consultationId?: string;
  sources?: Source[];
  contextUsed?: boolean;
  attachments?: { name: string; type: string; preview?: string }[];
  suggestedProducts?: SuggestedProduct[];
}

// Suggested Product from AI recommendations
export interface SuggestedProduct {
  id: string;
  title: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  category: string;
  brand?: string;
  price_range?: string;
  product_url?: string;
  image_url?: string;
  source_url?: string;
  features?: string[];
  standards?: string[];
  rating?: number;
  review_count?: number;
  availability?: string;
  match_reason?: string;
  confidence?: number;
  // Chi tiết sản phẩm
  patient_indications?: string[]; // Chỉ định cho bệnh nhân
  medical_indications?: string[]; // Chỉ định y khoa
  contraindications?: string[]; // Chống chỉ định
  specifications?: { label: string; value: string }[]; // Thông số kỹ thuật
  compatibility?: string[]; // Tương thích với
  financial_support?: string[]; // Hỗ trợ tài chính
  insurance_coverage?: string[]; // Bảo hiểm chi trả
  mada_advice?: string; // Lời khuyến từ MADA
  warranty?: string; // Bảo hành
  /**
   * ⭐ HẢI ĐẾN ĐÚNG 1 SẢN PHẨM mà user nêu tên.
   * Frontend dùng cờ này để đổi câu dẫn: "Tôi đang có sản phẩm này…" thay vì
   * "Với các biểu hiện của bạn…". Cờ do server gắn, không phải bot tự nói.
   */
  isSpecificProduct?: boolean;
}

// Consultation Request
export interface ConsultationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  content: string;
  aiResponse?: string;
  expertResponse?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

// System Statistics
export interface SystemStats {
  totalUsers: number;
  totalDocuments: number;
  totalQueries: number;
  averageAccuracy: number;
  averageResponseTime: number;
  storageUsed: number;
  storageLimit: number;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// RAG Query
export interface RAGQuery {
  query: string;
  category?: ATCategory;
  language?: 'vi' | 'en' | 'ar' | 'fr';
  maxResults?: number;
}

// RAG Response
export interface RAGResponse {
  answer: string;
  confidence: number;
  products: Product[];
  standards: string[];
  sources: string[];
}

// Data Collection Task
export interface DataCollectionTask {
  id: string;
  type: 'website' | 'file';
  url?: string;
  status: 'pending' | 'scraping' | 'cleaning' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: KnowledgeEntry[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Notification
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Language
export type Language = 'vi' | 'en' | 'ar' | 'fr';

// View Mode - End-User Mode vs AT Specialist Mode
export type ViewMode = 'end_user' | 'at_specialist';

export const VIEW_MODE_INFO: Record<ViewMode, { name: string; nameVi: string; nameEn: string; icon: string; description: string }> = {
  end_user: {
    name: 'End-User',
    nameVi: 'Người dùng thường',
    nameEn: 'End-User Mode',
    icon: 'person',
    description: 'Chế độ thân thiện, dễ hiểu cho người dùng phổ thông',
  },
  at_specialist: {
    name: 'AT Specialist',
    nameVi: 'Chuyên gia AT',
    nameEn: 'AT Specialist Mode',
    icon: 'engineering',
    description: 'Chế độ chuyên sâu với tiêu chuẩn ISO/WCAG/WHO GATE',
  },
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

// Sample Questions cho từng category, view mode VÀ language
export const SAMPLE_QUESTIONS: Record<ATCategory, Record<ViewMode, Record<Language, string[]>>> = {
  vision: {
    end_user: {
      vi: [
        'Máy đọc màn hình nào tốt nhất cho người Việt?',
        'Làm sao để sử dụng phóng to trên điện thoại?',
        'Có ứng dụng nào đọc chữ trên đồ vật không?',
        'Tôi bị glaucoma có dùng được thiết bị gì?',
      ],
      en: [
        'What is the best screen reader for Vietnamese users?',
        'How to use magnification on my phone?',
        'Are there apps that read text on objects?',
        'I have glaucoma, what devices can help?',
      ],
      ar: [
        'ما هو أفضل قارئ شاشة للمستخدمين الفيتناميين؟',
        'كيفية استخدام التكبير على هاتفي؟',
        'هل توجد تطبيقات تقرأ النص على الأشياء؟',
        'أعاني من الجلوكوما، ما هي الأجهزة التي يمكن أن تساعد؟',
      ],
      fr: [
        'Quel est le meilleur lecteur d\'écran pour les utilisateurs vietnamiens?',
        'Comment utiliser la loupe sur mon téléphone?',
        'Existe-t-il des applications qui lisent le texte sur les objets?',
        'J\'ai un glaucome, quels appareils peuvent m\'aider?',
      ],
    },
    at_specialist: {
      vi: [
        'So sánh JAWS vs NVDA - ưu nhược điểm?',
        'Tiêu chuẩn WCAG 2.2 yêu cầu gì cho hỗ trợ thị giác?',
        'Thiết bị hỗ trợ cho người mù màu?',
        'Hướng dẫn cài đặt VoiceOver trên macOS?',
      ],
      en: [
        'JAWS vs NVDA comparison - pros and cons?',
        'What does WCAG 2.2 require for vision support?',
        'Assistive devices for color blind users?',
        'VoiceOver setup guide on macOS?',
      ],
      ar: [
        'مقارنة JAWS مقابل NVDA - المزايا والعيوب؟',
        'ماذا يتطلب WCAG 2.2 لدعم البصر؟',
        'الأجهزة المساعدة للمستخدمين المكفوفين عن الألوان؟',
        'دليل إعداد VoiceOver على macOS؟',
      ],
      fr: [
        'Comparaison JAWS vs NVDA - avantages et inconvénients?',
        'Que demande WCAG 2.2 pour le support visuel?',
        'Appareils d\'assistance pour les daltoniens?',
        'Guide de configuration VoiceOver sur macOS?',
      ],
    },
  },
  hearing: {
    end_user: {
      vi: [
        'Máy trợ thính có những loại nào và giá bao nhiêu?',
        'Làm sao để chọn máy trợ thính phù hợp cho người cao tuổi?',
        'Thiết bị phản hồi âm thanh hoạt động như thế nào?',
        'Máy trợ thính có kết nối Bluetooth được không?',
      ],
      en: [
        'What types of hearing aids are available and how much do they cost?',
        'How to choose the right hearing aid for elderly people?',
        'How do assistive listening devices work?',
        'Can hearing aids connect via Bluetooth?',
      ],
      ar: [
        'ما هي أنواع سماعات الأذن المتاحة وكم تكلف؟',
        'كيف تختار سماعة الأذن المناسبة لكبار السن؟',
        'كيف تعمل أجهزة الاستماع المساعدة؟',
        'هل يمكن توصيل سماعات الأذن عبر البلوتوث؟',
      ],
      fr: [
        'Quels types d\'aides auditives sont disponibles et combien coûtent-elles?',
        'Comment choisir l\'aide auditive appropriée pour les personnes âgées?',
        'Comment fonctionnent les dispositifs d\'écoute assistée?',
        'Les aides auditives peuvent-elles se connecter en Bluetooth?',
      ],
    },
    at_specialist: {
      vi: [
        'Phân tích tiêu chuẩn IEC 60118-4 cho hệ thống FM?',
        'So sánh công nghệ BTE vs CIC về gain frequency response',
        'Hướng dẫn cài đặt Roger FM system cho classroom',
        'Đặc điểm kỹ thuật Cochlear Implant theo ISO 9999:22.09',
      ],
      en: [
        'Analyze IEC 60118-4 standard for FM systems',
        'Compare BTE vs CIC technology for gain frequency response',
        'Roger FM system setup guide for classroom environments',
        'Cochlear Implant technical specifications per ISO 9999:22.09',
      ],
      ar: [
        'تحليل معيار IEC 60118-4 لأنظمة FM',
        'مقارنة تقنية BTE مقابل CIC لاستجابة تردد الكسب',
        'دليل إعداد نظام Roger FM للفصول الدراسية',
        'المواصفات التقنية لزراعة القوقعة وفق ISO 9999:22.09',
      ],
      fr: [
        'Analyser la norme IEC 60118-4 pour les systèmes FM',
        'Comparer les technologies BTE vs CIC pour la réponse en fréquence de gain',
        'Guide d\'installation du système Roger FM pour la salle de classe',
        'Spécifications techniques de l\'implant cochléaire selon ISO 9999:22.09',
      ],
    },
  },
  mobility: {
    end_user: {
      vi: [
        'Xe lăn điện có giá bao nhiêu?',
        'Làm sao để chọn xe lăn phù hợp cho người khuyết tật?',
        'Xe lăn leo cầu thang hoạt động như thế nào?',
        'Nạng và khung đi khác nhau thế nào?',
      ],
      en: [
        'How much does an electric wheelchair cost?',
        'How to choose the right wheelchair for disabled people?',
        'How do stair-climbing wheelchairs work?',
        'What is the difference between crutches and walking frames?',
      ],
      ar: [
        'كم تكلفة الكرسي المتحرك الكهربائي؟',
        'كيف تختار الكرسي المتحرك المناسب للأشخاص ذوي الإعاقة؟',
        'كيف تعمل الكراسي المتحركة صاعدة السلالم؟',
        'ما الفرق بين العكازات وأطر المشي؟',
      ],
      fr: [
        'Combien coûte un fauteuil roulant électrique?',
        'Comment choisir le bon fauteuil roulant pour les personnes handicapées?',
        'Comment fonctionnent les fauteuils roulants grimpeurs d\'escaliers?',
        'Quelle est la différence entre les béquilles et les déambulateurs?',
      ],
    },
    at_specialist: {
      vi: [
        'Tiêu chuẩn ISO 7176 cho xe lăn điện - các test parameters?',
        'So sánh joystick control vs chin control cho người liệt tứ chi',
        'Phân tích safety requirements theo ISO 9999:12.21.15 cho stair climbers',
        'Đặc điểm kỹ thuật microprocessor knee (C-Leg vs Rheo)',
      ],
      en: [
        'ISO 7176 standard for electric wheelchairs - test parameters',
        'Compare joystick vs chin control for users with quadriplegia',
        'Safety requirements analysis per ISO 9999:12.21.15 for stair climbers',
        'Microprocessor knee technical specifications (C-Leg vs Rheo)',
      ],
      ar: [
        'معيار ISO 7176 للكراسي المتحركة الكهربائية - معايير الاختبار',
        'مقارنة التحكم بعصا التحكم مقابل التحكم بالذقن للأشخاص الذين يعانون من الشلل الرباعي',
        'تحليل متطلبات السلامة وفق ISO 9999:12.21.15 لمتسلقي السلالم',
        'المواصفات التقنية للركبة الدقيقة المعالج (C-Leg مقابل Rheo)',
      ],
      fr: [
        'Norme ISO 7176 pour fauteuils roulants électriques - paramètres de test',
        'Comparer le contrôle par joystick vs contrôle par menton pour utilisateurs tétraplégiques',
        'Analyse des exigences de sécurité selon ISO 9999:12.21.15 pour escaladeurs',
        'Spécifications techniques du genou microprocesseur (C-Leg vs Rheo)',
      ],
    },
  },
  cognition: {
    end_user: {
      vi: [
        'Thiết bị hỗ trợ trí nhớ cho người già mang tên gì?',
        'Ứng dụng nhắc nhở thuốc cho người suy giảm trí nhớ?',
        'Lịch kỹ thuật số hỗ trợ người có khó khăn về nhận thức?',
        'Thiết bị giúp sắp xếp công việc hàng ngày?',
      ],
      en: [
        'What are memory aids for elderly people called?',
        'Medication reminder apps for people with memory loss?',
        'Digital calendars for people with cognitive difficulties?',
        'Devices to help organize daily tasks?',
      ],
      ar: [
        'ما اسم أجهزة دعم الذاكرة لكبار السن؟',
        'تطبيقات تذكير بالأدوية للأشخاص الذين يعانون من فقدان الذاكرة؟',
        'التقويمات الرقمية للأشخاص الذين يعانون من صعوبات معرفية؟',
        'أجهزة للمساعدة في تنظيم المهام اليومية؟',
      ],
      fr: [
        'Comment s\'appellent les aides à la mémoire pour les personnes âgées?',
        'Applications de rappel de médicaments pour les personnes atteintes de perte de mémoire?',
        'Calendriers numériques pour les personnes ayant des difficultés cognitives?',
        'Dispositifs pour aider à organiser les tâches quotidiennes?',
      ],
    },
    at_specialist: {
      vi: [
        'Phân tích AAC symbols systems: PCS vs SymbolStix vs Widgit',
        'Tiêu chuẩn ISO 9999:05.15 cho cognitive aids devices',
        'Evidence-based interventions cho người bị chấn thương sọ não sử dụng AT',
        'So sánh SGD devices: Tobii Dynavox vs Prentke Romich features',
      ],
      en: [
        'Analyze AAC symbol systems: PCS vs SymbolStix vs Widgit',
        'ISO 9999:05.15 standard for cognitive aid devices',
        'Evidence-based interventions for users with acquired brain injury using AT',
        'Compare SGD devices: Tobii Dynavox vs Prentke Romich features',
      ],
      ar: [
        'تحليل أنظمة رموز AAC: PCS مقابل SymbolStix مقابل Widgit',
        'معيار ISO 9999:05.15 لأجهزة المساعدة المعرفية',
        'التدخلات القائمة على الأدلة للأشخاص الذين يعانون من إصابات الدماغ المكتسبة باستخدام AT',
        'مقارنة أجهزة SGD: Tobii Dynavox مقابل Prentke Romich',
      ],
      fr: [
        'Analyser les systèmes de symboles AAC: PCS vs SymbolStix vs Widgit',
        'Norme ISO 9999:05.15 pour les aides cognitives',
        'Interventions fondées sur des preuves pour les utilisateurs ayant subi un traumatisme crânien utilisant AT',
        'Comparer les appareils SGD: Tobii Dynavox vs Prentke Romich',
      ],
    },
  },
  communication: {
    end_user: {
      vi: [
        'Thiết bị giao tiếp tăng cường (AAC) là gì?',
        'Bảng giao tiếp bằng hình ảnh hoạt động ra sao?',
        'Ứng dụng giao tiếp cho người không nói được trên điện thoại?',
        'Thiết bị hỗ trợ giao tiếp cho trẻ tự kỷ?',
      ],
      en: [
        'What is Augmentative and Alternative Communication (AAC)?',
        'How do picture communication boards work?',
        'Communication apps for non-verbal people on phones?',
        'Communication aids for children with autism?',
      ],
      ar: [
        'ما هو التواصل المحسن والبديل (AAC)؟',
        'كيف تعمل لوحات التواصل بالصور؟',
        'تطبيقات التواصل للأشخاص غير القادرين على الكلام على الهواتف؟',
        'أجهزة دعم التواصل للأطفال الذين يعانون من التوحد؟',
      ],
      fr: [
        'Qu\'est-ce que la communication améliorée et alternative (CAA)?',
        'Comment fonctionnent les tableaux de communication par images?',
        'Applications de communication pour les personnes non verbales sur téléphone?',
        'Aides à la communication pour enfants autistes?',
      ],
    },
    at_specialist: {
      vi: [
        'So sánh unaided vs aided AAC: Khi nào dùng loại nào?',
        'Phân tích PRD (Pragmatic Rating Dimensions) cho AAC assessment',
        'Tiêu chuẩn ISO 9999:05.15.06 cho SGD devices',
        'Integration strategies cho AAC với mainstream technology',
      ],
      en: [
        'Compare unaided vs aided AAC: When to use which?',
        'PRD (Pragmatic Rating Dimensions) analysis for AAC assessment',
        'ISO 9999:05.15.06 standard for SGD devices',
        'Integration strategies for AAC with mainstream technology',
      ],
      ar: [
        'مقارنة AAC غير المساعدة مقابل المساعدة: متى تستخدم كل منها؟',
        'تحليل PRD (أبعاد التقييم البراغماتي) لتقييم AAC',
        'معيار ISO 9999:05.15.06 لأجهزة SGD',
        'استراتيجيات التكامل لـ AAC مع التكنولوجيا الرئيسية',
      ],
      fr: [
        'Comparer CAA non assistée vs assistée: Quand utiliser laquelle?',
        'Analyse PRD (Dimensions d\'Évaluation Pragmatique) pour l\'évaluation CAA',
        'Norme ISO 9999:05.15.06 pour les appareils SGD',
        'Stratégies d\'intégration de CAA avec la technologie grand public',
      ],
    },
  },
  daily_living: {
    end_user: {
      vi: [
        'Dụng cụ ăn uống cho người khó khớp tay?',
        'Thiết bị nhắc nhở uống thuốc đúng giờ?',
        'Đồ dùng nhà bếp hỗ trợ người khuyết tật?',
        'Thiết bị an toàn trong nhà tắm cho người già?',
      ],
      en: [
        'Eating utensils for people with hand grip difficulties?',
        'Medication reminder devices to take medicine on time?',
        'Kitchen aids for people with disabilities?',
        'Safety devices in the bathroom for elderly people?',
      ],
      ar: [
        'أدوات الأكل للأشخاص الذين يعانون من صعوبة في الإمساك باليد؟',
        'أجهزة تذكير بالأدوية لأخذها في الوقت المحدد؟',
        'معدات المطبخ للأشخاص ذوي الإعاقة؟',
        'أجهزة السلامة في الحمام لكبار السن؟',
      ],
      fr: [
        'Ustensiles de repas pour les personnes ayant des difficultés de préhension?',
        'Dispositifs de rappel de médicaments pour prendre ses médicaments à temps?',
        'Équipements de cuisine pour personnes handicapées?',
        'Dispositifs de sécurité dans la salle de bain pour personnes âgées?',
      ],
    },
    at_specialist: {
      vi: [
        'Phân tích lever taps vs rocker switches cho one-handed users',
        'Tiêu chuẩn ISO 9999:09 cho daily living aids classification',
        'ADA compliance requirements cho kitchen accessibility',
        'Ergonomic assessment cho adapted utensils selection',
      ],
      en: [
        'Analyze lever taps vs rocker switches for one-handed users',
        'ISO 9999:09 standard for daily living aids classification',
        'ADA compliance requirements for kitchen accessibility',
        'Ergonomic assessment for adapted utensils selection',
      ],
      ar: [
        'تحليل صمامات الرافعة مقابل مفاتيح التبديل ROCKER للمستخدمين الذين يستخدمون يدًا واحدة',
        'معيار ISO 9999:09 لتصنيف أدوات المعيشة اليومية',
        'متطلبات الامتثال لقانون ADA لإمكانية الوصول إلى المطبخ',
        'التقييم ergonomique لاختيار الأدوات المعدلة',
      ],
      fr: [
        'Analyser les robinets à levier vs interrupteurs à bascule pour utilisateurs à une main',
        'Norme ISO 9999:09 pour la classification des aides à la vie quotidienne',
        'Exigences de conformité ADA pour l\'accessibilité de la cuisine',
        'Évaluation ergonomique pour la sélection des ustensiles adaptés',
      ],
    },
  },
  education: {
    end_user: {
      vi: [
        'Phần mềm hỗ trợ học tập cho trẻ khuyết tật?',
        'Thiết bị giáo dục đặc biệt cho trường học?',
        'Tiêu chuẩn WCAG cho nội dung giáo dục?',
        'Ứng dụng học ngôn ngữ cho người khuyết tật?',
      ],
      en: [
        'Learning software for children with disabilities?',
        'Special education devices for schools?',
        'WCAG standards for educational content?',
        'Language learning apps for people with disabilities?',
      ],
      ar: [
        'برامج التعلم للأطفال ذوي الإعاقة؟',
        'أجهزة التعليم الخاص للمدارس؟',
        'معايير WCAG للمحتوى التعليمي؟',
        'تطبيقات تعلم اللغة للأشخاص ذوي الإعاقة؟',
      ],
      fr: [
        'Logiciels d\'apprentissage pour enfants handicapés?',
        'Appareils d\'éducation spéciale pour les écoles?',
        'Normes WCAG pour le contenu éducatif?',
        'Applications d\'apprentissage des langues pour personnes handicapées?',
      ],
    },
    at_specialist: {
      vi: [
        'Universal Design for Learning (UDL) framework implementation',
        'Accessible assessment strategies cho students với disabilities',
        'Section 508 vs WCAG 2.1 cho educational technology',
        'Research-based AT interventions cho specific learning disabilities',
      ],
      en: [
        'Universal Design for Learning (UDL) framework implementation',
        'Accessible assessment strategies for students with disabilities',
        'Section 508 vs WCAG 2.1 for educational technology',
        'Research-based AT interventions for specific learning disabilities',
      ],
      ar: [
        'تنفيذ إطار التصميم الشامل للتعلم (UDL)',
        'استراتيجيات التقييم المتاحة للطلاب ذوي الإعاقة',
        'القسم 508 مقابل WCAG 2.1 للتكنولوجيا التعليمية',
        'تدخلات AT القائمة على البحث لاضطرابات التعلم المحددة',
      ],
      fr: [
        'Mise en œuvre du cadre de conception universelle de l\'apprentissage (UDL)',
        'Stratégies d\'évaluation accessibles pour les étudiants handicapés',
        'Section 508 vs WCAG 2.1 pour la technologie éducative',
        'Interventions AT fondées sur la recherche pour les troubles d\'apprentissage spécifiques',
      ],
    },
  },
};

// AT Category Info với translation và color coding
export const CATEGORY_INFO: Record<ATCategory, { 
  name: string; 
  nameVi: string; 
  nameEn: string;
  nameAr: string;
  nameFr: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  greeting: string;
  greetingEn: string;
  greetingAr: string;
  greetingFr: string;
}> = {
  vision: {
    name: 'Cảm giác – Thị giác',
    nameVi: 'Cảm giác – Thị giác',
    nameEn: 'Vision',
    nameAr: 'البصر',
    nameFr: 'Vision',
    icon: 'visibility',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Thị giác** (Bot 2 – Sensory Vision). Tôi hỗ trợ về **máy đọc màn hình** (JAWS, NVDA, VoiceOver), **phóng to**, **chuyển text thành giọng nói**, và tiêu chuẩn **WCAG 2.2**, **ISO 9241-171**.',
    greetingEn: 'Hello! I am **Bot 2 – Sensory Vision**. I help with **screen readers** (JAWS, NVDA, VoiceOver), **magnification**, **text-to-speech**, and standards **WCAG 2.2**, **ISO 9241-171**.',
    greetingAr: 'مرحباً! أنا **بوت 2 - الحواس - البصر**. أساعدك في قارئات الشاشة والتكبير وفق معايير WCAG 2.2.',
    greetingFr: 'Bonjour ! Je suis **Bot 2 – Sens – Vision**. J\'aide avec les **lecteurs d\'écran** (JAWS, NVDA), la **loupe** et les normes **WCAG 2.2**.',
  },
  hearing: { 
    name: 'Cảm giác – Thính giác', 
    nameVi: 'Cảm giác – Thính giác', 
    nameEn: 'Hearing', 
    nameAr: 'الحواس - السمع',
    nameFr: 'Sens – Audition',
    icon: 'hearing', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Thính giác** (Bot 1 – Sensory Hearing). Tôi có thể hỗ trợ bạn về **máy trợ thính** (Phonak Lyric, Oticon More), **thiết bị cảnh báo Bellman**, **hệ thống Roger FM** theo tiêu chuẩn ISO 22.06.06; IEC 60118; ISO 8253-1.',
    greetingEn: 'Hello! I am **Bot 1 – Sensory Hearing**. I help with **hearing aids** (Phonak Lyric, Oticon More), **Bellman alerting devices**, and **Roger FM systems**. Standards: ISO 22.06.06, 22.09.06; IEC 60118; ISO 8253-1.',
    greetingAr: 'مرحباً! أنا **بوت 1 - الحواس - السمع**. أساعدك في **سماعات الأذن** (Phonak, Oticon) و**أجهزة التنبيه** وفق معايير ISO 22.06.06 و IEC 60118.',
    greetingFr: 'Bonjour ! Je suis **Bot 1 – Sens – Audition**. J\'aide avec les **appareils auditifs** (Phonak Lyric, Oticon More), les **dispositifs d\'alerte Bellman** et les **systèmes Roger FM**. Normes : ISO 22.06.06, IEC 60118.',
  },
  mobility: { 
    name: 'Vận động thần kinh', 
    nameVi: 'Vận động thần kinh', 
    nameEn: 'Neuromusculoskeletal Movement', 
    nameAr: 'العضلات والعصبية',
    nameFr: 'Mouvement neuromusculosquelettique',
    icon: 'accessible_forward', 
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Vận động thần kinh – cơ xương** (Bot 5 – Neuromusculoskeletal Movement). Tôi hỗ trợ về **IntegraMouse Plus** (chuột miệng), **Neofect Smart Glove** (găng tay phục hồi), **Bioness L300 Go FES** theo tiêu chuẩn ISO 04.24, 06.06; ISO 10993-1; ISO 13485.',
    greetingEn: 'Hello! I am **Bot 5 – Neuromusculoskeletal Movement**. I help with **IntegraMouse Plus** (mouth mouse), **Neofect Smart Glove** (rehabilitation glove), and **Bioness L300 Go FES**. Standards: ISO 04.24, 06.06, 12.31.03; ISO 10993-1; ISO 13485.',
    greetingAr: 'مرحباً! أنا **بوت 5 - العضلات والعصبية**. أساعدك في **فأرة الفم** و**قفازات إعادة التأهيل** وفق معايير ISO 04.24 و ISO 10993-1.',
    greetingFr: 'Bonjour ! Je suis **Bot 5 – Mouvement neuromusculosquelettique**. J\'aide avec la **souris buccale IntegraMouse**, le **gant Neofect** et le **Bioness L300 Go FES**. Normes : ISO 04.24, ISO 10993-1, ISO 13485.',
  },
  cognition: { 
    name: 'Tâm thần – Nhận thức', 
    nameVi: 'Tâm thần – Nhận thức', 
    nameEn: 'Mental – Cognitive', 
    nameAr: 'الإدراكي والمعرفي',
    nameFr: 'Cognitif',
    icon: 'psychology', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Nhận thức** (Bot 4 – Mental Cognitive). Tôi hỗ trợ **người cao tuổi**, **người sa sút trí tuệ** với **hộp chia thuốc Medelert**, **đồng hồ Time Timer**, và công cụ **WHO GATE** theo tiêu chuẩn ISO 05.06.15; WHO ICF.',
    greetingEn: 'Hello! I am **Bot 4 – Mental Cognitive**. I help **elderly** and **dementia** users with **Medelert pill dispenser**, **Time Timer**, and **WHO GATE** tools. Standards: ISO 05.06.15, 05.09.03; WHO GATE.',
    greetingAr: 'مرحباً! أنا **بوت 4 - الإدراك والمعرفي**. أساعد كبار السن والخرأاد وفق معايير ISO 05.06.15 و WHO GATE.',
    greetingFr: 'Bonjour ! Je suis **Bot 4 – Cognitif**. J\'aide les **personnes âgées** et **démentes** avec **Medelert**, **Time Timer** et outils **OMS GATE**. Normes : ISO 05.06.15, OMS GATE.',
  },
  communication: { 
    name: 'Giọng nói và Lời nói', 
    nameVi: 'Giọng nói và Lời nói', 
    nameEn: 'Voice and Speech', 
    nameAr: 'الكلام والصوت',
    nameFr: 'Parole et Voix',
    icon: 'record_voice_over', 
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/30',
    borderColor: 'border-rose-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Giọng nói & Lời nói** (Bot 3 – Voice and Speech). Tôi hỗ trợ thiết bị **AAC/SGD** như **Tobii Dynavox** (điều khiển bằng ánh mắt), **Proloquo2Go**, theo tiêu chuẩn ISO 05.15.06, 05.15.12; HL7 FHIR v4.',
    greetingEn: 'Hello! I am **Bot 3 – Voice and Speech**. I help with **AAC/SGD devices** like **Tobii Dynavox** (eye-controlled) and **Proloquo2Go**. Standards: ISO 05.15.06, 05.15.12, 22.21.12; HL7 FHIR v4.',
    greetingAr: 'مرحباً! أنا **بوت 3 - الكلام والصوت**. أساعد في أجهزة AAC و SGD وفق معايير ISO 05.15.06 و HL7 FHIR v4.',
    greetingFr: 'Bonjour ! Je suis **Bot 3 – Parole et Voix**. J\'aide avec les appareils **CAA/SGD** comme **Tobii Dynavox** et **Proloquo2Go**. Normes : ISO 05.15.06, HL7 FHIR v4.',
  },
  daily_living: { 
    name: 'Di chuyển và Giao thông', 
    nameVi: 'Di chuyển và Giao thông', 
    nameEn: 'Mobility & Transportation', 
    nameAr: 'التنقل والحركة',
    nameFr: 'Mobilité et Transport',
    icon: 'commute', 
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Di chuyển & Giao thông** (Bot 6 – Mobility & Transportation). Tôi hỗ trợ **xe lăn điện**, **Scewo Bro** (leo cầu thang), **WeWALK Smart Cane**, **Rollator Walker** theo tiêu chuẩn ISO 12.21.06; ISO 7176-19; CE Medical Class II.',
    greetingEn: 'Hello! I am **Bot 6 – Mobility & Transportation**. I help with **powered wheelchairs**, **Scewo Bro** (stair-climbing), **WeWALK Smart Cane**, and **Rollator Walker**. Standards: ISO 12.21.06, 12.21.09; ISO 7176-19; CE Medical Class II.',
    greetingAr: 'مرحباً! أنا **بوت 6 - التنقل والحركة**. أساعد في الكراسي المتحركة والعصي الذكية وفق معايير ISO 12.21.06 و ISO 7176-19.',
    greetingFr: 'Bonjour ! Je suis **Bot 6 – Mobilité et Transport**. J\'aide avec les **fauteuils roulants**, **Scewo Bro**, **WeWALK Smart Cane**. Normes : ISO 12.21.06, ISO 7176-19.',
  },
  education: { 
    name: 'Thông tin bổ trợ', 
    nameVi: 'Thông tin bổ trợ', 
    nameEn: 'Regulatory & Standards', 
    nameAr: 'معلومات إضافية ومعايير',
    nameFr: 'Informations supplémentaires et normes',
    icon: 'school', 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Quy định & Tiêu chuẩn** (Bot 7 – Regulatory & Standards). Tôi tra cứu **ISO 9999:2022**, **WHO GATE**, **WCAG 2.2**, **EU MDR**, **FDA 21 CFR**, **CE Mark**, **HL7 FHIR v4** cho người dùng và chuyên gia CNHT.',
    greetingEn: 'Hello! I am **Bot 7 – Regulatory & Standards**. I provide quick lookup of **ISO 9999:2022**, **WHO GATE**, **WCAG 2.2**, **EU MDR**, **FDA 21 CFR**, **CE Mark**, and **HL7 FHIR v4** for users and AT specialists.',
    greetingAr: 'مرحباً! أنا **بوت 7 - المعايير والتنظيمات**. أبحث في ISO 9999:2022 و WHO GATE و WCAG 2.2 و EU MDR.',
    greetingFr: 'Bonjour ! Je suis **Bot 7 – Réglementation et Normes**. Je fournis une recherche rapide sur **ISO 9999:2022**, **OMS GATE**, **WCAG 2.2**, **EU MDR**, **FDA 21 CFR**.',
  },
};

// Keyword để detect khi nào nên gợi ý chuyên gia AT
export const AT_SPECIALIST_KEYWORDS: Record<ATCategory, {
  simple: string[];       // Từ thường - cần 1 từ để trigger
  complex: string[];      // Từ chuyên môn - trigger nhanh hơn
}> = {
  vision: {
    simple: ['mù', 'blind', 'khiếm thị', 'thị giác', 'vision', 'mắt', 'eye',
             'đọc chữ', 'đọc sách', 'nhìn', 'see', 'blindness', 'low vision',
             'visual impairment', 'glaucoma', 'cataract', 'macular degeneration'],
    complex: ['screen reader', 'JAWS', 'NVDA', 'VoiceOver', 'máy đọc màn hình',
              'magnification', 'phóng to', 'loupe', 'text-to-speech', 'Braille',
              'Braille embosser', 'tactile', 'xúc giác', 'color blind', 'mù màu',
              'orientation mobility', 'di chuyển cho người mù', 'WCAG', 'ISO 9241-171']
  },
  hearing: {
    simple: ['điếc', 'khiếm thính', 'deaf', 'hearing loss', 'deafness', 'người điếc',
             'máy trợ thính', 'hearing aid', 'máy trợ tai'],
    complex: ['thiết bị phản hồi âm thanh', 'alerting device', 'personal amplifier',
              'hearing loop', 'fm system', 'thiết bị khuếch đại', 'cochlear implant',
              'hearing dog', 'chó trợ thính', 'subtitles', 'caption', 'phụ đề']
  },
  mobility: {
    simple: ['xe lăn', 'wheelchair', 'xe scooter', 'xe điện', 'nạng', 'crutch',
             'walker', 'tàn tật', 'disability', 'paralysis', 'liệt', 'cụt chi',
             'prosthetic', 'người khuyết tật', 'disabled'],
    complex: ['prosthesis', 'orthotic', 'bộ phận giả', 'chân giả', 'tay giả',
              'exoskeleton', 'exosuit', 'power wheelchair', 'xe lăn điện', 'xe lăn thường',
              'standing wheelchair', 'smart wheelchair', 'prosthetic limb', 'orthopedic']
  },
  cognition: {
    simple: ['tự kỷ', 'autism', 'down syndrome', 'trí nhớ', 'memory', 'nhận thức',
             'cognitive', 'học tập', 'learning disability', 'chậm phát triển',
             'intellectual disability', 'mất trí', 'suy giảm nhận thức', ' Alzheimer'],
    complex: ['aac device', 'giao tiếp tăng альт', 'augmentative communication',
              'switch access', 'eye tracking', 'thiết bị điều khiển bằng mắt',
              'cognitive aid', 'memory aid', 'personal digital assistant', 'pda']
  },
  communication: {
    simple: ['giao tiếp', 'communication', 'nói', 'speech', 'ngôn ngữ',
             'language disorder', 'rối loạn ngôn ngữ', 'câm', 'mute', 'không nói được'],
    complex: ['aac', 'speech generating device', 'sgd', 'communication board',
              'pecs', 'thiết bị tạo giọng nói', 'text to speech', 'tts',
              'speech synthesizer', 'voice synthesizer', 'communication app', 'tap to speak']
  },
  daily_living: {
    simple: ['ăn uống', 'vệ sinh', 'sinh hoạt', 'daily living', 'tự lập',
             'independent living', 'hỗ trợ sinh hoạt', 'chăm sóc cá nhân'],
    complex: ['eating aid', 'feeding device', 'adaptive utensil', 'dressing aid',
              'bathroom aid', 'shower chair', 'toilet aid', 'bed rail', 'grab bar',
              'smart home', 'nhà thông minh', 'home automation', 'environmental control']
  },
  education: {
    simple: ['học tập', 'học', 'education', 'learning', 'giáo dục đặc biệt',
             'special education', 'ưu tiên giao thông', 'thiết bị học tập'],
    complex: ['assistive technology education', 'iep', 'individualized education program',
              'learning accommodation', 'accessibility in education', 'educational software',
              'text to speech for students', 'reading pen', 'bút đọc sách']
  }
};
