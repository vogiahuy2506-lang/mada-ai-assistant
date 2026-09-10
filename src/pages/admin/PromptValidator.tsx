import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { adminApi } from './adminApi';

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
            <span className="text-xs">Đang kiểm tra...</span>
          </div>
        ) : result ? (
          <div className="flex items-center gap-1.5">
            {result.valid ? (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Hợp lệ</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Cần chỉnh sửa</span>
              </div>
            )}
            <span className="text-xs text-slate-400">
              ({result.stats.length} ký tự)
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
            {validating ? 'Đang kiểm tra...' : 
             result?.valid ? 'Prompt hợp lệ' : 
             result?.issues.some(i => i.severity === 'error') ? 'Có lỗi cần sửa' : 'Có cảnh báo'}
          </span>
        </div>
        
        {result && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{result.stats.length} ký tự</span>
            <span>•</span>
            <span>{result.stats.wordCount} từ</span>
            <span>•</span>
            <span>{result.stats.lineCount} dòng</span>
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
                  Type: {issue.type}
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
          <p className="text-sm text-emerald-700 font-medium">Prompt của bạn đã đạt chuẩn!</p>
          <p className="text-xs text-slate-500 mt-1">
            Tất cả quy tắc cơ bản đã được tuân thủ.
          </p>
        </div>
      )}

      {/* No result yet */}
      {!result && !validating && (
        <div className="p-6 text-center">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            Nhập nội dung prompt để kiểm tra
          </p>
        </div>
      )}
    </div>
  );
}

export default PromptValidator;
