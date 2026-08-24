import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, RotateCcw, Save, Edit3 } from 'lucide-react';

interface Prompt {
  key: string;
  name: string;
  description: string;
  defaultValue: string;
  currentValue: string;
}

interface PromptsEditorProps {
  onClose?: () => void;
}

export function PromptsEditor({ onClose }: PromptsEditorProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load prompts
  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/prompts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(data.data);
      } else {
        setError(data.error || 'Failed to load prompts');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    }
    setLoading(false);
  }

  async function savePrompt(key: string) {
    setSaving(key);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/prompts/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ value: editValue })
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => 
          p.key === key ? { ...p, currentValue: editValue } : p
        ));
        setEditingKey(null);
        setSaveSuccess(key);
        setTimeout(() => setSaveSuccess(null), 2000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    }
    setSaving(null);
  }

  async function resetPrompt(key: string) {
    if (!confirm('Reset this prompt to default?')) return;
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/prompts/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => 
          p.key === key ? { ...p, currentValue: p.defaultValue } : p
        ));
        if (editingKey === key) {
          setEditingKey(null);
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(null);
  }

  async function resetAll() {
    if (!confirm('Reset ALL prompts to default? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => ({ ...p, currentValue: p.defaultValue })));
        setEditingKey(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(prompt: Prompt) {
    setEditingKey(prompt.key);
    setEditValue(prompt.currentValue);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  function hasChanges(prompt: Prompt): boolean {
    return prompt.currentValue !== prompt.defaultValue;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-on-surface-variant">Đang tải prompts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
        <button onClick={loadPrompts} className="ml-4 underline">Thử lại</button>
      </div>
    );
  }

  const changedCount = prompts.filter(p => hasChanges(p)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">System Prompts</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Chỉnh sửa prompt cho AI chatbot. {changedCount > 0 && (
              <span className="text-amber-600 font-semibold">{changedCount} prompt đã thay đổi</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {changedCount > 0 && (
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-sm border-2 border-red-300 hover:bg-red-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4 inline mr-1" />
              Reset All
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm border-2 border-slate-300 hover:bg-slate-200 transition-colors"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.map(prompt => {
          const isEditing = editingKey === prompt.key;
          const isSaving = saving === prompt.key;
          const isChanged = hasChanges(prompt);
          const isSuccess = saveSuccess === prompt.key;

          return (
            <div
              key={prompt.key}
              className={`rounded-2xl border-2 transition-all ${
                isChanged 
                  ? 'border-amber-400 bg-amber-50/50' 
                  : 'border-black/10 bg-white/60'
              }`}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-on-surface">{prompt.name}</h4>
                      {isChanged && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">
                          Modified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1">{prompt.description}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(prompt)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 inline mr-1" />
                        Sửa
                      </button>
                      {isChanged && (
                        <button
                          onClick={() => resetPrompt(prompt.key)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors"
                          title="Reset to default"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Enter prompt content..."
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-on-surface-variant">
                        {editValue.length} characters
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm border-2 border-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => savePrompt(prompt.key)}
                          disabled={isSaving || editValue === prompt.currentValue}
                          className="px-4 py-2 rounded-xl bg-primary text-white font-semibold text-sm border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <><Loader2 className="w-4 h-4 inline animate-spin" /> Đang lưu...</>
                          ) : (
                            <><Save className="w-4 h-4 inline mr-1" /> Lưu</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {prompt.currentValue}
                    </pre>
                  </div>
                )}

                {/* Success indicator */}
                {isSuccess && (
                  <div className="mt-2 flex items-center text-green-600 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Đã lưu thành công!
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
        <h5 className="font-bold text-blue-800 mb-2">💡 Lưu ý</h5>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Prompt thay đổi sẽ được tô vàng để dễ nhận biết</li>
          <li>• Reset về default sẽ xóa thay đổi hiện tại</li>
          <li>• "Reset All" sẽ khôi phục tất cả về mặc định</li>
          <li>• Thay đổi có hiệu lực ngay lập tức (không cần restart server)</li>
        </ul>
      </div>
    </div>
  );
}

export default PromptsEditor;
