// ===================================================================
// ============== AI ASSISTANTS — Types ==============
// ===================================================================
// Shape của 1 trợ lý sau khi merge DB + config per-bot. Tất cả section
// "override" dùng `null` nghĩa là KẾ THỪA GLOBAL (không ghi đè).

import type { LanguageCode } from './constants';

/** Widget per-bot. `null` = kế thừa widget global. */
export interface WidgetConfig {
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  theme: string;
  borderRadius: number;
  showBubbleAvatar: boolean;
  defaultLanguage: LanguageCode;
  enabledLanguages: LanguageCode[];
  /** Bật bot này trong widget nhúng hay không. */
  enabled: boolean;
}

/** Hành vi per-bot. `null` = kế thừa global. */
export interface BehaviorConfig {
  fallbackMessage: string;
  enableGuardrails: boolean;
  refusalMessage: string;
  enableAutoSuggest: boolean;
  rateLimitPerMinute: number;
  adminEscalationThreshold: number;
}

/** Trạng thái publish. `null` = dùng is_active của agent. */
export interface PublishConfig {
  status: 'draft' | 'published' | 'archived';
  version: number;
  scheduledAt: string | null;
  releaseNotes: string;
}

/** Greeting đa ngôn ngữ. */
export type GreetingMap = Partial<Record<LanguageCode, string>>;

/** Emotion settings per-bot (bổ sung cho global). */
export interface EmotionConfig {
  enabled: boolean;
  preset: string;
  intensity: 'none' | 'low' | 'medium' | 'high';
  empathy: number;
  formality: number;
}

/** Câu hỏi gợi ý gắn riêng cho bot. */
export interface SuggestedQuestion {
  id: string;
  agent_id: string | null;
  category: string;
  view_mode: 'end_user' | 'at_specialist';
  language: string;
  question: string;
  sort_order: number;
  is_active: number;
}

/** Sản phẩm (kb_products) — shape rút gọn cho UI. */
export interface StudioProduct {
  id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  price_range: string;
  product_url: string;
  image_url: string;
  iso_codes: string[];
  status: string;
  featured: boolean;
}

/** Nguồn KB đã ingest cho bot (gom theo URL). */
export interface KnowledgeSource {
  source: string;
  title: string;
  chunks: number;
  crawledAt?: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  preview: string;
  crawledAt: string | null;
}

/** Trợ lý hoàn chỉnh sau khi hydrate từ backend. */
export interface StudioBot {
  id: string;
  // ── Identity ──
  name: string;
  description: string;
  avatar: string;
  avatarUrl: string | null;
  model: string;
  madaCategory: string | null;
  botId: string | null;
  promptId: string | null;
  sortOrder: number;
  isActive: boolean;
  capabilities: string[];
  systemPrompt: string;
  knowledgeUrl: string | null;
  productUrl: string | null;
  embedCode: string | null;
  // ── Crawl status ──
  lastCrawlAt: string | null;
  lastCrawlStatus: string | null;
  lastCrawlCount: number;
  // ── Per-bot overrides (null = inherit global) ──
  widget: WidgetConfig | null;
  behavior: BehaviorConfig | null;
  publish: PublishConfig | null;
  greeting: GreetingMap | null;
  emotion: EmotionConfig | null;
  // ── Timestamps ──
  createdAt: number;
  updatedAt: number;
}

/** Payload gửi PATCH khi lưu. Chỉ field thay đổi mới được gửi. */
export interface SaveBotPayload {
  name?: string;
  description?: string;
  avatar?: string;
  avatar_url?: string | null;
  model?: string;
  system_prompt?: string;
  capabilities?: string[];
  is_active?: boolean;
  mada_category?: string | null;
  prompt_id?: string | null;
  knowledge_url?: string | null;
  product_url?: string | null;
  embed_code?: string | null;
  sort_order?: number;
  widget_config?: WidgetConfig | null;
  behavior_config?: BehaviorConfig | null;
  publish_config?: PublishConfig | null;
  greeting?: GreetingMap | null;
  emotion_settings?: EmotionConfig | null;
}

// ---------- Playground ----------

export interface PlaygroundMessage {
  role: 'user' | 'assistant';
  content: string;
  /** System note (latency, confidence…) — hiển thị dạng meta line. */
  meta?: { latencyMs?: number; confidence?: number; sources?: PlaygroundSource[] };
  error?: boolean;
}

export interface PlaygroundSource {
  title: string;
  source: string;
  score: number | null;
  preview: string;
}

export type PlaygroundResult = {
  answer: string;
  confidence: number;
  contextUsed: boolean;
  latencyMs: number;
  language: string;
  userMode: string;
  agentName: string;
  sources: PlaygroundSource[];
  systemInstructionPreview: string;
};

/** Tab trong studio. */
export type StudioTab =
  | 'basics'
  | 'prompt'
  | 'knowledge'
  | 'questions'
  | 'appearance'
  | 'behavior';

/** Defaults khi bot chưa có override riêng (kế thừa global). */
export const GLOBAL_WIDGET_DEFAULTS: WidgetConfig = {
  position: 'bottom-right',
  theme: 'mada-blue',
  borderRadius: 12,
  showBubbleAvatar: true,
  defaultLanguage: 'vi',
  enabledLanguages: ['vi', 'en'],
  enabled: true,
};

export const GLOBAL_BEHAVIOR_DEFAULTS: BehaviorConfig = {
  fallbackMessage:
    'Xin lỗi, mình chưa có câu trả lời phù hợp. Bạn có thể mô tả rõ hơn không?',
  enableGuardrails: true,
  refusalMessage: '',
  enableAutoSuggest: true,
  rateLimitPerMinute: 0,
  adminEscalationThreshold: 0.6,
};

export const GLOBAL_PUBLISH_DEFAULTS: PublishConfig = {
  status: 'draft',
  version: 1,
  scheduledAt: null,
  releaseNotes: '',
};