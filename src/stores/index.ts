import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole, UserPlan, ChatMessage, Language, Notification, ViewMode } from '@/types';
import { authApi, setTokens, clearTokens, getAccessToken, type ApiUser } from '@/lib/api';

// Limits per plan (admin có thể override trong system settings)
// -1 = unlimited
export const PLAN_LIMITS: Record<UserPlan, number> = {
  free: -1,  // Mặc định không giới hạn
  pro: -1,
  enterprise: -1,
};

// Giới hạn mặc định cho anonymous users (admin có thể set lại)
export const ANONYMOUS_LIMIT = -1; // -1 = không giới hạn mặc định

function apiUserToUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    avatar: u.avatar ?? undefined,
    quotaUsed: u.quotaUsed,
    quotaLimit: u.quotaLimit,
    provider: u.provider as 'email' | 'google',
    createdAt: new Date(u.createdAt),
    lastLogin: u.lastLogin ? new Date(u.lastLogin) : undefined,
  };
}

// Auth Store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  hasRole: (role: UserRole) => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  setPlan: (plan: UserPlan) => void;
  incrementQuota: () => void;
  decrementQuota: () => void;
  resetQuota: () => void;
  canSendMessage: () => boolean;
  getRemainingQuota: () => number;

  // API actions
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (data: { accessToken: string; refreshToken: string; expiresAt: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // ignore
        }
        clearTokens();
        set({ user: null, isAuthenticated: false });
        // Clear permissions
        import('@/stores').then(({ usePermissionsStore }) => {
          usePermissionsStore.getState().clear();
        });
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      hasRole: (role) => {
        const u = get().user;
        if (!u) return false;
        // Super Admin có quyền cao nhất - truy cập tất cả
        if (u.role === 'super_admin') return true;
        // Admin thường chỉ có quyền admin
        if (u.role === 'admin' && role === 'admin') return true;
        // Các role khác kiểm tra exact match
        return u.role === role;
      },
      isSuperAdmin: () => {
        const u = get().user;
        return u?.role === 'super_admin';
      },
      isAdmin: () => {
        const u = get().user;
        return u?.role === 'admin' || u?.role === 'super_admin';
      },
      setPlan: (plan) => set((state) => {
        if (!state.user) return state;
        const limit = PLAN_LIMITS[plan];
        return {
          user: {
            ...state.user,
            plan,
            quotaLimit: limit,
            quotaUsed: plan === 'free' ? 0 : state.user.quotaUsed,
          },
        };
      }),
      incrementQuota: () => set((state) => {
        if (!state.user) return state;
        return {
          user: { ...state.user, quotaUsed: state.user.quotaUsed + 1 },
        };
      }),
      decrementQuota: () => set((state) => {
        if (!state.user || state.user.quotaUsed <= 0) return state;
        return {
          user: { ...state.user, quotaUsed: state.user.quotaUsed - 1 },
        };
      }),
      resetQuota: () => set((state) => {
        if (!state.user) return state;
        return {
          user: { ...state.user, quotaUsed: 0 },
        };
      }),
      canSendMessage: () => {
        const { user } = get();
        if (!user) return false;
        if (user.quotaLimit === -1) return true;
        return user.quotaUsed < user.quotaLimit;
      },
      getRemainingQuota: () => {
        const { user } = get();
        if (!user) return 0;
        if (user.quotaLimit === -1) return Infinity;
        return Math.max(0, user.quotaLimit - user.quotaUsed);
      },

      loginWithEmail: async (email, password) => {
        set({ isLoading: true });
        const res = await authApi.login(email, password);
        if (!res.success) {
          set({ isLoading: false });
          return { success: false, error: res.error };
        }
        setTokens(res.data.accessToken, res.data.refreshToken);
        const user = apiUserToUser(res.data.user);
        set({ user, isAuthenticated: true, isLoading: false });
        
        // Load user permissions
        import('@/stores').then(({ usePermissionsStore }) => {
          usePermissionsStore.getState().loadPermissions();
        });
        
        return { success: true };
      },

      registerWithEmail: async (email, password, name) => {
        set({ isLoading: true });
        const res = await authApi.register(email, password, name);
        if (!res.success) {
          set({ isLoading: false });
          return { success: false, error: res.error };
        }
        setTokens(res.data.accessToken, res.data.refreshToken);
        const user = apiUserToUser(res.data.user);
        set({ user, isAuthenticated: true, isLoading: false });
        
        // Load user permissions
        import('@/stores').then(({ usePermissionsStore }) => {
          usePermissionsStore.getState().loadPermissions();
        });
        
        return { success: true };
      },

      refreshUser: async () => {
        if (!getAccessToken()) return;
        const res = await authApi.me();
        if (res.success) {
          const user = apiUserToUser(res.data.user);
          set({ user, isAuthenticated: true });
          
          // Load user permissions
          import('@/stores').then(({ usePermissionsStore }) => {
            usePermissionsStore.getState().loadPermissions();
          });
        }
      },

      loginWithGoogle: async (data) => {
        // Set tokens from Google OAuth callback
        setTokens(data.accessToken, data.refreshToken);
        
        // Fetch user info
        const res = await authApi.me();
        if (res.success) {
          const user = apiUserToUser(res.data.user);
          set({ user, isAuthenticated: true });
          
          // Load user permissions
          import('@/stores').then(({ usePermissionsStore }) => {
            usePermissionsStore.getState().loadPermissions();
          });
        }
      },
    }),
    {
      name: 'mada-auth',
      partialize: (state) => ({
        user: state.user
          ? {
              ...state.user,
              createdAt: state.user.createdAt.toISOString(),
              lastLogin: state.user.lastLogin?.toISOString(),
            }
          : null,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure user dates are Date objects after hydration
        if (state?.user?.createdAt && typeof state.user.createdAt === 'string') {
          state.user.createdAt = new Date(state.user.createdAt);
        }
        if (state?.user?.lastLogin && typeof state.user.lastLogin === 'string') {
          state.user.lastLogin = new Date(state.user.lastLogin);
        }
      },
      merge: (persisted: unknown, current) => {
        // Handle null/undefined persisted state
        if (!persisted) return current;
        
        const p = persisted as { user?: Record<string, unknown> | null; isAuthenticated?: boolean };
        
        return {
          ...current,
          isAuthenticated: p.isAuthenticated ?? false,
          user: p.user
            ? {
                ...p.user,
                createdAt: p.user.createdAt ? new Date(p.user.createdAt as string) : new Date(),
                lastLogin: p.user.lastLogin ? new Date(p.user.lastLogin as string) : undefined,
              } as User
            : null,
        };
      },
    }
  )
);

// Anonymous quota store (for non-logged-in users)
interface AnonQuotaState {
  used: number;
  limit: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  canSend: () => boolean;
  remaining: () => number;
}

export const useAnonQuotaStore = create<AnonQuotaState>()(
  persist(
    (set, get) => ({
      used: 0,
      limit: -1, // Sẽ được kiểm tra từ system settings
      increment: () => set((s) => ({ used: s.used + 1 })),
      decrement: () => set((s) => ({ used: Math.max(0, s.used - 1) })),
      reset: () => set({ used: 0 }),
      canSend: () => {
        const limit = useSystemSettingsStore.getState().anonymousLimit;
        if (limit === -1) return true; // Không giới hạn
        return get().used < limit;
      },
      remaining: () => {
        const limit = useSystemSettingsStore.getState().anonymousLimit;
        if (limit === -1) return -1; // Không giới hạn
        return Math.max(0, limit - get().used);
      },
    }),
    { name: 'mada-anon-quota' }
  )
);

// Auth Modal Store (global control)
interface AuthModalState {
  isOpen: boolean;
  mode: 'login' | 'register';
  open: (mode?: 'login' | 'register') => void;
  close: () => void;
  switchMode: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set, get) => ({
  isOpen: false,
  mode: 'login',
  open: (mode = 'login') => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false }),
  switchMode: () => set({ mode: get().mode === 'login' ? 'register' : 'login' }),
}));

// Paywall Modal Store
interface PaywallModalState {
  isOpen: boolean;
  reason: 'anonymous_exhausted' | 'user_exhausted' | 'file_upload_exhausted';
  open: (reason?: 'anonymous_exhausted' | 'user_exhausted' | 'file_upload_exhausted') => void;
  close: () => void;
}

export const usePaywallModalStore = create<PaywallModalState>((set) => ({
  isOpen: false,
  reason: 'user_exhausted',
  open: (reason = 'user_exhausted') => set({ isOpen: true, reason }),
  close: () => set({ isOpen: false }),
}));

// Language Store
interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'vi',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'mada-language' }
  )
);

// Chat Store
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  conversationId: string | null;
  // ⭐ Edit message state
  editingMessageId: string | null;
  editingMessageText: string;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setConversationId: (id: string | null) => void;
  setEditingMessage: (id: string | null, text?: string) => void;
}

// Conversation history entry (for sidebar recent list)
export interface HistoryConversation {
  id: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  preview: string; // last user message
  messages: number;
  pinned?: boolean;
  category?: string | null;
  createdAt: number; // unix ms
  updatedAt: number;
  messagesData?: string; // JSON stringified ChatMessage[] để persist
}

interface ChatHistoryState {
  conversations: HistoryConversation[];
  searchQuery: string;
  addOrUpdateConversation: (conv: HistoryConversation) => void;
  touchConversation: (id: string, preview: string) => void;
  pinConversation: (id: string) => void;
  removeConversation: (id: string) => void;
  clearAll: () => void;
  setSearchQuery: (q: string) => void;
  filteredConversations: () => HistoryConversation[];
  getMessagesForConversation: (id: string) => ChatMessage[];
  saveConversationMessages: (id: string, messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  conversationId: null,
  // ⭐ Edit message state
  editingMessageId: null,
  editingMessageText: '',
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }],
  })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setLoading: (isLoading) => set({ isLoading }),
  setConversationId: (conversationId) => set({ conversationId }),
  setEditingMessage: (id, text) => set({ editingMessageId: id, editingMessageText: text ?? '' }),
}));

// Conversation history store (persisted)
export const useChatHistoryStore = create<ChatHistoryState>()(
  persist(
    (set, get) => ({
      conversations: [],
      searchQuery: '',
      addOrUpdateConversation: (conv) => set((state) => {
        const existing = state.conversations.find((c) => c.id === conv.id);
        const now = conv.updatedAt || Date.now();
        if (existing) {
          return {
            conversations: state.conversations.map((c) =>
              c.id === conv.id
                ? { ...c, ...conv, updatedAt: now }
                : c
            ),
          };
        }

        // Limit for anonymous users (conversation IDs starting with 'anon-')
        let updatedConversations = state.conversations;
        if (conv.id.startsWith('anon-')) {
          // Keep only pinned + latest 5 conversations
          const nonPinned = updatedConversations.filter(c => !c.pinned);
          if (nonPinned.length >= 5) {
            // Sort by updatedAt and remove oldest
            nonPinned.sort((a, b) => a.updatedAt - b.updatedAt);
            const toRemove = nonPinned.slice(0, nonPinned.length - 4); // Keep 5 latest
            updatedConversations = updatedConversations.filter(c =>
              !toRemove.some(r => r.id === c.id)
            );
          }
        }

        return {
          conversations: [
            { ...conv, createdAt: conv.createdAt || now, updatedAt: now },
            ...updatedConversations,
          ],
        };
      }),
      touchConversation: (id, preview) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id
            ? { ...c, preview, messages: c.messages + 1, updatedAt: Date.now() }
            : c
        ),
      })),
      pinConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, pinned: !c.pinned } : c
        ),
      })),
      removeConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
      })),
      clearAll: () => set({ conversations: [] }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filteredConversations: () => {
        const { conversations, searchQuery } = get();
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
          ? conversations.filter(
              (c) =>
                c.title.toLowerCase().includes(q) ||
                (c.preview ?? '').toLowerCase().includes(q)
            )
          : conversations;
        // pinned first, then sorted by updatedAt desc
        return [...filtered].sort((a, b) => {
          if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
          return b.updatedAt - a.updatedAt;
        });
      },
      getMessagesForConversation: (id) => {
        const conv = get().conversations.find((c) => c.id === id);
        if (!conv || !conv.messagesData) return [];
        try {
          return JSON.parse(conv.messagesData) as ChatMessage[];
        } catch {
          return [];
        }
      },
      saveConversationMessages: (id, messages) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, messagesData: JSON.stringify(messages) } : c
        ),
      })),
    }),
    {
      name: 'mada-chat-history',
      partialize: (state) => ({ conversations: state.conversations }),
    }
  )
);

// Theme Store
interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setTheme: (isDark) => set({ isDark }),
    }),
    { name: 'mada-theme' }
  )
);

// Notification Store
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    if (notification && !notification.read) {
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }
    return state;
  }),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),
  removeNotification: (id) => set((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    return {
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: notification && !notification.read
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    };
  }),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// Consultation Store
interface ConsultationState {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useConsultationStore = create<ConsultationState>((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));

// View Mode Store - End-User vs AT Specialist Mode
interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set, get) => ({
      viewMode: 'end_user',
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () => set({ viewMode: get().viewMode === 'end_user' ? 'at_specialist' : 'end_user' }),
    }),
    { name: 'mada-view-mode' }
  )
);

// System Settings Store (Admin-configurable)
interface SystemSettingsState {
  // AI Limits
  anonymousLimit: number; // -1 = unlimited
  defaultPlanLimit: number; // -1 = unlimited for default free plan

  // File Upload Limits
  maxFilesPerSession: number; // max 10 files per chat session
  maxFilesTotal: number; // max 100 files total
  maxFileSizeMB: number; // max file size in MB (default 50)

  // Website URL for data collection
  websiteUrl: string;

  // Actions
  setAnonymousLimit: (limit: number) => void;
  setDefaultPlanLimit: (limit: number) => void;
  setWebsiteUrl: (url: string) => void;
  setMaxFilesPerSession: (limit: number) => void;
  setMaxFilesTotal: (limit: number) => void;
  setMaxFileSizeMB: (size: number) => void;
  setAllSettings: (settings: Partial<SystemSettingsState>) => void; // Set all from backend
  loadFromBackend: () => Promise<void>; // Load from API
}

export const useSystemSettingsStore = create<SystemSettingsState>()(
  persist(
    (set) => ({
      anonymousLimit: -1, // Mặc định không giới hạn
      defaultPlanLimit: -1, // Mặc định không giới hạn cho plan
      websiteUrl: '',

      // File upload limits - theo yêu cầu sếp
      maxFilesPerSession: 10,
      maxFilesTotal: 100,
      maxFileSizeMB: 50,

      setAnonymousLimit: (limit) => set({ anonymousLimit: limit }),
      setDefaultPlanLimit: (limit) => set({ defaultPlanLimit: limit }),
      setWebsiteUrl: (url) => set({ websiteUrl: url }),
      setMaxFilesPerSession: (limit) => set({ maxFilesPerSession: limit }),
      setMaxFilesTotal: (limit) => set({ maxFilesTotal: limit }),
      setMaxFileSizeMB: (size) => set({ maxFileSizeMB: size }),
      setAllSettings: (settings) => set(settings),
      loadFromBackend: async () => {
        try {
          const res = await fetch('/api/system/settings');
          const data = await res.json();
          if (data.success) {
            set({
              anonymousLimit: data.data.anonymousLimit ?? -1,
              defaultPlanLimit: data.data.defaultPlanLimit ?? -1,
              maxFilesPerSession: data.data.maxFilesPerSession ?? 10,
              maxFilesTotal: data.data.maxFilesTotal ?? 100,
              maxFileSizeMB: data.data.maxFileSizeMB ?? 50,
              websiteUrl: data.data.websiteUrl ?? '',
            });
          }
        } catch (e) {
          console.error('Failed to load system settings:', e);
        }
      },
    }),
    { name: 'mada-system-settings' }
  )
);

// Re-export agent stores
export { useAgentStore, useSelectedAgentStore } from './agentStore';
export type { Agent } from './agentStore';

// Re-export prompt store (shared between /admin/prompts and /admin/agents)
export { usePromptStore } from './promptStore';
export type { SystemPromptRow } from './promptStore';

// Re-export ChatSettingsStore
export { useChatSettingsStore } from './chatSettingsStore';
export type { SuggestedPrompt, AIInstructions, EmotionSettings, EmotionPreset, EmotionIntensity, ResponseStyle } from './chatSettingsStore';

// Re-export WidgetSettingsStore
export { useWidgetSettingsStore } from './widgetStore';
export type { WidgetConfig } from './widgetStore';

// ============== PERMISSIONS STORE ==============

// Permission types
export type Permission =
  | 'users:read' | 'users:create' | 'users:update' | 'users:delete' | 'users:manage_roles'
  | 'kb:read' | 'kb:create' | 'kb:update' | 'kb:delete' | 'kb:publish' | 'kb:import' | 'kb:export'
  | 'products:read' | 'products:create' | 'products:update' | 'products:delete' | 'products:approve' | 'products:import' | 'products:export'
  | 'agents:read' | 'agents:create' | 'agents:update' | 'agents:delete' | 'agents:configure' | 'agents:view_logs'
  | 'prompts:read' | 'prompts:create' | 'prompts:update' | 'prompts:delete' | 'prompts:publish'
  | 'settings:read' | 'settings:update' | 'settings:manage_permissions' | 'settings:manage_plans'
  | 'scrape:read' | 'scrape:create' | 'scrape:execute' | 'scrape:cancel'
  | 'analytics:read' | 'analytics:export'
  | 'audit:read'
  | 'consultations:read' | 'consultations:respond' | 'consultations:delete'
  | 'files:upload' | 'files:delete'
  | 'chat:use' | 'chat:export';

// Feature types for easier checking
export type Feature =
  | 'admin_panel' | 'user_management' | 'kb_management' | 'product_management'
  | 'scraper' | 'analytics' | 'audit_logs' | 'consultations'
  | 'file_upload' | 'chat_export';

// Permission store for caching user permissions
interface PermissionsState {
  effectivePermissions: string[];
  customPermissions: string[];
  deniedPermissions: string[];
  features: Record<Feature, boolean>;
  isLoaded: boolean;
  
  // Actions
  loadPermissions: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasFeature: (feature: Feature) => boolean;
  clear: () => void;
}

// Feature to permission mapping
const FEATURE_PERMISSIONS: Record<Feature, Permission[]> = {
  admin_panel: ['users:read', 'settings:read'],
  user_management: ['users:read', 'users:update'],
  kb_management: ['kb:read', 'kb:create'],
  product_management: ['products:read', 'products:create'],
  scraper: ['scrape:read', 'scrape:execute'],
  analytics: ['analytics:read'],
  audit_logs: ['audit:read'],
  consultations: ['consultations:read'],
  file_upload: ['files:upload'],
  chat_export: ['chat:export'],
};

export const usePermissionsStore = create<PermissionsState>()((set, get) => ({
  effectivePermissions: [],
  customPermissions: [],
  deniedPermissions: [],
  features: {
    admin_panel: false,
    user_management: false,
    kb_management: false,
    product_management: false,
    scraper: false,
    analytics: false,
    audit_logs: false,
    consultations: false,
    file_upload: false,
    chat_export: false,
  },
  isLoaded: false,
  
  loadPermissions: async () => {
    // Skip if not logged in (no token = anonymous user)
    const token = localStorage.getItem('mada-access-token');
    if (!token) {
      return;
    }
    try {
      const res = await fetch('/api/permissions/my', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        const { effectivePermissions, customPermissions, deniedPermissions, features } = data.data;
        
        set({
          effectivePermissions,
          customPermissions,
          deniedPermissions,
          features,
          isLoaded: true,
        });
      }
    } catch (e) {
      console.error('Failed to load permissions:', e);
    }
  },
  
  hasPermission: (permission) => {
    const { effectivePermissions } = get();
    return effectivePermissions.includes(permission);
  },
  
  hasFeature: (feature) => {
    const { features } = get();
    return features[feature] || false;
  },
  
  clear: () => {
    set({
      effectivePermissions: [],
      customPermissions: [],
      deniedPermissions: [],
      features: {
        admin_panel: false,
        user_management: false,
        kb_management: false,
        product_management: false,
        scraper: false,
        analytics: false,
        audit_logs: false,
        consultations: false,
        file_upload: false,
        chat_export: false,
      },
      isLoaded: false,
    });
  },
}));

// Hook for checking permissions
export function useHasPermission(permission: Permission): boolean {
  return usePermissionsStore((s) => s.effectivePermissions.includes(permission));
}

// Hook for checking features
export function useHasFeature(feature: Feature): boolean {
  return usePermissionsStore((s) => s.features[feature] || false);
}

