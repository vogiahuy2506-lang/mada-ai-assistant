// ===================================================================
// ============== AI ASSISTANTS — Questions tab ==============
// ===================================================================
// Quản lý câu hỏi gợi ý gán riêng cho bot: thêm 1, auto-dịch 4 ngôn
// ngữ, sửa, xoá, bật/tắt.

import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Wand2, Loader2, Eye, EyeOff, ChevronUp, ChevronDown,
} from 'lucide-react';
import { studioApi } from '../api';
import { LANGUAGES, SQ_CATEGORIES, VIEW_MODES, type LanguageCode } from '../constants';
import type { StudioBot, SuggestedQuestion } from '../types';
import { Alert, ChipToggle, EmptyRow, Field, Section } from './primitives';

interface Props {
  bot: StudioBot;
}

export function QuestionsTab({ bot }: Props) {
  const [items, setItems] = useState<SuggestedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<'end_user' | 'at_specialist'>('end_user');
  const [language, setLanguage] = useState<LanguageCode>('vi');
  const [category, setCategory] = useState<string>(bot.madaCategory ?? 'general');
  const [draft, setDraft] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const data = await studioApi.getQuestions(bot.id);
      setItems(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [bot.id]);

  // Mặc định category theo bot
  useEffect(() => {
    if (bot.madaCategory) setCategory(bot.madaCategory);
  }, [bot.id]);

  const submit = async (auto: boolean) => {
    const q = draft.trim();
    if (!q) return;
    setBusy(true);
    try {
      if (auto) {
        const res = await studioApi.autoTranslateQuestion({
          question_vi: q,
          category,
          view_mode: viewMode,
          agent_id: bot.id,
        });
        if (!res.success) alert(res.error || 'Tạo thất bại');
      } else {
        const res = await studioApi.createQuestion({
          agent_id: bot.id,
          category,
          view_mode: viewMode,
          language,
          question: q,
          sort_order: items.length + 1,
          is_active: true,
        });
        if (!res.success) alert(res.error || 'Tạo thất bại');
      }
      setDraft('');
      await reload();
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, patch: Partial<SuggestedQuestion>) => {
    const res = await studioApi.updateQuestion(id, patch);
    if (!res.success) alert(res.error || 'Cập nhật thất bại');
    await reload();
  };

  const remove = async (id: string) => {
    if (!confirm('Xoá câu hỏi này?')) return;
    const res = await studioApi.deleteQuestion(id);
    if (!res.success) alert(res.error || 'Xoá thất bại');
    await reload();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // assign sort_order incrementally
    const minId = next[idx].id;
    const targetId = next[target].id;
    const maxSort = Math.max(...next.map((q) => q.sort_order || 0));
    await studioApi.updateQuestion(minId, { sort_order: maxSort + 1 });
    await studioApi.updateQuestion(targetId, { sort_order: maxSort + 2 });
    await reload();
  };

  return (
    <div className="max-w-4xl">
      {/* ── Form thêm ── */}
      <Section
        title="Thêm câu hỏi"
        description="Gán câu hỏi gợi ý cho bot này. Hệ thống hỗ trợ auto-dịch sang 4 ngôn ngữ."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loại người dùng">
            <div className="flex gap-1.5">
              {VIEW_MODES.map((m) => (
                <ChipToggle
                  key={m.value}
                  label={m.label}
                  active={viewMode === m.value}
                  onClick={() => setViewMode(m.value)}
                />
              ))}
            </div>
          </Field>
          <Field label="Category">
            <select
              className="lin-select lin-focus-visible"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {SQ_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {bot.madaCategory && category !== bot.madaCategory && (
          <Alert tone="info">
            Gợi ý: chọn <code>{bot.madaCategory}</code> để hiển thị chung với bot.
          </Alert>
        )}

        <Field label="Câu hỏi" hint="Tối đa 150 ký tự. Nên bắt đầu bằng đại từ/noun, không quá dài.">
          <input
            className="lin-input lin-focus-visible"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="VD: Máy trợ thính BTE khác ITE thế nào?"
            maxLength={150}
          />
        </Field>

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy || !draft.trim()}
            className="lin-btn lin-btn-primary lin-focus-visible"
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            <span className="text-[12px]">Auto-dịch 4 ngôn ngữ</span>
          </button>
          <div
            className="flex items-center rounded-md p-0.5"
            style={{ background: 'var(--lin-bg-sunken)' }}
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value as LanguageCode)}
                className="px-1.5 py-1 rounded text-[10.5px] font-medium transition-colors lin-focus-visible"
                style={{
                  background: language === l.value ? 'var(--lin-bg-elevated)' : 'transparent',
                  color: language === l.value ? 'var(--lin-text-primary)' : 'var(--lin-text-tertiary)',
                  boxShadow: language === l.value ? 'var(--lin-shadow-xs)' : 'none',
                }}
                title={`Chỉ thêm bằng ${l.label}`}
              >
                {l.flag}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={busy || !draft.trim()}
            className="lin-btn lin-btn-secondary lin-focus-visible"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[12px]">
              Thêm ({LANGUAGES.find((l) => l.value === language)?.flag})
            </span>
          </button>
        </div>
      </Section>

      {/* ── List ── */}
      <Section
        title={`Đã gán cho bot (${items.length})`}
        description="Câu hỏi có gán riêng ở đây luôn xuất hiện trong widget của bot, kể cả khi category trùng với bot khác."
        action={
          <button
            type="button"
            onClick={reload}
            className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
            title="Tải lại"
          >
            <Loader2 className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        {loading && items.length === 0 ? (
          <EmptyRow>Đang tải…</EmptyRow>
        ) : items.length === 0 ? (
          <EmptyRow>Chưa có câu hỏi riêng — bot sẽ chỉ dùng câu hỏi global theo category.</EmptyRow>
        ) : (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--lin-border)' }}
          >
            <div
              className="grid grid-cols-12 text-[10.5px] uppercase tracking-wider lin-t-quaternary px-3 py-2 font-semibold"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              <div className="col-span-2">Ngôn ngữ</div>
              <div className="col-span-5">Câu hỏi</div>
              <div className="col-span-2">Loại</div>
              <div className="col-span-1 text-center">Ẩn</div>
              <div className="col-span-2 text-right">Sắp xếp</div>
            </div>
            {items.map((q, idx) => (
              <div
                key={q.id}
                className="grid grid-cols-12 items-center px-3 py-2 text-[12px]"
                style={{ borderTop: '1px solid var(--lin-border-subtle)' }}
              >
                <div className="col-span-2">
                  <select
                    className="lin-select lin-focus-visible"
                    style={{ height: 26, fontSize: 11 }}
                    value={q.language}
                    onChange={(e) => update(q.id, { language: e.target.value })}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.flag} {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5">
                  <input
                    className="lin-input lin-focus-visible"
                    style={{ height: 26, fontSize: 12 }}
                    value={q.question}
                    onChange={(e) => update(q.id, { question: e.target.value })}
                  />
                </div>
                <div className="col-span-2 lin-t-tertiary">
                  {q.view_mode === 'end_user' ? '👤 User' : '🧑‍⚕️ Specialist'}
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => update(q.id, { is_active: (q.is_active ? 0 : 1) as 0 | 1 })}
                    title={q.is_active ? 'Đang hiển thị' : 'Đang ẩn'}
                    className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
                  >
                    {q.is_active ? (
                      <Eye
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--lin-accent)' }}
                      />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 lin-t-quaternary" />
                    )}
                  </button>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(q.id)}
                    className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible"
                    title="Xoá"
                  >
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--lin-danger)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}