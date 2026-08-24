import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Loader2, Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, FileText, X } from 'lucide-react';

interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['general', 'medical', 'legal', 'finance', 'support', 'sales', 'technical'];

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
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SystemPrompt>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'general',
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const demoPrompts: SystemPrompt[] = [
        {
          id: '1',
          name: 'Trợ lý Y tế',
          description: 'AI assistant cho tư vấn y tế',
          prompt: 'You are a medical assistant. Provide helpful health information...',
          category: 'medical',
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          name: 'Tư vấn Pháp lý',
          description: 'AI assistant cho tư vấn pháp lý',
          prompt: 'You are a legal advisor. Provide general legal information...',
          category: 'legal',
          isActive: true,
          createdAt: '2024-01-10T09:00:00Z',
          updatedAt: '2024-01-12T14:30:00Z',
        },
        {
          id: '3',
          name: 'Hỗ trợ Khách hàng',
          description: 'AI assistant cho hỗ trợ khách hàng',
          prompt: 'You are a customer support agent. Help customers with their inquiries...',
          category: 'support',
          isActive: false,
          createdAt: '2024-01-05T08:00:00Z',
          updatedAt: '2024-01-05T08:00:00Z',
        },
        {
          id: '4',
          name: 'Bot Bán hàng',
          description: 'AI assistant cho bán hàng',
          prompt: 'You are a sales assistant. Help customers find products...',
          category: 'sales',
          isActive: true,
          createdAt: '2024-01-01T12:00:00Z',
          updatedAt: '2024-01-20T16:45:00Z',
        },
      ];
      setPrompts(demoPrompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrompts = prompts.filter((p) => {
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreate = async () => {
    if (!newPrompt.name || !newPrompt.prompt) return;
    setSaving(true);
    try {
      const created: SystemPrompt = {
        id: Date.now().toString(),
        ...newPrompt,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setPrompts([created, ...prompts]);
      setShowCreate(false);
      setNewPrompt({ name: '', description: '', prompt: '', category: 'general' });
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
      setPrompts(prompts.map((p) =>
        p.id === selectedPrompt.id
          ? { ...p, ...editForm, updatedAt: new Date().toISOString() }
          : p
      ));
      setIsEditing(false);
      setSelectedPrompt(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa prompt này?')) return;
    setPrompts(prompts.filter((p) => p.id !== id));
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(null);
      setIsEditing(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    setPrompts(prompts.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() } : p
    ));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <AdminLayout title="System Prompts" titleEn="System Prompts">
      <div className="flex gap-5 h-[calc(100vh-120px)]">
        {/* Left Panel - List */}
        <div className="w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Danh sách Prompts</h2>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tạo mới
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white transition-colors"
              />
            </div>

            {/* Category Filter - Horizontal Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <button
                onClick={() => setFilterCategory('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
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
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterCategory === cat
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

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
                  return (
                    <div
                      key={prompt.id}
                      onClick={() => {
                        setSelectedPrompt(prompt);
                        setIsEditing(false);
                      }}
                      className={`group p-4 rounded-xl cursor-pointer transition-all border ${
                        selectedPrompt?.id === prompt.id
                          ? 'bg-primary/5 border-primary/30 shadow-sm'
                          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-slate-800 text-sm truncate">{prompt.name}</h3>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${catConfig.bg} ${catConfig.text}`}>
                              {CATEGORY_LABELS[prompt.category]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {prompt.description || 'Không có mô tả'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(prompt.id);
                          }}
                          className={`shrink-0 p-1 rounded transition-colors ${
                            prompt.isActive
                              ? 'text-emerald-500 hover:bg-emerald-50'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {prompt.isActive ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
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
            /* Create Form */
            <div className="flex-1 flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">Tạo System Prompt mới</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Danh mục</label>
                  <select
                    value={newPrompt.category}
                    onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
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
                  disabled={saving || !newPrompt.name || !newPrompt.prompt}
                  className="px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo mới'}
                </button>
              </div>
            </div>
          ) : selectedPrompt ? (
            isEditing ? (
              /* Edit Form */
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa Prompt</h2>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Danh mục</label>
                    <select
                      value={editForm.category || 'general'}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
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
              /* View Detail */
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-800">{selectedPrompt.name}</h2>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_CONFIG[selectedPrompt.category]?.bg || 'bg-slate-100'} ${CATEGORY_CONFIG[selectedPrompt.category]?.text || 'text-slate-600'}`}>
                        {CATEGORY_LABELS[selectedPrompt.category]}
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
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả</h3>
                    <p className="text-slate-700">{selectedPrompt.description || 'Không có mô tả'}</p>
                  </div>
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nội dung Prompt</h3>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
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
            /* Empty State */
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

export default AdminPrompts;
