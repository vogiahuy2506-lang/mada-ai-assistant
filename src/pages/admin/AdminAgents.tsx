import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAgentStore, type Agent } from '@/stores';
import clsx from 'clsx';

export function AdminAgents() {
  const { agents, addAgent, updateAgent, deleteAgent, toggleAgentActive } = useAgentStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    systemPrompt: '',
    capabilities: [] as string[],
  });

  const save = () => {
    setSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setTimeout(() => setSavedAt(null), 3000);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) return;

    if (editingId) {
      updateAgent(editingId, {
        ...formData,
        createdBy: 'admin',
      });
      setEditingId(null);
    } else {
      addAgent({
        ...formData,
        isActive: true,
        createdBy: 'admin',
      });
    }

    setFormData({ name: '', description: '', avatar: '🤖', systemPrompt: '', capabilities: [] });
    setShowForm(false);
    save();
  };

  const handleEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
      capabilities: agent.capabilities,
    });
    setEditingId(agent.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa Agent này?')) {
      deleteAgent(id);
      save();
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
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-on-surface-variant font-medium">
          {agents.length} Agent(s)
        </span>
        <button
          onClick={() => {
            setFormData({ name: '', description: '', avatar: '🤖', systemPrompt: '', capabilities: [] });
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Thêm Agent
        </button>
      </div>

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

            {/* Modal Content */}
            <div className="p-4 space-y-4">
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
                  value={formData.systemPrompt}
                  onChange={e => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
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
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-white/80 backdrop-blur-xl flex items-center gap-2">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-black font-bold text-xs hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.systemPrompt.trim()}
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
        
        {agents.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 text-gray-400 shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </div>
            <h4 className="text-lg font-black text-on-surface mb-1">Chưa có Agent nào</h4>
            <p className="text-sm text-on-surface-variant text-center mb-4">
              Tạo Agent đầu tiên để bắt đầu.
            </p>
            <button
              onClick={() => {
                setFormData({ name: '', description: '', avatar: '🤖', systemPrompt: '', capabilities: [] });
                setEditingId(null);
                setShowForm(true);
              }}
              className="px-4 py-2 rounded-full bg-primary text-white font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            >
              <span className="material-symbols-outlined text-xs mr-1">add</span>
              Tạo Agent
            </button>
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={clsx(
                  'p-4 rounded-xl border-2 border-black transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]',
                  agent.isActive
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
                        agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {agent.isActive ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">
                      {agent.description || 'Không có mô tả'}
                    </p>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {agent.capabilities.slice(0, 3).map(cap => (
                    <span
                      key={cap}
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
                      agent.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:shadow-[3px_3px_0px_0px_#000]'
                        : 'bg-green-100 text-green-700 hover:shadow-[3px_3px_0px_0px_#000]'
                    )}
                  >
                    {agent.isActive ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white font-bold text-xs border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
                  >
                    Sửa
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
