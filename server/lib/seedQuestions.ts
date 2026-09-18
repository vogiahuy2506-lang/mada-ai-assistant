/**
 * SAMPLE_QUESTIONS - Server-side copy for seeding suggested_questions table.
 * This avoids importing from ../src/types/index.ts which breaks esbuild bundling.
 */

type ViewMode = 'end_user' | 'at_specialist';
type Language = 'vi' | 'en' | 'ar' | 'fr';
type ATCategory = 'vision' | 'hearing' | 'mobility' | 'cognition' | 'communication' | 'daily_living' | 'education';

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
        'معيار ISO 7176 للكراسي المتحركة الكهربائية - معايير اختبار',
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
        'Evidence-based AT interventions for traumatic brain injury users',
        'Compare Tobii Dynavox vs Prentke Romich SGD features',
      ],
      ar: [
        'تحليل أنظمة رموز AAC: PCS مقابل SymbolStix مقابل Widgit',
        'معيار ISO 9999:05.15 لأجهزة المساعدة المعرفية',
        'تدخلات AT القائمة على الأدلة للمستخدمين الذين أصيبوا بإصابة دماغية رضية',
        'مقارنة ميزات أجهزة التواصل المُولدة للكلام: Tobii Dynavox مقابل Prentke Romich',
      ],
      fr: [
        'Analyser les systèmes de symboles CAA: PCS vs SymbolStix vs Widgit',
        'Norme ISO 9999:05.15 pour les aides cognitives',
        'Interventions AT fondées sur des données probantes pour les utilisateurs atteints de lésion cérébrale traumatique',
        'Comparer les fonctionnalités SGD: Tobii Dynavox vs Prentke Romich',
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
        'Communication apps for people who cannot speak on the phone?',
        'Communication devices for children with autism?',
      ],
      ar: [
        'ما هو التواصل المُعزّز والبديل (AAC)؟',
        'كيف تعمل لوحات التواصل بالصور؟',
        'تطبيقات التواصل للأشخاص الذين لا يستطيعون التحدث عبر الهاتف؟',
        'أجهزة التواصل للأطفال المصابين بالتوحد؟',
      ],
      fr: [
        'Qu\'est-ce que la Communication Améliorée et Alternative (CAA)?',
        'Comment fonctionnent les tableaux de communication par images?',
        'Applications de communication pour les personnes qui ne peuvent pas parler au téléphone?',
        'Dispositifs de communication pour les enfants autistes?',
      ],
    },
    at_specialist: {
      vi: [
        'Phân tích ưu nhược điểm của PECS vs SGD devices',
        'Eye-tracking technology cho người bị liệt toàn thân',
        'Tiêu chuẩn ISO 9999:05.15.06 cho SGD devices',
        'So sánh Direct Access vs Switch Access cho AAC users',
      ],
      en: [
        'Analyze PECS vs SGD devices pros and cons',
        'Eye-tracking technology for users with full-body paralysis',
        'ISO 9999:05.15.06 standard for speech generating devices',
        'Compare Direct Access vs Switch Access for AAC users',
      ],
      ar: [
        'تحليل مزايا وعيوب PECS مقابل أجهزة التواصل المُولدة للكلام',
        'تقنية تتبع العين للمستخدمين الذين يعانون من الشلل الكامل',
        'معيار ISO 9999:05.15.06 لأجهزة التواصل المُولدة للكلام',
        'مقارنة الوصول المباشر مقابل الوصول بالمفتاح لأجهزة CAA',
      ],
      fr: [
        'Analyser les avantages et inconvénients des PECS vs dispositifs SGD',
        'Technologie de suivi oculaire pour les utilisateurs atteints de paralysie totale',
        'Norme ISO 9999:05.15.06 pour les dispositifs de génération de parole',
        'Comparer l\'accès direct vs l\'accès par commutateur pour les utilisateurs CAA',
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
        'Kitchen tools to assist people with disabilities?',
        'Safety devices in the bathroom for elderly people?',
      ],
      ar: [
        'أدوات الأكل للأشخاص الذين يعانون من صعوبة في الإمساك باليد؟',
        'أجهزة تذكير بتناول الأدوية في الوقت المحدد؟',
        'أدوات المطبخ لمساعدة الأشخاص ذوي الإعاقة؟',
        'أجهزة السلامة في الحمام لكبار السن؟',
      ],
      fr: [
        'Ustensiles de repas pour les personnes ayant des difficultés de préhension?',
        'Dispositifs de rappel de médicaments pour prendre ses médicaments à temps?',
        'Ustensiles de cuisine pour aider les personneshandicapées?',
        'Dispositifs de sécurité dans la salle de bain pour les personnes âgées?',
      ],
    },
    at_specialist: {
      vi: [
        'Phân tích grab bars vs floor-to-ceiling poles cho người già',
        'Shower chair specifications theo ISO 9999:09.33',
        'So sánh powered vs non-powered dressing aids',
        'Adaptive kitchen equipment cho người có chứng run (tremor)',
      ],
      en: [
        'Analyze grab bars vs floor-to-ceiling poles for elderly safety',
        'Shower chair specifications per ISO 9999:09.33',
        'Compare powered vs non-powered dressing aids',
        'Adaptive kitchen equipment for users with tremor',
      ],
      ar: [
        'تحليل قضبان الإمساك مقابل الأعمدة من الأرض إلى السقف لسلامة كبار السن',
        'مواصفات كرسي الاستحمام وفق ISO 9999:09.33',
        'مقارنة أدوات اللبس الميكانيكية مقابل اليدوية',
        'معدات المطبخ التكيفية للمستخدمين الذين يعانون من الرعاش',
      ],
      fr: [
        'Analyser les barres d\'appui vs poteaux du sol au plafond pour la sécurité des personnes âgées',
        'Spécifications des chaises de douche selon ISO 9999:09.33',
        'Comparer les aides à l\'habillage motorisées vs non motorisées',
        'Équipement de cuisine adaptatif pour les utilisateurs atteints de tremblements',
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
        'برمجيات التعلم للأطفال ذوي الإعاقة؟',
        'أجهزة التعليم الخاص للمدارس؟',
        'معايير WCAG للمحتوى التعليمي؟',
        'تطبيقات تعلم اللغة للأشخاص ذوي الإعاقة؟',
      ],
      fr: [
        'Logiciels d\'apprentissage pour les enfants handicapés?',
        'Dispositifs d\'éducation spéciale pour les écoles?',
        'Normes WCAG pour le contenu éducatif?',
        'Applications d\'apprentissage des langues pour les personnes handicapées?',
      ],
    },
    at_specialist: {
      vi: [
        'Phần mềm đọc màn hình cho người khiếm thị trong môi trường giáo dục',
        'Tiêu chuẩn accessibility cho LMS (Learning Management Systems)',
        'Đặc điểm kỹ thuật Kurzweil 3000 vs Read&Write Gold',
        'Ứng dụng eye-tracking trong đánh giá học sinh khuyết tật',
      ],
      en: [
        'Screen reader software for visually impaired students in education',
        'Accessibility standards for Learning Management Systems',
        'Kurzweil 3000 vs Read&Write Gold technical comparison',
        'Eye-tracking applications in assessing students with disabilities',
      ],
      ar: [
        'برمجيات قراءة الشاشة للطلاب ذوي الإعاقة البصرية في التعليم',
        'معايير إمكانية الوصول لأنظمة إدارة التعلم',
        'مقارنة تقنية Kurzweil 3000 مقابل Read&Write Gold',
        'تطبيقات تتبع العين في تقييم الطلاب ذوي الإعاقة',
      ],
      fr: [
        'Logiciels de lecture d\'écran pour les étudiants malvoyants dans l\'éducation',
        'Normes d\'accessibilité pour les systèmes de gestion de l\'apprentissage',
        'Comparaison technique Kurzweil 3000 vs Read&Write Gold',
        'Applications du suivi oculaire dans l\'évaluation des étudiants handicapés',
      ],
    },
  },
};
