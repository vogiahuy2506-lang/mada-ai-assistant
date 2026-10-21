// ===================================================================
// ============== AI ASSISTANTS — Prompt tab =================
// ===================================================================
// System prompt + greetings + câu chỉ dẫn ngôn ngữ. Playground sẽ dùng
// bản nháp (draft) để test trước khi admin bấm Lưu.

import React, { useState } from 'react';
import { Eye, FileText, RotateCcw, Save, Sparkles, Wand2 } from 'lucide-react';
import { studioApi } from '../api';
import { LANGUAGES, type LanguageCode } from '../constants';
import type { GreetingMap, StudioBot } from '../types';
import { Alert, Field, Section, ChipToggle } from './primitives';

interface Props {
  bot: StudioBot;
  draft: StudioBot | null;
  saving: boolean;
  isDirty: boolean;
  onUpdate: (patch: Partial<StudioBot>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
}

export function PromptTab({ bot, draft, saving, isDirty, onUpdate, onSave, onReset }: Props) {
  const view = draft ?? bot;
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeLang, setActiveLang] = useState<LanguageCode>('vi');

  const updateGreeting = (lang: LanguageCode, text: string) => {
    const next: GreetingMap = { ...(view.greeting ?? {}), [lang]: text };
    onUpdate({ greeting: next });
  };

  const applyTemplate = () => {
    const tmpl = `# Vai trò
Bạn là **${view.name}** — trợ lý AI chuyên về ${
      view.description || '(mô tả ngắn về chuyên môn)'
    }.

# Nguyên tắc ứng xử
- Trả lời ngắn gọn, rõ ràng, dễ đọc.
- Luôn ưu tiên nguồn tri thức nội bộ (RAG) — nếu không có, hãy thành thật.
- Thừa nhận khi không chắc chắn; không bịa đặt sản phẩm/tiêu chuẩn không có thật.
- Trả lời đúng ngôn ngữ của người dùng.

# Định dạng
- Dùng gạch đầu dòng cho bước hướng dẫn.
- Bảng cho so sánh sản phẩm/tiêu chuẩn.
- Link gốc khi dẫn nguồn.`;
    onUpdate({ systemPrompt: tmpl });
  };

  const previewPrompt = async () => {
    setPreviewLoading(true);
    try {
      const res = await studioApi.previewPrompt(bot.id, {
        language: activeLang,
        userMode: 'endUser',
        draftPrompt: view.systemPrompt,
      });
      if (res.success && res.data) setPreviewText(res.data.systemInstruction);
      else setPreviewText('⚠️ ' + (res.error || 'Lỗi'));
    } catch (err: any) {
      setPreviewText('⚠️ ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* ── System prompt ── */}
      <Section
        title="System Prompt"
        description="Lời chỉ dẫn hệ thống gửi cho AI mỗi lượt trả lời."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyTemplate}
              className="lin-btn lin-btn-secondary lin-btn-sm lin-focus-visible"
              title="Điền nhanh khung prompt đề xuất — bạn có thể sửa lại"
            >
              <Wand2 className="w-3 h-3" />
              <span className="text-[11px]">Khung mẫu</span>
            </button>
            <button
              type="button"
              onClick={previewPrompt}
              disabled={previewLoading}
              className="lin-btn lin-btn-secondary lin-btn-sm lin-focus-visible"
              title="Xem prompt đầy đủ sẽ gửi cho AI"
            >
              <Eye className="w-3 h-3" />
              <span className="text-[11px]">
                {previewLoading ? 'Đang xem…' : 'Xem prompt đầy đủ'}
              </span>
            </button>
          </div>
        }
      >
        <Field hint="Khoảng 800–2000 ký tự là đủ cho persona chuyên gia. Markdown được phép.">
          <textarea
            className="lin-input lin-focus-visible leading-relaxed"
            style={{ minHeight: 240 }}
            value={view.systemPrompt}
            onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
            placeholder="Bạn là trợ lý chuyên về …"
          />
        </Field>

        {/* Counter + draft status */}
        <div className="mt-2 flex items-center justify-between text-[11px] lin-t-quaternary">
          <span>{view.systemPrompt.length} ký tự</span>
          {isDirty && (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: 'var(--lin-warning)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--lin-warning)' }}
              />
              Đang có thay đổi chưa lưu — playground sẽ test bản nháp
            </span>
          )}
        </div>

        {/* Preview thực tế */}
        {previewText !== null && (
          <details
            className="mt-3 rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--lin-border)' }}
            open
          >
            <summary
              className="px-2.5 py-1.5 cursor-pointer text-[11.5px] font-medium lin-t-secondary flex items-center gap-1.5"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              <FileText className="w-3 h-3" />
              Prompt đầy đủ được gửi cho AI ({previewText.length} ký tự)
            </summary>
            <pre
              className="px-3 py-2.5 text-[11px] leading-relaxed overflow-x-auto max-h-72 overflow-y-auto lin-scroll whitespace-pre-wrap"
              style={{
                background: 'var(--lin-bg-elevated)',
                color: 'var(--lin-text-secondary)',
                fontFamily: 'var(--lin-font-mono)',
              }}
            >
              {previewLoading ? 'Đang tải…' : previewText}
            </pre>
          </details>
        )}
      </Section>

      {/* ── Languages ── */}
      <Section
        title="Ngôn ngữ trả lời"
        description="Hướng dẫn thêm cho AI về cách đa ngôn ngữ."
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {LANGUAGES.map((l) => (
            <ChipToggle
              key={l.value}
              label={`${l.flag} ${l.label}`}
              active={activeLang === l.value}
              onClick={() => setActiveLang(l.value)}
            />
          ))}
        </div>

        <Alert tone="info">
          AI luôn cố gắng trả lời đúng ngôn ngữ của người dùng. Bạn chỉ cần viết lời
          nhắn riêng cho từng ngôn ngữ dưới đây nếu muốn thêm hướng dẫn cụ thể.
        </Alert>
      </Section>

      {/* ── Greetings ── */}
      <Section
        title="Lời chào"
        description="Tin nhắn đầu tiên bot gửi khi bắt đầu hội thoại. Để trống = dùng greeting toàn cục."
      >
        <div className="space-y-3">
          {LANGUAGES.map((l) => (
            <Field
              key={l.value}
              label={`${l.flag} ${l.label}`}
              hint={
                (view.greeting ?? {})[l.value]
                  ? 'Đã có lời chào riêng — bấm Lưu để áp dụng'
                  : 'Chưa có — sẽ kế thừa lời chào toàn cục'
              }
            >
              <input
                className="lin-input lin-focus-visible"
                value={(view.greeting ?? {})[l.value] ?? ''}
                onChange={(e) => updateGreeting(l.value, e.target.value)}
                placeholder={
                  l.value === 'vi'
                    ? 'Xin chào! Mình là trợ lý Thính giác — mình giúp gì cho bạn?'
                    : 'Hello! I am the Hearing Assistant — how can I help?'
                }
              />
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );
}