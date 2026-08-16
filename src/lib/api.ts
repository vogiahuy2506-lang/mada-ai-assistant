// API client for MADA AI backend
const API_BASE = '/api'; // Use proxy in dev, full URL in production

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'data_manager' | 'expert' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  provider: string;
  avatar: string | null;
  quotaUsed: number;
  quotaLimit: number;
  lastLogin: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

const TOKEN_KEY = 'mada-access-token';
const REFRESH_KEY = 'mada-refresh-token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<{ success: true; data: T } | ApiError> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Try to refresh on 401
    if (res.status === 401 && retry && getRefreshToken()) {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
          return request(path, options, false);
        }
      }

      // Refresh failed → clear tokens
      clearTokens();
    }

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Lỗi không xác định', code: data.code };
    }
    return data;
  } catch {
    return { success: false, error: 'Không thể kết nối server. Vui lòng kiểm tra backend đang chạy.' };
  }
}

// ============== AUTH ==============

export const authApi = {
  async register(email: string, password: string, name: string) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },
  async login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async logout() {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });
  },
  async me() {
    return request<{ user: ApiUser }>('/auth/me');
  },
  async updateProfile(updates: { name?: string; avatar?: string }) {
    return request<{ user: ApiUser }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async changePassword(currentPassword: string, newPassword: string) {
    return request<{ success: boolean }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ============== USERS (admin) ==============

export const usersApi = {
  async list(params?: { search?: string; role?: string; status?: string; plan?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ users: ApiUser[]; total: number }>(`/users${query ? `?${query}` : ''}`);
  },
  async get(id: string) {
    return request<{ user: ApiUser }>(`/users/${id}`);
  },
  async create(data: { email: string; password: string; name: string; role?: string; plan?: string }) {
    return request<{ user: ApiUser }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async update(id: string, updates: Partial<{ role: string; plan: string; status: string; name: string; quotaLimit: number }>) {
    return request<{ user: ApiUser }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async delete(id: string) {
    return request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });
  },
  async stats() {
    return request<{
      total: number; active: number; suspended: number; pending: number;
      admins: number; enterprise: number; pro: number; free: number;
    }>('/users/stats/overview');
  },
};

export { API_BASE };

// ============== SYSTEM SETTINGS ==============
export interface SystemSettings {
  anonymousLimit: number;      // -1 = unlimited
  defaultPlanLimit: number;    // -1 = unlimited for default free plan
  maxFilesPerSession: number;  // max files per chat session
  maxFilesTotal: number;       // max files total per user
  maxFileSizeMB: number;       // max file size in MB
  websiteUrl: string;          // website URL for data collection
}

export const systemApi = {
  async getSettings(): Promise<{ success: boolean; data: SystemSettings }> {
    return request<SystemSettings>('/system/settings');
  },
  async updateSettings(updates: Partial<SystemSettings>): Promise<{ success: boolean; data: SystemSettings }> {
    return request<SystemSettings>('/system/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

// ============== USER HISTORY (Chat) ==============
export interface ChatConversation {
  id: string;
  title: string;
  agent_id: string | null;
  language: string;
  message_count: number;
  last_message_preview: string | null;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id: string | null;
  sources: any[] | null;
  confidence: number | null;
  language: string | null;
  created_at: string;
}

export const userHistoryApi = {
  async list(params?: { search?: string; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ conversations: ChatConversation[] }>(`/user/history${query ? `?${query}` : ''}`);
  },
  async get(id: string) {
    return request<{ conversation: ChatConversation; messages: ChatMessage[] }>(`/user/history/${id}`);
  },
  async create(data: { conversationId?: string; title: string; agentId?: string; language: string; firstMessage?: string }) {
    return request<{ id: string }>('/user/history', { method: 'POST', body: JSON.stringify(data) });
  },
  async addMessage(conversationId: string, data: { role: string; content: string; agentId?: string; sources?: any; confidence?: number; language?: string }) {
    return request<{ messageId: string }>(`/user/history/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, updates: { title?: string; is_pinned?: boolean }) {
    return request<{ success: boolean }>(`/user/history/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  },
  async delete(id: string) {
    return request<{ success: boolean }>(`/user/history/${id}`, { method: 'DELETE' });
  },
};

// ============== USER FAVORITES ==============
export interface UserFavorite {
  id: string;
  item_type: 'product' | 'kb_item' | 'standard';
  item_id: string;
  title: string;
  metadata: any | null;
  created_at: string;
}

export const userFavoritesApi = {
  async list() {
    return request<{ favorites: UserFavorite[] }>('/user/favorites');
  },
  async add(data: { item_type: string; item_id: string; title: string; metadata?: any }) {
    return request<{ id: string }>('/user/favorites', { method: 'POST', body: JSON.stringify(data) });
  },
  async delete(id: string) {
    return request<{ success: boolean }>(`/user/favorites/${id}`, { method: 'DELETE' });
  },
  async removeByItem(item_type: string, item_id: string) {
    return request<{ success: boolean }>(`/user/favorites/by-item?item_type=${encodeURIComponent(item_type)}&item_id=${encodeURIComponent(item_id)}`, { method: 'DELETE' });
  },
};