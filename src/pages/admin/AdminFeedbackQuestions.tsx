import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken } from '@/lib/api';
import clsx from 'clsx';
import {
  ThumbsDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  GripVertical,
  Loader2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

type Language = 'vi' | 'en' | 'ar' | 'fr';

interface FeedbackQuestion {
  id: string;
  text_vi: string;
  text_en: string;
  text_ar: string;
  text_fr: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

const translations: Record<Language, Record<string, string>> = {
  vi: {
    title: 'Câu hỏi phản hồi tiêu cực',
    subtitle: 'Quản lý các lý do hiển thị khi người dùng nhấn nút Dislike',
    addNew: 'Thêm câu hỏi mới',
    editQuestion: 'Sửa câu hỏi',
    questionVi: 'Nội dung (Tiếng Việt) *',
    questionEn: 'Nội dung (English)',
    questionAr: 'Nội dung (العربية)',
    questionFr: 'Nội dung (Français)',
    icon: 'Icon',
    status: 'Trạng thái',
    active: 'Đang hoạt động',
    inactive: 'Không hoạt động',
    sortOrder: 'Thứ tự',
    actions: 'Hành động',
    save: 'Lưu',
    cancel: 'Hủy',
    delete: 'Xóa',
    confirmDelete: 'Bạn có chắc muốn xóa câu hỏi này?',
    success: 'Thành công!',
    error: 'Đã xảy ra lỗi',
    loading: 'Đang tải...',
    dragToReorder: 'Kéo để sắp xếp',
    noQuestions: 'Chưa có câu hỏi nào',
    addFirst: 'Thêm câu hỏi đầu tiên',
    questionPlaceholder: 'Nhập nội dung câu hỏi...',
  },
  en: {
    title: 'Negative Feedback Questions',
    subtitle: 'Manage the reasons shown when users click the Dislike button',
    addNew: 'Add new question',
    editQuestion: 'Edit question',
    questionVi: 'Content (Vietnamese) *',
    questionEn: 'Content (English)',
    questionAr: 'Content (العربية)',
    questionFr: 'Content (Français)',
    icon: 'Icon',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    sortOrder: 'Sort Order',
    actions: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this question?',
    success: 'Success!',
    error: 'An error occurred',
    loading: 'Loading...',
    dragToReorder: 'Drag to reorder',
    noQuestions: 'No questions yet',
    addFirst: 'Add the first question',
    questionPlaceholder: 'Enter question content...',
  },
  ar: {
    title: 'أسئلة التعليقات السلبية',
    subtitle: 'إدارة الأسباب المعروضة عندما ينقر المستخدمون على زر عدم الإعجاب',
    addNew: 'إضافة سؤال جديد',
    editQuestion: 'تعديل السؤال',
    questionVi: 'المحتوى (Tiếng Việt) *',
    questionEn: 'المحتوى (English)',
    questionAr: 'المحتوى (العربية) *',
    questionFr: 'المحتوى (Français)',
    icon: 'أيقونة',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    sortOrder: 'ترتيب',
    actions: 'إجراءات',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    confirmDelete: 'هل أنت متأكد أنك تريد حذف هذا السؤال؟',
    success: 'نجاح!',
    error: 'حدث خطأ',
    loading: 'جارٍ التحميل...',
    dragToReorder: 'اسحب لإعادة الترتيب',
    noQuestions: 'لا توجد أسئلة بعد',
    addFirst: 'أضف السؤال الأول',
    questionPlaceholder: 'أدخل محتوى السؤال...',
  },
  fr: {
    title: 'Questions de commentaires négatifs',
    subtitle: 'Gérer les raisons affichées lorsque les utilisateurs cliquent sur le bouton Je n\'aime pas',
    addNew: 'Ajouter une nouvelle question',
    editQuestion: 'Modifier la question',
    questionVi: 'Contenu (Tiếng Việt) *',
    questionEn: 'Contenu (English)',
    questionAr: 'Contenu (العربية)',
    questionFr: 'Contenu (Français) *',
    icon: 'Icône',
    status: 'Statut',
    active: 'Actif',
    inactive: 'Inactif',
    sortOrder: 'Ordre',
    actions: 'Actions',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    confirmDelete: 'Êtes-vous sûr de vouloir supprimer cette question?',
    success: 'Succès!',
    error: 'Une erreur est survenue',
    loading: 'Chargement...',
    dragToReorder: 'Glisser pour réorganiser',
    noQuestions: 'Pas encore de questions',
    addFirst: 'Ajouter la première question',
    questionPlaceholder: 'Entrez le contenu de la question...',
  },
};

const ICONS = [
  { id: 'alert-circle', label: 'Alert' },
  { id: 'target', label: 'Target' },
  { id: 'message-square', label: 'Message' },
  { id: 'plus-circle', label: 'Plus' },
];

export default function AdminFeedbackQuestions() {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    text_vi: '',
    text_en: '',
    text_ar: '',
    text_fr: '',
    icon: 'alert-circle',
    isActive: true,
    sortOrder: 0,
  });

  const language: Language = 'vi'; // Default to Vietnamese

  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      if (!token) {
        setError('Vui lòng đăng nhập để xem trang này');
        setLoading(false);
        return;
      }
      
      const res = await fetch('/api/chat/feedback/all-questions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        setError('Bạn không có quyền truy cập trang này');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Lỗi ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setQuestions(data.data);
      } else {
        throw new Error(data.error || 'Dữ liệu không hợp lệ');
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.text_vi.trim()) {
      setError(t('questionVi') + ' is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const token = getAccessToken();
      const url = editingId
        ? `/api/chat/feedback/questions/${editingId}`
        : '/api/chat/feedback/questions';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuccess(t('success'));
          setShowForm(false);
          setEditingId(null);
          resetForm();
          fetchQuestions();
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        const data = await res.json();
        setError(data.error || t('error'));
      }
    } catch (err) {
      console.error('Failed to save question:', err);
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (question: FeedbackQuestion) => {
    setFormData({
      text_vi: question.text_vi,
      text_en: question.text_en || '',
      text_ar: question.text_ar || '',
      text_fr: question.text_fr || '',
      icon: question.icon || 'alert-circle',
      isActive: question.isActive,
      sortOrder: question.sortOrder,
    });
    setEditingId(question.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const token = getAccessToken();
      const res = await fetch(`/api/chat/feedback/questions/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuccess(t('success'));
          fetchQuestions();
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
      setError(t('error'));
    }
  };

  const handleToggleActive = async (question: FeedbackQuestion) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/chat/feedback/questions/${question.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          is_active: !question.isActive,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          fetchQuestions();
        }
      }
    } catch (err) {
      console.error('Failed to toggle question:', err);
      setError(t('error'));
    }
  };

  const handleMoveOrder = async (question: FeedbackQuestion, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex((q) => q.id === question.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const targetQuestion = questions[targetIndex];

    try {
      const token = getAccessToken();

      // Swap sort orders
      await Promise.all([
        fetch(`/api/chat/feedback/questions/${question.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sort_order: targetQuestion.sortOrder }),
        }),
        fetch(`/api/chat/feedback/questions/${targetQuestion.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sort_order: question.sortOrder }),
        }),
      ]);

      fetchQuestions();
    } catch (err) {
      console.error('Failed to reorder questions:', err);
      setError(t('error'));
    }
  };

  const resetForm = () => {
    setFormData({
      text_vi: '',
      text_en: '',
      text_ar: '',
      text_fr: '',
      icon: 'alert-circle',
      isActive: true,
      sortOrder: questions.length + 1,
    });
  };

  const handleAddNew = () => {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  // Render icon based on icon name
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'alert-circle':
        return <AlertCircle className="w-4 h-4" />;
      case 'target':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case 'message-square':
        return <MessageSquare className="w-4 h-4" />;
      case 'plus-circle':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <AdminLayout
      titleKey=""
      subtitleKey=""
      showLayoutTitle={false}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <ThumbsDown className="w-5 h-5 text-red-600" />
              </div>
              {t('title')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0047ff] text-white rounded-xl font-semibold text-sm hover:bg-[#0037cc] transition-colors shadow-md shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            {t('addNew')}
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
            <Check className="w-5 h-5 text-emerald-600" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 text-red-600" />
            {error}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-800">
                  {editingId ? t('editQuestion') : t('addNew')}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setError('');
                  }}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Vietnamese */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('questionVi')}
                  </label>
                  <input
                    type="text"
                    value={formData.text_vi}
                    onChange={(e) => setFormData({ ...formData, text_vi: e.target.value })}
                    placeholder={t('questionPlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  />
                </div>

                {/* English */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('questionEn')}
                  </label>
                  <input
                    type="text"
                    value={formData.text_en}
                    onChange={(e) => setFormData({ ...formData, text_en: e.target.value })}
                    placeholder={t('questionPlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Arabic */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('questionAr')}
                  </label>
                  <input
                    type="text"
                    value={formData.text_ar}
                    onChange={(e) => setFormData({ ...formData, text_ar: e.target.value })}
                    placeholder={t('questionPlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                    dir="rtl"
                  />
                </div>

                {/* French */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('questionFr')}
                  </label>
                  <input
                    type="text"
                    value={formData.text_fr}
                    onChange={(e) => setFormData({ ...formData, text_fr: e.target.value })}
                    placeholder={t('questionPlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('icon')}
                  </label>
                  <div className="flex gap-2">
                    {ICONS.map((icon) => (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: icon.id })}
                        className={clsx(
                          'w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all',
                          formData.icon === icon.id
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-slate-200 hover:border-slate-300 text-slate-500'
                        )}
                        title={icon.label}
                      >
                        {renderIcon(icon.id)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-[#0047ff] text-white rounded-xl font-medium hover:bg-[#0037cc] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('loading')}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {t('save')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Questions Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0047ff]" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <ThumbsDown className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">{t('noQuestions')}</h3>
            <p className="text-sm text-slate-400 mb-4">{t('addFirst')}</p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0047ff] text-white rounded-xl font-medium text-sm hover:bg-[#0037cc] transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('addNew')}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">
                      {t('sortOrder')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t('questionVi').replace(' *', '')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                      {t('icon')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">
                      {t('status')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((question, index) => (
                    <tr key={question.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveOrder(question, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-medium text-slate-500 w-4 text-center">
                            {question.sortOrder}
                          </span>
                          <button
                            onClick={() => handleMoveOrder(question, 'down')}
                            disabled={index === questions.length - 1}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{question.text_vi}</p>
                          {question.text_en && (
                            <p className="text-xs text-slate-400 mt-0.5">{question.text_en}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          {renderIcon(question.icon)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(question)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                            question.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {question.isActive ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              {t('active')}
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              {t('inactive')}
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(question)}
                            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                            title={t('editQuestion')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
