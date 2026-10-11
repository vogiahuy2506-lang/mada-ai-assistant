import { useState, useEffect } from 'react';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import {
  Plus, Check, X,
  Loader2,
  Edit3, Trash2, Eye, EyeOff,
  ChevronUp, ChevronDown,
  BarChart3,
  ThumbsDownIcon,
  Zap, CheckCircle2, AlertTriangle, Info,
  RefreshCw, Sparkles,
  AlertCircle, Target, MessageSquare, LayoutGrid,
  HelpCircle, PlusCircle,
  Search, Smartphone, Monitor, Bot,
  FileText, Pencil, Trash, Clock, ChevronDown as ChevronDownIcon,
  XCircle, Bell,
} from 'lucide-react';

// ============== TYPES ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

interface FeedbackQuestion {
  id: string;
  question_key: string;
  text_vi: string;
  text_en: string;
  text_ar: string;
  text_fr: string;
  icon: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Stats {
  totalDislikeMonth: number;
  dislikeChangePercent: number;
  topReason: string;
  activeConfig: number;
  totalConfig: number;
  avgResponseTime: string;
}

// ============== ICON OPTIONS ==============
const ICON_OPTIONS = [
  { id: 'priority_high', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-500', Component: AlertCircle },
  { id: 'adjust', bg: 'bg-cyan-50', border: 'border-cyan-200', textColor: 'text-cyan-600', Component: Target },
  { id: 'forum', bg: 'bg-purple-50', border: 'border-purple-200', textColor: 'text-purple-500', Component: MessageSquare },
  { id: 'grid_view', bg: 'bg-slate-100', border: 'border-slate-200', textColor: 'text-slate-500', Component: LayoutGrid },
  // Legacy icon names from backend seed data
  { id: 'alert-circle', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-500', Component: AlertCircle },
  { id: 'target', bg: 'bg-cyan-50', border: 'border-cyan-200', textColor: 'text-cyan-600', Component: Target },
  { id: 'message-square', bg: 'bg-purple-50', border: 'border-purple-200', textColor: 'text-purple-500', Component: MessageSquare },
  { id: 'plus-circle', bg: 'bg-teal-50', border: 'border-teal-200', textColor: 'text-teal-600', Component: PlusCircle },
  { id: 'help-circle', bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-500', Component: HelpCircle },
  { id: 'thumbs-down', bg: 'bg-rose-50', border: 'border-rose-200', textColor: 'text-rose-500', Component: ThumbsDownIcon },
];

// Icon name to component mapping for rendering
const ICON_COMPONENTS: Record<string, typeof AlertCircle> = {
  'priority_high': AlertCircle,
  'alert-circle': AlertCircle,
  'adjust': Target,
  'target': Target,
  'forum': MessageSquare,
  'message-square': MessageSquare,
  'grid_view': LayoutGrid,
  'plus-circle': PlusCircle,
  'help-circle': HelpCircle,
  'thumbs-down': ThumbsDownIcon,
};

function getIconData(iconName: string) {
  const data = ICON_OPTIONS.find(i => i.id === iconName);
  return data || ICON_OPTIONS[0]; // Default to first option
}

function getIconComponent(iconName: string) {
  return ICON_COMPONENTS[iconName] || LayoutGrid;
}

// ============== TRANSLATIONS ==============
const translations: Record<Language, Record<string, string>> = {
  vi: {
    pageTitle: 'Quản lý & Mô phỏng Lý do Phản hồi Tiêu cực',
    pageSubtitle: 'Thiết lập danh mục khảo sát lý do người dùng bấm Dislike câu trả lời và xem trước tương tác tức thời trên giao diện bot MADA AI.',
    saveOrder: 'Lưu thứ tự',
    addNew: 'Thêm tiêu chí mới',
    totalDislikeMonth: 'Tổng phản hồi Dislike',
    mostPopularReason: 'Lý do phổ biến nhất',
    configStatus: 'Trạng thái cấu hình',
    active: 'hoạt động',
    avgResponseTime: 'Thời gian phản hồi AI TB',
    normalized: 'chuẩn hoá',
    filterAll: 'Tất cả',
    filterActive: 'Đang hoạt động',
    filterHidden: 'Tạm ẩn',
    enableAll: 'Bật hết',
    disableAll: 'Tắt hết',
    searchPlaceholder: 'Tìm kiếm nội dung tiêu chí...',
    colOrder: 'Thứ tự',
    colContent: 'Nội dung câu hỏi phản hồi',
    colIcon: 'Icon',
    colRate: 'Tỷ lệ chọn',
    colStatus: 'Trạng thái',
    colActions: 'Hành động',
    statusActive: 'Đang chạy',
    statusHidden: 'Tạm ẩn',
    edit: 'Sửa',
    delete: 'Xóa',
    dragTip: 'Mẹo thông minh: Bạn có thể kéo thả icon để trực tiếp sắp xếp thứ tự hiển thị ưu tiên trên màn hình người dùng.',
    totalActive: 'Tổng cộng',
    criteriaActive: 'tiêu chí hoạt động',
    previewTitle: 'Mô phỏng Giao diện Người dùng',
    previewMode: 'Preview Live',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'Vừa xong',
    previewDislikeNote: 'Người dùng vừa bấm đánh giá:',
    previewModalTitle: 'Chia sẻ lý do bạn chưa hài lòng',
    previewModalSubtitle: 'Ý kiến khách quan của bạn là cơ sở trực tiếp để tinh chỉnh mô hình MADA AI thông minh hơn.',
    previewTextarea: 'Góp ý chi tiết để cải thiện AI tốt hơn (không bắt buộc)...',
    previewSkip: 'Bỏ qua',
    previewSend: 'Gửi phản hồi',
    previewSave: 'Lưu',
    previewSyncTip: 'Chế độ xem tương tác trực tiếp: Preview tự động cập nhật ngay lập tức khi bạn thêm, sửa, đổi trạng thái hoặc kéo thả danh mục ở bảng bên trái.',
    modalAddTitle: 'Thêm câu hỏi phản hồi mới',
    modalEditTitle: 'Chỉnh sửa câu hỏi phản hồi',
    labelVi: 'Nội dung (Tiếng Việt)',
    labelEn: 'Nội dung (English)',
    labelAr: 'Nội dung (العربية)',
    labelFr: 'Nội dung (Français)',
    labelIcon: 'Icon',
    labelActive: 'Kích hoạt ngay',
    cancel: 'Hủy bỏ',
    creating: 'Đang tạo...',
    saving: 'Đang lưu...',
    loading: 'Đang tải...',
    noQuestions: 'Không tìm thấy câu hỏi',
    confirmDelete: 'Bạn có chắc muốn xóa câu hỏi này?',
    saved: 'Đã lưu!',
    created: 'Đã tạo!',
    deleted: 'Đã xóa!',
    textareaLabel: 'Kèm Textarea',
    live: 'Đồng bộ thời gian thực (Live Syncing)',
    lượt: 'lượt',
  },
  en: {
    pageTitle: 'Dislike Reason Management',
    pageSubtitle: 'Set up survey categories when users click Dislike.',
    saveOrder: 'Save order',
    addNew: 'Add new criteria',
    totalDislikeMonth: 'Total Dislike Feedback',
    mostPopularReason: 'Most Popular Reason',
    configStatus: 'Config Status',
    active: 'active',
    avgResponseTime: 'Avg AI Response Time',
    normalized: 'normalized',
    filterAll: 'All',
    filterActive: 'Active',
    filterHidden: 'Hidden',
    enableAll: 'Enable All',
    disableAll: 'Disable All',
    searchPlaceholder: 'Search reason content...',
    colOrder: 'Order',
    colContent: 'Feedback Question Content',
    colIcon: 'Icon',
    colRate: 'Selection Rate',
    colStatus: 'Status',
    colActions: 'Actions',
    statusActive: 'Running',
    statusHidden: 'Hidden',
    edit: 'Edit',
    delete: 'Delete',
    dragTip: 'Tip: Drag the icon to directly reorder priority.',
    totalActive: 'Total',
    criteriaActive: 'criteria active',
    previewTitle: 'User Interface Preview',
    previewMode: 'Preview Live',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'Just now',
    previewDislikeNote: 'User just clicked:',
    previewModalTitle: 'Share why you\'re unsatisfied',
    previewModalSubtitle: 'Your feedback directly helps improve the MADA AI model.',
    previewTextarea: 'Add more details to improve AI (optional)...',
    previewSkip: 'Skip',
    previewSend: 'Send Feedback',
    previewSave: 'Save',
    previewSyncTip: 'Preview syncs automatically when you edit, toggle, or reorder.',
    modalAddTitle: 'Add new feedback question',
    modalEditTitle: 'Edit feedback question',
    labelVi: 'Content (Tiếng Việt)',
    labelEn: 'Content (English)',
    labelAr: 'Content (العربية)',
    labelFr: 'Content (Français)',
    labelIcon: 'Icon',
    labelActive: 'Activate immediately',
    cancel: 'Cancel',
    creating: 'Creating...',
    saving: 'Saving...',
    loading: 'Loading...',
    noQuestions: 'No questions found',
    confirmDelete: 'Are you sure?',
    saved: 'Saved!',
    created: 'Created!',
    deleted: 'Deleted!',
    textareaLabel: 'With Textarea',
    live: 'Live Syncing',
    lượt: 'times',
  },
  ar: {
    pageTitle: 'إدارة أسباب عدم الإعجاب',
    pageSubtitle: 'إعداد فئات الاستطلاع عند نقر المستخدم.',
    saveOrder: 'حفظ الترتيب',
    addNew: 'إضافة معيار جديد',
    totalDislikeMonth: 'إجمالي ردود عدم الإعجاب',
    mostPopularReason: 'السبب الأكثر شيوعًا',
    configStatus: 'حالة التكوين',
    active: 'نشط',
    avgResponseTime: 'متوسط وقت الاستجابة',
    normalized: 'مُطبّق',
    filterAll: 'الكل',
    filterActive: 'نشط',
    filterHidden: 'مخفي',
    enableAll: 'تفعيل الكل',
    disableAll: 'تعطيل الكل',
    searchPlaceholder: 'البحث في محتوى السبب...',
    colOrder: 'الترتيب',
    colContent: 'محتوى سؤال التعليقات',
    colIcon: 'الأيقونة',
    colRate: 'معدل الاختيار',
    colStatus: 'الحالة',
    colActions: 'الإجراءات',
    statusActive: 'قيد التشغيل',
    statusHidden: 'مخفي',
    edit: 'تعديل',
    delete: 'حذف',
    dragTip: 'نصيحة: اسحب الأيقونة لإعادة ترتيب الأولوية.',
    totalActive: 'الإجمالي',
    criteriaActive: 'معايير نشطة',
    previewTitle: 'معاينة واجهة المستخدم',
    previewMode: 'معاينة مباشرة',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'الآن',
    previewDislikeNote: 'المستخدم نقر للتو على:',
    previewModalTitle: 'شارك السبب',
    previewModalSubtitle: 'رأيك يساعد في تحسين نموذج MADA AI.',
    previewTextarea: 'أضف تفاصيل أخرى (اختياري)...',
    previewSkip: 'تخطي',
    previewSend: 'إرسال التعليقات',
    previewSave: 'حفظ',
    previewSyncTip: 'يتم مزامنة المعاينة تلقائيًا.',
    modalAddTitle: 'إضافة سؤال تعليقات جديد',
    modalEditTitle: 'تعديل سؤال التعليقات',
    labelVi: 'المحتوى (Tiếng Việt)',
    labelEn: 'المحتوى (English)',
    labelAr: 'المحتوى (العربية)',
    labelFr: 'المحتوى (Français)',
    labelIcon: 'الأيقونة',
    labelActive: 'تفعيل فورًا',
    cancel: 'إلغاء',
    creating: 'جارٍ الإنشاء...',
    saving: 'جارٍ الحفظ...',
    loading: 'جارٍ التحميل...',
    noQuestions: 'لم يتم العثور على أسئلة',
    confirmDelete: 'هل أنت متأكد؟',
    saved: 'تم الحفظ!',
    created: 'تم الإنشاء!',
    deleted: 'تم الحذف!',
    textareaLabel: 'مع حقل النص',
    live: 'متزامن مباشرة',
    lượt: 'مرات',
  },
  fr: {
    pageTitle: 'Gestion des raisons de dislike',
    pageSubtitle: 'Configurer les catégories d\'enquête.',
    saveOrder: 'Enregistrer l\'ordre',
    addNew: 'Ajouter un critère',
    totalDislikeMonth: 'Total des commentaires Dislike',
    mostPopularReason: 'Raison la plus populaire',
    configStatus: 'État de la configuration',
    active: 'actif',
    avgResponseTime: 'Temps de réponse IA moyen',
    normalized: 'normalisé',
    filterAll: 'Tous',
    filterActive: 'Actif',
    filterHidden: 'Caché',
    enableAll: 'Tout activer',
    disableAll: 'Tout désactiver',
    searchPlaceholder: 'Rechercher le contenu...',
    colOrder: 'Ordre',
    colContent: 'Contenu de la question',
    colIcon: 'Icône',
    colRate: 'Taux de sélection',
    colStatus: 'Statut',
    colActions: 'Actions',
    statusActive: 'En cours',
    statusHidden: 'Caché',
    edit: 'Modifier',
    delete: 'Supprimer',
    dragTip: 'Astuce : Faites glisser pour réorganiser la priorité.',
    totalActive: 'Total',
    criteriaActive: 'critères actifs',
    previewTitle: 'Aperçu de l\'interface',
    previewMode: 'Aperçu Live',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'À l\'instant',
    previewDislikeNote: 'L\'utilisateur vient de cliquer sur :',
    previewModalTitle: 'Partagez votre insatisfaction',
    previewModalSubtitle: 'Votre avis aide à améliorer le modèle MADA AI.',
    previewTextarea: 'Ajoutez des détails (optionnel)...',
    previewSkip: 'Ignorer',
    previewSend: 'Envoyer',
    previewSave: 'Enregistrer',
    previewSyncTip: 'L\'aperçu se synchronise automatiquement.',
    modalAddTitle: 'Ajouter une question',
    modalEditTitle: 'Modifier la question',
    labelVi: 'Contenu (Tiếng Việt)',
    labelEn: 'Contenu (English)',
    labelAr: 'المحتوى (العربية)',
    labelFr: 'Contenu (Français)',
    labelIcon: 'Icône',
    labelActive: 'Activer immédiatement',
    cancel: 'Annuler',
    creating: 'Création...',
    saving: 'Enregistrement...',
    loading: 'Chargement...',
    noQuestions: 'Aucune question trouvée',
    confirmDelete: 'Êtes-vous sûr?',
    saved: 'Enregistré !',
    created: 'Créé !',
    deleted: 'Supprimé !',
    textareaLabel: 'Avec Textarea',
    live: 'Sync en direct',
    lượt: 'fois',
  },
};

// ============== TOAST COMPONENT ==============
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all animate-in slide-in-from-bottom-2',
      type === 'success'
        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        : 'bg-red-50 border border-red-200 text-red-800'
    )}>
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-red-600" />
      )}
      {message}
    </div>
  );
}

// ============== ICON COMPONENTS (Modern Lucide Icons) ==============
function MaterialIcon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  const iconProps = { className: clsx('w-4 h-4', className), strokeWidth: filled ? 0 : 1.5 };
  
  const icons: Record<string, JSX.Element> = {
    'rate_review': <FileText {...iconProps} />,
    'add': <Plus {...iconProps} />,
    'search': <Search {...iconProps} />,
    'notifications': <Bell {...iconProps} />,
    'expand_more': <ChevronDownIcon {...iconProps} />,
    'desktop_windows': <Monitor {...iconProps} />,
    'smartphone': <Smartphone {...iconProps} />,
    'smart_toy': <Bot {...iconProps} />,
    'thumb_down': <ThumbsDownIcon {...iconProps} />,
    'priority_high': <AlertCircle {...iconProps} />,
    'adjust': <Target {...iconProps} />,
    'forum': <MessageSquare {...iconProps} />,
    'grid_view': <LayoutGrid {...iconProps} />,
    'edit_note': <FileText {...iconProps} />,
    'edit': <Edit3 {...iconProps} />,
    'delete': <Trash2 {...iconProps} />,
    'sync': <RefreshCw {...iconProps} />,
    'update': <Clock {...iconProps} />,
  };
  
  return icons[name] || <LayoutGrid {...iconProps} />;
}

// ============== MAIN COMPONENT ==============
export default function AdminFeedbackQuestions() {
  const language = useLanguageStore((s) => s.language ?? 'vi') as Language;
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  const languageLabels: Record<Language, { label: string; flag: string }> = {
    vi: { label: 'VIE', flag: '🇻🇳' },
    en: { label: 'ENG', flag: '🇺🇸' },
    ar: { label: 'ARB', flag: '🇸🇦' },
    fr: { label: 'FRA', flag: '🇫🇷' },
  };

  // Close lang dropdown on outside click
  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.lang-switcher')) setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  // State
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<number>(0);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewSelection, setPreviewSelection] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState('');

  // Stats
  const [stats, setStats] = useState<Stats>({
    totalDislikeMonth: 339,
    dislikeChangePercent: 3.2,
    topReason: 'Nội dung chưa chính xác',
    activeConfig: 4,
    totalConfig: 4,
    avgResponseTime: '1.4s',
  });

  // Per-question stats
  const [questionStats, setQuestionStats] = useState<Record<string, { count: number; percent: number }>>({
    'inaccurate_content': { count: 142, percent: 41.9 },
    'not_address_issue': { count: 98, percent: 28.9 },
    'too_verbose': { count: 67, percent: 19.8 },
    'other': { count: 32, percent: 9.4 },
  });

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    text_vi: '',
    text_en: '',
    text_ar: '',
    text_fr: '',
    icon: 'priority_high',
    is_active: 1,
  });

  // Computed
  const activeCount = questions.filter(q => q.is_active).length;
  const hiddenCount = questions.filter(q => !q.is_active).length;

  const filteredQuestions = questions
    .filter(q => {
      if (filterTab === 'active') return q.is_active === 1;
      if (filterTab === 'hidden') return q.is_active === 0;
      return true;
    })
    .filter(q =>
      !searchQuery ||
      q.text_vi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.question_key.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  // Load data
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Helper: fetch with retry for rate limit (429)
  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    const token = getAccessToken();
    const headers = { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    for (let i = 0; i < retries; i++) {
      const res = await fetch(url, { ...options, headers });
      if (res.status !== 429) return res;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1))); // wait 1s, 2s, 3s
    }
    return fetch(url, { ...options, headers });
  };

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch questions first (sequential to avoid rate limit)
      const res = await fetchWithRetry('/api/chat/feedback/all-questions');
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setQuestions(data.data);
      } else {
        throw new Error(data.error || 'Dữ liệu không hợp lệ');
      }

      // Fetch stats sequentially
      try {
        const statsRes = await fetchWithRetry('/api/chat/feedback/stats/monthly');
        const qStatsRes = await fetchWithRetry('/api/chat/feedback/questions/stats');
        
        const statsData = await statsRes.json();
        const qStatsData = await qStatsRes.json();

        if (statsData.success) {
          const s = statsData.data;
          setStats({
            totalDislikeMonth: s.totalDislikeMonth,
            dislikeChangePercent: s.dislikeChangePercent,
            topReason: s.topReason,
            activeConfig: (data.data as FeedbackQuestion[]).filter((q: FeedbackQuestion) => q.is_active === 1).length,
            totalConfig: (data.data as FeedbackQuestion[]).length,
            avgResponseTime: '1.4s',
          });
        }
        if (qStatsData.success && Array.isArray(qStatsData.data)) {
          const map: Record<string, { count: number; percent: number }> = {};
          for (const row of qStatsData.data) {
            map[row.question_key] = { count: row.count, percent: row.percent };
          }
          setQuestionStats(map);
        }
      } catch (e: any) {
        console.warn('Stats fetch error:', e.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reorder
  const handleMoveOrder = async (q: FeedbackQuestion, direction: 'up' | 'down') => {
    const idx = filteredQuestions.findIndex(x => x.id === q.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= filteredQuestions.length) return;
    const target = filteredQuestions[targetIdx];

    setQuestions(prev => prev.map(existing => {
      if (existing.id === q.id) return { ...existing, sort_order: target.sort_order };
      if (existing.id === target.id) return { ...existing, sort_order: q.sort_order };
      return existing;
    }));

    const token = getAccessToken();
    await Promise.all([
      fetch(`/api/chat/feedback/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
      fetch(`/api/chat/feedback/questions/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sort_order: q.sort_order }),
      }),
    ]);
  };

  // Toggle active
  const handleToggleActive = async (q: FeedbackQuestion) => {
    const newActive = q.is_active === 1 ? 0 : 1;
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: newActive } : x));

    try {
      const token = getAccessToken();
      const res = await fetch(`/api/chat/feedback/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ is_active: newActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: q.is_active } : x));
        setToast({ message: data.error || 'Không thể cập nhật trạng thái', type: 'error' });
      } else {
        setToast({ message: newActive === 1 ? 'Đã bật hiển thị!' : 'Đã tạm ẩn', type: 'success' });
      }
    } catch {
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: q.is_active } : x));
      setToast({ message: 'Lỗi kết nối', type: 'error' });
    }
  };

  // Enable all
  const handleEnableAll = async () => {
    const currentlyDisabled = questions.filter(q => q.is_active !== 1);
    if (currentlyDisabled.length === 0) {
      setToast({ message: 'Tất cả đã được bật!', type: 'success' });
      return;
    }
    setQuestions(prev => prev.map(x => ({ ...x, is_active: 1 })));
    setToast({ message: `Đã bật ${currentlyDisabled.length} câu hỏi!`, type: 'success' });
  };

  // Disable all
  const handleDisableAll = async () => {
    const currentlyEnabled = questions.filter(q => q.is_active === 1);
    if (currentlyEnabled.length === 0) {
      setToast({ message: 'Tất cả đã được tắt!', type: 'success' });
      return;
    }
    setQuestions(prev => prev.map(x => ({ ...x, is_active: 0 })));
    setToast({ message: `Đã tắt ${currentlyEnabled.length} câu hỏi!`, type: 'success' });
  };

  // Delete
  const handleDelete = async (q: FeedbackQuestion) => {
    if (!window.confirm(t('confirmDelete'))) return;
    setQuestions(prev => prev.filter(x => x.id !== q.id));
    try {
      const token = getAccessToken();
      await fetch(`/api/chat/feedback/questions/${q.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setToast({ message: t('deleted'), type: 'success' });
    } catch {
      setToast({ message: 'Lỗi xóa', type: 'error' });
      fetchQuestions();
    }
  };

  // Modal handlers
  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ text_vi: '', text_en: '', text_ar: '', text_fr: '', icon: 'priority_high', is_active: 1 });
    setShowModal(true);
  };

  const handleEdit = (q: FeedbackQuestion) => {
    setEditingId(q.id);
    setFormData({
      text_vi: q.text_vi,
      text_en: q.text_en || '',
      text_ar: q.text_ar || '',
      text_fr: q.text_fr || '',
      icon: q.icon || 'priority_high',
      is_active: q.is_active,
    });
    setShowModal(true);
  };

  // Auto-translate
  const handleAutoTranslate = async () => {
    const text_vi = formData.text_vi.trim();
    const text_en = formData.text_en.trim();
    const text_ar = formData.text_ar.trim();
    const text_fr = formData.text_fr.trim();

    let sourceText = '';
    let sourceLang: 'vi' | 'en' | 'ar' | 'fr' = 'vi';
    if (text_vi) { sourceText = text_vi; sourceLang = 'vi'; }
    else if (text_en) { sourceText = text_en; sourceLang = 'en'; }
    else if (text_ar) { sourceText = text_ar; sourceLang = 'ar'; }
    else if (text_fr) { sourceText = text_fr; sourceLang = 'fr'; }

    if (!sourceText) {
      setToast({ message: 'Vui lòng nhập nội dung ở ít nhất 1 ngôn ngữ trước', type: 'error' });
      return;
    }

    setTranslating(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/chat/feedback/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: sourceText, sourceLang }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setFormData(prev => ({
          ...prev,
          text_vi: sourceLang === 'vi' ? prev.text_vi : (data.data.vi || prev.text_vi),
          text_en: sourceLang === 'en' ? prev.text_en : (data.data.en || prev.text_en),
          text_ar: sourceLang === 'ar' ? prev.text_ar : (data.data.ar || prev.text_ar),
          text_fr: sourceLang === 'fr' ? prev.text_fr : (data.data.fr || prev.text_fr),
        }));
        setToast({ message: 'Đã tự động dịch!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Lỗi dịch', type: 'error' });
      }
    } catch {
      setToast({ message: 'Lỗi kết nối dịch', type: 'error' });
    } finally {
      setTranslating(false);
    }
  };

  // Save
  const handleSave = async () => {
    if (!formData.text_vi.trim() && !formData.text_en.trim() && !formData.text_ar.trim() && !formData.text_fr.trim()) {
      setToast({ message: 'Vui lòng nhập nội dung câu hỏi (ít nhất 1 ngôn ngữ)', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const token = getAccessToken();
      const isNew = !editingId;
      const url = isNew ? '/api/chat/feedback/questions' : `/api/chat/feedback/questions/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowModal(false);
        setToast({ message: isNew ? t('created') : t('saved'), type: 'success' });
        fetchQuestions();
      } else {
        setToast({ message: data.error || 'Lỗi', type: 'error' });
      }
    } catch {
      setToast({ message: 'Lỗi lưu', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F6F8FB] font-sans antialiased selection:bg-[#026773]/15 selection:text-[#026773]">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Breadcrumbs + Back Button */}
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/70 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Quay lại</span>
            </button>
            
            <div className="hidden md:flex items-center text-xs text-slate-400 gap-2 border-slate-200">
              <span className="hover:text-slate-600 cursor-pointer transition">Hệ thống</span>
              <span className="text-slate-300">/</span>
              <span className="hover:text-slate-600 cursor-pointer transition">Đánh giá &amp; Phản hồi AI</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">Quản lý Lý do Dislike</span>
            </div>
          </div>

          {/* Right: Model Tag, Notifications, User */}
          <div className="flex items-center gap-3">
            {/* Live Model Selector */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Model: GPT-4o Omni-Core v3.2</span>
            </div>

            {/* Notification Bell */}
            <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-none">
              <span className="text-xl">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            </button>

            {/* Language Switcher */}
            <div className="lang-switcher relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200/70 transition"
              >
                <span className="text-sm">{languageLabels[language].flag}</span>
                <span className="text-xs font-semibold">{languageLabels[language].label}</span>
                <span className="text-sm text-slate-400">{langMenuOpen ? '▲' : '▼'}</span>
              </button>
              {/* Dropdown */}
              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[100px]">
                  {(['vi', 'en', 'ar', 'fr'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setLangMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition ${language === lang ? 'bg-slate-100 font-semibold text-[#026773]' : 'text-slate-700'}`}
                    >
                      <span>{languageLabels[lang].flag}</span>
                      <span>{languageLabels[lang].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Super Admin Profile */}
            <div className="flex items-center gap-2.5 pl-1 cursor-pointer group">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#026773] to-[#3CAEA3] flex items-center justify-center text-white font-bold ring-2 ring-slate-200 group-hover:ring-[#026773] transition">
                  A
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white"></span>
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-[#026773] transition">Admin</span>
                <span className="text-[11px] text-slate-400 font-medium">Super Admin</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">

        {/* ===== PAGE HEADER ===== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-[#026773] flex items-center justify-center shadow-xs">
                <span className="text-2xl">📝</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  {t('pageTitle')}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Dislike Survey</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {t('pageSubtitle')}
                </p>
              </div>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <span className="text-slate-400 font-medium">Tổng phản hồi:</span>
                <span className="font-bold text-slate-800 font-mono">{stats.totalDislikeMonth} lượt</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-amber-800 font-medium">Tỷ lệ Dislike:</span>
                <span className="font-bold text-amber-900 font-mono">{stats.dislikeChangePercent}%</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-emerald-800 font-medium">Đang kích hoạt:</span>
                <span className="font-bold text-emerald-900 font-mono">{stats.activeConfig} / {stats.totalConfig} tiêu chí</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Cập nhật: <strong className="text-slate-700">Vừa xong</strong></span>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex flex-wrap items-center gap-3 self-start xl:self-center shrink-0">
            {/* Live Sync Status */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-2xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>{t('live')}</span>
            </div>

            {/* Add New Button */}
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#026773] to-[#014e57] hover:from-[#014e57] hover:to-[#013a40] text-white text-xs font-bold rounded-xl shadow-md shadow-[#026773]/20 hover:shadow-lg hover:shadow-[#026773]/30 active:scale-[0.98] transition-all"
            >
              <span className="text-base">+</span>
              <span>{t('addNew')}</span>
            </button>
          </div>
        </div>

        {/* ===== MAIN 2-COLUMN GRID ===== */}
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* ===== LEFT COLUMN: TABLE (7/12) ===== */}
          <section className="xl:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">

            {/* Section Header */}
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#026773]/10 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4 text-[#026773]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Danh sách Lý do Dislike</h2>
                  <p className="text-[11px] text-slate-500">Quản lý các tiêu chí phản hồi tiêu cực từ người dùng</p>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Filter Tabs */}
                <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 self-start">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg text-xs font-bold transition',
                      filterTab === 'all'
                        ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    Tất cả ({questions.length || 4})
                  </button>
                  <button
                    onClick={() => setFilterTab('active')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5',
                      filterTab === 'active'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    <span>Đang hoạt động</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">{activeCount || 4}</span>
                  </button>
                  <button
                    onClick={() => setFilterTab('hidden')}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg text-xs font-medium transition',
                      filterTab === 'hidden'
                        ? 'bg-slate-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-700'
                    )}
                  >
                    Tạm ẩn ({hiddenCount || 0})
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl pl-9 pr-12 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#026773]/20 focus:border-[#026773] transition shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <kbd className="absolute right-2.5 top-2.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs hidden sm:inline-block">⌘K</kbd>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#026773]" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-16 text-sm text-red-500">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/60">
                      <th className="py-3.5 px-4 text-center w-20">Thứ tự</th>
                      <th className="py-3.5 px-4 min-w-[240px]">Nội dung câu hỏi phản hồi</th>
                      <th className="py-3.5 px-3 text-center w-16">Icon</th>
                      <th className="py-3.5 px-4 w-44">Tỷ lệ chọn</th>
                      <th className="py-3.5 px-4 text-center w-36">Trạng thái</th>
                      <th className="py-3.5 px-4 text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(filteredQuestions.length > 0 ? filteredQuestions : [
                      { id: '1', question_key: 'inaccurate_content', text_vi: 'Nội dung chưa chính xác hoặc thiếu dẫn chứng', text_en: 'Content is inaccurate or lacks evidence', icon: 'priority_high', is_active: 1, sort_order: 1, created_at: '', updated_at: '' },
                      { id: '2', question_key: 'not_address_issue', text_vi: 'Chưa giải quyết đúng trọng tâm vấn đề', text_en: 'Does not address the main issue', icon: 'adjust', is_active: 1, sort_order: 2, created_at: '', updated_at: '' },
                      { id: '3', question_key: 'too_verbose', text_vi: 'Trả lời quá dài dòng hoặc từ ngữ chuyên môn khó hiểu', text_en: 'Response is too verbose or uses complex jargon', icon: 'forum', is_active: 1, sort_order: 3, created_at: '', updated_at: '' },
                      { id: '4', question_key: 'other', text_vi: 'Khác (Vui lòng ghi rõ bên dưới)', text_en: 'Other (Please specify below)', icon: 'grid_view', is_active: 1, sort_order: 4, created_at: '', updated_at: '' },
                    ]).map((q: any, idx: number) => {
                      const iconData = getIconData(q.icon);
                      const stat = questionStats[q.question_key] || { count: 0, percent: 0 };
                      const isFirst = idx === 0;
                      const isLast = idx === ((filteredQuestions.length > 0 ? filteredQuestions : []).length - 1);
                      return (
                        <tr key={q.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* Order Column */}
                          <td className="py-4 px-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5 text-slate-400">
                              <span className="cursor-grab hover:text-slate-600 text-slate-300 font-bold select-none text-sm" title="Kéo thả sắp xếp">⋮⋮</span>
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs font-mono">{idx + 1}</span>
                              <div className="flex flex-col text-[9px] leading-[7px] text-slate-300">
                                <button
                                  onClick={() => handleMoveOrder(q, 'up')}
                                  disabled={isFirst}
                                  className="hover:text-slate-700 transition disabled:opacity-30"
                                  title="Di chuyển lên"
                                >▲</button>
                                <button
                                  onClick={() => handleMoveOrder(q, 'down')}
                                  disabled={isLast}
                                  className="hover:text-slate-700 transition disabled:opacity-30"
                                  title="Di chuyển xuống"
                                >▼</button>
                              </div>
                            </div>
                          </td>

                          {/* Content */}
                          <td className="py-4 px-4 align-middle">
                            <div className={clsx(
                              'font-semibold text-slate-900 text-sm group-hover:text-[#026773] transition-colors tracking-tight',
                              q.question_key === 'other' && 'flex items-center gap-2 flex-wrap'
                            )}>
                              {q.text_vi}
                              {q.question_key === 'other' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200/80 text-[#026773] font-semibold text-[10px]">
                                  <span>📄</span>
                                  Kèm Textarea
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 italic font-normal mt-0.5">
                              {q.text_en}
                            </div>
                          </td>

                          {/* Icon */}
                          <td className="py-4 px-3 text-center align-middle">
                            <div className={clsx(
                              'w-8 h-8 rounded-full flex items-center justify-center mx-auto shadow-2xs border',
                              iconData.bg,
                              iconData.border
                            )}>
                              {(() => {
                                const IconComponent = getIconComponent(q.icon);
                                return <IconComponent className={clsx('w-4 h-4', iconData.textColor)} />;
                              })()}
                            </div>
                          </td>

                          {/* Rate */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                                <span className="font-mono text-slate-700 font-bold">{stat.count} lượt</span>
                                <span className="text-teal-700 font-mono font-bold">{stat.percent.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#026773] to-teal-500 h-1.5 rounded-full" style={{ width: `${stat.percent}%` }}></div>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4 text-center align-middle">
                            <button
                              onClick={() => handleToggleActive(q)}
                              className={clsx(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-150',
                                q.is_active === 1
                                  ? 'bg-teal-100 text-teal-700 hover:bg-teal-200 ring-1 ring-teal-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 ring-1 ring-slate-200'
                              )}
                            >
                              <span className={clsx(
                                'w-1.5 h-1.5 rounded-full',
                                q.is_active === 1 ? 'bg-teal-500 animate-pulse' : 'bg-slate-400'
                              )} />
                              {q.is_active === 1 ? 'Đang chạy' : 'Tắt'}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-center align-middle">
                            <div className="flex items-center justify-center gap-1 text-slate-400">
                              <button
                                onClick={() => handleEdit(q)}
                                className="w-7 h-7 rounded-lg hover:bg-teal-50 hover:text-[#026773] flex items-center justify-center transition"
                                title="Chỉnh sửa"
                              >
                                <span className="text-[17px]">✏️</span>
                              </button>
                              <button
                                onClick={() => handleDelete(q)}
                                className="w-7 h-7 rounded-lg hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition"
                                title="Xóa"
                              >
                                <span className="text-[17px]">🗑️</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer */}
            <div className="mt-auto p-4 sm:px-6 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold text-base">💡</span>
                <span><strong>Mẹo thông minh:</strong> Bạn có thể kéo thả icon <span className="font-mono text-slate-700 bg-white px-1 py-0.5 rounded border border-slate-200">⋮⋮</span> để sắp xếp thứ tự hiển thị ưu tiên trên màn hình người dùng.</span>
              </div>
              <div className="text-slate-700 font-medium whitespace-nowrap">
                Tổng cộng: <span className="text-[#026773] font-extrabold font-mono">{activeCount || 4}</span> tiêu chí hoạt động
              </div>
            </div>
          </section>

          {/* ===== RIGHT COLUMN: USER PREVIEW (5/12) ===== */}
          <section className="xl:col-span-5 space-y-4">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">{t('previewTitle')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Viewport Mode Buttons */}
                <div className="inline-flex p-0.5 bg-slate-200/70 rounded-lg text-slate-600">
                  <button
                    onClick={() => setViewportMode('desktop')}
                    className={clsx(
                      'p-1.5 rounded transition',
                      viewportMode === 'desktop' ? 'bg-white text-slate-800 shadow-2xs' : 'hover:text-slate-800 text-slate-500'
                    )}
                    title="Xem trên Desktop"
                  >
                    <span className="text-[15px]">🖥️</span>
                  </button>
                  <button
                    onClick={() => setViewportMode('mobile')}
                    className={clsx(
                      'p-1.5 rounded transition',
                      viewportMode === 'mobile' ? 'bg-white text-slate-800 shadow-2xs' : 'hover:text-slate-800 text-slate-500'
                    )}
                    title="Xem trên Mobile"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  {t('previewMode')}
                </span>
              </div>
            </div>

            {/* Chat Simulator */}
            <div className={clsx(
              'bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.08)] p-5 sm:p-7 space-y-4 sm:space-y-6 relative overflow-hidden ring-1 ring-slate-100',
              viewportMode === 'mobile' ? 'max-w-[340px] mx-auto' : ''
            )}>
              {/* Bot Message */}
              <div className="space-y-3 pb-4 sm:pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#026773] font-bold text-xs sm:text-sm">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-gradient-to-tr from-[#026773] to-[#3CAEA3] flex items-center justify-center text-white shadow-2xs">
                      <Bot className={clsx('text-white', viewportMode === 'mobile' ? 'w-3 h-3' : 'w-4 h-4')} />
                    </div>
                    <span className="tracking-tight text-slate-900 truncate">{t('previewBotName')}</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium shrink-0 ml-2">{t('previewJustNow')}</span>
                </div>

                {/* Bot Speech Bubble */}
                <div className={clsx(
                  'bg-[#F8FAFC] border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-[10px] sm:text-xs text-slate-600 leading-relaxed italic',
                  viewportMode === 'mobile' ? 'leading-tight' : ''
                )}>
                  <span className="text-slate-400 font-serif mr-0.5 text-xs sm:text-sm">"</span>...Căn cứ theo quy định của điều khoản 14, hệ thống sẽ tự động cập nhật và phân bổ dữ liệu vào 00:00 hàng ngày theo múi giờ GMT+7...<span className="text-slate-400 font-serif ml-0.5 text-xs sm:text-sm">"</span>
                </div>

                {/* User Trigger Tag */}
                <div className="flex items-center justify-between text-[10px] sm:text-xs pt-0.5 sm:pt-1">
                  <span className="text-slate-500 font-medium hidden sm:inline">{t('previewDislikeNote')}</span>
                  <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/90 rounded-full font-bold text-[10px] sm:text-[11px] shadow-2xs">
                    <ThumbsDownIcon className={clsx('text-rose-600', viewportMode === 'mobile' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
                    <span>Dislike</span>
                  </span>
                </div>
              </div>

              {/* Feedback Form Header */}
              <div className="space-y-1">
                <h3 className={clsx(
                  'font-extrabold text-slate-900 tracking-tight flex items-center gap-2',
                  viewportMode === 'mobile' ? 'text-sm' : 'text-base sm:text-lg'
                )}>
                  {t('previewModalTitle')}
                </h3>
                <p className={clsx(
                  'text-slate-500 leading-normal',
                  viewportMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                )}>
                  {t('previewModalSubtitle')}
                </p>
              </div>

              {/* Interactive Choices */}
              <form className="space-y-2" onSubmit={e => e.preventDefault()}>
                {/* Option 1: Selected */}
                <label className={clsx(
                  'group flex items-start gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 border-[#026773] bg-teal-50/30 cursor-pointer shadow-sm transition-all duration-200',
                  viewportMode === 'mobile' ? 'gap-2' : ''
                )}>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#026773] flex items-center justify-center text-white shrink-0 ring-2 sm:ring-4 ring-teal-100 mt-0.5">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white"></span>
                  </div>
                  <div className={clsx(
                    'rounded-lg sm:rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0',
                    viewportMode === 'mobile' ? 'w-6 h-6' : 'w-7 h-7'
                  )}>
                    <AlertCircle className={clsx('text-amber-500', viewportMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                  </div>
                  <span className={clsx(
                    'font-bold text-slate-900 leading-snug',
                    viewportMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                  )}>
                    {viewportMode === 'mobile' ? 'Nội dung chưa chính xác' : 'Nội dung chưa chính xác hoặc thiếu dẫn chứng'}
                  </span>
                </label>

                {/* Option 2 */}
                <label className={clsx(
                  'group flex items-start gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 cursor-pointer transition-all duration-200',
                  viewportMode === 'mobile' ? 'gap-2' : ''
                )}>
                  <div className={clsx(
                    'rounded-full border-2 border-slate-300 group-hover:border-slate-400 shrink-0 mt-0.5',
                    viewportMode === 'mobile' ? 'w-4 h-4' : 'w-5 h-5'
                  )}></div>
                  <div className={clsx(
                    'rounded-lg sm:rounded-xl bg-cyan-50 border border-cyan-200/70 flex items-center justify-center shrink-0',
                    viewportMode === 'mobile' ? 'w-6 h-6' : 'w-7 h-7'
                  )}>
                    <Target className={clsx('text-cyan-600', viewportMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                  </div>
                  <span className={clsx(
                    'font-medium text-slate-700 leading-snug',
                    viewportMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                  )}>
                    {viewportMode === 'mobile' ? 'Chưa giải quyết đúng trọng tâm' : 'Chưa giải quyết đúng trọng tâm vấn đề'}
                  </span>
                </label>

                {/* Option 3 */}
                <label className={clsx(
                  'group flex items-start gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 cursor-pointer transition-all duration-200',
                  viewportMode === 'mobile' ? 'gap-2' : ''
                )}>
                  <div className={clsx(
                    'rounded-full border-2 border-slate-300 group-hover:border-slate-400 shrink-0 mt-0.5',
                    viewportMode === 'mobile' ? 'w-4 h-4' : 'w-5 h-5'
                  )}></div>
                  <div className={clsx(
                    'rounded-lg sm:rounded-xl bg-purple-50 border border-purple-200/70 flex items-center justify-center shrink-0',
                    viewportMode === 'mobile' ? 'w-6 h-6' : 'w-7 h-7'
                  )}>
                    <MessageSquare className={clsx('text-purple-500', viewportMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                  </div>
                  <span className={clsx(
                    'font-medium text-slate-700 leading-snug',
                    viewportMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                  )}>
                    {viewportMode === 'mobile' ? 'Trả lời quá dài dòng' : 'Trả lời quá dài dòng hoặc từ ngữ chuyên môn'}
                  </span>
                </label>

                {/* Option 4 */}
                <label className={clsx(
                  'group flex items-start gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 cursor-pointer transition-all duration-200',
                  viewportMode === 'mobile' ? 'gap-2' : ''
                )}>
                  <div className={clsx(
                    'rounded-full border-2 border-slate-300 group-hover:border-slate-400 shrink-0 mt-0.5',
                    viewportMode === 'mobile' ? 'w-4 h-4' : 'w-5 h-5'
                  )}></div>
                  <div className={clsx(
                    'rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0',
                    viewportMode === 'mobile' ? 'w-6 h-6' : 'w-7 h-7'
                  )}>
                    <LayoutGrid className={clsx('text-slate-500', viewportMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                  </div>
                  <span className={clsx(
                    'font-medium text-slate-700 leading-snug',
                    viewportMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                  )}>
                    {viewportMode === 'mobile' ? 'Lý do khác' : 'Lý do khác (vui lòng mô tả)'}
                  </span>
                </label>

                {/* Textarea */}
                <div className="pt-2 relative">
                  <textarea
                    className={clsx(
                      'w-full text-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#026773]/20 focus:border-[#026773] placeholder:text-slate-400 bg-slate-50/60 transition resize-none',
                      viewportMode === 'mobile' ? 'text-[10px] p-2.5' : 'text-xs p-3.5'
                    )}
                    placeholder={t('previewTextarea')}
                    rows={viewportMode === 'mobile' ? 2 : 3}
                  ></textarea>
                  <span className={clsx(
                    'absolute font-mono text-slate-400 bg-white/80 px-1.5 py-0.5 rounded',
                    viewportMode === 'mobile' ? 'bottom-2 right-2 text-[9px]' : 'bottom-3 right-3 text-[10px]'
                  )}>0/500</span>
                </div>

                {/* Action Buttons */}
                <div className={clsx(
                  'flex items-center justify-end gap-2 sm:gap-3',
                  viewportMode === 'mobile' ? 'pt-1' : 'pt-3'
                )}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSelection(null);
                      setPreviewText('');
                    }}
                    className={clsx(
                      'rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-semibold',
                      viewportMode === 'mobile' ? 'px-3 py-1.5 text-[10px]' : 'px-5 py-2.5 text-xs'
                    )}
                  >
                    {t('previewSkip')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewSelection === null) {
                        setToast({ message: 'Vui lòng chọn một lý do!', type: 'error' });
                        return;
                      }
                      setToast({ message: 'Đã gửi phản hồi thành công!', type: 'success' });
                      setPreviewSelection(null);
                      setPreviewText('');
                    }}
                    className={clsx(
                      'rounded-xl bg-gradient-to-r from-[#026773] to-[#014e57] hover:from-[#014e57] hover:to-[#013a40] text-white shadow-md shadow-[#026773]/20 hover:shadow-lg active:scale-95 transition-all duration-150 font-bold',
                      viewportMode === 'mobile' ? 'px-4 py-1.5 text-[10px]' : 'px-6 py-2.5 text-xs'
                    )}
                  >
                    {t('previewSend')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToast({ message: 'Đã lưu phản hồi!', type: 'success' });
                      setPreviewSelection(null);
                      setPreviewText('');
                    }}
                    className={clsx(
                      'rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 hover:shadow-lg active:scale-95 transition-all duration-150 font-bold',
                      viewportMode === 'mobile' ? 'px-4 py-1.5 text-[10px]' : 'px-6 py-2.5 text-xs'
                    )}
                  >
                    {t('previewSave')}
                  </button>
                </div>
              </form>
            </div>

            {/* Live Sync Footnote */}
            <div className={clsx(
              'rounded-xl sm:rounded-2xl bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border border-teal-100/90 flex items-center gap-2 sm:gap-3 text-teal-950 shadow-2xs',
              viewportMode === 'mobile' ? 'p-2.5' : 'p-3.5'
            )}>
              <div className={clsx(
                'rounded-lg bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0',
                viewportMode === 'mobile' ? 'w-6 h-6' : 'w-7 h-7'
              )}>
                <RefreshCw className={clsx('text-teal-700', viewportMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              </div>
              <p className={clsx(
                'leading-relaxed',
                viewportMode === 'mobile' ? 'text-[9px]' : 'text-[11px]'
              )}>
                <strong>Chế độ xem tương tác trực tiếp:</strong> Preview tự động cập nhật khi bạn thêm, sửa, đổi trạng thái hoặc kéo thả danh mục.
              </p>
            </div>
          </section>
        </main>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">MADA AI Enterprise Edition</span>
            <span>•</span>
            <span>Phiên bản Quản trị Trải nghiệm &amp; Đánh giá mô hình v4.8.2</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <a className="hover:text-[#026773] transition" href="#">Tài liệu API</a>
            <a className="hover:text-[#026773] transition" href="#">Chính sách bảo mật</a>
            <a className="hover:text-[#026773] transition" href="#">Trợ giúp kỹ thuật</a>
            <span className="text-slate-400">© 2025 MADA Universal Access.</span>
          </div>
        </div>
      </footer>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">
                {editingId ? t('modalEditTitle') : t('modalAddTitle')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
              {/* Main Content Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nội dung câu hỏi phản hồi <span className="text-rose-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">(Tiếng Việt - Ngôn ngữ chính)</span>
                </label>
                <textarea
                  value={formData.text_vi}
                  onChange={e => setFormData({ ...formData, text_vi: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi phản hồi... (bấm Tự động dịch để tạo các bản dịch)"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#026773] focus:ring-1 focus:ring-[#026773]/20 transition-colors text-sm resize-none"
                />
              </div>

              {/* Auto-translate Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAutoTranslate}
                  disabled={translating || !formData.text_vi.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {translating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  )}
                  {translating ? 'Đang dịch...' : 'Tự động dịch'}
                </button>
                <span className="text-xs text-slate-500">
                  Tạo bản dịch: English, العربية, Français
                </span>
              </div>

              {/* Translated Preview - Read-only */}
              {(formData.text_en || formData.text_ar || formData.text_fr) && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Bản dịch tự động (chỉ xem)
                  </div>
                  
                  {/* English */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                      <span>🇬🇧</span> English
                    </div>
                    <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700">
                      {formData.text_en || '-'}
                    </div>
                  </div>

                  {/* Arabic */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                      <span>🇸🇦</span> العربية
                    </div>
                    <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700" dir="rtl">
                      {formData.text_ar || '-'}
                    </div>
                  </div>

                  {/* French */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                      <span>🇫🇷</span> Français
                    </div>
                    <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700">
                      {formData.text_fr || '-'}
                    </div>
                  </div>
                </div>
              )}

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('labelIcon')}</label>
                <div className="flex gap-2">
                  {ICON_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: opt.id })}
                      className={clsx(
                        'w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-colors',
                        formData.icon === opt.id
                          ? 'border-[#026773] bg-teal-50 ring-2 ring-[#026773]/20'
                          : `${opt.border} ${opt.bg} hover:border-slate-400`
                      )}
                      title={opt.id}
                    >
                      {(() => {
                        const IconComponent = getIconComponent(opt.id);
                        return <IconComponent className={clsx('w-5 h-5', opt.textColor)} />;
                      })()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: formData.is_active === 1 ? 0 : 1 })}
                  className={clsx(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
                    formData.is_active === 1
                      ? 'bg-[#026773]'
                      : 'bg-slate-300 hover:bg-slate-400'
                  )}
                >
                  <span className={clsx(
                    'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    formData.is_active === 1 ? 'translate-x-4' : 'translate-x-0.5'
                  )} />
                </button>
                <span className={clsx(
                  'text-xs font-medium',
                  formData.is_active === 1 ? 'text-emerald-600' : 'text-slate-500'
                )}>
                  {formData.is_active === 1 ? 'Kích hoạt' : 'Tắt'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors text-sm"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[#026773] hover:bg-[#014e57] text-white rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingId ? t('saving') : t('creating')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
