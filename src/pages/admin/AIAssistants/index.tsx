// ===================================================================
// ============== AI ASSISTANTS STUDIO — Main page ============
// ===================================================================
// Layout 3-cột theo Google AI Studio pattern:
//   ┌─ Sidebar 240px ─┬─ Center Playground (flex) ─┬─ Inspector 320px ─┐
//   │ 7 bot cố định  │ Live multi-turn chat       │ Quick stats       │
//   │ + search       │ Model + language toggle    │ Embed code        │
//   │ + "Mở config"  │ Sources / latency          │ Config buttons    │
//   │                │                            │ (open ConfigModal)│
//   └────────────────┴────────────────────────────┴────────────────────┘
// Khi bấm "Cấu hình" ở Inspector → ConfigModal mở, bên trong có
// 6 sub-tabs: Basics / Prompt / Knowledge / Questions / Widget /
// Behavior.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Loader2, Save, Settings, FileText, Globe,
  Eye, EyeOff, Database, MessageCircleQuestion, PaintBucket,
  Cog, Wand2, Activity, Sparkles, Mic, MicOff, Power, PowerOff,
  RefreshCw, CheckCircle2, Zap,
} from 'lucide-react';
import { Button, Card } from '../components/ui';
import {
  FIXED_BOTS, BOT_BY_ID, type FixedBot,
} from './constants';
import { studioApi, rowToBot } from './api';
import type { StudioBot } from './types';
import { BotList } from './components/BotList';
import { Playground } from './components/Playground';
import { ConfigModal, type EditTab } from './ConfigModal';

// ---------- Page wrapper ----------

export default function AIAssistantsStudio() {
  const [bots, setBots] = useState<Record<string, StudioBot>>({});
  const [selectedId, setSelectedId] = useState<string>(FIXED_BOTS[0].id);
  const [draft, setDraft] = useState<StudioBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<EditTab>('basics');

  const selected: StudioBot | undefined = bots[selectedId];
  const meta: FixedBot | undefined = BOT_BY_ID[selectedId];

  // ----- Load on mount -----
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await studioApi.getAgents();
      const map: Record<string, StudioBot> = {};
      for (const b of list) map[b.id] = b;

      const missing = FIXED_BOTS.filter((b) => !map[b.id]);
      for (const m of missing) {
        const id = m.id;
        const payload = {
          id,
          name: m.name,
          description: m.domain,
          avatar: m.emoji,
          system_prompt: defaultSystemPrompt(m),
          capabilities: ['chat', 'rag', 'device_recommendation'],
          is_active: 1,
          mada_category: m.category,
          bot_id: id,
          embed_code: null,
          sort_order: FIXED_BOTS.findIndex((x) => x.id === id),
          model: 'gemini-2.0-flash',
          knowledge_url: m.madaUrl,
        };
        const res = await studioApi.createAgent(payload);
        if (res.success && res.data) {
          const created = (res.data && typeof res.data === 'object'
            ? rowToBot(res.data)
            : null) as StudioBot | null;
          if (created) map[id] = created;
        } else {
          map[id] = makeShell(id, m);
        }
      }

      setBots(map);
    } catch (err: any) {
      setError(err?.message || 'Lỗi tải trợ lý');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ----- Draft handling -----
  useEffect(() => {
    setDraft(null);
    setSavedAt(null);
  }, [selectedId]);

  const isDirty = draft !== null;
  const view: StudioBot = draft ?? selected ?? ({} as StudioBot);

  const onUpdate = useCallback((patch: Partial<StudioBot>) => {
    if (!selected) return;
    setDraft((prev) => {
      const base = prev ?? selected;
      const next: StudioBot = { ...base, ...patch };
      if (patch.widget !== undefined) next.widget = patch.widget;
      if (patch.behavior !== undefined) next.behavior = patch.behavior;
      if (patch.publish !== undefined) next.publish = patch.publish;
      if (patch.greeting !== undefined) next.greeting = patch.greeting;
      if (patch.emotion !== undefined) next.emotion = patch.emotion;
      return next;
    });
  }, [selected]);

  const onSave = useCallback(async (): Promise<void> => {
    if (!draft || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: draft.name,
        description: draft.description,
        avatar: draft.avatar,
        avatar_url: draft.avatarUrl,
        model: draft.model,
        system_prompt: draft.systemPrompt,
        capabilities: draft.capabilities,
        is_active: draft.isActive ? 1 : 0,
        mada_category: draft.madaCategory,
        prompt_id: draft.promptId,
        knowledge_url: draft.knowledgeUrl,
        product_url: draft.productUrl,
        embed_code: draft.embedCode,
        sort_order: draft.sortOrder,
        widget_config: draft.widget,
        behavior_config: draft.behavior,
        publish_config: draft.publish,
        greeting: draft.greeting,
        emotion_settings: draft.emotion,
      };

      const res = await studioApi.updateAgent(selectedId, payload);
      if (res.success) {
        const fresh = await studioApi.getAgents();
        const map: Record<string, StudioBot> = {};
        for (const b of fresh) map[b.id] = b;
        setBots(map);
        setDraft(null);
        setSavedAt(Date.now());
      } else {
        setError(res.error || 'Lưu thất bại');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi mạng');
    } finally {
      setSaving(false);
    }
  }, [draft, selected, selectedId]);

  const onReset = useCallback(() => setDraft(null), []);

  const onToggleActive = useCallback(async (id: string, next: boolean) => {
    const cur = bots[id];
    if (!cur) { setSelectedId(id); return; }
    setBots((prev) => ({ ...prev, [id]: { ...prev[id], isActive: next } }));
    const res = await studioApi.updateAgent(id, { is_active: next ? 1 : 0 });
    if (!res.success) {
      setBots((prev) => ({ ...prev, [id]: { ...prev[id], isActive: !next } }));
      setError(res.error || 'Đổi trạng thái thất bại');
    }
  }, [bots]);

  // Cmd+S để save nhanh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isDirty && !saving) {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDirty, saving, onSave]);

  // ----- Stats cho Inspector -----
  const stats = useMemo(() => {
    const list = Object.values(bots);
    return {
      total: FIXED_BOTS.length,
      active: list.filter((b) => b.isActive).length,
      totalChunks: list.reduce((s, b) => s + (b.lastCrawlCount || 0), 0),
      draftCount: Object.values(bots).filter((b) =>
        b.publish?.status === 'draft' || (!b.publish && !(b.isActive))
      ).length,
    };
  }, [bots]);

  return (
    <div
      className="h-full flex flex-col min-h-0"
      style={{ background: 'var(--lin-bg)' }}
    >
      {/* ── Page header (compact) ── */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-4 shrink-0"
        style={{
          borderBottom: '1px solid var(--lin-border)',
          background: 'var(--lin-bg-elevated)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: 'var(--lin-accent-soft)', color: 'var(--lin-accent)' }}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14.5px] font-semibold lin-t-primary tracking-[-0.01em] truncate">
              AI Assistants Studio
            </h1>
            <p className="text-[11px] lin-t-quaternary truncate">
              {FIXED_BOTS.length} trợ lý cố định · {stats.active} đang chạy · {stats.totalChunks} chunks tri thức
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {savedAt && !isDirty && (
            <span className="text-[11px] lin-t-quaternary flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--lin-success)' }} />
              Đã lưu {timeAgo(savedAt)}
            </span>
          )}
          {isDirty && (
            <>
              <span
                className="text-[11px] flex items-center gap-1"
                style={{ color: 'var(--lin-warning)' }}
              >
                <AlertTriangle className="w-3 h-3" />
                Chưa lưu thay đổi
              </span>
              <Button variant="ghost" size="md" onClick={onReset} disabled={saving}>
                Huỷ
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={onSave}
                disabled={saving}
                loading={saving}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Lưu
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-5 py-2 shrink-0">
          <div
            className="px-3 py-2 rounded-md text-[12px] flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--lin-danger) 12%, transparent)',
              color: 'var(--lin-danger)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* ── 3-column layout ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left rail: Bot list */}
        <aside
          className="shrink-0"
          style={{
            width: 240,
            borderRight: '1px solid var(--lin-border)',
          }}
        >
          <BotList
            bots={bots}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleActive={onToggleActive}
            loading={loading}
          />
        </aside>

        {/* Center: Playground (full height) */}
        <main className="flex-1 min-w-0 min-h-0">
          <Playground
            bot={selected ?? null}
            draftPrompt={draft?.systemPrompt}
            hasUnsavedPrompt={
              draft !== null && draft.systemPrompt !== (selected?.systemPrompt ?? '')
            }
            draftGreeting={draft?.greeting ?? null}
          />
        </main>

        {/* Right: Inspector */}
        <aside
          className="shrink-0"
          style={{
            width: 320,
            borderLeft: '1px solid var(--lin-border)',
          }}
        >
          <Inspector
            bot={selected ?? null}
            meta={meta}
            draft={draft}
            saving={saving}
            isDirty={isDirty}
            onOpenModal={(tab) => { setModalTab(tab); setModalOpen(true); }}
            onUpdate={onUpdate}
            onToggleActive={onToggleActive}
            onReload={load}
          />
        </aside>
      </div>

      {/* Modal */}
      <ConfigModal
        open={modalOpen}
        initialTab={modalTab}
        bot={selected ?? ({} as StudioBot)}
        draft={draft}
        isDirty={isDirty}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onUpdate={onUpdate}
        onSave={onSave}
        onReset={onReset}
      />
    </div>
  );
}

// ===================================================================
// ============== Inspector (right pane) ===============
// ===================================================================
// Tổng hợp nhanh bot đang chọn + nút mở modal config.

interface InspectorProps {
  bot: StudioBot | null;
  meta: FixedBot | undefined;
  draft: StudioBot | null;
  saving: boolean;
  isDirty: boolean;
  onOpenModal: (tab: EditTab) => void;
  onUpdate: (p: Partial<StudioBot>) => void;
  onToggleActive: (id: string, next: boolean) => void;
  onReload: () => void;
}

function Inspector({
  bot, meta, draft, saving, isDirty,
  onOpenModal, onUpdate, onToggleActive, onReload,
}: InspectorProps) {
  if (!bot || !meta) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-[12px] lin-t-quaternary text-center">Chọn trợ lý ở bên trái.</p>
      </div>
    );
  }

  const view = draft ?? bot;

  return (
    <div
      className="h-full overflow-y-auto lin-scroll flex flex-col"
      style={{ background: 'var(--lin-bg-elevated)' }}
    >
      {/* ── Identity compact ── */}
      <div
        className="px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: '1px solid var(--lin-border)' }}
      >
        <div className="flex items-start gap-3">
          <span
            className="w-12 h-12 rounded-lg flex items-center justify-center text-[24px] shrink-0"
            style={{ background: `color-mix(in srgb, ${meta.accent} 22%, transparent)` }}
          >
            {bot.avatarUrl ? (
              <img src={bot.avatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              bot.avatar || meta.emoji
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[14px] font-semibold lin-t-primary truncate">
                {bot.name || meta.name}
              </h2>
            </div>
            <p className="text-[11px] lin-t-tertiary truncate mt-0.5">
              <code className="font-mono text-[10.5px]">{bot.id}</code>
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded"
                style={{
                  background: bot.isActive
                    ? 'color-mix(in srgb, var(--lin-success) 14%, transparent)'
                    : 'var(--lin-bg-sunken)',
                  color: bot.isActive ? 'var(--lin-success)' : 'var(--lin-text-tertiary)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: bot.isActive ? 'var(--lin-success)' : 'var(--lin-text-quaternary)' }}
                />
                {bot.isActive ? 'Đang chạy' : 'Đã tắt'}
              </span>
              {bot.publish?.status === 'draft' && (
                <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-text-tertiary)' }}>
                  📝 Draft
                </span>
              )}
              {isDirty && (
                <span
                  className="text-[10.5px] px-1.5 py-0.5 rounded"
                  style={{
                    background: 'color-mix(in srgb, var(--lin-warning) 14%, transparent)',
                    color: 'var(--lin-warning)',
                  }}
                >
                  ● Draft
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 mt-3">
          <Button
            variant={bot.isActive ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => onToggleActive(bot.id, !bot.isActive)}
          >
            {bot.isActive ? (
              <>
                <PowerOff className="w-3 h-3 mr-1" />
                Tắt bot
              </>
            ) : (
              <>
                <Power className="w-3 h-3 mr-1" />
                Bật bot
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReload} title="Tải lại dữ liệu">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ── Config buttons (mở modal) ── */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lin-border)' }}>
        <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary mb-2 font-semibold">
          Cấu hình
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <ConfigButton
            icon={<Wand2 className="w-3.5 h-3.5" />}
            label="Cơ bản"
            hint="Avatar · tên · model"
            onClick={() => onOpenModal('basics')}
          />
          <ConfigButton
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Prompt"
            hint="System prompt & lời chào"
            onClick={() => onOpenModal('prompt')}
          />
          <ConfigButton
            icon={<Database className="w-3.5 h-3.5" />}
            label="Tri thức"
            hint="KB · sản phẩm"
            onClick={() => onOpenModal('knowledge')}
          />
          <ConfigButton
            icon={<MessageCircleQuestion className="w-3.5 h-3.5" />}
            label="Câu hỏi"
            hint="Gợi ý riêng"
            onClick={() => onOpenModal('questions')}
          />
          <ConfigButton
            icon={<PaintBucket className="w-3.5 h-3.5" />}
            label="Widget"
            hint="Giao diện widget"
            onClick={() => onOpenModal('appearance')}
          />
          <ConfigButton
            icon={<Cog className="w-3.5 h-3.5" />}
            label="Hành vi"
            hint="Guardrails · emotion"
            onClick={() => onOpenModal('behavior')}
          />
        </div>
      </div>

      {/* ── Inline quick fields ── */}
      <div className="px-4 py-3 flex-1 min-h-0 space-y-3">
        {/* Model */}
        <div>
          <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary mb-1.5 font-semibold">
            Model
          </p>
          <select
            className="lin-select lin-focus-visible w-full"
            style={{ height: 30, fontSize: 12 }}
            value={view.model || 'gemini-2.0-flash'}
            onChange={(e) => onUpdate({ model: e.target.value })}
          >
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
          </select>
        </div>

        {/* System prompt chip */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary font-semibold">
              System Prompt
            </p>
            <span className="text-[10.5px] lin-t-quaternary">
              {view.systemPrompt.length} ký tự
            </span>
          </div>
          <div
            className="px-2.5 py-2 rounded-md text-[11.5px] leading-relaxed font-mono overflow-hidden"
            style={{
              background: 'var(--lin-bg-sunken)',
              color: 'var(--lin-text-secondary)',
              maxHeight: 110,
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              fontFamily: 'var(--lin-font-mono)',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
            }}
          >
            {view.systemPrompt || 'Chưa có — bấm "Prompt" để viết.'}
          </div>
          {isDirty && draft?.systemPrompt !== bot.systemPrompt && (
            <p
              className="text-[10.5px] mt-1 flex items-center gap-1"
              style={{ color: 'var(--lin-warning)' }}
            >
              <Zap className="w-3 h-3" />
              Đang test prompt <strong>chưa lưu</strong> trong playground
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div>
          <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary mb-1.5 font-semibold">
            Thống kê nhanh
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <StatBox label="Chunks KB" value={bot.lastCrawlCount || 0} />
            <StatBox
              label="Last crawl"
              value={bot.lastCrawlAt ? new Date(bot.lastCrawlAt).toLocaleDateString('vi-VN') : '—'}
            />
            <StatBox label="Linked PKB" value={(bot as any).linkedProductCount ?? '—'} />
            <StatBox label="Questions" value={(bot as any).questionCount ?? '—'} />
          </div>
        </div>

        {/* Embed snippet */}
        <div>
          <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary mb-1.5 font-semibold">
            Embed Widget
          </p>
          <div
            className="px-2.5 py-2 rounded-md font-mono overflow-x-auto lin-scroll"
            style={{
              background: 'var(--lin-bg-sunken)',
              color: 'var(--lin-text-secondary)',
              fontSize: 10.5,
              fontFamily: 'var(--lin-font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            {bot.embedCode || `<div id="mada-widget" data-bot-id="${bot.id}" data-lang="vi"></div>`}
          </div>
        </div>

        {/* Categories chip */}
        <div>
          <p className="text-[10.5px] uppercase tracking-wider lin-t-quaternary mb-1.5 font-semibold">
            Domain
          </p>
          <div
            className="px-2.5 py-2 rounded-md text-[11.5px] leading-relaxed"
            style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-text-secondary)' }}
          >
            {meta.domain}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function ConfigButton({
  icon, label, hint, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 px-2.5 py-2 rounded-md text-left transition-colors lin-focus-visible"
      style={{
        background: 'var(--lin-bg-elevated)',
        border: '1px solid var(--lin-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--lin-bg-hover)';
        e.currentTarget.style.borderColor = 'var(--lin-accent-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--lin-bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--lin-border)';
      }}
      title={hint}
    >
      <span
        className="w-6 h-6 rounded flex items-center justify-center"
        style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-accent)' }}
      >
        {icon}
      </span>
      <span className="text-[12px] font-medium lin-t-primary leading-none">{label}</span>
      <span className="text-[10.5px] lin-t-quaternary leading-tight">{hint}</span>
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="px-2.5 py-2 rounded-md"
      style={{ background: 'var(--lin-bg-sunken)' }}
    >
      <p className="text-[10px] lin-t-quaternary uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-[14px] font-semibold lin-t-primary mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ---------- Helpers ----------

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
  return new Date(ts).toLocaleTimeString('vi-VN');
}

function defaultSystemPrompt(m: FixedBot): string {
  return [
    `# Vai trò`,
    `Bạn là **${m.name}** — trợ lý AI chuyên về ${m.domain.toLowerCase()}.`,
    ``,
    `# Nguyên tắc ứng xử`,
    `- Trả lời ngắn gọn, rõ ràng, dễ đọc.`,
    `- Luôn ưu tiên nguồn tri thức nội bộ (RAG) — nếu không có, hãy thành thật.`,
    `- Thừa nhận khi không chắc chắn; không bịa đặt sản phẩm/tiêu chuẩn không có thật.`,
    `- Trả lời đúng ngôn ngữ của người dùng.`,
    ``,
    `# Định dạng`,
    `- Dùng gạch đầu dòng cho bước hướng dẫn.`,
    `- Bảng cho so sánh sản phẩm/tiêu chuẩn.`,
    `- Link gốc khi dẫn nguồn.`,
  ].join('\n');
}

function makeShell(id: string, m: FixedBot): StudioBot {
  return {
    id, name: m.name, description: m.domain,
    avatar: m.emoji, avatarUrl: null, model: 'gemini-2.0-flash',
    madaCategory: m.category, botId: id, promptId: null,
    sortOrder: 0, isActive: true,
    capabilities: ['chat', 'rag'],
    systemPrompt: defaultSystemPrompt(m),
    knowledgeUrl: m.madaUrl, productUrl: null,
    embedCode: null,
    lastCrawlAt: null, lastCrawlStatus: null, lastCrawlCount: 0,
    widget: null, behavior: null, publish: null,
    greeting: null, emotion: null,
    createdAt: Date.now(), updatedAt: Date.now(),
  } as StudioBot;
}