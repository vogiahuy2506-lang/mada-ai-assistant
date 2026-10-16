import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ThumbsDown, Check, AlertCircle, MessageSquare, AlertTriangle, Target, PlusCircle, Frown, Clock, FileText, HelpCircle } from 'lucide-react';
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
    id: q.question_key || q.db_id,  // Use question_key as the identifier
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
  }) => void;
  messageContent: string;
  messageId: string;
  conversationId: string;
  language?: Language;
}

// Icon mapping for each question type
const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  'alert-circle': AlertTriangle,
  'target': Target,
  'message-square': MessageSquare,
  'plus-circle': PlusCircle,
  'frown': Frown,
  'clock': Clock,
  'file-text': FileText,
  'help-circle': HelpCircle,
};

// Get icon component by name
function getIconComponent(iconName: string) {
  return iconMap[iconName] || AlertCircle;
}

// Default feedback questions (fallback if API fails)
const DEFAULT_FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  {
    id: 'inaccurate',
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
  messageContent,
  messageId,
  conversationId,
  language = 'vi',
}: DislikeFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(DEFAULT_FEEDBACK_QUESTIONS);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
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
          console.log('[DislikeFeedbackForm] API response:', data);
          if (data.success && data.data && data.data.length > 0) {
            const mappedQuestions = data.data
              .filter((q: any) => q.is_active === 1) // Only show active questions
              .map(mapApiQuestion)
              .sort((a: FeedbackQuestion, b: FeedbackQuestion) => a.sortOrder - b.sortOrder);
            console.log('[DislikeFeedbackForm] Mapped questions:', mappedQuestions);
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
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          session_id: conversationId,
          rating: 'dislike',
          selectedReasons,
          details,
          language,
        }),
      });

      if (res.ok) {
        setShowThankYou(true);
        onSubmit({ selectedReasons, details });
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

  // Truncate message for preview
  const truncatedMessage = messageContent.length > 150 
    ? messageContent.substring(0, 150) + '...' 
    : messageContent;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main Card - Compact */}
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
      >
        {/* ─── HEADER ─── */}
        <div className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center">
              <ThumbsDown className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              {language === 'vi' ? 'Gửi góp ý' :
               language === 'en' ? 'Send Feedback' :
               language === 'ar' ? 'إرسال تعليق' :
               'Envoyer un commentaire'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── MESSAGE PREVIEW ─── */}
        {messageContent && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs text-slate-400 mb-1">
              {language === 'vi' ? 'Phản hồi cho:' :
               language === 'en' ? 'Feedback for:' :
               language === 'ar' ? 'تعليق على:' :
               'Commentaire pour:'}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
              {truncatedMessage}
            </p>
          </div>
        )}

        {/* ─── CONTENT ─── */}
        <div className="px-4 py-3 space-y-2">
          {/* Reason selection */}
          <div className="space-y-1.5">
            {questions
              .filter((q) => q.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((question) => {
                const isSelected = selectedReasons.includes(question.id);
                const isOther = question.id === 'other';
                const IconComponent = getIconComponent(question.icon);

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
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 select-none group',
                        isSelected
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                      )}
                    >
                      {/* Icon - smaller */}
                      <div className={clsx(
                        'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150',
                        isSelected
                          ? 'bg-red-500'
                          : 'bg-slate-200 group-hover:bg-slate-300'
                      )}>
                        <IconComponent 
                          className={clsx(
                            'w-3.5 h-3.5 transition-all duration-150',
                            isSelected ? 'text-white' : 'text-slate-500'
                          )} 
                          strokeWidth={2}
                        />
                      </div>

                      {/* Checkbox - smaller */}
                      <div className={clsx(
                        'w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150',
                        isSelected
                          ? 'bg-red-500 border-red-500'
                          : 'border-slate-300 bg-white group-hover:border-slate-400'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>

                      {/* Label */}
                      <span className={clsx(
                        'text-xs flex-1',
                        isSelected ? 'text-red-700 font-semibold' : 'text-slate-600'
                      )}>
                        {getQuestionText(question, language)}
                      </span>
                    </div>

                    {/* Details textarea (only for "Other") */}
                    {isOther && isSelected && (
                      <div className="mt-1.5 ml-9">
                        <textarea
                          value={details}
                          onChange={(e) => setDetails(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={t('detailsPlaceholder')}
                          className="w-full p-2.5 text-xs rounded-lg resize-none transition-all duration-150 bg-white border border-slate-200 focus:outline-none focus:border-red-300"
                          rows={2}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Details textarea (for non-"Other" selections) */}
          {!selectedReasons.includes('other') && selectedReasons.length > 0 && (
            <div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t('detailsPlaceholder')}
                className="w-full p-2.5 text-xs rounded-lg resize-none transition-all duration-150 bg-slate-50 border border-transparent focus:outline-none focus:border-slate-200 focus:bg-white"
                rows={2}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs bg-red-50 border border-red-200 text-red-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        <div className="px-4 pb-3 pt-2 flex gap-2.5">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedReasons.length === 0}
            className={clsx(
              'flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selectedReasons.length > 0
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 shadow-sm active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400'
            )}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {language === 'vi' ? 'Đang gửi...' : 'Sending...'}
              </>
            ) : (
              <>
                <ThumbsDown className="w-3.5 h-3.5" />
                {t('submit')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Thank you overlay */}
      {showThankYou && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
        >
          <div className="bg-white rounded-xl shadow-2xl px-6 py-5 text-center animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 border-4 border-emerald-200 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('thankYou')}</h3>
            <p className="text-xs text-slate-500">
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
