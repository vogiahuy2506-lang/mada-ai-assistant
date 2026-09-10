import { useState } from 'react';
import { useChatSettingsStore, type EmotionPreset, type EmotionIntensity, type ResponseStyle } from '@/stores';
import { CheckCircle, Loader2, AlertCircle, Shield } from 'lucide-react';

const EMOTION_PRESETS: { id: EmotionPreset; label: string; labelEn: string; description: string; descriptionEn: string }[] = [
  {
    id: 'friendly',
    label: 'Thân thiện',
    labelEn: 'Friendly',
    description: 'Ấm áp, gần gũi như đang trò chuyện với người bạn',
    descriptionEn: 'Warm and approachable like chatting with a friend',
  },
  {
    id: 'professional',
    label: 'Chuyên nghiệp',
    labelEn: 'Professional',
    description: 'Nghiêm túc, chính xác, phù hợp cho môi trường công việc',
    descriptionEn: 'Serious, accurate, suitable for work environments',
  },
  {
    id: 'empathetic',
    label: 'Đồng cảm',
    labelEn: 'Empathetic',
    description: 'Thấu hiểu, nhẹ nhàng, phù hợp cho người cần hỗ trợ tâm lý',
    descriptionEn: 'Understanding, gentle, suitable for psychological support',
  },
  {
    id: 'playful',
    label: 'Vui vẻ',
    labelEn: 'Playful',
    description: 'Năng động, hài hước, tạo không khí vui tươi',
    descriptionEn: 'Energetic, humorous, creates a fun atmosphere',
  },
  {
    id: 'calm',
    label: 'Bình tĩnh',
    labelEn: 'Calm',
    description: 'Từ tốn, điềm đạm, phù hợp cho người cần sự yên bình',
    descriptionEn: 'Patient, composed, suitable for those needing peace',
  },
  {
    id: 'enthusiastic',
    label: 'Nhiệt huyết',
    labelEn: 'Enthusiastic',
    description: 'Đầy năng lượng, khuyến khích, truyền cảm hứng',
    descriptionEn: 'Full of energy, encouraging, inspiring',
  },
];

const INTENSITY_OPTIONS: { id: EmotionIntensity; label: string; labelEn: string; description: string; descriptionEn: string }[] = [
  { id: 'low', label: 'Nhẹ nhàng', labelEn: 'Low', description: 'Ít thể hiện cảm xúc', descriptionEn: 'Subtle emotional expression' },
  { id: 'medium', label: 'Cân bằng', labelEn: 'Medium', description: 'Cân đối giữa các cung bậc', descriptionEn: 'Balanced emotional range' },
  { id: 'high', label: 'Mạnh mẽ', labelEn: 'High', description: 'Thể hiện cảm xúc rõ ràng', descriptionEn: 'Clear emotional expression' },
];

const RESPONSE_LENGTH_OPTIONS: { id: ResponseStyle; label: string; labelEn: string; description: string; descriptionEn: string }[] = [
  { id: 'short', label: 'Ngắn gọn', labelEn: 'Short', description: '1-2 đoạn, đi thẳng vào vấn đề', descriptionEn: '1-2 paragraphs, straight to the point' },
  { id: 'medium', label: 'Vừa phải', labelEn: 'Medium', description: '3-4 đoạn với giải thích cơ bản', descriptionEn: '3-4 paragraphs with basic explanations' },
  { id: 'long', label: 'Chi tiết', labelEn: 'Long', description: 'Nhiều đoạn với đầy đủ thông tin', descriptionEn: 'Multiple paragraphs with full information' },
  { id: 'mixed', label: 'Linh hoạt', labelEn: 'Mixed', description: 'Theo nội dung câu hỏi', descriptionEn: 'Adapts to question content' },
];

interface EmotionCustomizationProps {
  language?: string;
  userRole?: 'admin' | 'super_admin' | 'user';
  isInline?: boolean;
  onClose?: () => void;
}

export function EmotionCustomization({ language = 'vi', userRole = 'admin', isInline = false, onClose }: EmotionCustomizationProps) {
  const {
    emotionSettings,
    updateEmotionSettings,
    saveEmotionSettings,
    isSavingEmotion,
  } = useChatSettingsStore();

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const t = {
    vi: {
      title: 'Cảm xúc AI',
      subtitle: 'Tùy chỉnh phong cách giao tiếp của AI.',
      presets: { title: 'Phong cách', subtitle: 'Chọn một phong cách giao tiếp' },
      intensity: { title: 'Cường độ', subtitle: 'Mức độ thể hiện cảm xúc' },
      sliders: { title: 'Tinh chỉnh chi tiết', subtitle: 'Điều chỉnh từng khía cạnh cảm xúc' },
      warmth: 'Ấm áp',
      warmthDesc: 'Mức độ thân thiện và ấm cúng',
      enthusiasm: 'Nhiệt huyết',
      enthusiasmDesc: 'Mức độ hào hứng và năng động',
      formality: 'Trang trọng',
      formalityDesc: 'Mức độ nghiêm túc và trang trọng',
      empathy: 'Đồng cảm',
      empathyDesc: 'Mức độ thấu hiểu và cảm thông',
      style: { title: 'Phong cách trả lời', subtitle: 'Cách AI format câu trả lời' },
      bulletPoints: 'Gạch đầu dòng',
      bulletPointsDesc: 'Danh sách thay vì đoạn văn',
      emojis: 'Emoji',
      emojisDesc: 'Biểu tượng cảm xúc trong câu trả lời',
      responseLength: 'Độ dài trả lời',
      custom: { title: 'Hướng dẫn tùy chỉnh', subtitle: 'Thêm quy tắc cảm xúc riêng' },
      notSuperAdmin: 'Bạn không có quyền thay đổi. Liên hệ Super Admin.',
      save: 'Lưu',
      saving: 'Đang lưu...',
      saved: 'Đã lưu!',
      error: 'Lưu thất bại',
    },
    en: {
      title: 'AI Emotions',
      subtitle: 'Customize AI communication style.',
      presets: { title: 'Style', subtitle: 'Choose a communication style' },
      intensity: { title: 'Intensity', subtitle: 'Level of emotional expression' },
      sliders: { title: 'Fine-tune', subtitle: 'Adjust each emotional aspect' },
      warmth: 'Warmth',
      warmthDesc: 'Level of friendliness and warmth',
      enthusiasm: 'Enthusiasm',
      enthusiasmDesc: 'Level of excitement and energy',
      formality: 'Formality',
      formalityDesc: 'Level of seriousness and formality',
      empathy: 'Empathy',
      empathyDesc: 'Level of understanding and compassion',
      style: { title: 'Response style', subtitle: 'How AI formats responses' },
      bulletPoints: 'Bullet points',
      bulletPointsDesc: 'Lists instead of paragraphs',
      emojis: 'Emojis',
      emojisDesc: 'Emotional icons in responses',
      responseLength: 'Response length',
      custom: { title: 'Custom instructions', subtitle: 'Add custom emotion rules' },
      notSuperAdmin: 'You do not have permission. Contact Super Admin.',
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved!',
      error: 'Save failed',
    },
  };

  const lang = t[language as keyof typeof t] || t.vi;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveEmotionSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || lang.error);
    } finally {
      setSaving(false);
    }
  };

  if (userRole !== 'super_admin' && userRole !== 'admin') {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-amber-800">{lang.notSuperAdmin}</p>
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
          <h4 className="font-bold text-sm text-slate-800 mb-1">{lang.presets.title}</h4>
          <p className="text-xs text-slate-500 mb-3">{lang.presets.subtitle}</p>
          
          <div className="grid grid-cols-2 gap-2">
            {EMOTION_PRESETS.map((preset) => (
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
                    {language === 'vi' ? preset.label : preset.labelEn}
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
          <h4 className="font-bold text-sm text-slate-800 mb-1">{lang.intensity.title}</h4>
          <p className="text-xs text-slate-500 mb-3">{lang.intensity.subtitle}</p>
          
          <div className="flex gap-2">
            {INTENSITY_OPTIONS.map((option) => (
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
                  {language === 'vi' ? option.label : option.labelEn}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Sliders */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{lang.sliders.title}</h4>
        <p className="text-xs text-slate-500 mb-4">{lang.sliders.subtitle}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Warmth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{lang.warmth}</span>
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
              <span className="font-bold text-xs text-slate-700">{lang.enthusiasm}</span>
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
              <span className="font-bold text-xs text-slate-700">{lang.formality}</span>
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
              <span className="font-bold text-xs text-slate-700">{lang.empathy}</span>
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
        <h4 className="font-bold text-sm text-slate-800 mb-1">{lang.style.title}</h4>
        <p className="text-xs text-slate-500 mb-3">{lang.style.subtitle}</p>
        
        <div className="flex flex-wrap gap-4">
          {/* Bullet Points Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 min-w-[200px]">
            <div className="pr-2">
              <p className="font-bold text-xs text-slate-700">{lang.bulletPoints}</p>
              <p className="text-xs text-slate-400">{lang.bulletPointsDesc}</p>
            </div>
            <button
              onClick={() => updateEmotionSettings({ useBulletPoints: !emotionSettings.useBulletPoints })}
              className={`relative w-12 h-7 rounded-full transition-colors border-2 border-black shadow-[2px_2px_0px_0px_#000] shrink-0 ${
                emotionSettings.useBulletPoints ? 'bg-teal-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform border border-black/20 ${
                  emotionSettings.useBulletPoints ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Emojis Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 min-w-[200px]">
            <div className="pr-2">
              <p className="font-bold text-xs text-slate-700">{lang.emojis}</p>
              <p className="text-xs text-slate-400">{lang.emojisDesc}</p>
            </div>
            <button
              onClick={() => updateEmotionSettings({ useEmojis: !emotionSettings.useEmojis })}
              className={`relative w-12 h-7 rounded-full transition-colors border-2 border-black shadow-[2px_2px_0px_0px_#000] shrink-0 ${
                emotionSettings.useEmojis ? 'bg-teal-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform border border-black/20 ${
                  emotionSettings.useEmojis ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Response Length */}
        <div className="mt-4">
          <p className="font-bold text-xs text-slate-700 mb-2">{lang.responseLength}</p>
          <div className="flex flex-wrap gap-2">
            {RESPONSE_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => updateEmotionSettings({ maxResponseLength: option.id })}
                className={`px-4 py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                  emotionSettings.maxResponseLength === option.id
                    ? 'bg-teal-500 text-white border-teal-700 shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {language === 'vi' ? option.label : option.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Custom Instructions */}
      <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000]">
        <h4 className="font-bold text-sm text-slate-800 mb-1">{lang.custom.title}</h4>
        <p className="text-xs text-slate-500 mb-3">{lang.custom.subtitle}</p>
        
        <textarea
          value={emotionSettings.customInstructions}
          onChange={(e) => updateEmotionSettings({ customInstructions: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-50 border-2 border-black/20 text-sm resize-none focus:outline-none focus:border-teal-500"
          placeholder={language === 'vi' 
            ? 'VD: Luôn sử dụng emoji khi chào hỏi. Tránh dùng từ "bệnh lý".'
            : 'EG: Always use emoji when greeting. Avoid the word "pathological".'
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
