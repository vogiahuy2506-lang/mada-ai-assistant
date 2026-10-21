// ===================================================================
// ============== AI ASSISTANTS — API helpers + adapters ==========
// ===================================================================
// Mọi call ở đây dùng adminApi.request (tự refresh token, timeout).
// Adapter ở cuối file map row DB → StudioBot.

import { adminApi } from '../adminApi';
import { DEFAULT_MODEL, type LanguageCode } from './constants';
import {
  GLOBAL_BEHAVIOR_DEFAULTS,
  GLOBAL_PUBLISH_DEFAULTS,
  GLOBAL_WIDGET_DEFAULTS,
  type BehaviorConfig,
  type EmotionConfig,
  type GreetingMap,
  type KnowledgeDoc,
  type KnowledgeSource,
  type PlaygroundResult,
  type PublishConfig,
  type StudioBot,
  type StudioProduct,
  type SuggestedQuestion,
  type WidgetConfig,
} from './types';

// ---------- Fetchers ----------

export const studioApi = {
  /** Load agent theo id. */
  getAgent: (id: string) => adminApi.getAgent(id),

  /** Load tất cả agent 1 lần (list 7 bot cố định đã có trong DB). */
  getAgents: async (): Promise<StudioBot[]> => {
    const res = await adminApi.getAgents();
    if (!res.success || !Array.isArray(res.data)) return [];
    return res.data.map(rowToBot);
  },

  /** Tạo agent nếu chưa tồn tại (dùng để tự động khởi tạo 7 bot). */
  createAgent: (payload: Record<string, unknown>) =>
    adminApi.createAgent(payload),

  /** Lưu cấu hình bot. */
  updateAgent: (id: string, payload: Record<string, unknown>) =>
    adminApi.updateAgent(id, payload),

  /** Upload avatar → trả về URL public. */
  uploadAvatar: async (file: File): Promise<string> => {
    const res = await adminApi.uploadAgentAvatar(file);
    if (!res.success) throw new Error((res as { error?: string }).error || 'Upload thất bại');
    return res.data.url;
  },

  // ---- Products ----

  /** Sản phẩm đã gán riêng cho bot. */
  getLinkedProducts: async (agentId: string): Promise<StudioProduct[]> => {
    const res = await adminApi.getAgentLinkedProducts(agentId);
    return res.success && res.data ? res.data.items : [];
  },

  /** Tìm sản phẩm trong catalog để gán. */
  searchProducts: async (q: string, category?: string): Promise<StudioProduct[]> => {
    const res = await adminApi.getProducts({ q, category, limit: 30 });
    if (!res.success || !res.data) return [];
    // Normalize iso_codes thành mảng
    return (res.data.items as any[]).map((p) => ({
      ...p,
      iso_codes: Array.isArray(p.iso_codes)
        ? p.iso_codes
        : p.iso_codes
          ? String(p.iso_codes).split(',').map((s) => s.trim()).filter(Boolean)
          : [],
    })) as StudioProduct[];
  },

  linkProduct: (agentId: string, productId: string) =>
    adminApi.linkAgentProduct(agentId, productId),

  unlinkProduct: (agentId: string, productId: string) =>
    adminApi.unlinkAgentProduct(agentId, productId),

  /** Auto-gán theo mada_category. */
  syncProductsByCategory: (agentId: string, category?: string) =>
    adminApi.syncAgentProducts(agentId, category),

  // ---- Knowledge ----

  getKnowledge: async (agentId: string): Promise<{
    totalChunks: number;
    sources: KnowledgeSource[];
    documents: KnowledgeDoc[];
  }> => {
    const res = await adminApi.getAgentKnowledge(agentId);
    if (!res.success || !res.data) return { totalChunks: 0, sources: [], documents: [] };
    return res.data;
  },

  /** Cào nguồn (knowledge_url + product_urls) → ingest vào KB của bot. */
  crawlAgent: (agentId: string, payload: {
    knowledge_url?: string;
    product_urls?: string[];
    crawl_follow_links?: boolean;
    crawl_max_depth?: number;
    crawl_max_pages?: number;
  }) =>
    adminApi.crawlAgentSources(agentId, {
      knowledge_url: payload.knowledge_url,
      product_urls: payload.product_urls,
      crawl_follow_links: payload.crawl_follow_links ? (1 as 0 | 1) : (0 as 0 | 1),
      crawl_max_depth: payload.crawl_max_depth,
      crawl_max_pages: payload.crawl_max_pages,
    }),

  /** Thêm KB thủ công: text hoặc URL. */
  addKnowledge: (agentId: string, payload: {
    type: 'text' | 'web';
    content: string;
    title?: string;
    language?: string;
  }) => adminApi.addAgentKnowledge(agentId, payload),

  // ---- Questions ----

  getQuestions: async (agentId: string): Promise<SuggestedQuestion[]> => {
    const res = await adminApi.getAgentQuestions(agentId);
    return res.success && res.data ? res.data : [];
  },

  createQuestion: (payload: {
    agent_id: string;
    category: string;
    view_mode: string;
    language: string;
    question: string;
    sort_order?: number;
    is_active?: boolean;
  }) => adminApi.createSuggestedQuestion(payload),

  /** Nhập 1 câu tiếng Việt → tự tạo đủ 4 ngôn ngữ. */
  autoTranslateQuestion: (payload: {
    question_vi: string;
    category: string;
    view_mode?: string;
    agent_id?: string | null;
  }) => adminApi.autoTranslateQuestion(payload),

  updateQuestion: (id: string, updates: Partial<SuggestedQuestion>) =>
    adminApi.updateSuggestedQuestion(id, updates as any),

  deleteQuestion: (id: string) => adminApi.deleteSuggestedQuestion(id),

  // ---- Playground ----

  sendPlayground: (agentId: string, payload: {
    message: string;
    history: Array<{ role: string; content: string }>;
    language: LanguageCode;
    draftPrompt?: string;
  }) => adminApi.agentPlayground(agentId, { ...payload, userMode: 'endUser' }),

  previewPrompt: (agentId: string, params: {
    language?: string;
    userMode?: string;
    draftPrompt?: string;
  }) => adminApi.previewAgentPrompt(agentId, params),
};

// ---------- Adapters ----------

/** Parse JSON blob từ DB — trả undefined nếu rỗng/lỗi. */
function parseJson<T>(raw: unknown): T | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'object') return raw as T;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Map row `admin_agents` từ backend → StudioBot. */
export function rowToBot(row: any): StudioBot {
  const widgetRaw = parseJson<Partial<WidgetConfig>>(row.widget_config ?? row.widgetConfig);
  const behaviorRaw = parseJson<Partial<BehaviorConfig>>(row.behavior_config ?? row.behaviorConfig);
  const publishRaw = parseJson<Partial<PublishConfig>>(row.publish_config ?? row.publishConfig);
  const greetingRaw = parseJson<GreetingMap>(row.greeting);
  const emotionRaw = parseJson<Partial<EmotionConfig>>(
    row.emotion_settings ?? row.emotionSettings,
  );

  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    avatar: row.avatar || '🤖',
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    model: row.model || DEFAULT_MODEL,
    madaCategory: row.mada_category ?? row.madaCategory ?? null,
    botId: row.bot_id ?? row.botId ?? null,
    promptId: row.prompt_id ?? row.promptId ?? null,
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    isActive: row.isActive === true || row.is_active === 1,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    systemPrompt: row.system_prompt ?? row.systemPrompt ?? '',
    knowledgeUrl: row.knowledge_url ?? row.knowledgeUrl ?? null,
    productUrl: row.product_url ?? row.productUrl ?? null,
    embedCode: row.embed_code ?? row.embedCode ?? null,
    lastCrawlAt: row.last_crawl_at ?? row.lastCrawlAt ?? null,
    lastCrawlStatus: row.last_crawl_status ?? row.lastCrawlStatus ?? null,
    lastCrawlCount: row.last_crawl_count ?? row.lastCrawlCount ?? 0,
    // undefined = chưa override → hiển thị null (kế thừa global)
    widget: widgetRaw ? { ...GLOBAL_WIDGET_DEFAULTS, ...widgetRaw } : null,
    behavior: behaviorRaw ? { ...GLOBAL_BEHAVIOR_DEFAULTS, ...behaviorRaw } : null,
    publish: { ...GLOBAL_PUBLISH_DEFAULTS, ...(publishRaw ?? {}) },
    greeting: greetingRaw ?? null,
    emotion: emotionRaw ? (emotionRaw as EmotionConfig) : null,
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : row.createdAt ?? Date.now(),
    updatedAt: row.updated_at
      ? new Date(row.updated_at).getTime()
      : row.updatedAt ?? Date.now(),
  };
}

export type { PlaygroundResult };