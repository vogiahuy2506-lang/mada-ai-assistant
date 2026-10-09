import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ThumbsDown, Check, AlertCircle, MessageSquare, ChevronDown } from 'lucide-react';
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
    title: 'Gửi phản hồi',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Vui lòng chọn lý do phản hồi tiêu cực:',
    detailsPlaceholder: 'Nhập phản hồi chi tiết của bạn tại đây...',
    saveToDashboard: 'Lưu vào Dashboard để theo dõi',
    submit: 'Gửi phản hồi',
    cancel: 'Hủy',
    chatbotResponse: 'Câu trả lời đang được phản hồi:',
    thankYou: 'Cảm ơn bạn đã phản hồi!',
    selectAtLeastOne: 'Vui lòng chọn ít nhất một lý do',
  },
  en: {
    title: 'Send Feedback',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Please select the reason for your negative feedback:',
    detailsPlaceholder: 'Enter your detailed feedback here...',
    saveToDashboard: 'Save to Dashboard for tracking',
    submit: 'Submit Feedback',
    cancel: 'Cancel',
    chatbotResponse: 'Chatbot response being replied to:',
    thankYou: 'Thank you for your feedback!',
    selectAtLeastOne: 'Please select at least one reason',
  },
  ar: {
    title: 'إرسال التعليق',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'الرجاء تحديد سبب التعليق السلبي:',
    detailsPlaceholder: 'أدخل تعليقك التفصيلي هنا...',
    saveToDashboard: 'حفظ إلى لوحة التحكم للتتبع',
    submit: 'إرسال التعليق',
    cancel: 'إلغاء',
    chatbotResponse: 'رد الشات بوت قيد التعليق:',
    thankYou: 'شكراً ل تعليقك!',
    selectAtLeastOne: 'الرجاء تحديد سبب واحد على الأقل',
  },
  fr: {
    title: 'Envoyer les commentaires',
    subtitle: 'MADA AI Assistant',
    reasonLabel: 'Veuillez sélectionner la raison de votre commentaire négatif:',
    detailsPlaceholder: 'Entrez vos commentaires détaillés ici...',
    saveToDashboard: 'Enregistrer dans le tableau de bord pour le suivi',
    submit: 'Soumettre les commentaires',
    cancel: 'Annuler',
    chatbotResponse: 'Réponse du chatbot étant répondue:',
    thankYou: 'Merci pour vos commentaires!',
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
            setQuestions(data.data);
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
      // Submit to backend
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
        onSubmit({
          selectedReasons,
          details,
          saveToDashboard,
        });

        // Close after showing thank you message
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('[DislikeFeedbackForm] Submit error:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render icon based on icon name
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'alert-circle':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'target':
        return (
          <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case 'message-square':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'plus-circle':
        return (
          <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      default:
        return <ChevronDown className="w-5 h-5 text-slate-400" />;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up overflow-hidden">
        {/* Header - Modern Gradient */}
        <div className="relative bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 px-5 py-4">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-20" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <ThumbsDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{t('title')}</h2>
                <p className="text-xs text-white/80">{t('subtitle')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {showThankYou ? (
            <div className="text-center py-10 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-teal-200/50">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">{t('thankYou')}</h3>
              <p className="text-sm text-slate-500">
                {language === 'vi' ? 'Phản hồi của bạn đã được ghi nhận!' :
                 language === 'en' ? 'Your feedback has been recorded!' :
                 language === 'ar' ? 'تم تسجيل تعليقك!' :
                 'Votre commentaire a été enregistré!'}
              </p>
            </div>
          ) : (
            <>
              {/* Reason Selection - Modern Pill Style */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  {t('reasonLabel')}
                </label>
                <div className="space-y-2">
                  {questions
                    .filter((q) => q.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((question) => {
                      const isSelected = selectedReasons.includes(question.id);
                      const isOther = question.id === 'other';

                      return (
                        <div
                          key={question.id}
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
                            'flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none',
                            isSelected
                              ? 'border-teal-400 bg-gradient-to-r from-teal-50 to-cyan-50 shadow-sm shadow-teal-100'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          {/* Custom Checkbox - Modern Circle */}
                          <div
                            className={clsx(
                              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200',
                              isSelected
                                ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-200'
                                : 'bg-slate-100 border-2 border-slate-300'
                            )}
                          >
                            {isSelected ? (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : null}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className={clsx(
                                'transition-colors duration-200',
                                isSelected ? 'text-teal-700' : 'text-slate-600'
                              )}>
                                {renderIcon(question.icon)}
                              </span>
                              <span
                                className={clsx(
                                  'text-sm font-medium',
                                  isSelected ? 'text-teal-700' : 'text-slate-600'
                                )}
                              >
                                {getQuestionText(question, language)}
                              </span>
                            </div>
                            {isOther && isSelected && (
                              <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder={t('detailsPlaceholder')}
                                className="w-full mt-3 p-3 text-sm border-2 border-teal-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 transition-all bg-white"
                                rows={2}
                                autoFocus
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Details Textarea (only if not "Other" selected) */}
              {!selectedReasons.includes('other') && (
                <div className="mb-4">
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={t('detailsPlaceholder')}
                    className="w-full p-3 text-sm border-2 border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 transition-all bg-slate-50/50"
                    rows={3}
                  />
                </div>
              )}

              {/* Save to Dashboard Toggle - Modern UI */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setSaveToDashboard(!saveToDashboard)}
                  className={clsx(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200',
                    saveToDashboard
                      ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border-secondary/30 hover:border-secondary/50'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {/* Left: Icon + Text */}
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                      saveToDashboard
                        ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-200'
                        : 'bg-slate-200'
                    )}>
                      <svg 
                        className={clsx(
                          'w-4.5 h-4.5 transition-colors duration-200',
                          saveToDashboard ? 'text-white' : 'text-slate-500'
                        )} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5"
                      >
                        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className={clsx(
                        'text-sm font-semibold transition-colors duration-200',
                        saveToDashboard ? 'text-teal-700' : 'text-slate-600'
                      )}>
                        {t('saveToDashboard')}
                      </p>
                      <p className={clsx(
                        'text-[11px] transition-colors duration-200',
                        saveToDashboard ? 'text-teal-500' : 'text-slate-400'
                      )}>
                        {language === 'vi' ? 'Theo dõi & cải thiện câu trả lời' :
                         language === 'en' ? 'Track & improve responses' :
                         language === 'ar' ? 'تتبع وتحسين الردود' :
                         'Suivre et améliorer les réponses'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Right: Toggle Switch */}
                  <div className={clsx(
                    'relative w-12 h-7 rounded-full transition-all duration-300',
                    saveToDashboard
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 shadow-lg shadow-teal-200/50'
                      : 'bg-slate-300'
                  )}>
                    <div className={clsx(
                      'absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300',
                      saveToDashboard
                        ? 'left-6 translate-x-0'
                        : 'left-1 -translate-x-0'
                    )}>
                      {saveToDashboard && (
                        <svg className="w-full h-full p-0.5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </p>
                </div>
              )}

              {/* Action Buttons - Modern Style */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || selectedReasons.length === 0}
                  className={clsx(
                    'flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200',
                    selectedReasons.length > 0
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-200 hover:shadow-xl hover:shadow-teal-300 active:scale-[0.98]'
                      : 'bg-slate-300 cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    t('submit')
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
