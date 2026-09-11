import { useState, useEffect } from 'react';
import { useChatSettingsStore, type SuggestedPrompt } from '@/stores';
import type { Language } from '@/types';
import { CheckCircle, Loader2, AlertCircle, Shield, Bot as BotIcon } from 'lucide-react';
import { EmotionCustomization } from './EmotionCustomization';

const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'vi', label: 'Tiếng Việt' },
  { key: 'en', label: 'English' },
  { key: 'ar', label: 'العربية' },
  { key: 'fr', label: 'Français' },
];

const ICON_OPTIONS = [
  'description', 'accessibility', 'translate', 'lightbulb', 
  'search', 'visibility', 'hearing', 'rule', 'science',
  'medical_services', 'psychology', 'school', 'work', 'code'
];

interface ChatCustomizationProps {
  language?: Language;
  userRole?: 'admin' | 'superadmin' | 'super_admin' | 'user';
  isInline?: boolean;
  onClose?: () => void;
}

export function ChatCustomization({ language = 'vi', userRole = 'admin', isInline = false, onClose }: ChatCustomizationProps) {
  // Check both 'superadmin' (DB) and 'super_admin' (code) for backward compatibility
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin';
  
  const {
    greeting,
    description,
    fileAttachmentEnabled,
    suggestedPrompts,
    aiInstructions,
    isLoading,
    loadFromBackend,
    updateSettings,
    saveToBackend,
    saveAiInstructions,
    isSavingAi,
  } = useChatSettingsStore();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadFromBackend();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveToBackend();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const updateGreeting = (lang: Language, value: string) => {
    updateSettings({ greeting: { ...greeting, [lang]: value } });
  };

  const updateDescription = (lang: Language, value: string) => {
    updateSettings({ description: { ...description, [lang]: value } });
  };

  const updatePrompt = (index: number, field: keyof SuggestedPrompt, value: string) => {
    const updated = [...suggestedPrompts];
    updated[index] = { ...updated[index], [field]: value };
    updateSettings({ suggestedPrompts: updated });
  };

  const t = {
    vi: {
      title: 'Tùy chỉnh Chat',
      subtitle: 'Thay đổi lời chào, mô tả và cách AI trả lời.',
      tabs: { ui: 'Giao diện', ai: 'Hành vi AI' },
      greeting: { title: 'Lời chào & Mô tả', greetingLabel: 'Lời chào', descLabel: 'Mô tả' },
      prompts: { title: 'Prompts gợi ý', hint: 'Các nút quick action trên trang chat', textLabel: 'Tiêu đề', descLabel: 'Mô tả', iconLabel: 'Icon' },
      feature: { title: 'Tính năng', fileAttachment: 'Đính kèm file' },
      ai: {
        title: 'Cài đặt AI',
        subtitle: 'Thay đổi cách AI trả lời, phong cách và cảm xúc. Chỉ Super Admin mới có quyền sửa.',
        notSuperAdmin: 'Bạn không có quyền thay đổi. Liên hệ Super Admin.',
        coreIdentity: 'Danh tính AI',
        coreIdentityDesc: 'Định nghĩa AI là ai, vai trò, ngôn ngữ giao tiếp mặc định.',
        responseFormat: 'Định dạng trả lời',
        responseFormatDesc: 'Quy tắc về cách AI trả lời: danh sách, bảng, đoạn văn...',
        behaviorRules: 'Quy tắc ứng xử',
        behaviorRulesDesc: 'Các quy tắc AI cần tuân thủ khi trả lời người dùng.',
        tone: 'Giọng văn',
        toneDesc: 'Phong cách giao tiếp của AI.',
        emotion: 'Cảm xúc AI',
        emotionDesc: 'Tùy chỉnh phong cách và cường độ cảm xúc.',
        disclaimer: 'Lưu ý: Thay đổi cần cẩn thận để tránh ảnh hưởng chất lượng trả lời.',
        saved: 'Đã lưu!',
      },
      save: 'Lưu thay đổi',
      saving: 'Đang lưu...',
      saved: 'Đã lưu!',
      error: 'Lưu thất bại',
    },
    en: {
      title: 'Chat Customization',
      subtitle: 'Change greeting, description and how AI responds.',
      tabs: { ui: 'Interface', ai: 'AI Behavior' },
      greeting: { title: 'Greeting & Description', greetingLabel: 'Greeting', descLabel: 'Description' },
      prompts: { title: 'Suggested Prompts', hint: 'Quick action buttons on chat page', textLabel: 'Title', descLabel: 'Description', iconLabel: 'Icon' },
      feature: { title: 'Features', fileAttachment: 'File Attachment' },
      ai: {
        title: 'AI Settings',
        subtitle: 'Change how AI responds, style and emotions. Only Super Admin can edit.',
        notSuperAdmin: 'You do not have permission. Contact Super Admin.',
        coreIdentity: 'AI Identity',
        coreIdentityDesc: 'Define who the AI is, role, and default communication language.',
        responseFormat: 'Response Format',
        responseFormatDesc: 'Rules about how AI responds: lists, tables, paragraphs...',
        behaviorRules: 'Behavior Rules',
        behaviorRulesDesc: 'Rules the AI must follow when responding to users.',
        tone: 'Tone of Voice',
        toneDesc: 'Communication style of the AI.',
        emotion: 'AI Emotions',
        emotionDesc: 'Customize style and emotional intensity.',
        disclaimer: 'Note: Changes should be made carefully to avoid affecting response quality.',
        saved: 'Saved!',
      },
      save: 'Save Changes',
      saving: 'Saving...',
      saved: 'Saved!',
      error: 'Save failed',
    },
    ar: {
      title: 'تخصيص المحادثة',
      subtitle: 'تغيير التحية والوصف وكيفية استجابة الذكاء.',
      tabs: { ui: 'الواجهة', ai: 'سلوك الذكاء' },
      greeting: { title: 'التحية والوصف', greetingLabel: 'التحية', descLabel: 'الوصف' },
      prompts: { title: 'العبارات المقترحة', hint: 'أزرار الإجراءات السريعة', textLabel: 'العنوان', descLabel: 'الوصف', iconLabel: 'الأيقونة' },
      feature: { title: 'الميزات', fileAttachment: 'إرفاق الملفات' },
      ai: {
        title: 'إعدادات الذكاء',
        subtitle: 'تغيير كيفية استجابة الذكاء. المشرف الأعلى فقط.',
        notSuperAdmin: 'ليس لديك إذن. اتصل بالمشرف الأعلى.',
        coreIdentity: 'هوية الذكاء',
        coreIdentityDesc: 'حدد من هو الذكاء الاصطناعي.',
        responseFormat: 'تنسيق الاستجابة',
        responseFormatDesc: 'قواعد حول كيفية الاستجابة.',
        behaviorRules: 'قواعد السلوك',
        behaviorRulesDesc: 'القواعد التي يجب على الذكاء الاصطناعي اتباعها.',
        tone: 'نبرة الصوت',
        toneDesc: 'أسلوب الاتصال.',
        emotion: 'مشاعر الذكاء',
        emotionDesc: 'تخصيص الأسلوب والشعور.',
        disclaimer: 'ملاحظة: يجب إجراء التغييرات بعناية.',
        saved: 'تم الحفظ!',
      },
      save: 'حفظ التغييرات',
      saving: 'جاري الحفظ...',
      saved: 'تم الحفظ!',
      error: 'فشل الحفظ',
    },
    fr: {
      title: 'Personnalisation du Chat',
      subtitle: 'Modifier la salutation et comment IA répond.',
      tabs: { ui: 'Interface', ai: 'Comportement IA' },
      greeting: { title: 'Salutation et Description', greetingLabel: 'Salutation', descLabel: 'Description' },
      prompts: { title: 'Prompts suggérés', hint: "Boutons d'action rapide", textLabel: 'Titre', descLabel: 'Description', iconLabel: 'Icône' },
      feature: { title: 'Fonctionnalités', fileAttachment: 'Pièces jointes' },
      ai: {
        title: "Paramètres de l'IA",
        subtitle: "Changer comment l'IA répond. Seul le Super Admin peut modifier.",
        notSuperAdmin: "Vous n'avez pas la permission. Contactez le Super Admin.",
        coreIdentity: 'Identité IA',
        coreIdentityDesc: "Définissez qui est l'IA.",
        responseFormat: "Format de réponse",
        responseFormatDesc: "Règles sur la façon dont l'IA répond.",
        behaviorRules: 'Règles de comportement',
        behaviorRulesDesc: "Règles que l'IA doit suivre.",
        tone: 'Ton de voix',
        toneDesc: "Style de communication.",
        emotion: 'Émotions IA',
        emotionDesc: 'Personnaliser le style émotionnel.',
        disclaimer: "Note: Les modifications doivent être effectuées avec soin.",
        saved: "Enregistré!",
      },
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      saved: 'Enregistré!',
      error: 'Échec',
    },
  };

  const lang = t[language] || t.vi;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{lang.title}</h3>
          <p className="text-sm text-on-surface-variant mt-1">{lang.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {lang.saving}</>
            ) : saveSuccess ? (
              <><CheckCircle className="w-4 h-4" /> {lang.saved}</>
            ) : (
              lang.save
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {saveError}
        </div>
      )}

      {/* Permission Warning */}
      {!isSuperAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-800">{lang.ai.notSuperAdmin}</p>
          </div>
        </div>
      )}

      {/* Section 1: Lời chào & Mô tả */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">👋</span>
          <h4 className="font-bold text-on-surface">{lang.greeting.title}</h4>
        </div>
        
        <div className="space-y-4">
          {LANGUAGES.map((langOption) => (
            <div key={langOption.key} className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                {langOption.label} - {lang.greeting.greetingLabel}
              </label>
              <input
                type="text"
                value={greeting[langOption.key]}
                onChange={(e) => updateGreeting(langOption.key, e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={`Hello! I am MADA AI.`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Mô tả */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <h4 className="font-bold text-on-surface mb-4">{lang.greeting.descLabel}</h4>
        
        <div className="space-y-4">
          {LANGUAGES.map((langOption) => (
            <div key={langOption.key} className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                {langOption.label} - {lang.greeting.descLabel}
              </label>
              <textarea
                value={description[langOption.key]}
                onChange={(e) => updateDescription(langOption.key, e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={`I can help you...`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Prompts gợi ý */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">⚡</span>
          <h4 className="font-bold text-on-surface">{lang.prompts.title}</h4>
        </div>
        <p className="text-sm text-on-surface-variant mb-4">{lang.prompts.hint}</p>
        
        <div className="space-y-4">
          {suggestedPrompts.map((prompt, index) => (
            <div key={index} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">Prompt {index + 1}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">VI - {lang.prompts.textLabel}</label>
                  <input
                    type="text"
                    value={prompt.text}
                    onChange={(e) => updatePrompt(index, 'text', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">EN - {lang.prompts.textLabel}</label>
                  <input
                    type="text"
                    value={prompt.textEn}
                    onChange={(e) => updatePrompt(index, 'textEn', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">VI - {lang.prompts.descLabel}</label>
                  <input
                    type="text"
                    value={prompt.desc}
                    onChange={(e) => updatePrompt(index, 'desc', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">EN - {lang.prompts.descLabel}</label>
                  <input
                    type="text"
                    value={prompt.descEn}
                    onChange={(e) => updatePrompt(index, 'descEn', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500">{lang.prompts.iconLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => updatePrompt(index, 'icon', icon)}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                          prompt.icon === icon
                            ? 'border-primary bg-primary/20'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        title={icon}
                      >
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Tính năng */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⚙️</span>
          <h4 className="font-bold text-on-surface">{lang.feature.title}</h4>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="pr-4">
            <p className="font-bold text-on-surface">{lang.feature.fileAttachment}</p>
            <p className="text-sm text-on-surface-variant">
              {fileAttachmentEnabled ? 'Đang bật - người dùng có thể đính kèm file' : 'Đang tắt - nút đính kèm file sẽ bị ẩn'}
            </p>
          </div>
          <button
            onClick={() => updateSettings({ fileAttachmentEnabled: !fileAttachmentEnabled })}
            className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
              fileAttachmentEnabled ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                fileAttachmentEnabled ? 'left-[38px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 5: Cảm xúc AI */}
      <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🎯</span>
          <div>
            <h4 className="font-bold text-slate-800">{lang.ai.emotion}</h4>
            <p className="text-xs text-slate-500">{lang.ai.emotionDesc}</p>
          </div>
        </div>
        
        <EmotionCustomization
          language={language}
          userRole={userRole}
          isInline={true}
          onClose={onClose}
        />
      </div>

      {/* Section 6: AI Instructions */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <BotIcon className="w-5 h-5 text-amber-600" />
          <h4 className="font-bold text-on-surface">AI Instructions</h4>
        </div>

        {/* Core Identity */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">{lang.ai.coreIdentity}</label>
          <p className="text-xs text-slate-500 mb-2">{lang.ai.coreIdentityDesc}</p>
          <textarea
            value={aiInstructions.coreIdentity || ''}
            onChange={(e) => updateSettings({ aiInstructions: { ...aiInstructions, coreIdentity: e.target.value } })}
            disabled={!isSuperAdmin}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
          />
        </div>

        {/* Response Format */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">{lang.ai.responseFormat}</label>
          <p className="text-xs text-slate-500 mb-2">{lang.ai.responseFormatDesc}</p>
          <textarea
            value={aiInstructions.responseFormat || ''}
            onChange={(e) => updateSettings({ aiInstructions: { ...aiInstructions, responseFormat: e.target.value } })}
            disabled={!isSuperAdmin}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
          />
        </div>

        {/* Behavior Rules */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">{lang.ai.behaviorRules}</label>
          <p className="text-xs text-slate-500 mb-2">{lang.ai.behaviorRulesDesc}</p>
          <textarea
            value={aiInstructions.behaviorRules || ''}
            onChange={(e) => updateSettings({ aiInstructions: { ...aiInstructions, behaviorRules: e.target.value } })}
            disabled={!isSuperAdmin}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
          />
        </div>

        {/* Tone */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">{lang.ai.tone}</label>
          <p className="text-xs text-slate-500 mb-2">{lang.ai.toneDesc}</p>
          <textarea
            value={aiInstructions.tone || ''}
            onChange={(e) => updateSettings({ aiInstructions: { ...aiInstructions, tone: e.target.value } })}
            disabled={!isSuperAdmin}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
          />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
        <p className="text-sm text-blue-700 font-medium">{lang.ai.disclaimer}</p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {lang.saving}</>
          ) : saveSuccess ? (
            <><CheckCircle className="w-4 h-4" /> {lang.saved}</>
          ) : (
            lang.save
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatCustomization;
