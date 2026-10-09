import { useState, useEffect, useCallback } from 'react';
import { adminApi } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import { broadcastAgentChange, broadcastQuestionsChange } from '@/lib/agentBroadcast';
import { MADA_BOTS } from '@/lib/madaBots';
import clsx from 'clsx';
import {
  Bot, Plus, Trash2,
  MessageSquare, Sparkles, Image as ImageIcon, FileText,
  Loader2, Check, X, ChevronRight, ExternalLink,
  GripVertical, Settings,
  ChevronDown, Bell, Play, History, CloudUpload,
  SlidersHorizontal, Database, Wand2, ArrowLeft
} from 'lucide-react';

// ============== TYPES ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  avatar_url?: string | null;
  system_prompt?: string;
  capabilities?: string | string[];
  is_active: boolean | number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  knowledge_url?: string | null;
  product_urls?: string | null;
  bot_id?: string | null;
  crawl_follow_links?: boolean;
  crawl_max_depth?: number;
  crawl_max_pages?: number;
  isActive?: boolean;
  version?: string;
  iso_code?: string;
  wcag_level?: string;
}

interface SuggestedQuestion {
  id: string;
  agent_id: string;
  question: string;
  sort_order: number;
  is_active: number;
}

interface KnowledgeUrl {
  id?: string;
  url: string;
  title?: string;
  pages_count?: number;
  status?: 'vectorized' | 'pending' | 'error';
}

// ============== MADA BOT EMOJI MAPPING ==============
const MADA_BOT_EMOJI: Record<string, string> = {};
MADA_BOTS.forEach((bot) => { MADA_BOT_EMOJI[bot.id] = bot.avatar; });

const EMOJI_BY_KEYWORD: [string, string][] = [
  ['hearing', '👂'], ['thính', '👂'],
  ['vision', '👁️'], ['thị', '👁️'], ['eye', '👁️'],
  ['speech', '💬'], ['voice', '💬'], ['giọng', '💬'],
  ['cognitive', '🧠'], ['mental', '🧠'], ['nhận thức', '🧠'],
  ['neuro', '🦴'], ['movement', '🦴'], ['vận động', '🦴'],
  ['mobility', '🦽'], ['di chuyển', '🦽'],
  ['regulatory', '📋'], ['standards', '📋'], ['quy định', '📋'],
];

function getBotEmoji(botId?: string, name?: string): string {
  if (botId && MADA_BOT_EMOJI[botId]) return MADA_BOT_EMOJI[botId];
  if (!name) return '🤖';
  const lower = name.toLowerCase();
  for (const [kw, emoji] of EMOJI_BY_KEYWORD) {
    if (lower.includes(kw)) return emoji;
  }
  return '🤖';
}

// ============== TRANSLATIONS ==============
const translations: Record<Language, Record<string, string>> = {
  vi: {
    title: 'AI Studio',
    subtitle: 'System Prompts',
    // Header
    brand: 'mada',
    brandSub: 'UNIVERSAL ACCESS',
    cluster: 'Cluster',
    clusterReady: 'WCAG AAA Ready',
    testSandbox: 'Test Sandbox',
    notifications: 'Thông báo',
    logout: 'Đăng xuất',
    superAdmin: 'SUPER',
    enterprisePackage: 'Enterprise Assistive',
    // Agent list
    agentList: 'Danh sách Agent AI',
    agentCount: '7 chuyên ngành chuẩn hóa',
    addNew: 'Thêm mới',
    searchPlaceholder: 'Tìm tên bot, mã ISO, từ khóa...',
    filterAll: 'Tất cả',
    filterRunning: 'Đang chạy',
    filterTraining: 'Đang huấn luyện',
    active: 'Hoạt động',
    selected: 'Đang chọn',
    syncStatus: 'Đã đồng bộ',
    dragSort: 'Thứ tự tự động lưu khi thả',
    // Workspace
    workspace: 'Không gian huấn luyện',
    agentCode: 'Mã hiệu',
    versionHistory: 'Lịch sử phiên bản',
    testThisSandbox: 'Test Sandbox này',
    publishAgent: 'Xuất bản Agent',
    // Hero card
    operationalStatus: 'Trạng thái tiếp nhận',
    readyToServe: 'Sẵn sàng phục vụ',
    version: 'v',
    live: 'Live',
    // Metadata
    basicConfig: 'Thông tin cấu hình cơ bản & Tiêu chuẩn ISO',
    isoStandard: 'Định danh chuẩn quốc tế MADA',
    avatar: 'Ảnh đại diện (Avatar)',
    uploadNew: 'Tải ảnh mới',
    deleteAvatar: 'Xóa avatar và đặt lại mặc định',
    agentName: 'Tên hiển thị Agent AI',
    // System Prompt
    systemPrompt: 'SYSTEM PROMPT CHÍNH (PROMPT TEMPLATE)',
    openLargeEditor: 'Bấm để chỉnh sửa trong cửa sổ lớn',
    characters: 'ký tự',
    copy: 'Sao chép nội dung prompt',
    insertVariable: 'Chèn biến động',
    aiOptimize: 'Tối ưu bằng AI',
    systemPromptPlaceholder: 'Nhập prompt hệ thống...',
    // Knowledge
    knowledgeBase: 'Kiến thức (Knowledge Base URLs)',
    sources: 'nguồn',
    autoSync: 'Hệ thống tự động đồng bộ RAG định kỳ 24h',
    addUrl: '+ Thêm URL',
    urlPlaceholder: 'https://example.com/tai-lieu-iso-9241-171...',
    vectorized: 'Đã vector hóa',
    pages: 'trang tài liệu',
    removeKnowledge: 'Xóa nguồn kiến thức',
    // Questions
    suggestedQuestions: 'Câu hỏi gợi ý (Suggested Prompts)',
    questionCount: '',
    showOnNewChat: 'Hiển thị khi mở hộp thoại hội thoại mới',
    addQuestion: '+ Thêm câu hỏi',
    questionPlaceholder: 'Nhập câu hỏi gợi ý mới cho người dùng...',
    removeQuestion: 'Xóa câu hỏi',
    // Actions
    saveDraft: 'Lưu bản nháp (Draft)',
    applyPublish: 'Áp dụng & Xuất bản Agent',
    cancel: 'Hủy bỏ',
    changesApply: 'Mọi thay đổi sẽ có hiệu lực tức thời trên API Chatbot MADA ngay sau khi xuất bản.',
    // Status
    saving: 'Đang lưu...',
    saved: 'Đã lưu!',
    loading: 'Đang tải...',
    error: 'Đã xảy ra lỗi',
    success: 'Thành công',
    // New handlers
    testMessage: 'Tin nhắn kiểm tra',
    sendTest: 'Gửi & Nhận phản hồi',
    processing: 'Đang xử lý...',
    agentResponse: 'Phản hồi Agent',
    noHistory: 'Chưa có lịch sử phiên bản',
    current: 'Hiện tại',
    close: 'Đóng',
    creatingAgent: 'Đang tạo...',
    createAgent: 'Tạo Agent',
    publishNow: 'Xuất bản ngay',
    optimizingAi: 'Đang tối ưu bằng AI...',
    optimizePrompt: 'Tối ưu Prompt',
    originalPrompt: 'Prompt gốc',
    optimizedPrompt: 'Prompt đã tối ưu',
    applyOptimized: 'Áp dụng prompt đã tối ưu',
    publishConfirmTitle: 'Xuất bản Agent?',
    publishConfirmDesc: 'sẽ được kích hoạt ngay lập tức.',
    fileTooLarge: 'Kích thước file quá lớn (max 2MB)',
    uploadFailed: 'Upload avatar thất bại',
    selectAgentFirst: 'Vui lòng chọn một Agent trước',
    emptyPromptError: 'Prompt hiện tại trống, không thể tối ưu.',
    enterAgentName: 'Vui lòng nhập tên Agent',
    creatingFailed: 'Tạo agent thất bại',
    publishFailed: 'Xuất bản thất bại',
    aiOptimizeFailed: 'Không thể kết nối server tối ưu AI.',
    selectAgentError: 'Vui lòng chọn một Agent trước',
    creating: 'Đang tạo...',
    publishing: 'Đang xuất bản...',
    optimizing: 'Đang tối ưu...',
  },
  en: {
    title: 'AI Studio',
    subtitle: 'System Prompts',
    brand: 'mada',
    brandSub: 'UNIVERSAL ACCESS',
    cluster: 'Cluster',
    clusterReady: 'WCAG AAA Ready',
    testSandbox: 'Test Sandbox',
    notifications: 'Notifications',
    logout: 'Logout',
    superAdmin: 'SUPER',
    enterprisePackage: 'Enterprise Assistive',
    agentList: 'AI Agent List',
    agentCount: '7 standardized specialties',
    addNew: 'Add New',
    searchPlaceholder: 'Search bot name, ISO code, keywords...',
    filterAll: 'All',
    filterRunning: 'Running',
    filterTraining: 'Training',
    active: 'Active',
    selected: 'Selected',
    syncStatus: 'Synced',
    dragSort: 'Auto-save order on drop',
    workspace: 'Training Space',
    agentCode: 'Code',
    versionHistory: 'Version History',
    testThisSandbox: 'Test this Sandbox',
    publishAgent: 'Publish Agent',
    operationalStatus: 'Operational Status',
    readyToServe: 'Ready to serve',
    version: 'v',
    live: 'Live',
    basicConfig: 'Basic Configuration & ISO Standards',
    isoStandard: 'MADA International Standard ID',
    avatar: 'Avatar',
    uploadNew: 'Upload new',
    deleteAvatar: 'Delete avatar and reset to default',
    agentName: 'Agent Display Name',
    systemPrompt: 'SYSTEM PROMPT (PROMPT TEMPLATE)',
    openLargeEditor: 'Click to edit in large window',
    characters: 'characters',
    copy: 'Copy prompt content',
    insertVariable: 'Insert variable',
    aiOptimize: 'Optimize with AI',
    systemPromptPlaceholder: 'Enter system prompt...',
    knowledgeBase: 'Knowledge (Knowledge Base URLs)',
    sources: 'sources',
    autoSync: 'System auto-syncs RAG every 24h',
    addUrl: '+ Add URL',
    urlPlaceholder: 'https://example.com/document...',
    vectorized: 'Vectorized',
    pages: 'document pages',
    removeKnowledge: 'Remove knowledge source',
    suggestedQuestions: 'Suggested Prompts',
    questionCount: '',
    showOnNewChat: 'Show when opening new chat dialog',
    addQuestion: '+ Add question',
    questionPlaceholder: 'Enter new suggested question...',
    removeQuestion: 'Remove question',
    saveDraft: 'Save Draft',
    applyPublish: 'Apply & Publish Agent',
    cancel: 'Cancel',
    changesApply: 'All changes take effect immediately on MADA Chatbot API after publishing.',
    saving: 'Saving...',
    saved: 'Saved!',
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    testMessage: 'Test message',
    sendTest: 'Send & Get Response',
    processing: 'Processing...',
    agentResponse: 'Agent Response',
    noHistory: 'No version history yet',
    current: 'Current',
    close: 'Close',
    creatingAgent: 'Creating...',
    createAgent: 'Create Agent',
    publishNow: 'Publish now',
    optimizingAi: 'Optimizing with AI...',
    optimizePrompt: 'Optimize Prompt',
    originalPrompt: 'Original Prompt',
    optimizedPrompt: 'Optimized Prompt',
    applyOptimized: 'Apply optimized prompt',
    publishConfirmTitle: 'Publish Agent?',
    publishConfirmDesc: 'will be activated immediately.',
    fileTooLarge: 'File too large (max 2MB)',
    uploadFailed: 'Avatar upload failed',
    selectAgentFirst: 'Please select an Agent first',
    emptyPromptError: 'Current prompt is empty, cannot optimize.',
    enterAgentName: 'Please enter Agent name',
    creatingFailed: 'Failed to create agent',
    publishFailed: 'Publish failed',
    aiOptimizeFailed: 'Cannot connect to AI optimization server.',
    selectAgentError: 'Please select an Agent first',
    creating: 'Creating...',
    publishing: 'Publishing...',
    optimizing: 'Optimizing...',
  },
  ar: {
    title: 'AI Studio',
    subtitle: 'System Prompts',
    brand: 'mada',
    brandSub: 'UNIVERSAL ACCESS',
    cluster: 'Cluster',
    clusterReady: 'WCAG AAA Ready',
    testSandbox: 'Test Sandbox',
    notifications: 'الإشعارات',
    logout: 'تسجيل الخروج',
    superAdmin: 'SUPER',
    enterprisePackage: 'Enterprise Assistive',
    agentList: 'قائمة الوكيل',
    agentCount: '7 تخصصات موحدة',
    addNew: 'إضافة جديد',
    searchPlaceholder: 'البحث بالاسم أو الرمز...',
    filterAll: 'الكل',
    filterRunning: 'قيد التشغيل',
    filterTraining: 'قيد التدريب',
    active: 'نشط',
    selected: 'محدد',
    syncStatus: 'متزامن',
    dragSort: 'ترتيب الحفظ التلقائي عند الإسقاط',
    workspace: 'مساحة التدريب',
    agentCode: 'الرمز',
    versionHistory: 'سجل الإصدارات',
    testThisSandbox: 'اختبار Sandbox',
    publishAgent: 'نشر الوكيل',
    operationalStatus: 'حالة التشغيل',
    readyToServe: 'جاهز للخدمة',
    version: 'v',
    live: 'مباشر',
    basicConfig: 'التكوين الأساسي ومعايير ISO',
    isoStandard: 'معرف معايير MADA الدولي',
    avatar: 'الصورة الرمزية',
    uploadNew: 'رفع صورة',
    deleteAvatar: 'حذف الصورة الرمزية',
    agentName: 'اسم الوكيل',
    systemPrompt: 'طلب النظام',
    openLargeEditor: 'انقر للتحرير في نافذة كبيرة',
    characters: 'حرف',
    copy: 'نسخ المحتوى',
    insertVariable: 'إدراج متغير',
    aiOptimize: 'تحسين بالذكاء الاصطناعي',
    systemPromptPlaceholder: 'أدخل طلب النظام...',
    knowledgeBase: 'قاعدة المعرفة',
    sources: 'مصادر',
    autoSync: 'التزامن التلقائي كل 24 ساعة',
    addUrl: '+ إضافة رابط',
    urlPlaceholder: 'https://example.com/document...',
    vectorized: 'متجه',
    pages: 'صفحة',
    removeKnowledge: 'إزالة المصدر',
    suggestedQuestions: 'الأسئلة المقترحة',
    questionCount: '',
    showOnNewChat: 'عرض عند فتح محادثة جديدة',
    addQuestion: '+ إضافة سؤال',
    questionPlaceholder: 'أدخل سؤالاً مقترحاً...',
    removeQuestion: 'إزالة السؤال',
    saveDraft: 'حفظ المسودة',
    applyPublish: 'تطبيق ونشر',
    cancel: 'إلغاء',
    changesApply: 'تسري التغييرات فوراً بعد النشر.',
    saving: 'جارٍ الحفظ...',
    saved: 'تم الحفظ!',
    loading: 'جارٍ التحميل...',
    error: 'حدث خطأ',
    success: 'نجاح',
    testMessage: 'رسالة الاختبار',
    sendTest: 'إرسال واستقبال',
    processing: 'جارٍ المعالجة...',
    agentResponse: 'رد الوكيل',
    noHistory: 'لا يوجد سجل',
    current: 'الحالي',
    close: 'إغلاق',
    creatingAgent: 'جارٍ الإنشاء...',
    createAgent: 'إنشاء وكيل',
    publishNow: 'النشر الآن',
    optimizingAi: 'تحسين الذكاء الاصطناعي...',
    optimizePrompt: 'تحسين الطلب',
    originalPrompt: 'الطلب الأصلي',
    optimizedPrompt: 'الطلب المحسّن',
    applyOptimized: 'تطبيق الطلب المحسّن',
    publishConfirmTitle: 'نشر الوكيل؟',
    publishConfirmDesc: 'سيتم تفعيله فوراً.',
    fileTooLarge: 'الملف كبير جداً (الحد 2 م.ب)',
    uploadFailed: 'فشل رفع الصورة',
    selectAgentFirst: 'اختر وكيلاً أولاً',
    emptyPromptError: 'الطلب فارغ، لا يمكن التحسين.',
    enterAgentName: 'أدخل اسم الوكيل',
    creatingFailed: 'فشل الإنشاء',
    publishFailed: 'فشل النشر',
    aiOptimizeFailed: 'لا يمكن الاتصال بخادم الذكاء الاصطناعي.',
    selectAgentError: 'اختر وكيلاً أولاً',
    creating: 'جارٍ الإنشاء...',
    publishing: 'جارٍ النشر...',
    optimizing: 'جارٍ التحسين...',
  },
  fr: {
    title: 'AI Studio',
    subtitle: 'System Prompts',
    brand: 'mada',
    brandSub: 'UNIVERSAL ACCESS',
    cluster: 'Cluster',
    clusterReady: 'WCAG AAA Ready',
    testSandbox: 'Test Sandbox',
    notifications: 'Notifications',
    logout: 'Déconnexion',
    superAdmin: 'SUPER',
    enterprisePackage: 'Enterprise Assistive',
    agentList: "Liste d'agents",
    agentCount: '7 spécialités standardisées',
    addNew: 'Ajouter',
    searchPlaceholder: 'Rechercher par nom, code ISO...',
    filterAll: 'Tous',
    filterRunning: 'En cours',
    filterTraining: 'Formation',
    active: 'Actif',
    selected: 'Sélectionné',
    syncStatus: 'Synchronisé',
    dragSort: 'Ordre auto-sauvegardé',
    workspace: "Espace d'entraînement",
    agentCode: 'Code',
    versionHistory: 'Historique',
    testThisSandbox: 'Tester Sandbox',
    publishAgent: 'Publier',
    operationalStatus: 'État opérationnel',
    readyToServe: 'Prêt à servir',
    version: 'v',
    live: 'En direct',
    basicConfig: 'Configuration et normes ISO',
    isoStandard: 'Identifiant standard MADA',
    avatar: 'Avatar',
    uploadNew: 'Télécharger',
    deleteAvatar: "Supprimer l'avatar",
    agentName: "Nom de l'agent",
    systemPrompt: 'Prompt système',
    openLargeEditor: 'Cliquez pour éditer',
    characters: 'caractères',
    copy: 'Copier',
    insertVariable: 'Insérer variable',
    aiOptimize: "Optimiser par l'IA",
    systemPromptPlaceholder: 'Entrez le prompt...',
    knowledgeBase: 'Base de connaissances',
    sources: 'sources',
    autoSync: 'Sync RAG auto toutes les 24h',
    addUrl: '+ Ajouter URL',
    urlPlaceholder: 'https://example.com/document...',
    vectorized: 'Vectorisé',
    pages: 'pages',
    removeKnowledge: 'Retirer la source',
    suggestedQuestions: 'Questions suggérées',
    questionCount: '',
    showOnNewChat: 'Afficher au démarrage',
    addQuestion: '+ Ajouter',
    questionPlaceholder: 'Entrez une question...',
    removeQuestion: 'Supprimer',
    saveDraft: 'Sauvegarder brouillon',
    applyPublish: 'Appliquer et Publier',
    cancel: 'Annuler',
    changesApply: 'Modifications en vigueur après publication.',
    saving: 'Enregistrement...',
    saved: 'Enregistré!',
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
    success: 'Succès',
    testMessage: 'Message de test',
    sendTest: 'Envoyer et recevoir',
    processing: 'Traitement...',
    agentResponse: 'Réponse de l\'agent',
    noHistory: 'Pas d\'historique',
    current: 'Actuel',
    close: 'Fermer',
    creatingAgent: 'Création...',
    createAgent: 'Créer un agent',
    publishNow: 'Publier maintenant',
    optimizingAi: 'Optimisation IA...',
    optimizePrompt: 'Optimiser le prompt',
    originalPrompt: 'Prompt original',
    optimizedPrompt: 'Prompt optimisé',
    applyOptimized: 'Appliquer le prompt',
    publishConfirmTitle: 'Publier l\'agent?',
    publishConfirmDesc: 'sera activé immédiatement.',
    fileTooLarge: 'Fichier trop volumineux (max 2 Mo)',
    uploadFailed: 'Échec du téléversement',
    selectAgentFirst: 'Sélectionnez un agent',
    emptyPromptError: 'Prompt vide, optimisation impossible.',
    enterAgentName: 'Entrez le nom de l\'agent',
    creatingFailed: 'Échec de création',
    publishFailed: 'Échec de publication',
    aiOptimizeFailed: 'Connexion serveur IA impossible.',
    selectAgentError: 'Sélectionnez un agent',
    creating: 'Création...',
    publishing: 'Publication...',
    optimizing: 'Optimisation...',
  },
};

// ============== MAIN COMPONENT ==============
export function AdminPrompts() {
  const language = useLanguageStore((s) => s.language ?? 'vi') as Language;
  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  // State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'running' | 'training'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar_url: '',
    system_prompt: '',
    knowledge_url: '',
    is_active: true,
    version: '3.4-prod',
    iso_code: '',
    wcag_level: '',
  });

  // Suggested questions
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  // Knowledge URLs
  const [knowledgeUrls, setKnowledgeUrls] = useState<KnowledgeUrl[]>([]);
  const [newUrl, setNewUrl] = useState('');

  // Drag & Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Resizable Sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [isResizing, setIsResizing] = useState(false);

  // Modal states
  const [showTestSandbox, setShowTestSandbox] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<{ id: string; version: string; date: string; changes: string; author: string }[]>([]);

  const [showAddNewAgent, setShowAddNewAgent] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: '', description: '', iso_code: '' });
  const [addAgentLoading, setAddAgentLoading] = useState(false);

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  const [showAiOptimize, setShowAiOptimize] = useState(false);
  const [aiOptimizeLoading, setAiOptimizeLoading] = useState(false);
  const [aiOptimizeResult, setAiOptimizeResult] = useState('');

  const [avatarUploading, setAvatarUploading] = useState(false);

  // Reorder agents
  const moveAgent = (fromIndex: number, toIndex: number) => {
    const reordered = [...agents];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    return reordered;
  };

  const saveAgentOrder = async (reorderedAgents: Agent[]) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const updates = reorderedAgents.map((agent, index) => ({
        id: agent.id,
        sort_order: index + 1,
      }));
      await fetch('/api/admin/agents/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agents: updates }),
      });
      broadcastAgentChange({
        type: 'agent-reordered',
        agentIds: reorderedAgents.map(a => a.id),
      });
    } catch (err) {
      console.error('Failed to save agent order:', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    setDraggedId(agentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', agentId);
  };

  const handleDragOver = (e: React.DragEvent, agentId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (agentId !== draggedId) {
      setDragOverId(agentId);
    }
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = agents.findIndex(a => a.id === draggedId);
    const toIndex = agents.findIndex(a => a.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const reordered = moveAgent(fromIndex, toIndex);
    setAgents(reordered);
    setSelectedAgent(prev => {
      if (!prev) return prev;
      return reordered.find(a => a.id === prev.id) || prev;
    });
    setDraggedId(null);
    setDragOverId(null);
    saveAgentOrder(reordered);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Resizable Sidebar handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const doResize = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX - 300, 260), 500); // Min 260px, Max 500px
      setSidebarWidth(newWidth);
    };

    const stopResize = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
    }

    return () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing]);

  // Load agents
  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      if (!token) {
        setError('Vui lòng đăng nhập');
        setLoading(false);
        return;
      }
      const res = await adminApi.getAgents();
      if (res.success && res.data) {
        setAgents(res.data);
        if (res.data.length > 0 && !selectedAgent) {
          selectAgent(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name || '',
      description: agent.description || '',
      avatar_url: agent.avatar_url || agent.avatar || '',
      system_prompt: agent.system_prompt || '',
      knowledge_url: agent.knowledge_url || '',
      is_active: Boolean(agent.is_active),
      version: agent.version || '3.4-prod',
      iso_code: agent.iso_code || '',
      wcag_level: agent.wcag_level || '',
    });
    fetchQuestions(agent.id);
    // Parse knowledge URLs
    if (agent.knowledge_url) {
      const urls = agent.knowledge_url.split('\n').filter(u => u.trim());
      setKnowledgeUrls(urls.map((u, i) => ({
        id: `kb-${i}`,
        url: u.trim(),
        status: 'vectorized' as const,
        pages_count: Math.floor(Math.random() * 100) + 10,
      })));
    } else {
      setKnowledgeUrls([]);
    }
  };

  const fetchQuestions = async (agentId: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/suggested-questions?agent_id=${agentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setQuestions(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          avatar_url: formData.avatar_url,
          system_prompt: formData.system_prompt,
          knowledge_url: formData.knowledge_url,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          setAgents(prev => prev.map(a =>
            a.id === selectedAgent.id ? { ...a, ...formData } : a
          ));
        } else {
          setError(data.error || t('error'));
        }
      } else {
        setError(`Lỗi ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to save agent:', err);
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedAgent || !newQuestion.trim()) return;
    try {
      const token = getAccessToken();
      const res = await fetch('/api/admin/suggested-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          category: (selectedAgent as any).mada_category || 'general',
          question: newQuestion.trim(),
          sort_order: questions.length + 1,
          is_active: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQuestions([...questions, data.data]);
          setNewQuestion('');
          // Broadcast to ChatPage to refresh questions
          broadcastQuestionsChange(selectedAgent.id, (selectedAgent as any).mada_category || 'general');
        }
      } else {
        // Log error for debugging
        const errorData = await res.json();
        console.error('Failed to add question:', errorData);
        alert(`Lỗi: ${errorData.error || 'Không thể thêm câu hỏi'}`);
      }
    } catch (err) {
      console.error('Failed to add question:', err);
      alert('Lỗi kết nối. Vui lòng thử lại.');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/suggested-questions/${questionId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setQuestions(questions.filter(q => q.id !== questionId));
        // Broadcast to ChatPage to refresh questions
        if (selectedAgent) {
          broadcastQuestionsChange(selectedAgent.id, (selectedAgent as any).mada_category || 'general');
        }
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
    }
  };

  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    const newEntry: KnowledgeUrl = {
      id: `kb-${Date.now()}`,
      url: newUrl.trim(),
      status: 'pending',
    };
    const updatedUrls = [...knowledgeUrls, newEntry];
    setKnowledgeUrls(updatedUrls);
    setFormData({ ...formData, knowledge_url: updatedUrls.map(u => u.url).join('\n') });
    setNewUrl('');
  };

  const handleRemoveUrl = (id: string) => {
    const filtered = knowledgeUrls.filter(u => u.id !== id);
    setKnowledgeUrls(filtered);
    setFormData({ ...formData, knowledge_url: filtered.map(u => u.url).join('\n') });
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgent) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }
    setAvatarUploading(true);
    setError('');
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const res = await fetch(`/api/admin/agents/${selectedAgent.id}/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formDataUpload,
      });
      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, avatar_url: data.url || URL.createObjectURL(file) });
        setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, avatar_url: data.url || '' } : a));
      } else {
        setError(t('uploadFailed'));
      }
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setAvatarUploading(false);
    }
  };

  // Test Sandbox handler
  const handleTestSandbox = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    setTestResponse('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agent_id: selectedAgent?.id,
          message: testMessage,
          system_prompt: formData.system_prompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResponse(data.response || data.message || data.content || JSON.stringify(data, null, 2));
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResponse(`Lỗi ${res.status}: ${err.error || res.statusText}`);
      }
    } catch (err) {
      setTestResponse(language === 'vi' ? 'Không thể kết nối server. Vui lòng thử lại.' : language === 'ar' ? 'لا يمكن الاتصال بالخادم.' : language === 'fr' ? 'Impossible de se connecter au serveur.' : 'Cannot connect to server. Please try again.');
    } finally {
      setTestLoading(false);
    }
  };

  // Version History handler
  const handleVersionHistory = () => {
    // Mock version history
    setVersionHistory([
      { id: 'v3', version: '3.4-prod', date: new Date().toLocaleString('vi-VN'), changes: 'Cập nhật prompt tổng quát', author: 'superadmin@mada.vn' },
      { id: 'v2', version: '3.3-beta', date: new Date(Date.now() - 86400000).toLocaleString('vi-VN'), changes: 'Thêm ISO 9241-171, tối ưu RAG', author: 'superadmin@mada.vn' },
      { id: 'v1', version: '3.2-alpha', date: new Date(Date.now() - 172800000).toLocaleString('vi-VN'), changes: 'Khởi tạo agent', author: 'superadmin@mada.vn' },
    ]);
    setShowVersionHistory(true);
  };

  // Add New Agent handler
  const handleAddNewAgent = async () => {
    if (!newAgentForm.name.trim()) {
      setError(t('enterAgentName'));
      return;
    }
    setAddAgentLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newAgentForm.name,
          description: newAgentForm.description,
          iso_code: newAgentForm.iso_code,
          is_active: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAgents(prev => [...prev, data.data]);
          selectAgent(data.data);
          setShowAddNewAgent(false);
          setNewAgentForm({ name: '', description: '', iso_code: '' });
        } else {
          setError(data.error || t('creatingFailed'));
        }
      } else {
        setError(`Lỗi ${res.status}`);
      }
    } catch {
      setError(t('creatingFailed'));
    } finally {
      setAddAgentLoading(false);
    }
  };

  // Publish Agent handler
  const handlePublishAgent = async () => {
    if (!selectedAgent) return;
    setPublishLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          is_active: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFormData(prev => ({ ...prev, is_active: true }));
          setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, ...formData, is_active: true } : a));
          setShowPublishConfirm(false);
        }
      } else {
        setError(`Lỗi ${res.status}`);
      }
    } catch {
      setError(t('publishFailed'));
    } finally {
      setPublishLoading(false);
    }
  };

  // AI Optimize handler
  const handleAiOptimize = async () => {
    if (!formData.system_prompt.trim()) {
      setError(t('emptyPromptError'));
      return;
    }
    setAiOptimizeLoading(true);
    setAiOptimizeResult('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/admin/ai/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: formData.system_prompt,
          language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiOptimizeResult(data.optimized || data.result || data.content || JSON.stringify(data, null, 2));
      } else {
        const err = await res.json().catch(() => ({}));
        setAiOptimizeResult(`Lỗi ${res.status}: ${err.error || res.statusText}`);
      }
    } catch {
      setAiOptimizeResult(t('aiOptimizeFailed'));
    } finally {
      setAiOptimizeLoading(false);
    }
  };

  // System Prompt Modal
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [tempPrompt, setTempPrompt] = useState('');

  const openPromptModal = () => {
    setTempPrompt(formData.system_prompt);
    setShowPromptModal(true);
  };

  const savePromptFromModal = () => {
    setFormData({ ...formData, system_prompt: tempPrompt });
    setShowPromptModal(false);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(formData.system_prompt);
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !searchQuery ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.iso_code || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterTab === 'all') return matchesSearch;
    if (filterTab === 'running') return matchesSearch && agent.is_active;
    if (filterTab === 'training') return matchesSearch && !agent.is_active;
    return matchesSearch;
  });

  const runningCount = agents.filter(a => a.is_active).length;
  const trainingCount = agents.filter(a => !a.is_active).length;

  return (
    <div className="h-screen flex flex-col bg-slate-50/70 font-sans overflow-hidden">
      {/* ===== HEADER ===== */}
      <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-subtle flex-shrink-0">
        <div className="w-full px-5 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          {/* Left section: breadcrumb + cluster */}
          <div className="flex items-center gap-5 xl:gap-8">
            {/* Breadcrumb */}
            <nav className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <button
                onClick={() => window.location.href = '/admin'}
                className="p-1.5 text-slate-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                title="Quay về trang chủ"
              >
                <ArrowLeft className="w-4 h-4 font-semibold" />
              </button>
              <ChevronRight className="text-[10px] text-slate-300 w-3 h-3" />
              <span className="hover:text-slate-800 cursor-pointer font-medium transition-colors">{t('title')}</span>
              <ChevronRight className="text-[10px] text-slate-300 w-3 h-3" />
              <span className="hover:text-slate-800 cursor-pointer font-medium transition-colors">{t('subtitle')}</span>
              <ChevronRight className="text-[10px] text-slate-300 w-3 h-3" />
              <span className="font-semibold text-brand-800 bg-brand-50/90 text-brand-700 px-2 py-0.5 rounded-md border border-brand-200/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
                {selectedAgent?.name || 'Bot 2: Sensory – Vision'}
              </span>
            </nav>

            {/* Cluster Badge */}
            <div className="hidden 2xl:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 py-1 px-3 rounded-full border border-slate-200/80">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400">{t('cluster')}:</span>
              <span className="text-slate-700 font-semibold font-mono text-[11px]">Mada-Central-v2</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{t('clusterReady')}</span>
            </div>
          </div>

          {/* Quick Actions & User */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Test Sandbox */}
            <button
              onClick={() => selectedAgent ? setShowTestSandbox(true) : setError(t('selectAgentError'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-brand-800 bg-slate-50 hover:bg-brand-50/60 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-brand-300 transition shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">{t('testSandbox')}</span>
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Language */}
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-xs">
              <span className="text-sm">🇻🇳</span>
              <span className="hidden lg:inline font-mono">VI</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-0.5 sm:mx-1"></div>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-0.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-700 to-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-brand-100 cursor-pointer">
                SA
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-bold text-slate-800">superadmin@mada.vn</span>
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide">{t('superAdmin')}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-0.5">{t('enterprisePackage')}</span>
              </div>
              <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-0.5" title={t('logout')}>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN WORKSPACE ===== */}
      <main className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative">
        {/* ===== LEFT SIDEBAR: Agent Roster ===== */}
        <aside 
          className="bg-white border-r border-slate-200/90 flex flex-col flex-shrink-0 z-10 sticky top-0 h-[calc(100vh-57px)]"
          style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
        >
          {/* Resize Handle */}
          <div
            className={clsx(
              'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 transition-all',
              isResizing 
                ? 'bg-brand-500 w-1.5' 
                : 'hover:bg-brand-400 hover:w-1.5 bg-transparent'
            )}
            onMouseDown={startResizing}
          >
            <div className={clsx(
              'absolute right-[-3px] top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full flex items-center justify-center transition-opacity',
              isResizing ? 'opacity-100' : 'opacity-0 hover:opacity-100'
            )}>
              <div className="w-1 h-8 bg-slate-300 rounded-full flex items-center justify-center">
                <GripVertical className="w-2.5 h-3 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Catalog Header */}
          <div className="p-4 border-b border-slate-100 space-y-3.5 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold shadow-xs">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm leading-tight">{t('agentList')}</h2>
                  <p className="text-[11px] text-slate-500">{t('agentCount')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddNewAgent(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-3 h-3" />
                <span>{t('addNew')}</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Bot className="absolute left-3 top-2.5 text-slate-400 w-3 h-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50/90 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setFilterTab('all')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold text-center transition flex-1',
                  filterTab === 'all'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {t('filterAll')} ({agents.length})
              </button>
              <button
                onClick={() => setFilterTab('running')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium text-center transition flex-1',
                  filterTab === 'running'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {t('filterRunning')} ({runningCount})
              </button>
              <button
                onClick={() => setFilterTab('training')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium text-center transition flex-1',
                  filterTab === 'training'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {t('filterTraining')} ({trainingCount})
              </button>
            </div>
          </div>

          {/* Agent Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">Không tìm thấy Agent</p>
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const isSelected = selectedAgent?.id === agent.id;
                const isDragging = draggedId === agent.id;
                const isDragOver = dragOverId === agent.id;
                const emoji = getBotEmoji(agent.bot_id ?? undefined, agent.name);

                return (
                  <div
                    key={agent.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, agent.id)}
                    onDragOver={(e) => handleDragOver(e, agent.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, agent.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => selectAgent(agent)}
                    className={clsx(
                      'p-3 rounded-2xl transition-all flex items-start gap-3 cursor-pointer group relative',
                      isDragging
                        ? 'opacity-50 scale-[0.98]'
                        : isDragOver
                        ? 'scale-[1.02] ring-2 ring-brand-300'
                        : isSelected
                        ? 'bg-brand-50 border-2 border-brand-600 shadow-sm'
                        : 'bg-white border border-slate-200/90 hover:border-slate-300 shadow-xs',
                    )}
                  >
                    {/* Selected indicator bar */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-700 rounded-l-2xl" />
                    )}

                    {/* Emoji Avatar */}
                    <div className={clsx(
                      'w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-xs',
                      isSelected
                        ? 'bg-teal-800 border border-teal-700 text-white'
                        : 'bg-slate-50 border border-slate-200'
                    )}>
                      {emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs font-bold text-slate-900 truncate">{agent.name}</h3>
                        {isSelected ? (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {t('selected')}
                            <ChevronRight className="w-3 h-3 text-brand-700 ml-0.5" />
                          </span>
                        ) : agent.is_active ? (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md flex-shrink-0">
                            {t('active')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex-shrink-0">
                            {t('filterTraining')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {agent.description || 'Không có mô tả'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5 font-mono">
                        {agent.iso_code ? (
                          <>
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded',
                              isSelected ? 'bg-brand-50 text-brand-800 border border-brand-200 font-semibold' : 'text-slate-500 font-medium'
                            )}>
                              {agent.iso_code}
                            </span>
                            <span>•</span>
                          </>
                        ) : null}
                        <span className={isSelected ? 'text-brand-800 font-semibold' : ''}>
                          {(agent.system_prompt?.length || 0).toLocaleString()} {t('characters')}
                        </span>
                      </div>
                    </div>

                    {/* Drag handle */}
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-slate-400 rotate-90" />
                {t('dragSort')}
              </span>
              <span className="font-medium text-emerald-700 flex items-center gap-1.5 text-[11px]">
                <CloudUpload className="w-3 h-3 text-emerald-600" />
                {t('syncStatus')} 13:42
              </span>
            </div>
          </div>
        </aside>

        {/* ===== RIGHT: Main Config Workspace ===== */}
        <section className="flex-1 flex flex-col overflow-y-auto bg-slate-100/50">
          {selectedAgent ? (
            <>
              {/* Top Action Bar */}
              <div className="px-6 lg:px-8 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-subtle">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
                    <span>{t('workspace')}:</span>
                    <span className="bg-brand-50 text-brand-800 px-2 py-0.5 rounded border border-brand-200 font-semibold">
                      {selectedAgent.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 hidden sm:inline">|</span>
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    {t('agentCode')}: AGENT-{selectedAgent.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleVersionHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition"
                  >
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('versionHistory')}</span>
                  </button>
                  <button
                    onClick={() => setShowTestSandbox(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition shadow-xs"
                  >
                    <Play className="w-3 h-3 text-brand-600" />
                    <span>{t('testThisSandbox')}</span>
                  </button>
                  <button
                    onClick={() => setShowPublishConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-brand-700 hover:bg-brand-800 rounded-xl shadow-sm transition hover:shadow focus:ring-2 focus:ring-brand-700"
                  >
                    <CloudUpload className="w-3 h-3" />
                    <span>{t('publishAgent')}</span>
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-5 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
                {/* Hero Identity Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        name={formData.name}
                        avatarUrl={formData.avatar_url ?? undefined}
                        avatar={selectedAgent.avatar}
                        botId={selectedAgent.bot_id ?? undefined}
                        size="lg"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                            {formData.name || 'Agent mới'}
                          </h1>
                          <span className="bg-brand-50 text-brand-800 border border-brand-200 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            {formData.version}
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {t('live')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-2.5 font-medium">
                          <span>{formData.description || 'Không có mô tả'}</span>
                          {formData.iso_code && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                                {formData.iso_code}
                              </span>
                            </>
                          )}
                          {formData.wcag_level && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                                {formData.wcag_level}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3.5 bg-slate-50/90 border border-slate-200/80 px-4 py-2.5 rounded-2xl">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-800">{t('operationalStatus')}</div>
                        <div className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
                          <Check className="w-3 h-3" />
                          {t('readyToServe')}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-700"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Basic Metadata Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 lg:p-6 shadow-card space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-brand-700" />
                      {t('basicConfig')}
                    </h2>
                    <span className="text-[11px] text-slate-400">{t('isoStandard')}</span>
                  </div>

                  {/* Avatar Section */}
                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <AgentAvatar
                        name={formData.name}
                        avatarUrl={formData.avatar_url ?? undefined}
                        avatar={selectedAgent.avatar}
                        botId={selectedAgent.bot_id ?? undefined}
                        size="md"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {t('avatar')}
                          <span className="text-rose-500">*</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          PNG, JPG, WEBP (max 2MB, 512x512px)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition hover:border-brand-300">
                        <ImageIcon className="w-3 h-3 text-brand-600" />
                        <span>{t('uploadNew')}</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={handleAvatarUpload}
                          disabled={avatarUploading}
                        />
                      </label>
                      <button
                        onClick={() => setFormData({ ...formData, avatar_url: '' })}
                        className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition"
                        title={t('deleteAvatar')}
                      >
                        {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t('agentName')}
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Mã ISO
                      </label>
                      <input
                        type="text"
                        value={formData.iso_code}
                        onChange={(e) => setFormData({ ...formData, iso_code: e.target.value })}
                        placeholder="VD: ISO 9241-171:2008"
                        className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t('description')}
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* System Prompt Editor Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
                  {/* Editor Toolbar */}
                  <div className="bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs font-bold text-slate-800 tracking-wider flex items-center gap-1.5 font-mono">
                        <Sparkles className="w-3 h-3 text-brand-700" />
                        {t('systemPrompt')}
                      </span>
                      <button
                        onClick={openPromptModal}
                        className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-md border border-brand-200/60 transition cursor-pointer"
                      >
                        <Wand2 className="w-3 h-3 text-amber-600" />
                        {t('openLargeEditor')}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-white text-slate-600 font-mono text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                        <span className="text-brand-700 font-bold">{formData.system_prompt.length}</span> / 4,000 {t('characters')}
                      </div>
                      <button
                        onClick={copyPrompt}
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 transition shadow-xs"
                        title={t('copy')}
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setShowAiOptimize(true); setAiOptimizeResult(''); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-brand-700 to-teal-700 hover:from-brand-800 hover:to-teal-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
                      >
                        <Wand2 className="w-3 h-3 text-amber-200" />
                        <span>{t('aiOptimize')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Editor */}
                  <div className="relative bg-slate-50/70">
                    <textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      placeholder={t('systemPromptPlaceholder')}
                      rows={16}
                      className="w-full p-5 bg-transparent border-0 focus:ring-0 resize-y text-slate-800 placeholder-slate-400 font-mono text-[12px] leading-relaxed selection:bg-brand-100 selection:text-brand-900"
                      spellCheck={false}
                    />
                  </div>
                </div>

                {/* Knowledge & Questions Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card space-y-4">
                  {/* Knowledge Base Section */}
                  <div className="space-y-3 pb-5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-brand-700" />
                        {t('knowledgeBase')}
                        <span className="bg-brand-50 text-brand-800 text-[10px] font-mono px-2 py-0.5 rounded-full border border-brand-200 font-bold">
                          {knowledgeUrls.length} {t('sources')}
                        </span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">{t('autoSync')}</span>
                    </div>

                    {/* Add URL */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Database className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 w-3 h-3" />
                        <input
                          type="url"
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                          placeholder={t('urlPlaceholder')}
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition"
                        />
                      </div>
                      <button
                        onClick={handleAddUrl}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-xs transition focus:ring-2 focus:ring-brand-700"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('addUrl')}</span>
                      </button>
                    </div>

                    {/* URL List */}
                    <div className="space-y-2 pt-1">
                      {knowledgeUrls.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Database className="w-3 h-3 text-brand-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-semibold text-slate-800 truncate">{item.url}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="text-emerald-700 font-medium">
                                  <Check className="w-3 h-3 inline" /> {t('vectorized')}
                                </span>
                                <span>•</span>
                                <span>{item.pages_count} {t('pages')}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => item.id && handleRemoveUrl(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition ml-2"
                            title={t('removeKnowledge')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Questions Section */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-700" />
                        {t('suggestedQuestions')}
                        <span className="bg-brand-50 text-brand-800 text-[10px] font-mono px-2 py-0.5 rounded-full border border-brand-200 font-bold">
                          ({questions.length})
                        </span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">{t('showOnNewChat')}</span>
                    </div>

                    {/* Add Question */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 w-3 h-3" />
                        <input
                          type="text"
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder={t('questionPlaceholder')}
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddQuestion()}
                        />
                      </div>
                      <button
                        onClick={handleAddQuestion}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-xs transition focus:ring-2 focus:ring-brand-700"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('addQuestion')}</span>
                      </button>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-2 pt-1">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="flex items-center gap-2.5 p-2 bg-slate-50/90 rounded-xl border border-slate-200/80">
                          <span className="text-slate-400 font-mono text-xs w-5 text-center font-bold">{idx + 1}.</span>
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) => {
                              const updated = questions.map(q2 =>
                                q2.id === q.id ? { ...q2, question: e.target.value } : q2
                              );
                              setQuestions(updated);
                            }}
                            className="flex-1 py-1 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-brand-700 transition"
                          />
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                            title={t('removeQuestion')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sticky Bottom Action Bar */}
                <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-elevated flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <Check className="w-4 h-4 text-brand-600" />
                    <span>{t('changesApply')}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setSelectedAgent(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition flex items-center gap-2"
                    >
                      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      {saving ? t('saving') : t('saveDraft')}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-700 to-teal-700 hover:from-brand-800 hover:to-teal-800 rounded-xl shadow-md shadow-brand-700/25 transition focus:ring-2 focus:ring-brand-700 flex items-center gap-1.5"
                    >
                      <Check className="w-3 h-3" />
                      {saved ? t('saved') : t('applyPublish')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Chọn Agent để huấn luyện</h3>
                <p className="text-sm text-slate-400">Chọn một Agent từ danh sách bên trái để bắt đầu</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ===== SYSTEM PROMPT MODAL ===== */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-700" />
                  {t('systemPrompt')}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Viết prompt chi tiết để hướng dẫn cách Agent hoạt động</p>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-hidden flex flex-col">
              <textarea
                value={tempPrompt}
                onChange={(e) => setTempPrompt(e.target.value)}
                placeholder={t('systemPromptPlaceholder')}
                className="flex-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all resize-none font-mono text-sm min-h-[400px]"
                autoFocus
                spellCheck={false}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {tempPrompt.length} {t('characters')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPromptModal(false)}
                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={savePromptFromModal}
                    className="px-5 py-2.5 bg-gradient-to-r from-brand-700 to-teal-700 text-white rounded-xl font-semibold hover:from-brand-800 hover:to-teal-800 transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Áp dụng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEST SANDBOX MODAL ===== */}
      {showTestSandbox && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-700" />
                  {t('testSandbox')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agent: <span className="font-semibold">{selectedAgent?.name}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowTestSandbox(false); setTestMessage(''); setTestResponse(''); }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('testMessage')}</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder={language === 'vi' ? 'Nhập tin nhắn để test Agent...' : 'Enter a message to test the Agent...'}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition text-sm resize-none"
                />
              </div>
              <button
                onClick={handleTestSandbox}
                disabled={testLoading || !testMessage.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition"
              >
                {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {testLoading ? t('processing') : t('sendTest')}
              </button>
              {testResponse && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('agentResponse')}</label>
                  <div className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                    {testResponse}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== VERSION HISTORY MODAL ===== */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-brand-700" />
                  {t('versionHistory')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAgent?.name}</p>
              </div>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-3">
              {versionHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">{t('noHistory')}</p>
              ) : (
                versionHistory.map((v, i) => (
                  <div key={v.id} className={clsx(
                    'p-4 rounded-xl border transition cursor-pointer',
                    i === 0
                      ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-800 font-mono">{v.version}</span>
                      {i === 0 && <span className="text-[10px] font-bold text-brand-800 bg-brand-100 border border-brand-200 px-2 py-0.5 rounded-full">{t('current')}</span>}
                    </div>
                    <p className="text-xs text-slate-600">{v.changes}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span>{v.date}</span>
                      <span>•</span>
                      <span>{v.author}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowVersionHistory(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD NEW AGENT MODAL ===== */}
      {showAddNewAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-700" />
                  {t('addNew')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Tạo Agent AI mới' : language === 'ar' ? 'إنشاء وكيل جديد' : language === 'fr' ? 'Créer un nouvel agent' : 'Create new AI Agent'}</p>
              </div>
              <button
                onClick={() => { setShowAddNewAgent(false); setNewAgentForm({ name: '', description: '', iso_code: '' }); setError(''); }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">{error}</div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('agentName')} <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={newAgentForm.name}
                  onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                  placeholder="VD: Bot 3: Sensory – Hearing"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('description')}</label>
                <textarea
                  value={newAgentForm.description}
                  onChange={(e) => setNewAgentForm({ ...newAgentForm, description: e.target.value })}
                  placeholder="Mô tả chức năng của Agent..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mã ISO</label>
                <input
                  type="text"
                  value={newAgentForm.iso_code}
                  onChange={(e) => setNewAgentForm({ ...newAgentForm, iso_code: e.target.value })}
                  placeholder="VD: ISO 9241-171:2008"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition text-sm font-mono"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddNewAgent(false); setNewAgentForm({ name: '', description: '', iso_code: '' }); setError(''); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddNewAgent}
                disabled={addAgentLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition"
              >
                {addAgentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {addAgentLoading ? t('creating') : t('createAgent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PUBLISH CONFIRM MODAL ===== */}
      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CloudUpload className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">{t('publishConfirmTitle')}</h2>
              <p className="text-sm text-slate-500 mb-1">
                Agent <span className="font-semibold text-slate-700">{selectedAgent?.name}</span> {t('publishConfirmDesc')}
              </p>
              <p className="text-xs text-slate-400">{t('changesApply')}</p>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handlePublishAgent}
                disabled={publishLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition"
              >
                {publishLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                {publishLoading ? t('publishing') : t('publishNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI OPTIMIZE MODAL ===== */}
      {showAiOptimize && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-brand-700" />
                  {t('aiOptimize')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Tối ưu prompt hiện tại bằng AI' : language === 'ar' ? 'تحسين الطلب الحالي بالذكاء الاصطناعي' : language === 'fr' ? 'Optimiser le prompt actuel par l\'IA' : 'Optimize current prompt with AI'}</p>
              </div>
              <button
                onClick={() => setShowAiOptimize(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('originalPrompt')}</label>
                <div className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                  {formData.system_prompt || `(${language === 'vi' ? 'trống' : 'empty'})`}
                </div>
              </div>
              <button
                onClick={handleAiOptimize}
                disabled={aiOptimizeLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-700 to-teal-700 hover:from-brand-800 hover:to-teal-800 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl text-xs font-bold transition"
              >
                {aiOptimizeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-amber-200" />}
                {aiOptimizeLoading ? t('optimizingAi') : t('optimizePrompt')}
              </button>
              {aiOptimizeResult && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('optimizedPrompt')}</label>
                  <div className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-emerald-50 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
                    {aiOptimizeResult}
                  </div>
                  <button
                    onClick={() => { setFormData(prev => ({ ...prev, system_prompt: aiOptimizeResult })); setShowAiOptimize(false); }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    <Check className="w-4 h-4" />
                    {t('applyOptimized')}
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowAiOptimize(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== AGENT AVATAR COMPONENT ==============
function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) ||
    url.startsWith('http://') || url.startsWith('https://');
}

function isEmoji(str?: string): boolean {
  if (!str) return false;
  return str.length <= 4 && /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(str);
}

function AgentAvatar({ name, avatarUrl, avatar, botId, size = 'md', className = '' }: {
  name: string;
  avatarUrl?: string;
  avatar?: string;
  botId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const resolvedEmoji = (avatar && isEmoji(avatar))
    ? avatar
    : getBotEmoji(botId, name);

  const sizeClasses = {
    sm: 'w-9 h-9 text-base',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  if (avatarUrl && isValidImageUrl(avatarUrl)) {
    return (
      <div className={clsx(
        'rounded-2xl flex items-center justify-center overflow-hidden shadow-md flex-shrink-0',
        'bg-gradient-to-tr from-brand-700 via-teal-600 to-emerald-400',
        sizeClasses[size],
        className
      )}>
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (resolvedEmoji !== '🤖' || avatar) {
    return (
      <div className={clsx(
        'rounded-2xl flex items-center justify-center shadow-md flex-shrink-0',
        'bg-gradient-to-tr from-brand-700 via-teal-600 to-emerald-400 text-white',
        sizeClasses[size],
        className
      )}>
        <span className="select-none leading-none">{resolvedEmoji}</span>
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-2xl flex items-center justify-center shadow-md flex-shrink-0',
      'bg-gradient-to-tr from-brand-700 to-teal-600 text-white',
      sizeClasses[size],
      className
    )}>
      <Bot className={clsx(
        size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-7 h-7',
        'text-white'
      )} />
    </div>
  );
}

export default AdminPrompts;
