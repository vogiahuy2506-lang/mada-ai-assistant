import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

const API_BASE = '/api';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  // Some proxies/old server builds may return HTML or empty body for 401.
  // Read as text first so we don't crash on `.json()`.
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

// Default agents — used as fallback when backend is unreachable
const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'default',
    name: 'MADA Assistant',
    description: 'Trợ lý ảo chính của MADA, hỗ trợ người khuyết tật tiếp cận công nghệ.',
    avatar: '🤖',
    systemPrompt: 'Bạn là MADA, trợ lý ảo thông minh hỗ trợ người khuyết tật tiếp cận công nghệ. Hãy trả lời thân thiện, hữu ích.',
    capabilities: ['chat', 'file_analysis', 'accessibility_help'],
    isActive: true,
    createdBy: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'expert',
    name: 'Chuyên gia AT',
    description: 'Chuyên gia về công nghệ hỗ trợ người khuyết tật.',
    avatar: '👨‍🏫',
    systemPrompt: 'Bạn là chuyên gia công nghệ hỗ trợ (AT Specialist). Cung cấp tư vấn chuyên sâu về thiết bị và phần mềm hỗ trợ.',
    capabilities: ['expert_consultation', 'device_recommendation', 'training'],
    isActive: true,
    createdBy: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Map backend agent → frontend Agent shape
function mapBackendAgent(a: any): Agent {
  return {
    id: a.id,
    name: a.name,
    description: a.description || '',
    avatar: a.avatar || '🤖',
    systemPrompt: a.system_prompt || '',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities : JSON.parse(a.capabilities || '[]'),
    isActive: a.isActive ?? a.is_active === 1,
    createdBy: a.created_by === 'admin' || a.createdBy === 'admin' ? 'admin' : 'user',
    createdAt: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now(),
    madaCategory: a.mada_category || a.madaCategory,
    botId: a.bot_id || a.botId,
    promptId: a.promptId || a.prompt_id || undefined,
    avatarUrl: a.avatar_url || a.avatarUrl,
    knowledgeUrl: a.knowledge_url || a.knowledgeUrl,
    productUrl: a.product_url || a.productUrl,
  };
}

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: number | null;
  syncError: string | null;
  backendConnected: boolean;

  // Sync with backend
  loadAgents: () => Promise<void>;
  refreshAgent: (id: string) => Promise<void>;

  // CRUD (sync local state)
  getActiveAgents: () => Agent[];
  getAgentsByCreator: (creator: 'admin' | 'user') => Agent[];
  getAgentById: (id: string) => Agent | undefined;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  toggleAgentActive: (id: string) => void;

  // User-friendly aliases
  addAgent: (input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: DEFAULT_AGENTS,
      isLoading: false,
      isSyncing: false,
      lastSynced: null,
      syncError: null,
      backendConnected: false,

      loadAgents: async () => {
        set({ isLoading: true, syncError: null });
        try {
          // 1) Ưu tiên endpoint public (no-auth, chỉ trả active agents).
          //    Phù hợp cho cả user thường trên ChatPage.
          let res: { success: boolean; data: any[] } | null = null;
          try {
            res = await apiRequest<{ success: boolean; data: any[] }>('/public/agents');
          } catch (pubErr) {
            // 2) Fallback: thử endpoint admin (chỉ hoạt động nếu user đã đăng nhập admin).
            console.warn('[agentStore] /public/agents failed, falling back to /admin/agents:', pubErr);
            try {
              res = await apiRequest<{ success: boolean; data: any[] }>('/admin/agents');
            } catch (adminErr) {
              // Cả 2 đều fail → dùng defaults (ví dụ: chưa đăng nhập, server tắt, proxy 401)
              throw adminErr;
            }
          }

          if (res && res.success && Array.isArray(res.data)) {
            const agents = res.data.map(mapBackendAgent);
            set({
              agents,
              lastSynced: Date.now(),
              backendConnected: true,
              isLoading: false,
            });
            return;
          }
          throw new Error('Unexpected response');
        } catch (err) {
          console.warn('[agentStore] loadAgents failed, using cached/default agents:', err);
          set((state) => ({
            isLoading: false,
            // Giữ nguyên agents đã có (cached) nếu có, fallback về DEFAULT_AGENTS
            // khi lần đầu load. Tránh xóa dữ liệu user đã customize.
            agents: state.agents && state.agents.length > 0 ? state.agents : DEFAULT_AGENTS,
            backendConnected: false,
            syncError: err instanceof Error ? err.message : 'Failed to load agents',
          }));
        }
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

      getActiveAgents: () => get().agents.filter(a => a.isActive),

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

      // Convenience wrappers used by AgentCustomizer
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
      // Only persist non-loading state
      partialize: (state) => ({
        agents: state.agents,
        lastSynced: state.lastSynced,
      }),
    }
  )
);

// Selected Agent Store (unchanged)
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
