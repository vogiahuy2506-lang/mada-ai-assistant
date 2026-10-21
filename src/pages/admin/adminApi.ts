import { getAccessToken, validateLocalToken, clearTokens } from '@/lib/api';

const API_BASE = '/api';

// Helper: fetch với timeout để tránh infinite hang
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      const timeoutErr: any = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'AbortError';
      throw timeoutErr;
    }
    throw err;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<{ success: boolean; data?: T; error?: string }> {
  // Pre-check: skip API call if token is invalid (missing, expired, or malformed)
  // to avoid unnecessary 401 errors hitting the browser console
  const tokenCheck = validateLocalToken();
  if (!tokenCheck.valid) {
    // Token missing, expired, or malformed — clear it silently and skip
    if (tokenCheck.reason !== 'missing') {
      clearTokens();
    }
    return { success: false, error: 'Session expired. Please login again.' };
  }

  const token = getAccessToken();
  const refreshToken = localStorage.getItem('mada-refresh-token');
  
  try {
    const res = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    // Auto-refresh token on 401
    if (res.status === 401 && retry && refreshToken) {
      try {
        const refreshRes = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }, 10000);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => null);
          if (refreshData?.success) {
            localStorage.setItem('mada-access-token', refreshData.data.accessToken);
            localStorage.setItem('mada-refresh-token', refreshData.data.refreshToken);
            // Retry request with new token
            return request(path, options, false);
          }
        }
      } catch {
        // Refresh failed, continue to error handling
      }
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: json.error || res.statusText };
    }
    return json;
  } catch (err: any) {
    // Return a graceful error response instead of throwing
    // This prevents "Unhandled Promise Rejection" from crashing the app
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    if (err?.message === 'Failed to fetch' || err?.message?.includes('fetch') || err instanceof TypeError) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
    return { success: false, error: err?.message || 'Unknown error' };
  }
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
  async getKnowledgeStats(params?: { botId?: string; category?: string }) {
    const p = new URLSearchParams();
    if (params?.botId) p.set('botId', params.botId);
    if (params?.category) p.set('category', params.category);
    const qs = p.toString();
    return request<KnowledgeStats & { perBot: { botId: string; count: number }[] }>(
      `/admin/knowledge-stats${qs ? `?${qs}` : ''}`
    );
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
  // ⭐ Use public API for fetching products to avoid auth issues
  // The public API returns the same data but doesn't require authentication
  async getProducts(params?: { q?: string; category?: string; status?: string; featured?: boolean; limit?: number; offset?: number }) {
    const p = new URLSearchParams();
    if (params?.q) p.set('q', params.q);
    if (params?.category) p.set('category', params.category);
    if (params?.status) p.set('status', params.status);
    if (params?.featured !== undefined) p.set('featured', String(params.featured));
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    return request<{ items: Product[]; total: number }>(`/public/products${qs ? `?${qs}` : ''}`);
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
  // ⚠️ Bulk endpoints return flat shape (không wrap trong `data`):
  //   { success: boolean, updated, scope, sync?, message, error? }
  // → Cast trực tiếp để frontend dùng .updated / .message / .error ngay
  async bulkPublish(payload: { ids?: string[]; scope?: 'all_unpublished' | 'selected' }) {
    return (await request<any>(
      `/admin/products/bulk-publish`,
      { method: 'POST', body: JSON.stringify(payload) }
    )) as { success: boolean; updated: number; scope: string; sync: any[]; message: string; error?: string };
  },
  async bulkUnpublish(payload: { ids?: string[]; scope?: 'all_published' | 'selected' }) {
    return (await request<any>(
      `/admin/products/bulk-unpublish`,
      { method: 'POST', body: JSON.stringify(payload) }
    )) as { success: boolean; updated: number; scope: string; message: string; error?: string };
  },
  async translateProduct(id: string, languages?: string[]) {
    return request<{ success: boolean; data?: Product; message?: string }>(`/admin/products/${id}/translate`, {
      method: 'PATCH',
      body: JSON.stringify({ languages: languages || ['en', 'ar', 'fr'] }),
    });
  },

  // ⭐ Sync kb_products → knowledge_items AND vector store (complete fix)
  async syncAndIndex() {
    return (await request<any>('/admin/products/sync-and-index', { method: 'POST' })) as {
      success: boolean;
      data: {
        kbSync: { inserted: number; updated: number; archived: number; errors: any[] };
        vectorIndex: { indexed: number; skipped: number; totalInVectorStore: number };
      };
      message: string;
      error?: string;
    };
  },

  // ============== AGENTS ==============
  async getAgents() {
    // NOTE: GET /admin/agents does NOT require authentication on the server side.
    // We bypass token validation so expired tokens don't block reading the agent list.
    try {
      const res = await fetchWithTimeout('/api/admin/agents', {
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, data: [] as any[], error: json.error || res.statusText };
      return { success: true, data: json.data || json as any[], error: undefined };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, data: [] as any[], error: 'Request timed out' };
      if (err?.message === 'Failed to fetch' || err instanceof TypeError) return { success: false, data: [] as any[], error: 'Network error' };
      return { success: false, data: [] as any[], error: err?.message || 'Unknown error' };
    }
  },
  async createAgent(data: any) {
    return request<any>('/admin/agents', { method: 'POST', body: JSON.stringify(data) });
  },
  /** Load 1 agent theo id (đầy đủ field, khác với public/agents). */
  async getAgent(id: string) {
    return request<any>(`/admin/agents/${id}`);
  },
  async updateAgent(id: string, data: any) {
    return request<any>(`/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteAgent(id: string) {
    return request<{ success: boolean }>(`/admin/agents/${id}`, { method: 'DELETE' });
  },

  // ============ AI ASSISTANTS STUDIO — per-bot deep config ============

  /** Sản phẩm đã gán riêng cho bot. */
  async getAgentLinkedProducts(agentId: string) {
    return request<{ agentId: string; items: any[]; total: number }>(
      `/admin/agents/${agentId}/products`,
    );
  },
  /** Gán 1 sản phẩm vào bot. */
  async linkAgentProduct(agentId: string, productId: string) {
    return request<{ agentId: string; productId: string; total: number }>(
      `/admin/agents/${agentId}/products`,
      { method: 'POST', body: JSON.stringify({ productId }) },
    );
  },
  /** Bỏ gán sản phẩm khỏi bot. */
  async unlinkAgentProduct(agentId: string, productId: string) {
    return request<{ agentId: string; productId: string }>(
      `/admin/agents/${agentId}/products/${productId}`,
      { method: 'DELETE' },
    );
  },
  /** Auto-gán sản phẩm theo mada_category của bot. */
  async syncAgentProducts(agentId: string, category?: string) {
    return request<{ agentId: string; category: string; linked: number }>(
      `/admin/agents/${agentId}/products/sync`,
      { method: 'POST', body: JSON.stringify({ category }) },
    );
  },

  /** Tài liệu KB đã ingest cho bot (gom theo nguồn). */
  async getAgentKnowledge(agentId: string, limit = 50) {
    return request<{
      agentId: string;
      agentName: string;
      totalChunks: number;
      sources: Array<{ source: string; title: string; chunks: number; crawledAt?: string }>;
      documents: Array<{ id: string; title: string; source: string; preview: string; crawledAt: string | null }>;
    }>(`/admin/agents/${agentId}/knowledge?limit=${limit}`);
  },
  /** Thêm KB thủ công cho bot: text hoặc URL. */
  async addAgentKnowledge(
    agentId: string,
    payload: { type: 'text' | 'web'; content: string; title?: string; language?: string },
  ) {
    return request<{ success: boolean; documentsAdded?: number; message?: string }>(
      `/admin/agents/${agentId}/knowledge`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },

  /** Câu hỏi gợi ý gán riêng cho bot. */
  async getAgentQuestions(agentId: string) {
    return request<any[]>(`/admin/agents/${agentId}/questions`);
  },

  /** Playground: gửi 1 lượt chat test với cấu hình hiện tại của bot. */
  async agentPlayground(
    agentId: string,
    payload: {
      message: string;
      history?: Array<{ role: string; content: string }>;
      language?: string;
      userMode?: 'endUser' | 'specialist';
      /** Prompt chưa lưu — để test thay đổi tức thì. */
      draftPrompt?: string;
    },
  ) {
    return request<{
      answer: string;
      confidence: number;
      contextUsed: boolean;
      latencyMs: number;
      language: string;
      userMode: string;
      agentName: string;
      sources: Array<{ title: string; source: string; score: number | null; preview: string }>;
      systemInstructionPreview: string;
    }>(`/admin/agents/${agentId}/playground`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Xem system prompt đầy đủ sẽ gửi cho AI. */
  async previewAgentPrompt(
    agentId: string,
    params: { language?: string; userMode?: string; draftPrompt?: string } = {},
  ) {
    const p = new URLSearchParams();
    if (params.language) p.set('language', params.language);
    if (params.userMode) p.set('userMode', params.userMode);
    if (params.draftPrompt) p.set('draftPrompt', params.draftPrompt);
    const qs = p.toString();
    return request<{
      agentId: string;
      agentName: string;
      language: string;
      userMode: string;
      systemInstruction: string;
      chars: number;
    }>(`/admin/agents/${agentId}/preview-prompt${qs ? `?${qs}` : ''}`);
  },
  async uploadAgentAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/admin/agents/upload-avatar`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false as const, error: json.error || res.statusText };
    return json as { success: boolean; data: { url: string; filename: string; size: number; mimetype: string } };
  },
  async crawlAgentSources(
    id: string,
    payload: {
      knowledge_url?: string;
      product_urls?: string[];  // ⭐ Array thay vì single URL
      crawl_follow_links?: 0 | 1;
      crawl_max_depth?: number;
      crawl_max_pages?: number;
    }
  ) {
    return request<{
      agentId: string;
      totalDocs: number;
      status: string;
      results: Array<{ url: string; kind: string; ok: boolean; docs: number; error?: string }>;
    }>(`/admin/agents/${id}/crawl-sources`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Liệt kê documents trong KB của 1 agent. */
  async getAgentDocuments(id: string, limit = 50) {
    return request<{
      agentId: string;
      agentName: string;
      totalCount: number;
      documents: Array<{ id: string; title: string; content: string; source: string; metadata: any }>;
    }>(`/admin/agents/${id}/documents?limit=${limit}`);
  },

  /** Cập nhật title của 1 document trong KB. */
  async updateAgentDocumentTitle(agentId: string, docId: string, title: string) {
    return request<{ id: string; title: string }>(`/admin/agents/${agentId}/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
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
    return request<{
      data: Record<string, any>;
      grouped: Record<string, Array<{ key: string; value: any; type: string; description: string; updated_at: string }>>;
      categories: Record<string, { label: string; icon: string }>;
    }>('/admin/settings');
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

  // ============== SCRAPER (admin) ==============
  async getMadaCategories() {
    return request<any[]>('/admin/scraper/mada-categories');
  },
  async startCrawlMada(category: string) {
    return request<{ jobId: string; status: string }>('/admin/scraper/crawl-mada', {
      method: 'POST',
      body: JSON.stringify({ category }),
    });
  },
  async getCrawlJob(jobId: string) {
    return request<any>(`/admin/scraper/crawl-mada/${jobId}`);
  },
  async listCrawlJobs() {
    return request<any[]>('/admin/scraper/crawl-mada-jobs');
  },
  async getRagChunksStats() {
    return request<{ files: any; chunkCount: number; productCount: number }>('/admin/scraper/rag-chunks-stats');
  },
  async ingestRagChunks(payload?: { chunks?: any[]; dryRun?: boolean }) {
    return request<any>('/admin/scraper/ingest-rag-chunks', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },
  async getSources() {
    return request<any[]>('/admin/scraper/sources');
  },
  async addSource(payload: any) {
    return request<any>('/admin/scraper/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async deleteSource(id: string) {
    return request<{ success: boolean }>(`/admin/scraper/sources/${id}`, { method: 'DELETE' });
  },
  async toggleSource(id: string, enabled: boolean) {
    return request<{ success: boolean }>(`/admin/scraper/sources/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  // ============== URL IMPORT / SCRAPE METADATA ==============
  async scrapeUrlMetadata(url: string) {
    return request<{ title: string; description: string; image: string; siteName: string; url: string }>(
      `/scraper/import-url/metadata?url=${encodeURIComponent(url)}`
    );
  },

  // ============== AUDIT LOGS ==============
  async getAuditLogs(params?: { action?: string; user_id?: string; limit?: number; offset?: number }) {
    const p = new URLSearchParams();
    if (params?.action) p.set('action', params.action);
    if (params?.user_id) p.set('user_id', params.user_id);
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    // Trả về nested total
    return request<{ data?: any[]; total?: number }>(`/admin/audit${qs ? `?${qs}` : ''}`);
  },

  // ============== CHAT METRICS ==============
  async postChatMetric(payload: { conversationId?: string; latencyMs: number; confidence: number; botId?: string; language?: string; userMode?: 'endUser' | 'specialist' }) {
    return request<{ success: boolean }>('/admin/chat-metrics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async testAgent(payload: { agentId: string; message: string }) {
    return request<{ response: string; latencyMs: number; confidence: number; agentName: string }>(
      '/admin/agents/test',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  // ============== SIMPLIFIED SYSTEM PROMPTS (single prompt) ==============
  async getSystemPrompt() {
    return request<{
      content: string;
      updatedAt: string | null;
    }>('/admin/system-prompts');
  },
  async updateSystemPrompt(content: string) {
    return request<{
      content: string;
      updatedAt: string;
    }>('/admin/system-prompts', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },
  async getSystemPromptPreview(lang: string = 'vi', mode: 'endUser' | 'specialist' = 'endUser') {
    return request<{
      language: string;
      mode: string;
      prompt: string;
    }>(`/admin/system-prompts/preview?lang=${lang}&mode=${mode}`);
  },

  // ============== PROMPT TEMPLATES ==============
  async getPromptTemplates(params?: { category?: string; language?: string; featured?: boolean; search?: string }) {
    const p = new URLSearchParams();
    if (params?.category && params.category !== 'all') p.set('category', params.category);
    if (params?.language && params.language !== 'all') p.set('language', params.language);
    if (params?.featured) p.set('featured', 'true');
    if (params?.search) p.set('search', params.search);
    const qs = p.toString();
    return request<Array<{
      id: string;
      name: string;
      description: string;
      prompt: string;
      category: string;
      language: string;
      tags: string[];
      variables: string[];
      example_questions: string[];
      is_featured: boolean;
      use_count: number;
      created_at: string;
      updated_at: string;
    }>>(`/admin/prompt-templates${qs ? `?${qs}` : ''}`);
  },
  async getPromptTemplate(id: string) {
    return request<{
      id: string;
      name: string;
      description: string;
      prompt: string;
      category: string;
      language: string;
      tags: string[];
      variables: string[];
      example_questions: string[];
      is_featured: boolean;
      use_count: number;
    }>(`/admin/prompt-templates/${id}`);
  },
  async createPromptTemplate(data: {
    id: string;
    name: string;
    description?: string;
    prompt: string;
    category?: string;
    language?: string;
    tags?: string[];
    variables?: string[];
    example_questions?: string[];
    is_featured?: boolean;
  }) {
    return request<{ id: string; name: string }>('/admin/prompt-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updatePromptTemplate(id: string, data: Partial<{
    name: string;
    description: string;
    prompt: string;
    category: string;
    language: string;
    tags: string[];
    variables: string[];
    example_questions: string[];
    is_featured: boolean;
  }>) {
    return request<{ id: string; updated_at: string }>(`/admin/prompt-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async deletePromptTemplate(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/prompt-templates/${id}`, { method: 'DELETE' });
  },
  async applyPromptTemplate(templateId: string, targetPromptId: string, changeSummary?: string) {
    return request<{
      success: boolean;
      data: {
        message: string;
        prompt_id: string;
        version: number;
        template_id: string;
      };
    }>(`/admin/prompt-templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ target_prompt_id: targetPromptId, change_summary: changeSummary }),
    });
  },

  // ============== PROMPT VERSIONS ==============
  async getPromptVersions(promptId: string) {
    return request<Array<{
      id: string;
      prompt_id: string;
      version: number;
      prompt: string;
      change_summary: string;
      created_by: string;
      created_by_name: string;
      created_at: string;
      is_restored: boolean;
    }>>(`/admin/prompt-templates/versions/${promptId}`);
  },
  async restorePromptVersion(promptId: string, versionId: string) {
    return request<{
      success: boolean;
      data: {
        message: string;
        restored_version: number;
        new_version: number;
      };
    }>(`/admin/prompt-templates/versions/${promptId}/restore/${versionId}`, {
      method: 'POST',
    });
  },

  // ============== PROMPT VALIDATION & TESTING ==============
  async validatePrompt(prompt: string) {
    return request<{
      success: boolean;
      data: {
        valid: boolean;
        issues: Array<{
          type: string;
          message: string;
          severity: 'error' | 'warning' | 'info';
        }>;
        stats: {
          length: number;
          wordCount: number;
          lineCount: number;
          hasPlaceholders: number;
        };
      };
    }>('/admin/prompt-templates/validate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },
  async testPrompt(prompt: string, question?: string, language?: string) {
    return request<{
      success: boolean;
      data: {
        system_prompt: string;
        test_question: string;
        simulated_structure: {
          steps: string[];
          expected_format: {
            greeting: string;
            content: string;
            closing: string;
          };
          language_applied: string;
          safety_check: string;
        };
        validation: {
          prompt_length: number;
          has_language_rule: boolean;
          has_safety_rule: boolean;
          has_format_guide: boolean;
          recommended_test_questions: string[];
        };
      };
    }>('/admin/prompt-templates/test', {
      method: 'POST',
      body: JSON.stringify({ prompt, question, language }),
    });
  },

  // ============== SUGGESTED QUESTIONS ==============
  async getSuggestedQuestions(params?: { 
    agent_id?: string; 
    category?: string; 
    view_mode?: string; 
    language?: string; 
    is_active?: boolean;
  }) {
    const p = new URLSearchParams();
    if (params?.agent_id) p.set('agent_id', params.agent_id);
    if (params?.category) p.set('category', params.category);
    if (params?.view_mode) p.set('view_mode', params.view_mode);
    if (params?.language) p.set('language', params.language);
    if (params?.is_active !== undefined) p.set('is_active', String(params.is_active));
    const q = p.toString();
    return request<any[]>(`/admin/suggested-questions${q ? `?${q}` : ''}`);
  },

  async getSuggestedQuestionsGrouped(params?: { agent_id?: string }) {
    const p = new URLSearchParams();
    if (params?.agent_id) p.set('agent_id', params.agent_id);
    const q = p.toString();
    return request<any[]>(`/admin/suggested-questions/grouped${q ? `?${q}` : ''}`);
  },

  async getSuggestedQuestionsForAgent(params: { 
    agent_id?: string; 
    category: string; 
    view_mode?: string; 
    language?: string;
  }) {
    const p = new URLSearchParams({ category: params.category });
    if (params.agent_id) p.set('agent_id', params.agent_id);
    if (params.view_mode) p.set('view_mode', params.view_mode);
    if (params.language) p.set('language', params.language);
    return request<{ data: any[]; source: string }>(`/admin/suggested-questions/for-agent?${p.toString()}`);
  },

  async createSuggestedQuestion(data: {
    agent_id?: string;
    category: string;
    view_mode?: string;
    language?: string;
    question: string;
    sort_order?: number;
    is_active?: boolean;
  }) {
    return request<any>('/admin/suggested-questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** ⭐ Auto-translate: chỉ nhập tiếng Việt, tự động tạo 4 ngôn ngữ */
  async autoTranslateQuestion(data: {
    question_vi: string;
    category: string;
    view_mode?: string;
    agent_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }) {
    return request<{
      count: number;
      questions: Array<{ id: string; language: string; question: string }>;
      translations: { vi: string; en: string; ar: string; fr: string };
    }>('/admin/suggested-questions/auto-translate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** ⭐ Xóa tất cả câu hỏi không phải tiếng Việt */
  async deleteNonVietnameseQuestions() {
    return request<{ success: boolean; count: number }>('/admin/suggested-questions/delete-non-vi', {
      method: 'DELETE',
    });
  },

  async createSuggestedQuestionsBulk(questions: Array<{
    agent_id?: string;
    category: string;
    view_mode?: string;
    language?: string;
    question: string;
    sort_order?: number;
    is_active?: boolean;
  }>) {
    return request<{ count: number }>('/admin/suggested-questions/bulk', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    });
  },

  async updateSuggestedQuestion(id: string, updates: {
    agent_id?: string | null;
    category?: string;
    view_mode?: string;
    language?: string;
    question?: string;
    sort_order?: number;
    is_active?: boolean;
  }) {
    return request<any>(`/admin/suggested-questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async updateSuggestedQuestionsBulk(questions: Array<{
    id: string;
    agent_id?: string | null;
    category?: string;
    view_mode?: string;
    language?: string;
    question?: string;
    sort_order?: number;
    is_active?: boolean;
  }>) {
    return request<{ count: number }>('/admin/suggested-questions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ questions }),
    });
  },

  async deleteSuggestedQuestion(id: string) {
    return request<any>(`/admin/suggested-questions/${id}`, {
      method: 'DELETE',
    });
  },

  async deleteSuggestedQuestionsBulk(ids: string[]) {
    return request<{ count: number }>('/admin/suggested-questions/bulk/delete', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  },

  async importSuggestedQuestionDefaults() {
    return request<{ count: number }>('/admin/suggested-questions/import-defaults', {
      method: 'POST',
    });
  },

  async getSuggestedQuestionsStats() {
    return request<{
      total: { count: number };
      byCategory: Array<{ category: string; count: number }>;
      byViewMode: Array<{ view_mode: string; count: number }>;
      byLanguage: Array<{ language: string; count: number }>;
      active: { count: number };
      agentSpecific: { count: number };
    }>('/admin/suggested-questions/stats/all');
  },

  // ============== PRICING PLANS ==============
  async getPricingPlans(params?: { language?: string }) {
    const p = new URLSearchParams();
    if (params?.language) p.set('lang', params.language);
    const qs = p.toString();
    return request<Array<{
      id: string;
      planKey: string;
      name: string;
      priceAmount: number;
      priceCurrency: string;
      priceNote: string;
      description: string;
      features: string[];
      isActive: boolean;
      isHighlighted: boolean;
      sortOrder: number;
      ctaText: string;
      createdAt: string;
      updatedAt: string;
    }>>(`/admin/pricing-plans${qs ? `?${qs}` : ''}`);
  },

  async getPricingPlan(id: string, params?: { language?: string }) {
    const p = new URLSearchParams();
    if (params?.language) p.set('lang', params.language);
    const qs = p.toString();
    return request<{
      id: string;
      planKey: string;
      name: string;
      priceAmount: number;
      priceCurrency: string;
      priceNote: string;
      description: string;
      features: string[];
      isActive: boolean;
      isHighlighted: boolean;
      sortOrder: number;
      ctaText: string;
    }>(`/admin/pricing-plans/${id}${qs ? `?${qs}` : ''}`);
  },

  async updatePricingPlan(id: string, data: {
    name_vi?: string;
    name_en?: string;
    name_ar?: string;
    name_fr?: string;
    price_amount?: number;
    price_currency?: string;
    price_note_vi?: string;
    price_note_en?: string;
    description_vi?: string;
    description_en?: string;
    description_ar?: string;
    description_fr?: string;
    features_vi?: string[];
    features_en?: string[];
    features_ar?: string[];
    features_fr?: string[];
    is_active?: boolean;
    is_highlighted?: boolean;
    sort_order?: number;
    cta_text_vi?: string;
    cta_text_en?: string;
  }, params?: { language?: string }) {
    const p = new URLSearchParams();
    if (params?.language) p.set('lang', params.language);
    const qs = p.toString();
    return request<{
      id: string;
      planKey: string;
      name: string;
      priceAmount: number;
      priceCurrency: string;
      priceNote: string;
      description: string;
      features: string[];
      isActive: boolean;
      isHighlighted: boolean;
      sortOrder: number;
      ctaText: string;
    }>(`/admin/pricing-plans/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // ============== NOTIFICATIONS ==============
  async getNotifications(params?: {
    limit?: number;
    offset?: number;
    is_read?: boolean;
    category?: string;
    priority?: string;
    type?: string;
  }) {
    const p = new URLSearchParams();
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    if (params?.is_read !== undefined) p.set('is_read', String(params.is_read));
    if (params?.category) p.set('category', params.category);
    if (params?.priority) p.set('priority', params.priority);
    if (params?.type) p.set('type', params.type);
    const qs = p.toString();
    return request<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        link?: string;
        link_label?: string;
        is_read: boolean;
        isRead: boolean;
        priority: string;
        category: string;
        metadata?: any;
        created_by?: string;
        createdAt: string;
        readAt?: string;
      }>;
      total: number;
      unreadCount: number;
    }>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  async getUnreadNotifications() {
    return request<{
      unreadCount: number;
      recentUnread: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        link?: string;
        priority: string;
        category: string;
        created_at: string;
      }>;
    }>('/notifications/unread');
  },

  async getNotificationStats() {
    return request<{
      total: number;
      unread: number;
      urgent: number;
      high: number;
      byCategory: Array<{ category: string; count: number }>;
      byType: Array<{ type: string; count: number }>;
    }>('/notifications/stats');
  },

  async markNotificationRead(id: string) {
    return request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllNotificationsRead() {
    return request<{ success: boolean; message: string }>('/notifications/read-all', { method: 'PATCH' });
  },

  async deleteNotification(id: string) {
    return request<{ success: boolean }>(`/notifications/${id}`, { method: 'DELETE' });
  },

  async clearAllReadNotifications() {
    return request<{ success: boolean; message: string }>('/notifications/clear-all', { method: 'DELETE' });
  },

  async createNotification(data: {
    type: 'info' | 'warning' | 'error' | 'success' | 'system';
    title: string;
    message: string;
    link?: string;
    linkLabel?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: 'general' | 'user' | 'product' | 'system' | 'security' | 'performance' | 'support';
    metadata?: Record<string, any>;
  }) {
    return request<{ id: string }>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ============== SUPPORT TICKETS ==============
  async getSupportTickets(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    assigned_to?: string;
    sort_by?: string;
    sort_order?: string;
  }) {
    const p = new URLSearchParams();
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    if (params?.status) p.set('status', params.status);
    if (params?.priority) p.set('priority', params.priority);
    if (params?.category) p.set('category', params.category);
    if (params?.search) p.set('search', params.search);
    if (params?.assigned_to) p.set('assigned_to', params.assigned_to);
    if (params?.sort_by) p.set('sort_by', params.sort_by);
    if (params?.sort_order) p.set('sort_order', params.sort_order);
    const qs = p.toString();
    return request<{
      tickets: Array<{
        id: string;
        ticket_number: string;
        user_id?: string;
        user_email: string;
        user_name: string;
        subject: string;
        description: string;
        category: string;
        priority: string;
        status: string;
        assigned_to?: string;
        assigned_to_name?: string;
        reply_count: number;
        created_at: string;
        updated_at: string;
      }>;
      total: number;
      stats: {
        open: number;
        in_progress: number;
        resolved: number;
        closed: number;
        urgent: number;
      };
    }>(`/support${qs ? `?${qs}` : ''}`);
  },

  async getSupportTicket(id: string) {
    return request<{
      ticket: {
        id: string;
        ticket_number: string;
        user_id?: string;
        user_email: string;
        user_name: string;
        subject: string;
        description: string;
        category: string;
        priority: string;
        status: string;
        assigned_to?: string;
        assigned_to_name?: string;
        assigned_to_email?: string;
        rating?: number;
        rating_comment?: string;
        created_at: string;
        updated_at: string;
        createdAt: string;
        updatedAt: string;
        assignedAt?: string;
        resolvedAt?: string;
        closedAt?: string;
      };
      replies: Array<{
        id: string;
        ticket_id: string;
        user_id?: string;
        is_admin_reply: boolean;
        message: string;
        attachments?: any[];
        user_name?: string;
        user_email?: string;
        created_at: string;
        createdAt: string;
      }>;
    }>(`/support/${id}`);
  },

  async createSupportTicket(data: {
    user_email: string;
    user_name: string;
    subject: string;
    description: string;
    category?: 'general' | 'technical' | 'billing' | 'feature' | 'bug' | 'feedback';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }) {
    return request<{ id: string; ticketNumber: string }>('/support', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSupportTicket(id: string, data: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
  }) {
    return request<any>(`/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async replyToSupportTicket(id: string, data: {
    message: string;
    attachments?: any[];
  }) {
    return request<{
      id: string;
      message: string;
      isAdminReply: boolean;
      createdAt: string;
    }>(`/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteSupportTicket(id: string) {
    return request<{ success: boolean }>(`/support/${id}`, { method: 'DELETE' });
  },

  async rateSupportTicket(id: string, rating: number, comment?: string) {
    return request<{ success: boolean }>(`/support/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  },

  async getSupportAdmins() {
    return request<Array<{
      id: string;
      email: string;
      name: string;
      avatar?: string;
      role: string;
    }>>('/support/admins/list');
  },

  async getSupportStats() {
    return request<{
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
      avgResponseTimeMinutes?: number;
      byCategory: Array<{ category: string; count: number }>;
      byPriority: Array<{ priority: string; count: number }>;
    }>('/support/stats/overview');
  },

  // ============== FEEDBACK ==============
  async getFeedbackList(params?: {
    agent_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) {
    const p = new URLSearchParams();
    if (params?.agent_id) p.set('agent_id', params.agent_id);
    if (params?.start_date) p.set('start_date', params.start_date);
    if (params?.end_date) p.set('end_date', params.end_date);
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const qs = p.toString();
    return request<{
      feedback: Array<{
        id: string;
        message_id: string;
        session_id: string;
        user_id: string | null;
        rating: 'like' | 'dislike';
        reason: string | null;
        agent_id: string | null;
        language: string | null;
        created_at: string;
      }>;
      total: number;
    }>(`/chat/feedback/list${qs ? `?${qs}` : ''}`);
  },

  async getFeedbackStats(params?: {
    agent_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const p = new URLSearchParams();
    if (params?.agent_id) p.set('agent_id', params.agent_id);
    if (params?.start_date) p.set('start_date', params.start_date);
    if (params?.end_date) p.set('end_date', params.end_date);
    const qs = p.toString();
    return request<{
      stats: Array<{ rating: string; count: number }>;
      total: number;
      reasons: Array<{ reason: string; count: number }>;
    }>(`/chat/feedback/stats${qs ? `?${qs}` : ''}`);
  },

  async getFeedbackDetail(id: string) {
    return request<{
      id: string;
      message_id: string;
      session_id: string;
      user_id: string | null;
      rating: 'like' | 'dislike';
      reason: string | null;
      agent_id: string | null;
      language: string | null;
      created_at: string;
      message_content?: string;
      message_role?: string;
      message_agent_id?: string;
      conversation_title?: string;
      conversation_language?: string;
      user_name?: string;
      user_email?: string;
    }>(`/chat/feedback/${id}`);
  },

  async getFeedbackConversation(sessionId: string) {
    return request<{
      conversation: {
        id: string;
        title: string;
        agent_id: string | null;
        language: string | null;
        user_id: string | null;
        user_name?: string;
        user_email?: string;
        created_at: string;
        updated_at: string;
      };
      feedback: Array<{
        id: string;
        message_id: string;
        session_id: string;
        user_id: string | null;
        rating: 'like' | 'dislike';
        reason: string | null;
        agent_id: string | null;
        language: string | null;
        created_at: string;
        message_content?: string;
        message_role?: string;
        message_agent_id?: string;
      }>;
    }>(`/chat/feedback/conversation/${sessionId}`);
  },

  async getFeedbackDaily(params?: { days?: number }) {
    const p = new URLSearchParams();
    if (params?.days) p.set('days', String(params.days));
    const qs = p.toString();
    return request<{
      dailyStats: Array<{
        date: string;
        rating: string;
        count: number;
      }>;
      reasonsByDay: Array<{
        date: string;
        reason: string;
        count: number;
      }>;
    }>(`/chat/feedback/daily${qs ? `?${qs}` : ''}`);
  },

  // ============== FEEDBACK QUESTIONS ==============
  async getFeedbackQuestions() {
    return request<Array<{
      id: string;
      question_key: string;
      text_vi: string;
      text_en: string;
      text_ar: string;
      text_fr: string;
      icon: string;
      is_active: number;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }>>('/chat/feedback/all-questions');
  },

  async createFeedbackQuestion(data: {
    text_vi: string;
    text_en: string;
    text_ar: string;
    text_fr: string;
    icon?: string;
    is_active?: boolean;
    sort_order?: number;
  }) {
    return request<{ id: string; question_key: string }>('/chat/feedback/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFeedbackQuestion(id: string, data: {
    text_vi?: string;
    text_en?: string;
    text_ar?: string;
    text_fr?: string;
    icon?: string;
    is_active?: boolean;
    sort_order?: number;
  }) {
    return request<{ id: string; is_active: number }>(`/chat/feedback/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFeedbackQuestion(id: string) {
    return request<{ success: boolean }>(`/chat/feedback/questions/${id}`, { method: 'DELETE' });
  },

  async getFeedbackQuestionStats() {
    return request<Array<{
      question_key: string;
      text_vi: string;
      count: number;
      percent: number;
    }>>('/chat/feedback/questions/stats');
  },

  async getFeedbackMonthlyStats() {
    return request<{
      totalDislikeMonth: number;
      dislikeChangePercent: number;
      topReason: string | null;
    }>('/chat/feedback/stats/monthly');
  },
};