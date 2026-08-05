// API client for MADA AI backend
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';

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
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },
  async login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async logout() {
    return request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });
  },
  async me() {
    return request<{ user: ApiUser }>('/api/auth/me');
  },
  async updateProfile(updates: { name?: string; avatar?: string }) {
    return request<{ user: ApiUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async changePassword(currentPassword: string, newPassword: string) {
    return request<{ success: boolean }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ============== USERS (admin) ==============

export const usersApi = {
  async list(params?: { search?: string; role?: string; status?: string; plan?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ users: ApiUser[]; total: number }>(`/api/users${query ? `?${query}` : ''}`);
  },
  async get(id: string) {
    return request<{ user: ApiUser }>(`/api/users/${id}`);
  },
  async create(data: { email: string; password: string; name: string; role?: string; plan?: string }) {
    return request<{ user: ApiUser }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async update(id: string, updates: Partial<{ role: string; plan: string; status: string; name: string; quotaLimit: number }>) {
    return request<{ user: ApiUser }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async delete(id: string) {
    return request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' });
  },
  async stats() {
    return request<{
      total: number; active: number; suspended: number; pending: number;
      admins: number; enterprise: number; pro: number; free: number;
    }>('/api/users/stats/overview');
  },
};

export { API_BASE };