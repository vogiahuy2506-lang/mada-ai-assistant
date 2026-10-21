// ============== Adapter: Agent ↔ ChatbotConfig ==============
// Giữ nguyên shape backend (Agent), chỉ wrap/unwrap để UI thao tác
// trên section rõ ràng. Không thay đổi API.

import type { Agent } from '@/stores/agentStore';
import type {
  AgentConfigSection,
  BehaviorConfigSection,
  ChatbotConfig,
  ChatbotKind,
  ConversationConfigSection,
  LanguageCode,
  PublishConfigSection,
  WidgetConfigSection,
} from './types';

const DEFAULT_LOCALES: LanguageCode[] = ['vi', 'en'];

/** Giá trị mặc định — dùng khi chatbot chưa có config riêng trong DB. */
const DEFAULT_WIDGET: WidgetConfigSection = {
  position: 'bottom-right',
  theme: 'mada-blue',
  borderRadius: 12,
  showBubbleAvatar: true,
  defaultLanguage: 'vi',
  enabledLanguages: DEFAULT_LOCALES,
};

const DEFAULT_BEHAVIOR: BehaviorConfigSection = {
  fallbackMessage: 'Xin lỗi, mình chưa có câu trả lời phù hợp. Bạn có thể mô tả rõ hơn không?',
  enableGuardrails: true,
  enableAutoSuggest: true,
  rateLimitPerMinute: 0,
  adminEscalationThreshold: 0.6,
};

const DEFAULT_PUBLISH: PublishConfigSection = {
  status: 'draft',
  version: 1,
  scheduledAt: null,
  releaseNotes: '',
};

export function inferKind(agent: Agent): ChatbotKind {
  // Agent có botId → widget nhúng; consultation → kind consultation; còn lại là 'agent'.
  if (agent.botId) return 'widget';
  return 'agent';
}

// Mặc định hardcoded — dùng khi backend chưa trả về gì (fallback cuối cùng).
// Đây là cái hiển thị khi agent không có override riêng. Khi có thì
// replace bằng config trong DB.
export function agentToChatbot(agent: Agent): ChatbotConfig {
  // DB có lưu gì không? `parseJsonField` đã trả undefined khi text rỗng.
  // Quan trọng: KHÔNG merge defaults vào saved — giữ nguyên giá trị DB
  // (kể cả khi user lưu {} hoặc đã set một số field). Tách biệt
  // "đang dùng global" (undefined) với "đã lưu override {}".
  const savedWidget = agent.widgetConfig as WidgetConfigSection | undefined;
  const savedBehavior = agent.behaviorConfig as BehaviorConfigSection | undefined;
  const savedPublish = agent.publishConfig as PublishConfigSection | undefined;

  const agentSection: AgentConfigSection = {
    model: 'gemini-2.0-flash',
    systemPrompt: agent.systemPrompt ?? '',
    madaCategory: (agent.madaCategory as AgentConfigSection['madaCategory']) ?? undefined,
    promptId: agent.promptId ?? undefined,
    knowledgeUrl: agent.knowledgeUrl ?? undefined,
    capabilities: agent.capabilities ?? [],
  };

  // Widget section:
  //  • DB có `widget_config` không null/rỗng → dùng làm override (kể cả {} là tường minh)
  //  • DB không có override → undefined = "đang kế thừa global"
  //  KHÔNG dùng `agent.botId` làm proxy — bot_id chỉ là link tới catalog,
  //  không có nghĩa widget đã được custom riêng.
  let widgetSection: WidgetConfigSection | undefined;
  if (savedWidget) {
    widgetSection = { ...DEFAULT_WIDGET, ...savedWidget };
  } else {
    widgetSection = undefined;
  }

  // Behavior section:
  //  DB có giá trị dùng; không có vẫn undefined = "đang dùng global"
  const behaviorSection: BehaviorConfigSection | undefined = savedBehavior
    ? { ...DEFAULT_BEHAVIOR, ...savedBehavior }
    : undefined;

  const publishSection: PublishConfigSection = {
    ...DEFAULT_PUBLISH,
    ...(savedPublish ?? {}),
  };

  const conversationSection: ConversationConfigSection | undefined =
    agent.greeting || agent.aiInstructions || agent.emotionSettings
      ? {
          ...(agent.greeting ? { greeting: agent.greeting } : {}),
          ...(agent.aiInstructions ? { aiInstructions: agent.aiInstructions } : {}),
          ...(agent.emotionSettings ? { emotionSettings: agent.emotionSettings } : {}),
        }
      : undefined;

  return {
    id: agent.id,
    kind: inferKind(agent),
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    avatar: agent.avatar || '🤖',
    isActive: agent.isActive,
    agent: agentSection,
    widget: widgetSection,
    behavior: behaviorSection,
    publish: publishSection,
    conversation: conversationSection,
    createdAt: agent.createdAt || Date.now(),
    updatedAt: agent.updatedAt || Date.now(),
  };
}

export function chatbotToAgent(cfg: ChatbotConfig): Partial<Agent> {
  return {
    id: cfg.agentId ?? cfg.id,
    name: cfg.name,
    description: cfg.description,
    avatar: cfg.avatar,
    isActive: cfg.isActive && cfg.publish.status === 'published',
    systemPrompt: cfg.agent.systemPrompt,
    capabilities: cfg.agent.capabilities,
    madaCategory: cfg.agent.madaCategory,
    promptId: cfg.agent.promptId,
    knowledgeUrl: cfg.agent.knowledgeUrl,
    botId: cfg.widget ? cfg.id : undefined,
    createdAt: cfg.createdAt,
    updatedAt: Date.now(),

    // ── Per-chatbot config ──
    // Khi cfg.* là undefined → kế thừa global → server PATCH sẽ set NULL.
    // Khi cfg.* là object → ghi override. Adapter trao đổi qua `null` (không phải undefined)
    // để store không skip và buộc backend nhận key này.
    widgetConfig: cfg.widget ?? null,
    behaviorConfig: cfg.behavior ?? null,
    publishConfig: cfg.publish,
    greeting: cfg.conversation?.greeting ?? null,
    aiInstructions: cfg.conversation?.aiInstructions ?? null,
    emotionSettings: cfg.conversation?.emotionSettings ?? null,
  };
}

/** Tạo local config rỗng để test trước khi backend có data. */
export function emptyLocalConfig(id: string, name: string): ChatbotConfig {
  const now = Date.now();
  return {
    id,
    kind: 'agent',
    name,
    description: '',
    avatar: '🤖',
    isActive: false,
    agent: {
      model: 'gemini-2.0-flash',
      systemPrompt: '',
      capabilities: [],
    },
    // Phân biệt "chưa override" với "đã set override":
    // local mới tạo chưa có gì → undefined = đang kế thừa global.
    widget: undefined,
    behavior: undefined,
    publish: { status: 'draft', version: 1, scheduledAt: null, releaseNotes: '' },
    createdAt: now,
    updatedAt: now,
  };
}
