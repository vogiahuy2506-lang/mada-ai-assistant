// ===================================================================
// ============== AI ASSISTANTS — Config Modal =================
// ===================================================================
// Modal edit tất cả cấu hình chi tiết của 1 bot. Bên trong modal có
// sub-tabs (Basics / Prompt / Knowledge / Questions / Widget /
// Behavior) — mỗi tab đại diện 1 nhóm cấu hình. State draft và save
// quản lý ở parent (StudioShell); modal chỉ hiển thị + onUpdate.

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Tabs } from '../components/ui';
import type { StudioBot, StudioTab } from './types';
import { BasicsTab } from './components/BasicsTab';
import { PromptTab } from './components/PromptTab';
import { KnowledgeTab } from './components/KnowledgeTab';
import { QuestionsTab } from './components/QuestionsTab';
import { AppearanceTab } from './components/AppearanceTab';
import { BehaviorTab } from './components/BehaviorTab';

export type EditTab = StudioTab;

interface Props {
  open: boolean;
  initialTab: EditTab;
  bot: StudioBot;
  draft: StudioBot | null;
  isDirty: boolean;
  saving: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<StudioBot>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
}

const TABS: Array<{
  id: EditTab;
  label: string;
  icon: string;
  hint: string;
}> = [
  { id: 'basics',     label: 'Cơ bản',       icon: '🎨', hint: 'Tên, avatar, model, publish' },
  { id: 'prompt',     label: 'Prompt',       icon: '📝', hint: 'System prompt + greetings' },
  { id: 'knowledge',  label: 'Tri thức',     icon: '📚', hint: 'KB, sản phẩm, capability' },
  { id: 'questions',  label: 'Câu hỏi',      icon: '❓', hint: 'Câu hỏi gợi ý riêng bot' },
  { id: 'appearance', label: 'Widget',       icon: '🪟', hint: 'Giao diện widget riêng' },
  { id: 'behavior',   label: 'Hành vi',      icon: '⚙️', hint: 'Guardrails, emotion' },
];

export function ConfigModal({
  open, initialTab, bot, draft, isDirty, saving,
  onClose, onUpdate, onSave, onReset,
}: Props) {
  const [activeTab, setActiveTab] = useState<EditTab>(initialTab);

  // Sync tab mỗi khi parent đổi ý định (cả khi modal vẫn đang mở).
  // Nếu user chọn bot khác rồi mở lại modal ở tab khác, tab phải update.
  React.useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  // Esc đóng modal
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center"
      style={{ background: 'rgba(15,16,19,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col my-3 rounded-xl overflow-hidden max-h-[calc(100vh-24px)] w-full"
        style={{
          maxWidth: 920,
          background: 'var(--lin-bg-elevated)',
          border: '1px solid var(--lin-border)',
          boxShadow: 'var(--lin-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--lin-border)' }}
        >
          <div className="min-w-0 flex items-center gap-2.5">
            <span
              className="w-9 h-9 rounded-md flex items-center justify-center text-[18px] shrink-0"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              {(draft ?? bot).avatar || '🤖'}
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold lin-t-primary truncate">
                Cấu hình: {draft?.name ?? bot.name}
              </h2>
              <p className="text-[11.5px] lin-t-tertiary truncate">
                <code className="font-mono">{bot.id}</code>
                {' · '}
                {TABS.find((t) => t.id === activeTab)?.hint}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isDirty && (
              <span
                className="text-[10.5px] px-2 py-1 rounded"
                style={{
                  background: 'color-mix(in srgb, var(--lin-warning) 14%, transparent)',
                  color: 'var(--lin-text-secondary)',
                }}
              >
                ● Chưa lưu
              </span>
            )}
            <Button
              aria-label="Đóng"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="px-3 shrink-0"
          style={{ borderBottom: '1px solid var(--lin-border)', background: 'var(--lin-bg)' }}
        >
          <Tabs
            tabs={TABS.map((t) => ({ id: t.id, label: `${t.icon} ${t.label}` }))}
            active={activeTab}
            onChange={(id) => setActiveTab(id as EditTab)}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto lin-scroll px-6 py-5">
          {activeTab === 'basics' && (
            <BasicsTab
              bot={bot}
              draft={draft}
              saving={saving}
              onUpdate={onUpdate}
              onSave={onSave}
              onReset={onReset}
              isDirty={isDirty}
            />
          )}
          {activeTab === 'prompt' && (
            <PromptTab
              bot={bot}
              draft={draft}
              saving={saving}
              isDirty={isDirty}
              onUpdate={onUpdate}
              onSave={onSave}
              onReset={onReset}
            />
          )}
          {activeTab === 'knowledge' && (
            <KnowledgeTab
              bot={bot}
              fixedBot={{
                id: bot.id,
                name: bot.name,
                shortName: bot.name,
                emoji: bot.avatar,
                accent: '#5e6ad2',
                category: bot.madaCategory ?? 'general',
                domain: bot.description,
                madaUrl: bot.knowledgeUrl ?? '',
              }}
              draft={draft}
              isDirty={isDirty}
              onUpdate={onUpdate}
              onSave={onSave}
            />
          )}
          {activeTab === 'questions' && <QuestionsTab bot={bot} />}
          {activeTab === 'appearance' && (
            <AppearanceTab bot={bot} draft={draft} onUpdate={onUpdate} />
          )}
          {activeTab === 'behavior' && (
            <BehaviorTab bot={bot} draft={draft} onUpdate={onUpdate} />
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-2 shrink-0"
          style={{
            borderTop: '1px solid var(--lin-border)',
            background: 'var(--lin-bg)',
          }}
        >
          <div className="text-[11px] lin-t-quaternary">
            ⌘+S để lưu · Esc đóng modal · Test ngay trong playground ngay cả khi chưa Save
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <Button variant="ghost" size="md" onClick={onReset} disabled={saving}>
                Huỷ thay đổi
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={onSave}
              disabled={saving || !isDirty}
              loading={saving}
            >
              Lưu cấu hình
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}