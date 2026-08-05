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
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-on-surface-variant">
            {agents.length} Agent(s)
          </span>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', description: '', avatar: '🤖', systemPrompt: '', capabilities: [] });
            setEditingId(null);
            setShowForm(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Thêm Agent mới
        </button>
      </div>

      {/* Agent Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline-lg text-on-surface">
                {editingId ? 'Sửa Agent' : 'Tạo Agent mới'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="p-2 rounded-full hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar */}
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-2">Icon</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center text-3xl">
                    {formData.avatar}
                  </div>
                  <div className="flex gap-2">
                    {['🤖', '👨‍🏫', '👩‍💻', '🔧', '💡', '🎯'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setFormData(prev => ({ ...prev, avatar: emoji }))}
                        className={clsx(
                          'w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all',
                          formData.avatar === emoji
                            ? 'bg-primary text-white'
                            : 'bg-surface-container hover:bg-surface-container-high'
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
                <label className="block font-label-sm text-on-surface-variant mb-1.5">Tên Agent *</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: MADA Assistant"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả ngắn về Agent..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5">System Prompt *</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={e => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="VD: Bạn là trợ lý ảo của MADA, hỗ trợ người khuyết tật..."
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none font-mono"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-2">Khả năng</label>
                <div className="flex flex-wrap gap-2">
                  {capabilityOptions.map(cap => (
                    <button
                      key={cap.value}
                      onClick={() => toggleCapability(cap.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-sm font-label-md transition-all',
                        formData.capabilities.includes(cap.value)
                          ? 'bg-primary text-white'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      )}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-outline-variant/30">
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.systemPrompt.trim()}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Lưu thay đổi' : 'Tạo Agent'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-6 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high font-label-md transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={clsx(
              'p-5 rounded-2xl border-2 transition-all',
              agent.isActive
                ? 'border-primary bg-primary/5'
                : 'border-outline-variant/30 bg-surface-container-low opacity-60'
            )}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-2xl">
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-label-lg text-on-surface truncate">{agent.name}</h4>
                  {agent.isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold">
                      INACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">
                  {agent.description || 'Không có mô tả'}
                </p>
              </div>
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1 mb-4">
              {agent.capabilities.map(cap => (
                <span
                  key={cap}
                  className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] text-on-surface-variant"
                >
                  {capabilityOptions.find(c => c.value === cap)?.label || cap}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/30">
              <button
                onClick={() => toggleAgentActive(agent.id)}
                className={clsx(
                  'flex-1 py-2 rounded-xl font-label-sm transition-all',
                  agent.isActive
                    ? 'bg-surface-container hover:bg-surface-container-high'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                )}
              >
                {agent.isActive ? 'Tắt' : 'Bật'}
              </button>
              <button
                onClick={() => handleEdit(agent)}
                className="flex-1 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high font-label-sm transition-all"
              >
                Sửa
              </button>
              <button
                onClick={() => handleDelete(agent.id)}
                className="p-2 rounded-xl hover:bg-error/10 text-error transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Save indicator */}
      {savedAt && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-xl bg-primary text-white font-label-md shadow-lg animate-pulse">
          ✓ Đã lưu lúc {savedAt}
        </div>
      )}
    </AdminLayout>
  );
}
