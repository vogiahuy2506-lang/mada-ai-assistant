import { useState, useEffect } from 'react';
import { useChatSettingsStore, type SuggestedPrompt } from '@/stores';
import type { Language, UserRole } from '@/types';
import { CheckCircle, Loader2, AlertCircle, Shield, Bot as BotIcon, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { EmotionCustomization } from './EmotionCustomization';
import { PromptTemplates } from './PromptTemplates';

// Chat Customization translations - hardcoded Vietnamese
const tChat = (key: string): string => {
  const translations: Record<string, string> = {
    'admin.chatCustomization.error': 'Có lỗi xảy ra',
    'admin.chatCustomization.loading': 'Đang tải...',
    'admin.chatCustomization.title': 'Tùy chỉnh Chat',
    'admin.chatCustomization.subtitle': 'Cấu hình giao diện và hành vi chat',
    'admin.chatCustomization.save': 'Lưu',
    'admin.chatCustomization.saving': 'Đang lưu...',
    'admin.chatCustomization.saved': 'Đã lưu!',
    'admin.chatCustomization.ai.notSuperAdmin': 'Bạn không có quyền chỉnh sửa cấu hình AI. Liên hệ Super Admin.',
    'admin.chatCustomization.greeting.title': 'Lời chào & Mô tả',
    'admin.chatCustomization.greeting.greetingLabel': 'Lời chào',
    'admin.chatCustomization.greeting.descLabel': 'Mô tả',
    'admin.chatCustomization.prompts.title': 'Câu hỏi gợi ý',
    'admin.chatCustomization.prompts.hint': 'Các câu hỏi hiển thị khi bắt đầu trò chuyện',
    'admin.chatCustomization.promptNumber': 'Câu hỏi #{number}',
    'admin.chatCustomization.prompts.textLabel': 'Nội dung',
    'admin.chatCustomization.prompts.descLabel': 'Mô tả',
    'admin.chatCustomization.prompts.iconLabel': 'Icon',
    'admin.chatCustomization.feature.title': 'Tính năng',
    'admin.chatCustomization.feature.fileAttachment': 'Cho phép đính kèm file',
    'admin.chatCustomization.fileEnabled': 'Đã bật - Người dùng có thể gửi file',
    'admin.chatCustomization.fileDisabled': 'Đã tắt - Người dùng không thể gửi file',
    'admin.chatCustomization.ai.emotion': 'Cảm xúc AI',
    'admin.chatCustomization.ai.emotionDesc': 'Tùy chỉnh phong cách giao tiếp của AI',
    'admin.chatCustomization.aiInstructions': 'Hướng dẫn AI',
    'admin.chatCustomization.ai.coreIdentity': 'Bản sắc cốt lõi',
    'admin.chatCustomization.ai.coreIdentityDesc': 'Mô tả AI là ai, vai trò của AI',
    'admin.chatCustomization.ai.responseFormat': 'Định dạng phản hồi',
    'admin.chatCustomization.ai.responseFormatDesc': 'Cách AI trình bày thông tin',
    'admin.chatCustomization.ai.behaviorRules': 'Quy tắc hành vi',
    'admin.chatCustomization.ai.behaviorRulesDesc': 'Các quy tắc AI phải tuân thủ',
    'admin.chatCustomization.ai.tone': 'Giọng điệu',
    'admin.chatCustomization.ai.toneDesc': 'Phong cách ngôn ngữ của AI',
    'admin.chatCustomization.promptTemplates': 'Mẫu Prompt',
    'admin.chatCustomization.promptTemplatesHint': 'Sử dụng mẫu có sẵn',
    'admin.chatCustomization.ai.disclaimer': 'Các thay đổi sẽ có hiệu lực ngay lập tức cho tất cả người dùng.',
  };
  return translations[key] || key;
};

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
  userRole?: UserRole;
  isInline?: boolean;
  onClose?: () => void;
}

export function ChatCustomization({ userRole = 'admin', onClose: _onClose }: Omit<ChatCustomizationProps, 'language'>) {
  const globalLanguage = 'vi';
  const language = globalLanguage;
  
  // Check both 'superadmin' (DB) and 'super_admin' (code) for backward compatibility
  const isSuperAdmin = userRole === 'super_admin' || (userRole as unknown) === 'superadmin';
  
  const [showTemplates, setShowTemplates] = useState(false);
  
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
      setSaveError(e.message || tChat('admin.chatCustomization.error'));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3">{tChat('admin.chatCustomization.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface">{tChat('admin.chatCustomization.title')}</h3>
          <p className="text-sm text-on-surface-variant mt-1">{tChat('admin.chatCustomization.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {tChat('admin.chatCustomization.saving')}</>
            ) : saveSuccess ? (
              <><CheckCircle className="w-4 h-4" /> {tChat('admin.chatCustomization.saved')}</>
            ) : (
              tChat('admin.chatCustomization.save')
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
            <p className="font-bold text-amber-800">{tChat('admin.chatCustomization.ai.notSuperAdmin')}</p>
          </div>
        </div>
      )}

      {/* Section 1: Lời chào & Mô tả */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">👋</span>
          <h4 className="font-bold text-on-surface">{tChat('admin.chatCustomization.greeting.title')}</h4>
        </div>
        
        <div className="space-y-4">
          {LANGUAGES.map((langOption) => (
            <div key={langOption.key} className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                {langOption.label} - {tChat('admin.chatCustomization.greeting.greetingLabel')}
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
        <h4 className="font-bold text-on-surface mb-4">{tChat('admin.chatCustomization.greeting.descLabel')}</h4>
        
        <div className="space-y-4">
          {LANGUAGES.map((langOption) => (
            <div key={langOption.key} className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                {langOption.label} - {tChat('admin.chatCustomization.greeting.descLabel')}
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
          <h4 className="font-bold text-on-surface">{tChat('admin.chatCustomization.prompts.title')}</h4>
        </div>
        <p className="text-sm text-on-surface-variant mb-4">{tChat('admin.chatCustomization.prompts.hint')}</p>
        
        <div className="space-y-4">
          {suggestedPrompts.map((prompt, index) => (
            <div key={index} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">{tChat('admin.chatCustomization.promptNumber', { number: index + 1 })}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">VI - {tChat('admin.chatCustomization.prompts.textLabel')}</label>
                  <input
                    type="text"
                    value={prompt.text}
                    onChange={(e) => updatePrompt(index, 'text', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">EN - {tChat('admin.chatCustomization.prompts.textLabel')}</label>
                  <input
                    type="text"
                    value={prompt.textEn}
                    onChange={(e) => updatePrompt(index, 'textEn', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">VI - {tChat('admin.chatCustomization.prompts.descLabel')}</label>
                  <input
                    type="text"
                    value={prompt.desc}
                    onChange={(e) => updatePrompt(index, 'desc', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">EN - {tChat('admin.chatCustomization.prompts.descLabel')}</label>
                  <input
                    type="text"
                    value={prompt.descEn}
                    onChange={(e) => updatePrompt(index, 'descEn', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-black/20 text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500">{tChat('admin.chatCustomization.prompts.iconLabel')}</label>
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
          <h4 className="font-bold text-on-surface">{tChat('admin.chatCustomization.feature.title')}</h4>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="pr-4">
            <p className="font-bold text-on-surface">{tChat('admin.chatCustomization.feature.fileAttachment')}</p>
            <p className="text-sm text-on-surface-variant">
              {fileAttachmentEnabled ? tChat('admin.chatCustomization.fileEnabled') : tChat('admin.chatCustomization.fileDisabled')}
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
            <h4 className="font-bold text-slate-800">{tChat('admin.chatCustomization.ai.emotion')}</h4>
            <p className="text-xs text-slate-500">{tChat('admin.chatCustomization.ai.emotionDesc')}</p>
          </div>
        </div>
        
        <EmotionCustomization
          language={language}
          userRole={userRole}
          isInline={true}
          onClose={_onClose}
        />
      </div>

      {/* Section 6: AI Instructions */}
      <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 mb-4">
          <BotIcon className="w-5 h-5 text-amber-600" />
          <h4 className="font-bold text-on-surface">{tChat('admin.chatCustomization.aiInstructions')}</h4>
        </div>

        {/* Core Identity */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">{tChat('admin.chatCustomization.ai.coreIdentity')}</label>
          <p className="text-xs text-slate-500 mb-2">{tChat('admin.chatCustomization.ai.coreIdentityDesc')}</p>
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
          <label className="block text-sm font-bold text-slate-700 mb-2">{tChat('admin.chatCustomization.ai.responseFormat')}</label>
          <p className="text-xs text-slate-500 mb-2">{tChat('admin.chatCustomization.ai.responseFormatDesc')}</p>
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
          <label className="block text-sm font-bold text-slate-700 mb-2">{tChat('admin.chatCustomization.ai.behaviorRules')}</label>
          <p className="text-xs text-slate-500 mb-2">{tChat('admin.chatCustomization.ai.behaviorRulesDesc')}</p>
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
          <label className="block text-sm font-bold text-slate-700 mb-2">{tChat('admin.chatCustomization.ai.tone')}</label>
          <p className="text-xs text-slate-500 mb-2">{tChat('admin.chatCustomization.ai.toneDesc')}</p>
          <textarea
            value={aiInstructions.tone || ''}
            onChange={(e) => updateSettings({ aiInstructions: { ...aiInstructions, tone: e.target.value } })}
            disabled={!isSuperAdmin}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black/20 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
          />
        </div>
      </div>

      {/* Section: Prompt Templates */}
      <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_#000]">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full p-5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-800">{tChat('admin.chatCustomization.promptTemplates')}</h4>
              <p className="text-xs text-slate-500">{tChat('admin.chatCustomization.promptTemplatesHint')}</p>
            </div>
          </div>
          {showTemplates ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {showTemplates && (
          <div className="border-t border-slate-200">
            <PromptTemplates />
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
        <p className="text-sm text-blue-700 font-medium">{tChat('admin.chatCustomization.ai.disclaimer')}</p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {tChat('admin.chatCustomization.saving')}</>
          ) : saveSuccess ? (
            <><CheckCircle className="w-4 h-4" /> {tChat('admin.chatCustomization.saved')}</>
          ) : (
            tChat('admin.chatCustomization.save')
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatCustomization;
