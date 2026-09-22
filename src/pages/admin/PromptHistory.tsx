import { useState, useEffect } from 'react';
import { Loader2, History, RotateCcw, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import { translations, type Language } from '@/lib/translations';

// Translation helper hook
function usePromptHistoryTranslation() {
  const language = useLanguageStore((state) => state.language ?? 'vi') as Language;
  const t = (key: string, params?: Record<string, string | number>) => {
    let text = (translations[language]?.[key as keyof typeof translations[typeof language]] || translations.vi[key as keyof typeof translations.vi]) as string || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
  return { t, language };
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  prompt: string;
  change_summary: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  is_restored: boolean;
}

interface Props {
  promptId: string;
  promptName?: string;
  onRestore?: () => void;
  compact?: boolean;
}

export function PromptHistory({ promptId, onRestore, compact = false }: Props) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const { t, language } = usePromptHistoryTranslation();

  useEffect(() => {
    loadVersions();
  }, [promptId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPromptVersions(promptId);
      if (res.success && res.data) {
        setVersions(res.data as unknown as PromptVersion[]);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: PromptVersion) => {
    if (!confirm(t('promptHistory.restoreConfirm', { version: version.version }))) {
      return;
    }

    setRestoring(version.id);
    try {
      const res = await adminApi.restorePromptVersion(promptId, version.id);
      if (res.success && res.data) {
        const data = res.data as unknown as { message: string; restored_version: number; new_version: number };
        alert(t('promptHistory.restoreSuccess', { version: version.version, new_version: data.new_version }));
        loadVersions();
        onRestore?.();
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert(t('promptHistory.restoreError'));
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Use locale based on current language from store (reactive)
    const localeMap: Record<string, string> = {
      vi: 'vi-VN',
      en: 'en-US',
      ar: 'ar-SA',
      fr: 'fr-FR',
    };
    const lang = localeMap[language] || 'vi-VN';
    return date.toLocaleDateString(lang, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">{t('promptHistory.noHistory')}</p>
        <p className="text-xs text-slate-400 mt-1">
          {t('promptHistory.noHistoryHint')}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {versions.slice(0, 3).map((v) => (
          <div key={v.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">v{v.version}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{formatDate(v.created_at)}</span>
            </div>
            <button
              onClick={() => handleRestore(v)}
              disabled={restoring === v.id || v.is_restored}
              className="text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {t('promptHistory.restore')}
            </button>
          </div>
        ))}
        {versions.length > 3 && (
          <p className="text-xs text-slate-400 text-center">
            {t('promptHistory.moreVersions', { count: versions.length - 3 })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {t('promptHistory.versionHistory')}
          </span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs">
            {versions.length} {t('promptHistory.versions')}
          </span>
        </div>
        
        <button
          onClick={loadVersions}
          className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
          title={t('promptHistory.refresh')}
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Version List */}
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {versions.map((version, index) => {
          const isExpanded = expandedVersion === version.id;
          const isLatest = index === 0;
          
          return (
            <div key={version.id} className={`${version.is_restored ? 'bg-amber-50' : ''}`}>
              <div
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setExpandedVersion(isExpanded ? null : version.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isLatest ? 'bg-indigo-100 text-indigo-700' :
                        version.is_restored ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        v{version.version}
                        {isLatest && ` ${t('promptHistory.latest')}`}
                        {version.is_restored && ` ${t('promptHistory.restored')}`}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-600 line-clamp-1">
                      {version.change_summary || t('promptHistory.noDescription')}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(version.created_at)}
                      </span>
                      {version.created_by_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {version.created_by_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!isLatest && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(version);
                        }}
                        disabled={restoring === version.id}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {restoring === version.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        {t('promptHistory.restore')}
                      </button>
                    )}
                    
                    <button className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="px-4 pb-3">
                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {version.prompt}
                    </pre>
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{version.prompt.length} {t('promptHistory.characters')}</span>
                    <span>{version.prompt.split(/\s+/).length} {t('promptHistory.words')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PromptHistory;
