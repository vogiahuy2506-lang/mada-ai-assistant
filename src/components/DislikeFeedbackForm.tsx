import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ThumbsDown, Check, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { Language } from '@/types';

interface FeedbackQuestion {
  id: string;
  text_vi: string;
  text_en: string;
  text_ar: string;
  text_fr: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

// Map API response to component interface
function mapApiQuestion(q: any): FeedbackQuestion {
  return {
    id: q.id,
    text_vi: q.text_vi || '',
    text_en: q.text_en || '',
    text_ar: q.text_ar || '',
    text_fr: q.text_fr || '',
    icon: q.icon || 'plus-circle',
    isActive: q.is_active === 1,
    sortOrder: q.sort_order || 0,
  };
}

interface DislikeFeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    selectedReasons: string[];
    details: string;
    saveToDashboard: boolean;
  }) => void;
  messageContent: string;
  language?: Language;
}

// Default feedback questions (fallback if API fails)
const DEFAULT_FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  {
    id: ' inaccurate',
    text_vi: 'Nội dung chưa chính xác hoặc thiếu dẫn chứng',
    text_en: 'Content is inaccurate or lacks evidence',
    text_ar: 'المحتوى غير دقيق أو يفتقر إلى أدلة',
    text_fr: 'Le contenu est inexact ou manque de preuves',
    icon: 'alert-circle',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'not_focused',
    text_vi: 'Chưa giải quyết đúng trọng tâm vấn đề',
    text_en: 'Does not address the main issue',
    text_ar: 'لا يعالج المشكلة الرئيسية',
    text_fr: 'Ne traite pas le problème principal',
    icon: 'target',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'too_complex',
    text_vi: 'Trả lời quá dài dòng hoặc từ ngữ chuyên môn khó hiểu',
    text_en: 'Response is too verbose or uses complex jargon',
    text_ar: 'الرد طويل جداً أو يستخدم مصطلحات معقدة',
    text_fr: 'La réponse est trop longue ou utilise un jargon complexe',
    icon: 'message-square',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'other',
    text_vi: 'Khác (Vui lòng ghi rõ bên dưới)',
    text_en: 'Other (Please specify below)',
    text_ar: 'أخرى (يرجى التحديد أدناه)',
    text_fr: 'Autre (Veuillez préciser ci-dessous)',
    icon: 'plus-circle',
    isActive: true,
    sortOrder: 4,
  },
];

// Get translated text for a question
function getQuestionText(question: FeedbackQuestion, lang: Language): string {
  const langMap: Record<Language, keyof FeedbackQuestion> = {
    vi: 'text_vi',
    en: 'text_en',
    ar: 'text_ar',
    fr: 'text_fr',
  };
  const text = question[langMap[lang]];
  return typeof text === 'string' ? text : question.text_vi;
}

// Translations for the form
const translations: Record<Language, Record<string, string>> = {
  vi: {
    title: 'Gửi góp ý chất lượng',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Vui lòng chọn lý do góp ý:',
    detailsPlaceholder: 'Mô tả thêm chi tiết (tùy chọn)...',
    saveToDashboard: 'Lưu vào Dashboard',
    saveToDashboardHint: 'Giúp đội ngũ theo dõi & cải thiện',
    submit: 'Gửi góp ý',
    cancel: 'Hủy bỏ',
    thankYou: 'Cảm ơn bạn đã góp ý!',
    selectAtLeastOne: 'Vui lòng chọn ít nhất một lý do',
  },
  en: {
    title: 'Send Quality Feedback',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Please select the reason for your feedback:',
    detailsPlaceholder: 'Add more details (optional)...',
    saveToDashboard: 'Save to Dashboard',
    saveToDashboardHint: 'Help the team track & improve',
    submit: 'Send Feedback',
    cancel: 'Cancel',
    thankYou: 'Thank you for your feedback!',
    selectAtLeastOne: 'Please select at least one reason',
  },
  ar: {
    title: 'إرسال تعليقات الجودة',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'الرجاء تحديد سبب التعليق:',
    detailsPlaceholder: 'إضافة تفاصيل إضافية (اختياري)...',
    saveToDashboard: 'حفظ إلى لوحة التحكم',
    saveToDashboardHint: 'مساعدة الفريق على التتبع والتحسين',
    submit: 'إرسال التعليق',
    cancel: 'إلغاء',
    thankYou: 'شكراً لتعليقك!',
    selectAtLeastOne: 'الرجاء تحديد سبب واحد على الأقل',
  },
  fr: {
    title: 'Envoyer des commentaires de qualité',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Veuillez sélectionner la raison du commentaire:',
    detailsPlaceholder: 'Ajouter plus de détails (facultatif)...',
    saveToDashboard: "Enregistrer dans le tableau de bord",
    saveToDashboardHint: "Aider l'équipe à suivre et améliorer",
    submit: "Soumettre le commentaire",
    cancel: 'Annuler',
    thankYou: 'Merci pour votre commentaire!',
    selectAtLeastOne: 'Veuillez sélectionner au moins une raison',
  },
};

export function DislikeFeedbackForm({
  isOpen,
  onClose,
  onSubmit,
  language = 'vi',
}: DislikeFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(DEFAULT_FEEDBACK_QUESTIONS);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [saveToDashboard, setSaveToDashboard] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [error, setError] = useState('');

  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  // Fetch feedback questions from API on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch('/api/chat/feedback/questions');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            const mappedQuestions = data.data
              .filter((q: any) => q.is_active === 1) // Only show active questions
              .map(mapApiQuestion)
              .sort((a: FeedbackQuestion, b: FeedbackQuestion) => a.sortOrder - b.sortOrder);
            if (mappedQuestions.length > 0) {
              setQuestions(mappedQuestions);
            }
          }
        }
      } catch (err) {
        console.warn('[DislikeFeedbackForm] Failed to fetch questions, using defaults:', err);
      }
    };
    fetchQuestions();
  }, []);

  // Lock body scroll when form is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedReasons([]);
      setDetails('');
      setSaveToDashboard(true);
      setShowThankYou(false);
      setError('');
    }
  }, [isOpen]);

  const handleReasonToggle = (reasonId: string) => {
    setSelectedReasons((prev) => {
      if (prev.includes(reasonId)) {
        return prev.filter((r) => r !== reasonId);
      }
      return [...prev, reasonId];
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (selectedReasons.length === 0) {
      setError(t('selectAtLeastOne'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 'dislike',
          selectedReasons,
          details,
          saveToDashboard,
          language,
        }),
      });

      if (res.ok) {
        setShowThankYou(true);
        onSubmit({ selectedReasons, details, saveToDashboard });
        setTimeout(() => { onClose(); }, 2000);
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('[DislikeFeedbackForm] Submit error:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main Card */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '90vh', overflow: 'hidden' }}
      >
        {/* ─── HEADER ─── */}
        <div className="relative px-5 pt-5 pb-4 flex-shrink-0">
          {/* Accent bar */}
          <div className="absolute top-0 left-6 right-6 h-1 bg-gradient-to-r from-red-400 via-rose-400 to-red-500 rounded-full" />

          <div className="flex items-start justify-between mt-1">
            {/* Left: icon + title */}
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                'bg-gradient-to-br from-red-400 to-rose-500'
              )}>
                <ThumbsDown className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-800 leading-snug">{t('title')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t('subtitle')}</p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                'transition-all duration-150 cursor-pointer'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── SCROLLABLE CONTENT ─── */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">

          {/* Reason selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 px-1">
              {t('reasonLabel')}
            </p>
            <div className="space-y-2">
              {questions
                .filter((q) => q.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((question) => {
                  const isSelected = selectedReasons.includes(question.id);
                  const isOther = question.id === 'other';

                  return (
                    <div key={question.id}>
                      {/* Option row */}
                      <div
                        onClick={() => handleReasonToggle(question.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleReasonToggle(question.id);
                          }
                        }}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none',
                          isSelected
                            ? 'border-red-400 bg-red-50 shadow-sm'
                            : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'
                        )}
                      >
                        {/* Checkbox - clean design */}
                        <div className={clsx(
                          'w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                          isSelected
                            ? 'bg-red-500 shadow-sm'
                            : 'bg-white border-2 border-slate-300'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>

                        {/* Label only - clean and simple */}
                        <span className={clsx(
                          'text-sm font-medium flex-1 leading-snug',
                          isSelected ? 'text-red-700' : 'text-slate-600'
                        )}>
                          {getQuestionText(question, language)}
                        </span>

                        {/* Small indicator for selected */}
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Details textarea (only for "Other") */}
                      {isOther && isSelected && (
                        <div className="mt-2 ml-8">
                          <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={t('detailsPlaceholder')}
                            className={clsx(
                              'w-full p-3 text-sm rounded-xl resize-none transition-all duration-150',
                              'border-2 border-red-200 bg-white',
                              'focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100'
                            )}
                            rows={2}
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Details textarea (for non-"Other" selections) */}
          {!selectedReasons.includes('other') && selectedReasons.length > 0 && (
            <div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t('detailsPlaceholder')}
                className={clsx(
                  'w-full p-3 text-sm rounded-xl resize-none transition-all duration-150',
                  'border-2 border-slate-200 bg-white',
                  'focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50'
                )}
                rows={2}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={clsx(
              'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm',
              'bg-red-50 border border-red-100 text-red-600'
            )}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        <div className="flex-shrink-0 px-5 pb-5 pt-1 space-y-3 border-t border-slate-100 mt-2">
          {/* Save to Dashboard toggle */}
          <button
            type="button"
            onClick={() => setSaveToDashboard(!saveToDashboard)}
            className={clsx(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-150 cursor-pointer',
              saveToDashboard
                ? 'border-red-200 bg-red-50/80'
                : 'border-slate-100 bg-slate-50/80 hover:border-slate-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150',
                saveToDashboard ? 'bg-gradient-to-br from-red-400 to-rose-500' : 'bg-slate-200'
              )}>
                <svg
                  className={clsx('w-4 h-4 transition-colors duration-150', saveToDashboard ? 'text-white' : 'text-slate-400')}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className="text-left">
                <p className={clsx('text-sm font-semibold', saveToDashboard ? 'text-red-700' : 'text-slate-600')}>
                  {t('saveToDashboard')}
                </p>
                <p className={clsx('text-[11px]', saveToDashboard ? 'text-red-400' : 'text-slate-400')}>
                  {t('saveToDashboardHint')}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <div className={clsx(
              'relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0',
              saveToDashboard ? 'bg-red-500' : 'bg-slate-300'
            )}>
              <div className={clsx(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200',
                saveToDashboard ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </div>
          </button>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={clsx(
                'px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 cursor-pointer',
                'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedReasons.length === 0}
              className={clsx(
                'flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 cursor-pointer',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selectedReasons.length > 0
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 active:scale-[0.98] shadow-lg shadow-red-200'
                  : 'bg-slate-200 text-slate-400'
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                t('submit')
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Thank you overlay */}
      {showThankYou && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{t('thankYou')}</h3>
            <p className="text-sm text-slate-500">
              {language === 'vi' ? 'Phản hồi của bạn đã được ghi nhận!' :
               language === 'en' ? 'Your feedback has been recorded!' :
               language === 'ar' ? 'تم تسجيل تعليقك!' :
               'Votre commentaire a été enregistré!'}
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
