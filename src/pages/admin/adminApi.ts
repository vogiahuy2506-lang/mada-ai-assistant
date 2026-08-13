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
  totalSize?: number;
  [key: string]: any;
}

export interface AdminLog {
  id: string;
  level: 'critical' | 'error' | 'warn' | 'info' | 'success';
  message: string;
  source: string;
  timestamp: string;
  user?: string;
  details?: string;
}

export interface Product {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  content: string;
  category: string;
  brand: string;
  model: string;
  price_range: string;
  source_url: string;
  product_url: string;
  image_url: string;
  iso_codes: string | string[];
  wcag_level: string;
  who_gate_area: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean | number;
  sort_order: number;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name_vi: string;
  name_en: string;
  icon: string;
  sort_order: number;
  description_vi: string | null;
  description_en: string | null;
  related_url: string | null;
  product_link: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Consultation {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'pending' | 'reviewed' | 'contacted';
  notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export const adminApi = {
  // ============== USERS ==============
  async listUsers(params?: { search?: string; role?: string; status?: string; plan?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return request<{ users: AdminUser[]; total: number }>(`/users${q ? `?${q}` : ''}`);
  },
  async getUserStats() {
    return request<UserStats>('/admin/user-stats');
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

  // ============== KNOWLEDGE ==============
  async getKnowledgeStats() {
    return request<KnowledgeStats>('/admin/knowledge-stats');
  },
  async searchKnowledge(q: string, limit = 10) {
    return request<{ results: any[]; total: number }>(`/knowledge/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  // ============== CATEGORIES ==============
  async getCategories() {
    return request<Category[]>('/admin/categories');
  },
  async createCategory(data: { id: string; name_vi: string; name_en: string; icon?: string; sort_order?: number; description_vi?: string; description_en?: string; related_url?: string; product_link?: string }) {
    return request<Category>('/admin/categories', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateCategory(id: string, data: Partial<Category>) {
    return request<Category>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteCategory(id: string) {
    return request<{ success: boolean; message?: string }>(`/admin/categories/${id}`, { method: 'DELETE' });
  },

  // ============== PRODUCTS ==============
  async getProducts(params?: { q?: string; category?: string; status?: string; featured?: boolean; limit?: number; offset?: number }) {
    const p = new URLSearchParams();
    if (params?.q) p.set('q', params.q);
    if (params?.category) p.set('category', params.category);
    if (params?.status) p.set('status', params.status);
    if (params?.featured !== undefined) p.set('featured', String(params.featured));
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    return request<{ items: Product[]; total: number }>(`/admin/products${qs ? `?${qs}` : ''}`);
  },
  async createProduct(data: Partial<Product>) {
    return request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateProduct(id: string, data: Partial<Product>) {
    return request<Product>(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteProduct(id: string) {
    return request<{ success: boolean }>(`/admin/products/${id}`, { method: 'DELETE' });
  },
  async publishProduct(id: string, status: 'published' | 'draft' | 'archived') {
    return request<{ success: boolean; data?: Product }>(`/admin/products/${id}/publish`, { method: 'POST', body: JSON.stringify({ status }) });
  },

  // ============== AGENTS ==============
  async getAgents() {
    return request<any[]>('/admin/agents');
  },
  async createAgent(data: any) {
    return request<any>('/admin/agents', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateAgent(id: string, data: any) {
    return request<any>(`/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteAgent(id: string) {
    return request<{ success: boolean }>(`/admin/agents/${id}`, { method: 'DELETE' });
  },

  // ============== LOGS ==============
  async getLogs(q?: string) {
    return request<{ logs: AdminLog[] }>(`/admin/logs${q ? `?${q}` : ''}`);
  },
  async clearLogs() {
    return request<{ success: boolean }>('/admin/logs', { method: 'DELETE' });
  },

  // ============== ANALYTICS ==============
  async getAnalytics() {
    return request<any>('/admin/analytics');
  },
  async getChatMetrics(range: '24h' | '7d' | '30d' | '90d' = '7d') {
    return request<any>(`/admin/analytics/chat-metrics?range=${range}`);
  },

  // ============== SETTINGS ==============
  async getSettings() {
    return request<Record<string, any>>('/admin/settings');
  },
  async updateSettings(settings: Record<string, any>) {
    return request<{ success: boolean }>('/admin/settings', { method: 'PATCH', body: JSON.stringify(settings) });
  },

  // ============== CONSULTATIONS ==============
  async getConsultations(params?: { status?: string; limit?: number; offset?: number }) {
    const p = new URLSearchParams();
    if (params?.status) p.set('status', params.status);
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    return request<{ data: Consultation[]; total: number }>(`/consultation${qs ? `?${qs}` : ''}`);
  },
  async getConsultation(id: string) {
    return request<{ data: Consultation }>(`/consultation/${id}`);
  },
  async updateConsultation(id: string, data: { status?: string; notes?: string }) {
    return request<{ success: boolean; data?: Consultation }>(`/consultation/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteConsultation(id: string) {
    return request<{ success: boolean }>(`/consultation/${id}`, { method: 'DELETE' });
  },
  async getConsultationStats() {
    return request<any>('/consultation/stats/summary');
  },
};
