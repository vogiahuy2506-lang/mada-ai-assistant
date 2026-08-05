import { getAccessToken } from '@/lib/api';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: json.error || res.statusText };
  }
  return json;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'expert' | 'data_manager' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  provider: 'email' | 'google';
  avatar: string | null;
  quotaUsed: number;
  quotaLimit: number;
  lastLogin: string | null;
  createdAt: string;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  pending: number;
  admins: number;
  enterprise: number;
  pro: number;
  free: number;
}

export interface KnowledgeStats {
  totalDocuments: number;
  totalCategories: number;
  totalSize: number;
  [key: string]: any;
}

export interface AdminLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: string;
  user?: string;
  details?: string;
}

export const adminApi = {
  // Users
  async listUsers(params?: { search?: string; role?: string; status?: string; plan?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return request<{ users: AdminUser[]; total: number }>(`/users${q ? `?${q}` : ''}`);
  },
  async getUserStats() {
    return request<UserStats>('/users/stats/overview');
  },
  async updateUser(id: string, updates: Partial<Pick<AdminUser, 'role' | 'plan' | 'status' | 'name' | 'quotaLimit'>>) {
    return request<{ user: AdminUser }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async deleteUser(id: string) {
    return request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });
  },
  async createUser(data: { email: string; password: string; name: string; role?: string; plan?: string }) {
    return request<{ user: AdminUser }>(`/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Knowledge
  async getKnowledgeStats() {
    return request<KnowledgeStats>('/knowledge/stats');
  },
  async searchKnowledge(q: string, limit = 10) {
    return request<{ results: any[]; total: number }>(`/knowledge/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
  async clearKnowledge() {
    return request<{ success: boolean }>('/knowledge', { method: 'DELETE' });
  },

  // Logs (in-memory from server)
  async getLogs(q?: string) {
    return request<{ logs: AdminLog[]; total: number }>(`/admin/logs${q ? `?${q}` : ''}`);
  },

  // Analytics
  async getAnalytics() {
    return request<any>(`/admin/analytics`);
  },
};
