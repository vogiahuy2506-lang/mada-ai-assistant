import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';

interface ValidationIssue {
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    length: number;
    wordCount: number;
    lineCount: number;
    hasPlaceholders: number;
  };
}

interface Props {
  prompt: string;
  autoValidate?: boolean;
  minDelay?: number;
  compact?: boolean;
  onValidationChange?: (result: ValidationResult | null) => void;
}

export function PromptValidator({ prompt, autoValidate = true, minDelay = 500, compact = false, onValidationChange }: Props) {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [lastValidated, setLastValidated] = useState<string>('');
  const language = useLanguageStore((state) => state.language ?? 'vi') as 'vi' | 'en' | 'ar' | 'fr';

  // Translation helper
  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const translations: Record<string, Record<string, string>> = {
      vi: {
        validating: 'Đang kiểm tra...',
        valid: 'Hợp lệ',
        needsEdit: 'Cần chỉnh sửa',
        hasErrors: 'Có lỗi cần sửa',
        hasWarnings: 'Có cảnh báo',
        characters: 'ký tự',
        words: 'từ',
        lines: 'dòng',
        type: 'Loại',
        promptValid: 'Prompt hợp lệ',
        promptIsGood: 'Prompt của bạn đã đạt chuẩn!',
        allRulesFollowed: 'Tất cả quy tắc cơ bản đã được tuân thủ.',
        enterToValidate: 'Nhập nội dung prompt để kiểm tra',
        charactersCount: '{{count}} ký tự',
      },
      en: {
        validating: 'Validating...',
        valid: 'Valid',
        needsEdit: 'Needs edit',
        hasErrors: 'Has errors to fix',
        hasWarnings: 'Has warnings',
        characters: 'characters',
        words: 'words',
        lines: 'lines',
        type: 'Type',
        promptValid: 'Prompt is valid',
        promptIsGood: 'Your prompt is valid!',
        allRulesFollowed: 'All basic rules have been followed.',
        enterToValidate: 'Enter prompt content to validate',
        charactersCount: '{{count}} characters',
      },
      ar: {
        validating: 'جارٍ التحقق...',
        valid: 'صالح',
        needsEdit: 'يحتاج تعديل',
        hasErrors: 'يوجد أخطاء يجب إصلاحها',
        hasWarnings: 'يوجد تحذيرات',
        characters: 'حرف',
        words: 'كلمة',
        lines: 'سطر',
        type: 'النوع',
        promptValid: 'الوصف صالح',
        promptIsGood: 'الوصف الخاص بك صالح!',
        allRulesFollowed: 'تم اتباع جميع القواعد الأساسية.',
        enterToValidate: 'أدخل محتوى الوصف للتحقق',
        charactersCount: '{{count}} حرف',
      },
      fr: {
        validating: 'Validation en cours...',
        valid: 'Valide',
        needsEdit: 'Nécessite une modification',
        hasErrors: 'Des erreurs à corriger',
        hasWarnings: 'Des avertissements',
        characters: 'caractères',
        words: 'mots',
        lines: 'lignes',
        type: 'Type',
        promptValid: 'Le prompt est valide',
        promptIsGood: 'Votre prompt est valide!',
        allRulesFollowed: 'Toutes les règles de base ont été respectées.',
        enterToValidate: 'Entrez le contenu du prompt à valider',
        charactersCount: '{{count}} caractères',
      },
    };

    let text = translations[language]?.[key] || translations.vi[key] || key;
    
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    
    return text;
  };

  useEffect(() => {
    if (!autoValidate || !prompt) {
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      if (prompt !== lastValidated) {
        validatePrompt(prompt);
      }
    }, minDelay);

    return () => clearTimeout(timer);
  }, [prompt, autoValidate, minDelay]);

  const validatePrompt = async (content: string) => {
    if (!content.trim()) {
      setResult(null);
      onValidationChange?.(null);
      return;
    }

    setValidating(true);
    try {
      const res = await adminApi.validatePrompt(content);
      if (res.success && res.data) {
        setResult(res.data as unknown as ValidationResult);
        setLastValidated(content);
        onValidationChange?.(res.data as unknown as ValidationResult);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setValidating(false);
    }
  };

  if (!prompt) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {validating ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">{t('validating')}</span>
          </div>
        ) : result ? (
          <div className="flex items-center gap-1.5">
            {result.valid ? (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t('valid')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t('needsEdit')}</span>
              </div>
            )}
            <span className="text-xs text-slate-400">
              ({t('charactersCount', { count: result.stats.length })})
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            validating ? 'bg-slate-200' : 
            result?.valid ? 'bg-emerald-100' : 
            result?.issues.some(i => i.severity === 'error') ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            {validating ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
            ) : result?.valid ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            ) : result?.issues.some(i => i.severity === 'error') ? (
              <XCircle className="w-3.5 h-3.5 text-red-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>
          <span className="text-sm font-medium text-slate-700">
            {validating ? t('validating') : 
             result?.valid ? t('promptValid') : 
             result?.issues.some(i => i.severity === 'error') ? t('hasErrors') : t('hasWarnings')}
          </span>
        </div>
        
        {result && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{result.stats.length} {t('characters')}</span>
            <span>•</span>
            <span>{result.stats.wordCount} {t('words')}</span>
            <span>•</span>
            <span>{result.stats.lineCount} {t('lines')}</span>
          </div>
        )}
      </div>

      {/* Issues List */}
      {result && result.issues.length > 0 && (
        <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
          {result.issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                issue.severity === 'error' ? 'bg-red-50 border border-red-200' :
                issue.severity === 'warning' ? 'bg-amber-50 border border-amber-200' :
                'bg-blue-50 border border-blue-200'
              }`}
            >
              <div className={`shrink-0 mt-0.5 ${
                issue.severity === 'error' ? 'text-red-500' :
                issue.severity === 'warning' ? 'text-amber-500' :
                'text-blue-500'
              }`}>
                {issue.severity === 'error' ? (
                  <XCircle className="w-4 h-4" />
                ) : issue.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Info className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${
                  issue.severity === 'error' ? 'text-red-700' :
                  issue.severity === 'warning' ? 'text-amber-700' :
                  'text-blue-700'
                }`}>
                  {issue.message}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('type')}: {issue.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {result && result.issues.length === 0 && (
        <div className="p-6 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm text-emerald-700 font-medium">{t('promptIsGood')}</p>
          <p className="text-xs text-slate-500 mt-1">
            {t('allRulesFollowed')}
          </p>
        </div>
      )}

      {/* No result yet */}
      {!result && !validating && (
        <div className="p-6 text-center">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {t('enterToValidate')}
          </p>
        </div>
      )}
    </div>
  );
}

export default PromptValidator;
