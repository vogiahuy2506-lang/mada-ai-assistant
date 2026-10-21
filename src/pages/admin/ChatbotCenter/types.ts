// ============== Chatbot Center — Types thống nhất ==============
// Gom mọi loại cấu hình chatbot vào 1 cấu trúc duy nhất để dễ custom.
// Mỗi loại = 1 ChatbotConfig; mỗi section trong modal chỉnh 1 phần của nó.

import type { Agent } from '@/stores/agentStore';

/** Một đơn vị chatbot có thể custom. Có thể là agent thuần hoặc widget nhúng. */
export type ChatbotKind = 'agent' | 'widget' | 'consultation';

export type ChatbotStatus = 'draft' | 'published' | 'archived';

/** Các category khuyết tật — kế thừa từ AdminAgents. */
export type ATCategory =
  | 'vision'
  | 'hearing'
  | 'mobility'
  | 'cognition'
  | 'communication'
  | 'daily_living'
  | 'education'
  | 'general';

export type LanguageCode = 'vi' | 'en' | 'ar' | 'fr';

/** Phần "Agent" — model, prompt, RAG, tools. */
export interface AgentConfigSection {
  /** Model AI (vd 'gemini-2.0-flash', 'gpt-4o-mini'). */
  model: string;
  /** System prompt bằng ngôn ngữ mặc định. */
  systemPrompt: string;
  /** Override theo từng ngôn ngữ (key = LanguageCode). */
  systemPromptOverrides?: Partial<Record<LanguageCode, string>>;
  /** Category AT — nếu có sẽ kế thừa KB của category đó. */
  madaCategory?: ATCategory;
  /** Linked prompt ID (FK sang bảng prompts). */
  promptId?: string;
  /** Knowledge URL — kéo thêm data ngoài. */
  knowledgeUrl?: string;
  /** Tool IDs (capabilities) mà agent có thể gọi. */
  capabilities: string[];
}

/** Phần "Widget" — giao diện nhúng. */
export interface WidgetConfigSection {
  /** Vị trí hiển thị widget trên host page. */
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Theme màu sắc — key trong palette đã đăng ký. */
  theme: 'mada-blue' | 'soft-green' | 'warm-amber' | 'neutral-gray';
  /** Border-radius, đơn vị px. */
  borderRadius: number;
  /** Có hiện avatar bubble hay không. */
  showBubbleAvatar: boolean;
  /** Cờ ngôn ngữ mặc định cho visitor. */
  defaultLanguage: LanguageCode;
  /** Ngôn ngữ bật/tắt trong widget. */
  enabledLanguages: LanguageCode[];
}

/** Phần "Behavior" — guardrails, fallback, auto-suggest. */
export interface BehaviorConfigSection {
  /** Tin nhắn fallback khi không có câu trả lời. */
  fallbackMessage: string;
  /** Có kích hoạt guardrails an toàn nội dung hay không. */
  enableGuardrails: boolean;
  /** Tin nhắn từ chối khi vi phạm guardrails. */
  refusalMessage?: string;
  /** Có tự động gợi ý câu hỏi khi idle hay không. */
  enableAutoSuggest: boolean;
  /** Giới hạn lượt truy vấn / phút (0 = unlimited). */
  rateLimitPerMinute: number;
  /** Ngưỡng confidence tối thiểu để chuyển cho admin (0..1). */
  adminEscalationThreshold: number;
}

/** Phần "Publish" — versioning + draft. */
export interface PublishConfigSection {
  status: ChatbotStatus;
  /** Phiên bản hiện tại (1, 2, 3…) tăng mỗi lần publish. */
  version: number;
  /** Ngày scheduled (optional) — null = publish ngay. */
  scheduledAt?: string | null;
  /** Note release gắn với lần publish này. */
  releaseNotes?: string;
}

/** Phần "Conversation" — greeting, AI instructions, emotion (mới, per-bot). */
export interface ConversationConfigSection {
  /** Lời chào theo ngôn ngữ (key = LanguageCode). Rỗng = dùng global. */
  greeting?: Partial<Record<LanguageCode, string>>;
  /** Mô tả/giới thiệu bot theo ngôn ngữ. */
  description?: Partial<Record<LanguageCode, string>>;
  /** AI instructions: core identity, tone, response format. */
  aiInstructions?: {
    coreIdentity?: string;
    tone?: string;
    responseFormat?: string;
    [key: string]: any;
  };
  /** Emotion settings: empathy, formality, presets, intensity. */
  emotionSettings?: {
    enabled?: boolean;
    allowLevel?: 'none' | 'low' | 'medium' | 'high';
    empathy?: number;
    formality?: number;
    intensity?: number;
    preset?: string;
    [key: string]: any;
  };
}

/** Tổng hợp config đầy đủ cho 1 chatbot — lưu local cache + đồng bộ backend. */
export interface ChatbotConfig {
  /** ID tham chiếu — nếu có agent ID thật thì bind vào, ngược lại local. */
  id: string;
  kind: ChatbotKind;
  /** Reference tới backend Agent (nullable vì widget có thể không có). */
  agentId?: string;
  /** Metadata — kế thừa từ Agent để hiển thị trong danh sách. */
  name: string;
  description: string;
  avatar: string;
  isActive: boolean;
  /** Section chính. */
  agent: AgentConfigSection;
  widget?: WidgetConfigSection;
  /** Behavior: undefined = chưa override (đang kế thừa global). */
  behavior?: BehaviorConfigSection;
  publish: PublishConfigSection;
  /** Greeting / instructions / emotion — cùng cấu trúc section Behavior về mặt API. */
  conversation?: ConversationConfigSection;
  /** Ngày tạo / cập nhật — lấy từ Agent nếu có. */
  createdAt: number;
  updatedAt: number;
}

/** Hành động mà modal sẽ gọi khi user lưu. */
export type SaveHandler = (next: ChatbotConfig) => Promise<void> | void;

/** Loại modal sẽ mở khi bấm tuỳ chỉnh. */
export type ConfigSectionId = 'agent' | 'widget' | 'behavior' | 'publish';
