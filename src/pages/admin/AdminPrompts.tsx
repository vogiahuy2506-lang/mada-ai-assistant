import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { Loader2, Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, FileText, X, AlertTriangle } from 'lucide-react';
import { adminApi } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { usePromptStore, useAuthStore, type SystemPromptRow } from '@/stores';
import { useTranslation } from '@/lib/translations';
import { PromptsEditor } from './PromptsEditor';
import { ChatCustomization } from './ChatCustomization';

type SystemPrompt = SystemPromptRow;

const CATEGORIES = ['general', 'medical', 'legal', 'finance', 'support', 'sales', 'technical'];
const LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Tổng quát',
  medical: 'Y tế',
  legal: 'Pháp lý',
  finance: 'Tài chính',
  support: 'Hỗ trợ',
  sales: 'Bán hàng',
  technical: 'Kỹ thuật',
};

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  medical: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  legal: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  finance: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  support: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  sales: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  technical: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  general: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
};

export function AdminPrompts() {
  const upsertPromptStore = usePromptStore((s) => s.upsertPrompt);
  const removePromptStore = usePromptStore((s) => s.removePrompt);
  const setStorePrompts = usePromptStore((s) => s.setPrompts);

  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SystemPrompt>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    id: '',
    name: '',
    description: '',
    prompt: '',
    category: 'general',
    language: 'vi',
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteWarning, setDeleteWarning] = useState<{ usingAgents: Array<{ id: string; name: string }> } | null>(null);

  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || 'admin';

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const res = await adminApi.getPrompts();
      if (res.success && res.data) {
        const list: SystemPrompt[] = (res.data as any[]).map((p: any) => ({
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
        }));
        setPrompts(list);
        setStorePrompts(list);
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrompts = prompts.filter((p) => {
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesLanguage = filterLanguage === 'all' || p.language === filterLanguage;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesLanguage && matchesSearch;
  });

  const handleCreate = async () => {
    if (!newPrompt.id || !newPrompt.name || !newPrompt.prompt) return;
    setSaving(true);
    try {
      const res = await adminApi.createPrompt({
        id: newPrompt.id.trim().toLowerCase().replace(/\s+/g, '-'),
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        language: newPrompt.language,
      });
      if (res.success && res.data) {
        const created: SystemPrompt = {
          id: (res.data as any).id,
          name: newPrompt.name,
          description: newPrompt.description || '',
          prompt: newPrompt.prompt,
          category: newPrompt.category,
          language: newPrompt.language,
          isActive: (res.data as any).isActive ?? true,
          isSystem: (res.data as any).isSystem ?? false,
          createdAt: (res.data as any).createdAt || '',
          updatedAt: (res.data as any).updatedAt || '',
        };
        setPrompts([created, ...prompts]);
        upsertPromptStore(created);
        setShowCreate(false);
        setNewPrompt({ id: '', name: '', description: '', prompt: '', category: 'general', language: 'vi' });
      }
    } catch (error) {
      console.error('Failed to create prompt:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setSelectedPrompt(prompt);
    setEditForm({ ...prompt });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedPrompt || !editForm.name || !editForm.prompt) return;
    setSaving(true);
    try {
      const res = await adminApi.updatePrompt(selectedPrompt.id, {
        name: editForm.name,
        description: editForm.description,
        prompt: editForm.prompt,
        category: editForm.category,
        language: editForm.language,
        is_active: editForm.isActive,
      });
      if (res.success && res.data) {
        const updated: SystemPrompt = {
          ...selectedPrompt,
          name: editForm.name!,
          description: editForm.description || '',
          prompt: editForm.prompt!,
          category: editForm.category || 'general',
          language: editForm.language || 'vi',
          isActive: (res.data as any).isActive ?? editForm.isActive ?? true,
          updatedAt: (res.data as any).updatedAt || '',
        };
        setPrompts(prompts.map((p) => p.id === selectedPrompt.id ? updated : p));
        setSelectedPrompt(updated);
        upsertPromptStore(updated);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    if (prompt.isSystem) {
      alert('Không thể xóa prompt hệ thống (system prompt).');
      return;
    }

    setDeleteWarning(null);
    const res = await adminApi.deletePrompt(id);
    if (res.success) {
      setPrompts(prompts.filter(p => p.id !== id));
      removePromptStore(id);
      if (selectedPrompt?.id === id) {
        setSelectedPrompt(null);
        setIsEditing(false);
      }
    } else if (res.success === false) {
      const token = getAccessToken();
      try {
        const raw = await fetch(`/api/admin/system-prompts/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const rawJson = await raw.json();
        if (rawJson.usingAgents && rawJson.usingAgents.length > 0) {
          setDeleteWarning({ usingAgents: rawJson.usingAgents });
        } else {
          alert(rawJson.error || res.error || 'Xóa thất bại');
        }
      } catch (e) {
        alert(res.error || 'Xóa thất bại');
      }
    } else {
      alert(res.error || 'Xóa thất bại');
    }
  };

  const handleToggleActive = async (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    const res = await adminApi.updatePrompt(id, { is_active: !prompt.isActive });
    if (res.success && res.data) {
      const updated: SystemPrompt = {
        ...prompt,
        isActive: (res.data as any).isActive ?? !prompt.isActive,
        updatedAt: (res.data as any).updatedAt || '',
      };
      setPrompts(prompts.map(p => p.id === id ? updated : p));
      if (selectedPrompt?.id === id) setSelectedPrompt(updated);
      upsertPromptStore(updated);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const navigate = useNavigate();
  const [showPromptsEditor, setShowPromptsEditor] = useState(false);
  const [showChatCustomization, setShowChatCustomization] = useState(false);
  const { t } = useTranslation();

  return (
    <AdminLayout
      title={t('admin.topBar.prompts')}
      titleEn="System Prompts"
      titleAr="التعليمات النظامية"
      titleFr="Prompts système"
      subtitle={t('admin.topBar.promptsSub')}
      subtitleEn="Manage system prompts used for AI Agents and RAG."
      subtitleAr="إدارة التعليمات النظامية المستخدمة للوكلاء و RAG."
      subtitleFr="Gérer les prompts système utilisés pour les agents IA et RAG."
      showLayoutTitle={false}
    >
      {/* Beautiful Banner */}
      <div className="relative overflow-hidden rounded-2xl mb-6 border border-slate-200 shadow-sm">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary/5" />
        
        {/* Content */}
        <div className="relative p-8 md:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Left: Title & Stats */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                {/* Icon Container */}
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-primary">edit_note</span>
                </div>
                
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                    {t('admin.prompts.title')}
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    {t('admin.prompts.subtitle')}
                  </p>
                </div>
              </div>
              
              {/* Stats Row */}
              <div className="flex flex-wrap gap-4 mt-6">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="material-symbols-outlined text-xl text-primary">format_list_bulleted</span>
                  <div>
                    <p className="text-slate-400 text-xs">{t('admin.prompts.totalPrompts')}</p>
                    <p className="text-slate-800 font-bold text-lg">{prompts.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="material-symbols-outlined text-xl text-green-500">check_circle</span>
                  <div>
                    <p className="text-slate-400 text-xs">{t('admin.prompts.active')}</p>
                    <p className="text-slate-800 font-bold text-lg">{prompts.filter(p => p.isActive).length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="material-symbols-outlined text-xl text-amber-500">smart_toy</span>
                  <div>
                    <p className="text-slate-400 text-xs">{t('admin.prompts.systemPrompts')}</p>
                    <p className="text-slate-800 font-bold text-lg">{prompts.filter(p => p.isSystem).length}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right: Quick Actions */}
            <div className="flex flex-col gap-3 lg:items-end">
              <button
                onClick={() => setShowCreate(true)}
                className="group flex items-center gap-3 px-6 py-3.5 bg-primary text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                {t('admin.prompts.createNew')}
                <span className="material-symbols-outlined text-xl opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate('/admin/settings?tab=templates')}
                className="flex items-center gap-2 px-5 py-2.5 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-xl">auto_awesome</span>
                {t('admin.prompts.promptTemplates')}
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom Decorative Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/50" />
      </div>

      {/* Delete Warning Modal */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('admin.prompts.cannotDeleteSystem')}</h3>
            </div>
            <p className="text-slate-600 mb-3">
              {t('admin.prompts.usedByAgents')} <strong>{deleteWarning.usingAgents.length} {t('admin.prompts.agents')}</strong>:
            </p>
            <ul className="space-y-1 mb-4">
              {deleteWarning.usingAgents.map(a => (
                <li key={a.id} className="text-sm text-slate-700">• {a.name}</li>
              ))}
            </ul>
            <p className="text-sm text-slate-500 mb-4">
              {t('admin.prompts.removeFirst')}
            </p>
            <button
              onClick={() => setDeleteWarning(null)}
              className="w-full px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              {t('admin.prompts.understood')}
            </button>
          </div>
        </div>
      )}

      {/* 3 Quick-Action Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* System DB */}
        <button
          onClick={() => navigate('/admin/settings?tab=system')}
          className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
            <span className="material-symbols-outlined text-2xl text-amber-500">storage</span>
          </div>
          <div>
            <p className="font-bold text-sm text-slate-800">{t('admin.prompts.systemDb')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('admin.prompts.systemDbDesc')}</p>
          </div>
        </button>

        {/* System Prompts */}
        <button
          onClick={() => setShowPromptsEditor(!showPromptsEditor)}
          className="relative group flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            backgroundColor: showPromptsEditor ? 'rgba(99,102,241,0.05)' : 'white',
            borderColor: showPromptsEditor ? 'rgba(99,102,241,0.4)' : '#e2e8f0',
            boxShadow: showPromptsEditor ? '0 0 0 3px rgba(99,102,241,0.1)' : undefined,
          }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{
            backgroundColor: showPromptsEditor ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
            border: `1px solid ${showPromptsEditor ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
          }}>
            <span className="material-symbols-outlined text-2xl" style={{ color: '#6366f1' }}>edit_note</span>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: showPromptsEditor ? '#6366f1' : '#1e293b' }}>
              {t('admin.prompts.systemPromptsBtn')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: showPromptsEditor ? 'rgba(99,102,241,0.6)' : '#94a3b8' }}>
              {showPromptsEditor ? t('admin.prompts.editing') : t('admin.prompts.systemPromptsBtnDesc')}
            </p>
          </div>
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{
            backgroundColor: showPromptsEditor ? '#6366f1' : 'transparent',
            boxShadow: showPromptsEditor ? '0 0 8px rgba(99,102,241,0.8)' : 'none',
          }}></div>
        </button>

        {/* Tùy chỉnh Chat */}
        <button
          onClick={() => setShowChatCustomization(!showChatCustomization)}
          className="relative group flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            backgroundColor: showChatCustomization ? 'rgba(14,165,233,0.05)' : 'white',
            borderColor: showChatCustomization ? 'rgba(14,165,233,0.4)' : '#e2e8f0',
            boxShadow: showChatCustomization ? '0 0 0 3px rgba(14,165,233,0.1)' : undefined,
          }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{
            backgroundColor: showChatCustomization ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.08)',
            border: `1px solid ${showChatCustomization ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.2)'}`,
          }}>
            <span className="material-symbols-outlined text-2xl" style={{ color: '#0ea5e9' }}>chat</span>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: showChatCustomization ? '#0ea5e9' : '#1e293b' }}>
              {t('admin.prompts.chatCustomization')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: showChatCustomization ? 'rgba(14,165,233,0.6)' : '#94a3b8' }}>
              {showChatCustomization ? t('admin.prompts.editing') : t('admin.prompts.chatCustomizationDesc')}
            </p>
          </div>
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{
            backgroundColor: showChatCustomization ? '#0ea5e9' : 'transparent',
            boxShadow: showChatCustomization ? '0 0 8px rgba(14,165,233,0.8)' : 'none',
          }}></div>
        </button>
      </div>

      {showPromptsEditor ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-primary">edit_note</span>
              System Prompts — Chỉnh sửa nhanh
            </h2>
            <button
              onClick={() => setShowPromptsEditor(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Đóng
            </button>
          </div>
          <div className="p-5">
            <PromptsEditor onClose={() => setShowPromptsEditor(false)} />
          </div>
        </div>
      ) : showChatCustomization ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ color: '#0ea5e9' }}>chat</span>
              {t('admin.prompts.chatCustomization')}
            </h2>
            <button
              onClick={() => setShowChatCustomization(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t('admin.prompts.cancel')}
            </button>
          </div>
          <div className="p-5">
            <ChatCustomization isInline userRole={userRole} onClose={() => setShowChatCustomization(false)} />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-col" style={{ height: 'calc(100vh - 340px)' }}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold text-slate-800 shrink-0">Prompts</h2>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('admin.prompts.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white transition-colors"
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('admin.prompts.createNew')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center shrink-0">
            <span className="text-xs font-medium text-slate-400 shrink-0">{t('admin.prompts.category')}:</span>
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('admin.prompts.all')}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center mt-2 shrink-0">
            <span className="text-xs font-medium text-slate-400 shrink-0">{t('admin.prompts.language')}:</span>
            <button
              onClick={() => setFilterLanguage('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterLanguage === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('admin.prompts.all')}
            </button>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setFilterLanguage(lang.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterLanguage === lang.value
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="border-t border-slate-100 my-3" />

          {/* Split View */}
          <div className="flex gap-5 flex-1 min-h-0 items-stretch overflow-hidden">
            {/* Left Panel - List */}
            <div className="w-[420px] shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                    <FileText className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">{t('admin.prompts.empty')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredPrompts.map((prompt) => {
                      const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.general;
                      const langLabel = LANGUAGES.find(l => l.value === prompt.language)?.label || prompt.language;
                      return (
                        <div
                          key={prompt.id}
                          onClick={() => { setSelectedPrompt(prompt); setIsEditing(false); setDeleteWarning(null); }}
                          className={`group p-4 rounded-xl cursor-pointer transition-all border ${
                            selectedPrompt?.id === prompt.id
                              ? 'bg-primary/5 border-primary/30 shadow-sm'
                              : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <h3 className="font-semibold text-slate-800 text-sm truncate">{prompt.name}</h3>
                                {prompt.isSystem && (
                                  <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                                    {t('admin.prompts.systemPrompt')}
                                  </span>
                                )}
                                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${catConfig.bg} ${catConfig.text}`}>
                                  {CATEGORY_LABELS[prompt.category]}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1">
                                {langLabel} • {prompt.description || t('admin.prompts.noDescription')}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleActive(prompt.id); }}
                              className={`shrink-0 p-1 rounded transition-colors ${
                                prompt.isActive
                                  ? 'text-emerald-500 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {prompt.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Detail/Edit */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              {showCreate ? (
                <div className="flex-1 flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">{t('admin.prompts.createNew')}</h2>
                    <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('admin.prompts.id')} <span className="text-red-500">*</span>
                        <span className="text-xs text-slate-400 font-normal ml-2">({t('admin.prompts.idSlug')})</span>
                      </label>
                      <input
                        type="text"
                        value={newPrompt.id}
                        onChange={(e) => setNewPrompt({ ...newPrompt, id: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                        placeholder="vd: my-custom-prompt"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('admin.prompts.promptName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPrompt.name}
                        onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="VD: Trợ lý Y tế"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.description')}</label>
                      <input
                        type="text"
                        value={newPrompt.description}
                        onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Mô tả ngắn về prompt này"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.category')}</label>
                        <select
                          value={newPrompt.category}
                          onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.language')}</label>
                        <select
                          value={newPrompt.language}
                          onChange={(e) => setNewPrompt({ ...newPrompt, language: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                        >
                          {LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('admin.prompts.promptContentReq')} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newPrompt.prompt}
                        onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                        className="w-full h-56 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono bg-slate-50"
                        placeholder="Nhập nội dung system prompt..."
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                    >
                      {t('admin.prompts.cancel')}
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={saving || !newPrompt.id || !newPrompt.name || !newPrompt.prompt}
                      className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.prompts.create')}
                    </button>
                  </div>
                </div>
              ) : selectedPrompt ? (
                isEditing ? (
                  <div className="flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-800">{t('admin.prompts.edit')}</h2>
                      <button onClick={() => setIsEditing(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.id')}</label>
                        <input
                          type="text"
                          value={selectedPrompt.id}
                          disabled
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t('admin.prompts.promptName')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.description')}</label>
                        <input
                          type="text"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.category')}</label>
                          <select
                            value={editForm.category || 'general'}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('admin.prompts.language')}</label>
                          <select
                            value={editForm.language || 'vi'}
                            onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                          >
                            {LANGUAGES.map((lang) => (
                              <option key={lang.value} value={lang.value}>{lang.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t('admin.prompts.promptContentReq')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={editForm.prompt || ''}
                          onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                          className="w-full h-56 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono bg-slate-50"
                        />
                      </div>
                    </div>
                    <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                      >
                        {t('admin.prompts.cancel')}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !editForm.name || !editForm.prompt}
                        className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.prompts.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl font-bold text-slate-800">{selectedPrompt.name}</h2>
                          {selectedPrompt.isSystem && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              {t('admin.prompts.systemPrompt')}
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_CONFIG[selectedPrompt.category]?.bg || 'bg-slate-100'} ${CATEGORY_CONFIG[selectedPrompt.category]?.text || 'text-slate-600'}`}>
                            {CATEGORY_LABELS[selectedPrompt.category]}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            {LANGUAGES.find(l => l.value === selectedPrompt.language)?.label || selectedPrompt.language}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            selectedPrompt.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {selectedPrompt.isActive ? t('admin.prompts.enabled') : t('admin.prompts.disabled')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(selectedPrompt)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            {t('admin.prompts.edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(selectedPrompt.id)}
                            disabled={selectedPrompt.isSystem}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={selectedPrompt.isSystem ? t('admin.prompts.systemCannotDelete') : t('admin.prompts.deleteConfirm')}
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('admin.prompts.deleteConfirm')}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 font-mono">{selectedPrompt.id}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="mb-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('admin.prompts.description')}</h3>
                        <p className="text-slate-700">{selectedPrompt.description || t('admin.prompts.noDescription')}</p>
                      </div>
                      <div className="mb-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('admin.prompts.promptContent')}</h3>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 leading-relaxed">
                            {selectedPrompt.prompt}
                          </pre>
                        </div>
                      </div>
                      <div className="flex gap-6 text-xs text-slate-400 pt-2">
                        <span>{t('admin.prompts.created')}: {formatDate(selectedPrompt.createdAt)}</span>
                        <span>{t('admin.prompts.updated')}: {formatDate(selectedPrompt.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-xs">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('admin.prompts.selectPrompt')}</h3>
                    <p className="text-sm text-slate-500 mb-4">
                      {t('admin.prompts.selectPromptDesc')}
                    </p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {t('admin.prompts.createNew')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminPrompts;
