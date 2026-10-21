import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from './AdminLayoutLinear';
import { adminApi } from './adminApi';
import { useAuthStore, useLanguageStore } from '@/stores';
import { translations, type Language } from '@/lib/translations';
import clsx from 'clsx';
import {
  Eye, HelpCircle, Accessibility, MessageSquare, Tag, Box,
} from 'lucide-react';

// ============== TYPES ==============
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
  created_at: string;
  updated_at: string;
}

// ============== CONSTANTS ==============
const CATEGORIES: { value: ATCategory; label: string; labelEn: string; labelAr: string; labelFr: string; icon: React.ReactNode }[] = [
  { value: 'vision', label: 'Thị giác', labelEn: 'Vision', labelAr: 'البصر', labelFr: 'Vision', icon: <Eye className="w-4 h-4" /> },
  { value: 'hearing', label: 'Thính giác', labelEn: 'Hearing', labelAr: 'السمع', labelFr: 'Audition', icon: <HelpCircle className="w-4 h-4" /> },
  { value: 'mobility', label: 'Vận động', labelEn: 'Mobility', labelAr: 'التنقل', labelFr: 'Mobilité', icon: <Accessibility className="w-4 h-4" /> },
  { value: 'cognition', label: 'Nhận thức', labelEn: 'Cognition', labelAr: 'الإدراك', labelFr: 'Cognition', icon: <HelpCircle className="w-4 h-4" /> },
  { value: 'communication', label: 'Giao tiếp', labelEn: 'Communication', labelAr: 'التواصل', labelFr: 'Communication', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'daily_living', label: 'Sinh hoạt', labelEn: 'Daily Living', labelAr: 'الحياة اليومية', labelFr: 'Vie quotidienne', icon: <Accessibility className="w-4 h-4" /> },
  { value: 'education', label: 'Giáo dục', labelEn: 'Education', labelAr: 'التعليم', labelFr: 'Éducation', icon: <Tag className="w-4 h-4" /> },
  { value: 'general', label: 'Tổng quát', labelEn: 'General', labelAr: 'عام', labelFr: 'Général', icon: <Box className="w-4 h-4" /> },
];

const VIEW_MODES: { value: ViewMode; label: string; labelEn: string; labelAr: string; labelFr: string }[] = [
  { value: 'end_user', label: 'Người dùng', labelEn: 'End-User', labelAr: 'المستخدم النهائي', labelFr: 'Utilisateur final' },
  { value: 'at_specialist', label: 'Chuyên gia AT', labelEn: 'AT Specialist', labelAr: 'متخصص التقنية المساعدة', labelFr: 'Spécialiste AT' },
];

const LANGUAGES: { value: LanguageType; label: string; labelEn: string; labelAr: string; labelFr: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', labelEn: 'Vietnamese', labelAr: 'الفيتنامية', labelFr: 'Vietnamien', flag: '🇻🇳' },
  { value: 'en', label: 'English', labelEn: 'English', labelAr: 'الإنجليزية', labelFr: 'Anglais', flag: '🇬🇧' },
  { value: 'ar', label: 'العربية', labelEn: 'Arabic', labelAr: 'العربية', labelFr: 'Arabe', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', labelEn: 'French', labelAr: 'الفرنسية', labelFr: 'Français', flag: '🇫🇷' },
];

// ============== TRANSLATION HELPER ==============
function useSuggestedQuestionsTranslation() {
  const language = useLanguageStore((state) => state.language ?? 'vi') as Language;
  const t = (key: string, params?: Record<string, string | number>) => {
    let text = (translations[language]?.[key as keyof typeof translations[typeof language]] || translations.vi[key as keyof typeof translations.vi]) as string || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  };
  return { t, language };
}

// ============== MAIN COMPONENT ==============
export default function AdminSuggestedQuestions() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const { t, language } = useSuggestedQuestionsTranslation();

  // Data state
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<ATCategory | ''>('');
  const [filterViewMode, setFilterViewMode] = useState<ViewMode | ''>('');
  const [filterLanguage, setFilterLanguage] = useState<LanguageType | ''>('');
  const [filterAgentId, setFilterAgentId] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [formData, setFormData] = useState({
    category: 'vision' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    question: '',
    sort_order: 0,
    is_active: true,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {};
      if (filterCategory) params.category = filterCategory;
      if (filterViewMode) params.view_mode = filterViewMode;
      if (filterLanguage) params.language = filterLanguage;
      if (filterAgentId) params.agent_id = filterAgentId;

      const [questionsRes, statsRes] = await Promise.all([
        adminApi.getSuggestedQuestions(params),
        adminApi.getSuggestedQuestionsStats(),
      ]);

      if (questionsRes.success && questionsRes.data) {
        setQuestions(questionsRes.data);
      } else {
        setError(questionsRes.error || t('common.error'));
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterCategory, filterViewMode, filterLanguage, filterAgentId]);

  // Filtered questions
  const filteredQuestions = useMemo(() => questions, [questions]);

  // Paginated questions
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuestions.slice(start, start + itemsPerPage);
  }, [filteredQuestions, currentPage]);

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);

  // Form handlers
  const resetForm = () => {
    setFormData({
      category: 'vision',
      view_mode: 'end_user',
      question: '',
      sort_order: 0,
      is_active: true,
    });
    setEditingId(null);
  };

  const openEditForm = (q: SuggestedQuestion) => {
    if (!isSuperAdmin) return;
    // For edit, still use auto-translate concept - edit Vietnamese and it will update all languages
    setFormData({
      category: q.category,
      view_mode: q.view_mode,
      question: q.question,
      sort_order: q.sort_order,
      is_active: q.is_active === 1,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.question.trim()) {
      alert(t('adminSuggested.pleaseEnterQuestion'));
      return;
    }

    try {
      setIsTranslating(true);

      // ⭐ Always use auto-translate: create all 4 languages from Vietnamese
      const res = await adminApi.autoTranslateQuestion({
        question_vi: formData.question,
        category: formData.category,
        view_mode: formData.view_mode,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      });

      if (!res.success) {
        alert(res.error || t('adminSuggested.errorCreating'));
        return;
      }

      setShowForm(false);
      resetForm();
      loadData();
      alert(t('adminSuggested.autoTranslatedSuccess', { 
        count: res.data?.count || 4 
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkMode, setBulkMode] = useState<'add' | 'edit' | null>(null);
  const [bulkQuestions, setBulkQuestions] = useState<Array<{
    id?: string;
    category: ATCategory;
    view_mode: ViewMode;
    language: LanguageType;
    question: string;
    sort_order: number;
    is_active: boolean;
  }>>([]);

  // Bulk form default template
  const getBulkDefaultRow = (index: number = 0) => ({
    category: 'vision' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    language: 'vi' as LanguageType,
    question: '',
    sort_order: index * 10,
    is_active: true,
  });

  const openBulkAddForm = () => {
    if (!isSuperAdmin) return;
    setBulkMode('add');
    // Start with 5 empty rows for faster bulk entry
    setBulkQuestions([
      getBulkDefaultRow(0),
      getBulkDefaultRow(1),
      getBulkDefaultRow(2),
      getBulkDefaultRow(3),
      getBulkDefaultRow(4),
    ]);
    setShowBulkForm(true);
  };

  const openBulkEditForm = () => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    setBulkMode('edit');
    const selectedQs = questions.filter(q => selectedIds.has(q.id));
    setBulkQuestions(selectedQs.map(q => ({
      id: q.id,
      category: q.category,
      view_mode: q.view_mode,
      language: q.language,
      question: q.question,
      sort_order: q.sort_order,
      is_active: q.is_active === 1,
    })));
    setShowBulkForm(true);
  };

  const addBulkRow = () => {
    setBulkQuestions(prev => [...prev, getBulkDefaultRow(prev.length)]);
  };

  const removeBulkRow = (index: number) => {
    setBulkQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateBulkRow = (index: number, field: string, value: any) => {
    setBulkQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ));
  };

  const handleBulkSubmit = async () => {
    // Validate all questions have content
    const invalidRows = bulkQuestions.filter(q => !q.question.trim());
    if (invalidRows.length > 0) {
      alert(t('adminSuggested.fillAllRows'));
      return;
    }

    try {
      if (bulkMode === 'add') {
        // Create all questions using bulk API (faster!)
        const questionsToCreate = bulkQuestions.map(q => ({
          category: q.category,
          view_mode: q.view_mode,
          language: q.language,
          question: q.question,
          sort_order: q.sort_order,
          is_active: q.is_active,
        }));
        
        const res = await adminApi.createSuggestedQuestionsBulk(questionsToCreate);
        if (res.success) {
          alert(t('adminSuggested.addedCount', { count: res.data?.count || bulkQuestions.length }));
        } else {
          alert(res.error || t('adminSuggested.errorAdding'));
          return;
        }
      } else if (bulkMode === 'edit') {
        // Update all questions using bulk API (faster!)
        const questionsToUpdate = bulkQuestions
          .filter(q => q.id)
          .map(q => ({
            id: q.id!,
            category: q.category,
            view_mode: q.view_mode,
            language: q.language,
            question: q.question,
            sort_order: q.sort_order,
            is_active: q.is_active,
          }));
        
        const res = await adminApi.updateSuggestedQuestionsBulk(questionsToUpdate);
        if (res.success) {
          alert(t('adminSuggested.updatedCount', { count: res.data?.count || questionsToUpdate.length }));
        } else {
          alert(res.error || t('adminSuggested.errorUpdatingQuestions'));
          return;
        }
      }

      setShowBulkForm(false);
      setBulkMode(null);
      setBulkQuestions([]);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkToggleActive = async () => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    if (!confirm(t('adminSuggested.toggleConfirm', { count: selectedIds.size }))) return;

    try {
      for (const id of selectedIds) {
        const q = questions.find(q => q.id === id);
        if (q) {
          await adminApi.updateSuggestedQuestion(id, {
            is_active: q.is_active !== 1,
          });
        }
      }
      setSelectedIds(new Set());
      loadData();
      alert(t('adminSuggested.statusUpdated'));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    if (!confirm(t('adminSuggested.deleteConfirm', { count: selectedIds.size }))) return;

    try {
      const ids = Array.from(selectedIds);
      const res = await adminApi.deleteSuggestedQuestionsBulk(ids);
      if (res.success) {
        alert(t('adminSuggested.deletedCount', { count: res.data?.count || selectedIds.size }));
      } else {
        alert(res.error || t('adminSuggested.errorDeleting'));
        return;
      }
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!confirm(t('adminSuggested.confirmDeleteQuestion'))) return;

    try {
      const res = await adminApi.deleteSuggestedQuestion(id);
      if (res.success) {
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (q: SuggestedQuestion) => {
    if (!isSuperAdmin) return;
    try {
      const res = await adminApi.updateSuggestedQuestion(q.id, {
        is_active: q.is_active !== 1,
      });
      if (res.success) {
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImportDefaults = async () => {
    if (!isSuperAdmin) return;
    if (!confirm(t('adminSuggested.importConfirm'))) return;

    try {
      const res = await adminApi.importSuggestedQuestionDefaults();
      if (res.success) {
        alert(t('adminSuggested.importedCount', { count: res.data?.count || 0 }));
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  /** ⭐ Xóa tất cả câu hỏi không phải tiếng Việt */
  const handleDeleteNonVietnamese = async () => {
    if (!isSuperAdmin) return;
    const count = stats?.byLanguage?.find((l: any) => l.language !== 'vi')?.count || 0;
    if (count === 0) {
      alert('Không có câu hỏi nào không phải tiếng Việt để xóa.');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa ${count} câu hỏi không phải tiếng Việt không?`)) return;

    try {
      const res = await adminApi.deleteNonVietnameseQuestions();
      if (res.success) {
        alert(`Đã xóa ${res.data?.count || count} câu hỏi không phải tiếng Việt.`);
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getCategoryLabelByLang = (cat: string) => {
    const c = CATEGORIES.find(x => x.value === cat);
    if (!c) return cat;
    if (language === 'ar') return c.labelAr;
    if (language === 'fr') return c.labelFr;
    if (language === 'en') return c.labelEn;
    return c.label;
  };
  const getCategoryIcon = (cat: string) => CATEGORIES.find(c => c.value === cat)?.icon || <Box className="w-4 h-4" />;
  const getViewModeLabelByLang = (mode: string) => {
    const v = VIEW_MODES.find(x => x.value === mode);
    if (!v) return mode;
    if (language === 'ar') return v.labelAr;
    if (language === 'fr') return v.labelFr;
    if (language === 'en') return v.labelEn;
    return v.label;
  };
  const getLanguageLabelByLang = (lang: string) => {
    const l = LANGUAGES.find(x => x.value === lang);
    if (!l) return lang;
    if (language === 'ar') return l.labelAr;
    if (language === 'fr') return l.labelFr;
    if (language === 'en') return l.labelEn;
    return l.label;
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.suggestedQuestions"
      subtitleKey="admin.topBar.suggestedQuestionsSub"
      showLayoutTitle={false}
    >
      {/* Hero Section */}
      <section className="mb-6">
        <div className="bg-gradient-to-br from-primary/10 via-white to-secondary/10 backdrop-blur-xl rounded-2xl border border-slate-300 p-5 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black text-on-surface mb-1">{t('adminSuggested.heroTitle')}</h2>
              <p className="text-sm text-on-surface-variant">
                {t('adminSuggested.heroSubtitle')}
              </p>
            </div>
            {isSuperAdmin && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDeleteNonVietnamese}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white font-bold text-sm border border-red-600 shadow-sm hover:shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  {t('adminSuggested.deleteNonVi')}
                </button>
                <button
                  onClick={handleImportDefaults}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {t('adminSuggested.importDefaults')}
                </button>
                <button
                  onClick={openBulkAddForm}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  {t('adminSuggested.addMany')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-xl rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-600">quiz</span>
              <span className="text-xs font-bold text-blue-700 uppercase">{t('adminSuggested.total')}</span>
            </div>
            <h3 className="text-2xl font-black text-blue-700">{stats.total?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-xl rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <span className="text-xs font-bold text-green-700 uppercase">{t('adminSuggested.active')}</span>
            </div>
            <h3 className="text-2xl font-black text-green-700">{stats.active?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-xl rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-purple-600">smart_toy</span>
              <span className="text-xs font-bold text-purple-700 uppercase">{t('adminSuggested.agentSpecific')}</span>
            </div>
            <h3 className="text-2xl font-black text-purple-700">{stats.agentSpecific?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 backdrop-blur-xl rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-amber-600">language</span>
              <span className="text-xs font-bold text-amber-700 uppercase">{t('adminSuggested.languages')}</span>
            </div>
            <h3 className="text-2xl font-black text-amber-700">
              {LANGUAGES.filter(l => 
                stats.byLanguage?.some((s: any) => s.language === l.value && s.count > 0)
              ).length}
            </h3>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="bg-white/80 backdrop-blur-xl rounded-xl border border-slate-300 p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-gray-600">filter_list</span>
          <span className="text-sm font-bold text-gray-700">{t('adminSuggested.filter')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('adminSuggested.category')}</label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value as ATCategory | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('adminSuggested.all')}</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {getCategoryLabelByLang(c.value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('adminSuggested.viewMode')}</label>
            <select
              value={filterViewMode}
              onChange={(e) => { setFilterViewMode(e.target.value as ViewMode | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('adminSuggested.all')}</option>
              {VIEW_MODES.map(v => (
                <option key={v.value} value={v.value}>{getViewModeLabelByLang(v.value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('adminSuggested.language')}</label>
            <select
              value={filterLanguage}
              onChange={(e) => { setFilterLanguage(e.target.value as LanguageType | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('adminSuggested.all')}</option>
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.flag} {getLanguageLabelByLang(l.value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('adminSuggested.agentId')}</label>
            <input
              type="text"
              value={filterAgentId}
              onChange={(e) => { setFilterAgentId(e.target.value); setCurrentPage(1); }}
              placeholder={t('adminSuggested.leaveEmptyDefault')}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        {(filterCategory || filterViewMode || filterLanguage || filterAgentId) && (
          <button
            onClick={() => {
              setFilterCategory('');
              setFilterViewMode('');
              setFilterLanguage('');
              setFilterAgentId('');
              setCurrentPage(1);
            }}
            className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            ✕ {t('adminSuggested.clearFilters')}
          </button>
        )}
      </section>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-700">
          <p className="font-medium">{error}</p>
          <button onClick={loadData} className="mt-2 text-sm underline">{t('adminSuggested.retry')}</button>
        </div>
      )}

      {/* Questions Table */}
      <section className="bg-white/80 backdrop-blur-xl rounded-xl border border-slate-300 shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-on-surface">
              {loading ? t('adminSuggested.loading') : `${filteredQuestions.length} ${t('adminSuggested.questions')}`}
            </h3>
            <button onClick={loadData} className="text-xs text-primary hover:text-primary/80 font-medium">
              ↻ {t('common.refresh')}
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 border border-slate-300 flex items-center justify-center mb-4 shadow-sm animate-pulse">
              <span className="material-symbols-outlined text-2xl text-gray-400">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">{t('adminSuggested.loading')}</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 border border-slate-300 flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-2xl text-gray-400">quiz</span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-1">{t('adminSuggested.noQuestions')}</h4>
            <p className="text-sm text-on-surface-variant mb-4">{t('adminSuggested.noQuestionsHint')}</p>
            {isSuperAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={handleImportDefaults}
                  className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                >
                  {t('adminSuggested.importDefaults')}
                </button>
                <button
                  onClick={openBulkAddForm}
                  className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                >
                  {t('adminSuggested.addMany')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Bulk Action Bar */}
            {isSuperAdmin && selectedIds.size > 0 && (
              <div className="sticky top-0 z-10 bg-primary/10 border-b-2 border-primary p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">
                    {t('adminSuggested.selected')} {selectedIds.size} {t('adminSuggested.questions')}
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {t('adminSuggested.clearSelection')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openBulkEditForm}
                    className="px-3 py-1.5 rounded-full bg-primary text-white font-bold text-xs border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">edit</span>
                      {t('adminSuggested.edit')} {selectedIds.size}
                    </span>
                  </button>
                  <button
                    onClick={handleBulkToggleActive}
                    className="px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">toggle_on</span>
                      {t('adminSuggested.toggle')}
                    </span>
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 rounded-full bg-red-500 text-white font-bold text-xs border border-slate-200 shadow-sm hover:shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">delete</span>
                      {t('adminSuggested.delete')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-black/10">
                  <tr>
                    {isSuperAdmin && (
                      <th className="text-left px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3">{t('adminSuggested.question')}</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">{t('adminSuggested.category')}</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">{t('adminSuggested.viewMode')}</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-20">{t('adminSuggested.language')}</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-16">{t('adminSuggested.order')}</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-16">{t('adminSuggested.status')}</th>
                    {isSuperAdmin && (
                      <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">{t('adminSuggested.actions')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuestions.map((q) => (
                    <tr key={q.id} className={clsx(
                      "border-b border-black/5 hover:bg-gray-50/50 transition-colors",
                      selectedIds.has(q.id) && "bg-primary/5"
                    )}>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id)}
                            onChange={() => toggleSelect(q.id)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="text-sm text-on-surface line-clamp-2">{q.question}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          ID: {q.id} {q.agent_id && `• Agent: ${q.agent_id}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-300 whitespace-nowrap shrink-0">
                          {getCategoryIcon(q.category)} {getCategoryLabelByLang(q.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0',
                          q.view_mode === 'at_specialist' 
                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                            : 'bg-green-100 text-green-700 border-green-300'
                        )}>
                          {getViewModeLabelByLang(q.view_mode)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium border border-gray-300 whitespace-nowrap shrink-0">
                          {getLanguageLabelByLang(q.language)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{q.sort_order}</td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => handleToggleActive(q)}
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-200 whitespace-nowrap shrink-0',
                              q.is_active === 1
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                            )}
                          >
                            {q.is_active === 1 ? t('adminSuggested.activeStatus') : t('adminSuggested.disabledStatus')}
                          </button>
                        ) : (
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0',
                            q.is_active === 1
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-gray-100 text-gray-500 border-gray-300'
                          )}>
                            {q.is_active === 1 ? t('adminSuggested.activeStatus') : t('adminSuggested.disabledStatus')}
                          </span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditForm(q)}
                              className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center border border-primary/30 transition-colors"
                              title={t('adminSuggested.edit')}
                            >
                              <span className="material-symbols-outlined text-xs">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              className="w-7 h-7 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center border border-red-300 transition-colors"
                              title={t('adminSuggested.delete')}
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-black/10">
                <p className="text-sm text-gray-600">
                  {t('admin.common.page')} {currentPage} / {totalPages} ({filteredQuestions.length} {t('adminSuggested.questions')})
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    ← {t('admin.common.previous')}
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    {t('admin.common.next')} →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ============== FORM MODAL ============== */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-white rounded-2xl border border-slate-300 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-on-surface">
                    {editingId ? t('adminSuggested.editQuestion') : t('adminSuggested.addQuestion')}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {editingId ? t('adminSuggested.updateInfo') : t('adminSuggested.createNew')}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="p-4 space-y-4"
            >
              {/* Category */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('adminSuggested.category')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ATCategory }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {getCategoryLabelByLang(c.value)}</option>
                  ))}
                </select>
              </div>

              {/* View Mode */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('adminSuggested.viewMode')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.view_mode}
                  onChange={(e) => setFormData(prev => ({ ...prev, view_mode: e.target.value as ViewMode }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {VIEW_MODES.map(v => (
                    <option key={v.value} value={v.value}>{getViewModeLabelByLang(v.value)}</option>
                  ))}
                </select>
              </div>

              {/* ⭐ Question - Only Vietnamese input with auto-translate info */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('adminSuggested.question')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder={t('adminSuggested.enterVietnameseQuestion')}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span className="font-bold">{t('adminSuggested.autoTranslateNote')}</span>
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1 ml-6">
                    {t('adminSuggested.autoTranslateHint')}
                  </p>
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('adminSuggested.order')}
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-gray-500 mt-1">{t('adminSuggested.orderHint')}</p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center border-2',
                    formData.is_active
                      ? 'bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-300 shadow-lg shadow-emerald-200'
                      : 'bg-gradient-to-br from-gray-200 to-slate-300 border-gray-300'
                  )}>
                    <span className={clsx(
                      'material-symbols-outlined text-lg',
                      formData.is_active ? 'text-white' : 'text-gray-500'
                    )}>
                      {formData.is_active ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{t('adminSuggested.questionActive')}</p>
                    <p className="text-xs text-gray-500">
                      {formData.is_active ? t('adminSuggested.activeDescription') : t('adminSuggested.inactiveDescription')}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-emerald-400 peer-checked:to-green-500 shadow-inner"></div>
                </label>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-bold text-xs hover:bg-gray-100 transition-colors shadow-sm"
              >
                {t('adminSuggested.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isTranslating}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isTranslating ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    {t('adminSuggested.translating')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    {t('adminSuggested.saveAutoTranslate')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== BULK FORM MODAL ============== */}
      {showBulkForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-white rounded-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[8px_8px_0px_0px_#000] flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-on-surface">
                    {bulkMode === 'add' ? t('adminSuggested.addMultiple') : t('adminSuggested.editMultiple')}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {bulkMode === 'add' 
                      ? `${t('adminSuggested.adding', { count: bulkQuestions.length })} - ${t('adminSuggested.canAddRemoveRows')}` 
                      : `${t('adminSuggested.editingSelected', { count: bulkQuestions.length })} ${t('adminSuggested.questionsSelected')}`}
                  </p>
                </div>
                <button
                  onClick={() => { setShowBulkForm(false); setBulkMode(null); setBulkQuestions([]); }}
                  className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            {/* Bulk Form Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 mb-2 px-2">
                <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">#</div>
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.category')}</div>
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.viewMode')}</div>
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.language')}</div>
                <div className="col-span-3 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.question')}</div>
                <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.order')}</div>
                <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">{t('adminSuggested.status')}</div>
              </div>

              {/* Question Rows */}
              <div className="space-y-2">
                {bulkQuestions.map((q, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded-lg border border-gray-200">
                    {/* Row Number */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-500">{index + 1}</span>
                      {bulkMode === 'add' && bulkQuestions.length > 1 && (
                        <button
                          onClick={() => removeBulkRow(index)}
                          className="ml-1 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"
                          title={t('adminSuggested.removeRow')}
                        >
                          <span className="material-symbols-outlined text-xs">remove</span>
                        </button>
                      )}
                    </div>

                    {/* Category */}
                    <div className="col-span-2">
                      <select
                        value={q.category}
                        onChange={(e) => updateBulkRow(index, 'category', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-black text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.icon} {getCategoryLabelByLang(c.value)}</option>
                        ))}
                      </select>
                    </div>

                    {/* View Mode */}
                    <div className="col-span-2">
                      <select
                        value={q.view_mode}
                        onChange={(e) => updateBulkRow(index, 'view_mode', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-black text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {VIEW_MODES.map(v => (
                          <option key={v.value} value={v.value}>{getViewModeLabelByLang(v.value)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Language */}
                    <div className="col-span-2">
                      <select
                        value={q.language}
                        onChange={(e) => updateBulkRow(index, 'language', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-black text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {LANGUAGES.map(l => (
                          <option key={l.value} value={l.value}>{l.flag} {getLanguageLabelByLang(l.value)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Question */}
                    <div className="col-span-3">
                      <textarea
                        value={q.question}
                        onChange={(e) => updateBulkRow(index, 'question', e.target.value)}
                        placeholder={t('adminSuggested.enterQuestionPlaceholder')}
                        rows={2}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-black text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Sort Order */}
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={q.sort_order}
                        onChange={(e) => updateBulkRow(index, 'sort_order', parseInt(e.target.value) || 0)}
                        min={0}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-black text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Active Toggle */}
                    <div className="col-span-1 flex items-center justify-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.is_active}
                          onChange={(e) => updateBulkRow(index, 'is_active', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-100 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-emerald-400 peer-checked:to-green-500 shadow-sm"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Row Button (only in add mode) */}
              {bulkMode === 'add' && (
                <button
                  onClick={addBulkRow}
                  className="mt-3 w-full py-2 rounded-lg border-2 border-dashed border-gray-400 text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  {t('adminSuggested.addRow')}
                </button>
              )}

              {/* Summary */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <span className="font-bold">{t('adminSuggested.totalQuestions')}:</span> {bulkQuestions.length} {t('adminSuggested.questions')}
                  • <span className="font-bold">{t('adminSuggested.activeCount')}:</span> {bulkQuestions.filter(q => q.is_active).length}
                  • <span className="font-bold">{t('adminSuggested.filled')}:</span> {bulkQuestions.filter(q => q.question.trim()).length} / {bulkQuestions.length}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowBulkForm(false); setBulkMode(null); setBulkQuestions([]); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-bold text-xs hover:bg-gray-100 transition-colors shadow-sm"
              >
                {t('adminSuggested.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-sm transition-all"
              >
                {bulkMode === 'add' ? `${t('adminSuggested.commonAdd')} ${bulkQuestions.length} ${t('adminSuggested.questions')}` : `${t('adminSuggested.update')} ${bulkQuestions.filter(q => q.id).length} ${t('adminSuggested.questions')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
