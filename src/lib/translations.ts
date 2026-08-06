// Translation system for MADA AI Assistant
// Supports: Vietnamese (vi), English (en), Arabic (ar), French (fr)

export type Language = 'vi' | 'en' | 'ar' | 'fr';

export const translations = {
  vi: {
    // Navigation
    'nav.model': 'Mô hình',
    'nav.intelligence': 'Trí tuệ',
    'nav.standards': 'Tiêu chuẩn',
    'nav.connect': 'Kết nối',
    'nav.pricing': 'Bảng giá',
    
    // Auth
    'auth.login': 'Đăng nhập',
    'auth.logout': 'Đăng xuất',
    'auth.register': 'Đăng ký',
    'auth.profile': 'Hồ sơ',
    'auth.tryFree': 'Thử miễn phí',
    
    // Menu
    'menu.admin': 'Trang quản trị',
    'menu.upgrade': 'Nâng cấp gói',
    'menu.settings': 'Cài đặt',
    
    // Chat UI
    'chat.title': 'MADA AI Assistant',
    'chat.placeholder': 'Hỏi về thiết bị hỗ trợ người khuyết tật...',
    'chat.send': 'Gửi',
    'chat.thinking': 'Đang suy nghĩ...',
    'chat.error': 'Có lỗi xảy ra',
    'chat.retry': 'Thử lại',
    'chat.newChat': 'Trò chuyện mới',
    'chat.search': 'Tìm hội thoại...',
    'chat.noHistory': 'Chưa có hội thoại nào',
    'chat.startChat': 'Bắt đầu chat để lưu lịch sử tự động',
    'chat.recentHistory': 'Lịch sử gần đây',
    'chat.notFound': 'Không tìm thấy',
    'chat.sendFile': 'Gửi Yêu cầu Tư vấn',
    'chat.sending': 'Đang gửi...',
    
    // Welcome
    'welcome.title': 'MADA AI Assistant',
    'welcome.subtitle': 'Hệ thống tư vấn Công nghệ Hỗ trợ bằng trí tuệ nhân tạo',
    'welcome.hint': 'Hãy hỏi tôi về thiết bị AT phù hợp với bạn',
    'welcome.examples': 'Khám phá ngay',
    'welcome.tip': 'Mẹo: Nhấn',
    'welcome.tipKey': 'Ctrl + Enter',
    'welcome.tipAction': 'để gửi nhanh',
    'welcome.pressAsk': 'Nhấn để hỏi',
    'welcome.askNow': 'Hỏi ngay',
    'welcome.suggestions': 'Gợi ý nhanh',
    'welcome.tapAsk': 'Chạm để hỏi ngay',
    'welcome.close': 'Đóng gợi ý',
    
    // Categories
    'cat.vision': 'Thị giác',
    'cat.hearing': 'Thính giác',
    'cat.mobility': 'Vận động',
    'cat.cognition': 'Nhận thức',
    'cat.communication': 'Giao tiếp',
    'cat.daily': 'Sinh hoạt',
    'cat.education': 'Giáo dục',
    'cat.info': 'Thông tin bổ trợ',
    
    // Category full names
    'cat.vision.full': 'CẢM GIÁC - THỊ GIÁC',
    'cat.hearing.full': 'CẢM GIÁC - THÍNH GIÁC',
    'cat.mobility.full': 'VẬN ĐỘNG THẦN KINH',
    'cat.cognition.full': 'TÂM THẦN - NHẬN THỨC',
    'cat.communication.full': 'GIỌNG NÓI VÀ LỜI NÓI',
    'cat.daily.full': 'DI CHUYỂN VÀ GIAO THÔNG',
    'cat.education.full': 'THÔNG TIN BỔ TRỢ',
    
    // Sources
    'sources.title': 'Nguồn tham khảo',
    'sources.noSources': 'Không có nguồn',
    
    // Safety
    'safety.medical.title': 'Cảnh báo',
    'safety.medical.message': 'Tôi không phải bác sĩ. Về vấn đề y tế, hãy liên hệ chuyên gia y khoa.',
    'safety.medical.ok': 'Tôi hiểu',
    
    // Consultation
    'consult.title': 'Yêu cầu Tư vấn Chuyên gia',
    'consult.subtitle': 'MADA Center, Doha, Qatar',
    'consult.name': 'Họ và tên',
    'consult.email': 'Email',
    'consult.phone': 'Số điện thoại',
    'consult.request': 'Yêu cầu kỹ thuật',
    'consult.placeholder': 'Mô tả chi tiết nhu cầu về thiết bị công nghệ hỗ trợ...',
    'consult.note': 'Chuyên gia AT sẽ liên hệ trong 24-48 giờ',
    
    // Common
    'common.save': 'Lưu',
    'common.cancel': 'Hủy',
    'common.delete': 'Xóa',
    'common.edit': 'Sửa',
    'common.add': 'Thêm',
    'common.search': 'Tìm kiếm',
    'common.loading': 'Đang tải...',
    'common.noData': 'Không có dữ liệu',
    'common.success': 'Thành công',
    'common.error': 'Lỗi',
    'common.attach': 'Đính kèm',
    'common.upload': 'Upload file',
    
    // Products
    'products.recommended': 'Thiết bị được gợi ý',
    'products.learnMore': 'Tìm hiểu thêm',
    'products.vision': 'Hỗ trợ thị giác',
    'products.hearing': 'Hỗ trợ thính giác',
    'products.mobility': 'Hỗ trợ vận động',
    'products.cognition': 'Hỗ trợ nhận thức',
    'products.communication': 'Thiết bị giao tiếp',
    'products.daily': 'Sinh hoạt hàng ngày',
    'products.education': 'Hỗ trợ giáo dục',
    'products.at': 'Thiết bị AT',
    
    // Standards
    'standards.title': 'Tiêu chuẩn kỹ thuật',
    'standards.technical': 'Technical Standards',
    
    // Confidence
    'confidence.label': 'Độ tin cậy',
    
    // View modes
    'view.endUser': 'Người dùng',
    'view.specialist': 'Chuyên gia',
    'view.endUserTip': 'Người dùng - Chế độ thân thiện',
    'view.specialistTip': 'Chuyên gia AT - Chế độ chuyên sâu',
    
    // Consultation button
    'consult.button': 'Tư vấn Chuyên gia',
    
    // Message actions
    'message.speak': 'Đọc tin nhắn',
    'message.stopSpeaking': 'Dừng đọc',
    'message.copy': 'Sao chép',
    'message.copied': 'Đã sao chép!',
    'message.like': 'Thích',
    'message.dislike': 'Không thích',
    'message.sources': 'Xem nguồn tham khảo',
    'message.rag': 'RAG',
    
    // Agent labels
    'agent.select': 'Chọn Agent',
    'agent.premium': 'Premium Intelligence',
    'agent.specialist': 'AT Specialist Mode',
    
    // Input
    'input.placeholder.endUser': 'Message MADA AI...',
    'input.placeholder.specialist': 'Ask AT Specialist...',
    
    // Disclaimer
    'disclaimer': 'MADA AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.',
    
    // Top nav
    'nav.models': 'Mô hình',
    'nav.api': 'API',
    'nav.docs': 'Tài liệu',
    'nav.language': 'Ngôn ngữ',
  },

  en: {
    // Navigation
    'nav.model': 'Model',
    'nav.intelligence': 'Intelligence',
    'nav.standards': 'Standards',
    'nav.connect': 'Connect',
    'nav.pricing': 'Pricing',
    
    // Auth
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.register': 'Register',
    'auth.profile': 'Profile',
    'auth.tryFree': 'Try Free',
    
    // Menu
    'menu.admin': 'Admin Panel',
    'menu.upgrade': 'Upgrade Plan',
    'menu.settings': 'Settings',
    
    // Chat UI
    'chat.title': 'MADA AI Assistant',
    'chat.placeholder': 'Ask about assistive devices for disabilities...',
    'chat.send': 'Send',
    'chat.thinking': 'Thinking...',
    'chat.error': 'An error occurred',
    'chat.retry': 'Retry',
    'chat.newChat': 'New Chat',
    'chat.search': 'Search conversations...',
    'chat.noHistory': 'No conversations yet',
    'chat.startChat': 'Start chatting to save history automatically',
    'chat.recentHistory': 'Recent History',
    'chat.notFound': 'Not found',
    'chat.sendFile': 'Send Consultation Request',
    'chat.sending': 'Sending...',
    
    // Welcome
    'welcome.title': 'MADA AI Assistant',
    'welcome.subtitle': 'AI-powered Assistive Technology consultation system',
    'welcome.hint': 'Ask me about AT devices that suit your needs',
    'welcome.examples': 'Explore now',
    'welcome.tip': 'Tip: Press',
    'welcome.tipKey': 'Ctrl + Enter',
    'welcome.tipAction': 'to send quickly',
    'welcome.pressAsk': 'Press to ask',
    'welcome.askNow': 'Ask now',
    'welcome.suggestions': 'Quick suggestions',
    'welcome.tapAsk': 'Tap to ask',
    'welcome.close': 'Close suggestions',
    
    // Categories
    'cat.vision': 'Vision',
    'cat.hearing': 'Hearing',
    'cat.mobility': 'Mobility',
    'cat.cognition': 'Cognition',
    'cat.communication': 'Communication',
    'cat.daily': 'Daily Living',
    'cat.education': 'Education',
    'cat.info': 'Supplementary Info',
    
    // Category full names
    'cat.vision.full': 'VISION SENSORY',
    'cat.hearing.full': 'HEARING SENSORY',
    'cat.mobility.full': 'NEUROMUSCULAR',
    'cat.cognition.full': 'COGNITIVE',
    'cat.communication.full': 'SPEECH & VOICE',
    'cat.daily.full': 'MOBILITY',
    'cat.education.full': 'EDUCATION',
    
    // Sources
    'sources.title': 'References',
    'sources.noSources': 'No sources',
    
    // Safety
    'safety.medical.title': 'Warning',
    'safety.medical.message': 'I am not a doctor. For medical issues, please consult a healthcare professional.',
    'safety.medical.ok': 'I understand',
    
    // Consultation
    'consult.title': 'Expert Consultation Request',
    'consult.subtitle': 'MADA Center, Doha, Qatar',
    'consult.name': 'Full Name',
    'consult.email': 'Email',
    'consult.phone': 'Phone Number',
    'consult.request': 'Technical Requirements',
    'consult.placeholder': 'Describe your assistive technology needs in detail...',
    'consult.note': 'AT specialist will contact within 24-48 hours',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.noData': 'No data',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.attach': 'Attach',
    'common.upload': 'Upload file',
    
    // Products
    'products.recommended': 'Recommended Devices',
    'products.learnMore': 'Learn more',
    'products.vision': 'Vision Support',
    'products.hearing': 'Hearing Support',
    'products.mobility': 'Mobility Support',
    'products.cognition': 'Cognition Support',
    'products.communication': 'Communication Devices',
    'products.daily': 'Daily Living',
    'products.education': 'Education Support',
    'products.at': 'AT Devices',
    
    // Standards
    'standards.title': 'Technical Standards',
    'standards.technical': 'Technical Standards',
    
    // Confidence
    'confidence.label': 'Confidence',
    
    // View modes
    'view.endUser': 'End User',
    'view.specialist': 'Specialist',
    'view.endUserTip': 'End User - Friendly mode',
    'view.specialistTip': 'AT Specialist - Deep mode',
    
    // Consultation button
    'consult.button': 'Request Specialist',
    
    // Message actions
    'message.speak': 'Read message',
    'message.stopSpeaking': 'Stop reading',
    'message.copy': 'Copy',
    'message.copied': 'Copied!',
    'message.like': 'Like',
    'message.dislike': 'Dislike',
    'message.sources': 'View sources',
    'message.rag': 'RAG',
    
    // Agent labels
    'agent.select': 'Select Agent',
    'agent.premium': 'Premium Intelligence',
    'agent.specialist': 'AT Specialist Mode',
    
    // Input
    'input.placeholder.endUser': 'Message MADA AI...',
    'input.placeholder.specialist': 'Ask AT Specialist...',
    
    // Disclaimer
    'disclaimer': 'MADA AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.',
    
    // Top nav
    'nav.models': 'Models',
    'nav.api': 'API',
    'nav.docs': 'Docs',
    'nav.language': 'Language',
  },

  ar: {
    // Navigation
    'nav.model': 'النموذج',
    'nav.intelligence': 'الذكاء',
    'nav.standards': 'المعايير',
    'nav.connect': 'الاتصال',
    'nav.pricing': 'الأسعار',
    
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.logout': 'تسجيل الخروج',
    'auth.register': 'التسجيل',
    'auth.profile': 'الملف الشخصي',
    'auth.tryFree': 'جرّب مجاناً',
    
    // Menu
    'menu.admin': 'لوحة الإدارة',
    'menu.upgrade': 'ترقية الخطة',
    'menu.settings': 'الإعدادات',
    
    // Chat UI
    'chat.title': 'مساعد MADA AI',
    'chat.placeholder': 'اسأل عن أجهزة المساعدة لذوي الإعاقة...',
    'chat.send': 'إرسال',
    'chat.thinking': 'جارٍ التفكير...',
    'chat.error': 'حدث خطأ',
    'chat.retry': 'إعادة المحاولة',
    'chat.newChat': 'محادثة جديدة',
    'chat.search': 'البحث في المحادثات...',
    'chat.noHistory': 'لا توجد محادثات بعد',
    'chat.startChat': 'ابدأ المحادثة لحفظ السجل تلقائياً',
    'chat.recentHistory': 'السجل الأخير',
    'chat.notFound': 'غير موجود',
    'chat.sendFile': 'إرسال طلب الاستشارة',
    'chat.sending': 'جارٍ الإرسال...',
    
    // Welcome
    'welcome.title': 'مساعد MADA AI',
    'welcome.subtitle': 'نظام استشارة التكنولوجيا المساعدة بالذكاء الاصطناعي',
    'welcome.hint': 'اسألني عن أجهزة AT المناسبة لك',
    'welcome.examples': 'استكشف الآن',
    'welcome.tip': 'تلميح: اضغط',
    'welcome.tipKey': 'Ctrl + Enter',
    'welcome.tipAction': 'للإرسال السريع',
    'welcome.pressAsk': 'اضغط للسؤال',
    'welcome.askNow': 'اسأل الآن',
    'welcome.suggestions': 'اقتراحات سريعة',
    'welcome.tapAsk': 'انقر للسؤال',
    'welcome.close': 'إغلاق الاقتراحات',
    
    // Categories
    'cat.vision': 'البصر',
    'cat.hearing': 'السمع',
    'cat.mobility': 'الحركة',
    'cat.cognition': 'الإدراك',
    'cat.communication': 'التواصل',
    'cat.daily': 'الحياة اليومية',
    'cat.education': 'التعليم',
    'cat.info': 'معلومات إضافية',
    
    // Category full names
    'cat.vision.full': 'الحساس البصري',
    'cat.hearing.full': 'الحساس السمعي',
    'cat.mobility.full': 'العصبي العضلي',
    'cat.cognition.full': 'الإدراكي',
    'cat.communication.full': 'الكلام والصوت',
    'cat.daily.full': 'التنقل',
    'cat.education.full': 'التعليم',
    
    // Sources
    'sources.title': 'المراجع',
    'sources.noSources': 'لا توجد مراجع',
    
    // Safety
    'safety.medical.title': 'تحذير',
    'safety.medical.message': 'أنا لست طبيباً. للمشاكل الطبية، يرجى استشارة متخصص.',
    'safety.medical.ok': 'أفهم',
    
    // Consultation
    'consult.title': 'طلب استشارة خبير',
    'consult.subtitle': 'مركز MADA، الدوحة، قطر',
    'consult.name': 'الاسم الكامل',
    'consult.email': 'البريد الإلكتروني',
    'consult.phone': 'رقم الهاتف',
    'consult.request': 'المتطلبات التقنية',
    'consult.placeholder': 'صف احتياجاتك من التكنولوجيا المساعدة بالتفصيل...',
    'consult.note': 'سيتواصل معك متخصص AT خلال 24-48 ساعة',
    
    // Common
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.search': 'بحث',
    'common.loading': 'جارٍ التحميل...',
    'common.noData': 'لا توجد بيانات',
    'common.success': 'نجاح',
    'common.error': 'خطأ',
    'common.attach': 'إرفاق',
    'common.upload': 'رفع ملف',
    
    // Products
    'products.recommended': 'الأجهزة الموصى بها',
    'products.learnMore': 'اعرف المزيد',
    'products.vision': 'دعم البصر',
    'products.hearing': 'دعم السمع',
    'products.mobility': 'دعم الحركة',
    'products.cognition': 'دعم الإدراك',
    'products.communication': 'أجهزة التواصل',
    'products.daily': 'الحياة اليومية',
    'products.education': 'دعم التعليم',
    'products.at': 'أجهزة AT',
    
    // Standards
    'standards.title': 'المعايير التقنية',
    'standards.technical': 'المعايير التقنية',
    
    // Confidence
    'confidence.label': 'الثقة',
    
    // View modes
    'view.endUser': 'مستخدم',
    'view.specialist': 'خبير',
    'view.endUserTip': 'مستخدم - الوضع الودي',
    'view.specialistTip': 'خبير AT - الوضع المتقدم',
    
    // Consultation button
    'consult.button': 'طلب خبير',
    
    // Message actions
    'message.speak': 'قراءة الرسالة',
    'message.stopSpeaking': 'إيقاف القراءة',
    'message.copy': 'نسخ',
    'message.copied': 'تم النسخ!',
    'message.like': 'إعجاب',
    'message.dislike': 'عدم الإعجاب',
    'message.sources': 'عرض المصادر',
    'message.rag': 'RAG',
    
    // Agent labels
    'agent.select': 'اختر الوكيل',
    'agent.premium': 'ذكاء متميز',
    'agent.specialist': 'وضع خبير AT',
    
    // Input
    'input.placeholder.endUser': 'رسالة MADA AI...',
    'input.placeholder.specialist': 'اسأل الخبير...',
    
    // Disclaimer
    'disclaimer': 'MADA AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.',
    
    // Top nav
    'nav.models': 'النماذج',
    'nav.api': 'API',
    'nav.docs': 'الوثائق',
    'nav.language': 'اللغة',
  },

  fr: {
    // Navigation
    'nav.model': 'Modèle',
    'nav.intelligence': 'Intelligence',
    'nav.standards': 'Normes',
    'nav.connect': 'Connexion',
    'nav.pricing': 'Tarifs',
    
    // Auth
    'auth.login': 'Connexion',
    'auth.logout': 'Déconnexion',
    'auth.register': "S'inscrire",
    'auth.profile': 'Profil',
    'auth.tryFree': 'Essayer gratuit',
    
    // Menu
    'menu.admin': "Panneau d'admin",
    'menu.upgrade': 'Plan superior',
    'menu.settings': 'Paramètres',
    
    // Chat UI
    'chat.title': 'Assistant MADA AI',
    'chat.placeholder': 'Questions sur les appareils d\'assistance...',
    'chat.send': 'Envoyer',
    'chat.thinking': 'Réflexion...',
    'chat.error': 'Une erreur est survenue',
    'chat.retry': 'Réessayer',
    'chat.newChat': 'Nouvelle conversation',
    'chat.search': 'Rechercher des conversations...',
    'chat.noHistory': 'Pas encore de conversations',
    'chat.startChat': 'Commencez à discuter pour sauvegarder automatiquement',
    'chat.recentHistory': 'Historique récent',
    'chat.notFound': 'Non trouvé',
    'chat.sendFile': 'Envoyer la demande de consultation',
    'chat.sending': 'Envoi en cours...',
    
    // Welcome
    'welcome.title': 'Assistant MADA AI',
    'welcome.subtitle': "Système de consultation en technologie d'assistance par IA",
    'welcome.hint': 'Demandez-moi les appareils AT qui vous conviennent',
    'welcome.examples': 'Explorer maintenant',
    'welcome.tip': 'Astuce: Appuyez sur',
    'welcome.tipKey': 'Ctrl + Entrée',
    'welcome.tipAction': 'pour envoyer rapidement',
    'welcome.pressAsk': 'Appuyez pour demander',
    'welcome.askNow': 'Demander maintenant',
    'welcome.suggestions': 'Suggestions rapides',
    'welcome.tapAsk': 'Appuyez pour demander',
    'welcome.close': 'Fermer les suggestions',
    
    // Categories
    'cat.vision': 'Vision',
    'cat.hearing': 'Audition',
    'cat.mobility': 'Mobilité',
    'cat.cognition': 'Cognition',
    'cat.communication': 'Communication',
    'cat.daily': 'Vie quotidienne',
    'cat.education': 'Éducation',
    'cat.info': 'Informations supplémentaires',
    
    // Category full names
    'cat.vision.full': 'SENSORIEL VISION',
    'cat.hearing.full': 'SENSORIEL AUDITION',
    'cat.mobility.full': 'NEUROMUSCULAIRE',
    'cat.cognition.full': 'COGNITIF',
    'cat.communication.full': 'PAROLE ET VOIX',
    'cat.daily.full': 'MOBILITÉ',
    'cat.education.full': 'ÉDUCATION',
    
    // Sources
    'sources.title': 'Références',
    'sources.noSources': 'Pas de références',
    
    // Safety
    'safety.medical.title': 'Avertissement',
    'safety.medical.message': 'Je ne suis pas médecin. Pour les problèmes médicaux, consultez un professionnel.',
    'safety.medical.ok': 'Je comprends',
    
    // Consultation
    'consult.title': 'Demande de consultation expert',
    'consult.subtitle': 'Centre MADA, Doha, Qatar',
    'consult.name': 'Nom complet',
    'consult.email': 'Email',
    'consult.phone': 'Numéro de téléphone',
    'consult.request': 'Exigences techniques',
    'consult.placeholder': 'Décrivez vos besoins en technologie d\'assistance en détail...',
    'consult.note': 'Un spécialiste AT vous contactera dans 24-48 heures',
    
    // Common
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.add': 'Ajouter',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'common.noData': 'Pas de données',
    'common.success': 'Succès',
    'common.error': 'Erreur',
    'common.attach': 'Joindre',
    'common.upload': 'Télécharger un fichier',
    
    // Products
    'products.recommended': 'Appareils recommandés',
    'products.learnMore': 'En savoir plus',
    'products.vision': 'Support visuel',
    'products.hearing': 'Support auditif',
    'products.mobility': 'Support mobilité',
    'products.cognition': 'Support cognitif',
    'products.communication': 'Appareils de communication',
    'products.daily': 'Vie quotidienne',
    'products.education': 'Support éducatif',
    'products.at': 'Appareils AT',
    
    // Standards
    'standards.title': 'Normes techniques',
    'standards.technical': 'Normes techniques',
    
    // Confidence
    'confidence.label': 'Confiance',
    
    // View modes
    'view.endUser': 'Utilisateur',
    'view.specialist': 'Spécialiste',
    'view.endUserTip': 'Utilisateur - Mode amical',
    'view.specialistTip': 'Spécialiste AT - Mode approfondi',
    
    // Consultation button
    'consult.button': 'Demander un spécialiste',
    
    // Message actions
    'message.speak': 'Lire le message',
    'message.stopSpeaking': 'Arrêter la lecture',
    'message.copy': 'Copier',
    'message.copied': 'Copié!',
    'message.like': 'Aimer',
    'message.dislike': 'Ne pas aimer',
    'message.sources': 'Voir les sources',
    'message.rag': 'RAG',
    
    // Agent labels
    'agent.select': 'Sélectionner Agent',
    'agent.premium': 'Intelligence Premium',
    'agent.specialist': 'Mode Spécialiste AT',
    
    // Input
    'input.placeholder.endUser': 'Message MADA AI...',
    'input.placeholder.specialist': 'Demander au spécialiste...',
    
    // Disclaimer
    'disclaimer': 'MADA AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.',
    
    // Top nav
    'nav.models': 'Modèles',
    'nav.api': 'API',
    'nav.docs': 'Docs',
    'nav.language': 'Langue',
  },
} as const;

// Type for translation keys
export type TranslationKey = keyof typeof translations.en;

// Simple translation function
export function t(key: TranslationKey, language: Language = 'vi'): string {
  return translations[language]?.[key] || translations.vi[key] || key;
}

// React hook for translations
import { useLanguageStore } from '@/stores';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language) as Language;
  
  return {
    t: (key: TranslationKey) => t(key, language),
    language,
  };
}
