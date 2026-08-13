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
  /** ⭐ MỚI: MADA category slug (e.g. 'sensory-hearing') để hiển thị + filter */
  madaCategory?: string;
  /** ⭐ MỚI: Bot ID (e.g. 'bot-hearing') để RAG filter theo domain */
  botId?: string;
}

interface AgentState {
  agents: Agent[];

  // Actions
  getActiveAgents: () => Agent[];
  getAgentsByCreator: (creator: 'admin' | 'user') => Agent[];
  getAgentById: (id: string) => Agent | undefined;
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  /** ⭐ MỚI: Add agent với ID cố định (dùng cho seed import) */
  addAgentWithId: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  setActiveAgent: (id: string) => void;
  toggleAgentActive: (id: string) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [
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
      ],

      getActiveAgents: () => get().agents.filter(a => a.isActive),

      getAgentsByCreator: (creator) => get().agents.filter(a => a.createdBy === creator),

      getAgentById: (id) => get().agents.find(a => a.id === id),

      addAgent: (agentData) => {
        const newAgent: Agent = {
          ...agentData,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          agents: [...state.agents, newAgent],
        }));
      },

      // ⭐ MỚI: Thêm agent với ID cố định (cho seed MADA bots)
      addAgentWithId: (agent: Agent) => {
        set((state) => {
          if (state.agents.some(a => a.id === agent.id)) {
            return state; // skip duplicate
          }
          return { agents: [...state.agents, agent] };
        });
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          ),
        }));
      },

      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter(a => a.id !== id),
        }));
      },

      setActiveAgent: (id) => {
        set((state) => ({
          agents: state.agents.map(a => ({
            ...a,
            isActive: a.id === id,
          })),
        }));
      },

      toggleAgentActive: (id) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, isActive: !a.isActive, updatedAt: Date.now() } : a
          ),
        }));
      },
    }),
    { name: 'mada-agents' }
  )
);

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
