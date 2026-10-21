// ===================================================================
// ============== AI ASSISTANTS — Basics tab ============
// ===================================================================
// Cấu hình nền của bot: avatar, tên, mô tả, model, trạng thái publish.

import React, { useState } from 'react';
import {
  Pencil, Upload, X, Sparkles, Globe, Save, RotateCcw, Trash2, Plus,
} from 'lucide-react';
import { studioApi } from '../api';
import {
  AVATAR_EMOJI, MODELS, DEFAULT_MODEL, LANGUAGES,
  type LanguageCode,
} from '../constants';
import { GLOBAL_PUBLISH_DEFAULTS, type PublishConfig, type StudioBot } from '../types';
import { Alert, Field, Section, ToggleRow, ChipToggle } from './primitives';

interface Props {
  bot: StudioBot;
  draft: StudioBot | null;
  saving: boolean;
  onUpdate: (patch: Partial<StudioBot>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isDirty: boolean;
}

export function BasicsTab({ bot, draft, saving, onUpdate, onSave, onReset, isDirty }: Props) {
  const view = draft ?? bot;
  const isOverridingPublish = bot.publish !== null && bot.publish !== undefined &&
    JSON.stringify(bot.publish) !== JSON.stringify(GLOBAL_PUBLISH_DEFAULTS);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const updatePublish = (patch: Partial<PublishConfig>) => {
    onUpdate({ publish: { ...GLOBAL_PUBLISH_DEFAULTS, ...(view.publish ?? {}), ...patch } });
  };

  return (
    <div className="max-w-3xl">
      {/* ── Identity ── */}
      <Section title="Nhận diện" description="Cách trợ lý hiển thị trong cuộc trò chuyện.">
        <div className="flex items-start gap-4">
          {/* Avatar editor */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center text-[36px]"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              {view.avatarUrl ? (
                <img
                  src={view.avatarUrl}
                  alt="avatar"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                view.avatar || '🤖'
              )}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <label
                className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible cursor-pointer"
                title="Tải ảnh avatar"
              >
                {uploadBusy ? (
                  <Sparkles className="w-3 h-3 animate-pulse" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span className="text-[11px]">Tải ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadBusy(true);
                    try {
                      const url = await studioApi.uploadAvatar(file);
                      onUpdate({ avatarUrl: url, avatar: '🖼️' });
                    } catch (err: any) {
                      alert('Upload thất bại: ' + (err?.message || err));
                    } finally {
                      setUploadBusy(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              {view.avatarUrl && (
                <button
                  type="button"
                  onClick={() => onUpdate({ avatarUrl: null })}
                  className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
                  title="Gỡ ảnh, quay lại dùng emoji"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 grid grid-cols-1 gap-3">
            <Field label="Tên hiển thị" required>
              <input
                className="lin-input lin-focus-visible"
                value={view.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Trợ lý Thính giác"
              />
            </Field>

            <Field label="Emoji" hint="Dùng khi chưa có ảnh avatar.">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen((o) => !o)}
                  className="lin-input lin-focus-visible w-16 text-center text-[18px]"
                  style={{ height: 36 }}
                >
                  {view.avatar || '🤖'}
                </button>
                {emojiPickerOpen && (
                  <div
                    className="absolute z-10 mt-1 p-2 rounded-lg grid grid-cols-8 gap-1.5"
                    style={{
                      background: 'var(--lin-bg-elevated)',
                      border: '1px solid var(--lin-border)',
                      boxShadow: 'var(--lin-shadow-md)',
                      width: 360,
                    }}
                  >
                    {AVATAR_EMOJI.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          onUpdate({ avatar: e });
                          setEmojiPickerOpen(false);
                        }}
                        className="w-9 h-9 rounded-md text-[18px] hover:bg-[var(--lin-bg-hover)] transition-colors lin-focus-visible"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field label="Mô tả ngắn" hint="Hiển thị dưới tên trợ lý trong chat.">
              <textarea
                className="lin-input lin-focus-visible"
                rows={2}
                value={view.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Trợ lý chuyên về máy trợ thính, thiết bị cảnh báo âm thanh…"
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Model ── */}
      <Section title="Model AI" description="Model dùng để sinh câu trả lời cho bot này.">
        <select
          className="lin-select lin-focus-visible"
          style={{ maxWidth: 320 }}
          value={view.model || DEFAULT_MODEL}
          onChange={(e) => onUpdate({ model: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Alert tone="info" >
          Mặc định <code>gemini-2.0-flash</code> cho mọi bot. Đổi sang <code>gpt-4o-mini</code>{' '}
          hoặc model khác nếu cần, nhưng sẽ tốn chi phí API tương ứng.
        </Alert>
      </Section>

      {/* ── Languages ── */}
      <Section
        title="Ngôn ngữ được hỗ trợ"
        description="Trợ lý sẽ trả lời được các ngôn ngữ được bật bên dưới."
      >
        <Field label="Ngôn ngữ mặc định" hint="Dùng khi widget mở lần đầu.">
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => (
              <ChipToggle
                key={l.value}
                label={`${l.flag} ${l.label}`}
                active={view.greeting !== null && view.greeting !== undefined}
                onClick={() => {
                  // toggle default language through prompt later (mặc định = vi)
                  const cur = draft?.name ? draft : null;
                  if (cur) onUpdate({}); // no-op
                }}
              />
            ))}
          </div>
        </Field>

        <div className="text-[11px] lin-t-quaternary mt-2">
          Cấu hình ngôn ngữ cho prompt chi tiết ở tab <strong>Prompt</strong>.
        </div>
      </Section>

      {/* ── Status & Publish ── */}
      <Section
        title="Trạng thái & Xuất bản"
        description="Bật/tắt trợ lý, đánh dấu nháp/đã publish, lên lịch release."
        action={
          isOverridingPublish ? (
            <button
              type="button"
              onClick={() => onUpdate({ publish: null })}
              className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
              title="Xoá override — bot sẽ dùng cấu hình publish mặc định"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-[11px]">Về global</span>
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <ToggleRow
            checked={view.isActive}
            onChange={(v) => onUpdate({ isActive: v })}
            label="Đang hoạt động trong widget"
            hint="Tắt để ẩn bot khỏi danh sách widget nhúng."
          />

          <div>
            <Field label="Trạng thái">
              <div className="flex gap-2">
                {[
                  { v: 'draft', l: '📝 Nháp' },
                  { v: 'published', l: '🚀 Đã publish' },
                  { v: 'archived', l: '🗄️ Lưu trữ' },
                ].map((opt) => {
                  const active = (view.publish?.status ?? 'draft') === opt.v;
                  return (
                    <ChipToggle
                      key={opt.v}
                      label={opt.l}
                      active={active}
                      onClick={() => updatePublish({ status: opt.v as PublishConfig['status'] })}
                    />
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phiên bản" hint="Tăng mỗi lần publish chính thức.">
              <input
                type="number"
                min={1}
                className="lin-input lin-focus-visible"
                value={view.publish?.version ?? 1}
                onChange={(e) =>
                  updatePublish({ version: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </Field>

            <Field label="Ngày release (tùy chọn)">
              <input
                type="datetime-local"
                className="lin-input lin-focus-visible"
                value={
                  view.publish?.scheduledAt
                    ? view.publish.scheduledAt.slice(0, 16)
                    : ''
                }
                onChange={(e) =>
                  updatePublish({
                    scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </Field>
          </div>

          <Field label="Release notes" hint="Lưu lại thay đổi quan trọng giữa các phiên bản.">
            <textarea
              rows={3}
              className="lin-input lin-focus-visible"
              value={view.publish?.releaseNotes ?? ''}
              onChange={(e) => updatePublish({ releaseNotes: e.target.value })}
              placeholder="- Mở rộng từ điển tiếng Anh\n- Bổ sung 12 sản phẩm mới theo ISO 9999:2022"
            />
          </Field>
        </div>
      </Section>

      {/* ── Embed code (cho widget) ── */}
      <Section
        title="Mã nhúng widget"
        description="Snippet dán vào website để kích hoạt widget với trợ lý này (nếu có)."
      >
        <Field
          label="Embed HTML"
          hint="Để trống = dùng widget toàn cục. Điền tùy biến sẽ ghi đè."
        >
          <textarea
            rows={3}
            className="lin-input lin-focus-visible font-mono text-[11px]"
            style={{ fontFamily: 'var(--lin-font-mono)' }}
            value={view.embedCode ?? ''}
            onChange={(e) => onUpdate({ embedCode: e.target.value })}
            placeholder='<div id="mada-widget" data-bot-id="bot-hearing" data-lang="vi"></div>'
          />
        </Field>
      </Section>
    </div>
  );
}