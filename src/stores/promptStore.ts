import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAccessToken } from '@/lib/api';

export interface SystemPromptRow {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  language: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
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

interface PromptState {
  prompts: SystemPromptRow[];
  loading: boolean;
  loaded: boolean;
  lastSynced: number | null;

  loadPrompts: (force?: boolean) => Promise<void>;
  upsertPrompt: (p: SystemPromptRow) => void;
  removePrompt: (id: string) => void;
  setPrompts: (p: SystemPromptRow[]) => void;
}

/**
 * Shared prompt store used by /admin/prompts (full CRUD) and
 * /admin/agents (read-only dropdown).
 *
 * Persisted to localStorage so creating a new prompt on the Prompts page
 * immediately makes it available on the Agents page without a full reload.
 */
export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      prompts: [],
      loading: false,
      loaded: false,
      lastSynced: null,

      loadPrompts: async (force = false) => {
        if (get().loading) return;
        // Skip if already loaded in this session (unless force=true)
        if (get().loaded && !force) return;
        set({ loading: true });
        try {
          const res = await apiRequest<{ success: boolean; data: any[] }>(
            '/admin/system-prompts'
          );
          const list: SystemPromptRow[] = (res.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            prompt: p.prompt,
            category: p.category,
            language: p.language,
            isActive: p.isActive ?? p.is_active === 1,
            isSystem: p.isSystem ?? p.is_system === 1,
            createdAt: p.createdAt || p.created_at || '',
            updatedAt: p.updatedAt || p.updated_at || '',
          }));
          set({
            prompts: list,
            loading: false,
            loaded: true,
            lastSynced: Date.now(),
          });
        } catch (err) {
          console.warn('[promptStore] loadPrompts failed:', err);
          set({ loading: false, loaded: true });
        }
      },

      upsertPrompt: (p) =>
        set((state) => {
          const exists = state.prompts.some((x) => x.id === p.id);
          if (exists) {
            return {
              prompts: state.prompts.map((x) => (x.id === p.id ? p : x)),
              lastSynced: Date.now(),
            };
          }
          return { prompts: [p, ...state.prompts], lastSynced: Date.now() };
        }),

      removePrompt: (id) =>
        set((state) => ({
          prompts: state.prompts.filter((p) => p.id !== id),
          lastSynced: Date.now(),
        })),

      setPrompts: (p) => set({ prompts: p, lastSynced: Date.now() }),
    }),
    {
      name: 'mada-prompts',
      partialize: (state) => ({ prompts: state.prompts, lastSynced: state.lastSynced }),
    }
  )
);