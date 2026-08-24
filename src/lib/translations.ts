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
    'safety.medical.title': 'Thông báo quan trọng',
    'safety.medical.message': 'Tôi là trợ lý AI về Công nghệ Hỗ trợ (AT). Về các vấn đề sức khỏe cá nhân, vui lòng tham khảo chuyên gia y tế có chuyên môn.',
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
    
    // Footer
    'disclaimer': 'MADA AI - HỖ TRỢ TƯ VẤN CHUYÊN GIA AT',
    'poweredBy': 'Được hỗ trợ bởi Multi-modal AI & RAG Framework',
    
    // Top nav
    'nav.models': 'Mô hình',
    'nav.api': 'API',
    'nav.docs': 'Tài liệu',
    'nav.language': 'Ngôn ngữ',

    // Landing page
    'landing.badge': 'Thế hệ trợ lý tiếp theo',
    'landing.title': 'Trí tuệ hỗ trợ MADA',
    'landing.desc': 'Kiến trúc AI chuyên biệt cho Công nghệ Hỗ trợ, hội tụ tinh hoa từ ISO 9999, WCAG 2.2 và chiến lược toàn cầu WHO GATE.',
    'landing.ctaPrimary': 'Bắt đầu hội thoại',
    'landing.ctaSecondary': 'Khám phá tính năng',
    'landing.trust': 'Được tin dùng bởi',
    'landing.statsUsers': 'Người dùng',
    'landing.statsConvos': 'Cuộc hội thoại',
    'landing.statsAccuracy': 'Độ chính xác',
    'landing.statsCategories': 'Danh mục AT',
    'landing.featuresBadge': 'Khả năng cốt lõi',
    'landing.featuresTitle': 'Tính năng nổi bật',
    'landing.feat1Title': 'Trò chuyện thông minh',
    'landing.feat1Desc': 'Hỗ trợ ngôn ngữ tự nhiên, hiểu ngữ cảnh y tế và kỹ thuật hỗ trợ chuyên sâu.',
    'landing.feat2Title': 'Nhận diện thiết bị',
    'landing.feat2Desc': 'Phân tích hình ảnh và mô tả để xác định các thiết bị hỗ trợ tối ưu.',
    'landing.feat3Title': 'Tra cứu tiêu chuẩn',
    'landing.feat3Desc': 'Truy xuất tức thì các thông số kỹ thuật từ thư viện ISO 9999 và WCAG.',
    'landing.feat4Title': 'Đa ngôn ngữ',
    'landing.feat4Desc': 'Hỗ trợ Tiếng Việt, Anh, Pháp, Ả-rập — chuyển đổi tức thì.',
    'landing.feat5Title': 'Gợi ý sản phẩm AT',
    'landing.feat5Desc': 'Đề xuất thiết bị hỗ trợ phù hợp từ cơ sở dữ liệu MADA.',
    'landing.feat6Title': 'Bảo mật & Riêng tư',
    'landing.feat6Desc': 'Mã hoá AES-256, tuân thủ GDPR và Nghị định 13/2023/NĐ-CP.',
    'landing.howTitle': 'Quy trình hoạt động',
    'landing.how1Title': 'Đặt câu hỏi',
    'landing.how1Desc': 'Gửi yêu cầu qua văn bản, giọng nói hoặc hình ảnh về nhu cầu hỗ trợ của bạn.',
    'landing.how2Title': 'Phân tích dữ liệu',
    'landing.how2Desc': 'MADA quét qua hàng triệu tài liệu tiêu chuẩn ISO và WHO để tìm sự tương thích.',
    'landing.how3Title': 'Giải pháp chuẩn hoá',
    'landing.how3Desc': 'Nhận báo cáo chi tiết về thiết bị, hướng dẫn sử dụng và lộ trình phù hợp.',
    'landing.standardsTitle': 'Tiêu chuẩn vàng',
    'landing.isoTitle': 'ISO 9999',
    'landing.isoDesc': 'Hệ thống mã hóa 6 chữ số chuẩn quốc tế để phân loại mọi sản phẩm hỗ trợ.',
    'landing.wcagTitle': 'WCAG 2.2',
    'landing.wcagDesc': 'Giao diện và nội dung được tối ưu hóa cho tất cả các mức độ tiếp cận AAA.',
    'landing.ctaFinalTitle': 'Sẵn sàng nâng cao trải nghiệm hỗ trợ?',
    'landing.ctaFinalDesc': 'Bắt đầu miễn phí — không cần thẻ tín dụng. Tích hợp trong 5 phút.',
    'landing.ctaFinalButton': 'Dùng thử miễn phí',

    // Pricing page
    'pricing.badge': 'Bảng giá',
    'pricing.title': 'Chọn gói phù hợp',
    'pricing.titleHighlight': 'với nhu cầu của bạn',
    'pricing.subtitle': 'Bắt đầu miễn phí. Nâng cấp lên Pro để mở khóa toàn bộ sức mạnh MADA AI.',
    'pricing.monthly': 'Hàng tháng',
    'pricing.yearly': 'Hàng năm',
    'pricing.saveNote': 'Tiết kiệm 20%',
    'pricing.ctaFree': 'Bắt đầu miễn phí',
    'pricing.ctaPro': 'Nâng cấp Pro ngay',
    'pricing.ctaEnterprise': 'Liên hệ tư vấn',
    'pricing.ctaCurrent': 'Đang dùng — Tiếp tục',
    'pricing.processing': 'Đang xử lý...',
    'pricing.popular': 'Phổ biến nhất',
    'pricing.compareTitle': 'So sánh tính năng',
    'pricing.featCol': 'Tính năng',
    'pricing.note': 'Tất cả gói đều bao gồm cập nhật miễn phí & hỗ trợ qua email. Thanh toán an toàn qua Stripe / PayPal / VNPay.',
    'pricing.faqTitle': 'Câu hỏi thường gặp',
    'pricing.faq1Q': 'MADA AI có hỗ trợ tiếng Việt không?',
    'pricing.faq1A': 'Có. MADA AI được tối ưu hoàn toàn cho tiếng Việt, đồng thời hỗ trợ tiếng Anh, Pháp và tiếng Ả-rập. Bạn có thể chuyển đổi ngôn ngữ bất kỳ lúc nào trong cài đặt.',
    'pricing.faq2Q': 'Tôi có thể hủy gói Pro bất kỳ lúc nào không?',
    'pricing.faq2A': 'Được. Bạn có thể hủy gói Pro bất kỳ lúc nào trong phần Cài đặt tài khoản. Gói sẽ vẫn active đến hết chu kỳ thanh toán hiện tại.',
    'pricing.faq3Q': 'Dữ liệu của tôi có được bảo mật không?',
    'pricing.faq3A': 'Tuyệt đối. Toàn bộ cuộc trò chuyện được mã hoá AES-256. Chúng tôi không bán dữ liệu cho bên thứ ba và tuân thủ GDPR + Nghị định 13/2023/NĐ-CP của Việt Nam.',
    'pricing.faq4Q': 'Gói Enterprise có triển khai on-premise không?',
    'pricing.faq4A': 'Có. Gói Enterprise hỗ trợ triển khai on-premise cho các tổ chức yêu cầu bảo mật dữ liệu tuyệt đối. Liên hệ sales@mada.ai để được tư vấn chi tiết.',
    'pricing.faq5Q': 'Có dùng thử miễn phí gói Pro không?',
    'pricing.faq5A': 'Có. Khi đăng ký lần đầu, bạn nhận 7 ngày dùng thử Pro miễn phí — không cần thẻ tín dụng. Sau 7 ngày bạn có thể tiếp tục dùng Free hoặc nâng cấp Pro.',
    'pricing.faq6Q': 'Phương thức thanh toán nào được hỗ trợ?',
    'pricing.faq6A': 'Chúng tôi chấp nhận thẻ tín dụng quốc tế (Visa/Mastercard), PayPal, chuyển khoản ngân hàng nội địa và VNPay. Hoá đơn VAT cho doanh nghiệp được cấp tự động.',
    'pricing.faq7Q': 'Tôi có thể chuyển đổi giữa các gói không?',
    'pricing.faq7A': 'Được. Bạn có thể nâng cấp hoặc hạ gói bất kỳ lúc nào. Khi nâng cấp, phần chênh lệch sẽ được tính theo tỷ lệ thời gian còn lại.',

    // Plan features
    'pricing.freeDesc': 'Trải nghiệm MADA AI cơ bản cho người dùng cá nhân.',
    'pricing.proDesc': 'Dành cho chuyên gia AT và người dùng thường xuyên.',
    'pricing.enterpriseDesc': 'Giải pháp cho tổ chức, trường học, bệnh viện, chính phủ.',
    'pricing.freeF1': '10 lượt trò chuyện miễn phí',
    'pricing.freeF2': 'Truy cập 7 danh mục AT chuẩn ISO 9999',
    'pricing.freeF3': 'Tra cứu tiêu chuẩn ISO/WCAG/WHO',
    'pricing.freeF4': 'Gợi ý sản phẩm AT phù hợp',
    'pricing.freeF5': 'Hỗ trợ qua cộng đồng',
    'pricing.proF1': 'Không giới hạn lượt trò chuyện',
    'pricing.proF2': 'Phân tích chuyên sâu theo ISO 9999',
    'pricing.proF3': 'Xuất báo cáo PDF chuyên nghiệp',
    'pricing.proF4': 'Lịch sử hội thoại không giới hạn',
    'pricing.proF5': 'Hỗ trợ ưu tiên 24/7',
    'pricing.proF6': 'Tích hợp API nâng cao',
    'pricing.proF7': 'Truy cập sớm tính năng mới',
    'pricing.entF1': 'Mọi tính năng của Pro',
    'pricing.entF2': 'Dashboard quản trị đa người dùng',
    'pricing.entF3': 'Tùy chỉnh tri thức & dữ liệu riêng',
    'pricing.entF4': 'SLA 99.9% & bảo mật cấp doanh nghiệp',
    'pricing.entF5': 'Đào tạo chuyên gia AT chuyên trách',
    'pricing.entF6': 'Triển khai on-premise tùy chọn',
    'pricing.entF7': 'Hỗ trợ riêng 24/7 qua hotline',

    // Compare table
    'pricing.cmpChats': 'Lượt trò chuyện',
    'pricing.cmpCategories': 'Danh mục AT (ISO 9999)',
    'pricing.cmpStandards': 'Tiêu chuẩn ISO/WCAG/WHO',
    'pricing.cmpPdf': 'Xuất báo cáo PDF',
    'pricing.cmpHistory': 'Lịch sử hội thoại',
    'pricing.cmpSupport': 'Hỗ trợ ưu tiên',
    'pricing.cmpOnPremise': 'Triển khai on-premise',
    'pricing.cmpSLA': 'SLA',
    'pricing.cmpUnlimited': 'Không giới hạn',
    'pricing.cmpDeep': 'Chuyên sâu',
    'pricing.cmpCustom': 'Tùy chỉnh',
    'pricing.days': 'ngày',

    // Trust strip
    'pricing.trust1': 'Bảo mật cấp ngân hàng',
    'pricing.trust2': 'Hỗ trợ 24/7',
    'pricing.trust3': 'Đa ngôn ngữ',
    'pricing.trust4': 'Cập nhật liên tục',
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
    'safety.medical.title': 'Important Notice',
    'safety.medical.message': 'I am an AI assistant for assistive technology information. For personal health-related questions, please consult a qualified specialist.',
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
    'poweredBy': 'Powered by Multi-modal AI & RAG Framework',
    
    // Top nav
    'nav.models': 'Models',
    'nav.api': 'API',
    'nav.docs': 'Docs',
    'nav.language': 'Language',

    // Landing page
    'landing.badge': 'Next-gen assistant',
    'landing.title': 'MADA Assistive Intelligence',
    'landing.desc': 'AI architecture specialized for Assistive Technology, combining ISO 9999, WCAG 2.2 and the WHO GATE global strategy.',
    'landing.ctaPrimary': 'Start chatting',
    'landing.ctaSecondary': 'Explore features',
    'landing.trust': 'Trusted by',
    'landing.statsUsers': 'Users',
    'landing.statsConvos': 'Conversations',
    'landing.statsAccuracy': 'Accuracy',
    'landing.statsCategories': 'AT Categories',
    'landing.featuresBadge': 'Core capabilities',
    'landing.featuresTitle': 'Key features',
    'landing.feat1Title': 'Smart conversations',
    'landing.feat1Desc': 'Natural language understanding with deep medical and assistive tech context.',
    'landing.feat2Title': 'Device recognition',
    'landing.feat2Desc': 'Analyze images and descriptions to identify optimal assistive devices.',
    'landing.feat3Title': 'Standard lookup',
    'landing.feat3Desc': 'Instant retrieval of technical specs from ISO 9999 and WCAG libraries.',
    'landing.feat4Title': 'Multilingual',
    'landing.feat4Desc': 'Supports Vietnamese, English, French, Arabic — switch instantly.',
    'landing.feat5Title': 'AT product suggestions',
    'landing.feat5Desc': 'Recommend matching assistive devices from the MADA database.',
    'landing.feat6Title': 'Security & Privacy',
    'landing.feat6Desc': 'AES-256 encryption, GDPR and Decree 13/2023/NĐ-CP compliant.',
    'landing.howTitle': 'How it works',
    'landing.how1Title': 'Ask a question',
    'landing.how1Desc': 'Send your request via text, voice or image about your support needs.',
    'landing.how2Title': 'Analyze data',
    'landing.how2Desc': 'MADA scans millions of ISO and WHO documents for the best match.',
    'landing.how3Title': 'Standardized solution',
    'landing.how3Desc': 'Get detailed device reports, usage instructions and a fitting roadmap.',
    'landing.standardsTitle': 'Gold standards',
    'landing.isoTitle': 'ISO 9999',
    'landing.isoDesc': 'The international 6-digit coding system to classify all assistive products.',
    'landing.wcagTitle': 'WCAG 2.2',
    'landing.wcagDesc': 'Interface and content optimized for all AAA accessibility levels.',
    'landing.ctaFinalTitle': 'Ready to elevate the support experience?',
    'landing.ctaFinalDesc': 'Start free — no credit card required. Set up in 5 minutes.',
    'landing.ctaFinalButton': 'Try it free',

    // Pricing page
    'pricing.badge': 'Pricing',
    'pricing.title': 'Pick the right plan',
    'pricing.titleHighlight': 'for your needs',
    'pricing.subtitle': 'Start for free. Upgrade to Pro to unlock the full power of MADA AI.',
    'pricing.monthly': 'Monthly',
    'pricing.yearly': 'Yearly',
    'pricing.saveNote': 'Save 20%',
    'pricing.ctaFree': 'Start free',
    'pricing.ctaPro': 'Upgrade to Pro',
    'pricing.ctaEnterprise': 'Contact sales',
    'pricing.ctaCurrent': 'Current plan — Continue',
    'pricing.processing': 'Processing...',
    'pricing.popular': 'Most popular',
    'pricing.compareTitle': 'Compare features',
    'pricing.featCol': 'Feature',
    'pricing.note': 'All plans include free updates & email support. Secure payments via Stripe / PayPal / VNPay.',
    'pricing.faqTitle': 'Frequently asked questions',
    'pricing.faq1Q': 'Does MADA AI support Vietnamese?',
    'pricing.faq1A': 'Yes. MADA AI is fully optimized for Vietnamese, and also supports English, French and Arabic. You can switch languages anytime in settings.',
    'pricing.faq2Q': 'Can I cancel Pro anytime?',
    'pricing.faq2A': 'Yes. You can cancel Pro anytime in your account settings. The plan stays active until the end of the current billing cycle.',
    'pricing.faq3Q': 'Is my data secure?',
    'pricing.faq3A': 'Absolutely. All conversations are AES-256 encrypted. We do not sell data to third parties and comply with GDPR and Decree 13/2023/NĐ-CP of Vietnam.',
    'pricing.faq4Q': 'Does Enterprise offer on-premise deployment?',
    'pricing.faq4A': 'Yes. Enterprise supports on-premise deployment for organizations with strict data security needs. Contact sales@mada.ai for details.',
    'pricing.faq5Q': 'Is there a free trial for Pro?',
    'pricing.faq5A': 'Yes. On first sign-up you get a 7-day Pro free trial — no credit card required. After 7 days you can keep using Free or upgrade to Pro.',
    'pricing.faq6Q': 'Which payment methods are supported?',
    'pricing.faq6A': 'We accept international credit cards (Visa/Mastercard), PayPal, domestic bank transfer and VNPay. VAT invoices for businesses are issued automatically.',
    'pricing.faq7Q': 'Can I switch between plans?',
    'pricing.faq7A': 'Yes. You can upgrade or downgrade anytime. When upgrading, the price difference is prorated for the remaining time.',

    // Plan features
    'pricing.freeDesc': 'Basic MADA AI experience for personal users.',
    'pricing.proDesc': 'For AT specialists and frequent users.',
    'pricing.enterpriseDesc': 'Solution for organizations, schools, hospitals, governments.',
    'pricing.freeF1': '10 free conversations',
    'pricing.freeF2': 'Access 7 AT categories (ISO 9999)',
    'pricing.freeF3': 'Lookup ISO/WCAG/WHO standards',
    'pricing.freeF4': 'Personalized AT product suggestions',
    'pricing.freeF5': 'Community support',
    'pricing.proF1': 'Unlimited conversations',
    'pricing.proF2': 'In-depth ISO 9999 analysis',
    'pricing.proF3': 'Export professional PDF reports',
    'pricing.proF4': 'Unlimited conversation history',
    'pricing.proF5': 'Priority 24/7 support',
    'pricing.proF6': 'Advanced API integration',
    'pricing.proF7': 'Early access to new features',
    'pricing.entF1': 'Everything in Pro',
    'pricing.entF2': 'Multi-user admin dashboard',
    'pricing.entF3': 'Custom knowledge & private data',
    'pricing.entF4': '99.9% SLA & enterprise-grade security',
    'pricing.entF5': 'Dedicated AT specialist training',
    'pricing.entF6': 'On-premise deployment option',
    'pricing.entF7': 'Dedicated 24/7 hotline support',

    // Compare table
    'pricing.cmpChats': 'Conversations',
    'pricing.cmpCategories': 'AT Categories (ISO 9999)',
    'pricing.cmpStandards': 'ISO/WCAG/WHO Standards',
    'pricing.cmpPdf': 'PDF report export',
    'pricing.cmpHistory': 'Conversation history',
    'pricing.cmpSupport': 'Priority support',
    'pricing.cmpOnPremise': 'On-premise deployment',
    'pricing.cmpSLA': 'SLA',
    'pricing.cmpUnlimited': 'Unlimited',
    'pricing.cmpDeep': 'Advanced',
    'pricing.cmpCustom': 'Custom',
    'pricing.days': 'days',

    // Trust strip
    'pricing.trust1': 'Bank-grade security',
    'pricing.trust2': '24/7 support',
    'pricing.trust3': 'Multilingual',
    'pricing.trust4': 'Continuous updates',
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
    'safety.medical.title': 'تنبيه مهم',
    'safety.medical.message': 'أنا مساعد ذكاء اصطناعي متخصص في تكنولوجيا المساعدة (AT). للاستفسارات الصحية الشخصية، يرجى استشارة أخصائي مؤهل.',
    'safety.medical.ok': 'فهمت',
    
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
    'poweredBy': 'مدعوم من Multi-modal AI و RAG Framework',
    
    // Top nav
    'nav.models': 'النماذج',
    'nav.api': 'API',
    'nav.docs': 'الوثائق',
    'nav.language': 'اللغة',

    // Landing page
    'landing.badge': 'الجيل القادم من المساعدات',
    'landing.title': 'ذكاء مada للمساعدة',
    'landing.desc': 'بنية ذكاء اصطناعي متخصصة في تكنولوجيا المساعدة، تجمع بين ISO 9999 و WCAG 2.2 واستراتيجية WHO GATE العالمية.',
    'landing.ctaPrimary': 'ابدأ المحادثة',
    'landing.ctaSecondary': 'استكشف الميزات',
    'landing.trust': 'موثوق من قبل',
    'landing.statsUsers': 'المستخدمون',
    'landing.statsConvos': 'المحادثات',
    'landing.statsAccuracy': 'الدقة',
    'landing.statsCategories': 'فئات AT',
    'landing.featuresBadge': 'الإمكانات الأساسية',
    'landing.featuresTitle': 'الميزات الرئيسية',
    'landing.feat1Title': 'محادثات ذكية',
    'landing.feat1Desc': 'فهم اللغة الطبيعية بسياق طبي وتقني عميق.',
    'landing.feat2Title': 'التعرف على الأجهزة',
    'landing.feat2Desc': 'تحليل الصور والأوصاف لتحديد أجهزة المساعدة المثلى.',
    'landing.feat3Title': 'البحث في المعايير',
    'landing.feat3Desc': 'استرجاع فوري للمواصفات التقنية من مكتبات ISO 9999 و WCAG.',
    'landing.feat4Title': 'متعدد اللغات',
    'landing.feat4Desc': 'يدعم الفيتنامية والإنجليزية والفرنسية والعربية - تبديل فوري.',
    'landing.feat5Title': 'اقتراح منتجات AT',
    'landing.feat5Desc': 'اقتراح أجهزة مساعدة مطابقة من قاعدة بيانات MADA.',
    'landing.feat6Title': 'الأمان والخصوصية',
    'landing.feat6Desc': 'تشفير AES-256، متوافق مع GDPR.',
    'landing.howTitle': 'كيف تعمل',
    'landing.how1Title': 'اسأل سؤالاً',
    'landing.how1Desc': 'أرسل طلبك عبر نص أو صوت أو صورة حول احتياجات الدعم.',
    'landing.how2Title': 'تحليل البيانات',
    'landing.how2Desc': 'يمسح MADA ملايين وثائق ISO و WHO للعثور على أفضل تطابق.',
    'landing.how3Title': 'حل موحد',
    'landing.how3Desc': 'احصل على تقارير مفصلة وخارطة طريق مناسبة.',
    'landing.standardsTitle': 'المعايير الذهبية',
    'landing.isoTitle': 'ISO 9999',
    'landing.isoDesc': 'نظام الترميز الدولي المكون من 6 أرقام لتصنيف جميع منتجات المساعدة.',
    'landing.wcagTitle': 'WCAG 2.2',
    'landing.wcagDesc': 'واجهة ومحتوى محسّنان لجميع مستويات الوصول AAA.',
    'landing.ctaFinalTitle': 'هل أنت جاهز للارتقاء بتجربة الدعم؟',
    'landing.ctaFinalDesc': 'ابدأ مجاناً - لا حاجة لبطاقة ائتمان.',
    'landing.ctaFinalButton': 'جربه مجاناً',

    // Pricing page
    'pricing.badge': 'الأسعار',
    'pricing.title': 'اختر الخطة المناسبة',
    'pricing.titleHighlight': 'لاحتياجاتك',
    'pricing.subtitle': 'ابدأ مجاناً. قم بالترقية إلى Pro لفتح كامل قوة MADA AI.',
    'pricing.monthly': 'شهري',
    'pricing.yearly': 'سنوي',
    'pricing.saveNote': 'وفر 20%',
    'pricing.ctaFree': 'ابدأ مجاناً',
    'pricing.ctaPro': 'الترقية إلى Pro',
    'pricing.ctaEnterprise': 'اتصل بالمبيعات',
    'pricing.ctaCurrent': 'الخطة الحالية - استمرار',
    'pricing.processing': 'جاري المعالجة...',
    'pricing.popular': 'الأكثر شعبية',
    'pricing.compareTitle': 'مقارنة الميزات',
    'pricing.featCol': 'الميزة',
    'pricing.note': 'جميع الخطط تتضمن تحديثات مجانية ودعم البريد الإلكتروني. دفعات آمنة عبر Stripe / PayPal / VNPay.',
    'pricing.faqTitle': 'الأسئلة الشائعة',
    'pricing.faq1Q': 'هل تدعم MADA AI الفيتنامية؟',
    'pricing.faq1A': 'نعم. MADA AI محسّنة بالكامل للفيتنامية، وتدعم أيضاً الإنجليزية والفرنسية والعربية. يمكنك تبديل اللغة في أي وقت.',
    'pricing.faq2Q': 'هل يمكنني إلغاء Pro في أي وقت؟',
    'pricing.faq2A': 'نعم. يمكنك إلغاء Pro في أي وقت من إعدادات الحساب. تبقى الخطة نشطة حتى نهاية دورة الفوترة الحالية.',
    'pricing.faq3Q': 'هل بياناتي آمنة؟',
    'pricing.faq3A': 'بالتأكيد. جميع المحادثات مشفرة بـ AES-256. نحن لا نبيع البيانات لأطراف ثالثة ونمتثل لـ GDPR.',
    'pricing.faq4Q': 'هل Enterprise تدعم النشر المحلي؟',
    'pricing.faq4A': 'نعم. تدعم Enterprise النشر المحلي للمؤسسات ذات الاحتياجات الأمنية الصارمة. اتصل بـ sales@mada.ai.',
    'pricing.faq5Q': 'هل هناك تجربة مجانية لـ Pro؟',
    'pricing.faq5A': 'نعم. عند التسجيل لأول مرة تحصل على 7 أيام تجربة مجانية - بدون بطاقة ائتمان.',
    'pricing.faq6Q': 'ما هي طرق الدفع المدعومة؟',
    'pricing.faq6A': 'نقبل بطاقات الائتمان الدولية (Visa/Mastercard) و PayPal والتحويلات المصرفية المحلية و VNPay.',
    'pricing.faq7Q': 'هل يمكنني التبديل بين الخطط؟',
    'pricing.faq7A': 'نعم. يمكنك الترقية أو التخفيض في أي وقت.',

    // Plan features
    'pricing.freeDesc': 'تجربة MADA AI الأساسية للمستخدمين الشخصيين.',
    'pricing.proDesc': 'لمتخصصي AT والمستخدمين المتكررين.',
    'pricing.enterpriseDesc': 'حل للمنظمات والمدارس والمستشفيات والحكومات.',
    'pricing.freeF1': '10 محادثات مجانية',
    'pricing.freeF2': 'الوصول إلى 7 فئات AT (ISO 9999)',
    'pricing.freeF3': 'البحث في معايير ISO/WCAG/WHO',
    'pricing.freeF4': 'اقتراحات منتجات AT شخصية',
    'pricing.freeF5': 'دعم المجتمع',
    'pricing.proF1': 'محادثات غير محدودة',
    'pricing.proF2': 'تحليل معمق وفق ISO 9999',
    'pricing.proF3': 'تصدير تقارير PDF احترافية',
    'pricing.proF4': 'سجل محادثات غير محدود',
    'pricing.proF5': 'دعم ذو أولوية 24/7',
    'pricing.proF6': 'تكامل API متقدم',
    'pricing.proF7': 'وصول مبكر للميزات الجديدة',
    'pricing.entF1': 'كل ميزات Pro',
    'pricing.entF2': 'لوحة إدارة متعددة المستخدمين',
    'pricing.entF3': 'معرفة مخصصة وبيانات خاصة',
    'pricing.entF4': 'SLA 99.9% وأمان على مستوى المؤسسات',
    'pricing.entF5': 'تدريب متخصصي AT مخصص',
    'pricing.entF6': 'خيار النشر المحلي',
    'pricing.entF7': 'دعم خط ساخن 24/7',

    // Compare table
    'pricing.cmpChats': 'المحادثات',
    'pricing.cmpCategories': 'فئات AT (ISO 9999)',
    'pricing.cmpStandards': 'معايير ISO/WCAG/WHO',
    'pricing.cmpPdf': 'تصدير تقرير PDF',
    'pricing.cmpHistory': 'سجل المحادثات',
    'pricing.cmpSupport': 'دعم ذو أولوية',
    'pricing.cmpOnPremise': 'النشر المحلي',
    'pricing.cmpSLA': 'SLA',
    'pricing.cmpUnlimited': 'غير محدود',
    'pricing.cmpDeep': 'متقدم',
    'pricing.cmpCustom': 'مخصص',
    'pricing.days': 'أيام',

    // Trust strip
    'pricing.trust1': 'أمان على مستوى البنوك',
    'pricing.trust2': 'دعم 24/7',
    'pricing.trust3': 'متعدد اللغات',
    'pricing.trust4': 'تحديثات مستمرة',
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
    'safety.medical.title': 'Avis important',
    'safety.medical.message': 'Je suis un assistant IA spécialisé en technologies d\'assistance (AT). Pour toute question de santé personnelle, veuillez consulter un spécialiste qualifié.',
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
    'poweredBy': 'Alimenté par Multi-modal AI & RAG Framework',
    
    // Top nav
    'nav.models': 'Modèles',
    'nav.api': 'API',
    'nav.docs': 'Docs',
    'nav.language': 'Langue',

    // Landing page
    'landing.badge': 'Assistant nouvelle génération',
    'landing.title': 'Intelligence d\'assistance MADA',
    'landing.desc': 'Architecture IA spécialisée pour les technologies d\'assistance, combinant ISO 9999, WCAG 2.2 et la stratégie mondiale WHO GATE.',
    'landing.ctaPrimary': 'Démarrer la conversation',
    'landing.ctaSecondary': 'Explorer les fonctionnalités',
    'landing.trust': 'Ils nous font confiance',
    'landing.statsUsers': 'Utilisateurs',
    'landing.statsConvos': 'Conversations',
    'landing.statsAccuracy': 'Précision',
    'landing.statsCategories': 'Catégories AT',
    'landing.featuresBadge': 'Capacités principales',
    'landing.featuresTitle': 'Fonctionnalités clés',
    'landing.feat1Title': 'Conversations intelligentes',
    'landing.feat1Desc': 'Compréhension du langage naturel avec contexte médical et technique approfondi.',
    'landing.feat2Title': 'Reconnaissance d\'appareils',
    'landing.feat2Desc': 'Analyse d\'images et descriptions pour identifier les appareils optimaux.',
    'landing.feat3Title': 'Recherche de normes',
    'landing.feat3Desc': 'Récupération instantanée des spécifications ISO 9999 et WCAG.',
    'landing.feat4Title': 'Multilingue',
    'landing.feat4Desc': 'Vietnamien, anglais, français, arabe — basculement instantané.',
    'landing.feat5Title': 'Suggestions AT',
    'landing.feat5Desc': 'Recommandations d\'appareils adaptés depuis la base MADA.',
    'landing.feat6Title': 'Sécurité & Confidentialité',
    'landing.feat6Desc': 'Chiffrement AES-256, conforme au RGPD.',
    'landing.howTitle': 'Comment ça marche',
    'landing.how1Title': 'Posez une question',
    'landing.how1Desc': 'Envoyez votre demande par texte, voix ou image.',
    'landing.how2Title': 'Analyse des données',
    'landing.how2Desc': 'MADA analyse des millions de documents ISO et WHO.',
    'landing.how3Title': 'Solution normalisée',
    'landing.how3Desc': 'Rapports détaillés et feuille de route adaptée.',
    'landing.standardsTitle': 'Normes d\'or',
    'landing.isoTitle': 'ISO 9999',
    'landing.isoDesc': 'Système international de codage à 6 chiffres pour classifier tous les produits d\'assistance.',
    'landing.wcagTitle': 'WCAG 2.2',
    'landing.wcagDesc': 'Interface et contenu optimisés pour tous les niveaux d\'accessibilité AAA.',
    'landing.ctaFinalTitle': 'Prêt à élever l\'expérience d\'assistance ?',
    'landing.ctaFinalDesc': 'Démarrez gratuitement — pas de carte de crédit requise.',
    'landing.ctaFinalButton': 'Essai gratuit',

    // Pricing page
    'pricing.badge': 'Tarifs',
    'pricing.title': 'Choisissez le bon plan',
    'pricing.titleHighlight': 'pour vos besoins',
    'pricing.subtitle': 'Commencez gratuitement. Passez à Pro pour débloquer toute la puissance de MADA AI.',
    'pricing.monthly': 'Mensuel',
    'pricing.yearly': 'Annuel',
    'pricing.saveNote': 'Économisez 20%',
    'pricing.ctaFree': 'Commencer gratuitement',
    'pricing.ctaPro': 'Passer à Pro',
    'pricing.ctaEnterprise': 'Contacter les ventes',
    'pricing.ctaCurrent': 'Plan actuel — Continuer',
    'pricing.processing': 'Traitement...',
    'pricing.popular': 'Le plus populaire',
    'pricing.compareTitle': 'Comparer les fonctionnalités',
    'pricing.featCol': 'Fonctionnalité',
    'pricing.note': 'Tous les plans incluent mises à jour gratuites et support email. Paiements sécurisés via Stripe / PayPal / VNPay.',
    'pricing.faqTitle': 'Questions fréquentes',
    'pricing.faq1Q': 'MADA AI supporte-t-il le vietnamien ?',
    'pricing.faq1A': 'Oui. MADA AI est entièrement optimisé pour le vietnamien, et supporte aussi anglais, français et arabe.',
    'pricing.faq2Q': 'Puis-je annuler Pro à tout moment ?',
    'pricing.faq2A': 'Oui. Vous pouvez annuler Pro à tout moment dans les paramètres. Le plan reste actif jusqu\'à la fin du cycle de facturation.',
    'pricing.faq3Q': 'Mes données sont-elles sécurisées ?',
    'pricing.faq3A': 'Absolument. Toutes les conversations sont chiffrées AES-256. Nous ne vendons pas les données et sommes conformes RGPD.',
    'pricing.faq4Q': 'Enterprise propose-t-il le déploiement sur site ?',
    'pricing.faq4A': 'Oui. Enterprise supporte le déploiement sur site pour les organisations ayant des besoins stricts de sécurité.',
    'pricing.faq5Q': 'Y a-t-il un essai gratuit pour Pro ?',
    'pricing.faq5A': 'Oui. À la première inscription, vous obtenez 7 jours d\'essai Pro gratuit — sans carte de crédit.',
    'pricing.faq6Q': 'Quels moyens de paiement sont acceptés ?',
    'pricing.faq6A': 'Nous acceptons cartes Visa/Mastercard, PayPal, virements bancaires locaux et VNPay.',
    'pricing.faq7Q': 'Puis-je changer de plan ?',
    'pricing.faq7A': 'Oui. Vous pouvez upgrader ou downgrader à tout moment.',

    // Plan features
    'pricing.freeDesc': 'Expérience MADA AI basique pour les particuliers.',
    'pricing.proDesc': 'Pour les spécialistes AT et utilisateurs fréquents.',
    'pricing.enterpriseDesc': 'Solution pour organisations, écoles, hôpitaux, gouvernements.',
    'pricing.freeF1': '10 conversations gratuites',
    'pricing.freeF2': 'Accès à 7 catégories AT (ISO 9999)',
    'pricing.freeF3': 'Recherche normes ISO/WCAG/WHO',
    'pricing.freeF4': 'Suggestions personnalisées de produits AT',
    'pricing.freeF5': 'Support communautaire',
    'pricing.proF1': 'Conversations illimitées',
    'pricing.proF2': 'Analyse approfondie selon ISO 9999',
    'pricing.proF3': 'Export de rapports PDF professionnels',
    'pricing.proF4': 'Historique illimité',
    'pricing.proF5': 'Support prioritaire 24/7',
    'pricing.proF6': 'Intégration API avancée',
    'pricing.proF7': 'Accès anticipé aux nouvelles fonctionnalités',
    'pricing.entF1': 'Toutes les fonctionnalités Pro',
    'pricing.entF2': 'Tableau de bord multi-utilisateurs',
    'pricing.entF3': 'Connaissances personnalisées',
    'pricing.entF4': 'SLA 99.9% & sécurité entreprise',
    'pricing.entF5': 'Formation dédiée aux spécialistes AT',
    'pricing.entF6': 'Déploiement sur site optionnel',
    'pricing.entF7': 'Support hotline 24/7',

    // Compare table
    'pricing.cmpChats': 'Conversations',
    'pricing.cmpCategories': 'Catégories AT (ISO 9999)',
    'pricing.cmpStandards': 'Normes ISO/WCAG/WHO',
    'pricing.cmpPdf': 'Export PDF',
    'pricing.cmpHistory': 'Historique des conversations',
    'pricing.cmpSupport': 'Support prioritaire',
    'pricing.cmpOnPremise': 'Déploiement sur site',
    'pricing.cmpSLA': 'SLA',
    'pricing.cmpUnlimited': 'Illimité',
    'pricing.cmpDeep': 'Avancé',
    'pricing.cmpCustom': 'Personnalisé',
    'pricing.days': 'jours',

    // Trust strip
    'pricing.trust1': 'Sécurité bancaire',
    'pricing.trust2': 'Support 24/7',
    'pricing.trust3': 'Multilingue',
    'pricing.trust4': 'Mises à jour continues',
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
