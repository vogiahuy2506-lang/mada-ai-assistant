// User Roles
export type UserRole = 'admin' | 'data_manager' | 'expert' | 'user';

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
  | 'vision'           // Thiết bị nhìn
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
        'Phần mềm đọc màn hình nào tốt nhất cho người khiếm thị?',
        'Kính lúp điện tử có giá bao nhiêu?',
        'Làm thế nào để người khiếm thị sử dụng máy tính?',
        'Thiết bị đọc chữ nổi Braille giá bao nhiêu?',
      ],
      en: [
        'What are the best screen readers for visually impaired people?',
        'How much does an electronic magnifier cost?',
        'How can visually impaired people use computers?',
        'How much does a Braille display cost?',
      ],
      ar: [
        'ما هي أفضل برامج قراءة الشاشة للأشخاص ذوي الإعاقة البصرية؟',
        'كم تكلفة المكبر الإلكتروني؟',
        'كيف يمكن للأشخاص ذوي الإعاقة البصرية استخدام أجهزة الكمبيوتر؟',
        'كم تكلفة شاشة برايل؟',
      ],
      fr: [
        'Quels sont les meilleurs lecteurs d\'écran pour les personnes malvoyantes?',
        'Combien coûte un grossisseur électronique?',
        'Comment les personnes malvoyantes peuvent-elles utiliser les ordinateurs?',
        'Combien coûte un afficheur Braille?',
      ],
    },
    at_specialist: {
      vi: [
        'So sánh JAWS vs NVDA về độ tương thích WCAG 2.1 Level AAA',
        'Tiêu chuẩn ISO 9999:24.09 cho thiết bị hỗ trợ thị giác?',
        'Phân tích độ phóng đại tối ưu cho CCTV Magnifier theo WHO guidelines',
        'Hướng dẫn cấu hình OrCam MyEye theo EN 1332-20',
      ],
      en: [
        'Compare JAWS vs NVDA for WCAG 2.1 Level AAA compliance',
        'ISO 9999:24.09 standard for visual assistive devices?',
        'Optimal magnification analysis for CCTV Magnifier per WHO guidelines',
        'OrCam MyEye configuration guide per EN 1332-20',
      ],
      ar: [
        'مقارنة JAWS مقابل NVDA للتوافق مع WCAG 2.1 المستوى AAA',
        'معيار ISO 9999:24.09 لأجهزة المساعدة البصرية',
        'تحليل التكبير الأمثل لمكبر CCTV وفق إرشادات منظمة الصحة العالمية',
        'دليل تكوين OrCam MyEye وفق EN 1332-20',
      ],
      fr: [
        'Comparer JAWS vs NVDA pour la conformité WCAG 2.1 Niveau AAA',
        'Norme ISO 9999:24.09 pour les appareils d\'assistance visuelle?',
        'Analyse du grossissement optimal pour CCTV Magnifier selon les directives OMS',
        'Guide de configuration OrCam MyEye selon EN 1332-20',
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
    name: 'Thiết bị nhìn', 
    nameVi: 'Thiết bị nhìn', 
    nameEn: 'Vision Devices', 
    nameAr: 'أجهزة الرؤية',
    nameFr: 'Appareils de vision',
    icon: 'visibility', 
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 dark:bg-violet-900/30',
    borderColor: 'border-violet-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Thị giác**. Tôi có thể hỗ trợ bạn về các thiết bị hỗ trợ nhìn như **phần mềm đọc màn hình**, **kính lúp điện tử**, **chữ nổi Braille** và các **giải pháp công nghệ hỗ trợ thị lực**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Vision**. I can help you with **screen readers**, **electronic magnifiers**, **Braille displays**, and **visual assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **الرؤية**. يمكنني مساعدتك في **قارئات الشاشة**، **المكبرات الإلكترونية**، **شاشات بريل**، و**حلول التكنولوجيا المساعدة للبصر**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans la **Vision**. Je peux vous aider avec les **lecteurs d\'écran**, les **lupa électroniques**, les **plages Braille** et les **solutions technologiques d\'assistance visuelle**.',
  },
  hearing: { 
    name: 'Thiết bị nghe', 
    nameVi: 'Thiết bị nghe', 
    nameEn: 'Hearing Devices', 
    nameAr: 'أجهزة السمع',
    nameFr: 'Appareils auditifs',
    icon: 'hearing', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Thính giác**. Tôi có thể hỗ trợ bạn về **máy trợ thính**, **thiết bị phản hồi âm thanh**, **thiết bị khuếch đại cá nhân** và các **giải pháp công nghệ hỗ trợ thính lực**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Hearing**. I can help you with **hearing aids**, **alerting devices**, **personal amplifiers**, and **hearing assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **السمع**. يمكنني مساعدتك في **سماعات الأذن**، **أجهزة التنبيه**، **المضخات الصوتية الشخصية**، و**حلول التكنولوجيا المساعدة للسمع**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans l\'**Audition**. Je peux vous aider avec les **appareils auditifs**, les **dispositifs d\'alerte**, les **amplificateurs personnels**, et les **solutions technologiques d\'assistance auditive**.',
  },
  mobility: { 
    name: 'Thiết bị vận động', 
    nameVi: 'Thiết bị vận động', 
    nameEn: 'Mobility Devices', 
    nameAr: 'أجهزة الحركة',
    nameFr: 'Appareils de mobilité',
    icon: 'accessible_forward', 
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Vận động**. Tôi có thể hỗ trợ bạn về **xe lăn**, **xe scooter**, **nạng**, **walker**, **prosthetics** và các **giải pháp công nghệ hỗ trợ di chuyển**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Mobility**. I can help you with **wheelchairs**, **scooters**, **crutches**, **walkers**, **prosthetics**, and **mobility assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **الحركة**. يمكنني مساعدتك في **الكراسي المتحركة**، **السكوترات**، **العكازات**، **المشايات**، **الأطراف الصناعية**، و**حلول التكنولوجيا المساعدة للحركة**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans la **Mobilité**. Je peux vous aider avec les **fauteuils roulants**, les **scooters**, les **béquilles**, les **déambulateurs**, les **prothèses**, et les **solutions technologiques d\'assistance à la mobilité**.',
  },
  cognition: { 
    name: 'Thiết bị nhận thức', 
    nameVi: 'Thiết bị nhận thức', 
    nameEn: 'Cognitive Devices', 
    nameAr: 'الأجهزة المعرفية',
    nameFr: 'Appareils cognitifs',
    icon: 'psychology', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Nhận thức**. Tôi có thể hỗ trợ bạn về thiết bị hỗ trợ **trí nhớ**, **lập kế hoạch**, **tổ chức công việc**, **hỗ trợ học tập nhận thức** và các **công nghệ hỗ trợ nhận thức**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Cognition**. I can help you with **memory aids**, **planning tools**, **task organization**, **cognitive learning support**, and **cognitive assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **الإدراك**. يمكنني مساعدتك في **أدوات الذاكرة**، **أدوات التخطيط**، **تنظيم المهام**، **الدعم المعرفي للتعلم**، و**حلول التكنولوجيا المساعدة للإدراك**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans la **Cognition**. Je peux vous aider avec les **aides à la mémoire**, les **outils de planification**, l\'**organisation des tâches**, le **soutien à l\'apprentissage cognitif**, et les **solutions technologiques d\'assistance cognitive**.',
  },
  communication: { 
    name: 'Thiết bị giao tiếp', 
    nameVi: 'Thiết bị giao tiếp', 
    nameEn: 'Communication Devices', 
    nameAr: 'أجهزة التواصل',
    nameFr: 'Appareils de communication',
    icon: 'record_voice_over', 
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/30',
    borderColor: 'border-rose-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Giao tiếp**. Tôi có thể hỗ trợ bạn về thiết bị giao tiếp **tăng thay thế (AAC)**, **ứng dụng hỗ trợ ngôn ngữ**, **thiết bị hỗ trợ nói** và các **công nghệ hỗ trợ giao tiếp**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Communication**. I can help you with **augmentative and alternative communication (AAC)** devices, **language support apps**, **speech aids**, and **communication assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **التواصل**. يمكنني مساعدتك في أجهزة **الاتصال التوسعي والبديل (AAC)**، **تطبيقات الدعم اللغوي**، **أدوات المساعدة في الكلام**، و**حلول التكنولوجيا المساعدة للتواصل**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans la **Communication**. Je peux vous aider avec les dispositifs de **communication augmentative et alternative (CAA)**, les **applications de soutien linguistique**, les **aides à la parole**, et les **solutions technologiques d\'assistance à la communication**.',
  },
  daily_living: { 
    name: 'Hỗ trợ sinh hoạt', 
    nameVi: 'Hỗ trợ sinh hoạt', 
    nameEn: 'Daily Living Aids', 
    nameAr: 'أدوات المعيشة اليومية',
    nameFr: 'Aides à la vie quotidienne',
    icon: 'home', 
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Sinh hoạt hàng ngày**. Tôi có thể hỗ trợ bạn về thiết bị **ăn uống**, **vệ sinh cá nhân**, **hỗ trợ ngủ nghỉ**, **điều khiển nhà thông minh** và các **giải pháp công nghệ hỗ trợ sinh hoạt**.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Daily Living**. I can help you with **eating aids**, **personal hygiene devices**, **sleep support**, **smart home controls**, and **daily living assistive technology** solutions.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **المعيشة اليومية**. يمكنني مساعدتك في **أدوات الأكل**، **أجهزة النظافة الشخصية**، **دعم النوم**، **التحكم في المنزل الذكي**، و**حلول التكنولوجيا المساعدة للمعيشة اليومية**.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans la **Vie Quotidienne**. Je peux vous aider avec les **aides à l\'alimentation**, les **appareils d\'hygiène personnelle**, le **soutien au sommeil**, les **contrôles domotiques**, et les **solutions technologiques d\'assistance à la vie quotidienne**.',
  },
  education: { 
    name: 'Giáo dục', 
    nameVi: 'Giáo dục', 
    nameEn: 'Education', 
    nameAr: 'التعليم',
    nameFr: 'Éducation',
    icon: 'school', 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-500',
    greeting: 'Xin chào! Tôi là **Trợ lý AI** chuyên khoa **Giáo dục**. Tôi có thể hỗ trợ bạn về thiết bị hỗ trợ **học tập**, **phần mềm giáo dục đặc biệt**, **tài liệu hướng dẫn sư phạm** và các **công nghệ hỗ trợ giáo dục** cho người khuyết tật.',
    greetingEn: 'Hello! I am your **AI Assistant** specializing in **Education**. I can help you with **learning assistive devices**, **special education software**, **pedagogical guides**, and **educational assistive technology** solutions for people with disabilities.',
    greetingAr: 'مرحباً! أنا مساعدك **الذكي** المتخصص في **التعليم**. يمكنني مساعدتك في **أجهزة المساعدة التعليمية**، **برامج التعليم الخاص**، **الأدلة التربوية**، و**حلول التكنولوجيا المساعدة التعليمية** للأشخاص ذوي الإعاقة.',
    greetingFr: 'Bonjour! Je suis votre assistant **IA** spécialisé dans l\'**Éducation**. Je peux vous aider avec les **appareils d\'assistance à l\'apprentissage**, les **logiciels d\'éducation spéciale**, les **guides pédagogiques**, et les **solutions technologiques d\'assistance éducative** pour les personnes en situation de handicap.',
  },
};
