import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { MADA_BOTS } from '@/lib/madaBots';
import { broadcastAgentChange } from '@/lib/agentBroadcast';
import { useAuthStore, usePromptStore, useAgentStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';

// ============== GLOBAL TRANSLATION HELPER ==============
const t = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'admin.overview.totalUsers': 'Tổng người dùng',
      'admin.common.active': 'Hoạt động',
      'admin.common.disabled': 'Tắt',
      'admin.common.on': 'BẬT',
      'admin.common.off': 'TẮT',
      'admin.common.edit': 'Sửa',
      'admin.common.noPermission': 'Bạn không có quyền thực hiện hành động này',
      'admin.common.save': 'Lưu',
      'admin.common.cancel': 'Hủy',
      'admin.common.delete': 'Xóa',
      'admin.common.refresh': 'Làm mới',
      'admin.agents.importMada': 'Import bot MADA',
      'admin.agents.viewKb': 'Xem Knowledge Base',
    },
    en: {
      'admin.overview.totalUsers': 'Total users',
      'admin.common.active': 'Active',
      'admin.common.disabled': 'Disabled',
      'admin.common.on': 'ON',
      'admin.common.off': 'OFF',
      'admin.common.edit': 'Edit',
      'admin.common.noPermission': 'You do not have permission to perform this action',
      'admin.common.save': 'Save',
      'admin.common.cancel': 'Cancel',
      'admin.common.delete': 'Delete',
      'admin.common.refresh': 'Refresh',
      'admin.agents.importMada': 'Import MADA Bots',
      'admin.agents.viewKb': 'View Knowledge Base',
    },
    ar: {
      'admin.overview.totalUsers': 'إجمالي المستخدمين',
      'admin.common.active': 'نشط',
      'admin.common.disabled': 'معطل',
      'admin.common.on': 'تشغيل',
      'admin.common.off': 'إيقاف',
      'admin.common.edit': 'تعديل',
      'admin.common.noPermission': 'ليس لديك إذن لتنفيذ هذا الإجراء',
      'admin.common.save': 'حفظ',
      'admin.common.cancel': 'إلغاء',
      'admin.common.delete': 'حذف',
      'admin.common.refresh': 'تحديث',
      'admin.agents.importMada': 'استيراد روبوتات MADA',
      'admin.agents.viewKb': 'عرض قاعدة المعرفة',
    },
    fr: {
      'admin.overview.totalUsers': 'Total utilisateurs',
      'admin.common.active': 'Actif',
      'admin.common.disabled': 'Désactivé',
      'admin.common.on': 'ON',
      'admin.common.off': 'OFF',
      'admin.common.edit': 'Modifier',
      'admin.common.noPermission': 'Vous n\'avez pas la permission d\'effectuer cette action',
      'admin.common.save': 'Sauvegarder',
      'admin.common.cancel': 'Annuler',
      'admin.common.delete': 'Supprimer',
      'admin.common.refresh': 'Actualiser',
      'admin.agents.importMada': 'Importer les bots MADA',
      'admin.agents.viewKb': 'Voir la base de connaissances',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

// ============== SUGGESTED QUESTIONS TYPES ==============
type ATCategory = 'vision' | 'hearing' | 'mobility' | 'cognition' | 'communication' | 'daily_living' | 'education' | 'general';
type ViewMode = 'end_user' | 'at_specialist';
type LanguageType = 'vi' | 'en' | 'ar' | 'fr';

interface SuggestedQuestion {
  id: string;
  agent_id: string | null;
  category: ATCategory;
  view_mode: ViewMode;
  language: LanguageType;
  question: string;
  sort_order: number;
  is_active: number;
}

const SQ_CATEGORIES: { value: ATCategory; label: string; icon: string }[] = [
  { value: 'vision', label: 'Thị giác', icon: '👁️' },
  { value: 'hearing', label: 'Thính giác', icon: '👂' },
  { value: 'mobility', label: 'Vận động', icon: '🦴' },
  { value: 'cognition', label: 'Nhận thức', icon: '🧠' },
  { value: 'communication', label: 'Giao tiếp', icon: '💬' },
  { value: 'daily_living', label: 'Sinh hoạt', icon: '🦽' },
  { value: 'education', label: 'Giáo dục', icon: '📋' },
  { value: 'general', label: 'Tổng quát', icon: '📦' },
];

const SQ_LANGUAGES: { value: LanguageType; label: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
];

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
// This will be set from inside the component using the global language store
let globalLanguage: Language = 'vi';

const tAgent = (key: string, lang?: Language): string => {
  const activeLang = lang || globalLanguage;
  return agentTranslations[key]?.[activeLang] || agentTranslations[key]?.['vi'] || key;
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
      <div className={clsx(sizeClass, 'rounded-lg bg-white border border-slate-300 overflow-hidden flex items-center justify-center shadow-sm', className)}>
        <img src={agent.avatar_url!} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={clsx(sizeClass, 'rounded-lg bg-white border border-slate-300 flex items-center justify-center shadow-sm', className)}>
      {agent.avatar || '🤖'}
    </div>
  );
}

// ============== MAIN COMPONENT ==============
export function AdminAgents() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const isReadOnly = !isSuperAdmin;
  const language: Language = 'vi' as Language;
  const loadAgentsForChat = useAgentStore((s) => s.loadAgents);
  const removeAgentForChat = useAgentStore((s) => s.removeAgent);

  // Always use Vietnamese
  globalLanguage = 'vi';

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

  // ============== SUGGESTED QUESTIONS STATE ==============
  const [sqQuestions, setSqQuestions] = useState<SuggestedQuestion[]>([]);
  const [sqLoading, setSqLoading] = useState(false);
  const [sqShowForm, setSqShowForm] = useState(false);
  const [sqEditingId, setSqEditingId] = useState<string | null>(null);
  const [sqSuccess, setSqSuccess] = useState<string | null>(null);
  const [sqFormData, setSqFormData] = useState({
    category: 'general' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    language: 'vi' as LanguageType,
    question: '',
    sort_order: 0,
    is_active: true,
  });

  // Load questions when editing an agent
  useEffect(() => {
    if (editingId) {
      loadSqQuestions(editingId);
    } else {
      setSqQuestions([]);
    }
  }, [editingId]);

  const loadSqQuestions = async (agentId: string) => {
    setSqLoading(true);
    try {
      const res = await adminApi.getSuggestedQuestions({ agent_id: agentId });
      if (res.success && res.data) {
        setSqQuestions(res.data);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setSqLoading(false);
    }
  };

  const resetSqForm = () => {
    setSqFormData({
      category: 'general',
      view_mode: 'end_user',
      language: 'vi',
      question: '',
      sort_order: 0,
      is_active: true,
    });
    setSqEditingId(null);
  };

  const handleSqSubmit = async () => {
    if (!sqFormData.question.trim()) {
      alert('Vui lòng nhập câu hỏi');
      return;
    }
    if (sqFormData.question.length > 200) {
      alert('Câu hỏi không được vượt quá 200 ký tự');
      return;
    }
    if (!editingId) {
      alert('Vui lòng lưu Agent trước khi thêm câu hỏi');
      return;
    }

    try {
      if (sqEditingId) {
        await adminApi.updateSuggestedQuestion(sqEditingId, {
          category: sqFormData.category,
          view_mode: sqFormData.view_mode,
          language: sqFormData.language,
          question: sqFormData.question,
          sort_order: sqFormData.sort_order,
          is_active: sqFormData.is_active,
        });
      } else {
        await adminApi.createSuggestedQuestion({
          category: sqFormData.category,
          view_mode: sqFormData.view_mode,
          language: sqFormData.language,
          question: sqFormData.question,
          sort_order: sqFormData.sort_order,
          agent_id: editingId,
        });
      }
      setSqShowForm(false);
      resetSqForm();
      loadSqQuestions(editingId);
      setSqSuccess(sqEditingId ? 'Đã cập nhật câu hỏi!' : 'Đã thêm câu hỏi!');
      setTimeout(() => setSqSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSqEdit = (q: SuggestedQuestion) => {
    setSqFormData({
      category: q.category,
      view_mode: q.view_mode,
      language: q.language,
      question: q.question,
      sort_order: q.sort_order,
      is_active: q.is_active === 1,
    });
    setSqEditingId(q.id);
    setSqShowForm(true);
  };

  const handleSqDelete = async (id: string) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    try {
      await adminApi.deleteSuggestedQuestion(id);
      if (editingId) loadSqQuestions(editingId);
      setSqSuccess('Đã xóa câu hỏi!');
      setTimeout(() => setSqSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSqToggle = async (q: SuggestedQuestion) => {
    try {
      await adminApi.updateSuggestedQuestion(q.id, { is_active: q.is_active !== 1 });
      if (editingId) loadSqQuestions(editingId);
      setSqSuccess(q.is_active === 1 ? 'Đã tắt câu hỏi' : 'Đã bật câu hỏi');
      setTimeout(() => setSqSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

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
    let autoAvailable = 0; // ⭐ Custom agents đã tự động có sẵn
    let crawledDocs = 0;
    // ⭐ Track các agent đã import để broadcast
    const importedAgentIds: string[] = [];

    // Xử lý từng agent được chọn (chỉ MADA bots)
    for (const botId of importSelected) {
      const exists = agents.some(a => a.id === botId);
      if (exists) { skipped++; continue; }

      // ⭐ Chỉ tìm trong MADA_BOTS - Custom agents đã có sẵn trong DB
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
      }
      // ⭐ Custom agents KHÔNG cần xử lý ở đây - đã có sẵn trong DB
    }

    // ⭐ Đếm custom agents để thông báo
    const customAgentCount = agents.filter(a => !MADA_BOTS.some(m => m.id === a.id)).length;
    if (customAgentCount > 0) autoAvailable = customAgentCount;

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
      `• ${tAgent('agent.importCreated', language)}: ${imported} MADA bot\n` +
      (autoAvailable > 0 ? `• ✨ Custom bots: ${autoAvailable} bot tự động có sẵn!\n` : '') +
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
    // ⭐ Chỉ pre-select MADA bots CHƯA import
    // Custom agents (Super Admin tạo) đã tự động có sẵn trong DB → không cần import
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
      titleKey="admin.topBar.agents"
      subtitleKey="admin.topBar.agentsSub"
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
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-xl p-3 border border-slate-300 flex items-center gap-2 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.overview.totalUsers').split(' ')[0].toUpperCase()}</p>
            <h3 className="text-lg font-black text-on-surface">{agents.length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-green-50 to-green-100/40 backdrop-blur-xl rounded-xl p-3 border border-slate-300 flex items-center gap-2 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-green-200 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-green-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>toggle_on</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider">{t('admin.common.active').split(' ')[0].toUpperCase()}</p>
            <h3 className="text-lg font-black text-green-700">{agents.filter(a => a.isActive).length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100/40 backdrop-blur-xl rounded-xl p-3 border border-slate-300 flex items-center gap-2 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-gray-200 border border-slate-300 flex items-center justify-center shadow-sm">
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
            className="flex items-center gap-1 bg-white text-on-surface px-3 py-2 rounded-full font-bold text-xs border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {tAgent('admin.common.refresh', language)}
          </button>
          {isSuperAdmin && (
            <>
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-full font-bold text-xs border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                title={tAgent('agent.selectBotImport', language)}
              >
                <span className="material-symbols-outlined text-sm">download</span>
                {tAgent('agent.importMada', language)}
              </button>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-xs border border-slate-200 shadow-sm hover:shadow-sm transition-all"
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
          <div className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-lg">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 z-10">
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
                  className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
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
                            'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border border-slate-200 shadow-sm',
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-700 font-bold text-xs border border-slate-200 shadow-sm  disabled:opacity-50"
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
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    className="w-full px-3 py-2 rounded-lg bg-white/60 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border border-slate-300 text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm border border-slate-300 hover:bg-emerald-600"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs border border-slate-200 shadow-sm  disabled:opacity-50"
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
                      {tAgent('agent.lastCrawl', language)}: {new Date(editingAgent.last_crawl_at).toLocaleString({'en': 'en-US', 'fr': 'fr-FR', 'ar': 'ar-SA', 'vi': 'vi-VN'}[language] ?? 'vi-VN')}
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
                        'px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 transition-all shadow-sm',
                        formData.capabilities.includes(cap.value)
                          ? 'bg-primary text-white translate-y-[-1px]'
                          : 'bg-white text-on-surface hover:bg-gray-50'
                      )}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ============== SUGGESTED QUESTIONS - ENHANCED UI ============== */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-violet-50/50 border-2 border-blue-200/80 overflow-hidden shadow-sm">
                {/* Section Header */}
                <div className="px-4 pt-3.5 pb-3 border-b border-blue-100/80 bg-white/60 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Luminous Icon */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur-sm opacity-30"></div>
                        <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            {tAgent('agent.form.suggestedQuestions', language)}
                          </h3>
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/70">
                            {sqQuestions.length}
                          </span>
                          {sqSuccess && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse">
                              <span className="material-symbols-outlined text-[10px]">check</span>
                              {sqSuccess}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {editingId ? 'Câu hỏi riêng cho agent này' : 'Lưu Agent trước để thêm câu hỏi'}
                        </p>
                      </div>
                    </div>
                    {/* Action buttons row */}
                    <div className="flex items-center gap-1.5">
                      {/* AI Suggest Button */}
                      {!isReadOnly && editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            const samples = [
                              'Làm sao để kiểm tra tình trạng đơn hàng?',
                              'Chính sách bảo hành và đổi trả như thế nào?',
                              'Có những hình thức thanh toán nào được hỗ trợ?',
                              'Thời gian làm việc và hỗ trợ viên trực tuyến?',
                              'MADA AI có thể hướng dẫn tôi cài đặt ứng dụng không?',
                            ];
                            const pick = samples[Math.floor(Math.random() * samples.length)];
                            setSqFormData(prev => ({ ...prev, question: pick }));
                            setSqShowForm(true);
                          }}
                          className="relative group overflow-hidden flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/70 shadow-xs transition-all"
                          title="Gợi ý câu hỏi với AI"
                        >
                          <span className="material-symbols-outlined text-[11px] text-amber-500">auto_awesome</span>
                          <span>AI gợi ý</span>
                        </button>
                      )}
                      {/* Quick Add Button */}
                      {!isReadOnly && editingId && (
                        <button
                          type="button"
                          onClick={() => { resetSqForm(); setSqShowForm(true); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm border border-blue-600 transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[11px]">add</span>
                          <span>Thêm</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-3 space-y-3">
                  {/* Quick chips - shown when form is hidden and no questions */}
                  {!sqShowForm && sqQuestions.length === 0 && (
                    <div className="p-3 rounded-xl bg-white/70 border border-dashed border-blue-200 text-center">
                      <div className="w-10 h-10 rounded-xl bg-blue-100/80 mx-auto mb-2 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400 text-xl">chat_bubble</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Chưa có câu hỏi nào
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Nhấn <b className="text-blue-600">"Thêm"</b> hoặc <b className="text-amber-600">"AI gợi ý"</b> để tạo câu hỏi đầu tiên
                      </p>
                      {/* Quick chips */}
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                        {[
                          'Kiểm tra đơn hàng?',
                          'Chính sách đổi trả?',
                          'Thời gian hỗ trợ?',
                        ].map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            onClick={() => {
                              setSqFormData(prev => ({ ...prev, question: txt }));
                              setSqShowForm(true);
                            }}
                            className="px-2.5 py-1 text-[10px] font-medium text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-all active:scale-95"
                          >
                            {txt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add/Edit Form - Modern UI */}
                  {sqShowForm && (
                    <div className="rounded-xl bg-white/90 border border-blue-200/80 shadow-sm overflow-hidden">
                      {/* Form top accent */}
                      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500"></div>
                      <div className="p-3 space-y-3">
                        {/* Controls Row */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Category */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Danh mục</label>
                            <select
                              value={sqFormData.category}
                              onChange={(e) => setSqFormData(prev => ({ ...prev, category: e.target.value as ATCategory }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-700 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer"
                            >
                              {SQ_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Language */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Ngôn ngữ</label>
                            <select
                              value={sqFormData.language}
                              onChange={(e) => setSqFormData(prev => ({ ...prev, language: e.target.value as LanguageType }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-700 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer"
                            >
                              {SQ_LANGUAGES.map(l => (
                                <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Sort Order */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Thứ tự</label>
                            <div className="relative flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-400/40 transition-all">
                              <button
                                type="button"
                                onClick={() => setSqFormData(prev => ({ ...prev, sort_order: Math.max(0, prev.sort_order - 1) }))}
                                className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">remove</span>
                              </button>
                              <input
                                type="number"
                                value={sqFormData.sort_order}
                                onChange={(e) => setSqFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                className="w-full py-1.5 bg-transparent border-0 text-[10px] font-semibold text-slate-800 text-center focus:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => setSqFormData(prev => ({ ...prev, sort_order: prev.sort_order + 1 }))}
                                className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">add</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Question Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1 ml-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nội dung câu hỏi</label>
                            <span className={clsx('text-[9px] font-semibold', sqFormData.question.length >= 200 ? 'text-red-500' : sqFormData.question.length >= 180 ? 'text-amber-500' : 'text-slate-400')}>{sqFormData.question.length}/200</span>
                          </div>
                          <div className="relative">
                            <textarea
                              value={sqFormData.question}
                              onChange={(e) => setSqFormData(prev => ({ ...prev, question: e.target.value.slice(0, 200) }))}
                              placeholder="Nhập câu hỏi gợi ý (VD: Làm sao để kiểm tra tình trạng đơn hàng?)..."
                              rows={2}
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-800 placeholder-slate-400 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400 transition-all resize-none leading-relaxed"
                            />
                          </div>
                        </div>

                        {/* Status Toggle Row */}
                        <div className="flex items-center justify-between">
                          {/* Modern Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => setSqFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <div className={clsx(
                              'relative w-9 h-5 rounded-full transition-colors duration-300',
                              sqFormData.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                            )}>
                              <span className={clsx(
                                'absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 shadow-sm transition-transform duration-300 flex items-center justify-center',
                                sqFormData.is_active && 'translate-x-4'
                              )}>
                                <span className={clsx('w-1 h-1 rounded-full', sqFormData.is_active ? 'bg-emerald-500' : 'bg-slate-400')}></span>
                              </span>
                            </div>
                            <span className={clsx(
                              'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all',
                              sqFormData.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            )}>
                              {sqFormData.is_active ? '✓ Hoạt động' : '✕ Tạm tắt'}
                            </span>
                          </button>

                          {/* Form Action Buttons */}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setSqShowForm(false); resetSqForm(); }}
                              className="px-3 py-1.5 rounded-lg bg-white text-slate-600 text-[10px] font-semibold border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={handleSqSubmit}
                              disabled={!sqFormData.question.trim() || sqFormData.question.length > 200}
                              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-bold hover:from-blue-600 hover:to-indigo-600 shadow-sm border border-blue-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-indigo-500"
                            >
                              {sqEditingId ? 'Cập nhật' : 'Thêm mới'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions List */}
                  {sqLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                      <span className="text-[11px] text-blue-500 font-medium">Đang tải...</span>
                    </div>
                  ) : sqQuestions.length > 0 && !sqShowForm && (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {sqQuestions
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((q) => (
                          <div key={q.id} className={clsx(
                            'group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all',
                            q.is_active === 1
                              ? 'bg-white/80 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                              : 'bg-slate-50/70 border-slate-100 opacity-60'
                          )}>
                            {/* Category Icon */}
                            <div className={clsx(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5',
                              q.is_active === 1 ? 'bg-blue-50' : 'bg-slate-100'
                            )}>
                              {SQ_CATEGORIES.find(c => c.value === q.category)?.icon || '📦'}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-slate-800 font-medium line-clamp-2 leading-relaxed">{q.question}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px]">{SQ_LANGUAGES.find(l => l.value === q.language)?.flag}</span>
                                <span className="text-[9px] text-slate-300">•</span>
                                <span className="text-[9px] text-slate-400">{SQ_CATEGORIES.find(c => c.value === q.category)?.label}</span>
                                <span className="text-[9px] text-slate-300">•</span>
                                <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-semibold', q.is_active === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
                                  {q.is_active === 1 ? '✓ Hoạt động' : '✕ Tắt'}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            {!isReadOnly && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleSqToggle(q)}
                                  className="w-7 h-7 rounded-lg hover:bg-emerald-50 flex items-center justify-center transition-colors"
                                  title={q.is_active === 1 ? 'Tắt' : 'Bật'}
                                >
                                  <span className={clsx('material-symbols-outlined text-[13px]', q.is_active === 1 ? 'text-emerald-500' : 'text-slate-400')}>
                                    {q.is_active === 1 ? 'toggle_on' : 'toggle_off'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSqEdit(q)}
                                  className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center transition-colors"
                                  title="Sửa"
                                >
                                  <span className="material-symbols-outlined text-[13px] text-blue-500">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSqDelete(q.id)}
                                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                                  title="Xóa"
                                >
                                  <span className="material-symbols-outlined text-[13px] text-red-400">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-bold text-xs hover:bg-gray-100 transition-colors shadow-sm"
              >
                {tAgent('agent.form.cancel', language)}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.system_prompt.trim() || crawling}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border border-slate-200 shadow-sm hover:-translate-y-0.5  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crawling ? tAgent('agent.form.crawlSave', language) : editingId ? tAgent('agent.form.save', language) : (formHasValidUrl ? tAgent('agent.form.saveAndCrawl', language) : tAgent('agent.form.create', language))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== AGENTS GRID ============== */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl border border-slate-300 p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-2xl"></div>

        {loading ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border border-slate-300 flex items-center justify-center mb-4 text-gray-400 shadow-sm animate-pulse">
              <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">{tAgent('agent.loading', language)}</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border border-slate-300 flex items-center justify-center mb-4 text-gray-400 shadow-sm">
              <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </div>
            <h4 className="text-lg font-black text-on-surface mb-1">{tAgent('agent.empty', language)}</h4>
            <p className="text-sm text-on-surface-variant text-center mb-4">
              {tAgent('agent.emptyHint', language)}
            </p>
            {isSuperAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-xs border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-sm transition-all"
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
                  'p-4 rounded-xl border border-slate-300 transition-all shadow-sm hover:shadow-md',
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
                        'px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-300',
                        (agent.is_active || agent.isActive) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {(agent.is_active || agent.isActive) ? 'ON' : 'OFF'}
                      </span>
                      {agent.mada_category && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-300 bg-blue-100 text-blue-700">
                          🏷️ {agent.mada_category}
                        </span>
                      )}
                      {agent.created_by && agent.created_by !== 'system' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-300 bg-purple-100 text-purple-700">
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
                      className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[9px] text-on-surface-variant"
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
                          'px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-slate-300 flex items-center gap-1',
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
                            {new Date(agent.last_crawl_at).toLocaleDateString({'en': 'en-US', 'fr': 'fr-FR', 'ar': 'ar-SA', 'vi': 'vi-VN'}[language] ?? 'vi-VN')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => toggleAgentActive(agent.id)}
                    disabled={!isSuperAdmin}
                    className={clsx(
                      'flex-none min-w-[60px] py-1.5 px-2 rounded-lg font-bold text-xs border border-slate-300 transition-all shadow-sm',
                      (agent.is_active || agent.isActive)
                        ? 'bg-yellow-100 text-yellow-700  disabled:opacity-50'
                        : 'bg-green-100 text-green-700  disabled:opacity-50'
                    )}
                    title={isSuperAdmin ? '' : t('admin.common.noPermission')}
                  >
                    {(agent.is_active || agent.isActive) ? t('admin.common.off') : t('admin.common.on')}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    disabled={!isSuperAdmin}
                    className="flex-none min-w-[60px] py-1.5 px-2 rounded-lg bg-primary text-white font-bold text-xs border border-slate-300 shadow-sm  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center border border-slate-300 shadow-sm "
                  >
                    <span className="material-symbols-outlined text-xs">play_arrow</span>
                  </button>
                  <button
                    onClick={() => openKbModal({ id: agent.id, name: agent.name })}
                    title={t('admin.agents.viewKb')}
                    className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center border border-slate-300 shadow-sm "
                  >
                    <span className="material-symbols-outlined text-xs">database</span>
                  </button>
                  {isSuperAdmin ? (
                    <button
                      onClick={() => handleDelete(agent.id)}
                      title={t('admin.common.delete')}
                      className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center border border-slate-300 shadow-sm "
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
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-300">
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
                        className="border border-slate-300/10 rounded-xl bg-white hover:border-violet-300 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">download_for_offline</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    {tAgent('agent.importModalTitle', language)}
                    <span className="ml-2 text-xs font-normal text-slate-500">(MADA bots)</span>
                  </h2>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-green-500">auto_awesome</span>
                    Custom bots tự động có sẵn — không cần import
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-on-surface hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Stats Bar */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center">
                      <span className="text-xs">🤖</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">MADA</p>
                      <span className="text-[10px] font-black text-indigo-700">
                        {MADA_BOTS.length - getImportableAgents().filter(item => item.source === 'mada' && !agents.some(a => a.id === item.id)).length}/{MADA_BOTS.length}
                      </span>
                    </div>
                  </div>
                  <div className="w-px h-4 bg-slate-300"></div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-green-600 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-green-600 uppercase">Custom</p>
                      <span className="text-[10px] font-black text-green-700">{agents.filter(a => !MADA_BOTS.some(m => m.id === a.id)).length}</span>
                    </div>
                  </div>
                  <div className="w-px h-4 bg-slate-300"></div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-green-600 text-xs">check_circle</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-green-600 uppercase">Total</p>
                      <span className="text-[10px] font-black text-green-700">{agents.length}</span>
                    </div>
                  </div>
                </div>
                {/* Quick Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const allMadaAvailable = getImportableAgents()
                        .filter(item => item.source === 'mada' && !agents.some(a => a.id === item.id))
                        .map(item => item.id);
                      setImportSelected(new Set(allMadaAvailable));
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-primary text-white font-bold text-[10px] hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">select_all</span>
                    MADA
                  </button>
                  <button
                    onClick={() => setImportSelected(new Set())}
                    className="px-2.5 py-1.5 rounded-md bg-white text-on-surface font-bold text-[10px] hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                    Bỏ
                  </button>
                </div>
              </div>
            </div>

            {/* Bot List */}
            <div className="p-3 overflow-y-auto space-y-3 flex-1">
              {/* MADA BOTS Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center">
                    <span className="text-xs">🤖</span>
                  </div>
                  <h3 className="font-bold text-xs text-on-surface uppercase tracking-wide">{tAgent('agent.importMadaBots', language)}</h3>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {getImportableAgents().filter(item => item.source === 'mada' && !agents.some(a => a.id === item.id)).length} available
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getImportableAgents()
                    .filter(item => item.source === 'mada')
                    .map((bot) => {
                    const exists = agents.some(a => a.id === bot.id);
                    const checked = importSelected.has(bot.id);
                    return (
                      <label
                        key={bot.id}
                        className={clsx(
                          'relative flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all',
                          exists 
                            ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed' 
                            : checked 
                              ? 'border-primary bg-primary/5' 
                              : 'border-slate-200 bg-white hover:border-primary/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => !exists && toggleImportBot(bot.id)}
                          disabled={exists}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <span className="text-lg">{bot.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[11px] text-on-surface truncate">{bot.name}</div>
                        </div>
                        {exists && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-slate-200 text-slate-500 px-1 py-0.5 rounded">
                            ✓
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* CUSTOM BOTS Section - Tự động có sẵn, không cần import */}
              {getImportableAgents().filter(item => item.source === 'custom').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                    <h3 className="font-bold text-xs text-on-surface uppercase tracking-wide">{tAgent('agent.importCustomBots', language)}</h3>
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-300">
                      Tự động có sẵn
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getImportableAgents()
                      .filter(item => item.source === 'custom')
                      .map((bot) => {
                      return (
                        <label
                          key={bot.id}
                          className="relative flex flex-col gap-1 p-2 rounded-lg border border-green-300 bg-green-50 cursor-default transition-all hover:border-green-400"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{bot.avatar}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[11px] text-on-surface truncate">{bot.name}</div>
                            </div>
                            <span className="material-symbols-outlined text-green-500 text-sm flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          </div>
                          {/* Action buttons for Super Admin */}
                          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-green-200">
                            <button
                              type="button"
                              onClick={() => {
                                const agent = agents.find(a => a.id === bot.id);
                                if (agent) {
                                  handleEdit(agent);
                                  setShowImportModal(false);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 transition-colors"
                              title={tAgent('admin.common.edit', language)}
                            >
                              <span className="material-symbols-outlined text-xs">edit</span>
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(tAgent('agent.confirmDeleteQuestion', language))) return;
                                setShowImportModal(false);
                                await handleDelete(bot.id);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-colors"
                              title={tAgent('admin.common.delete', language)}
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                              Xóa
                            </button>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {getImportableAgents().filter(item => !agents.some(a => a.id === item.id)).length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-2xl text-green-600">verified</span>
                  </div>
                  <h3 className="font-black text-sm text-on-surface mb-1">{tAgent('agent.importAllBotsImported', language)}</h3>
                  <p className="text-xs text-on-surface-variant">Tất cả MADA bots đã import. Custom bots tự động có sẵn!</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                  importSelected.size > 0 
                    ? "bg-primary text-white" 
                    : "bg-slate-200"
                )}>
                  {importSelected.size > 0 ? (
                    <span className="material-symbols-outlined text-white text-sm">check</span>
                  ) : (
                    <span className="material-symbols-outlined text-slate-400 text-sm">download</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Selected</p>
                  <p className={clsx(
                    "font-bold text-sm",
                    importSelected.size > 0 ? "text-primary" : "text-slate-400"
                  )}>
                    {importSelected.size} bot{importSelected.size !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-on-surface font-bold text-xs bg-white hover:bg-slate-100 transition-colors"
                >
                  {tAgent('admin.common.cancel', language)}
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={importing || importSelected.size === 0}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5",
                    importing || importSelected.size === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {importing ? (
                    <>
                      <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                      {tAgent('agent.form.importing', language)}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs">download</span>
                      {tAgent('agent.importImportCount', language).replace('{count}', String(importSelected.size))}
                    </>
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
            className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-xl font-bold">add</span>
          </button>
        </div>
      )}
      {savedAt && (
        <div className="fixed bottom-6 left-6 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border border-slate-200 shadow-sm animate-pulse">
          ✓ {tAgent('agent.saved', language)} {savedAt}
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminAgents;
