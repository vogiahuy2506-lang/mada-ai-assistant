import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, Save, Eye, X } from 'lucide-react';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import { translations, type Language } from '@/lib/translations';

interface PromptsEditorProps {
  onClose?: () => void;
}

const t = (key: string, lang: Language): string => {
  const typedTranslations = translations as Record<Language, Record<string, string>>;
  return typedTranslations[lang]?.[key] || typedTranslations.vi?.[key] || key;
};

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

export function PromptsEditor({ onClose }: PromptsEditorProps) {
  const { language } = useLanguageStore();

  // Main prompt content (what admin writes)
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preview states
  const [previewLang, setPreviewLang] = useState<string>('vi');
  const [previewMode, setPreviewMode] = useState<'endUser' | 'specialist'>('endUser');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load prompt on mount
  useEffect(() => {
    loadPrompt();
  }, []);

  // Load preview when language/mode changes
  useEffect(() => {
    if (showPreview) {
      loadPreview();
    }
  }, [previewLang, previewMode, showPreview, content]);

  async function loadPrompt() {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getSystemPrompt();
      if (result.success && result.data) {
        setContent(result.data.content);
        setOriginalContent(result.data.content);
        setUpdatedAt(result.data.updatedAt);
      } else {
        setError(result.error || 'Failed to load prompt');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const result = await adminApi.getSystemPromptPreview(previewLang, previewMode);
      if (result.success && result.data) {
        setPreviewContent(result.data.prompt);
      }
    } catch {
      // Silently fail preview
    }
    setLoadingPreview(false);
  }

  async function savePrompt() {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const result = await adminApi.updateSystemPrompt(content);
      if (result.success && result.data) {
        setOriginalContent(content);
        setUpdatedAt(result.data.updatedAt);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return t('prompt.neverSaved', language);
    try {
      return new Date(iso).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  const hasChanges = content !== originalContent;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-on-surface-variant">{t('prompt.loading', language)}</span>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
        <button onClick={loadPrompt} className="ml-4 underline">{t('prompt.retry', language)}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{t('prompt.title', language)}</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('prompt.subtitle', language)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all flex items-center gap-2 ${
              showPreview
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            {t('prompt.preview', language)}
          </button>
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

      {/* Info Box */}
      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>{t('prompt.howItWorks', language)}</strong><br />
          {t('prompt.howItWorksDesc', language)}
        </p>
      </div>

      {/* Main Editor Area */}
      <div className={`rounded-2xl border-2 transition-all ${hasChanges ? 'border-amber-400 bg-amber-50/30' : 'border-black/10 bg-white/60'}`}>
        <div className="p-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">
                  {t('prompt.modified', language)}
                </span>
              )}
              <span className="text-xs text-on-surface-variant">
                {(content || '').length} {t('prompt.characters', language)} • {(content || '').split(/\s+/).filter(Boolean).length} {t('prompt.words', language)}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {t('prompt.lastSaved', language)}: {formatDate(updatedAt)}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={16}
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300/50 font-mono text-sm resize-y focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder={t('prompt.enterPrompt', language)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30">
          <div className="p-4">
            <h4 className="font-bold text-indigo-800 mb-3">{t('prompt.previewTitle', language)}</h4>

            {/* Preview Controls */}
            <div className="flex flex-wrap gap-3 mb-4">
              {/* Language Tabs */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setPreviewLang(lang.code)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1 ${
                      previewLang === lang.code
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span className="hidden sm:inline">{lang.label}</span>
                  </button>
                ))}
              </div>

              {/* Mode Selector */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setPreviewMode('endUser')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    previewMode === 'endUser'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t('prompt.endUserMode', language)}
                </button>
                <button
                  onClick={() => setPreviewMode('specialist')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    previewMode === 'specialist'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t('prompt.specialistMode', language)}
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                  {previewContent || t('prompt.noPreview', language)}
                </pre>
              )}
            </div>

            <p className="text-xs text-indigo-600 mt-2">
              {t('prompt.previewNote', language)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        {error && (
          <div className="flex items-center text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center text-green-600 text-sm font-semibold">
            <CheckCircle className="w-4 h-4 mr-2" />
            {t('prompt.savedSuccess', language)}
          </div>
        )}
        {!error && !saveSuccess && <div />}

        <div className="flex gap-2">
          {hasChanges && (
            <button
              onClick={() => { setContent(originalContent); }}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm border-2 border-slate-300 hover:bg-slate-200 transition-colors"
            >
              {t('prompt.reset', language)}
            </button>
          )}
          <button
            onClick={savePrompt}
            disabled={saving || !hasChanges}
            className="px-6 py-2 rounded-xl bg-primary text-white font-semibold text-sm border border-slate-200 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('prompt.saving', language)}</>
            ) : (
              <><Save className="w-4 h-4" /> {t('prompt.save', language)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptsEditor;
