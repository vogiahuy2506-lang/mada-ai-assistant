import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { MADA_BOTS } from '@/lib/madaBots';
import clsx from 'clsx';

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
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
}

export function AdminAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // ⭐ Test Agent state
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; latency?: number; confidence?: number }>>([]);
  const [testing, setTesting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    system_prompt: '',
    capabilities: [] as string[],
  });

  // Load agents from API
  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getAgents();
      if (res.success && res.data) {
        setAgents(res.data);
      } else {
        setError(res.error || 'Failed to load agents');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const save = () => {
    setSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setTimeout(() => setSavedAt(null), 3000);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) return;

    try {
      const agentData = {
        name: formData.name,
        description: formData.description,
        avatar: formData.avatar,
        system_prompt: formData.system_prompt,
        capabilities: formData.capabilities,
      };

      if (editingId) {
        const res = await adminApi.updateAgent(editingId, agentData);
        if (res.success) {
          await loadAgents();
        } else {
          alert(res.error);
        }
      } else {
        const res = await adminApi.createAgent(agentData);
        if (res.success) {
          await loadAgents();
        } else {
          alert(res.error);
        }
      }

      setFormData({ name: '', description: '', avatar: '🤖', system_prompt: '', capabilities: [] });
      setShowForm(false);
      setEditingId(null);
      save();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      description: agent.description || '',
      avatar: agent.avatar,
      system_prompt: agent.system_prompt || agent.systemPrompt || '',
      capabilities: agent.capabilities,
    });
    setEditingId(agent.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa Agent này?')) return;
    try {
      const res = await adminApi.deleteAgent(id);
      if (res.success) {
        await loadAgents();
        save();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleAgentActive = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    const newActive = !(agent.is_active || agent.isActive);
    try {
      const res = await adminApi.updateAgent(id, { is_active: newActive });
      if (res.success) {
        await loadAgents();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  // Import 7 bot MADA mẫu từ database
  const importMadaBots = async () => {
    if (!confirm('Import 7 bot MADA mặc định? (Sẽ bỏ qua các bot đã tồn tại)')) return;

    let imported = 0;
    let skipped = 0;

    for (const bot of MADA_BOTS) {
      // Check duplicate
      const exists = agents.some(a => a.id === bot.id);
      if (exists) {
        skipped++;
        continue;
      }

      try {
        const res = await adminApi.createAgent({
          id: bot.id,
          name: bot.name,
          description: `${bot.description} (ISO: ${bot.isoCodes.join(', ') || 'general'})`,
          avatar: bot.avatar,
          system_prompt: `Bạn là ${bot.nameVi} của MADA AI Assistant.\n\nChuyên môn: ${bot.description}\n\nURL MADA: ${bot.madaUrl}\n\nTiêu chuẩn ISO: ${bot.isoCodes.join(', ') || 'general'}\n\nKhi user hỏi ngoài domain, lịch sự hướng dẫn chọn bot phù hợp khác.`,
          capabilities: ['chat', 'device_recommendation', ...bot.isoCodes.slice(0, 2).map(c => `iso_${c.replace(/\./g, '_')}`)],
          is_active: true,
          mada_category: bot.madaCategory,
          bot_id: bot.id,
        });
        if (res.success) imported++;
      } catch {
        skipped++;
      }
    }

    if (imported > 0) await loadAgents();
    save();
    alert(`✅ Đã import ${imported} bot MADA${skipped ? ` (bỏ qua ${skipped} bot trùng)` : ''}`);
  };

  return (
    <AdminLayout
      title="Quản lý Agents"
      subtitle="Tạo và quản lý các AI Agent. Người dùng có thể chọn Agent để trò chuyện."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-2xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-2xl"></div>
          <div className="max-w-2xl relative z-10 py-4 px-5">
            <h2 className="text-2xl font-black text-on-surface mb-2">
              Quản lý Agents
            </h2>
            <p className="text-sm font-medium text-on-surface-variant border-l-4 border-primary pl-4 py-1.5 bg-white/40 backdrop-blur-sm rounded-r-lg">
              Tạo và quản lý các AI Agent.
            </p>
          </div>
        </div>
      </section>

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
          {loading ? 'Đang tải...' : `${agents.length} Agent(s)`}
        </span>
        <div className="flex items-center gap-2">
          {/* Import 7 bot MADA mẫu */}
          <button
            onClick={importMadaBots}
            className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            title="Import 7 bot MADA: Hearing, Vision, Speech, Cognitive, Movement, Mobility, Regulatory"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Import 7 bot MADA
          </button>
          <button
            onClick={() => {
              setFormData({ name: '', description: '', avatar: '🤖', system_prompt: '', capabilities: [] });
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Thêm Agent
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-700">
          <p className="font-medium">{error}</p>
          <button onClick={loadAgents} className="mt-2 text-sm underline">Thử lại</button>
        </div>
      )}

      {/* Agent Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-2xl border-2 border-black w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-lg">{formData.avatar}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-on-surface">{editingId ? 'Sửa Agent' : 'Tạo Agent mới'}</h3>
                    <p className="text-xs text-on-surface-variant">{editingId ? 'Cập nhật thông tin' : 'Thêm Agent mới'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); }}
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
              {/* Avatar */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Icon Agent</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0px_0px_#000]">
                    {formData.avatar}
                  </div>
                  <div className="flex gap-1.5">
                    {['🤖', '👨‍🏫', '👩‍💻', '🔧', '💡', '🎯'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar: emoji }))}
                        className={clsx(
                          'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-2 border-black shadow-[2px_2px_0px_0px_#000]',
                          formData.avatar === emoji
                            ? 'bg-primary text-white translate-y-[-1px]'
                            : 'bg-white hover:bg-gray-50'
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
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

              {/* System Prompt */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">System Prompt <span className="text-red-500">*</span></label>
                <textarea
                  value={formData.system_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="VD: Bạn là trợ lý ảo của MADA..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/60 border-2 border-black text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Khả năng</label>
                <div className="flex flex-wrap gap-1.5">
                  {capabilityOptions.map(cap => (
                    <button
                      key={cap.value}
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
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.system_prompt.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Lưu' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agents Grid */}
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
            <button
              onClick={importMadaBots}
              className="px-4 py-2 rounded-full bg-secondary text-white font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            >
              <span className="material-symbols-outlined text-xs mr-1">download</span>
              Import 7 bot MADA
            </button>
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
                  <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#000]">
                    {agent.avatar}
                  </div>
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

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-black/10">
                  <button
                    onClick={() => toggleAgentActive(agent.id)}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg font-bold text-xs border border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                      (agent.is_active || agent.isActive)
                        ? 'bg-yellow-100 text-yellow-700 hover:shadow-[3px_3px_0px_0px_#000]'
                        : 'bg-green-100 text-green-700 hover:shadow-[3px_3px_0px_0px_#000]'
                    )}
                  >
                    {(agent.is_active || agent.isActive) ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white font-bold text-xs border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    Sửa
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
                    onClick={() => handleDelete(agent.id)}
                    className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⭐ Test Agent Modal */}
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

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setFormData({ name: '', description: '', avatar: '🤖', systemPrompt: '', capabilities: [] });
            setEditingId(null);
            setShowForm(true);
          }}
          className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
        >
          <span className="material-symbols-outlined text-xl font-bold">add</span>
        </button>
      </div>

      {/* Save indicator */}
      {savedAt && (
        <div className="fixed bottom-6 left-6 px-3 py-2 rounded-lg bg-primary text-white font-bold text-xs border-2 border-black shadow-[4px_4px_0px_0px_#000] animate-pulse">
          ✓ Đã lưu lúc {savedAt}
        </div>
      )}
    </AdminLayout>
  );
}
export default AdminAgents;
