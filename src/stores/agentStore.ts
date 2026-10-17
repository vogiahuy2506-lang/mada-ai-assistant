import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAccessToken, validateLocalToken } from '@/lib/api';

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

          try {
            res = await apiRequest<{ success: boolean; data: any[] }>('/public/agents');
          } catch (pubErr) {
            // ⭐ Fix: Validate token locally before falling back to /admin/agents
            // This prevents 401 errors when the stored token is expired or invalid
            const tokenCheck = validateLocalToken();
            if (tokenCheck.valid) {
              console.warn('[agentStore] /public/agents failed, falling back to /admin/agents:', pubErr);
              try {
                res = await apiRequest<{ success: boolean; data: any[] }>('/admin/agents');
              } catch (adminErr) {
                // ⭐ NẾU FETCH THẤT BẠI: KHÔNG sử dụng cache cũ nữa
                // Buộc phải báo lỗi để user biết backend không hoạt động
                console.error('[agentStore] All endpoints failed:', pubErr, adminErr);
                set({
                  isLoading: false,
                  isSyncing: false,
                  backendConnected: false,
                  syncError: 'Backend không phản hồi. Vui lòng kiểm tra server.',
                });
                throw pubErr; // Re-throw để báo lỗi
              }
            } else {
              console.warn('[agentStore] Token invalid, skipping /admin/agents fallback:', tokenCheck.reason);
              // ⭐ KHÔNG sử dụng cache cũ - báo lỗi
              set({
                isLoading: false,
                isSyncing: false,
                backendConnected: false,
                syncError: 'Token hết hạn. Vui lòng đăng nhập lại.',
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
