import { useState } from 'react';
import { useChatSettingsStore, type EmotionPreset, type EmotionIntensity } from '@/stores';
import type { UserRole } from '@/types';
import { CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useLanguageStore } from '@/stores';

// Emotion translations - supports all languages via useLanguageStore
const tE = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'emotionCustomization.notSuperAdmin': 'Chỉ Super Admin mới có quyền truy cập trang này.',
      'emotionCustomization.presets.title': 'Phong cách AI',
      'emotionCustomization.presets.subtitle': 'Chọn phong cách giao tiếp mặc định',
      'emotionCustomization.presets.friendly': 'Thân thiện',
      'emotionCustomization.presets.professional': 'Chuyên nghiệp',
      'emotionCustomization.presets.empathetic': 'Đồng cảm',
      'emotionCustomization.presets.playful': 'Vui vẻ',
      'emotionCustomization.presets.calm': 'Bình tĩnh',
      'emotionCustomization.presets.enthusiastic': 'Nhiệt tình',
      'emotionCustomization.intensity.title': 'Cường độ cảm xúc',
      'emotionCustomization.intensity.subtitle': 'Mức độ biểu lộ cảm xúc',
      'emotionCustomization.intensity.low': 'Thấp',
      'emotionCustomization.intensity.medium': 'Vừa',
      'emotionCustomization.intensity.high': 'Cao',
      'emotionCustomization.sliders.title': 'Điều chỉnh chi tiết',
      'emotionCustomization.sliders.subtitle': 'Tinh chỉnh các thuộc tính cảm xúc',
      'emotionCustomization.warmth': 'Sự ấm áp',
      'emotionCustomization.enthusiasm': 'Sự nhiệt tình',
      'emotionCustomization.formality': 'Mức độ trang trọng',
      'emotionCustomization.empathy': 'Sự đồng cảm',
      'emotionCustomization.style.title': 'Phong cách phản hồi',
      'emotionCustomization.style.subtitle': 'Cách AI trả lời câu hỏi',
      'emotionCustomization.bulletPoints': 'Dùng danh sách',
      'emotionCustomization.bulletPointsDesc': 'Trả lời dạng bullet points',
      'emotionCustomization.emojis': 'Dùng emoji',
      'emotionCustomization.emojisDesc': 'Thêm emoji vào câu trả lời',
      'emotionCustomization.responseLength': 'Độ dài phản hồi',
      'emotionCustomization.length.short': 'Ngắn',
      'emotionCustomization.length.medium': 'Vừa',
      'emotionCustomization.length.long': 'Dài',
      'emotionCustomization.length.mixed': 'Hỗn hợp',
      'emotionCustomization.custom.title': 'Hướng dẫn tùy chỉnh',
      'emotionCustomization.custom.subtitle': 'Thêm hướng dẫn đặc biệt cho AI',
      'emotionCustomization.custom.placeholderVi': 'VD: Luôn trả lời bằng tiếng Việt, thân thiện và hài hước...',
      'emotionCustomization.custom.placeholderEn': 'E.g.: Always respond in Vietnamese, friendly and humorous...',
    },
    en: {
      'emotionCustomization.notSuperAdmin': 'Only Super Admin can access this page.',
      'emotionCustomization.presets.title': 'AI Style',
      'emotionCustomization.presets.subtitle': 'Choose default communication style',
      'emotionCustomization.presets.friendly': 'Friendly',
      'emotionCustomization.presets.professional': 'Professional',
      'emotionCustomization.presets.empathetic': 'Empathetic',
      'emotionCustomization.presets.playful': 'Playful',
      'emotionCustomization.presets.calm': 'Calm',
      'emotionCustomization.presets.enthusiastic': 'Enthusiastic',
      'emotionCustomization.intensity.title': 'Emotional Intensity',
      'emotionCustomization.intensity.subtitle': 'Level of emotional expression',
      'emotionCustomization.intensity.low': 'Low',
      'emotionCustomization.intensity.medium': 'Medium',
      'emotionCustomization.intensity.high': 'High',
      'emotionCustomization.sliders.title': 'Fine-tune Details',
      'emotionCustomization.sliders.subtitle': 'Adjust emotional attributes',
      'emotionCustomization.warmth': 'Warmth',
      'emotionCustomization.enthusiasm': 'Enthusiasm',
      'emotionCustomization.formality': 'Formality Level',
      'emotionCustomization.empathy': 'Empathy',
      'emotionCustomization.style.title': 'Response Style',
      'emotionCustomization.style.subtitle': 'How AI answers questions',
      'emotionCustomization.bulletPoints': 'Use bullet points',
      'emotionCustomization.bulletPointsDesc': 'Answer in bullet point format',
      'emotionCustomization.emojis': 'Use emojis',
      'emotionCustomization.emojisDesc': 'Add emojis to answers',
      'emotionCustomization.responseLength': 'Response Length',
      'emotionCustomization.length.short': 'Short',
      'emotionCustomization.length.medium': 'Medium',
      'emotionCustomization.length.long': 'Long',
      'emotionCustomization.length.mixed': 'Mixed',
      'emotionCustomization.custom.title': 'Custom Instructions',
      'emotionCustomization.custom.subtitle': 'Add special instructions for AI',
      'emotionCustomization.custom.placeholderVi': 'E.g.: Always respond in Vietnamese, friendly and humorous...',
      'emotionCustomization.custom.placeholderEn': 'E.g.: Always respond in English, friendly and professional...',
    },
    ar: {
      'emotionCustomization.notSuperAdmin': 'فقط المدير الأعلى يمكنه الوصول إلى هذه الصفحة.',
      'emotionCustomization.presets.title': 'أسلوب الذكاء الاصطناعي',
      'emotionCustomization.presets.subtitle': 'اختر أسلوب الاتصال الافتراضي',
      'emotionCustomization.presets.friendly': 'ودود',
      'emotionCustomization.presets.professional': 'احترافي',
      'emotionCustomization.presets.empathetic': 'متعاطف',
      'emotionCustomization.presets.playful': 'مرح',
      'emotionCustomization.presets.calm': 'هادئ',
      'emotionCustomization.presets.enthusiastic': 'متحمس',
      'emotionCustomization.intensity.title': 'شدة العاطفة',
      'emotionCustomization.intensity.subtitle': 'مستوى التعبير العاطفي',
      'emotionCustomization.intensity.low': 'منخفض',
      'emotionCustomization.intensity.medium': 'متوسط',
      'emotionCustomization.intensity.high': 'عالي',
      'emotionCustomization.sliders.title': 'ضبط التفاصيل',
      'emotionCustomization.sliders.subtitle': 'ضبط السمات العاطفية',
      'emotionCustomization.warmth': 'الدفء',
      'emotionCustomization.enthusiasm': 'الحماس',
      'emotionCustomization.formality': 'مستوى الرسمية',
      'emotionCustomization.empathy': 'التعاطف',
      'emotionCustomization.style.title': 'أسلوب الاستجابة',
      'emotionCustomization.style.subtitle': 'كيف يجيب الذكاء الاصطناعي',
      'emotionCustomization.bulletPoints': 'استخدم النقاط',
      'emotionCustomization.bulletPointsDesc': 'الإجابة في شكل نقاط',
      'emotionCustomization.emojis': 'استخدم الرموز التعبيرية',
      'emotionCustomization.emojisDesc': 'أضف رموز تعبيرية للإجابات',
      'emotionCustomization.responseLength': 'طول الاستجابة',
      'emotionCustomization.length.short': 'قصير',
      'emotionCustomization.length.medium': 'متوسط',
      'emotionCustomization.length.long': 'طويل',
      'emotionCustomization.length.mixed': 'مختلط',
      'emotionCustomization.custom.title': 'تعليمات مخصصة',
      'emotionCustomization.custom.subtitle': 'أضف تعليمات خاصة للذكاء الاصطناعي',
      'emotionCustomization.custom.placeholderVi': 'مثال: أجب دائماً بالعربية، وودود ومرح...',
      'emotionCustomization.custom.placeholderEn': 'مثال: أجب دائماً بالعربية، وودود ومهني...',
    },
    fr: {
      'emotionCustomization.notSuperAdmin': 'Seul le Super Admin peut accéder à cette page.',
      'emotionCustomization.presets.title': 'Style IA',
      'emotionCustomization.presets.subtitle': 'Choisissez le style de communication par défaut',
      'emotionCustomization.presets.friendly': 'Amical',
      'emotionCustomization.presets.professional': 'Professionnel',
      'emotionCustomization.presets.empathetic': 'Empathique',
      'emotionCustomization.presets.playful': 'Jovial',
      'emotionCustomization.presets.calm': 'Calme',
      'emotionCustomization.presets.enthusiastic': 'Enthousiaste',
      'emotionCustomization.intensity.title': 'Intensité émotionnelle',
      'emotionCustomization.intensity.subtitle': 'Niveau d\'expression émotionnelle',
      'emotionCustomization.intensity.low': 'Faible',
      'emotionCustomization.intensity.medium': 'Moyen',
      'emotionCustomization.intensity.high': 'Élevé',
      'emotionCustomization.sliders.title': 'Ajuster les détails',
      'emotionCustomization.sliders.subtitle': 'Ajuster les attributs émotionnels',
      'emotionCustomization.warmth': 'Chaleur',
      'emotionCustomization.enthusiasm': 'Enthousiasme',
      'emotionCustomization.formality': 'Niveau de formalité',
      'emotionCustomization.empathy': 'Empathie',
      'emotionCustomization.style.title': 'Style de réponse',
      'emotionCustomization.style.subtitle': 'Comment l\'IA répond aux questions',
      'emotionCustomization.bulletPoints': 'Utiliser des listes',
      'emotionCustomization.bulletPointsDesc': 'Répondre sous forme de listes à puces',
      'emotionCustomization.emojis': 'Utiliser des emojis',
      'emotionCustomization.emojisDesc': 'Ajouter des emojis aux réponses',
      'emotionCustomization.responseLength': 'Longueur de réponse',
      'emotionCustomization.length.short': 'Court',
      'emotionCustomization.length.medium': 'Moyen',
      'emotionCustomization.length.long': 'Long',
      'emotionCustomization.length.mixed': 'Mixte',
      'emotionCustomization.custom.title': 'Instructions personnalisées',
      'emotionCustomization.custom.subtitle': 'Ajouter des instructions spéciales pour l\'IA',
      'emotionCustomization.custom.placeholderVi': 'Ex: Toujours répondre en français, amical et humoristique...',
      'emotionCustomization.custom.placeholderEn': 'Ex: Toujours répondre en français, amical et professionnel...',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

type ResponseLengthOption = 'short' | 'medium' | 'long' | 'mixed';

interface EmotionCustomizationProps {
  language?: string;
  userRole?: UserRole;
  isInline?: boolean;
  onClose?: () => void;
}

export function EmotionCustomization({ userRole = 'admin' }: EmotionCustomizationProps) {
  const {
    emotionSettings,
    updateEmotionSettings,
  } = useChatSettingsStore();

  const [saveError] = useState<string | null>(null);

  const emotionPresets = [
    { id: 'friendly' as EmotionPreset },
    { id: 'professional' as EmotionPreset },
    { id: 'empathetic' as EmotionPreset },
    { id: 'playful' as EmotionPreset },
    { id: 'calm' as EmotionPreset },
    { id: 'enthusiastic' as EmotionPreset },
  ];

  const intensityOptions = [
    { id: 'low' as EmotionIntensity },
    { id: 'medium' as EmotionIntensity },
    { id: 'high' as EmotionIntensity },
  ];

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
          <p className="font-bold text-amber-800">{tE('emotionCustomization.notSuperAdmin')}</p>
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
          <h4 className="font-bold text-sm text-slate-800 mb-1">{tE('emotionCustomization.presets.title')}</h4>
          <p className="text-xs text-slate-500 mb-3">{tE('emotionCustomization.presets.subtitle')}</p>
          
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
                    {tE(`emotionCustomization.presets.${preset.id}`)}
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
          <h4 className="font-bold text-sm text-slate-800 mb-1">{tE('emotionCustomization.intensity.title')}</h4>
          <p className="text-xs text-slate-500 mb-3">{tE('emotionCustomization.intensity.subtitle')}</p>
          
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
                  {tE(`emotionCustomization.intensity.${option.id}`)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Sliders */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{tE('emotionCustomization.sliders.title')}</h4>
        <p className="text-xs text-slate-500 mb-4">{tE('emotionCustomization.sliders.subtitle')}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Warmth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{tE('emotionCustomization.warmth')}</span>
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
              <span className="font-bold text-xs text-slate-700">{tE('emotionCustomization.enthusiasm')}</span>
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
              <span className="font-bold text-xs text-slate-700">{tE('emotionCustomization.formality')}</span>
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
              <span className="font-bold text-xs text-slate-700">{tE('emotionCustomization.empathy')}</span>
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
        <h4 className="font-bold text-sm text-slate-800 mb-1">{tE('emotionCustomization.style.title')}</h4>
        <p className="text-xs text-slate-500 mb-3">{tE('emotionCustomization.style.subtitle')}</p>
        
        <div className="flex flex-wrap gap-4">
          {/* Bullet Points Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 min-w-[200px]">
            <div className="pr-2">
              <p className="font-bold text-xs text-slate-700">{tE('emotionCustomization.bulletPoints')}</p>
              <p className="text-xs text-slate-400">{tE('emotionCustomization.bulletPointsDesc')}</p>
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
              <p className="font-bold text-xs text-slate-700">{tE('emotionCustomization.emojis')}</p>
              <p className="text-xs text-slate-400">{tE('emotionCustomization.emojisDesc')}</p>
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
          <p className="font-bold text-xs text-slate-700 mb-2">{tE('emotionCustomization.responseLength')}</p>
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
                {tE(`emotionCustomization.length.${option.id}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Custom Instructions */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{tE('emotionCustomization.custom.title')}</h4>
        <p className="text-xs text-slate-500 mb-3">{tE('emotionCustomization.custom.subtitle')}</p>
        
        <textarea
          value={emotionSettings.customInstructions}
          onChange={(e) => updateEmotionSettings({ customInstructions: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-50 border-2 border-black/20 text-sm resize-none focus:outline-none focus:border-teal-500"
          placeholder={tE('emotionCustomization.custom.placeholderVi')}
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
