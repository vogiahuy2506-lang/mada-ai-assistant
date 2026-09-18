import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { useAuthStore } from '@/stores';
import { useTranslation } from '@/lib/translations';
import clsx from 'clsx';

// ============== TYPES ==============
type ATCategory = 'vision' | 'hearing' | 'mobility' | 'cognition' | 'communication' | 'daily_living' | 'education' | 'general';
type ViewMode = 'end_user' | 'at_specialist';
type Language = 'vi' | 'en' | 'ar' | 'fr';

interface SuggestedQuestion {
  id: string;
  agent_id: string | null;
  category: ATCategory;
  view_mode: ViewMode;
  language: Language;
  question: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ============== CONSTANTS ==============
const CATEGORIES: { value: ATCategory; label: string; icon: string }[] = [
  { value: 'vision', label: 'Thị giác', icon: '👁️' },
  { value: 'hearing', label: 'Thính giác', icon: '👂' },
  { value: 'mobility', label: 'Vận động', icon: '🦴' },
  { value: 'cognition', label: 'Nhận thức', icon: '🧠' },
  { value: 'communication', label: 'Giao tiếp', icon: '💬' },
  { value: 'daily_living', label: 'Sinh hoạt', icon: '🦽' },
  { value: 'education', label: 'Giáo dục', icon: '📋' },
  { value: 'general', label: 'Tổng quát', icon: '📦' },
];

const VIEW_MODES: { value: ViewMode; label: string; labelEn: string }[] = [
  { value: 'end_user', label: 'Người dùng', labelEn: 'End-User' },
  { value: 'at_specialist', label: 'Chuyên gia AT', labelEn: 'AT Specialist' },
];

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
];

// ============== MAIN COMPONENT ==============
export default function AdminSuggestedQuestions() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const { t } = useTranslation();

  // Data state
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<ATCategory | ''>('');
  const [filterViewMode, setFilterViewMode] = useState<ViewMode | ''>('');
  const [filterLanguage, setFilterLanguage] = useState<Language | ''>('');
  const [filterAgentId, setFilterAgentId] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: 'vision' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    language: 'vi' as Language,
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
        setError(questionsRes.error || 'Failed to load questions');
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
      language: 'vi',
      question: '',
      sort_order: 0,
      is_active: true,
    });
    setEditingId(null);
  };

  const openCreateForm = () => {
    if (!isSuperAdmin) return;
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (q: SuggestedQuestion) => {
    if (!isSuperAdmin) return;
    setFormData({
      category: q.category,
      view_mode: q.view_mode,
      language: q.language,
      question: q.question,
      sort_order: q.sort_order,
      is_active: q.is_active === 1,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.question.trim()) {
      alert('Vui lòng nhập câu hỏi');
      return;
    }

    try {
      if (editingId) {
        const res = await adminApi.updateSuggestedQuestion(editingId, {
          category: formData.category,
          view_mode: formData.view_mode,
          language: formData.language,
          question: formData.question,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        });
        if (!res.success) {
          alert(res.error || 'Lỗi cập nhật');
          return;
        }
      } else {
        const res = await adminApi.createSuggestedQuestion({
          category: formData.category,
          view_mode: formData.view_mode,
          language: formData.language,
          question: formData.question,
          sort_order: formData.sort_order,
        });
        if (!res.success) {
          alert(res.error || 'Lỗi tạo mới');
          return;
        }
      }

      setShowForm(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message);
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
    language: Language;
    question: string;
    sort_order: number;
    is_active: boolean;
  }>>([]);

  // Bulk form default template
  const getBulkDefaultRow = (index: number = 0) => ({
    category: 'vision' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    language: 'vi' as Language,
    question: '',
    sort_order: index * 10,
    is_active: true,
  });

  const openBulkAddForm = () => {
    if (!isSuperAdmin) return;
    setBulkMode('add');
    setBulkQuestions([getBulkDefaultRow(0)]);
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
      alert('Vui lòng nhập đầy đủ câu hỏi cho tất cả các dòng');
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
          alert(`Đã thêm ${res.data?.count || bulkQuestions.length} câu hỏi`);
        } else {
          alert(res.error || 'Lỗi khi thêm câu hỏi');
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
          alert(`Đã cập nhật ${res.data?.count || questionsToUpdate.length} câu hỏi`);
        } else {
          alert(res.error || 'Lỗi khi cập nhật câu hỏi');
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
    if (!confirm(`Bật/tắt trạng thái cho ${selectedIds.size} câu hỏi đã chọn?`)) return;

    try {
      const toggleValue = true; // Will toggle based on current state
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
      alert('Đã cập nhật trạng thái');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    if (!confirm(`Xóa ${selectedIds.size} câu hỏi đã chọn? Hành động này không thể hoàn tác.`)) return;

    try {
      const ids = Array.from(selectedIds);
      const res = await adminApi.deleteSuggestedQuestionsBulk(ids);
      if (res.success) {
        alert(`Đã xóa ${res.data?.count || selectedIds.size} câu hỏi`);
      } else {
        alert(res.error || 'Lỗi khi xóa câu hỏi');
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
    if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;

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
    if (!confirm('Import tất cả câu hỏi mặc định từ SAMPLE_QUESTIONS? Câu hỏi trùng lặp sẽ được thay thế.')) return;

    try {
      const res = await adminApi.importSuggestedQuestionDefaults();
      if (res.success) {
        alert(`Đã import ${res.data?.count || 0} câu hỏi mặc định`);
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getCategoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getCategoryIcon = (cat: string) => CATEGORIES.find(c => c.value === cat)?.icon || '📦';
  const getViewModeLabel = (mode: string) => VIEW_MODES.find(v => v.value === mode)?.label || mode;
  const getLanguageLabel = (lang: string) => LANGUAGES.find(l => l.value === lang)?.label || lang;

  return (
    <AdminLayout
      title="Câu hỏi gợi ý"
      titleEn="Suggested Questions"
      titleAr="الأسئلة المقترحة"
      titleFr="Questions suggérées"
      subtitle="Quản lý câu hỏi gợi ý cho Agent theo category, view mode và ngôn ngữ"
      subtitleEn="Manage suggested questions for agents by category, view mode and language"
      showLayoutTitle={false}
    >
      {/* Hero Section */}
      <section className="mb-6">
        <div className="bg-gradient-to-br from-primary/10 via-white to-secondary/10 backdrop-blur-xl rounded-2xl border-2 border-black p-5 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black text-on-surface mb-1">Quản lý Câu hỏi gợi ý</h2>
              <p className="text-sm text-on-surface-variant">
                Câu hỏi hiển thị cho người dùng khi bắt đầu chat với Agent
              </p>
            </div>
            {isSuperAdmin && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleImportDefaults}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Import Defaults
                </button>
                <button
                  onClick={openBulkAddForm}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Thêm nhiều câu hỏi
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-xl rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-600">quiz</span>
              <span className="text-xs font-bold text-blue-700 uppercase">Tổng cộng</span>
            </div>
            <h3 className="text-2xl font-black text-blue-700">{stats.total?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-xl rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <span className="text-xs font-bold text-green-700 uppercase">Đang hoạt động</span>
            </div>
            <h3 className="text-2xl font-black text-green-700">{stats.active?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-xl rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-purple-600">smart_toy</span>
              <span className="text-xs font-bold text-purple-700 uppercase">Agent riêng</span>
            </div>
            <h3 className="text-2xl font-black text-purple-700">{stats.agentSpecific?.count || 0}</h3>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 backdrop-blur-xl rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-amber-600">language</span>
              <span className="text-xs font-bold text-amber-700 uppercase">Ngôn ngữ</span>
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
      <section className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-gray-600">filter_list</span>
          <span className="text-sm font-bold text-gray-700">Bộ lọc</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value as ATCategory | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">View Mode</label>
            <select
              value={filterViewMode}
              onChange={(e) => { setFilterViewMode(e.target.value as ViewMode | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả</option>
              {VIEW_MODES.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngôn ngữ</label>
            <select
              value={filterLanguage}
              onChange={(e) => { setFilterLanguage(e.target.value as Language | ''); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả</option>
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Agent ID</label>
            <input
              type="text"
              value={filterAgentId}
              onChange={(e) => { setFilterAgentId(e.target.value); setCurrentPage(1); }}
              placeholder="Để trống = mặc định"
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            ✕ Xóa bộ lọc
          </button>
        )}
      </section>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-700">
          <p className="font-medium">{error}</p>
          <button onClick={loadData} className="mt-2 text-sm underline">Thử lại</button>
        </div>
      )}

      {/* Questions Table */}
      <section className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-black p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-on-surface">
              {loading ? 'Đang tải...' : `${filteredQuestions.length} câu hỏi`}
            </h3>
            <button onClick={loadData} className="text-xs text-primary hover:text-primary/80 font-medium">
              ↻ Làm mới
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#000] animate-pulse">
              <span className="material-symbols-outlined text-2xl text-gray-400">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">Đang tải...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-2xl text-gray-400">quiz</span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-1">Chưa có câu hỏi nào</h4>
            <p className="text-sm text-on-surface-variant mb-4">Thêm câu hỏi gợi ý mới hoặc import từ mặc định</p>
            {isSuperAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={handleImportDefaults}
                  className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                >
                  Import Defaults
                </button>
                <button
                  onClick={openBulkAddForm}
                  className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                >
                  Thêm nhiều câu hỏi
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
                    Đã chọn {selectedIds.size} câu hỏi
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Hủy chọn
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openBulkEditForm}
                    className="px-3 py-1.5 rounded-full bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">edit</span>
                      Sửa {selectedIds.size} câu hỏi
                    </span>
                  </button>
                  <button
                    onClick={handleBulkToggleActive}
                    className="px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">toggle_on</span>
                      Bật/Tắt
                    </span>
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 rounded-full bg-red-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">delete</span>
                      Xóa
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
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3">Câu hỏi</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">Category</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">View Mode</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-20">Ngôn ngữ</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-16">Thứ tự</th>
                    <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-16">Trạng thái</th>
                    {isSuperAdmin && (
                      <th className="text-left text-[10px] font-bold text-gray-500 uppercase px-4 py-3 w-24">Hành động</th>
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
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-300">
                          {getCategoryIcon(q.category)} {getCategoryLabel(q.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs font-bold border',
                          q.view_mode === 'at_specialist' 
                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                            : 'bg-green-100 text-green-700 border-green-300'
                        )}>
                          {getViewModeLabel(q.view_mode)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium border border-gray-300">
                          {getLanguageLabel(q.language)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{q.sort_order}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(q)}
                          disabled={!isSuperAdmin}
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-bold border transition-all',
                            q.is_active === 1
                              ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200',
                            !isSuperAdmin && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {q.is_active === 1 ? '✓ Active' : '✕ Disabled'}
                        </button>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditForm(q)}
                              className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center border border-primary/30 transition-colors"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-xs">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              className="w-7 h-7 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center border border-red-300 transition-colors"
                              title="Xóa"
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
                  Trang {currentPage} / {totalPages} ({filteredQuestions.length} câu hỏi)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border-2 border-black text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-[2px_2px_0px_0px_#000]"
                  >
                    ← Trước
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border-2 border-black text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-[2px_2px_0px_0px_#000]"
                  >
                    Sau →
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
          <div className="relative bg-white rounded-2xl border-2 border-black w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-on-surface">
                    {editingId ? 'Sửa Câu hỏi' : 'Thêm Câu hỏi mới'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {editingId ? 'Cập nhật thông tin câu hỏi' : 'Tạo câu hỏi gợi ý mới'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
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
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ATCategory }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>

              {/* View Mode */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  View Mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.view_mode}
                  onChange={(e) => setFormData(prev => ({ ...prev, view_mode: e.target.value as ViewMode }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {VIEW_MODES.map(v => (
                    <option key={v.value} value={v.value}>{v.label} ({v.labelEn})</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Ngôn ngữ <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as Language }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </div>

              {/* Question */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Câu hỏi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="VD: Phần mềm đọc màn hình nào tốt nhất cho người khiếm thị?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Thứ tự
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-gray-500 mt-1">Số nhỏ hơn sẽ hiển thị trước</p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Câu hỏi đang hoạt động
                </label>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all"
              >
                {editingId ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== BULK FORM MODAL ============== */}
      {showBulkForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-white rounded-2xl border-2 border-black w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[8px_8px_0px_0px_#000] flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-on-surface">
                    {bulkMode === 'add' ? 'Thêm nhiều Câu hỏi' : 'Sửa nhiều Câu hỏi'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {bulkMode === 'add' 
                      ? `Đang thêm ${bulkQuestions.length} câu hỏi - Có thể thêm hoặc bớt dòng` 
                      : `Đang sửa ${bulkQuestions.length} câu hỏi đã chọn`}
                  </p>
                </div>
                <button
                  onClick={() => { setShowBulkForm(false); setBulkMode(null); setBulkQuestions([]); }}
                  className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
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
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Category</div>
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">View Mode</div>
                <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Ngôn ngữ</div>
                <div className="col-span-3 text-[10px] font-bold text-gray-500 uppercase">Câu hỏi</div>
                <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">Thứ tự</div>
                <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">Active</div>
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
                          title="Xóa dòng này"
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
                          <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
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
                          <option key={v.value} value={v.value}>{v.label}</option>
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
                          <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Question */}
                    <div className="col-span-3">
                      <textarea
                        value={q.question}
                        onChange={(e) => updateBulkRow(index, 'question', e.target.value)}
                        placeholder="Nhập câu hỏi..."
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

                    {/* Active */}
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={q.is_active}
                        onChange={(e) => updateBulkRow(index, 'is_active', e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
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
                  Thêm dòng mới
                </button>
              )}

              {/* Summary */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <span className="font-bold">Tổng cộng:</span> {bulkQuestions.length} câu hỏi
                  • <span className="font-bold">Đang active:</span> {bulkQuestions.filter(q => q.is_active).length}
                  • <span className="font-bold">Đã nhập:</span> {bulkQuestions.filter(q => q.question.trim()).length} / {bulkQuestions.length}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowBulkForm(false); setBulkMode(null); setBulkQuestions([]); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all"
              >
                {bulkMode === 'add' ? `Thêm ${bulkQuestions.length} câu hỏi` : `Cập nhật ${bulkQuestions.filter(q => q.id).length} câu hỏi`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
