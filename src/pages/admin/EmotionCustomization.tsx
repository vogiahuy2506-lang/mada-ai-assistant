import { useState } from 'react';
import { useChatSettingsStore, useLanguageStore, type EmotionPreset, type EmotionIntensity } from '@/stores';
import { translations } from '@/lib/translations';
import type { UserRole } from '@/types';
import { CheckCircle, AlertCircle, Shield } from 'lucide-react';

// Local type for response length options
type ResponseLengthOption = 'short' | 'medium' | 'long' | 'mixed';

interface EmotionCustomizationProps {
  language?: string;
  userRole?: UserRole;
  isInline?: boolean;
  onClose?: () => void;
}

// Translation helper function
function useEmotionTranslations() {
  const language = useLanguageStore((state) => state.language);
  
  const t = (key: string): string => {
    return translations[language as keyof typeof translations]?.[key as keyof typeof translations.vi] || 
           translations.vi[key as keyof typeof translations.vi] || 
           key;
  };
  
  return { t, language };
}

export function EmotionCustomization({ language = 'vi', userRole = 'admin' }: EmotionCustomizationProps) {
  const {
    emotionSettings,
    updateEmotionSettings,
  } = useChatSettingsStore();

  const { t, language: currentLanguage } = useEmotionTranslations();
  
  const [saveError] = useState<string | null>(null);

  // Preset emotion styles
  const emotionPresets = [
    { id: 'friendly' as EmotionPreset },
    { id: 'professional' as EmotionPreset },
    { id: 'empathetic' as EmotionPreset },
    { id: 'playful' as EmotionPreset },
    { id: 'calm' as EmotionPreset },
    { id: 'enthusiastic' as EmotionPreset },
  ];

  // Intensity options
  const intensityOptions = [
    { id: 'low' as EmotionIntensity },
    { id: 'medium' as EmotionIntensity },
    { id: 'high' as EmotionIntensity },
  ];

  // Response length options
  const responseLengthOptions = [
    { id: 'short' as ResponseLengthOption },
    { id: 'medium' as ResponseLengthOption },
    { id: 'long' as ResponseLengthOption },
    { id: 'mixed' as ResponseLengthOption },
  ];

  if (userRole !== 'super_admin' && userRole !== 'admin') {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-amber-800">{t('emotionCustomization.notSuperAdmin')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Phong cách + Cường độ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phong cách */}
        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
          <h4 className="font-bold text-sm text-slate-800 mb-1">{t('emotionCustomization.presets.title')}</h4>
          <p className="text-xs text-slate-500 mb-3">{t('emotionCustomization.presets.subtitle')}</p>
          
          <div className="grid grid-cols-2 gap-2">
            {emotionPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => updateEmotionSettings({ preset: preset.id })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  emotionSettings.preset === preset.id
                    ? 'bg-teal-50 border-teal-500 shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-white border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${emotionSettings.preset === preset.id ? 'text-teal-700' : 'text-slate-700'}`}>
                    {t(`emotionCustomization.presets.${preset.id}`)}
                  </span>
                  {emotionSettings.preset === preset.id && (
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cường độ */}
        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
          <h4 className="font-bold text-sm text-slate-800 mb-1">{t('emotionCustomization.intensity.title')}</h4>
          <p className="text-xs text-slate-500 mb-3">{t('emotionCustomization.intensity.subtitle')}</p>
          
          <div className="flex gap-2">
            {intensityOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => updateEmotionSettings({ intensity: option.id })}
                className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                  emotionSettings.intensity === option.id
                    ? 'bg-cyan-500 text-white border-cyan-700 shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-white border-slate-200 hover:border-slate-400'
                }`}
              >
                <p className={`font-bold text-xs ${emotionSettings.intensity === option.id ? 'text-white' : 'text-slate-700'}`}>
                  {t(`emotionCustomization.intensity.${option.id}`)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Sliders */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{t('emotionCustomization.sliders.title')}</h4>
        <p className="text-xs text-slate-500 mb-4">{t('emotionCustomization.sliders.subtitle')}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Warmth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{t('emotionCustomization.warmth')}</span>
              <span className="text-xs font-bold text-teal-600">{emotionSettings.warmth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={emotionSettings.warmth}
              onChange={(e) => updateEmotionSettings({ warmth: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200"
              style={{
                background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${emotionSettings.warmth}%, #e2e8f0 ${emotionSettings.warmth}%, #e2e8f0 100%)`,
              }}
            />
          </div>

          {/* Enthusiasm */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{t('emotionCustomization.enthusiasm')}</span>
              <span className="text-xs font-bold text-teal-600">{emotionSettings.enthusiasm}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={emotionSettings.enthusiasm}
              onChange={(e) => updateEmotionSettings({ enthusiasm: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200"
              style={{
                background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${emotionSettings.enthusiasm}%, #e2e8f0 ${emotionSettings.enthusiasm}%, #e2e8f0 100%)`,
              }}
            />
          </div>

          {/* Formality */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{t('emotionCustomization.formality')}</span>
              <span className="text-xs font-bold text-teal-600">{emotionSettings.formality}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={emotionSettings.formality}
              onChange={(e) => updateEmotionSettings({ formality: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200"
              style={{
                background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${emotionSettings.formality}%, #e2e8f0 ${emotionSettings.formality}%, #e2e8f0 100%)`,
              }}
            />
          </div>

          {/* Empathy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{t('emotionCustomization.empathy')}</span>
              <span className="text-xs font-bold text-teal-600">{emotionSettings.empathy}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={emotionSettings.empathy}
              onChange={(e) => updateEmotionSettings({ empathy: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200"
              style={{
                background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${emotionSettings.empathy}%, #e2e8f0 ${emotionSettings.empathy}%, #e2e8f0 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Response Style */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{t('emotionCustomization.style.title')}</h4>
        <p className="text-xs text-slate-500 mb-3">{t('emotionCustomization.style.subtitle')}</p>
        
        <div className="flex flex-wrap gap-4">
          {/* Bullet Points Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 min-w-[200px]">
            <div className="pr-2">
              <p className="font-bold text-xs text-slate-700">{t('emotionCustomization.bulletPoints')}</p>
              <p className="text-xs text-slate-400">{t('emotionCustomization.bulletPointsDesc')}</p>
            </div>
            <button
              onClick={() => updateEmotionSettings({ useBulletPoints: !emotionSettings.useBulletPoints })}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                emotionSettings.useBulletPoints ? 'bg-teal-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  emotionSettings.useBulletPoints ? 'left-[38px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Emojis Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 min-w-[200px]">
            <div className="pr-2">
              <p className="font-bold text-xs text-slate-700">{t('emotionCustomization.emojis')}</p>
              <p className="text-xs text-slate-400">{t('emotionCustomization.emojisDesc')}</p>
            </div>
            <button
              onClick={() => updateEmotionSettings({ useEmojis: !emotionSettings.useEmojis })}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                emotionSettings.useEmojis ? 'bg-teal-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  emotionSettings.useEmojis ? 'left-[38px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Response Length */}
        <div className="mt-4">
          <p className="font-bold text-xs text-slate-700 mb-2">{t('emotionCustomization.responseLength')}</p>
          <div className="flex flex-wrap gap-2">
            {responseLengthOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => updateEmotionSettings({ maxResponseLength: option.id as 'short' | 'medium' | 'long' })}
                className={`px-4 py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                  emotionSettings.maxResponseLength === option.id
                    ? 'bg-teal-500 text-white border-teal-700 shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {t(`emotionCustomization.length.${option.id}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Custom Instructions */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{t('emotionCustomization.custom.title')}</h4>
        <p className="text-xs text-slate-500 mb-3">{t('emotionCustomization.custom.subtitle')}</p>
        
        <textarea
          value={emotionSettings.customInstructions}
          onChange={(e) => updateEmotionSettings({ customInstructions: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-50 border-2 border-black/20 text-sm resize-none focus:outline-none focus:border-teal-500"
          placeholder={currentLanguage === 'vi' 
            ? t('emotionCustomization.custom.placeholderVi')
            : t('emotionCustomization.custom.placeholderEn')
          }
        />
      </div>

      {/* Error Message */}
      {saveError && (
        <div className="p-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">{saveError}</span>
        </div>
      )}
    </div>
  );
}

export default EmotionCustomization;
