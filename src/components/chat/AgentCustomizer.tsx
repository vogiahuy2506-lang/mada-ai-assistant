import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Smile } from 'lucide-react';
import { useAgentStore, Agent } from '@/stores/agentStore';

interface AgentCustomizerProps {
  onClose: () => void;
}

const AVATAR_OPTIONS = [
  '🤖', '👨‍🏫', '👩‍🏫', '🧠', '💡', '🔬', '📚', '🎯', '⚡', '🎨',
  '🏥', '⚖️', '💰', '🔧', '🌐', '🎓', '💻', '📱', '🖥️', '⌨️',
  '🩺', '💊', '🦿', '🦾', '👁️', '👂', '🗣️', '♿', '🌈', '⭐',
  '🎉', '🚀', '💫', '🔮', '🎭', '🤝', '🛠️', '📖', '🌟', '✨'
];

const AGENT_TEMPLATES = [
  { id: 'general', name: 'General Assistant', avatar: '🤖', prompt: 'You are a helpful assistant.' },
  { id: 'medical', name: 'Medical Advisor', avatar: '🏥', prompt: 'You are a medical information advisor.' },
  { id: 'legal', name: 'Legal Advisor', avatar: '⚖️', prompt: 'You are a legal information advisor.' },
  { id: 'finance', name: 'Finance Advisor', avatar: '💰', prompt: 'You are a finance advisor.' },
];

export function AgentCustomizer({ onClose }: AgentCustomizerProps) {
  const { agents, addAgent, updateAgent, deleteAgent } = useAgentStore();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    systemPrompt: '',
  });

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditForm({
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
    });
    setIsEditing(true);
    setShowCreate(false);
  };

  const handleSave = () => {
    if (!selectedAgent) return;
    updateAgent(selectedAgent.id, {
      name: editForm.name,
      description: editForm.description,
      avatar: editForm.avatar,
      systemPrompt: editForm.systemPrompt,
    });
    setIsEditing(false);
    setSelectedAgent(null);
  };

  const handleCreate = () => {
    if (!editForm.name) return;
    addAgent({
      name: editForm.name,
      description: editForm.description || 'Custom agent',
      avatar: editForm.avatar,
      systemPrompt: editForm.systemPrompt || 'You are a helpful assistant.',
      capabilities: ['chat'],
      isActive: true,
      createdBy: 'user',
    });
    setShowCreate(false);
    setEditForm({ name: '', description: '', avatar: '🤖', systemPrompt: '' });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa agent này?')) return;
    deleteAgent(id);
    if (selectedAgent?.id === id) {
      setSelectedAgent(null);
      setIsEditing(false);
    }
  };

  const handleUseTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
    setEditForm({
      name: template.name,
      description: '',
      avatar: template.avatar,
      systemPrompt: template.prompt,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Chỉnh sửa Agent' : showCreate ? 'Tạo Agent mới' : 'Quản lý Agents'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              {/* Avatar Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
                    {editForm.avatar}
                  </div>
                  <button
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
                  >
                    <Smile className="w-4 h-4" />
                    Chọn emoji
                  </button>
                </div>
                {showAvatarPicker && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-8 gap-2">
                      {AVATAR_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setEditForm({ ...editForm, avatar: emoji });
                            setShowAvatarPicker(false);
                          }}
                          className={`w-10 h-10 rounded-lg text-xl hover:bg-slate-200 transition-colors ${
                            editForm.avatar === emoji ? 'bg-primary/20 ring-2 ring-primary' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên Agent</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="VD: Medical Assistant"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Mô tả ngắn về agent"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                <textarea
                  value={editForm.systemPrompt}
                  onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono text-sm"
                  placeholder="Nhập system prompt..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => handleDelete(selectedAgent!.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedAgent(null);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editForm.name}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          ) : showCreate ? (
            /* Create Form */
            <div className="space-y-4">
              {/* Templates */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn mẫu có sẵn</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {AGENT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleUseTemplate(t)}
                      className="shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <span>{t.avatar}</span>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
                    {editForm.avatar}
                  </div>
                  <button
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
                  >
                    <Smile className="w-4 h-4" />
                    Chọn emoji
                  </button>
                </div>
                {showAvatarPicker && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-8 gap-2">
                      {AVATAR_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setEditForm({ ...editForm, avatar: emoji });
                            setShowAvatarPicker(false);
                          }}
                          className={`w-10 h-10 rounded-lg text-xl hover:bg-slate-200 transition-colors ${
                            editForm.avatar === emoji ? 'bg-primary/20 ring-2 ring-primary' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên Agent</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="VD: My Assistant"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Mô tả ngắn về agent"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                <textarea
                  value={editForm.systemPrompt}
                  onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono text-sm"
                  placeholder="Nhập system prompt..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setEditForm({ name: '', description: '', avatar: '🤖', systemPrompt: '' });
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!editForm.name}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Tạo mới
                </button>
              </div>
            </div>
          ) : (
            /* Agent List */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{agents.length} agents</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tạo mới
                </button>
              </div>

              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <span className="text-3xl">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800">{agent.name}</h3>
                      {agent.createdBy === 'user' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                          Tùy chỉnh
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{agent.description}</p>
                  </div>
                  <button
                    onClick={() => handleEdit(agent)}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentCustomizer;
