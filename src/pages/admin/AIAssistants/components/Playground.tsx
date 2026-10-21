// ===================================================================
// ============== AI ASSISTANTS — Playground (right panel) =======
// ===================================================================
// Test trợ lý như Google AI Studio: chọn ngôn ngữ + mode (người dùng /
// chuyên gia), gõ message, xem câu trả lời + latency + nguồn RAG.
// `draftPrompt` cho phép test system prompt CHƯA LƯU.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Trash2, Loader2, Square, ChevronDown, ChevronRight,
  AlertTriangle, FileText, Gauge,
} from 'lucide-react';
import { studioApi } from '../api';
import { LANGUAGES, type LanguageCode } from '../constants';
import type { PlaygroundMessage, StudioBot } from '../types';

interface Props {
  bot: StudioBot | null;
  /** Prompt đang sửa dừ (chưa lưu) — playground dùng bản này để test. */
  draftPrompt?: string;
  hasUnsavedPrompt: boolean;
  /** Greeting draft (placeholder khởi đầu) — optional. */
  draftGreeting?: Record<string, string> | null;
}

export function Playground({ bot, draftPrompt, hasUnsavedPrompt, draftGreeting }: Props) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('vi');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPreview, setSystemPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset khi đổi bot
  useEffect(() => {
    setMessages([]);
    setSystemPreview('');
    setShowSystemPrompt(false);
  }, [bot?.id]);

  // Auto-scroll xuống cuối
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Xem system prompt đầy đủ
  const toggleSystemPrompt = async () => {
    if (showSystemPrompt) {
      setShowSystemPrompt(false);
      return;
    }
    setShowSystemPrompt(true);
    if (systemPreview || !bot) return;

    setLoadingPreview(true);
    try {
      const res = await studioApi.previewPrompt(bot.id, {
        language,
        draftPrompt: hasUnsavedPrompt ? draftPrompt : undefined,
      });
      if (res.success && res.data) setSystemPreview(res.data.systemInstruction);
      else setSystemPreview('⚠️ ' + (res.error || 'Không lấy được system prompt'));
    } catch (err: any) {
      setSystemPreview('⚠️ ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !bot || sending) return;

    const userMsg: PlaygroundMessage = { role: 'user', content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await studioApi.sendPlayground(bot.id, {
        message: text,
        history,
        language,
        draftPrompt: hasUnsavedPrompt ? draftPrompt : undefined,
      });

      if (res.success && res.data) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data!.answer,
            meta: {
              latencyMs: res.data!.latencyMs,
              confidence: res.data!.confidence,
              sources: res.data!.sources,
            },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.error || 'Không nhận được phản hồi.',
            error: true,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message || 'Lỗi mạng — không gửi được message.',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastMeta = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].meta;
    }
    return undefined;
  }, [messages]);

  if (!bot) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-[12px] lin-t-quaternary text-center">
          Chọn một trợ lý để bắt đầu test.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--lin-bg-elevated)' }}>
      {/* ── Header ── */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--lin-border)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold lin-t-primary flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" style={{ color: 'var(--lin-accent)' }} />
              Playground
            </h3>
            <p className="text-[11px] lin-t-quaternary mt-0.5 truncate">
              Test trước khi lưu — không ảnh hưởng người dùng thật
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible shrink-0"
              title="Xoá hội thoại test"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mt-3">
          {/* Language */}
          <div className="relative flex-1 min-w-0">
            <select
              className="lin-select lin-focus-visible"
              style={{ height: 28, fontSize: 12, paddingLeft: 8 }}
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              aria-label="Ngôn ngữ test"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Unsaved prompt badge */}
        {hasUnsavedPrompt && (
          <div
            className="mt-2.5 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px]"
            style={{
              background: 'color-mix(in srgb, var(--lin-warning) 12%, transparent)',
              color: 'var(--lin-text-secondary)',
            }}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: 'var(--lin-warning)' }} />
            Đang test prompt <strong>chưa lưu</strong> — sẽ dùng nội dung bạn vừa sửa.
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto lin-scroll px-4 py-4 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[20px] mb-3"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              {bot.avatar || '🤖'}
            </div>
            <p className="text-[12.5px] font-medium lin-t-secondary">
              Test trợ lý {bot.name}
            </p>
            <p className="text-[11px] lin-t-quaternary mt-1 max-w-[240px]">
              Gõ câu hỏi bên dưới để xem phản hồi thật, kèm nguồn tri thức và độ trễ.
            </p>

            {/* Quick prompts */}
            <div className="flex flex-col gap-1.5 mt-5 w-full max-w-[280px]">
              {SAMPLE_PROMPTS[bot.id]?.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="text-left px-2.5 py-1.5 rounded-md text-[11.5px] lin-t-tertiary transition-colors lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
                  style={{
                    border: '1px solid var(--lin-border-subtle)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="flex gap-2"
              style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              {msg.role === 'assistant' && (
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] shrink-0 mt-0.5"
                  style={{ background: 'var(--lin-bg-sunken)' }}
                >
                  {bot.avatar || '🤖'}
                </span>
              )}

              <div
                className="max-w-[85%] min-w-0"
                style={{
                  padding: '8px 11px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background:
                    msg.role === 'user'
                      ? 'var(--lin-accent)'
                      : 'var(--lin-bg-sunken)',
                  color:
                    msg.role === 'user'
                      ? '#fff'
                      : msg.error
                      ? 'var(--lin-danger)'
                      : 'var(--lin-text-primary)',
                }}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                  style={{
                    background: 'var(--lin-bg-sunken)',
                    color: 'var(--lin-text-tertiary)',
                  }}
                >
                  B
                </span>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-2">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] shrink-0 mt-0.5"
                style={{ background: 'var(--lin-bg-sunken)' }}
              >
                {bot.avatar || '🤖'}
              </span>
              <div
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg"
                style={{ background: 'var(--lin-bg-sunken)' }}
              >
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--lin-accent)' }} />
                <span className="text-[11.5px] lin-t-quaternary">Đang suy nghĩ…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Meta + System prompt ── */}
      {(lastMeta || messages.length > 0) && (
        <div
          className="px-4 py-2 shrink-0"
          style={{ borderTop: '1px solid var(--lin-border-subtle)' }}
        >
          {lastMeta && (
            <div className="flex items-center gap-3 text-[10.5px] lin-t-quaternary mb-2">
              {lastMeta.latencyMs !== undefined && (
                <span>⏱ {lastMeta.latencyMs}ms</span>
              )}
              {lastMeta.confidence !== undefined && (
                <span>
                  📊 confidence {(lastMeta.confidence * 100).toFixed(0)}%
                </span>
              )}
              {lastMeta.sources && lastMeta.sources.length > 0 && (
                <span>📚 {lastMeta.sources.length} nguồn</span>
              )}
            </div>
          )}

          {/* Sources */}
          {lastMeta?.sources && lastMeta.sources.length > 0 && (
            <div className="mb-2">
              {lastMeta.sources.map((src, idx) => (
                <div key={idx} className="mb-1">
                  <button
                    type="button"
                    onClick={() => setExpandedSource(expandedSource === idx ? null : idx)}
                    className="w-full flex items-center gap-1.5 text-left text-[10.5px] lin-t-quaternary hover:lin-t-tertiary transition-colors lin-focus-visible"
                  >
                    {expandedSource === idx ? (
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 shrink-0" />
                    )}
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {src.title || src.source || 'Nguồn tri thức'}
                    </span>
                    {src.score !== null && (
                      <span className="shrink-0">
                        {(src.score ?? 0).toFixed(2)}
                      </span>
                    )}
                  </button>
                  {expandedSource === idx && (
                    <p
                      className="text-[10.5px] lin-t-quaternary mt-1 ml-6 pl-2 leading-relaxed"
                      style={{ borderLeft: '1px solid var(--lin-border)' }}
                    >
                      {src.preview}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* System prompt toggle */}
          <button
            type="button"
            onClick={toggleSystemPrompt}
            className="text-[10.5px] lin-t-quaternary hover:lin-t-tertiary transition-colors lin-focus-visible flex items-center gap-1"
          >
            {showSystemPrompt ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Xem system prompt đầy đủ ({systemPreview ? `${systemPreview.length}` : '?'} ký tự)
          </button>

          {showSystemPrompt && (
            <pre
              className="mt-2 p-2.5 rounded-md text-[10.5px] leading-relaxed overflow-x-auto max-h-48 overflow-y-auto lin-scroll whitespace-pre-wrap"
              style={{
                background: 'var(--lin-bg-sunken)',
                color: 'var(--lin-text-secondary)',
                fontFamily: 'var(--lin-font-mono)',
              }}
            >
              {loadingPreview ? 'Đang tải…' : systemPreview || 'Chưa có dữ liệu.'}
            </pre>
          )}
        </div>
      )}

      {/* ── Composer ── */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: '1px solid var(--lin-border)' }}
      >
        <div
          className="flex items-end gap-2 rounded-lg px-2.5 py-2 transition-colors"
          style={{
            border: '1px solid var(--lin-border)',
            background: 'var(--lin-bg)',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[12.5px] leading-relaxed lin-t-primary placeholder:lin-t-quaternary"
            style={{ maxHeight: 120 }}
            placeholder={`Hỏi ${bot.name}…  (Enter để gửi, Shift+Enter xuống dòng)`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={onKeyDown}
          />
          {sending ? (
            <button
              type="button"
              onClick={() => setSending(false)}
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 lin-btn-secondary lin-focus-visible"
              title="Dừng"
            >
              <Square className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors lin-focus-visible disabled:opacity-40"
              style={{ background: 'var(--lin-accent)', color: '#fff' }}
              title="Gửi"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Câu hỏi mẫu theo từng bot — giúp admin test nhanh. */
const SAMPLE_PROMPTS: Record<string, string[]> = {
  'bot-hearing': [
    'Máy trợ thính BTE và ITE khác nhau thế nào?',
    'Tiêu chuẩn ISO nào áp dụng cho máy trợ thính?',
  ],
  'bot-vision': [
    'Phần mềm đọc màn hình nào miễn phí cho người khiếm thị?',
    'Kính lúp điện tử chọn theo tiêu chí nào?',
  ],
  'bot-speech': [
    'Bảng giao tiếp AAC nào hợp với trẻ 4 tuổi?',
    'Proloquo2Go và Tobii Dynavox khác nhau thế nào?',
  ],
  'bot-cognitive': [
    'Thiết bị nhắc nhở thuốc cho người cao tuổi?',
    'WHO công nhận công cụ hỗ trợ nhận thức nào?',
  ],
  'bot-neuro': [
    'Chuột miệng điều khiển cho người hạn chế tay như thế nào?',
    'Tiêu chuẩn vật liệu sinh học cho thiết bị y tế là gì?',
  ],
  'bot-mobility': [
    'Xe lăn nào phù hợp căn hộ nhỏ?',
    'Xe lăn điện có cần chứng nhận CE không?',
  ],
  'bot-regulatory': [
    'CE Mark và FDA 510(k) khác nhau thế nào?',
    'ISO 9999:2022 phân loại sản phẩm AT ra sao?',
  ],
};