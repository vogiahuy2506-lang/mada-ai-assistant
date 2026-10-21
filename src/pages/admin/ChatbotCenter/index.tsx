// ============== Chatbot Center — Main Page ==============
// Unified dashboard quản lý TẤT CẢ loại chatbot.
// Mỗi chatbot có 4 modal: Agent / Widget / Behavior / Publish.

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Bot, RefreshCw, X, Layers, Zap, Rocket } from 'lucide-react';
import { AdminShell } from '../AdminShell';
import { PageHeader, Button, SearchInput } from '../components/ui';
import { useAgentStore } from '@/stores/agentStore';
import { useChatbotCenterStore } from './store';
import { emptyLocalConfig } from './adapters';
import { AgentConfigModal } from './modals/AgentConfigModal';
import { WidgetConfigModal } from './modals/WidgetConfigModal';
import { BehaviorConfigModal } from './modals/BehaviorConfigModal';
import { PublishModal } from './modals/PublishModal';
import type { ChatbotConfig, ConfigSectionId } from './types';

const SECTION_META: Record<ConfigSectionId, { icon: React.ReactNode; label: string; desc: string }> = {
  agent: {
    icon: <Bot className="w-4 h-4" />,
    label: 'Agent',
    desc: 'Model, prompt, RAG, tools',
  },
  widget: {
    icon: <Layers className="w-4 h-4" />,
    label: 'Widget',
    desc: 'Giao diện nhúng, màu sắc',
  },
  behavior: {
    icon: <Zap className="w-4 h-4" />,
    label: 'Hành vi',
    desc: 'Guardrails, fallback, auto-suggest',
  },
  publish: {
    icon: <Rocket className="w-4 h-4" />,
    label: 'Publish',
    desc: 'Version, draft, schedule',
  },
};

// ── Card helpers ────────────────────────────────────────────────

function ChatbotCard({
  cfg,
  onOpen,
}: {
  cfg: ChatbotConfig;
  onOpen: (section: ConfigSectionId) => void;
}) {
  const isPublished = cfg.publish.status === 'published';
  const isDraft = cfg.publish.status === 'draft';
  const isArchived = cfg.publish.status === 'archived';

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        isArchived
          ? 'border-gray-100 bg-gray-50 opacity-70'
          : isPublished
          ? 'border-blue-100 bg-white shadow-sm hover:shadow-md'
          : 'border-yellow-100 bg-white shadow-sm hover:shadow-md'
      }`}
    >
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
            isPublished
              ? 'bg-blue-100'
              : isDraft
              ? 'bg-yellow-100'
              : 'bg-gray-100'
          }`}
        >
          {cfg.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{cfg.name}</h3>
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                isPublished
                  ? 'bg-green-100 text-green-700'
                  : isDraft
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isPublished ? '✓ Published' : isDraft ? '◐ Draft' : '◼ Archived'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {cfg.description || 'Không có mô tả'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-300">v{cfg.publish.version}</span>
            {cfg.agent.madaCategory && (
              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                {cfg.agent.madaCategory}
              </span>
            )}
            {cfg.agent.capabilities.length > 0 && (
              <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">
                {cfg.agent.capabilities.length} tools
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Model / category quick info */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg font-mono">
          {cfg.agent.model}
        </span>
        {cfg.widget && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
            🖼️ {cfg.widget.position}
          </span>
        )}
      </div>

      {/* Config buttons */}
      <div className="border-t border-gray-50 px-4 py-3 flex items-center gap-1.5">
        {(Object.keys(SECTION_META) as ConfigSectionId[]).map((section) => {
          const meta = SECTION_META[section];
          // Widget section chỉ có nghĩa với widget-kind (có bot_id). Behavior +
          // Publish + Agent lúc nào cũng khả dụng.
          if (section === 'widget' && cfg.kind !== 'widget') return null;
          return (
            <button
              key={section}
              onClick={() => onOpen(section)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={meta.desc}
            >
              {meta.icon}
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Create chatbot dialog ────────────────────────────────────────

function CreateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, kind: 'agent' | 'widget') => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'agent' | 'widget'>('agent');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!open) { setName(''); setKind('agent'); } }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      onCreate(name.trim(), kind);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Tạo Chatbot mới</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên chatbot</label>
            <input
              autoFocus
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: MADA Vision Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loại chatbot</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'agent', label: '🤖 Agent', desc: 'Chatbot AI độc lập' },
                { value: 'widget', label: '🖼️ Widget', desc: 'Widget nhúng vào website' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    kind === opt.value
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setKind(opt.value)}
                >
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-200">
            Huỷ
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg flex items-center gap-2"
          >
            {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
            Tạo mới
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────

export default function ChatbotCenter() {
  const agents = useAgentStore((s) => s.agents);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const saveAgent = useAgentStore((s) => s.saveAgent);

  const { configs, hydrateFromAgents, upsertLocal, remove, openSection, openConfig, closeConfig, savingIds } =
    useChatbotCenterStore();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Hydrate store khi agents backend load.
  useEffect(() => {
    if (agents.length > 0) {
      hydrateFromAgents(agents);
    }
  }, [agents, hydrateFromAgents]);

  // Load agents khi page mount
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreate = useCallback(
    (name: string, kind: 'agent' | 'widget') => {
      const id = `local_${Date.now()}`;
      const cfg = emptyLocalConfig(id, name);
      cfg.kind = kind;
if (kind === 'widget') {
          cfg.widget = {
            position: 'bottom-right',
            theme: 'mada-blue',
            borderRadius: 12,
            showBubbleAvatar: true,
            defaultLanguage: 'vi',
            enabledLanguages: ['vi', 'en'],
          };
          cfg.behavior = {
            fallbackMessage: '',
            enableGuardrails: true,
            enableAutoSuggest: true,
            rateLimitPerMinute: 0,
            adminEscalationThreshold: 0.6,
          };
        }
      upsertLocal(cfg);
    },
    [upsertLocal],
  );

  const handleSave = useCallback(
    async (cfg: ChatbotConfig) => {
      const agentId = cfg.agentId ?? cfg.id;

      // Lấy agent hiện tại để giữ các field server đã có nhưng không nằm trong ChatbotConfig
      // (avatarUrl, productUrl, sortOrder, createdBy, timestamps…).
      const prev = useAgentStore.getState().agents.find((a) => a.id === agentId);

      // Bước 3 — semantics override với NULL:
      //  • cfg.widget === undefined → ghi null (reset về global)
      //  • cfg.widget === object    → ghi object (override riêng)
      // Sau khi user đã sửa modal, ta coi như override — ghi luôn config.
      await saveAgent({
        ...(prev ?? {}),
        id: agentId,
        name: cfg.name,
        description: cfg.description,
        avatar: cfg.avatar,
        systemPrompt: cfg.agent.systemPrompt,
        capabilities: cfg.agent.capabilities,
        isActive: cfg.isActive,
        createdBy: 'admin',
        createdAt: cfg.createdAt,
        updatedAt: Date.now(),
        madaCategory: cfg.agent.madaCategory,
        promptId: cfg.agent.promptId,
        knowledgeUrl: cfg.agent.knowledgeUrl,
        botId: cfg.widget ? cfg.id : undefined,
        // ── Per-chatbot config: undefined → kế thừa global, object → override ──
        widgetConfig: cfg.widget ?? null,
        behaviorConfig: cfg.behavior ?? null,
        publishConfig: cfg.publish,
        greeting: cfg.conversation?.greeting ?? null,
        aiInstructions: cfg.conversation?.aiInstructions ?? null,
        emotionSettings: cfg.conversation?.emotionSettings ?? null,
      });

      // Cập nhật store local để UI phản ánh ngay
      upsertLocal(cfg);
    },
    [saveAgent, upsertLocal],
  );

  const currentConfig = openSection ? configs[openSection.chatbotId] : null;

  // Filter
  const filtered = Object.values(configs).filter((cfg) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cfg.name.toLowerCase().includes(q) ||
      cfg.description?.toLowerCase().includes(q) ||
      cfg.agent.model.toLowerCase().includes(q) ||
      cfg.agent.madaCategory?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminShell>
      {/* Page header */}
      <PageHeader
        title="Chatbot Center"
        subtitle="Quản lý tập trung mọi loại chatbot — agent, widget, consultation"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => loadAgents()}
            >
              Reload
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              Tạo Chatbot
            </Button>
          </>
        }
      />

      {/* Search */}
      <SearchInput
        className="mb-5 max-w-md"
        placeholder="Tìm kiếm theo tên, mô tả, model, category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Bot className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {search ? 'Không tìm thấy chatbot nào.' : 'Chưa có chatbot nào. Tạo chatbot đầu tiên!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cfg) => (
            <ChatbotCard
              key={cfg.id}
              cfg={cfg}
              onOpen={(section) => openConfig(cfg.id, section)}
            />
          ))}
        </div>
      )}

      {/* Stats bar */}
      {filtered.length > 0 && (
        <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
          <span>
            {Object.values(configs).filter((c) => c.publish.status === 'published').length} đang chạy
          </span>
          <span>·</span>
          <span>
            {Object.values(configs).filter((c) => c.publish.status === 'draft').length} draft
          </span>
          <span>·</span>
          <span>{Object.keys(configs).length} tổng chatbot</span>
        </div>
      )}

      {/* Modals */}
      {currentConfig && openSection && (
        <>
          {openSection.section === 'agent' && (
            <AgentConfigModal
              open
              onClose={closeConfig}
              config={currentConfig}
              onSave={handleSave}
            />
          )}
          {openSection.section === 'widget' && (
            <WidgetConfigModal
              open
              onClose={closeConfig}
              config={currentConfig}
              onSave={handleSave}
            />
          )}
          {openSection.section === 'behavior' && (
            <BehaviorConfigModal
              open
              onClose={closeConfig}
              config={currentConfig}
              onSave={handleSave}
            />
          )}
          {openSection.section === 'publish' && (
            <PublishModal
              open
              onClose={closeConfig}
              config={currentConfig}
              onSave={handleSave}
            />
          )}
        </>
      )}

      {/* Create dialog */}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
    </AdminShell>
  );
}
