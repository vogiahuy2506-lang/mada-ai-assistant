// ============== Chatbot Center Store ==============
// Lưu trữ local các ChatbotConfig hiện đang chỉnh sửa.
// Khi user lưu từng modal → đẩy vào đây, sau đó cuối cùng batch save
// gọi adminApi để đồng bộ backend. Tách biệt với agentStore để không
// đổi hành vi hiện tại.

import { create } from 'zustand';
import type { ChatbotConfig, ConfigSectionId } from './types';
import { agentToChatbot, emptyLocalConfig } from './adapters';
import type { Agent } from '@/stores/agentStore';

interface ChatbotCenterState {
  /** Map id → config đang chỉnh (gồm cả local + bound vào agent). */
  configs: Record<string, ChatbotConfig>;
  /** Modal đang mở, null = không mở. */
  openSection: { chatbotId: string; section: ConfigSectionId } | null;
  /** Pending save flag cho mỗi id — dùng để khóa nút lưu. */
  savingIds: Set<string>;

  hydrateFromAgents: (agents: Agent[]) => void;
  upsertLocal: (cfg: ChatbotConfig) => void;
  patchSection: (
    id: string,
    section: ConfigSectionId,
    patch: Partial<ChatbotConfig['agent'] & ChatbotConfig['widget'] & ChatbotConfig['behavior'] & ChatbotConfig['publish']>,
  ) => void;
  remove: (id: string) => void;
  openConfig: (chatbotId: string, section: ConfigSectionId) => void;
  closeConfig: () => void;
  markSaving: (id: string, on: boolean) => void;
  reset: () => void;
}

export const useChatbotCenterStore = create<ChatbotCenterState>()((set) => ({
  configs: {},
  openSection: null,
  savingIds: new Set(),

  hydrateFromAgents: (agents) =>
    set(() => {
      // Quan trọng: REPLACE toàn bộ configs từ agents mới. KHÔNG
      // giữ lại config cũ — tránh stale state khi server đổi field.
      const next: Record<string, ChatbotConfig> = {};
      agents.forEach((a) => {
        const cfg = agentToChatbot(a);
        next[cfg.id] = cfg;
      });
      if (agents.length === 0) {
        next['__local_default__'] = emptyLocalConfig('__local_default__', 'MADA Default');
      }
      return { configs: next };
    }),

  upsertLocal: (cfg) =>
    set((s) => ({ configs: { ...s.configs, [cfg.id]: cfg } })),

  patchSection: (id, section, patch) =>
    set((s) => {
      const cur = s.configs[id];
      if (!cur) return s;
      const updated: ChatbotConfig = (() => {
        switch (section) {
          case 'agent':
            return { ...cur, agent: { ...cur.agent, ...(patch as any) } };
          case 'widget':
            return {
              ...cur,
              widget: { ...(cur.widget ?? {} as any), ...(patch as any) },
            };
          case 'behavior':
            return { ...cur, behavior: { ...cur.behavior, ...(patch as any) } };
          case 'publish':
            return {
              ...cur,
              publish: { ...cur.publish, ...(patch as any) },
              isActive: (patch as any)?.status === 'published',
            };
        }
      })();
      updated.updatedAt = Date.now();
      return { configs: { ...s.configs, [id]: updated } };
    }),

  remove: (id) =>
    set((s) => {
      const next = { ...s.configs };
      delete next[id];
      return { configs: next };
    }),

  openConfig: (chatbotId, section) => set({ openSection: { chatbotId, section } }),
  closeConfig: () => set({ openSection: null }),
  markSaving: (id, on) =>
    set((s) => {
      const next = new Set(s.savingIds);
      if (on) next.add(id);
      else next.delete(id);
      return { savingIds: next };
    }),
  reset: () => set({ configs: {}, openSection: null }),
}));
