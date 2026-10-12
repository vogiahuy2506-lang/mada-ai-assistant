import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/types';

export interface SuggestedPrompt {
  text: string;
  textEn: string;
  desc: string;
  descEn: string;
  icon: string;
}

// ============== EMOTION / PERSONALITY SETTINGS ==============

export type EmotionPreset = 'friendly' | 'professional' | 'empathetic' | 'playful' | 'calm' | 'enthusiastic';
export type EmotionIntensity = 'low' | 'medium' | 'high';
export type ResponseStyle = 'bullet_points' | 'numbered' | 'paragraph' | 'mixed';

export interface EmotionSettings {
  // Current preset
  preset: EmotionPreset;
  // Override individual settings
  intensity: EmotionIntensity;
  // Specific emotion controls
  warmth: number;      // 0-100: How warm/friendly the tone is
  enthusiasm: number;   // 0-100: How excited/enthusiastic
  formality: number;    // 0-100: 0 = very casual, 100 = very formal
  empathy: number;      // 0-100: How empathetic/understanding
  // Response style preferences
  useBulletPoints: boolean;
  useEmojis: boolean;
  maxResponseLength: 'short' | 'medium' | 'long';
  // Custom instructions (Super Admin can add custom emotion rules)
  customInstructions: string;
}

export interface AIInstructions {
  coreIdentity: string;
  responseFormat: string;
  behaviorRules: string;
  tone: string;
}

interface ChatSettingsState {
  // Greetings (4 languages)
  greeting: Record<Language, string>;
  // Descriptions (4 languages)
  description: Record<Language, string>;
  // Features
  fileAttachmentEnabled: boolean;
  // Show suggested questions section
  showSuggestedQuestions: boolean;
  // Suggested prompts
  suggestedPrompts: SuggestedPrompt[];
  // AI System Instructions (Super Admin only)
  aiInstructions: AIInstructions;
  // ⭐ Emotion/Personality Settings (Super Admin only)
  emotionSettings: EmotionSettings;
  // Loading states
  isLoading: boolean;
  isSavingAi: boolean;
  isSavingEmotion: boolean;
  // Actions
  loadFromBackend: () => Promise<void>;
  updateSettings: (settings: Partial<{
    greeting: Record<Language, string>;
    description: Record<Language, string>;
    fileAttachmentEnabled: boolean;
    showSuggestedQuestions: boolean;
    suggestedPrompts: SuggestedPrompt[];
    aiInstructions: AIInstructions;
    emotionSettings: EmotionSettings;
  }>) => void;
  updateEmotionSettings: (settings: Partial<EmotionSettings>) => void;
  saveToBackend: () => Promise<void>;
  saveAiInstructions: () => Promise<void>;
  saveEmotionSettings: () => Promise<void>;
}

// Default values
const DEFAULT_GREETING: Record<Language, string> = {
  vi: 'Xin chào! Mình là MADA AI.',
  en: 'Hello! I am MADA AI.',
  ar: 'مرحباً! أنا MADA AI.',
  fr: 'Bonjour! Je suis MADA AI.',
};

const DEFAULT_DESCRIPTION: Record<Language, string> = {
  vi: 'Mình có thể giúp bạn phân tích tài liệu, xử lý dữ liệu từ các tệp hoặc trả lời các câu hỏi chuyên sâu. Bạn muốn bắt đầu với việc gì hôm nay?',
  en: 'I can help you analyze documents, process data from files, or answer detailed questions. What would you like to start with today?',
  ar: 'يمكنني مساعدتك في تحليل المستندات ومعالجة البيانات من الملفات أو الإجابة على الأسئلة التفصيلية. ماذا تريد أن تبدأ اليوم؟',
  fr: 'Je peux vous aider à analyser des documents, traiter des données de fichiers ou répondre à des questions détaillées. Par quoi souhaitez-vous commencer aujourd\'hui?',
};

const DEFAULT_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { text: 'Phân tích văn bản dài', textEn: 'Analyze long documents', desc: 'Tóm tắt nội dung chính và các điểm quan trọng từ tài liệu của bạn', descEn: 'Summarize main content and key points from your documents', icon: 'description' },
  { text: 'Kiểm tra khả năng tiếp cận', textEn: 'Accessibility check', desc: 'Đánh giá mức độ phù hợp WCAG cho website hoặc tài liệu', descEn: 'Evaluate WCAG compliance for websites or documents', icon: 'accessibility' },
  { text: 'Dịch thuật chuyên ngành', textEn: 'Professional translation', desc: 'Dịch thuật ngữ y khoa, công nghệ hỗ trợ với độ chính xác cao', descEn: 'Translate medical terms, assistive technology with high accuracy', icon: 'translate' },
  { text: 'Gợi ý giải pháp hỗ trợ', textEn: 'Suggest support solutions', desc: 'Tìm kiếm các thiết bị, phần mềm phù hợp với từng dạng khuyết tật', descEn: 'Find devices and software suitable for each type of disability', icon: 'lightbulb' },
];

// Default AI Instructions (Super Admin customizable)
const DEFAULT_AI_CORE_IDENTITY = `Bạn là MADA AI - một trợ lý ảo thông minh được thiết kế để hỗ trợ người khuyết tật tiếp cận công nghệ.

VAI TRÒ CỦA BẠN:
- Chuyên gia tư vấn về công nghệ hỗ trợ người khuyết tật
- Hỗ trợ phân tích tài liệu, xử lý dữ liệu
- Tư vấn về khả năng tiếp cận (accessibility) theo tiêu chuẩn WCAG
- Cung cấp thông tin về thiết bị, phần mềm hỗ trợ

NGÔN NGỮ:
- Mặc định giao tiếp bằng tiếng Việt
- Có thể chuyển đổi sang tiếng Anh, tiếng Pháp, tiếng Ả Rập khi được yêu cầu
- Sử dụng ngôn ngữ đơn giản, dễ hiểu, tránh thuật ngữ phức tạp khi không cần thiết`;

const DEFAULT_AI_RESPONSE_FORMAT = `QUY TẮC ĐỊNH DẠNG TRẢ LỜI:

1. KHI TRẢ LỜI CÓ NHIỀU MỤC:
   - Sử dụng danh sách gạch đầu dòng (bullet points)
   - Đánh số thứ tự nếu có ưu tiên hoặc thứ tự

2. KHI SO SÁNH CÁC LỰA CHỌN:
   - Sử dụng bảng để dễ đọc và so sánh
   - Các cột: Tên | Đặc điểm | Giá | Phù hợp cho

3. KHI CẦN TRÌNH BÀY CHI TIẾT:
   - Chia thành các đoạn văn ngắn
   - Sử dụng tiêu đề phụ (##) để phân cấp

4. KHI CUNG CẤP MÃ/CODE:
   - Đặt trong code block có ngôn ngữ phù hợp
   - Giải thích từng dòng nếu cần thiết

5. KHI TÓM TẮT TÀI LIỆU:
   - Liệt kê các điểm chính
   - Ghi rõ nguồn tham khảo`;

const DEFAULT_AI_BEHAVIOR_RULES = `QUY TẮC ỨNG XỬ BẮT BUỘC:

1. AN TOÀN THÔNG TIN:
   - Không đưa ra thông tin y khoa khi không có căn cứ rõ ràng
   - Khuyến nghị người dùng tham khảo chuyên gia cho các vấn đề sức khỏe
   - Không thay thế tư vấn chuyên môn

2. ĐẠO ĐỨC:
   - Tôn trọng quyền riêng tư của người dùng
   - Không phân biệt đối xử dựa trên loại khuyết tật
   - Đề xuất giải pháp tích cực, hướng nâng cao khả năng

3. CHẤT LƯỢNG:
   - Trả lời dựa trên dữ liệu và thông tin xác thực
   - Thừa nhận khi không biết hoặc không chắc chắn
   - Cung cấp nguồn tham khảo khi có thể

4. KHI CÂU HỎI MƠ HỒ:
   - Hỏi lại để làm rõ nhu cầu cụ thể
   - Đề xuất các câu hỏi gợi ý phù hợp

5. GIỚI HẠN:
   - Không thực hiện hành động thay người dùng
   - Không lưu trữ thông tin cá nhân nhạy cảm`;

const DEFAULT_AI_TONE = `PHONG CÁCH GIAO TIẾP:

1. GIỌNG ĐIỆU:
   - Thân thiện, gần gũi như đang trò chuyện với người bạn
   - Sử dụng "mình" thay vì "tôi" khi giới thiệu bản thân
   - Ấm áp, đồng cảm, không bệnh lý hóa khuyết tật

2. NGÔN NGỮ:
   - Đơn giản, rõ ràng, tránh jargon
   - Sử dụng câu ngắn, dễ hiểu
   - Giải thích thuật ngữ kỹ thuật khi cần

3. THÁI ĐỘ:
   - Tích cực và khuyến khích
   - Tập trung vào khả năng và giải pháp
   - Không dùng ngôn ngữ tiêu cực về khuyết tật

4. HÌNH ẢNH:
   - Sử dụng emoji phù hợp để tạo không khí thân thiện
   - Format văn bản dễ đọc với screen reader`;

// ⭐ Default Emotion Settings
const DEFAULT_EMOTION_SETTINGS: EmotionSettings = {
  preset: 'friendly',
  intensity: 'medium',
  warmth: 70,
  enthusiasm: 60,
  formality: 30,
  empathy: 80,
  useBulletPoints: true,
  useEmojis: true,
  maxResponseLength: 'medium',
  customInstructions: '',
};

export const useChatSettingsStore = create<ChatSettingsState>()(
  persist(
    (set, get) => ({
      greeting: { ...DEFAULT_GREETING },
      description: { ...DEFAULT_DESCRIPTION },
      // ⭐ Default = TRUE — hiển thị nút đính kèm theo mặc định
      // Backend trả về feature_file_attachment_enabled=false để ẩn nút khi cần
      fileAttachmentEnabled: true,
      showSuggestedQuestions: true,
      suggestedPrompts: [...DEFAULT_SUGGESTED_PROMPTS],
      aiInstructions: {
        coreIdentity: DEFAULT_AI_CORE_IDENTITY,
        responseFormat: DEFAULT_AI_RESPONSE_FORMAT,
        behaviorRules: DEFAULT_AI_BEHAVIOR_RULES,
        tone: DEFAULT_AI_TONE,
      },
      emotionSettings: { ...DEFAULT_EMOTION_SETTINGS },
      isLoading: false,
      isSavingAi: false,
      isSavingEmotion: false,

      loadFromBackend: async () => {
        set({ isLoading: true });
        try {
          // Try public chat-settings endpoint
          try {
            const publicRes = await fetch('/api/admin/chat-settings/public');
            if (publicRes.ok) {
              const data = await publicRes.json();
              if (data.success && data.data) {
                const d = data.data;
                set({
                  greeting: {
                    vi: d.chat_greeting_vi ?? DEFAULT_GREETING.vi,
                    en: d.chat_greeting_en ?? DEFAULT_GREETING.en,
                    ar: d.chat_greeting_ar ?? DEFAULT_GREETING.ar,
                    fr: d.chat_greeting_fr ?? DEFAULT_GREETING.fr,
                  },
                  description: {
                    vi: d.chat_description_vi ?? DEFAULT_DESCRIPTION.vi,
                    en: d.chat_description_en ?? DEFAULT_DESCRIPTION.en,
                    ar: d.chat_description_ar ?? DEFAULT_DESCRIPTION.ar,
                    fr: d.chat_description_fr ?? DEFAULT_DESCRIPTION.fr,
                  },
                  showSuggestedQuestions: d.feature_show_suggested_questions ?? true,
                  suggestedPrompts: d.suggested_prompts ?? DEFAULT_SUGGESTED_PROMPTS,
                });
              }
            }
          } catch (e) {
            console.warn('Failed to load public chat settings:', e);
          }

          // ⭐ ALSO load file settings from file-settings/public — this is the source of truth
          // for feature_file_attachment_enabled from FileManagement admin page
          try {
            const fileRes = await fetch('/api/admin/file-settings/public');
            console.log('[ChatSettings] File settings response status:', fileRes.status);
            if (fileRes.ok) {
              const fileData = await fileRes.json();
              console.log('[ChatSettings] File settings data:', fileData);
              if (fileData.success && fileData.data) {
                // Use file-settings as source of truth for fileAttachmentEnabled
                const enabled = fileData.data.feature_file_attachment_enabled ?? true;
                console.log('[ChatSettings] Setting fileAttachmentEnabled to:', enabled);
                set({
                  fileAttachmentEnabled: enabled,
                });
              }
            }
          } catch (e) {
            console.error('[ChatSettings] Failed to load file settings:', e);
          }

          // Load AI instructions from public endpoint
          try {
            const aiRes = await fetch('/api/admin/ai-instructions/public');
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              if (aiData.success && aiData.data) {
                const ai = aiData.data;
                set({
                  aiInstructions: {
                    coreIdentity: ai.ai_instruction_core_identity || DEFAULT_AI_CORE_IDENTITY,
                    responseFormat: ai.ai_instruction_response_format || DEFAULT_AI_RESPONSE_FORMAT,
                    behaviorRules: ai.ai_instruction_behavior_rules || DEFAULT_AI_BEHAVIOR_RULES,
                    tone: ai.ai_instruction_tone || DEFAULT_AI_TONE,
                  },
                });
              }
            }
          } catch (e) {
            console.warn('Failed to load AI instructions:', e);
          }

          // ⭐ Load Emotion Settings from public endpoint
          try {
            const emotionRes = await fetch('/api/admin/emotion-settings/public');
            if (emotionRes.ok) {
              const emotionData = await emotionRes.json();
              if (emotionData.success && emotionData.data) {
                const em = emotionData.data;
                set({
                  emotionSettings: {
                    preset: em.emotion_preset || DEFAULT_EMOTION_SETTINGS.preset,
                    intensity: em.emotion_intensity || DEFAULT_EMOTION_SETTINGS.intensity,
                    warmth: em.emotion_warmth ?? DEFAULT_EMOTION_SETTINGS.warmth,
                    enthusiasm: em.emotion_enthusiasm ?? DEFAULT_EMOTION_SETTINGS.enthusiasm,
                    formality: em.emotion_formality ?? DEFAULT_EMOTION_SETTINGS.formality,
                    empathy: em.emotion_empathy ?? DEFAULT_EMOTION_SETTINGS.empathy,
                    useBulletPoints: em.emotion_use_bullet_points ?? DEFAULT_EMOTION_SETTINGS.useBulletPoints,
                    useEmojis: em.emotion_use_emojis ?? DEFAULT_EMOTION_SETTINGS.useEmojis,
                    maxResponseLength: em.emotion_max_response_length || DEFAULT_EMOTION_SETTINGS.maxResponseLength,
                    customInstructions: em.emotion_custom_instructions || DEFAULT_EMOTION_SETTINGS.customInstructions,
                  },
                });
              }
            }
          } catch (e) {
            console.warn('Failed to load emotion settings:', e);
          }
        } catch (e) {
          console.error('Failed to load chat settings:', e);
        } finally {
          set({ isLoading: false });
        }
      },

      updateSettings: (settings) => {
        set((state) => ({
          ...state,
          ...settings,
          greeting: settings.greeting ? { ...state.greeting, ...settings.greeting } : state.greeting,
          description: settings.description ? { ...state.description, ...settings.description } : state.description,
          aiInstructions: settings.aiInstructions ? { ...state.aiInstructions, ...settings.aiInstructions } : state.aiInstructions,
          emotionSettings: settings.emotionSettings ? { ...state.emotionSettings, ...settings.emotionSettings } : state.emotionSettings,
        }));
      },

      updateEmotionSettings: (settings) => {
        set((state) => ({
          emotionSettings: { ...state.emotionSettings, ...settings },
        }));
      },

      saveToBackend: async () => {
        const { greeting, description, showSuggestedQuestions, suggestedPrompts } = get();
        // NOTE: fileAttachmentEnabled is managed by FileManagement page — NOT saved here
        // to avoid conflicts between two admin pages writing to the same DB key.

        try {
          const token = localStorage.getItem('mada-access-token');
          if (!token) {
            return;
          }

          const updates = {
            chat_greeting_vi: greeting.vi,
            chat_greeting_en: greeting.en,
            chat_greeting_ar: greeting.ar,
            chat_greeting_fr: greeting.fr,
            chat_description_vi: description.vi,
            chat_description_en: description.en,
            chat_description_ar: description.ar,
            chat_description_fr: description.fr,
            // feature_file_attachment_enabled is saved ONLY by FileManagement page
            feature_show_suggested_questions: showSuggestedQuestions,
            suggested_prompts: JSON.stringify(suggestedPrompts),
          };

          const res = await fetch('/api/admin/chat-settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });

          const data = await res.json();
          if (!data.success) {
            console.error('Failed to save chat settings:', data.error);
            throw new Error(data.error || 'Failed to save');
          }
        } catch (e) {
          console.error('Failed to save chat settings:', e);
          throw e;
        }
      },

      saveAiInstructions: async () => {
        const { aiInstructions } = get();

        set({ isSavingAi: true });
        try {
          const token = localStorage.getItem('mada-access-token');
          if (!token) {
            throw new Error('No access token found');
          }

          const updates = {
            ai_instruction_core_identity: aiInstructions.coreIdentity,
            ai_instruction_response_format: aiInstructions.responseFormat,
            ai_instruction_behavior_rules: aiInstructions.behaviorRules,
            ai_instruction_tone: aiInstructions.tone,
          };

          const res = await fetch('/api/admin/ai-instructions', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Lưu thất bại');
          }
        } finally {
          set({ isSavingAi: false });
        }
      },

      // ⭐ Save Emotion Settings to backend
      saveEmotionSettings: async () => {
        const { emotionSettings } = get();

        set({ isSavingEmotion: true });
        try {
          const token = localStorage.getItem('mada-access-token');
          if (!token) {
            throw new Error('No access token found');
          }

          const updates = {
            emotion_preset: emotionSettings.preset,
            emotion_intensity: emotionSettings.intensity,
            emotion_warmth: emotionSettings.warmth,
            emotion_enthusiasm: emotionSettings.enthusiasm,
            emotion_formality: emotionSettings.formality,
            emotion_empathy: emotionSettings.empathy,
            emotion_use_bullet_points: emotionSettings.useBulletPoints,
            emotion_use_emojis: emotionSettings.useEmojis,
            emotion_max_response_length: emotionSettings.maxResponseLength,
            emotion_custom_instructions: emotionSettings.customInstructions,
          };

          const res = await fetch('/api/admin/emotion-settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Lưu thất bại');
          }
        } finally {
          set({ isSavingEmotion: false });
        }
      },
    }),
    {
      name: 'mada-chat-settings',
      // ⭐ DON'T persist fileAttachmentEnabled — always load fresh from backend
      // to ensure the admin toggle in FileManagement is always respected
      partialize: (state) => ({
        greeting: state.greeting,
        description: state.description,
        // fileAttachmentEnabled intentionally excluded — fetched fresh every time
        showSuggestedQuestions: state.showSuggestedQuestions,
        suggestedPrompts: state.suggestedPrompts,
        aiInstructions: state.aiInstructions,
        emotionSettings: state.emotionSettings,
      }),
    }
  )
);
