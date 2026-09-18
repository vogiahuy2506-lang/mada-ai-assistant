import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { MADA_BOTS } from '@/lib/madaBots';
import { broadcastAgentChange } from '@/lib/agentBroadcast';
import { useAuthStore, usePromptStore, useAgentStore, useLanguageStore } from '@/stores';
import { useTranslation } from '@/lib/translations';
import clsx from 'clsx';

// ============== TYPES ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

// ============== TRANSLATIONS ==============
const agentTranslations: Record<string, Record<Language, string>> = {
  // Admin agents main
  'agent.title': { vi: 'Quản lý AI Agents', en: 'Manage AI Agents', ar: 'إدارة وكلاء الذكاء الاصطناعي', fr: 'Gérer les agents IA' },
  'agent.subtitle': { vi: 'Tạo và quản lý các AI Agent. Người dùng có thể chọn Agent để trò chuyện.', en: 'Create and manage AI Agents. Users can select an Agent to chat with.', ar: 'إنشاء وإدارة وكلاء الذكاء الاصطناعي. يمكن للمستخدمين اختيار وكيل للدردشة.', fr: 'Créer et gérer les agents IA. Les utilisateurs peuvent choisir un agent.' },
  'agent.loading': { vi: 'Đang tải...', en: 'Loading...', ar: 'جارٍ التحميل...', fr: 'Chargement...' },
  'agent.empty': { vi: 'Chưa có Agent nào', en: 'No agents yet', ar: 'لا توجد وكلاء بعد', fr: 'Pas encore d\'agents' },
  'agent.emptyHint': { vi: 'Chưa có Agent nào. Tạo mới hoặc import từ MADA Bots.', en: 'No agents yet. Create new or import from MADA Bots.', ar: 'لا توجد وكلاء بعد. إنشاء جديد أو الاستيراد من روبوتات MADA.', fr: 'Pas encore d\'agents. Créez-en un nouveau ou importez depuis MADA Bots.' },
  'agent.count': { vi: 'Agent(s)', en: 'Agent(s)', ar: 'وكيل(وكائل)', fr: 'Agent(s)' },
  
  // Actions
  'agent.create': { vi: 'Tạo Agent mới', en: 'Create New Agent', ar: 'إنشاء وكيل جديد', fr: 'Créer un nouvel agent' },
  'agent.edit': { vi: 'Sửa Agent', en: 'Edit Agent', ar: 'تعديل الوكيل', fr: 'Modifier l\'agent' },
  'agent.delete': { vi: 'Xóa Agent', en: 'Delete Agent', ar: 'حذف الوكيل', fr: 'Supprimer l\'agent' },
  'agent.test': { vi: 'Test', en: 'Test', ar: 'اختبار', fr: 'Tester' },
  'agent.viewKb': { vi: 'Xem Knowledge Base', en: 'View Knowledge Base', ar: 'عرض قاعدة المعرفة', fr: 'Voir la base de connaissances' },
  
  // Import
  'agent.importMada': { vi: 'Import bot MADA', en: 'Import MADA Bots', ar: 'استيراد روبوتات MADA', fr: 'Importer les bots MADA' },
  'agent.importModalTitle': { vi: 'Import Bot MADA', en: 'Import MADA Bots', ar: 'استيراد روبوتات MADA', fr: 'Importer les bots MADA' },
  'agent.selectBotImport': { vi: 'Chọn bot để import', en: 'Select bots to import', ar: 'اختر الروبوتات للاستيراد', fr: 'Sélectionner les bots à importer' },
  
  // Form
  'agent.form.name': { vi: 'Tên Agent', en: 'Agent Name', ar: 'اسم الوكيل', fr: 'Nom de l\'agent' },
  'agent.form.namePlaceholder': { vi: 'VD: MADA Assistant', en: 'Example: MADA Assistant', ar: 'مثال: مساعد MADA', fr: 'Exemple: Assistant MADA' },
  'agent.form.description': { vi: 'Mô tả', en: 'Description', ar: 'الوصف', fr: 'Description' },
  'agent.form.descriptionPlaceholder': { vi: 'Mô tả ngắn về Agent...', en: 'Brief description of the Agent...', ar: 'وصف موجز للوكيل...', fr: 'Brève description de l\'agent...' },
  'agent.form.systemPrompt': { vi: 'System Prompt', en: 'System Prompt', ar: 'مطالبة النظام', fr: 'Prompt système' },
  'agent.form.systemPromptOptional': { vi: '(tùy chọn)', en: '(optional)', ar: '(اختياري)', fr: '(facultatif)' },
  'agent.form.systemPromptOverride': { vi: '(override nếu có tham chiếu ở trên)', en: '(override if reference above)', ar: '(يتجاوز إذا كان هناك مرجع أعلاه)', fr: '(remplace si référence ci-dessus)' },
  'agent.form.systemPromptPlaceholder': { vi: 'VD: Bạn là trợ lý ảo của MADA...', en: 'Example: You are a virtual assistant of MADA...', ar: 'مثال: أنت مساعد MADA الافتراضي...', fr: 'Exemple: Vous êtes l\'assistant virtuel de MADA...' },
  'agent.form.welcome': { vi: 'Tin nhắn chào mừng', en: 'Welcome Message', ar: 'رسالة الترحيب', fr: 'Message de bienvenue' },
  'agent.form.placeholder': { vi: 'Placeholder', en: 'Placeholder', ar: 'نص بديل', fr: 'Placeholder' },
  'agent.form.avatar': { vi: 'Avatar URL', en: 'Avatar URL', ar: 'رابط الصورة', fr: 'URL de l\'avatar' },
  'agent.form.avatarUpload': { vi: 'Tải lên Avatar', en: 'Upload Avatar', ar: 'تحميل الصورة', fr: 'Télécharger l\'avatar' },
  'agent.form.color': { vi: 'Màu sắc', en: 'Color', ar: 'اللون', fr: 'Couleur' },
  'agent.form.category': { vi: 'Danh mục', en: 'Category', ar: 'الفئة', fr: 'Catégorie' },
  'agent.form.save': { vi: 'Lưu', en: 'Save', ar: 'حفظ', fr: 'Sauvegarder' },
  'agent.form.cancel': { vi: 'Hủy', en: 'Cancel', ar: 'إلغاء', fr: 'Annuler' },
  'agent.form.create': { vi: 'Tạo', en: 'Create', ar: 'إنشاء', fr: 'Créer' },
  'agent.form.update': { vi: 'Cập nhật', en: 'Update', ar: 'تحديث', fr: 'Mettre à jour' },
  'agent.form.delete': { vi: 'Xóa', en: 'Delete', ar: 'حذف', fr: 'Supprimer' },
  'agent.form.crawling': { vi: 'Đang cào...', en: 'Crawling...', ar: 'جارٍ الزحف...', fr: 'Extraction en cours...' },
  'agent.form.crawlTest': { vi: 'Cào thử', en: 'Test Crawl', ar: 'اختبار الزحف', fr: 'Tester l\'extraction' },
  'agent.form.addUrl': { vi: 'Thêm URL', en: 'Add URL', ar: 'إضافة رابط', fr: 'Ajouter une URL' },
  'agent.form.removeUrl': { vi: 'Xóa URL', en: 'Remove URL', ar: 'إزالة الرابط', fr: 'Supprimer l\'URL' },
  'agent.form.knowledgeBase': { vi: 'Knowledge Base', en: 'Knowledge Base', ar: 'قاعدة المعرفة', fr: 'Base de connaissances' },
  'agent.form.loadingKb': { vi: 'Đang tải KB...', en: 'Loading KB...', ar: 'جارٍ تحميل قاعدة المعرفة...', fr: 'Chargement de la base...' },
  'agent.form.totalDocs': { vi: 'documents', en: 'documents', ar: 'مستندات', fr: 'documents' },
  'agent.form.noDescription': { vi: 'Không có mô tả', en: 'No description', ar: 'لا يوجد وصف', fr: 'Pas de description' },
  'agent.form.importing': { vi: 'Đang import...', en: 'Importing...', ar: 'جارٍ الاستيراد...', fr: 'Importation en cours...' },
  'agent.form.crawlSave': { vi: 'Cào + lưu', en: 'Crawl & Save', ar: 'زحف وحفظ', fr: 'Extraire et sauvegarder' },
  'agent.form.saveAndCrawl': { vi: 'Tạo + cào', en: 'Create + Crawl', ar: 'إنشاء وزحف', fr: 'Créer + Extraire' },
  'agent.form.capabilities': { vi: 'Khả năng', en: 'Capabilities', ar: 'القدرات', fr: 'Capacités' },
  'agent.form.crawlOptions': { vi: 'Tùy chọn cào nâng cao', en: 'Advanced crawl options', ar: 'خيارات الزحف المتقدمة', fr: 'Options d\'extraction avancées' },
  'agent.form.followLinks': { vi: 'Follow sub-links cùng domain', en: 'Follow sub-links on same domain', ar: 'متابعة الروابط الفرعية في نفس النطاق', fr: 'Suivre les sous-liens du même domaine' },
  'agent.form.followLinksDesc': { vi: 'Bật để cào thêm các trang con (cùng tên miền). Tốn thời gian hơn nhưng lấy được nhiều dữ liệu hơn.', en: 'Enable to crawl additional sub-pages (same domain). Takes longer but gets more data.', ar: 'تمكين لزحف صفحات فرعية إضافية (نفس النطاق). يستغرق وقتًا أطول لكنه يحصل على بيانات أكثر.', fr: 'Activer pour extraire des sous-pages supplémentaires (même domaine). Plus long mais plus de données.' },
  'agent.form.maxDepth': { vi: 'Độ sâu tối đa', en: 'Max depth', ar: 'العمق الأقصى', fr: 'Profondeur max' },
  'agent.form.maxPages': { vi: 'Số trang tối đa', en: 'Max pages', ar: 'الحد الأقصى للصفحات', fr: 'Pages max' },
  'agent.form.googleSheetsTip': { vi: 'Google Sheets public sẽ tự động được export sang CSV và format từng dòng thành key: value để AI dễ trả lời theo từng sản phẩm.', en: 'Public Google Sheets will be automatically exported to CSV and each row formatted as key: value for AI to answer per product.', ar: 'سيتم تصدير جداول بيانات Google العامة تلقائيًا إلى CSV وتنسيق كل صف كمفتاح: قيمة للإجابة لكل منتج.', fr: 'Les Google Sheets publics seront automatiquement exportés en CSV et chaque ligne formatée en clé: valeur pour que l\'IA réponde par produit.' },
  'agent.form.testCrawl': { vi: 'Test cào dữ liệu ngay', en: 'Test data crawl now', ar: 'اختبار زحف البيانات الآن', fr: 'Tester l\'extraction de données maintenant' },
  'agent.form.suggestedQuestions': { vi: 'Câu hỏi gợi ý', en: 'Suggested Questions', ar: 'الأسئلة المقترحة', fr: 'Questions suggérées' },
  'agent.form.suggestedQuestionsManage': { vi: 'Quản lý trong trang riêng', en: 'Manage on separate page', ar: 'إدارة في صفحة منفصلة', fr: 'Gérer sur une page séparée' },
  'agent.form.suggestedQuestionsHint': { vi: 'Để quản lý câu hỏi gợi ý cho Agent này, vui lòng truy cập trang Câu hỏi gợi ý.', en: 'To manage suggested questions for this Agent, please visit the Suggested Questions page.', ar: 'لإدارة الأسئلة المقترحة لهذا الوكيل، يرجى زيارة صفحة الأسئلة المقترحة.', fr: 'Pour gérer les questions suggérées pour cet agent, veuillez visiter la page Questions suggérées.' },
  'agent.form.suggestedQuestionsFilterHint': { vi: 'Bạn có thể thêm câu hỏi riêng cho Agent này bằng cách filter theo Agent ID:', en: 'You can add questions specific to this Agent by filtering by Agent ID:', ar: 'يمكنك إضافة أسئلة خاصة بهذا الوكيل عن طريق التصفية حسب معرف الوكيل:', fr: 'Vous pouvez ajouter des questions spécifiques à cet agent en filtrant par ID d\'agent:' },
  'agent.form.openSuggestedQuestionsPage': { vi: 'Mở trang quản lý câu hỏi', en: 'Open questions management page', ar: 'فتح صفحة إدارة الأسئلة', fr: 'Ouvrir la page de gestion des questions' },
  
  // Knowledge URL
  'agent.form.knowledgeUrl': { vi: 'Knowledge URL (tổng quát)', en: 'Knowledge URL (general)', ar: 'رابط المعرفة (عام)', fr: 'URL de connaissance (général)' },
  'agent.form.knowledgeUrlPlaceholder': { vi: 'https://example.com/kien-thuc-tong-quat', en: 'https://example.com/general-knowledge', ar: 'https://example.com/معرفة-عامة', fr: 'https://example.com/connaissance-generale' },
  'agent.form.knowledgeUrlHint': { vi: 'URL tổng quát về chủ đề của agent. Sẽ được cào và ingest vào KB ngay khi bấm Tạo/Lưu.', en: 'General URL about the agent topic. Will be crawled and ingested to KB when clicking Create/Save.', ar: 'رابط عام حول موضوع الوكيل. سيتم زحفه وإدخاله في قاعدة المعرفة عند النقر على إنشاء/حفظ.', fr: 'URL générale sur le sujet de l\'agent. Sera extraite et ingérée dans la base de connaissances lors de la création/sauvegarde.' },
  
  // Product URLs
  'agent.form.productUrls': { vi: 'Product URLs (nhiều sản phẩm)', en: 'Product URLs (multiple products)', ar: 'روابط المنتجات (منتجات متعددة)', fr: 'URLs de produits (plusieurs produits)' },
  'agent.form.productUrlPlaceholder': { vi: 'https://example.com/san-pham/abc-123 (Enter để thêm)', en: 'https://example.com/product/abc-123 (Enter to add)', ar: 'https://example.com/منتج/abc-123 (Enter للإضافة)', fr: 'https://example.com/produit/abc-123 (Entrée pour ajouter)' },
  'agent.form.productUrlHint': { vi: 'Thêm nhiều URL sản phẩm. Mỗi URL sẽ được cào và ingest vào KB ngay khi lưu.', en: 'Add multiple product URLs. Each URL will be crawled and ingested to KB when saving.', ar: 'إضافة روابط منتجات متعددة. سيتم زحف كل رابط وإدخاله في قاعدة المعرفة عند الحفظ.', fr: 'Ajouter plusieurs URLs de produits. Chaque URL sera extraite et ingérée dans la base de connaissances lors de la sauvegarde.' },
  'agent.form.productUrlError': { vi: 'Vui lòng nhập URL sản phẩm.', en: 'Please enter a product URL.', ar: 'يرجى إدخال رابط المنتج.', fr: 'Veuillez entrer une URL de produit.' },
  'agent.form.urlMustStartWithHttp': { vi: 'URL phải bắt đầu bằng http:// hoặc https://', en: 'URL must start with http:// or https://', ar: 'يجب أن يبدأ الرابط بـ http:// أو https://', fr: 'L\'URL doit commencer par http:// ou https://' },
  
  // System Prompt Reference
  'agent.form.promptReference': { vi: 'System Prompt tham chiếu', en: 'Reference System Prompt', ar: 'مطالبة النظام المرجعية', fr: 'Prompt système de référence' },
  'agent.form.noReference': { vi: '— Không tham chiếu (dùng prompt tự do bên dưới) —', en: '— No reference (use free prompt below) —', ar: '— لا مرجع (استخدم المطالبة الحرة أدناه) —', fr: '— Pas de référence (utiliser le prompt libre ci-dessous) —' },
  
  // Confirmations and messages
  'agent.confirmDelete': { vi: 'Xác nhận xóa Agent này?', en: 'Confirm delete this agent?', ar: 'تأكيد حذف هذا الوكيل؟', fr: 'Confirmer la suppression de cet agent ?' },
  'agent.confirmDeleteQuestion': { vi: 'Bạn có chắc muốn xóa Agent này?', en: 'Are you sure you want to delete this agent?', ar: 'هل أنت متأكد أنك تريد حذف هذا الوكيل؟', fr: 'Êtes-vous sûr de vouloir supprimer cet agent ?' },
  'agent.noPermission': { vi: 'Chỉ admin mới có quyền thực hiện hành động này.', en: 'Only admin can perform this action.', ar: 'فقط المسؤول يمكنه تنفيذ هذا الإجراء.', fr: 'Seul l\'admin peut effectuer cette action.' },
  'agent.noPermissionEdit': { vi: 'Chỉ admin mới có quyền chỉnh sửa Agent.', en: 'Only admin can edit agents.', ar: 'فقط المسؤول يمكنه تعديل الوكلاء.', fr: 'Seul l\'admin peut modifier les agents.' },
  'agent.noPermissionDelete': { vi: 'Chỉ admin mới có quyền xoá Agent.', en: 'Only admin can delete agents.', ar: 'فقط المسؤول يمكنه حذف الوكلاء.', fr: 'Seul l\'admin peut supprimer les agents.' },
  'agent.noPermissionToggle': { vi: 'Chỉ admin mới có quyền bật/tắt Agent.', en: 'Only admin can toggle agent status.', ar: 'فقط المسؤول يمكنه تبديل حالة الوكيل.', fr: 'Seul l\'admin peut activer/désactiver les agents.' },
  'agent.viewingAsRole': { vi: 'Bạn đang xem với quyền', en: 'You are viewing with role', ar: 'أنت تشاهد مع الدور', fr: 'Vous consultez avec le rôle' },
  'agent.onlySuperAdminCan': { vi: 'Chỉ SuperAdmin mới có thể tạo / sửa / xoá Agent.', en: 'Only SuperAdmin can create / edit / delete agents.', ar: 'فقط المشرف الأعلى يمكنه إنشاء / تعديل / حذف الوكلاء.', fr: 'Seul le SuperAdmin peut créer / modifier / supprimer des agents.' },
  'agent.crawlSuccess': { vi: 'Đã cào và ingest {count} documents vào KB của agent.', en: 'Crawled and ingested {count} documents into agent KB.', ar: 'تم الزحف وإدخال {count} مستند في قاعدة معرفة الوكيل.', fr: '{count} documents ont été extraits et ingérés dans la base de connaissances de l\'agent.' },
  'agent.crawlPartial': { vi: 'Cào xong {total} docs. {failed} URL lỗi:', en: 'Crawled {total} docs. {failed} URLs failed:', ar: 'تم الزحف {total} مستند. {failed} روابط فشلت:', fr: '{total} docs extraits. {failed} URLs échouées:' },
  'agent.crawlFailed': { vi: 'Cào thất bại: {error}', en: 'Crawl failed: {error}', ar: 'فشل الزحف: {error}', fr: 'Échec de l\'extraction: {error}' },
  'agent.crawlError': { vi: 'Lỗi: {error}', en: 'Error: {error}', ar: 'خطأ: {error}', fr: 'Erreur: {error}' },
  'agent.lastCrawl': { vi: 'Lần cào gần nhất', en: 'Last crawl', ar: 'آخر زحف', fr: 'Dernière extraction' },
  'agent.kbTotal': { vi: 'Tổng', en: 'Total', ar: 'المجموع', fr: 'Total' },
  'agent.kbForRag': { vi: 'KB dùng cho RAG khi user chat với agent', en: 'KB used for RAG when user chats with agent', ar: 'قاعدة المعرفة المستخدمة للبحث المعزز عند الدردشة', fr: 'Base utilisée pour le RAG lors du chat avec l\'agent' },
  'agent.kbEmpty': { vi: 'Knowledge Base đang trống', en: 'Knowledge Base is empty', ar: 'قاعدة المعرفة فارغة', fr: 'La base de connaissances est vide' },
  'agent.kbEmptyHint': { vi: 'Cào 1 URL trong form Edit Agent để ingest documents vào KB.', en: 'Crawl a URL in the Edit Agent form to ingest documents into KB.', ar: 'قم بزحف رابط في نموذج تعديل الوكيل لإدخال المستندات.', fr: 'Extrayez une URL dans le formulaire Modifier l\'agent pour ingérer des documents.' },
  
  // Edit title KB
  'agent.kbEditTitle': { vi: 'Sửa tiêu đề', en: 'Edit title', ar: 'تعديل العنوان', fr: 'Modifier le titre' },
  'agent.kbEditTitlePlaceholder': { vi: 'Nhập tiêu đề mới...', en: 'Enter new title...', ar: 'أدخل العنوان الجديد...', fr: 'Entrez le nouveau titre...' },
  'agent.kbEditTitleError': { vi: 'Lỗi cập nhật tiêu đề', en: 'Error updating title', ar: 'خطأ في تحديث العنوان', fr: 'Erreur de mise à jour du titre' },
  'agent.kbExpand': { vi: 'Mở rộng', en: 'Expand', ar: 'توسيع', fr: 'Développer' },
  'agent.kbCollapse': { vi: 'Thu gọn', en: 'Collapse', ar: 'طي', fr: 'Réduire' },
  'agent.kbNoTitle': { vi: '(không tiêu đề)', en: '(no title)', ar: '(بدون عنوان)', fr: '(sans titre)' },
  'agent.kbMetadata': { vi: 'Metadata', en: 'Metadata', ar: 'بيانات وصفية', fr: 'Métadonnées' },
  
  // Test agent
  'agent.testAgent': { vi: 'Test Agent', en: 'Test Agent', ar: 'اختبار الوكيل', fr: 'Tester l\'agent' },
  'agent.testAgentHint': { vi: 'Nhập câu hỏi bên dưới để test agent.', en: 'Enter a question below to test the agent.', ar: 'أدخل سؤالاً أدناه لاختبار الوكيل.', fr: 'Entrez une question ci-dessous pour tester l\'agent.' },
  'agent.testAgentResult': { vi: 'Kết quả sẽ hiển thị confidence + latency.', en: 'Results will show confidence + latency.', ar: 'ستعرض النتائج الثقة + التأخير.', fr: 'Les résultats afficheront la confiance + la latence.' },
  'agent.testPlaceholder': { vi: 'Nhập câu hỏi test...', en: 'Enter test question...', ar: 'أدخل سؤال الاختبار...', fr: 'Entrez une question de test...' },
  'agent.testThinking': { vi: 'Agent đang suy nghĩ...', en: 'Agent is thinking...', ar: 'الوكيل يفكر...', fr: 'L\'agent réfléchit...' },
  'agent.testSend': { vi: 'Gửi', en: 'Send', ar: 'إرسال', fr: 'Envoyer' },
  'agent.testYou': { vi: 'Bạn', en: 'You', ar: 'أنت', fr: 'Vous' },
  'agent.testAgentName': { vi: 'Agent', en: 'Agent', ar: 'الوكيل', fr: 'Agent' },
  'agent.testConfidence': { vi: 'conf', en: 'conf', ar: 'ثقة', fr: 'conf' },
  
  // Import modal
  'agent.importAutoReceive': { vi: 'Tự động nhận bot mới khi Super Admin tạo thêm', en: 'Automatically receive new bots when Super Admin creates them', ar: 'استلام روبوتات جديدة تلقائيًا عند إنشاء المشرف الأعلى لها', fr: 'Recevoir automatiquement les nouveaux bots quand le Super Admin les crée' },
  'agent.importMadaBots': { vi: 'Bots MADA (mặc định)', en: 'MADA Bots (default)', ar: 'روبوتات MADA (افتراضي)', fr: 'Bots MADA (par défaut)' },
  'agent.importCustomBots': { vi: 'Bots Tùy chỉnh (Super Admin)', en: 'Custom Bots (Super Admin)', ar: 'روبوتات مخصصة (المشرف الأعلى)', fr: 'Bots personnalisés (Super Admin)' },
  'agent.importAlready': { vi: 'Đã có', en: 'Already exists', ar: 'موجود بالفعل', fr: 'Existe déjà' },
  'agent.importSelectOne': { vi: 'Vui lòng chọn ít nhất 1 bot để import.', en: 'Please select at least 1 bot to import.', ar: 'يرجى تحديد روبوت واحد على الأقل للاستيراد.', fr: 'Veuillez sélectionner au moins 1 bot à importer.' },
  'agent.importDone': { vi: 'Import xong!', en: 'Import complete!', ar: 'اكتمل الاستيراد!', fr: 'Importation terminée !' },
  'agent.importCreated': { vi: 'Tạo mới', en: 'Created', ar: 'تم الإنشاء', fr: 'Créé' },
  'agent.importSkipped': { vi: 'Bỏ qua', en: 'Skipped', ar: 'تم التخطي', fr: 'Ignoré' },
  'agent.importAlreadyExists': { vi: 'bot (đã tồn tại)', en: 'bot (already exists)', ar: 'روبوت (موجود بالفعل)', fr: 'bot (existe déjà)' },
  'agent.importDocsCrawled': { vi: 'Documents đã cào', en: 'Documents crawled', ar: 'المستندات المزحوفة', fr: 'Documents extraits' },
  'agent.importAllBotsImported': { vi: 'Tất cả bots đã được import!', en: 'All bots have been imported!', ar: 'تم استيراد جميع الروبوتات!', fr: 'Tous les bots ont été importés !' },
  'agent.importBotsSelected': { vi: 'bot được chọn', en: 'bot(s) selected', ar: 'روبوت(ات) محدد', fr: 'bot(s) sélectionné(s)' },
  'agent.importImport': { vi: 'Import', en: 'Import', ar: 'استيراد', fr: 'Importer' },
  'agent.importImportCount': { vi: 'Import {count} bot', en: 'Import {count} bot', ar: 'استيراد {count} روبوت', fr: 'Importer {count} bot' },
  
  // Saved indicator
  'agent.saved': { vi: 'Đã lưu lúc', en: 'Saved at', ar: 'تم الحفظ في', fr: 'Sauvegardé à' },
  
  // Upload
  'agent.uploadFailed': { vi: 'Upload thất bại', en: 'Upload failed', ar: 'فشل التحميل', fr: 'Échec du téléchargement' },
  'agent.fileTooLarge': { vi: 'File quá lớn. Tối đa 2MB.', en: 'File too large. Max 2MB.', ar: 'الملف كبير جدًا. الحد الأقصى 2 ميجابايت.', fr: 'Fichier trop volumineux. Max 2 Mo.' },
  'agent.onlyImages': { vi: 'Chỉ chấp nhận file ảnh.', en: 'Only image files accepted.', ar: 'يُقبل فقط ملفات الصور.', fr: 'Seuls les fichiers image sont acceptés.' },
  'agent.uploadAvatar': { vi: 'Tải lên Avatar', en: 'Upload Avatar', ar: 'تحميل الصورة', fr: 'Télécharger l\'avatar' },
  'agent.useEmoji': { vi: 'Dùng emoji', en: 'Use emoji', ar: 'استخدام الرمز', fr: 'Utiliser l\'emoji' },
  'agent.deleteImage': { vi: 'Xoá ảnh', en: 'Delete image', ar: 'حذف الصورة', fr: 'Supprimer l\'image' },
  'agent.imageFormats': { vi: 'PNG/JPG/WEBP/SVG ≤ 2MB', en: 'PNG/JPG/WEBP/SVG ≤ 2MB', ar: 'PNG/JPG/WEBP/SVG ≤ 2 ميجابايت', fr: 'PNG/JPG/WEBP/SVG ≤ 2 Mo' },
  
  // Errors
  'agent.error': { vi: 'Lỗi', en: 'Error', ar: 'خطأ', fr: 'Erreur' },
  'agent.retry': { vi: 'Thử lại', en: 'Retry', ar: 'إعادة المحاولة', fr: 'Réessayer' },
  
  // Toggle agent
  'agent.turnOn': { vi: 'Bật', en: 'Turn On', ar: 'تشغيل', fr: 'Activer' },
  'agent.turnOff': { vi: 'Tắt', en: 'Turn Off', ar: 'إيقاف', fr: 'Désactiver' },
  'agent.on': { vi: 'BẬT', en: 'ON', ar: 'تشغيل', fr: 'ON' },
  'agent.off': { vi: 'TẮT', en: 'OFF', ar: 'إيقاف', fr: 'OFF' },
  'agent.custom': { vi: 'Tùy chỉnh', en: 'Custom', ar: 'مخصص', fr: 'Personnalisé' },
  
  // KB viewer
  'agent.kbLoading': { vi: 'Đang tải KB...', en: 'Loading KB...', ar: 'جارٍ تحميل قاعدة المعرفة...', fr: 'Chargement de la base...' },
  'agent.kbShowing': { vi: 'Hiển thị', en: 'Showing', ar: 'عرض', fr: 'Affichage' },
  'agent.kbOf': { vi: 'của', en: 'of', ar: 'من', fr: 'sur' },
  'agent.kbTotal2': { vi: 'Tổng cộng', en: 'Total', ar: 'المجموع', fr: 'Total' },
  
  // Status labels
  'agent.statusOn': { vi: 'ON', en: 'ON', ar: 'تشغيل', fr: 'ON' },
  'agent.statusOff': { vi: 'OFF', en: 'OFF', ar: 'إيقاف', fr: 'OFF' },
  'agent.knowledge': { vi: 'Knowledge', en: 'Knowledge', ar: 'معرفة', fr: 'Connaissance' },
  'agent.product': { vi: 'Product', en: 'Product', ar: 'منتج', fr: 'Produit' },
  'agent.documents': { vi: 'docs', en: 'docs', ar: 'مستندات', fr: 'docs' },

  // Admin common
  'admin.common.refresh': { vi: 'Làm mới', en: 'Refresh', ar: 'تحديث', fr: 'Actualiser' },
  'admin.common.cancel': { vi: 'Hủy', en: 'Cancel', ar: 'إلغاء', fr: 'Annuler' },
  'admin.common.edit': { vi: 'Sửa', en: 'Edit', ar: 'تعديل', fr: 'Modifier' },
  'admin.common.save': { vi: 'Lưu', en: 'Save', ar: 'حفظ', fr: 'Sauvegarder' },
  'admin.common.loading': { vi: 'Đang tải...', en: 'Loading...', ar: 'جارٍ التحميل...', fr: 'Chargement...' },
  'admin.common.noPermission': { vi: 'Bạn không có quyền thực hiện hành động này', en: 'You do not have permission to perform this action', ar: 'ليس لديك إذن لتنفيذ هذا الإجراء', fr: 'Vous n\'avez pas la permission d\'effectuer cette action' },
  'admin.common.on': { vi: 'BẬT', en: 'ON', ar: 'تشغيل', fr: 'ON' },
  'admin.common.off': { vi: 'TẮT', en: 'OFF', ar: 'إيقاف', fr: 'OFF' },
  'admin.common.active': { vi: 'Hoạt động', en: 'Active', ar: 'نشط', fr: 'Actif' },
  'admin.common.disabled': { vi: 'Tắt', en: 'Disabled', ar: 'معطل', fr: 'Désactivé' },
};

// ============== TRANSLATION HELPER ==============
const tAgent = (key: string, lang: Language = 'vi'): string => {
  return agentTranslations[key]?.[lang] || agentTranslations[key]?.['vi'] || key;
};

// ============== TYPES ==============
interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  avatar_url?: string | null;
  system_prompt?: string;
  systemPrompt?: string;
  capabilities: string[];
  is_active?: boolean;
  isActive?: boolean;
  mada_category?: string;
  created_by?: string;
  createdAt?: number;
  updatedAt?: number;
  created_at?: string;
  updated_at?: string;
  knowledge_url?: string | null;
  product_url?: string | null;
  last_crawl_at?: string | null;
  last_crawl_status?: string | null;
  last_crawl_count?: number;
}

type CrawlResult = {
  url: string;
  kind: 'knowledge' | 'product';
  ok: boolean;
  docs: number;
  error?: string;
};

// ============== AVATAR COMPONENT (emoji OR uploaded image) ==============
function AgentAvatar({
  agent,
  size = 'md',
  className = '',
}: {
  agent: Pick<Agent, 'avatar' | 'avatar_url'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8 text-base' : size === 'lg' ? 'w-12 h-12 text-2xl' : 'w-10 h-10 text-xl';
  const isImage = !!agent.avatar_url && /^https?:\/\//.test(agent.avatar_url) || (!!agent.avatar_url && agent.avatar_url.startsWith('/'));

  if (isImage) {
    return (
      <div className={clsx(sizeClass, 'rounded-lg bg-white border-2 border-black overflow-hidden flex items-center justify-center shadow-[2px_2px_0px_0px_#000]', className)}>
        <img src={agent.avatar_url!} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={clsx(sizeClass, 'rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]', className)}>
      {agent.avatar || '🤖'}
    </div>
  );
}

// ============== MAIN COMPONENT ==============
export function AdminAgents() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const loadAgentsForChat = useAgentStore((s) => s.loadAgents);
  const removeAgentForChat = useAgentStore((s) => s.removeAgent);
  const { language } = useLanguageStore();
  const { t } = useTranslation();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Test Agent state
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [testAgentObj, setTestAgentObj] = useState<Agent | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; latency?: number; confidence?: number }>>([]);
  const [testing, setTesting] = useState(false);

  // KB viewer state
  const [kbModalAgent, setKbModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [kbDocs, setKbDocs] = useState<Array<{ id: string; title: string; content: string; source: string; metadata: any }>>([]);
  const [kbTotal, setKbTotal] = useState(0);
  const [kbLoading, setKbLoading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [editingTitleDocId, setEditingTitleDocId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [savingTitleDocId, setSavingTitleDocId] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  // ⭐ importSelected giờ chứa ID của agents từ DATABASE (không chỉ MADA_BOTS)
  // Super Admin tạo bot mới → bot đó sẽ tự xuất hiện trong danh sách import
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const openKbModal = async (agent: { id: string; name: string }) => {
    setKbModalAgent({ id: agent.id, name: agent.name });
    setKbDocs([]);
    setKbTotal(0);
    setExpandedDocId(null);
    setEditingTitleDocId(null);
    setEditingTitleValue('');
    setKbLoading(true);
    try {
      const res = await adminApi.getAgentDocuments(agent.id, 100);
      if (res.success && res.data) {
        setKbDocs(res.data.documents || []);
        setKbTotal(res.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load KB docs:', err);
    } finally {
      setKbLoading(false);
    }
  };

  const closeKbModal = () => {
    setKbModalAgent(null);
    setKbDocs([]);
    setKbTotal(0);
    setExpandedDocId(null);
    setEditingTitleDocId(null);
    setEditingTitleValue('');
  };

  const startEditTitle = (docId: string, currentTitle: string) => {
    setEditingTitleDocId(docId);
    setEditingTitleValue(currentTitle || '');
  };

  const cancelEditTitle = () => {
    setEditingTitleDocId(null);
    setEditingTitleValue('');
  };

  const saveDocTitle = async (docId: string) => {
    const newTitle = editingTitleValue.trim();
    if (!newTitle) {
      cancelEditTitle();
      return;
    }
    if (!kbModalAgent) return;
    setSavingTitleDocId(docId);
    try {
      const res = await adminApi.updateAgentDocumentTitle(kbModalAgent.id, docId, newTitle);
      if (res.success) {
        setKbDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d)));
        cancelEditTitle();
      } else {
        alert(res.error || tAgent('agent.kbEditTitleError', language));
      }
    } catch (err) {
      alert((err as Error)?.message || tAgent('agent.kbEditTitleError', language));
    } finally {
      setSavingTitleDocId(null);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    avatar_url: '' as string,
    system_prompt: '',
    prompt_id: '' as string,
    capabilities: [] as string[],
    knowledge_url: '',
    product_urls: [] as string[],
    crawl_follow_links: false,
    crawl_max_depth: 1,
    crawl_max_pages: 5,
  });
  const [newProductUrl, setNewProductUrl] = useState('');
  const [productUrlError, setProductUrlError] = useState('');
  const [availablePrompts, setAvailablePrompts] = useState<Array<{ id: string; name: string; isSystem: boolean }>>([]);
  // ⭐ Subscribe vào shared prompt store → nếu admin tạo prompt mới ở /admin/prompts
  // thì dropdown ở đây sẽ tự cập nhật, KHÔNG cần F5.
  const storePrompts = usePromptStore((s) => s.prompts);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<{ totalDocs: number; results: CrawlResult[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============== DATA LOAD ==============
  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[AdminAgents] Fetching agents from /api/admin/agents...');
      const res = await adminApi.getAgents();
      console.log('[AdminAgents] Agents response:', res.success ? `${res.data?.length} agents` : res.error);
      if (res.success && res.data) {
        setAgents(res.data as unknown as Agent[]);
      } else {
        setError(res.error || 'Failed to load agents');
      }
    } catch (err: any) {
      console.error('[AdminAgents] Load agents error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    // ⭐ Ưu tiên shared store (đã được AdminPrompts đồng bộ trước đó).
    // Nếu store rỗng (lần đầu vào trang Agents) → fetch trực tiếp & seed vào store.
    const fromStore = usePromptStore.getState().prompts;
    if (fromStore.length > 0) {
      setAvailablePrompts(
        fromStore
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name, isSystem: p.isSystem }))
      );
      return;
    }
    try {
      const res = await adminApi.getPrompts();
      if (res.success && res.data) {
        const mapped = (res.data as any[])
          .filter((p: any) => p.isActive ?? p.is_active === 1)
          .map((p: any) => ({ id: p.id, name: p.name, isSystem: p.isSystem ?? p.is_system === 1 }));
        setAvailablePrompts(mapped);
        // Seed shared store
        usePromptStore.getState().setPrompts(
          (res.data as any[]).map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            prompt: p.prompt,
            category: p.category,
            language: p.language,
            isActive: p.isActive ?? p.is_active === 1,
            isSystem: p.isSystem ?? p.is_system === 1,
            createdAt: p.createdAt || p.created_at || '',
            updatedAt: p.updatedAt || p.updated_at || '',
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load prompts:', err);
    }
  };

  useEffect(() => {
    loadAgents();
    loadPrompts();
  }, []);

  // ⭐ React to shared store changes → dropdown auto-refresh khi admin
  // tạo/sửa/xóa/toggle prompt ở tab /admin/prompts.
  useEffect(() => {
    setAvailablePrompts(
      storePrompts
        .filter((p) => p.isActive)
        .map((p) => ({ id: p.id, name: p.name, isSystem: p.isSystem }))
    );
  }, [storePrompts]);

  // ============== HANDLERS ==============
  const save = () => {
    setSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setTimeout(() => setSavedAt(null), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      avatar: '🤖',
      avatar_url: '',
      system_prompt: '',
      prompt_id: '',
      capabilities: [],
      knowledge_url: '',
      product_urls: [],
      crawl_follow_links: false,
      crawl_max_depth: 1,
      crawl_max_pages: 5,
    });
    setNewProductUrl('');
    setCrawlResult(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) return;

    try {
      const agentData: any = {
        name: formData.name,
        description: formData.description,
        avatar: formData.avatar,
        avatar_url: formData.avatar_url || null,
        system_prompt: formData.system_prompt,
        prompt_id: formData.prompt_id || null,
        capabilities: formData.capabilities,
        knowledge_url: formData.knowledge_url || null,
        product_urls: formData.product_urls.length > 0 ? formData.product_urls : null,
        crawl_follow_links: formData.crawl_follow_links ? 1 : 0,
        crawl_max_depth: Number(formData.crawl_max_depth) || 1,
        crawl_max_pages: Number(formData.crawl_max_pages) || 5,
      };

      let savedAgentId = editingId;
      if (editingId) {
        const res = await adminApi.updateAgent(editingId, agentData);
        if (!res.success) {
          alert(res.error);
          return;
        }
      } else {
        // ⭐ Agent mới luôn được bật mặc định để xuất hiện ở trang chat
        const res = await adminApi.createAgent({ ...agentData, is_active: true });
        if (!res.success) {
          alert(res.error);
          return;
        }
        savedAgentId = res.data?.id || null;

        // ⭐ Thêm agent vào local store NGAY LẬP TỨC để ChatPage hiển thị không cần chờ reload
        if (savedAgentId) {
          const newAgentForStore = {
            id: savedAgentId,
            name: formData.name,
            description: formData.description,
            avatar: formData.avatar,
            avatarUrl: formData.avatar_url || undefined,
            systemPrompt: formData.system_prompt,
            capabilities: formData.capabilities,
            isActive: true,
            createdBy: 'user' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            madaCategory: undefined,
            botId: undefined,
            promptId: formData.prompt_id || undefined,
            knowledgeUrl: formData.knowledge_url || undefined,
            productUrl: undefined,
          };
          useAgentStore.getState().upsertAgent(newAgentForStore);
        }
      }

      // Nếu có URL knowledge/product → cào ngay sau khi lưu
      const hasUrl =
        /^https?:\/\//i.test(formData.knowledge_url.trim()) ||
        formData.product_urls.some(u => /^https?:\/\//i.test(u.trim()));
      if (savedAgentId && hasUrl) {
        await handleCrawl(savedAgentId, {
          knowledge_url: formData.knowledge_url.trim(),
          product_urls: formData.product_urls,
        }, /* silent */ false);
      }

      await loadAgents();
      // ⭐ Broadcast ngay để ChatPage ở tab khác cập nhật tức thì
      broadcastAgentChange({ type: editingId ? 'agent-updated' : 'agent-created', agentId: savedAgentId || '' });
      // Đồng bộ sang global store để ChatPage thấy ngay (kể cả khi user đang mở chat tab khác)
      void loadAgentsForChat();
      resetForm();
      setShowForm(false);
      setEditingId(null);
      save();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCrawl = async (
    agentId: string,
    payload: { knowledge_url?: string; product_urls?: string[] },
    silent = true,
  ) => {
    setCrawling(true);
    try {
      const res = await adminApi.crawlAgentSources(agentId, {
        ...payload,
        crawl_follow_links: formData.crawl_follow_links ? 1 : 0,
        crawl_max_depth: formData.crawl_max_depth,
        crawl_max_pages: formData.crawl_max_pages,
      });
      if (res.success && res.data) {
        setCrawlResult({ totalDocs: res.data.totalDocs, results: res.data.results as CrawlResult[] });
        if (!silent) {
          const failed = res.data.results.filter(r => !r.ok);
          if (failed.length === 0) {
            alert(`✅ ${tAgent('agent.crawlSuccess', language).replace('{count}', String(res.data.totalDocs))}`);
          } else {
            alert(`${tAgent('agent.crawlPartial', language).replace('{total}', String(res.data.totalDocs)).replace('{failed}', String(failed.length))}\n${failed.map(f => `• ${f.kind}: ${f.error}`).join('\n')}`);
          }
        }
      } else {
        if (!silent) alert(`❌ ${tAgent('agent.crawlFailed', language).replace('{error}', res.error || 'unknown')}`);
        setCrawlResult(null);
      }
    } catch (err: any) {
      if (!silent) alert(`❌ ${tAgent('agent.crawlError', language).replace('{error}', err.message)}`);
    } finally {
      setCrawling(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    if (!isSuperAdmin) {
      alert(tAgent('agent.noPermissionEdit', language));
      return;
    }
    setFormData({
      name: agent.name,
      description: agent.description || '',
      avatar: agent.avatar,
      avatar_url: agent.avatar_url || '',
      system_prompt: agent.system_prompt || agent.systemPrompt || '',
      prompt_id: (agent as any).prompt_id || (agent as any).promptId || '',
      capabilities: agent.capabilities,
      knowledge_url: agent.knowledge_url || '',
      product_urls: agent.product_url ? [agent.product_url] : [],
      crawl_follow_links: !!(agent as any).crawl_follow_links,
      crawl_max_depth: (agent as any).crawl_max_depth || 1,
      crawl_max_pages: (agent as any).crawl_max_pages || 5,
    });
    setNewProductUrl('');
    setEditingId(agent.id);
    setCrawlResult(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) {
      alert(tAgent('agent.noPermissionDelete', language));
      return;
    }
    if (!confirm(tAgent('agent.confirmDeleteQuestion', language))) return;
    try {
      const res = await adminApi.deleteAgent(id);
      if (res.success) {
        removeAgentForChat(id);
        // ⭐ Broadcast để ChatPage ở tab khác cập nhật tức thì
        broadcastAgentChange({ type: 'agent-deleted', agentId: id });
        await loadAgents();
        void loadAgentsForChat();
        save();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleAgentActive = async (id: string) => {
    if (!isSuperAdmin) {
      alert(tAgent('agent.noPermissionToggle', language));
      return;
    }
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    const newActive = !(agent.is_active || agent.isActive);
    try {
      const res = await adminApi.updateAgent(id, { is_active: newActive });
      if (res.success) {
        await loadAgents();
        // ⭐ Broadcast để ChatPage ở tab khác cập nhật tức thì
        broadcastAgentChange({ type: 'agent-toggled', agentId: id });
        void loadAgentsForChat();
        save();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============== AVATAR UPLOAD ==============
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert(tAgent('agent.fileTooLarge', language));
      return;
    }
    if (!/^image\//.test(file.type)) {
      alert(tAgent('agent.onlyImages', language));
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await adminApi.uploadAgentAvatar(file);
      if (res.success && 'data' in res && res.data) {
        setFormData(prev => ({ ...prev, avatar_url: res.data.url }));
      } else {
        alert((res as any).error || tAgent('agent.uploadFailed', language));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearAvatarImage = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }));
  };

  // ============== TEST AGENT ==============
  const handleTestAgent = async () => {
    if (!testAgentId || !testInput.trim()) return;
    const userMsg = { role: 'user' as const, content: testInput };
    setTestMessages(prev => [...prev, userMsg]);
    setTesting(true);
    const inputSnapshot = testInput;
    setTestInput('');
    try {
      const res = await adminApi.testAgent({ agentId: testAgentId, message: inputSnapshot });
      if (res.success && res.data && res.data.response) {
        // Always use the agent name from the server response (authoritative source)
        if (res.data?.agentName) {
          setTestAgentObj(prev => prev ? { ...prev, name: res.data!.agentName } : null);
        }
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data!.response || '(empty response)',
          latency: res.data!.latencyMs,
          confidence: res.data!.confidence,
        }]);
      } else {
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Lỗi: ${res.error || 'unknown'}`,
        }]);
      }
    } catch (e: any) {
      setTestMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Exception: ${e.message}`,
      }]);
    } finally {
      setTesting(false);
    }
  };

  // ============== CAPABILITIES ==============
  const capabilityOptions = [
    { value: 'chat', label: 'Chat', labelEn: 'Chat' },
    { value: 'file_analysis', label: 'Phân tích file', labelEn: 'File Analysis' },
    { value: 'accessibility_help', label: 'Hỗ trợ tiếp cận', labelEn: 'Accessibility Help' },
    { value: 'expert_consultation', label: 'Tư vấn chuyên gia', labelEn: 'Expert Consultation' },
    { value: 'device_recommendation', label: 'Gợi ý thiết bị', labelEn: 'Device Recommendation' },
    { value: 'training', label: 'Đào tạo', labelEn: 'Training' },
  ];

  const toggleCapability = (cap: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap],
    }));
  };

  // ============== IMPORT AGENTS ==============
  // ⭐ Lấy tất cả agents từ DB (bao gồm cả MADA_BOTS và custom bots)
  // để hiển thị trong modal import - không giới hạn ở 7 bots MADA
  const getImportableAgents = () => {
    // Lấy MADA bots (từ madaBots.ts)
    const madaBotItems = MADA_BOTS.map(bot => ({
      id: bot.id,
      name: bot.name,
      description: bot.description,
      avatar: bot.avatar,
      isMada: true,
      madaCategory: bot.madaCategory,
      source: 'mada' as const,
    }));

    // Lấy custom agents (từ DB) - những agent không phải từ MADA_BOTS
    const customAgents = agents
      .filter(a => !MADA_BOTS.some(m => m.id === a.id))
      .map(a => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        avatar: a.avatar,
        isMada: false,
        madaCategory: a.mada_category,
        source: 'custom' as const,
      }));

    return [...madaBotItems, ...customAgents];
  };

  const handleImportSelected = async () => {
    if (!isSuperAdmin) return;
    if (importSelected.size === 0) {
      alert(tAgent('agent.importSelectOne', language));
      return;
    }
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    let crawledDocs = 0;
    // ⭐ Track các agent đã import để broadcast
    const importedAgentIds: string[] = [];

    // Xử lý từng agent được chọn
    for (const botId of importSelected) {
      const exists = agents.some(a => a.id === botId);
      if (exists) { skipped++; continue; }

      // Tìm trong MADA_BOTS trước
      const madaBot = MADA_BOTS.find(b => b.id === botId);
      if (madaBot) {
        // Agent từ MADA - tạo với dữ liệu predefined
        try {
          const res = await adminApi.createAgent({
            id: madaBot.id,
            name: madaBot.name,
            description: `${madaBot.description} (ISO: ${madaBot.isoCodes.join(', ') || 'general'})`,
            avatar: madaBot.avatar,
            avatar_url: null,
            system_prompt: `Bạn là ${madaBot.nameVi} của MADA AI Assistant.\n\nChuyên môn: ${madaBot.description}\n\nURL MADA: ${madaBot.madaUrl}\n\nTiêu chuẩn ISO: ${madaBot.isoCodes.join(', ') || 'general'}\n\nKhi user hỏi ngoài domain, lịch sự hướng dẫn chọn bot phù hợp khác.`,
            capabilities: ['chat', 'device_recommendation', ...madaBot.isoCodes.slice(0, 2).map(c => `iso_${c.replace(/\./g, '_')}`)],
            is_active: true,
            mada_category: madaBot.madaCategory,
            bot_id: madaBot.id,
            knowledge_url: madaBot.madaUrl || null,
          });
          if (!res.success) { skipped++; continue; }
          imported++;
          importedAgentIds.push(madaBot.id); // ⭐ Track ID đã import
          if (madaBot.madaUrl && /^https?:\/\//i.test(madaBot.madaUrl)) {
            try {
              const crawlRes = await adminApi.crawlAgentSources(madaBot.id, { knowledge_url: madaBot.madaUrl });
              if (crawlRes.success && crawlRes.data) crawledDocs += crawlRes.data.totalDocs || 0;
            } catch {}
          }
        } catch { skipped++; }
      } else {
        // Custom agent - lấy dữ liệu từ agents array trong state
        const customAgent = agents.find(a => a.id === botId);
        if (customAgent) {
          try {
            const res = await adminApi.createAgent({
              id: customAgent.id,
              name: customAgent.name,
              description: customAgent.description,
              avatar: customAgent.avatar,
              avatar_url: customAgent.avatar_url,
              system_prompt: customAgent.system_prompt || customAgent.systemPrompt || '',
              capabilities: customAgent.capabilities || [],
              is_active: true,
              mada_category: customAgent.mada_category,
              knowledge_url: customAgent.knowledge_url,
            });
            if (!res.success) { skipped++; continue; }
            imported++;
            importedAgentIds.push(customAgent.id); // ⭐ Track ID đã import
          } catch { skipped++; }
        } else {
          skipped++;
        }
      }
    }

    await loadAgents();
    // ⭐ Broadcast để ChatPage ở tab khác cập nhật tức thì
    if (importedAgentIds.length > 0) {
      broadcastAgentChange({ type: 'agents-imported', agentIds: importedAgentIds });
    }
    void loadAgentsForChat();
    save();
    setShowImportModal(false);
    setImporting(false);
    alert(
      `✅ ${tAgent('agent.importDone', language)}\n` +
      `• ${tAgent('agent.importCreated', language)}: ${imported} bot\n` +
      `• ${tAgent('agent.importSkipped', language)}: ${skipped} bot (${tAgent('agent.importAlreadyExists', language)})\n` +
      `• ${tAgent('agent.importDocsCrawled', language)}: ${crawledDocs}`
    );
  };

  const toggleImportBot = (botId: string) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      if (next.has(botId)) next.delete(botId);
      else next.add(botId);
      return next;
    });
  };

  const openImportModal = () => {
    // ⭐ Pre-select MADA bots chưa có trong agents
    // Custom agents cũng có thể được chọn nếu cần
    const madaAvailable = new Set(
      MADA_BOTS.filter(b => !agents.some(a => a.id === b.id)).map(b => b.id)
    );
    setImportSelected(madaAvailable);
    setShowImportModal(true);
  };

  // ============== HELPERS ==============
  const isValidUrl = (s: string) => /^https?:\/\/.+/i.test(s.trim());

  const formHasValidUrl = useMemo(
    () => isValidUrl(formData.knowledge_url) || formData.product_urls.some(u => isValidUrl(u)),
    [formData.knowledge_url, formData.product_urls],
  );

  const editingAgent = editingId ? agents.find(a => a.id === editingId) : null;

  const openCreateForm = () => {
    if (!isSuperAdmin) return;
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  // ============== RENDER ==============
  return (
    <AdminLayout
      title={t('admin.topBar.agents')}
      titleEn="Agent Management"
      titleAr="إدارة الوكلاء"
      titleFr="Gestion des agents"
      subtitle={t('admin.topBar.agentsSub')}
      subtitleEn="Create and manage AI Agents. Users can select an Agent to chat with."
      subtitleAr="إنشاء وإدارة وكلاء الذكاء الاصطناعي. يمكن للمستخدمين اختيار وكيل للدردشة."
      subtitleFr="Créer et gérer les agents IA. Les utilisateurs peuvent choisir un agent."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-2xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-2xl"></div>
          <div className="max-w-2xl relative z-10 py-4 px-5">
            <h2 className="text-2xl font-black text-on-surface mb-2">
              {tAgent('agent.title', language)}
            </h2>
            <p className="text-sm font-medium text-on-surface-variant border-l-4 border-primary pl-4 py-1.5 bg-white/40 backdrop-blur-sm rounded-r-lg">
              {tAgent('agent.subtitle', language)}
            </p>
          </div>
        </div>
      </section>

      {!isSuperAdmin && (
        <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-800 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">lock</span>
          {tAgent('agent.viewingAsRole', language)} <b>{user?.role || 'guest'}</b>. {tAgent('agent.onlySuperAdminCan', language)}
        </div>
      )}

      {/* Metrics Row */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.overview.totalUsers').split(' ')[0].toUpperCase()}</p>
            <h3 className="text-lg font-black text-on-surface">{agents.length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-green-50 to-green-100/40 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-green-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-green-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider">{t('admin.common.active').split(' ')[0].toUpperCase()}</p>
            <h3 className="text-lg font-black text-green-700">{agents.filter(a => a.isActive).length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100/40 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-gray-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-gray-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pause_circle</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wider">{t('admin.common.disabled').split(' ')[0].toUpperCase()}</p>
            <h3 className="text-lg font-black text-gray-700">{agents.filter(a => !a.isActive).length}</h3>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <span className="text-sm text-on-surface-variant font-medium">
          {loading ? tAgent('agent.loading', language) : `${agents.length} ${tAgent('agent.count', language)}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadAgents(); loadPrompts(); }}
            title={tAgent('admin.common.refresh', language)}
            className="flex items-center gap-1 bg-white text-on-surface px-3 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {tAgent('admin.common.refresh', language)}
          </button>
          {isSuperAdmin && (
            <>
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                title={tAgent('agent.selectBotImport', language)}
              >
                <span className="material-symbols-outlined text-sm">download</span>
                {tAgent('agent.importMada', language)}
              </button>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {tAgent('agent.create', language)}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-700">
          <p className="font-medium">{error}</p>
          <button onClick={loadAgents} className="mt-2 text-sm underline">{tAgent('agent.retry', language)}</button>
        </div>
      )}

      {/* ============== AGENT FORM MODAL ============== */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-2xl border-2 border-black w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={formData} size="md" />
                  <div>
                    <h3 className="text-lg font-black text-on-surface">{editingId ? tAgent('agent.edit', language) : tAgent('agent.create', language)}</h3>
                    <p className="text-xs text-on-surface-variant">{editingId ? tAgent('agent.edit', language) : tAgent('agent.create', language)}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="p-4 space-y-4"
            >
              {/* Avatar — emoji OR uploaded image */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{tAgent('agent.form.avatarUpload', language)}</label>
                <div className="flex items-start gap-3">
                  <AgentAvatar agent={formData} size="lg" />
                  <div className="flex-1 space-y-2">
                    {/* Emoji picker */}
                    <div className="flex gap-1.5 flex-wrap">
                      {['🤖', '👨‍🏫', '👩‍💻', '🔧', '💡', '🎯', '🏥', '⚖️'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, avatar: emoji, avatar_url: '' }))}
                          className={clsx(
                            'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-2 border-black shadow-[2px_2px_0px_0px_#000]',
                            !formData.avatar_url && formData.avatar === emoji
                              ? 'bg-primary text-white translate-y-[-1px]'
                              : 'bg-white hover:bg-gray-50'
                          )}
                          title={tAgent('agent.useEmoji', language)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Upload ảnh từ máy */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-700 font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {uploadingAvatar ? 'progress_activity' : 'upload'}
                        </span>
                        {uploadingAvatar ? tAgent('admin.common.loading', language) : tAgent('agent.form.avatarUpload', language)}
                      </button>
                      {formData.avatar_url && (
                        <button
                          type="button"
                          onClick={clearAvatarImage}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold text-xs border border-red-300 hover:bg-red-100"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          {tAgent('agent.deleteImage', language)}
                        </button>
                      )}
                      <span className="text-[10px] text-gray-500">{tAgent('agent.imageFormats', language)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{tAgent('agent.form.name', language)} <span className="text-red-500">*</span></label>
                <input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={tAgent('agent.form.namePlaceholder', language)}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{tAgent('agent.form.description', language)}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={tAgent('agent.form.descriptionPlaceholder', language)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* System Prompt Reference (optional) */}
              {availablePrompts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {tAgent('agent.form.promptReference', language)} <span className="text-gray-400 font-normal">{tAgent('agent.form.systemPromptOptional', language)}</span>
                  </label>
                  <select
                    value={formData.prompt_id}
                    onChange={e => setFormData(prev => ({ ...prev, prompt_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{tAgent('agent.form.noReference', language)}</option>
                    {availablePrompts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isSystem ? '⭐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* System Prompt */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {tAgent('agent.form.systemPrompt', language)} <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">{tAgent('agent.form.systemPromptOverride', language)}</span>
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder={tAgent('agent.form.systemPromptPlaceholder', language)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Knowledge URL — tổng quát */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50/40 border-2 border-blue-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-base">language</span>
                  <label className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider">{tAgent('agent.form.knowledgeUrl', language)}</label>
                </div>
                <input
                  type="url"
                  value={formData.knowledge_url}
                  onChange={e => setFormData(prev => ({ ...prev, knowledge_url: e.target.value }))}
                  placeholder={tAgent('agent.form.knowledgeUrlPlaceholder', language)}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-[10px] text-blue-700/80">
                  {tAgent('agent.form.knowledgeUrlHint', language)}
                </p>
              </div>

              {/* Product URL — sản phẩm cụ thể */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/40 border-2 border-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">inventory_2</span>
                  <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{tAgent('agent.form.productUrls', language)}</label>
                </div>
                
                {/* Danh sách URL đã thêm */}
                {formData.product_urls.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {formData.product_urls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white rounded-lg border border-emerald-300 px-2 py-1">
                        <span className="flex-1 text-xs truncate text-emerald-800" title={url}>{url}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            product_urls: prev.product_urls.filter((_, i) => i !== idx) 
                          }))}
                          className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600 font-bold text-xs"
                          title={tAgent('agent.form.removeUrl', language)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Input thêm URL mới */}
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={newProductUrl}
                    onChange={e => { setNewProductUrl(e.target.value); setProductUrlError(''); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newProductUrl.trim();
                        if (!trimmed) {
                          setProductUrlError(tAgent('agent.form.productUrlError', language));
                          return;
                        }
                        if (!/^https?:\/\//i.test(trimmed)) {
                          setProductUrlError(tAgent('agent.form.urlMustStartWithHttp', language));
                          return;
                        }
                        setFormData(prev => ({
                          ...prev,
                          product_urls: [...prev.product_urls, trimmed]
                        }));
                        setNewProductUrl('');
                        setProductUrlError('');
                      }
                    }}
                    placeholder={tAgent('agent.form.productUrlPlaceholder', language)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newProductUrl.trim();
                      if (!trimmed) {
                        setProductUrlError(tAgent('agent.form.productUrlError', language));
                        return;
                      }
                      if (!/^https?:\/\//i.test(trimmed)) {
                        setProductUrlError(tAgent('agent.form.urlMustStartWithHttp', language));
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        product_urls: [...prev.product_urls, trimmed]
                      }));
                      setNewProductUrl('');
                      setProductUrlError('');
                    }}
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm border-2 border-black hover:bg-emerald-600"
                    title={tAgent('agent.form.addUrl', language)}
                  >
                    +
                  </button>
                </div>
                {productUrlError && (
                  <p className="text-[10px] text-red-600 font-medium mt-1">
                    ⚠ {productUrlError}
                  </p>
                )}
                <p className="text-[10px] text-emerald-700/80">
                  {tAgent('agent.form.productUrlHint', language)}
                </p>
              </div>

              {/* Crawl options — Google Sheets / recursive */}
              <details className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50/40 border-2 border-purple-200">
                <summary className="cursor-pointer text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span className="material-symbols-outlined text-purple-600 text-base">tune</span>
                  {tAgent('agent.form.crawlOptions', language)}
                </summary>
                <div className="mt-3 space-y-2">
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-white/60 border border-purple-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.crawl_follow_links}
                      onChange={e => setFormData(prev => ({ ...prev, crawl_follow_links: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-purple-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-purple-900">{tAgent('agent.form.followLinks', language)}</div>
                      <div className="text-[10px] text-purple-700/80">
                        {tAgent('agent.form.followLinksDesc', language)}
                      </div>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">{tAgent('agent.form.maxDepth', language)}</label>
                      <input
                        type="number"
                        min={0}
                        max={3}
                        disabled={!formData.crawl_follow_links}
                        value={formData.crawl_max_depth}
                        onChange={e => setFormData(prev => ({ ...prev, crawl_max_depth: Math.max(0, Math.min(3, Number(e.target.value))) }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border-2 border-purple-300 text-sm disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">{tAgent('agent.form.maxPages', language)}</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        disabled={!formData.crawl_follow_links}
                        value={formData.crawl_max_pages}
                        onChange={e => setFormData(prev => ({ ...prev, crawl_max_pages: Math.max(1, Math.min(50, Number(e.target.value))) }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border-2 border-purple-300 text-sm disabled:opacity-40"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-purple-700/80 bg-white/60 rounded-lg p-2 border border-purple-200">
                    💡 {tAgent('agent.form.googleSheetsTip', language)}
                  </div>
                </div>
              </details>

              {/* Test crawl (chỉ khi edit + có URL) */}
              {editingId && formHasValidUrl && (
                <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-base">travel_explore</span>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{tAgent('agent.form.testCrawl', language)}</span>
                    </div>
                    <button
                      type="button"
                      disabled={crawling}
                      onClick={() => handleCrawl(editingId, {
                        knowledge_url: formData.knowledge_url.trim(),
                        product_urls: formData.product_urls,
                      }, false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">{crawling ? 'progress_activity' : 'play_arrow'}</span>
                      {crawling ? tAgent('agent.form.crawling', language) : tAgent('agent.form.crawlTest', language)}
                    </button>
                  </div>
                  {crawlResult && (
                    <div className="text-[11px] space-y-1">
                      <p className="font-bold text-emerald-700">✓ {tAgent('agent.kbTotal', language)}: {crawlResult.totalDocs} {tAgent('agent.form.totalDocs', language)}</p>
                      {crawlResult.results.map((r, i) => (
                        <p key={i} className={clsx('flex items-center gap-1', r.ok ? 'text-emerald-700' : 'text-red-600')}>
                          <span className="material-symbols-outlined text-xs">{r.ok ? 'check_circle' : 'error'}</span>
                          <span className="font-mono truncate">{r.url}</span>
                          <span>→ {r.docs} {r.error ? `(${r.error})` : ''}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {editingAgent?.last_crawl_at && (
                    <p className="text-[10px] text-gray-500">
                      {tAgent('agent.lastCrawl', language)}: {new Date(editingAgent.last_crawl_at).toLocaleString(language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-SA' : 'vi-VN')}
                      {editingAgent.last_crawl_status && ` · ${editingAgent.last_crawl_status}`}
                      {editingAgent.last_crawl_count != null && ` · ${editingAgent.last_crawl_count} ${tAgent('agent.documents', language)}`}
                    </p>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{tAgent('agent.form.capabilities', language)}</label>
                <div className="flex flex-wrap gap-1.5">
                  {capabilityOptions.map(cap => (
                    <button
                      key={cap.value}
                      type="button"
                      onClick={() => toggleCapability(cap.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                        formData.capabilities.includes(cap.value)
                          ? 'bg-primary text-white translate-y-[-1px]'
                          : 'bg-white text-on-surface hover:bg-gray-50'
                      )}
                    >
                      {language === 'en' ? cap.labelEn : cap.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Questions Section */}
              <details className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50/40 border-2 border-indigo-200">
                <summary className="cursor-pointer text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span className="material-symbols-outlined text-indigo-600 text-base">quiz</span>
                  {tAgent('agent.form.suggestedQuestions', language)}
                  <span className="ml-auto text-[9px] font-normal normal-case">{tAgent('agent.form.suggestedQuestionsManage', language)}</span>
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] text-indigo-700/80 bg-white/60 rounded-lg p-2 border border-indigo-200">
                    💡 {tAgent('agent.form.suggestedQuestionsHint', language)}
                  </p>
                  <p className="text-[10px] text-indigo-600/70">
                    {tAgent('agent.form.suggestedQuestionsFilterHint', language)} <code className="bg-indigo-100 px-1 rounded">{editingId || 'agent_id_khi_tao'}</code>
                  </p>
                  <a
                    href="/admin/suggested-questions"
                    target="_blank"
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    {tAgent('agent.form.openSuggestedQuestionsPage', language)}
                  </a>
                </div>
              </details>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                {tAgent('agent.form.cancel', language)}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.system_prompt.trim() || crawling}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crawling ? tAgent('agent.form.crawlSave', language) : editingId ? tAgent('agent.form.save', language) : (formHasValidUrl ? tAgent('agent.form.saveAndCrawl', language) : tAgent('agent.form.create', language))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== AGENTS GRID ============== */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl border-2 border-black p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-2xl"></div>

        {loading ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 text-gray-400 shadow-[4px_4px_0px_0px_#000] animate-pulse">
              <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">{tAgent('agent.loading', language)}</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 text-gray-400 shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </div>
            <h4 className="text-lg font-black text-on-surface mb-1">{tAgent('agent.empty', language)}</h4>
            <p className="text-sm text-on-surface-variant text-center mb-4">
              {tAgent('agent.emptyHint', language)}
            </p>
            {isSuperAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
              >
                <span className="material-symbols-outlined text-xs mr-1">download</span>
                {t('admin.agents.importMada')}
              </button>
            )}
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={clsx(
                  'p-4 rounded-xl border-2 border-black transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]',
                  (agent.is_active || agent.isActive)
                    ? 'bg-gradient-to-br from-primary/10 to-primary/5'
                    : 'bg-gray-50'
                )}
              >
                <div className="flex items-start gap-3 mb-3">
                  <AgentAvatar agent={agent} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-on-surface truncate text-sm">{agent.name}</h4>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[9px] font-bold border border-black',
                        (agent.is_active || agent.isActive) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {(agent.is_active || agent.isActive) ? 'ON' : 'OFF'}
                      </span>
                      {agent.mada_category && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-black bg-blue-100 text-blue-700">
                          🏷️ {agent.mada_category}
                        </span>
                      )}
                      {agent.created_by && agent.created_by !== 'system' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-black bg-purple-100 text-purple-700">
                          ✨ {tAgent('agent.custom', language)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">
                      {agent.description || tAgent('agent.form.noDescription', language)}
                    </p>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {agent.capabilities.slice(0, 3).map((cap, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-white border border-black/20 text-[9px] text-on-surface-variant"
                    >
                      {language === 'en' ? (capabilityOptions.find(c => c.value === cap)?.labelEn || cap) : (capabilityOptions.find(c => c.value === cap)?.label || cap)}
                    </span>
                  ))}
                </div>

                {/* Knowledge sources indicator */}
                {(agent.knowledge_url || agent.product_url || agent.last_crawl_count) && (
                  <div className="mb-3 space-y-1">
                    {agent.knowledge_url && (
                      <p className="text-[9px] text-blue-700 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-xs">language</span>
                        <span className="truncate">{agent.knowledge_url}</span>
                      </p>
                    )}
                    {agent.product_url && (
                      <p className="text-[9px] text-emerald-700 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-xs">inventory_2</span>
                        <span className="truncate">{agent.product_url}</span>
                      </p>
                    )}
                    {/* KB badge */}
                    {agent.last_crawl_count != null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-black flex items-center gap-1',
                          agent.last_crawl_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          agent.last_crawl_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          agent.last_crawl_status === 'running' ? 'bg-blue-100 text-blue-700' :
                          agent.last_crawl_status?.startsWith('failed') ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          <span className="material-symbols-outlined text-[10px]">database</span>
                          KB: {agent.last_crawl_count} {tAgent('agent.documents', language)}
                        </span>
                        {agent.last_crawl_at && (
                          <span className="text-[9px] text-gray-500">
                            {new Date(agent.last_crawl_at).toLocaleDateString(language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-SA' : 'vi-VN')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-black/10">
                  <button
                    onClick={() => toggleAgentActive(agent.id)}
                    disabled={!isSuperAdmin}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg font-bold text-xs border border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                      (agent.is_active || agent.isActive)
                        ? 'bg-yellow-100 text-yellow-700 hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50'
                        : 'bg-green-100 text-green-700 hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50'
                    )}
                    title={isSuperAdmin ? '' : t('admin.common.noPermission')}
                  >
                    {(agent.is_active || agent.isActive) ? t('admin.common.off') : t('admin.common.on')}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    disabled={!isSuperAdmin}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white font-bold text-xs border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isSuperAdmin ? t('admin.common.edit') : t('admin.common.noPermission')}
                  >
                    {isSuperAdmin ? t('admin.common.edit') : (
                      <span className="inline-flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-xs">lock</span>
                        {t('admin.common.disabled')}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTestAgentId(agent.id);
                      setTestAgentObj(agent);
                      setTestMessages([]);
                    }}
                    title="Test agent này"
                    className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                  >
                    <span className="material-symbols-outlined text-xs">play_arrow</span>
                  </button>
                  <button
                    onClick={() => openKbModal({ id: agent.id, name: agent.name })}
                    title={t('admin.agents.viewKb')}
                    className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                  >
                    <span className="material-symbols-outlined text-xs">database</span>
                  </button>
                  {isSuperAdmin ? (
                    <button
                      onClick={() => handleDelete(agent.id)}
                      title={t('admin.common.delete')}
                      className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  ) : (
                    <div
                      title={t('admin.common.noPermission')}
                      className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-300 cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-xs">lock</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============== TEST AGENT MODAL ============== */}
      {testAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50">
              <div>
                <h2 className="text-lg font-bold">{tAgent('agent.testAgent', language)}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Agent: <span className="font-bold">{testAgentObj?.name || 'Unknown'}</span>
                </p>
              </div>
              <button
                onClick={() => { setTestAgentId(null); setTestAgentObj(null); setTestMessages([]); }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[300px]">
              {testMessages.length === 0 ? (
                <div className="text-center text-sm text-on-surface-variant py-12">
                  <span className="material-symbols-outlined text-4xl mb-2">chat</span>
                  <p>{tAgent('agent.testAgentHint', language)}</p>
                  <p className="text-xs mt-1">{tAgent('agent.testAgentResult', language)}</p>
                </div>
              ) : (
                testMessages.map((m, i) => (
                  <div key={i} className={clsx('p-3 rounded-lg text-sm', m.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-slate-50 mr-8')}>
                    <div className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      {m.role === 'user' ? tAgent('agent.testYou', language) : tAgent('agent.testAgentName', language)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">{m.role === 'user' ? 'chat_bubble' : 'smart_toy'}</span>
                      {m.latency !== undefined && <span className="ml-2 text-emerald-600">{m.latency}ms</span>}
                      {m.confidence !== undefined && <span className="ml-2 text-blue-600">
                        {m.confidence <= 1 ? Math.round(m.confidence * 100) : Math.round(m.confidence)}% {tAgent('agent.testConfidence', language)}
                      </span>}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))
              )}
              {testing && (
                <div className="p-3 rounded-lg bg-slate-50 mr-8 text-sm text-on-surface-variant">
                  <span className="animate-pulse">{tAgent('agent.testThinking', language)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant p-3 flex gap-2">
              <input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestAgent(); } }}
                placeholder={tAgent('agent.testPlaceholder', language)}
                className="flex-1 h-10 px-3 rounded-lg border border-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={testing}
              />
              <button
                onClick={handleTestAgent}
                disabled={testing || !testInput.trim()}
                className="px-4 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-50"
              >
                {testing ? '...' : tAgent('agent.testSend', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== KB VIEWER MODAL ============== */}
      {kbModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border-2 border-black">
            <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600">database</span>
                  {tAgent('agent.form.knowledgeBase', language)}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  Agent: <span className="font-mono font-bold">{kbModalAgent.name}</span>
                  {!kbLoading && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 text-[10px] font-bold">
                      {kbTotal} {tAgent('agent.form.totalDocs', language)}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closeKbModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
              {kbLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <span className="material-symbols-outlined animate-spin text-violet-600 text-4xl mb-2">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">{tAgent('agent.form.loadingKb', language)}</p>
                </div>
              ) : kbDocs.length === 0 ? (
                <div className="text-center text-on-surface-variant py-16">
                  <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">database_off</span>
                  <p className="text-sm font-medium">{tAgent('agent.kbEmpty', language)}</p>
                  <p className="text-xs mt-1">{tAgent('agent.kbEmptyHint', language)}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kbDocs.map((doc) => {
                    const isExpanded = expandedDocId === doc.id;
                    const sourceKind = doc.metadata?.sourceKind;
                    const isEditingTitle = editingTitleDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="border-2 border-black/10 rounded-xl bg-white hover:border-violet-300 transition-all"
                      >
                        <div className="w-full px-4 py-3 flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                            className="flex items-start gap-3 text-left flex-1 min-w-0"
                            title={isExpanded ? tAgent('agent.kbCollapse', language) : tAgent('agent.kbExpand', language)}
                          >
                            <span className="material-symbols-outlined text-violet-600 text-sm mt-0.5">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-on-surface truncate">
                                {doc.title || tAgent('agent.kbNoTitle', language)}
                              </h4>
                              <p className="text-[10px] text-on-surface-variant truncate">{doc.source}</p>
                            </div>
                          </button>
                          {!isEditingTitle && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); startEditTitle(doc.id, doc.title); }}
                              title={tAgent('agent.kbEditTitle', language)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-300 flex items-center gap-0.5 flex-shrink-0"
                            >
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                              {tAgent('admin.common.edit', language)}
                            </button>
                          )}
                          {isEditingTitle && (
                            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingTitleValue}
                                onChange={(e) => setEditingTitleValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveDocTitle(doc.id); }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelEditTitle(); }
                                }}
                                autoFocus
                                placeholder={tAgent('agent.kbEditTitlePlaceholder', language)}
                                className="flex-1 min-w-0 px-2 py-1 text-sm font-bold rounded border-2 border-violet-400 focus:outline-none focus:border-violet-600"
                              />
                              <button
                                type="button"
                                onClick={() => saveDocTitle(doc.id)}
                                disabled={savingTitleDocId === doc.id}
                                title={t('admin.common.save')}
                                className="px-2 py-1 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {savingTitleDocId === doc.id ? (
                                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-sm">check</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditTitle}
                                title={t('admin.common.cancel')}
                                className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          )}
                          {sourceKind && (
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0',
                              sourceKind === 'product' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'
                            )}>
                              {sourceKind}
                            </span>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                            <pre className="text-xs text-on-surface bg-slate-50 p-3 rounded-lg mt-3 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                              {doc.content}
                            </pre>
                            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-[10px] font-bold text-slate-500 cursor-pointer">
                                  Metadata ({Object.keys(doc.metadata).length})
                                </summary>
                                <pre className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(doc.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-outline-variant bg-slate-50 text-xs text-on-surface-variant flex items-center justify-between">
              <span>
                {kbDocs.length < kbTotal
                  ? `${tAgent('agent.kbShowing', language)} ${kbDocs.length} / ${kbTotal} ${tAgent('agent.form.totalDocs', language)}`
                  : `${tAgent('agent.kbTotal2', language)}: ${kbTotal} ${tAgent('agent.form.totalDocs', language)}`}
              </span>
              <span>{tAgent('agent.kbForRag', language)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============== IMPORT MODAL ============== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border-2 border-black max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b-2 border-black flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 flex-shrink-0">
              <div>
                <h2 className="text-lg font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">download</span>
                  {tAgent('agent.importModalTitle', language)}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  ⭐ {tAgent('agent.importAutoReceive', language)}
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Nguồn bot info */}
            <div className="px-4 pt-3 flex gap-2 flex-shrink-0">
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                🤖 MADA: {MADA_BOTS.length} bots
              </span>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                ✨ Custom: {agents.filter(a => !MADA_BOTS.some(m => m.id === a.id)).length} bots
              </span>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto space-y-1 flex-1">
              {/* ⭐ Hiển thị MADA BOTS trước */}
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                🤖 {tAgent('agent.importMadaBots', language)}
              </div>
              {getImportableAgents()
                .filter(item => item.source === 'mada')
                .map((bot) => {
                const exists = agents.some(a => a.id === bot.id);
                const checked = importSelected.has(bot.id);
                return (
                  <label
                    key={bot.id}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      exists ? 'border-gray-200 bg-gray-50 opacity-50' : checked ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !exists && toggleImportBot(bot.id)}
                      disabled={exists}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-2xl">{bot.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-on-surface">{bot.name}</div>
                      <div className="text-xs text-on-surface-variant truncate">{bot.description}</div>
                    </div>
                    {exists ? (
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">{tAgent('agent.importAlready', language)}</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">MADA</span>
                    )}
                  </label>
                );
              })}

              {/* ⭐ Hiển thị CUSTOM BOTS (nếu có) */}
              {getImportableAgents().filter(item => item.source === 'custom').length > 0 && (
                <>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4 px-1 pt-3 border-t border-gray-200">
                    ✨ {tAgent('agent.importCustomBots', language)}
                  </div>
                  {getImportableAgents()
                    .filter(item => item.source === 'custom')
                    .map((bot) => {
                    const exists = agents.some(a => a.id === bot.id);
                    const checked = importSelected.has(bot.id);
                    return (
                      <label
                        key={bot.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                          exists ? 'border-gray-200 bg-gray-50 opacity-50' : checked ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => !exists && toggleImportBot(bot.id)}
                          disabled={exists}
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-2xl">{bot.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-on-surface">{bot.name}</div>
                          <div className="text-xs text-on-surface-variant truncate">{bot.description || tAgent('agent.form.noDescription', language)}</div>
                        </div>
                        {exists ? (
                          <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">{tAgent('agent.importAlready', language)}</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Custom</span>
                        )}
                      </label>
                    );
                  })}
                </>
              )}

              {/* Empty state */}
              {getImportableAgents().filter(item => !agents.some(a => a.id === item.id)).length === 0 && (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">check_circle</span>
                  <p className="text-sm font-medium">{tAgent('agent.importAllBotsImported', language)}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t-2 border-black bg-slate-50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-on-surface-variant">
                {importSelected.size} {tAgent('agent.importBotsSelected', language)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg border-2 border-black font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  {tAgent('admin.common.cancel', language)}
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={importing || importSelected.size === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[-1px] hover:-translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      {tAgent('agent.form.importing', language)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">download</span>
                      {tAgent('agent.importImportCount', language).replace('{count}', String(importSelected.size))}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB (chỉ admin) */}
      {isSuperAdmin && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={openCreateForm}
            className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-xl font-bold">add</span>
          </button>
        </div>
      )}
      {savedAt && (
        <div className="fixed bottom-6 left-6 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[4px_4px_0px_0px_#000] animate-pulse">
          ✓ {tAgent('agent.saved', language)} {savedAt}
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminAgents;
