import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, RotateCcw, Save, Edit3, History, X, Zap, FileText } from 'lucide-react';
import { PromptValidator } from './PromptValidator';
import { PromptHistory } from './PromptHistory';
import { PromptTemplates } from './PromptTemplates';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import { translations, type Language } from '@/lib/translations';

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

// Translation helper
const t = (key: string, lang: Language): string => {
  // First try promptsEditor.* keys, then fall back to prompt.* keys
  const promptsEditorKey = 'promptsEditor.' + key.split('.')[1];
  const typedTranslations = translations as Record<Language, Record<string, string>>;
  return typedTranslations[lang]?.[promptsEditorKey] || typedTranslations[lang]?.[key] || typedTranslations.vi?.[promptsEditorKey] || typedTranslations.vi?.[key] || key;
};

export function PromptsEditor({ onClose }: PromptsEditorProps) {
  const { language } = useLanguageStore();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  
  // New UI states
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showValidator, setShowValidator] = useState<string | null>(null);

  // Load prompts
  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/admin/system-prompts', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          setError(t('prompt.sessionExpired', language));
        } else {
          setError(`${t('prompt.serverError', language)}: ${res.status}`);
        }
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.success && data.data) {
        const validPrompts = data.data.map((p: any) => ({
          key: p.key || p.id || '',
          name: p.name || 'Untitled',
          description: p.description || '',
          defaultValue: p.default_value || p.defaultValue || p.prompt || '',
          currentValue: p.current_value || p.currentValue || p.prompt || ''
        }));
        setPrompts(validPrompts);
      } else {
        setError(data.error || t('prompt.loadFailed', language));
      }
    } catch (e: any) {
      setError(e.message || t('prompt.networkError', language));
    }
    setLoading(false);
  }

  async function savePrompt(key: string) {
    setSaving(key);
    setSaveSuccess(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/system-prompts/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value: editValue })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `${t('prompt.serverError', language)}: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => 
          p.key === key ? { ...p, currentValue: editValue } : p
        ));
        setEditingKey(null);
        setShowValidator(null);
        setSaveSuccess(key);
        setTimeout(() => setSaveSuccess(null), 2000);
      } else {
        throw new Error(data.error || t('prompt.saveFailed', language));
      }
    } catch (e: any) {
      setError(e.message || t('prompt.networkError', language));
    }
    setSaving(null);
  }

  async function resetPrompt(key: string) {
    if (!confirm(t('prompt.confirmReset', language))) return;
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/system-prompts/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => 
          p.key === key ? { ...p, currentValue: p.defaultValue } : p
        ));
        if (editingKey === key) {
          setEditingKey(null);
          setEditValue('');
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(null);
  }

  async function resetAll() {
    if (!confirm(t('prompt.confirmResetAll', language))) return;
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(prev => prev.map(p => ({ ...p, currentValue: p.defaultValue })));
        setEditingKey(null);
        setEditValue('');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(prompt: Prompt) {
    setEditingKey(prompt.key);
    setEditValue((prompt.currentValue || '').toString());
    setShowValidator(prompt.key);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
    setShowValidator(null);
  }

  function hasChanges(prompt: Prompt): boolean {
    return prompt.currentValue !== prompt.defaultValue;
  }

  function applyTemplate(promptContent: string) {
    setEditValue(promptContent);
    setShowTemplates(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-on-surface-variant">{t('prompt.loading', language)}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
        <button onClick={loadPrompts} className="ml-4 underline">{t('prompt.retry', language)}</button>
      </div>
    );
  }

  const changedCount = prompts.filter(p => hasChanges(p)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{t('prompt.title', language)}</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('prompt.subtitle', language)} {changedCount > 0 && (
              <span className="text-amber-600 font-semibold">{changedCount} {t('prompt.changed', language)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all flex items-center gap-2 ${
              showTemplates 
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            {t('prompt.templates', language)}
          </button>
          {changedCount > 0 && (
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-sm border-2 border-red-300 hover:bg-red-200 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('prompt.resetAll', language)}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm border-2 border-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {t('prompt.close', language)}
            </button>
          )}
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="mb-6">
          <PromptTemplates 
            onSelectTemplate={(template) => {
              applyTemplate(template.prompt);
            }}
            onClose={() => setShowTemplates(false)}
            isInline
          />
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.map(prompt => {
          const isEditing = editingKey === prompt.key;
          const isSaving = saving === prompt.key;
          const isChanged = hasChanges(prompt);
          const isSuccess = saveSuccess === prompt.key;
          const showHistoryPanel = showHistory === prompt.key;

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-on-surface">{prompt.name}</h4>
                      {isChanged && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">
                          {t('prompt.modified', language)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                        {prompt.key}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1">{prompt.description}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowHistory(showHistoryPanel ? null : prompt.key)}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm border transition-colors flex items-center gap-1 ${
                          showHistoryPanel 
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                        title={t('prompt.viewHistory', language)}
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(prompt)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold text-sm border-2 border-primary/30 hover:bg-primary/20 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 inline mr-1" />
                        {t('prompt.edit', language)}
                      </button>
                      {isChanged && (
                        <button
                          onClick={() => resetPrompt(prompt.key)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm border border-slate-300 hover:bg-slate-200 transition-colors"
                          title={t('prompt.resetToDefault', language)}
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
                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center gap-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {t('prompt.applyTemplate', language)}
                        </button>
                        <button
                          onClick={() => setShowValidator(showValidator === prompt.key ? null : prompt.key)}
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs border transition-colors flex items-center gap-1 ${
                            showValidator === prompt.key
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {t('prompt.validatePrompt', language)}
                        </button>
                      </div>
                      <span className="text-xs text-on-surface-variant">
                        {(editValue ?? '').length} {t('prompt.characters', language)} • {(editValue ?? '').split(/\s+/).filter(Boolean).length} {t('prompt.words', language)}
                      </span>
                    </div>
                    
                    {/* Quick Templates Panel */}
                    {showTemplates && (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <p className="text-xs text-indigo-700 mb-2">
                          {t('prompt.selectTemplate', language)}
                        </p>
                        <PromptTemplates 
                          onSelectTemplate={(template) => {
                            applyTemplate(template.prompt);
                          }}
                          isInline
                        />
                      </div>
                    )}
                    
                    {/* Validator Panel */}
                    {showValidator === prompt.key && (
                      <div>
                        <PromptValidator 
                          prompt={editValue}
                          autoValidate={true}
                          minDelay={300}
                        />
                      </div>
                    )}
                    
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={12}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300/20 font-mono text-sm resize-y focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder={t('prompt.enterContent', language)}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{t('prompt.editing', language)}: {prompt.key}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm border-2 border-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          {t('prompt.cancel', language)}
                        </button>
                        <button
                          onClick={() => savePrompt(prompt.key)}
                          disabled={isSaving || editValue === prompt.currentValue}
                          className="px-4 py-2 rounded-xl bg-primary text-white font-semibold text-sm border border-slate-200 shadow-sm hover:-translate-y-0.5  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <><Loader2 className="w-4 h-4 inline animate-spin" /> {t('prompt.saving', language)}</>
                          ) : (
                            <><Save className="w-4 h-4 inline mr-1" /> {t('prompt.save', language)}</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {prompt.currentValue}
                      </pre>
                    </div>
                    
                    {/* History Panel */}
                    {showHistoryPanel && (
                      <div>
                        <PromptHistory 
                          promptId={prompt.key}
                          promptName={prompt.name}
                          onRestore={() => {
                            loadPrompts();
                            setShowHistory(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Success indicator */}
                {isSuccess && (
                  <div className="mt-3 flex items-center text-green-600 text-sm font-semibold bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('prompt.savedSuccess', language)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
        <h5 className="font-bold text-blue-800 mb-2">💡 {t('prompt.notes', language)}</h5>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• {t('prompt.note1', language)}</li>
          <li>• {t('prompt.note2', language)}</li>
          <li>• {t('prompt.note3', language)}</li>
          <li>• {t('prompt.note4', language)}</li>
          <li>• {t('prompt.note5', language)}</li>
          <li>• {t('prompt.note6', language)}</li>
        </ul>
      </div>
    </div>
  );
}

export default PromptsEditor;
