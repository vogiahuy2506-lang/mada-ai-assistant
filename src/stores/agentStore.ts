import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAccessToken, validateLocalToken } from '@/lib/api';

// ============== Per-chatbot config ==============
// Mỗi nhóm là JSON blob lưu trong cột TEXT của bảng `admin_agents`.
// undefined/null = chưa override → kế thừa config global từ widgetStore
// (/api/widget/config) hoặc chatSettingsStore (/api/admin/chat-settings).
export interface AgentWidgetConfig {
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  theme?: 'mada-blue' | 'soft-green' | 'warm-amber' | 'neutral-gray';
  borderRadius?: number;
  showBubbleAvatar?: boolean;
  defaultLanguage?: string;
  enabledLanguages?: string[];
}

export interface AgentBehaviorConfig {
  fallbackMessage?: string;
  enableGuardrails?: boolean;
  refusalMessage?: string;
  enableAutoSuggest?: boolean;
  rateLimitPerMinute?: number;
  adminEscalationThreshold?: number;
}

export interface AgentPublishConfig {
  status?: 'draft' | 'published' | 'archived';
  version?: number;
  scheduledAt?: string | null;
  releaseNotes?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  capabilities: string[];
  isActive: boolean;
  createdBy: 'admin' | 'user';
  createdAt: number;
  updatedAt: number;
  madaCategory?: string;
  botId?: string;
  promptId?: string;
  avatarUrl?: string;
  knowledgeUrl?: string;
  productUrl?: string;
  sortOrder?: number;

  // ── Per-chatbot config ──
  //   null   = explicit reset về global (xóa override; server set cột NULL)
  //   undefined = không truyền key (giữ nguyên DB, dành cho update từng phần)
  //   object = override riêng (ghi lên DB)
  widgetConfig?: AgentWidgetConfig | null;
  behaviorConfig?: AgentBehaviorConfig | null;
  publishConfig?: AgentPublishConfig | null;
  greeting?: Record<string, string> | null;
  aiInstructions?: Record<string, any> | null;
  emotionSettings?: Record<string, any> | null;
}

/** Parse JSON blob từ DB, trả undefined nếu rỗng/lỗi — an toàn với dữ liệu cũ. */
function parseJsonField<T>(raw: unknown): T | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'object') return raw as T;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

const API_BASE = '/api';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const netErr: any = new Error('Request timed out. Please try again.');
      netErr.status = 0;
      throw netErr;
    }
    if (err?.message === 'Failed to fetch' || err instanceof TypeError) {
      const netErr: any = new Error('Không thể kết nối server. Vui lòng kiểm tra kết nối mạng.');
      netErr.status = 0;
      throw netErr;
    }
    throw err;
  }
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const msg =
      (json && (json.error || json.message)) ||
      text ||
      res.statusText ||
      `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json as T;
}

// Default agents — ONLY used as temporary placeholder BEFORE first backend sync.
const PLACEHOLDER_AGENTS: Agent[] = [
  {
    id: '__loading__',
    name: 'Đang tải agents...',
    description: 'Vui lòng chờ trong giây lát.',
    avatar: '⏳',
    systemPrompt: '',
    capabilities: [],
    isActive: false,
    createdBy: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function mapBackendAgent(a: any): Agent {
  return {
    id: a.id,
    name: a.name,
    description: a.description || '',
    avatar: a.avatar || '🤖',
    systemPrompt: a.system_prompt || '',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
    isActive: a.isActive === true || a.is_active === 1,
    createdBy: a.created_by === 'admin' || a.createdBy === 'admin' ? 'admin' : 'user',
    createdAt: a.createdAt ? new Date(a.createdAt).getTime()
      : a.created_at ? new Date(a.created_at).getTime()
      : Date.now(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt).getTime()
      : a.updated_at ? new Date(a.updated_at).getTime()
      : Date.now(),
    madaCategory: a.mada_category || a.madaCategory,
    botId: a.bot_id || a.botId,
    promptId: a.promptId || a.prompt_id || undefined,
    avatarUrl: a.avatar_url || a.avatarUrl,
    knowledgeUrl: a.knowledge_url || a.knowledgeUrl,
    productUrl: a.product_url || a.productUrl,
    sortOrder: a.sort_order ?? a.sortOrder ?? 0,

    // ── Per-chatbot config: JSON blob trong cột TEXT ──
    widgetConfig: parseJsonField<AgentWidgetConfig>(a.widget_config ?? a.widgetConfig),
    behaviorConfig: parseJsonField<AgentBehaviorConfig>(a.behavior_config ?? a.behaviorConfig),
    publishConfig: parseJsonField<AgentPublishConfig>(a.publish_config ?? a.publishConfig),
    greeting: parseJsonField<Record<string, string>>(a.greeting),
    aiInstructions: parseJsonField<Record<string, any>>(a.ai_instructions ?? a.aiInstructions),
    emotionSettings: parseJsonField<Record<string, any>>(a.emotion_settings ?? a.emotionSettings),
  };
}

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: number | null;
  syncError: string | null;
  backendConnected: boolean;
  loadAgents: () => Promise<void>;
  forceReloadAgents: () => Promise<void>; // ⭐ Force reload từ backend, clear cache
  refreshAgent: (id: string) => Promise<void>;
  /** ⭐ Ghi agent xuống backend (POST nếu mới, PATCH nếu có) rồi cập nhật state. */
  saveAgent: (agent: Agent) => Promise<void>;
  getActiveAgents: () => Agent[];
  getAgentsByCreator: (creator: 'admin' | 'user') => Agent[];
  getAgentById: (id: string) => Agent | undefined;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  toggleAgentActive: (id: string) => void;
  addAgent: (input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
}

// Auto-sync interval
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

const clearSyncInterval = () => {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
};

const startSyncInterval = (loadFn: () => Promise<void>, intervalMs = 30_000) => {
  clearSyncInterval();
  syncIntervalId = setInterval(() => {
    loadFn();
  }, intervalMs);
};

// Create the store
const agentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: PLACEHOLDER_AGENTS,
      isLoading: false,
      isSyncing: false,
      lastSynced: null,
      syncError: null,
      backendConnected: false,

      loadAgents: async () => {
        // luôn fetch từ backend, KHÔNG sử dụng cache cũ
        // Cache chỉ dùng khi backend không accessible
        const isFirstLoad = get().lastSynced === null;
        set({ isLoading: isFirstLoad, isSyncing: !isFirstLoad, syncError: null });

        try {
          let res: { success: boolean; data: any[] } | null = null;

          // ⭐ Ưu tiên /admin/agents vì trả đầy đủ field (widget_config,
          // behavior_config, publish_config…). Chỉ fall back /public/agents khi
          // token hết hạn hoặc không có quyền admin.
          const tokenCheck = validateLocalToken();

          if (tokenCheck.valid) {
            try {
              res = await apiRequest<{ success: boolean; data: any[] }>('/admin/agents');
            } catch (adminErr) {
              // /admin thất bại → thử public endpoint
              console.warn('[agentStore] /admin/agents failed, falling back to /public/agents:', adminErr);
              try {
                res = await apiRequest<{ success: boolean; data: any[] }>('/public/agents');
              } catch (pubErr) {
                console.error('[agentStore] All endpoints failed:', adminErr, pubErr);
                set({
                  isLoading: false,
                  isSyncing: false,
                  backendConnected: false,
                  syncError: 'Backend không phản hồi. Vui lòng kiểm tra server.',
                });
                throw adminErr;
              }
            }
          } else {
            // Không có token hợp lệ → dùng public endpoint
            console.warn('[agentStore] Token không hợp lệ, dùng /public/agents:', tokenCheck.reason);
            try {
              res = await apiRequest<{ success: boolean; data: any[] }>('/public/agents');
            } catch (pubErr) {
              console.error('[agentStore] /public/agents failed:', pubErr);
              set({
                isLoading: false,
                isSyncing: false,
                backendConnected: false,
                syncError: 'Không thể kết nối backend.',
              });
              throw pubErr;
            }
          }

          if (res && res.success && Array.isArray(res.data)) {
            const agents = res.data.map(mapBackendAgent);

            set({
              agents,
              lastSynced: Date.now(),
              backendConnected: true,
              isLoading: false,
              isSyncing: false,
            });

            startSyncInterval(get().loadAgents.bind(get), 30_000);
            return;
          }
          throw new Error('Unexpected response shape');
        } catch (err) {
          console.warn('[agentStore] loadAgents failed:', err);

          const existingAgents = get().agents;
          const hasRealAgents = existingAgents.length > 0 && existingAgents[0]?.id !== '__loading__';

          set({
            isLoading: false,
            isSyncing: false,
            agents: hasRealAgents ? existingAgents : PLACEHOLDER_AGENTS,
            backendConnected: false,
            syncError: err instanceof Error ? err.message : 'Failed to load agents',
          });

          clearSyncInterval();
        }
      },

      // ⭐ Force reload agents từ backend, bỏ qua cache
      forceReloadAgents: async () => {
        // Clear sync state để buộc fetch mới
        set({ lastSynced: null, syncError: null });
        // Gọi loadAgents để fetch từ backend
        await get().loadAgents();
      },

      refreshAgent: async (id: string) => {
        try {
          const res = await apiRequest<{ success: boolean; data: any }>(`/admin/agents/${id}`);
          if (res.success && res.data) {
            const agent = mapBackendAgent(res.data);
            set((state) => ({
              agents: state.agents.map(a => a.id === id ? agent : a),
            }));
          }
        } catch (err) {
          console.warn(`[agentStore] refreshAgent(${id}) failed:`, err);
        }
      },

      // ⭐ Ghi agent xuống backend. Đây là action DUY NHẤT persist được —
      // upsertAgent/updateAgent chỉ mutate state nên mất khi reload trang.
      saveAgent: async (agent: Agent) => {
        const exists = get().agents.some((a) => a.id === agent.id && a.id !== '__loading__');

        // Chỉ gửi những field backend thực sự nhận (khớp whitelist của PATCH).
        const payload: Record<string, unknown> = {
          name: agent.name,
          description: agent.description,
          avatar: agent.avatar,
          system_prompt: agent.systemPrompt,
          capabilities: agent.capabilities,
          is_active: agent.isActive,
          mada_category: agent.madaCategory,
          prompt_id: agent.promptId,
          avatar_url: agent.avatarUrl,
          knowledge_url: agent.knowledgeUrl,
          product_url: agent.productUrl,
          sort_order: agent.sortOrder ?? 0,
          bot_id: agent.botId,
          // Per-chatbot config — null = reset về global (server set cột NULL),
          // undefined = không truyền key (giữ nguyên DB). Object = ghi override.
          ...(agent.widgetConfig !== undefined ? { widget_config: agent.widgetConfig } : {}),
          ...(agent.behaviorConfig !== undefined ? { behavior_config: agent.behaviorConfig } : {}),
          ...(agent.publishConfig !== undefined ? { publish_config: agent.publishConfig } : {}),
          ...(agent.greeting !== undefined ? { greeting: agent.greeting } : {}),
          ...(agent.aiInstructions !== undefined ? { ai_instructions: agent.aiInstructions } : {}),
          ...(agent.emotionSettings !== undefined ? { emotion_settings: agent.emotionSettings } : {}),
        };

        if (exists) {
          await apiRequest(`/admin/agents/${encodeURIComponent(agent.id)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        } else {
          // POST yêu cầu system_prompt — đảm bảo có giá trị để không bị 400.
          payload.system_prompt = agent.systemPrompt || agent.description || agent.name;
          await apiRequest('/admin/agents', {
            method: 'POST',
            body: JSON.stringify({ ...payload, id: agent.id }),
          });
        }

        // Đồng bộ lại state từ server để nhận id/timestamp chuẩn hoá.
        await get().refreshAgent(agent.id);
      },

      getActiveAgents: () => {
        const agents = get().agents.filter(a => a.isActive);
        // Sort by sortOrder (from backend sort_order), then by createdAt as fallback
        return agents.sort((a, b) => {
          const orderA = a.sortOrder ?? 0;
          const orderB = b.sortOrder ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          // Fallback: older agents first
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
      },

      getAgentsByCreator: (creator) => get().agents.filter(a => a.createdBy === creator),

      getAgentById: (id) => get().agents.find(a => a.id === id),

      setAgents: (agents) => set({ agents }),

      upsertAgent: (agent) => {
        set((state) => {
          const exists = state.agents.some(a => a.id === agent.id);
          if (exists) {
            return { agents: state.agents.map(a => a.id === agent.id ? agent : a) };
          }
          return { agents: [...state.agents, agent] };
        });
      },

      removeAgent: (id) => {
        set((state) => ({ agents: state.agents.filter(a => a.id !== id) }));
      },

      toggleAgentActive: (id) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, isActive: !a.isActive, updatedAt: Date.now() } : a
          ),
        }));
      },

      addAgent: (input) => {
        const now = Date.now();
        const id = input.id ?? `user-agent-${now}`;
        const agent: Agent = {
          id,
          name: input.name,
          description: input.description,
          avatar: input.avatar,
          systemPrompt: input.systemPrompt,
          capabilities: input.capabilities,
          isActive: input.isActive,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
          madaCategory: input.madaCategory,
          botId: input.botId,
          promptId: input.promptId,
          avatarUrl: input.avatarUrl,
          knowledgeUrl: input.knowledgeUrl,
          productUrl: input.productUrl,
        };
        set((state) => ({ agents: [...state.agents, agent] }));
      },

      updateAgent: (id, patch) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a
          ),
        }));
      },

      deleteAgent: (id) => {
        set((state) => ({ agents: state.agents.filter(a => a.id !== id) }));
      },
    }),
    {
      name: 'mada-agents',
      partialize: (state) => {
        const realAgents = state.agents.filter(a => a.id !== '__loading__');
        return {
          agents: realAgents.length > 0 ? realAgents : [],
          lastSynced: state.lastSynced,
        };
      },
    }
  )
);

export const useAgentStore = agentStore;

// Selected Agent Store
interface SelectedAgentState {
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const useSelectedAgentStore = create<SelectedAgentState>()(
  persist(
    (set) => ({
      selectedAgentId: 'default',
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
    }),
    { name: 'mada-selected-agent' }
  )
);
