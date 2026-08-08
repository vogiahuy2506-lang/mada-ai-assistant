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

  // Products
  async getProducts(params?: { q?: string; category?: string; status?: string; featured?: boolean; limit?: number; offset?: number }) {
    const p = new URLSearchParams();
    if (params?.q) p.set('q', params.q);
    if (params?.category) p.set('category', params.category);
    if (params?.status) p.set('status', params.status);
    if (params?.featured !== undefined) p.set('featured', String(params.featured));
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    return request<{ items: Product[]; total: number; limit: number; offset: number }>(`/admin/products/items${qs ? `?${qs}` : ''}`);
  },
  async getProduct(id: string) {
    return request<Product>(`/admin/products/items/${id}`);
  },
  async createProduct(data: Partial<Product>) {
    return request<Product>(`/admin/products/items`, { method: 'POST', body: JSON.stringify(data) });
  },
  async updateProduct(id: string, data: Partial<Product>) {
    return request<Product>(`/admin/products/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteProduct(id: string) {
    return request<{ success: boolean }>(`/admin/products/items/${id}`, { method: 'DELETE' });
  },
  async publishProduct(id: string, status: 'published' | 'draft' | 'archived') {
    return request<{ success: boolean }>(`/admin/products/items/${id}/publish`, { method: 'POST', body: JSON.stringify({ status }) });
  },

  // Categories
  async getCategories() {
    return request<Category[]>(`/admin/products/categories`);
  },
  async getCategory(id: string) {
    return request<Category>(`/admin/products/categories/${id}`);
  },
  async createCategory(data: Partial<Category> & { id: string; name_vi: string; name_en: string }) {
    return request<Category>(`/admin/products/categories`, { method: 'POST', body: JSON.stringify(data) });
  },
  async updateCategory(id: string, data: Partial<Category>) {
    return request<Category>(`/admin/products/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteCategory(id: string) {
    return request<{ success: boolean }>(`/admin/products/categories/${id}`, { method: 'DELETE' });
  },

  // Products Stats
  async getProductsStats() {
    return request<ProductStats>(`/admin/products/stats`);
  },

  // Bulk import
  async bulkImportProducts(items: Partial<Product>[]) {
    return request<{ success: boolean; added: number }>(`/admin/products/items/bulk`, { method: 'POST', body: JSON.stringify({ items }) });
  },
};

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
  iso_codes: string[];
  wcag_level: string;
  who_gate_area: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
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

export interface ProductStats {
  totalProducts: number;
  published: number;
  byCategory: { category: string; count: number }[];
  categories: Category[];
}
