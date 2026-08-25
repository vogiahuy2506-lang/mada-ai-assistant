import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Loader2, Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, FileText, X, AlertTriangle } from 'lucide-react';
import { adminApi } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { usePromptStore, type SystemPromptRow } from '@/stores';
import { useTranslation } from '@/lib/translations';

interface SystemPrompt extends SystemPromptRow {}

interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  language: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  // Shared store (same instance used by /admin/agents dropdown)
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
        // ⭐ Push lên shared store để /admin/agents dropdown thấy ngay
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
        upsertPromptStore(created); // ⭐ Đẩy lên shared store → /admin/agents thấy ngay
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
        upsertPromptStore(updated); // ⭐ sync shared store
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
      removePromptStore(id); // ⭐ sync shared store
      if (selectedPrompt?.id === id) {
        setSelectedPrompt(null);
        setIsEditing(false);
      }
    } else if (res.success === false) {
      // Backend may return { success: false, usingAgents, warning } on 409 — read raw
      // The `request` helper wraps everything in { success, data, error } so we need a second fetch
      const token = getAccessToken();
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
      upsertPromptStore(updated); // ⭐ sync shared store (giữ/cắt khỏi dropdown theo isActive)
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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
    >
      {/* Delete Warning Modal */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Không thể xóa Prompt</h3>
            </div>
            <p className="text-slate-600 mb-3">
              Prompt này đang được sử dụng bởi <strong>{deleteWarning.usingAgents.length} agent(s)</strong>:
            </p>
            <ul className="space-y-1 mb-4">
              {deleteWarning.usingAgents.map(a => (
                <li key={a.id} className="text-sm text-slate-700">• {a.name}</li>
              ))}
            </ul>
            <p className="text-sm text-slate-500 mb-4">
              Vui lòng gỡ prompt khỏi các agents trước khi xóa, hoặc xóa/deactivate agents liên quan.
            </p>
            <button
              onClick={() => setDeleteWarning(null)}
              className="w-full px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Toolbar: search + filters — full width, sticky */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-slate-800 shrink-0">Prompts</h2>
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
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
            Tạo mới
          </button>
        </div>

        {/* Filters row 1: Danh mục */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-slate-400 shrink-0">Danh mục:</span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
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

        {/* Filters row 2: Ngôn ngữ */}
        <div className="flex flex-wrap gap-2 items-center mt-2">
          <span className="text-xs font-medium text-slate-400 shrink-0">Ngôn ngữ:</span>
          <button
            onClick={() => setFilterLanguage('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterLanguage === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
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
      </div>

      <div className="flex gap-5 h-[calc(100vh-220px)]">
        {/* Left Panel - List */}
        <div className="w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* List */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Không có prompts nào</p>
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
                                SYSTEM
                              </span>
                            )}
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${catConfig.bg} ${catConfig.text}`}>
                              {CATEGORY_LABELS[prompt.category]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {langLabel} • {prompt.description || 'Không có mô tả'}
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
                <h2 className="text-lg font-bold text-slate-800">Tạo System Prompt mới</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    ID <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-400 font-normal ml-2">(slug, không trùng)</span>
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
                    Tên Prompt <span className="text-red-500">*</span>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mô tả</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Danh mục</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngôn ngữ</label>
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
                    Nội dung Prompt <span className="text-red-500">*</span>
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
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !newPrompt.id || !newPrompt.name || !newPrompt.prompt}
                  className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo mới'}
                </button>
              </div>
            </div>
          ) : selectedPrompt ? (
            isEditing ? (
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa Prompt</h2>
                  <button onClick={() => setIsEditing(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">ID</label>
                    <input
                      type="text"
                      value={selectedPrompt.id}
                      disabled
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Tên Prompt <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mô tả</label>
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Danh mục</label>
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
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngôn ngữ</label>
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
                      Nội dung Prompt <span className="text-red-500">*</span>
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
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editForm.name || !editForm.prompt}
                    className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu thay đổi'}
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
                          SYSTEM
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
                        {selectedPrompt.isActive ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(selectedPrompt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Chỉnh sửa
                      </button>
                      <button
                        onClick={() => handleDelete(selectedPrompt.id)}
                        disabled={selectedPrompt.isSystem}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={selectedPrompt.isSystem ? 'Không thể xóa prompt hệ thống' : 'Xóa prompt'}
                      >
                        <Trash2 className="w-4 h-4" />
                        Xóa
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 font-mono">{selectedPrompt.id}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả</h3>
                    <p className="text-slate-700">{selectedPrompt.description || 'Không có mô tả'}</p>
                  </div>
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nội dung Prompt</h3>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 leading-relaxed">
                        {selectedPrompt.prompt}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-6 text-xs text-slate-400 pt-2">
                    <span>Tạo: {formatDate(selectedPrompt.createdAt)}</span>
                    <span>Cập nhật: {formatDate(selectedPrompt.updatedAt)}</span>
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
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Chưa chọn Prompt nào</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Chọn một prompt từ danh sách bên trái để xem chi tiết
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Tạo Prompt mới
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
