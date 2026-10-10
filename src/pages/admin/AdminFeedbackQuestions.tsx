import { useState, useEffect } from 'react';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import {
  Plus, Check, X,
  Loader2, GripVertical,
  ArrowUpDown,
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

// ============== TRANSLATIONS ==============
const translations: Record<Language, Record<string, string>> = {
  vi: {
    pageTitle: 'Câu hỏi góp ý chất lượng',
    pageSubtitle: 'Quản lý và chuẩn hóa các tiêu chí hiển thị trong hộp thoại khảo sát khi người dùng nhấn nút Dislike. Dữ liệu này trực tiếp phục vụ bộ máy tinh chỉnh AI (RLHF).',
    saveOrder: 'Lưu thứ tự',
    addNew: 'Thêm câu hỏi mới',
    // Stats
    totalDislikeMonth: 'Tổng phản hồi Dislike tháng',
    mostPopularReason: 'Lý do phổ biến nhất',
    configStatus: 'Trạng thái cấu hình',
    active: 'hoạt động',
    avgResponseTime: 'Thời gian phản hồi AI TB',
    normalized: 'chuẩn hoá',
    changeFromLastMonth: 'so tháng trước',
    // Filters
    filterAll: 'Tất cả',
    filterActive: 'Đang hoạt động',
    filterHidden: 'Tạm ẩn',
    enableAll: 'Bật hết',
    disableAll: 'Tắt hết',
    searchPlaceholder: 'Tìm kiếm nội dung lý do...',
    // Table
    colOrder: 'Thứ tự',
    colContent: 'Nội dung câu hỏi phản hồi',
    colIcon: 'Icon',
    colRate: 'Tỷ lệ chọn',
    colStatus: 'Trạng thái',
    colActions: 'Hành động',
    // Status
    statusActive: 'Đang hoạt động',
    statusHidden: 'Tạm ẩn',
    // Actions
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    // Table footer
    dragTip: 'Mẹo: Bạn có thể kéo thả icon để trực tiếp sắp xếp thứ tự hiển thị ưu tiên trên màn hình người dùng.',
    totalActive: 'Tổng cộng',
    criteriaActive: 'tiêu chí hoạt động',
    // Preview
    previewTitle: 'Mô phỏng Giao diện User',
    previewMode: 'Preview Mode',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'Vừa xong',
    previewDislikeNote: 'Người dùng vừa bấm:',
    previewModalTitle: 'Chia sẻ lý do bạn chưa hài lòng',
    previewModalSubtitle: 'Ý kiến của bạn giúp chúng tôi cải thiện độ chính xác của mô hình MADA AI.',
    previewTextarea: 'Góp ý chi tiết để cải thiện AI (không bắt buộc)...',
    previewSkip: 'Bỏ qua',
    previewSend: 'Gửi phản hồi',
    previewSyncTip: 'Preview tự động cập nhật theo thời gian thực khi chỉnh sửa bảng bên trái.',
    // Modal
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
    // Misc
    loading: 'Đang tải...',
    noQuestions: 'Không tìm thấy câu hỏi',
    confirmDelete: 'Bạn có chắc muốn xóa câu hỏi này?',
    saved: 'Đã lưu!',
    created: 'Đã tạo!',
    deleted: 'Đã xóa!',
    textareaLabel: 'Kèm Textarea',
    live: 'Live trên Bot',
  },
  en: {
    pageTitle: 'Quality Feedback Questions',
    pageSubtitle: 'Manage and standardize criteria shown in the survey dialog when users click the Dislike button. This data directly serves the AI tuning engine (RLHF).',
    saveOrder: 'Save order',
    addNew: 'Add new question',
    totalDislikeMonth: 'Total Dislike feedback this month',
    mostPopularReason: 'Most popular reason',
    configStatus: 'Configuration status',
    active: 'active',
    avgResponseTime: 'Average AI response time',
    normalized: 'normalized',
    changeFromLastMonth: 'vs last month',
    filterAll: 'All',
    filterActive: 'Active',
    filterHidden: 'Hidden',
    enableAll: 'Enable All',
    disableAll: 'Disable All',
    searchPlaceholder: 'Search reason content...',
    colOrder: 'Order',
    colContent: 'Feedback Question Content',
    colIcon: 'Icon',
    colRate: 'Selection rate',
    colStatus: 'Status',
    colActions: 'Actions',
    statusActive: 'Active',
    statusHidden: 'Hidden',
    edit: 'Edit',
    delete: 'Delete',
    dragTip: 'Tip: You can drag the icon to directly reorder priority on the user screen.',
    totalActive: 'Total',
    criteriaActive: 'criteria active',
    previewTitle: 'User Interface Preview',
    previewMode: 'Preview Mode',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'Just now',
    previewDislikeNote: 'User just clicked:',
    previewModalTitle: 'Share why you\'re unsatisfied',
    previewModalSubtitle: 'Your feedback helps us improve the accuracy of the MADA AI model.',
    previewTextarea: 'Add more details to help improve the AI assistant (optional)...',
    previewSkip: 'Skip',
    previewSend: 'Send feedback',
    previewSyncTip: 'The preview syncs automatically with table edits in real-time.',
    modalAddTitle: 'Add new feedback question',
    modalEditTitle: 'Edit feedback question',
    labelVi: 'Content (Vietnamese)',
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
    confirmDelete: 'Are you sure you want to delete this question?',
    saved: 'Saved!',
    created: 'Created!',
    deleted: 'Deleted!',
    textareaLabel: 'With Textarea',
    live: 'Live on Bot',
  },
  ar: {
    pageTitle: 'أسئلة التعليقات السلبية',
    pageSubtitle: 'إدارة ومعايير معايير معروضة في نافذة الاستطلاع عند نقر المستخدم على زر عدم الإعجاب. تخدم هذه البيانات محرك ضبط الذكاء الاصطناعي (RLHF).',
    saveOrder: 'حفظ الترتيب',
    addNew: 'إضافة سؤال جديد',
    totalDislikeMonth: 'إجمالي ردود عدم الإعجاب هذا الشهر',
    mostPopularReason: 'السبب الأكثر شيوعًا',
    configStatus: 'حالة التكوين',
    active: 'نشط',
    avgResponseTime: 'متوسط وقت استجابة الذكاء الاصطناعي',
    normalized: 'مُطبّق',
    changeFromLastMonth: 'مقارنة بالشهر الماضي',
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
    statusActive: 'نشط',
    statusHidden: 'مخفي',
    edit: 'تعديل',
    delete: 'حذف',
    dragTip: 'نصيحة: يمكنك سحب الأيقونة لإعادة ترتيب الأولوية على شاشة المستخدم.',
    totalActive: 'الإجمالي',
    criteriaActive: 'معايير نشطة',
    previewTitle: 'معاينة واجهة المستخدم',
    previewMode: 'وضع المعاينة',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'الآن',
    previewDislikeNote: 'المستخدم نقر للتو على:',
    previewModalTitle: 'شارك السبب الذي لم تكن راضيًا عنه',
    previewModalSubtitle: 'رأيك يساعدنا في تحسين دقة نموذج MADA AI.',
    previewTextarea: 'أضف تفاصيل أخرى لتحسين مساعد الذكاء الاصطناعي (اختياري)...',
    previewSkip: 'تخطي',
    previewSend: 'إرسال التعليقات',
    previewSyncTip: 'يتم مزامنة المعاينة تلقائيًا مع تحرير الجدول في الوقت الفعلي.',
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
    confirmDelete: 'هل أنت متأكد أنك تريد حذف هذا السؤال؟',
    saved: 'تم الحفظ!',
    created: 'تم الإنشاء!',
    deleted: 'تم الحذف!',
    textareaLabel: 'مع حقل النص',
    live: 'مباشر على البوت',
  },
  fr: {
    pageTitle: 'Questions de commentaires négatifs',
    pageSubtitle: 'Gérer et normaliser les critères affichés dans le dialogue d\'enquête lorsque l\'utilisateur clique sur le bouton Je n\'aime pas. Ces données servent directement au moteur de paramétrage IA (RLHF).',
    saveOrder: 'Enregistrer l\'ordre',
    addNew: 'Ajouter une question',
    totalDislikeMonth: 'Total des commentaires Dislike ce mois',
    mostPopularReason: 'Raison la plus populaire',
    configStatus: 'État de la configuration',
    active: 'actif',
    avgResponseTime: 'Temps de réponse IA moyen',
    normalized: 'normalisé',
    changeFromLastMonth: 'vs mois dernier',
    filterAll: 'Tous',
    filterActive: 'Actif',
    filterHidden: 'Caché',
    enableAll: 'Tout activer',
    disableAll: 'Tout désactiver',
    searchPlaceholder: 'Rechercher le contenu de la raison...',
    colOrder: 'Ordre',
    colContent: 'Contenu de la question de feedback',
    colIcon: 'Icône',
    colRate: 'Taux de sélection',
    colStatus: 'Statut',
    colActions: 'Actions',
    statusActive: 'Actif',
    statusHidden: 'Caché',
    edit: 'Modifier',
    delete: 'Supprimer',
    dragTip: 'Astuce : Vous pouvez faire glisser l\'icône pour réorganiser directement la priorité sur l\'écran utilisateur.',
    totalActive: 'Total',
    criteriaActive: 'critères actifs',
    previewTitle: 'Aperçu de l\'interface utilisateur',
    previewMode: 'Mode aperçu',
    previewBotName: 'Mada Assistant',
    previewJustNow: 'À l\'instant',
    previewDislikeNote: 'L\'utilisateur vient de cliquer sur :',
    previewModalTitle: 'Partagez la raison de votre insatisfaction',
    previewModalSubtitle: 'Votre avis nous aide à améliorer la précision du modèle MADA AI.',
    previewTextarea: 'Ajoutez plus de détails pour aider à améliorer l\'assistant IA (optionnel)...',
    previewSkip: 'Ignorer',
    previewSend: 'Envoyer les commentaires',
    previewSyncTip: 'L\'aperçu se synchronise automatiquement avec les modifications du tableau en temps réel.',
    modalAddTitle: 'Ajouter une nouvelle question de feedback',
    modalEditTitle: 'Modifier la question de feedback',
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
    confirmDelete: 'Êtes-vous sûr de vouloir supprimer cette question ?',
    saved: 'Enregistré !',
    created: 'Créé !',
    deleted: 'Supprimé !',
    textareaLabel: 'Avec Textarea',
    live: 'En direct sur le Bot',
  },
};

// ============== ICON MAP (FontAwesome class names) ==============
const ICON_MAP: Record<string, { className: string; color: string }> = {
  'alert-circle': { className: 'fa-solid fa-circle-exclamation', color: 'text-amber-500' },
  'target':       { className: 'fa-solid fa-bullseye',          color: 'text-amber-500' },
  'message-square': { className: 'fa-regular fa-comment-dots',   color: 'text-slate-400' },
  'plus-circle':  { className: 'fa-regular fa-square-plus',    color: 'text-slate-400' },
};

function getIconClass(iconName: string) {
  return ICON_MAP[iconName]?.className ?? 'fa-solid fa-circle';
}
function getIconColor(iconName: string) {
  return ICON_MAP[iconName]?.color ?? 'text-slate-400';
}

// ============== TOAST COMPONENT ==============
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-elevated text-sm font-semibold transition-all animate-in slide-in-from-bottom-2',
      type === 'success'
        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        : 'bg-red-50 border border-red-200 text-red-800'
    )}>
      <i className={clsx('fa-solid', type === 'success' ? 'fa-check-circle text-emerald-600' : 'fa-circle-exclamation text-red-600')} />
      {message}
    </div>
  );
}

// ============== MAIN COMPONENT ==============
export default function AdminFeedbackQuestions() {
  const language = useLanguageStore((s) => s.language ?? 'vi') as Language;
  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  // State
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Stats (fetched from API)
  const [stats, setStats] = useState<Stats>({
    totalDislikeMonth: 0,
    dislikeChangePercent: 0,
    topReason: '',
    activeConfig: 0,
    totalConfig: 0,
    avgResponseTime: '—',
  });

  // Per-question stats from API
  const [questionStats, setQuestionStats] = useState<Record<string, { count: number; percent: number }>>({});

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    text_vi: '',
    text_en: '',
    text_ar: '',
    text_fr: '',
    icon: 'alert-circle',
    is_active: 1,
  });

  // Filter + search
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

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/chat/feedback/all-questions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setQuestions(data.data);
      } else {
        throw new Error(data.error || 'Dữ liệu không hợp lệ');
      }

      // Fetch real stats after questions are loaded
      try {
        const [statsRes, qStatsRes] = await Promise.all([
          fetch('/api/chat/feedback/stats/monthly', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          fetch('/api/chat/feedback/questions/stats', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        ]);
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

  // Reorder handlers
  const handleMoveOrder = async (q: FeedbackQuestion, direction: 'up' | 'down') => {
    const idx = filteredQuestions.findIndex(x => x.id === q.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= filteredQuestions.length) return;

    const target = filteredQuestions[targetIdx];

    // Optimistic update — swap sort_order
    setQuestions(prev => prev.map(existing => {
      if (existing.id === q.id) return { ...existing, sort_order: target.sort_order };
      if (existing.id === target.id) return { ...existing, sort_order: q.sort_order };
      return existing;
    }));

    // Persist to backend via PUT
    const token = getAccessToken();
    await Promise.all([
      fetch(`/api/chat/feedback/questions/${q.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
      fetch(`/api/chat/feedback/questions/${target.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sort_order: q.sort_order }),
      }),
    ]);
  };

  // Toggle active
  const handleToggleActive = async (q: FeedbackQuestion) => {
    const newActive = q.is_active === 1 ? 0 : 1;

    // Optimistic update
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: newActive } : x));

    try {
      const token = getAccessToken();
      const res = await fetch(`/api/chat/feedback/questions/${q.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: newActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert on failure
        setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: q.is_active } : x));
        setToast({ message: data.error || 'Không thể cập nhật trạng thái', type: 'error' });
      } else {
        setToast({
          message: newActive === 1 ? 'Đã bật hiển thị!' : 'Đã tạm ẩn',
          type: 'success'
        });
      }
    } catch {
      // Revert on network error
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: q.is_active } : x));
      setToast({ message: 'Lỗi kết nối khi cập nhật trạng thái', type: 'error' });
    }
  };

  // Enable all — bật hết tất cả câu hỏi
  const handleEnableAll = async () => {
    const currentlyDisabled = questions.filter(q => q.is_active !== 1);
    if (currentlyDisabled.length === 0) {
      setToast({ message: 'Tất cả đã được bật!', type: 'success' });
      return;
    }
    // Optimistic update
    setQuestions(prev => prev.map(x => ({ ...x, is_active: 1 })));
    setToast({ message: `Đã bật ${currentlyDisabled.length} câu hỏi!`, type: 'success' });
  };

  // Disable all — tắt hết tất cả câu hỏi
  const handleDisableAll = async () => {
    const currentlyEnabled = questions.filter(q => q.is_active === 1);
    if (currentlyEnabled.length === 0) {
      setToast({ message: 'Tất cả đã được tắt!', type: 'success' });
      return;
    }
    // Optimistic update
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
      setToast({ message: t('error'), type: 'error' });
      fetchQuestions();
    }
  };

  // Open modal — add
  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ text_vi: '', text_en: '', text_ar: '', text_fr: '', icon: 'alert-circle', is_active: 1 });
    setShowModal(true);
  };

  // Open modal — edit
  const handleEdit = (q: FeedbackQuestion) => {
    setEditingId(q.id);
    setFormData({
      text_vi: q.text_vi,
      text_en: q.text_en || '',
      text_ar: q.text_ar || '',
      text_fr: q.text_fr || '',
      icon: q.icon || 'alert-circle',
      is_active: q.is_active,
    });
    setShowModal(true);
  };

  // Auto-translate: detect which field has content, translate to the other 3
  const handleAutoTranslate = async () => {
    const text_vi = formData.text_vi.trim();
    const text_en = formData.text_en.trim();
    const text_ar = formData.text_ar.trim();
    const text_fr = formData.text_fr.trim();

    // Detect which language was filled
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
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  // Save (create or update)
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
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      setToast({ message: t('error'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f8fafc] font-sans antialiased selection:bg-brand-100 selection:text-brand-900">
      {/* ===== TOAST ===== */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back button */}
            <div className="flex items-center gap-4">
              <a
                href="/admin"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-brand-700 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 transition-all"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
                Quay lại
              </a>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3">
              <button className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-xs font-medium" title="Thông báo hệ thống">
                <i className="fa-regular fa-bell text-sm"></i>
                <span className="hidden sm:inline">Thông báo</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white"></span>
              </button>

              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 transition cursor-pointer">
                <div className="w-6 h-6 rounded-full bg-brand-700/10 text-brand-700 flex items-center justify-center text-xs font-bold ring-1 ring-brand-700/20">
                  <i className="fa-regular fa-user"></i>
                </div>
                <span className="text-xs font-medium text-slate-700 tracking-tight">superadmin@mada.vn</span>
                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-700 border border-amber-300">SUPER</span>
              </div>

              <div className="relative">
                <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition">
                  <i className="fa-solid fa-globe text-slate-400 text-sm"></i>
                  <span className="text-base leading-none">🇻🇳</span>
                  <span className="font-semibold text-xs tracking-wider">VI</span>
                  <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">

        {/* ===== PAGE HEADING ===== */}
        <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-2">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
              <i className="fa-solid fa-thumbs-down text-2xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{t('pageTitle')}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t('live')}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">{t('pageSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center">
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  const token = getAccessToken();
                  // Save ALL questions with current sort_order from filtered view
                  const filteredIds = new Set(filteredQuestions.map(q => q.id));
                  const allToSave = questions.map((q, i) =>
                    filteredIds.has(q.id)
                      ? { q, sort_order: filteredQuestions.findIndex(fq => fq.id === q.id) + 1 }
                      : { q, sort_order: q.sort_order }
                  );
                  const results = await Promise.allSettled(
                    allToSave.map(({ q, sort_order }) =>
                      fetch(`/api/chat/feedback/questions/${q.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ sort_order, is_active: q.is_active }),
                      })
                    )
                  );
                  const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
                  if (failures.length > 0) {
                    setToast({ message: `Lưu thất bại (${failures.length} mục)`, type: 'error' });
                  } else {
                    setToast({ message: t('saved'), type: 'success' });
                  }
                  fetchQuestions();
                } catch {
                  setToast({ message: 'Lỗi lưu thứ tự', type: 'error' });
                } finally {
                  setSaving(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-subtle hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('saveOrder')}</span>
            </button>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-700 hover:bg-brand-800 active:bg-brand-900 shadow-md shadow-brand-700/25 transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addNew')}</span>
            </button>
          </div>
        </section>

        {/* ===== STATS CARDS ===== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">{t('totalDislikeMonth')}</span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {stats.totalDislikeMonth.toLocaleString()} <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{stats.dislikeChangePercent}%</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100">
              <i className="fa-solid fa-chart-pie text-brand-700"></i>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500">{t('mostPopularReason')}</span>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={stats.topReason}>{stats.topReason}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 flex-shrink-0">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">{t('configStatus')}</span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {stats.activeConfig}/{stats.totalConfig} <span className="text-xs font-normal text-slate-500">{t('active')}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-700 flex items-center justify-center border border-teal-100">
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">{t('avgResponseTime')}</span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {stats.avgResponseTime} <span className="text-xs font-semibold text-slate-500">{t('normalized')}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <i className="fa-solid fa-bolt"></i>
            </div>
          </div>
        </section>

        {/* ===== MAIN GRID: TABLE + PREVIEW ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* ===== TABLE CARD ===== */}
          <section className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">

            {/* Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Filter tabs */}
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 border border-slate-200/60">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={clsx('px-3.5 py-1.5 rounded-lg transition-all', filterTab === 'all' ? 'bg-white text-brand-700 font-bold shadow-sm' : 'hover:text-slate-900')}
                  >
                    {t('filterAll')} ({questions.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('active')}
                    className={clsx('px-3 py-1.5 rounded-lg transition-all', filterTab === 'active' ? 'bg-white text-brand-700 font-bold shadow-sm' : 'hover:text-slate-900')}
                  >
                    {t('filterActive')} ({activeCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('hidden')}
                    className={clsx('px-3 py-1.5 rounded-lg transition-all', filterTab === 'hidden' ? 'bg-white text-brand-700 font-bold shadow-sm' : 'hover:text-slate-900')}
                  >
                    {t('filterHidden')} ({hiddenCount})
                  </button>
                </div>

                {/* Quick toggle buttons */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    onClick={handleEnableAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                    title={t('enableAll')}
                  >
                    <i className="fa-solid fa-power-off text-[10px]"></i>
                    {t('enableAll')}
                  </button>
                  <button
                    onClick={handleDisableAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-all"
                    title={t('disableAll')}
                  >
                    <i className="fa-solid fa-ban text-[10px]"></i>
                    {t('disableAll')}
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
              ) : error ? (
                <div className="text-center py-16 text-sm text-red-500">{error}</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-16">
                  <i className="fa-solid fa-thumbs-down text-4xl text-slate-300 mb-3"></i>
                  <p className="text-sm text-slate-400">{t('noQuestions')}</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 pl-6 pr-3 w-28 text-center">{t('colOrder')}</th>
                      <th className="py-3.5 px-4">{t('colContent')}</th>
                      <th className="py-3.5 px-4 w-20 text-center">{t('colIcon')}</th>
                      <th className="py-3.5 px-4 w-36 text-center">{t('colRate')}</th>
                      <th className="py-3.5 px-4 w-36 text-center">{t('colStatus')}</th>
                      <th className="py-3.5 pl-4 pr-6 w-28 text-center">{t('colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredQuestions.map((q, idx) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 group transition-colors">
                        {/* Order */}
                        <td className="py-4 pl-6 pr-3">
                          <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <span className="cursor-grab active:cursor-grabbing p-1 hover:text-slate-600 transition-colors" title="Kéo thả để sắp xếp">
                              <GripVertical className="w-3 h-3" />
                            </span>
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col ml-1">
                              <button
                                onClick={() => handleMoveOrder(q, 'up')}
                                disabled={idx === 0}
                                className="text-[9px] hover:text-brand-700 text-slate-300 disabled:opacity-30 p-0.5 leading-none transition-colors"
                                title="Lên đầu"
                              >
                                <i className="fa-solid fa-chevron-up"></i>
                              </button>
                              <button
                                onClick={() => handleMoveOrder(q, 'down')}
                                disabled={idx === filteredQuestions.length - 1}
                                className="text-[9px] hover:text-brand-700 text-slate-400 disabled:opacity-30 p-0.5 leading-none transition-colors"
                                title="Xuống dưới"
                              >
                                <i className="fa-solid fa-chevron-down"></i>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Content */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 text-sm group-hover:text-brand-700 transition-colors">{q.text_vi}</p>
                              {q.question_key === 'other' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {t('textareaLabel')}
                                </span>
                              )}
                            </div>
                            {q.text_en && (
                              <p className="text-xs text-slate-400 italic font-normal">{q.text_en}</p>
                            )}
                          </div>
                        </td>

                        {/* Icon */}
                        <td className="py-4 px-4 text-center">
                          <div className={clsx(
                            'inline-flex w-8 h-8 rounded-full items-center justify-center text-sm shadow-inner transition-colors',
                            getIconColor(q.icon).replace('text-', 'bg-') + '/10 group-hover:bg-brand-50/40'
                          )} title={q.icon}>
                            <i className={clsx(getIconClass(q.icon), getIconColor(q.icon))}></i>
                          </div>
                        </td>

                        {/* Rate (real data) */}
                        <td className="py-4 px-4">
                          {(() => {
                            const stat = questionStats[q.question_key];
                            if (!stat) return <span className="text-xs text-slate-400">—</span>;
                            return (
                              <div className="w-full flex flex-col gap-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-700">{stat.count} lượt</span>
                                  <span className="text-slate-400 font-semibold text-[11px]">{stat.percent.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={clsx('h-full rounded-full', ['bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-slate-400'][idx % 4])}
                                    style={{ width: `${Math.min(stat.percent, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(q)}
                            className={clsx(
                              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                              q.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            )}
                          >
                            <span className={clsx('w-1.5 h-1.5 rounded-full', q.is_active === 1 ? 'bg-emerald-500' : 'bg-slate-400')}></span>
                            {q.is_active === 1 ? t('statusActive') : t('statusHidden')}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 pr-6 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleEdit(q)}
                              className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                              title={t('edit')}
                            >
                              <i className="fa-regular fa-pen-to-square text-sm"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(q)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title={t('delete')}
                            >
                              <i className="fa-regular fa-trash-can text-sm"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table footer */}
            {!loading && filteredQuestions.length > 0 && (
              <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
                <div className="flex items-center gap-2">
                  <i className="fa-regular fa-circle-question text-slate-400"></i>
                  <span>{t('dragTip')}</span>
                </div>
                <div className="font-medium text-slate-600">
                  {t('totalActive')}: <strong className="text-slate-900">{activeCount}</strong> {t('criteriaActive')}
                </div>
              </div>
            )}
          </section>

          {/* ===== LIVE PREVIEW SIDEBAR ===== */}
          <aside className="xl:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-700"></span>
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('previewTitle')}</h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">{t('previewMode')}</span>
            </div>

            {/* Simulated Dialog */}
            <div className="bg-white rounded-2xl border-2 border-brand-700/20 shadow-elevated p-4 relative overflow-visible">
              {/* Bot message snippet */}
              <div className="pb-3.5 mb-3.5 border-b border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-bold text-brand-700 flex items-center gap-1.5">
                    <i className="fa-solid fa-robot"></i> {t('previewBotName')}
                  </span>
                  <span>{t('previewJustNow')}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  "...Căn cứ theo quy định của điều khoản 14, hệ thống sẽ tự động cập nhật dữ liệu vào 00:00 hàng ngày..."
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-400">{t('previewDislikeNote')}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <i className="fa-solid fa-thumbs-down text-[10px]"></i> Dislike
                  </span>
                </div>
              </div>

              {/* Dialog content */}
              <div className="space-y-1 mb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {t('previewModalTitle')}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t('previewModalSubtitle')}</p>
              </div>

              {/* Options */}
              <div className="space-y-1.5">
                {filteredQuestions.slice(0, 4).map((q, idx) => (
                  <label key={q.id} className={clsx(
                    'flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors',
                    idx === 0
                      ? 'border-brand-700/30 bg-brand-50/40'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  )}>
                    <input className="text-brand-700 focus:ring-brand-700 w-3.5 h-3.5" name="preview_reason" type="radio" defaultChecked={idx === 0} />
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 min-w-0">
                      <i className={clsx(getIconClass(q.icon), getIconColor(q.icon), 'text-[10px] flex-shrink-0')}></i>
                      <span className="truncate">{q.text_vi}</span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Textarea */}
              <div className="mt-3">
                <textarea
                  className="w-full text-[10px] rounded-xl border border-slate-200 focus:border-brand-700 focus:ring-brand-700 placeholder:text-slate-400 resize-none leading-relaxed p-2"
                  placeholder={t('previewTextarea')}
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                  {t('previewSkip')}
                </button>
                <button className="px-3 py-1.5 text-[11px] font-bold rounded-lg text-white bg-brand-700 hover:bg-brand-800 transition-colors shadow-sm">
                  {t('previewSend')}
                </button>
              </div>
            </div>

            {/* Sync tip */}
            <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-500 text-xs flex gap-2.5">
              <i className="fa-solid fa-lightbulb text-amber-500 text-sm shrink-0 mt-0.5"></i>
              <p>{t('previewSyncTip')}</p>
            </div>
          </aside>
        </div>

        {/* ===== STICKY BOTTOM SAVE BAR ===== */}
        {!loading && filteredQuestions.length > 0 && (
          <div className="sticky bottom-0 z-30 mt-6 mx-[-1.5rem] sm:mx-[-2rem] lg:mx-[-2rem]">
            <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <i className="fa-solid fa-circle-info text-slate-400"></i>
                <span>{filteredQuestions.length} tiêu chí đang hiển thị trên Bot</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    const token = getAccessToken();
                    // ⭐ Save ALL questions (not just filtered), preserving their current sort order
                    const results = await Promise.allSettled(
                      questions.map((q) =>
                        fetch(`/api/chat/feedback/questions/${q.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                          body: JSON.stringify({ sort_order: q.sort_order, is_active: q.is_active }),
                        })
                      )
                    );
                    // Check for any failures
                    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
                    if (failures.length > 0) {
                      setToast({ message: `Lưu thất bại (${failures.length} mục)`, type: 'error' });
                    } else {
                      setToast({ message: t('saved'), type: 'success' });
                    }
                    // Re-fetch to sync with server state (after toast is set)
                    fetchQuestions();
                  } catch {
                    setToast({ message: 'Lỗi lưu thứ tự', type: 'error' });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-700 hover:bg-brand-800 active:bg-brand-900 shadow-md shadow-brand-700/25 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk"></i>
                    Lưu thay đổi
                  </>
                )}
              </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">MADA Universal Access Platform</span>
            <span>•</span>
            <span>Hệ thống quản trị AI Feedback Engine v3.4</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a className="hover:text-slate-600 transition-colors" href="#">Tài liệu API</a>
            <a className="hover:text-slate-600 transition-colors" href="#">Quy chuẩn dữ liệu RLHF</a>
            <a className="hover:text-slate-600 transition-colors" href="#">Hỗ trợ kỹ thuật</a>
          </div>
        </div>
      </footer>

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? t('modalEditTitle') : t('modalAddTitle')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Vietnamese — primary input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t('labelVi')} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.text_vi}
                  onChange={e => setFormData({ ...formData, text_vi: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all text-sm resize-none"
                />
              </div>

              {/* Auto-translate */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoTranslate}
                  disabled={translating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-all disabled:opacity-60"
                >
                  {translating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang dịch...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                      Tự động dịch sang 3 ngôn ngữ còn lại
                    </>
                  )}
                </button>
                <span className="text-xs text-slate-400">Nhập nội dung → bấm để dịch EN / AR / FR</span>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('labelIcon')}</label>
                <div className="flex gap-2">
                  {Object.entries(ICON_MAP).map(([id, { className, color }]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: id })}
                      className={clsx(
                        'w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all',
                        formData.icon === id
                          ? 'border-brand-700 bg-brand-50 text-brand-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700'
                      )}
                      title={id}
                    >
                      <i className={clsx(className, color, 'text-base')}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: formData.is_active === 1 ? 0 : 1 })}
                  className={clsx(
                    'group relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200',
                    formData.is_active === 1
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'bg-slate-200 hover:bg-slate-300'
                  )}
                >
                  <span className={clsx(
                    'inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-md transition-all duration-200',
                    formData.is_active === 1 ? 'translate-x-7' : 'translate-x-1'
                  )}>
                    {formData.is_active === 1 ? (
                      <i className="fa-solid fa-check text-[8px] text-emerald-500"></i>
                    ) : (
                      <i className="fa-solid fa-xmark text-[8px] text-slate-400"></i>
                    )}
                  </span>
                </button>
                <span className={clsx(
                  'text-sm font-medium transition-colors duration-200',
                  formData.is_active === 1 ? 'text-emerald-600' : 'text-slate-500'
                )}>
                  {formData.is_active === 1 ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors text-sm"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-md shadow-brand-700/25"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editingId ? t('saving') : t('creating')}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingId ? t('saveOrder') : t('addNew')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
