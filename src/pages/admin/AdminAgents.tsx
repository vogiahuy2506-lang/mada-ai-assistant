import { useState, useEffect, useRef, useMemo } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { MADA_BOTS } from '@/lib/madaBots';
import { useAuthStore, usePromptStore, useAgentStore } from '@/stores';
import { useTranslation } from '@/lib/translations';
import clsx from 'clsx';

// ============== TYPES ==============
interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  avatar_url?: string | null;
  system_prompt?: string;
  systemPrompt?: string;
  capabilities: string[];
  is_active?: boolean;
  isActive?: boolean;
  mada_category?: string;
  created_by?: string;
  createdAt?: number;
  updatedAt?: number;
  created_at?: string;
  updated_at?: string;
  knowledge_url?: string | null;
  product_url?: string | null;
  last_crawl_at?: string | null;
  last_crawl_status?: string | null;
  last_crawl_count?: number;
}

type CrawlResult = {
  url: string;
  kind: 'knowledge' | 'product';
  ok: boolean;
  docs: number;
  error?: string;
};

// ============== AVATAR COMPONENT (emoji OR uploaded image) ==============
function AgentAvatar({
  agent,
  size = 'md',
  className = '',
}: {
  agent: Pick<Agent, 'avatar' | 'avatar_url'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8 text-base' : size === 'lg' ? 'w-12 h-12 text-2xl' : 'w-10 h-10 text-xl';
  const isImage = !!agent.avatar_url && /^https?:\/\//.test(agent.avatar_url) || (!!agent.avatar_url && agent.avatar_url.startsWith('/'));

  if (isImage) {
    return (
      <div className={clsx(sizeClass, 'rounded-lg bg-white border-2 border-black overflow-hidden flex items-center justify-center shadow-[2px_2px_0px_0px_#000]', className)}>
        <img src={agent.avatar_url!} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={clsx(sizeClass, 'rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]', className)}>
      {agent.avatar || '🤖'}
    </div>
  );
}

// ============== MAIN COMPONENT ==============
export function AdminAgents() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const loadAgentsForChat = useAgentStore((s) => s.loadAgents);
  const removeAgentForChat = useAgentStore((s) => s.removeAgent);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Test Agent state
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; latency?: number; confidence?: number }>>([]);
  const [testing, setTesting] = useState(false);

  // KB viewer state
  const [kbModalAgent, setKbModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [kbDocs, setKbDocs] = useState<Array<{ id: string; title: string; content: string; source: string; metadata: any }>>([]);
  const [kbTotal, setKbTotal] = useState(0);
  const [kbLoading, setKbLoading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [editingTitleDocId, setEditingTitleDocId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [savingTitleDocId, setSavingTitleDocId] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set(MADA_BOTS.map(b => b.id)));
  const [importing, setImporting] = useState(false);

  const openKbModal = async (agent: { id: string; name: string }) => {
    setKbModalAgent({ id: agent.id, name: agent.name });
    setKbDocs([]);
    setKbTotal(0);
    setExpandedDocId(null);
    setEditingTitleDocId(null);
    setEditingTitleValue('');
    setKbLoading(true);
    try {
      const res = await adminApi.getAgentDocuments(agent.id, 100);
      if (res.success && res.data) {
        setKbDocs(res.data.documents || []);
        setKbTotal(res.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load KB docs:', err);
    } finally {
      setKbLoading(false);
    }
  };

  const closeKbModal = () => {
    setKbModalAgent(null);
    setKbDocs([]);
    setKbTotal(0);
    setExpandedDocId(null);
    setEditingTitleDocId(null);
    setEditingTitleValue('');
  };

  const startEditTitle = (docId: string, currentTitle: string) => {
    setEditingTitleDocId(docId);
    setEditingTitleValue(currentTitle || '');
  };

  const cancelEditTitle = () => {
    setEditingTitleDocId(null);
    setEditingTitleValue('');
  };

  const saveDocTitle = async (docId: string) => {
    const newTitle = editingTitleValue.trim();
    if (!newTitle) {
      cancelEditTitle();
      return;
    }
    if (!kbModalAgent) return;
    setSavingTitleDocId(docId);
    try {
      const res = await adminApi.updateAgentDocumentTitle(kbModalAgent.id, docId, newTitle);
      if (res.success) {
        setKbDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d)));
        cancelEditTitle();
      } else {
        alert(res.error || 'Lỗi cập nhật tiêu đề');
      }
    } catch (err) {
      alert((err as Error)?.message || 'Lỗi cập nhật tiêu đề');
    } finally {
      setSavingTitleDocId(null);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    avatar_url: '' as string,
    system_prompt: '',
    prompt_id: '' as string,
    capabilities: [] as string[],
    knowledge_url: '',
    product_url: '',
    crawl_follow_links: false,
    crawl_max_depth: 1,
    crawl_max_pages: 5,
  });
  const [availablePrompts, setAvailablePrompts] = useState<Array<{ id: string; name: string; isSystem: boolean }>>([]);
  // ⭐ Subscribe vào shared prompt store → nếu admin tạo prompt mới ở /admin/prompts
  // thì dropdown ở đây sẽ tự cập nhật, KHÔNG cần F5.
  const storePrompts = usePromptStore((s) => s.prompts);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<{ totalDocs: number; results: CrawlResult[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============== DATA LOAD ==============
  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getAgents();
      if (res.success && res.data) {
        setAgents(res.data as unknown as Agent[]);
      } else {
        setError(res.error || 'Failed to load agents');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    // ⭐ Ưu tiên shared store (đã được AdminPrompts đồng bộ trước đó).
    // Nếu store rỗng (lần đầu vào trang Agents) → fetch trực tiếp & seed vào store.
    const fromStore = usePromptStore.getState().prompts;
    if (fromStore.length > 0) {
      setAvailablePrompts(
        fromStore
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name, isSystem: p.isSystem }))
      );
      return;
    }
    try {
      const res = await adminApi.getPrompts();
      if (res.success && res.data) {
        const mapped = (res.data as any[])
          .filter((p: any) => p.isActive ?? p.is_active === 1)
          .map((p: any) => ({ id: p.id, name: p.name, isSystem: p.isSystem ?? p.is_system === 1 }));
        setAvailablePrompts(mapped);
        // Seed shared store
        usePromptStore.getState().setPrompts(
          (res.data as any[]).map((p: any) => ({
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
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load prompts:', err);
    }
  };

  useEffect(() => {
    loadAgents();
    loadPrompts();
  }, []);

  // ⭐ React to shared store changes → dropdown auto-refresh khi admin
  // tạo/sửa/xóa/toggle prompt ở tab /admin/prompts.
  useEffect(() => {
    setAvailablePrompts(
      storePrompts
        .filter((p) => p.isActive)
        .map((p) => ({ id: p.id, name: p.name, isSystem: p.isSystem }))
    );
  }, [storePrompts]);

  // ============== HANDLERS ==============
  const save = () => {
    setSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setTimeout(() => setSavedAt(null), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      avatar: '🤖',
      avatar_url: '',
      system_prompt: '',
      prompt_id: '',
      capabilities: [],
      knowledge_url: '',
      product_url: '',
      crawl_follow_links: false,
      crawl_max_depth: 1,
      crawl_max_pages: 5,
    });
    setCrawlResult(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) return;

    try {
      const agentData: any = {
        name: formData.name,
        description: formData.description,
        avatar: formData.avatar,
        avatar_url: formData.avatar_url || null,
        system_prompt: formData.system_prompt,
        prompt_id: formData.prompt_id || null,
        capabilities: formData.capabilities,
        knowledge_url: formData.knowledge_url || null,
        product_url: formData.product_url || null,
        crawl_follow_links: formData.crawl_follow_links ? 1 : 0,
        crawl_max_depth: Number(formData.crawl_max_depth) || 1,
        crawl_max_pages: Number(formData.crawl_max_pages) || 5,
      };

      let savedAgentId = editingId;
      if (editingId) {
        const res = await adminApi.updateAgent(editingId, agentData);
        if (!res.success) {
          alert(res.error);
          return;
        }
      } else {
        const res = await adminApi.createAgent(agentData);
        if (!res.success) {
          alert(res.error);
          return;
        }
        savedAgentId = res.data?.id || null;
      }

      // Nếu có URL knowledge/product → cào ngay sau khi lưu
      const hasUrl =
        /^https?:\/\//i.test(formData.knowledge_url.trim()) ||
        /^https?:\/\//i.test(formData.product_url.trim());
      if (savedAgentId && hasUrl) {
        await handleCrawl(savedAgentId, {
          knowledge_url: formData.knowledge_url.trim(),
          product_url: formData.product_url.trim(),
        }, /* silent */ false);
      }

      await loadAgents();
      // Đồng bộ sang global store để ChatPage thấy ngay (kể cả khi user đang mở chat tab khác)
      void loadAgentsForChat();
      resetForm();
      setShowForm(false);
      setEditingId(null);
      save();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCrawl = async (
    agentId: string,
    payload: { knowledge_url?: string; product_url?: string },
    silent = true,
  ) => {
    setCrawling(true);
    try {
      const res = await adminApi.crawlAgentSources(agentId, {
        ...payload,
        crawl_follow_links: formData.crawl_follow_links ? 1 : 0,
        crawl_max_depth: formData.crawl_max_depth,
        crawl_max_pages: formData.crawl_max_pages,
      });
      if (res.success && res.data) {
        setCrawlResult({ totalDocs: res.data.totalDocs, results: res.data.results as CrawlResult[] });
        if (!silent) {
          const failed = res.data.results.filter(r => !r.ok);
          if (failed.length === 0) {
            alert(`✅ Đã cào và ingest ${res.data.totalDocs} documents vào KB của agent.`);
          } else {
            alert(`⚠️ Cào xong ${res.data.totalDocs} docs. ${failed.length} URL lỗi:\n${failed.map(f => `• ${f.kind}: ${f.error}`).join('\n')}`);
          }
        }
      } else {
        if (!silent) alert(`❌ Cào thất bại: ${res.error}`);
        setCrawlResult(null);
      }
    } catch (err: any) {
      if (!silent) alert(`❌ Lỗi: ${err.message}`);
    } finally {
      setCrawling(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    if (!isAdmin) {
      alert('Chỉ admin mới có quyền chỉnh sửa Agent.');
      return;
    }
    setFormData({
      name: agent.name,
      description: agent.description || '',
      avatar: agent.avatar,
      avatar_url: agent.avatar_url || '',
      system_prompt: agent.system_prompt || agent.systemPrompt || '',
      prompt_id: (agent as any).prompt_id || (agent as any).promptId || '',
      capabilities: agent.capabilities,
      knowledge_url: agent.knowledge_url || '',
      product_url: agent.product_url || '',
      crawl_follow_links: !!(agent as any).crawl_follow_links,
      crawl_max_depth: (agent as any).crawl_max_depth || 1,
      crawl_max_pages: (agent as any).crawl_max_pages || 5,
    });
    setEditingId(agent.id);
    setCrawlResult(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Chỉ admin mới có quyền xoá Agent.');
      return;
    }
    if (!confirm('Bạn có chắc muốn xóa Agent này?')) return;
    try {
      const res = await adminApi.deleteAgent(id);
      if (res.success) {
        removeAgentForChat(id);
        await loadAgents();
        void loadAgentsForChat();
        save();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleAgentActive = async (id: string) => {
    if (!isAdmin) {
      alert('Chỉ admin mới có quyền bật/tắt Agent.');
      return;
    }
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    const newActive = !(agent.is_active || agent.isActive);
    try {
      const res = await adminApi.updateAgent(id, { is_active: newActive });
      if (res.success) {
        await loadAgents();
        void loadAgentsForChat();
        save();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============== AVATAR UPLOAD ==============
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File quá lớn. Tối đa 2MB.');
      return;
    }
    if (!/^image\//.test(file.type)) {
      alert('Chỉ chấp nhận file ảnh.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await adminApi.uploadAgentAvatar(file);
      if (res.success && 'data' in res && res.data) {
        setFormData(prev => ({ ...prev, avatar_url: res.data.url }));
      } else {
        alert((res as any).error || 'Upload thất bại');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearAvatarImage = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }));
  };

  // ============== TEST AGENT ==============
  const handleTestAgent = async () => {
    if (!testAgentId || !testInput.trim()) return;
    const userMsg = { role: 'user' as const, content: testInput };
    setTestMessages(prev => [...prev, userMsg]);
    setTesting(true);
    const inputSnapshot = testInput;
    setTestInput('');
    try {
      const res = await adminApi.testAgent({ agentId: testAgentId, message: inputSnapshot });
      if (res.success && res.data && res.data.response) {
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data!.response || '(empty response)',
          latency: res.data!.latencyMs,
          confidence: res.data!.confidence,
        }]);
      } else {
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Lỗi: ${res.error || 'unknown'}`,
        }]);
      }
    } catch (e: any) {
      setTestMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Exception: ${e.message}`,
      }]);
    } finally {
      setTesting(false);
    }
  };

  // ============== CAPABILITIES ==============
  const capabilityOptions = [
    { value: 'chat', label: 'Chat' },
    { value: 'file_analysis', label: 'Phân tích file' },
    { value: 'accessibility_help', label: 'Hỗ trợ tiếp cận' },
    { value: 'expert_consultation', label: 'Tư vấn chuyên gia' },
    { value: 'device_recommendation', label: 'Gợi ý thiết bị' },
    { value: 'training', label: 'Đào tạo' },
  ];

  const toggleCapability = (cap: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap],
    }));
  };

  // ============== IMPORT MADA BOTS ==============
  const handleImportSelected = async () => {
    if (!isAdmin) return;
    const selectedBots = MADA_BOTS.filter(b => importSelected.has(b.id));
    if (selectedBots.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bot để import.');
      return;
    }
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    let crawledDocs = 0;

    for (const bot of selectedBots) {
      const exists = agents.some(a => a.id === bot.id);
      if (exists) { skipped++; continue; }
      try {
        const res = await adminApi.createAgent({
          id: bot.id,
          name: bot.name,
          description: `${bot.description} (ISO: ${bot.isoCodes.join(', ') || 'general'})`,
          avatar: bot.avatar,
          avatar_url: null,
          system_prompt: `Bạn là ${bot.nameVi} của MADA AI Assistant.\n\nChuyên môn: ${bot.description}\n\nURL MADA: ${bot.madaUrl}\n\nTiêu chuẩn ISO: ${bot.isoCodes.join(', ') || 'general'}\n\nKhi user hỏi ngoài domain, lịch sự hướng dẫn chọn bot phù hợp khác.`,
          capabilities: ['chat', 'device_recommendation', ...bot.isoCodes.slice(0, 2).map(c => `iso_${c.replace(/\./g, '_')}`)],
          is_active: true,
          mada_category: bot.madaCategory,
          bot_id: bot.id,
          knowledge_url: bot.madaUrl || null,
        });
        if (!res.success) { skipped++; continue; }
        imported++;
        if (bot.madaUrl && /^https?:\/\//i.test(bot.madaUrl)) {
          try {
            const crawlRes = await adminApi.crawlAgentSources(bot.id, { knowledge_url: bot.madaUrl });
            if (crawlRes.success && crawlRes.data) crawledDocs += crawlRes.data.totalDocs || 0;
          } catch {}
        }
      } catch { skipped++; }
    }

    await loadAgents();
    void loadAgentsForChat();
    save();
    setShowImportModal(false);
    setImporting(false);
    alert(
      `✅ Import xong!\n` +
      `• Tạo mới: ${imported} bot\n` +
      `• Bỏ qua: ${skipped} bot (đã tồn tại)\n` +
      `• Documents đã cào: ${crawledDocs}`
    );
  };

  const toggleImportBot = (botId: string) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      if (next.has(botId)) next.delete(botId);
      else next.add(botId);
      return next;
    });
  };

  const openImportModal = () => {
    // Pre-select only MADA bots not yet in agents
    const available = new Set(MADA_BOTS.filter(b => !agents.some(a => a.id === b.id)).map(b => b.id));
    setImportSelected(available);
    setShowImportModal(true);
  };

  // ============== HELPERS ==============
  const isValidUrl = (s: string) => /^https?:\/\/.+/i.test(s.trim());

  const formHasValidUrl = useMemo(
    () => isValidUrl(formData.knowledge_url) || isValidUrl(formData.product_url),
    [formData.knowledge_url, formData.product_url],
  );

  const editingAgent = editingId ? agents.find(a => a.id === editingId) : null;

  const openCreateForm = () => {
    if (!isAdmin) return;
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  // ============== RENDER ==============
  const { t } = useTranslation();
  return (
    <AdminLayout
      title={t('admin.topBar.agents')}
      titleEn="Agent Management"
      titleAr="إدارة الوكلاء"
      titleFr="Gestion des agents"
      subtitle={t('admin.topBar.agentsSub')}
      subtitleEn="Create and manage AI Agents. Users can select an Agent to chat with."
      subtitleAr="إنشاء وإدارة وكلاء الذكاء الاصطناعي. يمكن للمستخدمين اختيار وكيل للدردشة."
      subtitleFr="Créer et gérer les agents IA. Les utilisateurs peuvent choisir un agent."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-2xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-2xl"></div>
          <div className="max-w-2xl relative z-10 py-4 px-5">
            <h2 className="text-2xl font-black text-on-surface mb-2">
              {t('admin.agents.title')}
            </h2>
            <p className="text-sm font-medium text-on-surface-variant border-l-4 border-primary pl-4 py-1.5 bg-white/40 backdrop-blur-sm rounded-r-lg">
              {t('admin.agents.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {!isAdmin && (
        <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-800 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">lock</span>
          Bạn đang xem với quyền <b>{user?.role || 'guest'}</b>. Chỉ <b>admin</b> mới có thể tạo / sửa / xoá Agent.
        </div>
      )}

      {/* Metrics Row */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">TỔNG</p>
            <h3 className="text-lg font-black text-on-surface">{agents.length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-green-50 to-green-100/40 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-green-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-green-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider">HOẠT ĐỘNG</p>
            <h3 className="text-lg font-black text-green-700">{agents.filter(a => a.isActive).length}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100/40 backdrop-blur-xl rounded-xl p-3 border-2 border-black flex items-center gap-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-gray-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="material-symbols-outlined text-gray-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pause_circle</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wider">TẠM DỪNG</p>
            <h3 className="text-lg font-black text-gray-700">{agents.filter(a => !a.isActive).length}</h3>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <span className="text-sm text-on-surface-variant font-medium">
          {loading ? t('admin.agents.loading') : `${agents.length} ${t('admin.agents.count')}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadAgents(); loadPrompts(); }}
            title={t('admin.common.refresh') || 'Làm mới'}
            className="flex items-center gap-1 bg-white text-on-surface px-3 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Làm mới
          </button>
          {isAdmin && (
            <>
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
                title="Import bot MADA: chọn bot muốn import"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                {t('admin.agents.importMada')}
              </button>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {t('admin.agents.add')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-700">
          <p className="font-medium">{error}</p>
          <button onClick={loadAgents} className="mt-2 text-sm underline">Thử lại</button>
        </div>
      )}

      {/* ============== AGENT FORM MODAL ============== */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-2xl border-2 border-black w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={formData} size="md" />
                  <div>
                    <h3 className="text-lg font-black text-on-surface">{editingId ? t('admin.agents.edit') : t('admin.agents.create')}</h3>
                    <p className="text-xs text-on-surface-variant">{editingId ? t('admin.agents.edit') : t('admin.agents.add')}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="p-4 space-y-4"
            >
              {/* Avatar — emoji OR uploaded image */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t('admin.agents.formAvatar')}</label>
                <div className="flex items-start gap-3">
                  <AgentAvatar agent={formData} size="lg" />
                  <div className="flex-1 space-y-2">
                    {/* Emoji picker */}
                    <div className="flex gap-1.5 flex-wrap">
                      {['🤖', '👨‍🏫', '👩‍💻', '🔧', '💡', '🎯', '🏥', '⚖️'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, avatar: emoji, avatar_url: '' }))}
                          className={clsx(
                            'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-2 border-black shadow-[2px_2px_0px_0px_#000]',
                            !formData.avatar_url && formData.avatar === emoji
                              ? 'bg-primary text-white translate-y-[-1px]'
                              : 'bg-white hover:bg-gray-50'
                          )}
                          title="Dùng emoji"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Upload ảnh từ máy */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-700 font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {uploadingAvatar ? 'progress_activity' : 'upload'}
                        </span>
                        {uploadingAvatar ? t('admin.common.loading') : t('admin.agents.formAvatar')}
                      </button>
                      {formData.avatar_url && (
                        <button
                          type="button"
                          onClick={clearAvatarImage}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold text-xs border border-red-300 hover:bg-red-100"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Xoá ảnh
                        </button>
                      )}
                      <span className="text-[10px] text-gray-500">PNG/JPG/WEBP/SVG ≤ 2MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tên Agent <span className="text-red-500">*</span></label>
                <input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: MADA Assistant"
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả ngắn về Agent..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* System Prompt Reference (optional) */}
              {availablePrompts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    System Prompt tham chiếu <span className="text-gray-400 font-normal">(tùy chọn)</span>
                  </label>
                  <select
                    value={formData.prompt_id}
                    onChange={e => setFormData(prev => ({ ...prev, prompt_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Không tham chiếu (dùng prompt tự do bên dưới) —</option>
                    {availablePrompts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isSystem ? '⭐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* System Prompt */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  System Prompt <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(override nếu có tham chiếu ở trên)</span>
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="VD: Bạn là trợ lý ảo của MADA..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Knowledge URL — tổng quát */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50/40 border-2 border-blue-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-base">language</span>
                  <label className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider">Knowledge URL (tổng quát)</label>
                </div>
                <input
                  type="url"
                  value={formData.knowledge_url}
                  onChange={e => setFormData(prev => ({ ...prev, knowledge_url: e.target.value }))}
                  placeholder="https://example.com/kien-thuc-tong-quat"
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-[10px] text-blue-700/80">
                  URL tổng quát về chủ đề của agent. Sẽ được cào và ingest vào KB ngay khi bấm Tạo/Lưu.
                </p>
              </div>

              {/* Product URL — sản phẩm cụ thể */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/40 border-2 border-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">inventory_2</span>
                  <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Product URL (sản phẩm cụ thể)</label>
                </div>
                <input
                  type="url"
                  value={formData.product_url}
                  onChange={e => setFormData(prev => ({ ...prev, product_url: e.target.value }))}
                  placeholder="https://example.com/san-pham/abc-123"
                  className="w-full px-3 py-2 rounded-lg bg-white border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <p className="text-[10px] text-emerald-700/80">
                  Trang sản phẩm cụ thể. Sẽ được extract metadata + ingest vào KB ngay.
                </p>
              </div>

              {/* Crawl options — Google Sheets / recursive */}
              <details className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50/40 border-2 border-purple-200">
                <summary className="cursor-pointer text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span className="material-symbols-outlined text-purple-600 text-base">tune</span>
                  Tùy chọn cào nâng cao
                </summary>
                <div className="mt-3 space-y-2">
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-white/60 border border-purple-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.crawl_follow_links}
                      onChange={e => setFormData(prev => ({ ...prev, crawl_follow_links: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-purple-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-purple-900">Follow sub-links cùng domain</div>
                      <div className="text-[10px] text-purple-700/80">
                        Bật để cào thêm các trang con (cùng tên miền). Tốn thời gian hơn nhưng lấy được nhiều dữ liệu hơn.
                      </div>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">Độ sâu tối đa</label>
                      <input
                        type="number"
                        min={0}
                        max={3}
                        disabled={!formData.crawl_follow_links}
                        value={formData.crawl_max_depth}
                        onChange={e => setFormData(prev => ({ ...prev, crawl_max_depth: Math.max(0, Math.min(3, Number(e.target.value))) }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border-2 border-purple-300 text-sm disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">Số trang tối đa</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        disabled={!formData.crawl_follow_links}
                        value={formData.crawl_max_pages}
                        onChange={e => setFormData(prev => ({ ...prev, crawl_max_pages: Math.max(1, Math.min(50, Number(e.target.value))) }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border-2 border-purple-300 text-sm disabled:opacity-40"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-purple-700/80 bg-white/60 rounded-lg p-2 border border-purple-200">
                    💡 <strong>Google Sheets public</strong> (chế độ xem /edit hoặc /htmlview) sẽ tự động được export sang CSV và format từng dòng thành <code>key: value | key: value</code> để AI dễ trả lời theo từng sản phẩm.
                  </div>
                </div>
              </details>

              {/* Test crawl (chỉ khi edit + có URL) */}
              {editingId && formHasValidUrl && (
                <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-base">travel_explore</span>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Test cào dữ liệu ngay</span>
                    </div>
                    <button
                      type="button"
                      disabled={crawling}
                      onClick={() => handleCrawl(editingId, {
                        knowledge_url: formData.knowledge_url.trim(),
                        product_url: formData.product_url.trim(),
                      }, false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">{crawling ? 'progress_activity' : 'play_arrow'}</span>
                      {crawling ? 'Đang cào...' : 'Cào thử'}
                    </button>
                  </div>
                  {crawlResult && (
                    <div className="text-[11px] space-y-1">
                      <p className="font-bold text-emerald-700">✓ Tổng: {crawlResult.totalDocs} documents</p>
                      {crawlResult.results.map((r, i) => (
                        <p key={i} className={clsx('flex items-center gap-1', r.ok ? 'text-emerald-700' : 'text-red-600')}>
                          <span className="material-symbols-outlined text-xs">{r.ok ? 'check_circle' : 'error'}</span>
                          <span className="font-mono truncate">{r.url}</span>
                          <span>→ {r.docs} docs{r.error ? ` (${r.error})` : ''}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {editingAgent?.last_crawl_at && (
                    <p className="text-[10px] text-gray-500">
                      Lần cào gần nhất: {new Date(editingAgent.last_crawl_at).toLocaleString('vi-VN')}
                      {editingAgent.last_crawl_status && ` · ${editingAgent.last_crawl_status}`}
                      {editingAgent.last_crawl_count != null && ` · ${editingAgent.last_crawl_count} docs`}
                    </p>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Khả năng</label>
                <div className="flex flex-wrap gap-1.5">
                  {capabilityOptions.map(cap => (
                    <button
                      key={cap.value}
                      type="button"
                      onClick={() => toggleCapability(cap.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                        formData.capabilities.includes(cap.value)
                          ? 'bg-primary text-white translate-y-[-1px]'
                          : 'bg-white text-on-surface hover:bg-gray-50'
                      )}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.system_prompt.trim() || crawling}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crawling ? 'Đang cào + lưu...' : editingId ? 'Lưu' : (formHasValidUrl ? 'Tạo + cào' : 'Tạo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== AGENTS GRID ============== */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl border-2 border-black p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-2xl"></div>

        {loading ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 text-gray-400 shadow-[4px_4px_0px_0px_#000] animate-pulse">
              <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">Đang tải...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 text-gray-400 shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </div>
            <h4 className="text-lg font-black text-on-surface mb-1">Chưa có Agent nào</h4>
            <p className="text-sm text-on-surface-variant text-center mb-4">
              Tạo Agent đầu tiên hoặc import 7 bot MADA mẫu.
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
              >
                <span className="material-symbols-outlined text-xs mr-1">download</span>
                Import 7 bot MADA
              </button>
            )}
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={clsx(
                  'p-4 rounded-xl border-2 border-black transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]',
                  (agent.is_active || agent.isActive)
                    ? 'bg-gradient-to-br from-primary/10 to-primary/5'
                    : 'bg-gray-50'
                )}
              >
                <div className="flex items-start gap-3 mb-3">
                  <AgentAvatar agent={agent} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-on-surface truncate text-sm">{agent.name}</h4>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[9px] font-bold border border-black',
                        (agent.is_active || agent.isActive) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {(agent.is_active || agent.isActive) ? 'ON' : 'OFF'}
                      </span>
                      {agent.mada_category && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-black bg-blue-100 text-blue-700">
                          🏷️ {agent.mada_category}
                        </span>
                      )}
                      {agent.created_by && agent.created_by !== 'system' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-black bg-purple-100 text-purple-700">
                          ✨ Tùy chỉnh
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">
                      {agent.description || 'Không có mô tả'}
                    </p>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {agent.capabilities.slice(0, 3).map((cap, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-white border border-black/20 text-[9px] text-on-surface-variant"
                    >
                      {capabilityOptions.find(c => c.value === cap)?.label || cap}
                    </span>
                  ))}
                </div>

                {/* Knowledge sources indicator */}
                {(agent.knowledge_url || agent.product_url || agent.last_crawl_count) && (
                  <div className="mb-3 space-y-1">
                    {agent.knowledge_url && (
                      <p className="text-[9px] text-blue-700 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-xs">language</span>
                        <span className="truncate">{agent.knowledge_url}</span>
                      </p>
                    )}
                    {agent.product_url && (
                      <p className="text-[9px] text-emerald-700 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-xs">inventory_2</span>
                        <span className="truncate">{agent.product_url}</span>
                      </p>
                    )}
                    {/* KB badge */}
                    {agent.last_crawl_count != null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-black flex items-center gap-1',
                          agent.last_crawl_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          agent.last_crawl_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          agent.last_crawl_status === 'running' ? 'bg-blue-100 text-blue-700' :
                          agent.last_crawl_status?.startsWith('failed') ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          <span className="material-symbols-outlined text-[10px]">database</span>
                          KB: {agent.last_crawl_count} docs
                        </span>
                        {agent.last_crawl_at && (
                          <span className="text-[9px] text-gray-500">
                            {new Date(agent.last_crawl_at).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-black/10">
                  <button
                    onClick={() => toggleAgentActive(agent.id)}
                    disabled={!isAdmin}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg font-bold text-xs border border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                      (agent.is_active || agent.isActive)
                        ? 'bg-yellow-100 text-yellow-700 hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50'
                        : 'bg-green-100 text-green-700 hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-50'
                    )}
                    title={isAdmin ? '' : 'Chỉ admin mới có quyền'}
                  >
                    {(agent.is_active || agent.isActive) ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    disabled={!isAdmin}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white font-bold text-xs border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isAdmin ? 'Sửa agent' : 'Chỉ admin mới có quyền sửa'}
                  >
                    {isAdmin ? 'Sửa' : (
                      <span className="inline-flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-xs">lock</span>
                        Khoá
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTestAgentId(agent.id);
                      setTestMessages([]);
                    }}
                    title="Test agent này"
                    className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                  >
                    <span className="material-symbols-outlined text-xs">play_arrow</span>
                  </button>
                  <button
                    onClick={() => openKbModal({ id: agent.id, name: agent.name })}
                    title="Xem Knowledge Base"
                    className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                  >
                    <span className="material-symbols-outlined text-xs">database</span>
                  </button>
                  {isAdmin ? (
                    <button
                      onClick={() => handleDelete(agent.id)}
                      title="Xoá agent"
                      className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  ) : (
                    <div
                      title="Chỉ admin mới có quyền xoá"
                      className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-300 cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-xs">lock</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============== TEST AGENT MODAL ============== */}
      {testAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50">
              <div>
                <h2 className="text-lg font-bold">Test Agent</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Agent: <span className="font-mono font-bold">{testAgentId}</span>
                </p>
              </div>
              <button
                onClick={() => { setTestAgentId(null); setTestMessages([]); }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[300px]">
              {testMessages.length === 0 ? (
                <div className="text-center text-sm text-on-surface-variant py-12">
                  <span className="material-symbols-outlined text-4xl mb-2">chat</span>
                  <p>Nhập câu hỏi bên dưới để test agent.</p>
                  <p className="text-xs mt-1">Kết quả sẽ hiển thị confidence + latency.</p>
                </div>
              ) : (
                testMessages.map((m, i) => (
                  <div key={i} className={clsx('p-3 rounded-lg text-sm', m.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-slate-50 mr-8')}>
                    <div className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      {m.role === 'user' ? 'Bạn' : 'Agent'}
                      {m.latency !== undefined && <span className="ml-2 text-emerald-600">{m.latency}ms</span>}
                      {m.confidence !== undefined && <span className="ml-2 text-blue-600">
                        {m.confidence <= 1 ? Math.round(m.confidence * 100) : Math.round(m.confidence)}% conf
                      </span>}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))
              )}
              {testing && (
                <div className="p-3 rounded-lg bg-slate-50 mr-8 text-sm text-on-surface-variant">
                  <span className="animate-pulse">⏳ Agent đang suy nghĩ...</span>
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant p-3 flex gap-2">
              <input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestAgent(); } }}
                placeholder="Nhập câu hỏi test..."
                className="flex-1 h-10 px-3 rounded-lg border border-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={testing}
              />
              <button
                onClick={handleTestAgent}
                disabled={testing || !testInput.trim()}
                className="px-4 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-50"
              >
                {testing ? '...' : 'Gửi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== KB VIEWER MODAL ============== */}
      {kbModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border-2 border-black">
            <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600">database</span>
                  Knowledge Base
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  Agent: <span className="font-mono font-bold">{kbModalAgent.name}</span>
                  {!kbLoading && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 text-[10px] font-bold">
                      {kbTotal} documents
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closeKbModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
              {kbLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <span className="material-symbols-outlined animate-spin text-violet-600 text-4xl mb-2">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">Đang tải KB...</p>
                </div>
              ) : kbDocs.length === 0 ? (
                <div className="text-center text-on-surface-variant py-16">
                  <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">database_off</span>
                  <p className="text-sm font-medium">Knowledge Base đang trống</p>
                  <p className="text-xs mt-1">Cào 1 URL trong form Edit Agent để ingest documents vào KB.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kbDocs.map((doc) => {
                    const isExpanded = expandedDocId === doc.id;
                    const sourceKind = doc.metadata?.sourceKind;
                    const isEditingTitle = editingTitleDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="border-2 border-black/10 rounded-xl bg-white hover:border-violet-300 transition-all"
                      >
                        <div className="w-full px-4 py-3 flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                            className="flex items-start gap-3 text-left flex-1 min-w-0"
                            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                          >
                            <span className="material-symbols-outlined text-violet-600 text-sm mt-0.5">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-on-surface truncate">
                                {doc.title || '(không tiêu đề)'}
                              </h4>
                              <p className="text-[10px] text-on-surface-variant truncate">{doc.source}</p>
                            </div>
                          </button>
                          {!isEditingTitle && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); startEditTitle(doc.id, doc.title); }}
                              title={t('admin.agents.kbEditTitle')}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-300 flex items-center gap-0.5 flex-shrink-0"
                            >
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                              {t('admin.common.edit')}
                            </button>
                          )}
                          {isEditingTitle && (
                            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingTitleValue}
                                onChange={(e) => setEditingTitleValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveDocTitle(doc.id); }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelEditTitle(); }
                                }}
                                autoFocus
                                placeholder={t('admin.agents.kbEditTitlePlaceholder')}
                                className="flex-1 min-w-0 px-2 py-1 text-sm font-bold rounded border-2 border-violet-400 focus:outline-none focus:border-violet-600"
                              />
                              <button
                                type="button"
                                onClick={() => saveDocTitle(doc.id)}
                                disabled={savingTitleDocId === doc.id}
                                title={t('admin.common.save')}
                                className="px-2 py-1 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {savingTitleDocId === doc.id ? (
                                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-sm">check</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditTitle}
                                title={t('admin.common.cancel')}
                                className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          )}
                          {sourceKind && (
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0',
                              sourceKind === 'product' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'
                            )}>
                              {sourceKind}
                            </span>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                            <pre className="text-xs text-on-surface bg-slate-50 p-3 rounded-lg mt-3 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                              {doc.content}
                            </pre>
                            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-[10px] font-bold text-slate-500 cursor-pointer">
                                  Metadata ({Object.keys(doc.metadata).length})
                                </summary>
                                <pre className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(doc.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-outline-variant bg-slate-50 text-xs text-on-surface-variant flex items-center justify-between">
              <span>
                {kbDocs.length < kbTotal
                  ? `Hiển thị ${kbDocs.length} / ${kbTotal} documents`
                  : `Tổng cộng: ${kbTotal} documents`}
              </span>
              <span>KB dùng cho RAG khi user chat với agent</span>
            </div>
          </div>
        </div>
      )}

      {/* ============== IMPORT MODAL ============== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border-2 border-black">
            <div className="px-5 py-4 border-b-2 border-black flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h2 className="text-lg font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">download</span>
                  {t('admin.agents.importModalTitle')}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Tick chọn bot MADA muốn import. Bot đã tồn tại sẽ bị bỏ qua.</p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto space-y-1">
              {MADA_BOTS.map((bot) => {
                const exists = agents.some(a => a.id === bot.id);
                const checked = importSelected.has(bot.id);
                return (
                  <label
                    key={bot.id}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      exists ? 'border-gray-200 bg-gray-50 opacity-50' : checked ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !exists && toggleImportBot(bot.id)}
                      disabled={exists}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-2xl">{bot.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-on-surface">{bot.name}</div>
                      <div className="text-xs text-on-surface-variant truncate">{bot.description}</div>
                    </div>
                    {exists && (
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Đã có</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t-2 border-black bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">
                {importSelected.size} bot được chọn
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg border-2 border-black font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  {t('admin.common.cancel')}
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={importing || importSelected.size === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[-1px] hover:-translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      Đang import...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">download</span>
                      Import {importSelected.size} bot
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB (chỉ admin) */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={openCreateForm}
            className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-xl font-bold">add</span>
          </button>
        </div>
      )}
      {savedAt && (
        <div className="fixed bottom-6 left-6 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[4px_4px_0px_0px_#000] animate-pulse">
          ✓ Đã lưu lúc {savedAt}
        </div>
      )}
    </AdminLayout>
  );
}
