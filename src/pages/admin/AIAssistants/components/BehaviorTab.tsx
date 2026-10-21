// ===================================================================
// ============== AI ASSISTANTS — Behavior tab ================
// ===================================================================
// Hành vi AI: guardrails, refusal, escalation, rate limit. Emotion
// được cấu hình chi tiết (preset, intensity, empathy, formality).

import React from 'react';
import { Sparkles, RotateCcw, Wand2 } from 'lucide-react';
import {
  GLOBAL_BEHAVIOR_DEFAULTS,
  type BehaviorConfig,
  type EmotionConfig,
  type StudioBot,
} from '../types';
import {
  ChipToggle, Field, InheritBadge, NumberWithUnit, RangeRow,
  Section, ToggleRow,
} from './primitives';

interface Props {
  bot: StudioBot;
  draft: StudioBot | null;
  onUpdate: (patch: Partial<StudioBot>) => void;
}

const EMOTION_PRESETS = [
  { value: 'mada-care', label: '🌿 MADA Care', hint: 'Ấm áp, thấu cảm' },
  { value: 'mada-pro', label: '⚙️ MADA Pro', hint: 'Chuyên nghiệp, ngắn gọn' },
  { value: 'mada-buddy', label: '🤝 MADA Buddy', hint: 'Thân thiện, gần gũi' },
  { value: 'clinical', label: '🩺 Clinical', hint: 'Lâm sàng, chuẩn xác' },
] as const;

const INTENSITY = [
  { value: 'none', label: 'Tắt' },
  { value: 'low', label: 'Nhẹ' },
  { value: 'medium', label: 'Vừa' },
  { value: 'high', label: 'Mạnh' },
] as const;

export function BehaviorTab({ bot, draft, onUpdate }: Props) {
  const view = draft ?? bot;
  const isOverridingBehavior = bot.behavior !== null && bot.behavior !== undefined;
  const behavior: BehaviorConfig = view.behavior
    ?? { ...GLOBAL_BEHAVIOR_DEFAULTS };

  const emotion: EmotionConfig = view.emotion ?? {
    enabled: false,
    preset: 'mada-care',
    intensity: 'medium',
    empathy: 60,
    formality: 50,
  };

  const updateBehavior = (patch: Partial<BehaviorConfig>) => {
    onUpdate({ behavior: { ...behavior, ...patch } });
  };

  const updateEmotion = (patch: Partial<EmotionConfig>) => {
    onUpdate({ emotion: { ...emotion, ...patch } });
  };

  return (
    <div className="max-w-3xl">
      {/* ── Behavior ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] lin-t-quaternary">
          Cách bot phản ứng với câu hỏi ngoài phạm vi hoặc vượt rate limit.
        </p>
        <InheritBadge
          inherited={!isOverridingBehavior}
          onReset={
            isOverridingBehavior
              ? () => onUpdate({ behavior: null })
              : undefined
          }
        />
      </div>

      <Section title="Phản hồi mặc định">
        <Field
          label="Tin nhắn khi AI không biết"
          hint="Ví dụ: 'Xin lỗi, mình chưa có câu trả lời phù hợp.'"
        >
          <textarea
            rows={2}
            className="lin-input lin-focus-visible"
            value={behavior.fallbackMessage ?? ''}
            onChange={(e) => updateBehavior({ fallbackMessage: e.target.value })}
          />
        </Field>

        <Field label="Tin nhắn từ chối" className="mt-3">
          <textarea
            rows={2}
            className="lin-input lin-focus-visible"
            value={behavior.refusalMessage ?? ''}
            onChange={(e) => updateBehavior({ refusalMessage: e.target.value })}
            placeholder="Để trống = dùng refusal mặc định"
          />
        </Field>
      </Section>

      <Section title="Guardrails">
        <div className="space-y-3">
          <ToggleRow
            checked={behavior.enableGuardrails}
            onChange={(v) => updateBehavior({ enableGuardrails: v })}
            label="Bật guardrails an toàn"
            hint="Chặn câu hỏi y tế ngoài scope, chẩn đoán sai, chỉ định thiết bị nguy hiểm."
          />
          <ToggleRow
            checked={behavior.enableAutoSuggest}
            onChange={(v) => updateBehavior({ enableAutoSuggest: v })}
            label="Auto-suggest câu hỏi"
            hint="Hiển thị câu hỏi gợi ý ngay khi user mở widget."
          />
        </div>
      </Section>

      <Section title="Giới hạn tải">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Rate limit (msg/phút)"
            hint="0 = không giới hạn"
          >
            <NumberWithUnit
              value={behavior.rateLimitPerMinute}
              onChange={(v) => updateBehavior({ rateLimitPerMinute: v })}
              min={0}
              max={1000}
            />
          </Field>

          <Field
            label="Ngưỡng escalation"
            hint="Khi confidence < ngưỡng → escalate sang nhân viên"
          >
            <RangeRow
              value={Math.round((behavior.adminEscalationThreshold ?? 0.6) * 100)}
              onChange={(v) =>
                updateBehavior({ adminEscalationThreshold: v / 100 })
              }
              min={0}
              max={100}
              format={(v) => `${v}%`}
            />
          </Field>
        </div>
      </Section>

      {/* ── Emotion ── */}
      <Section
        title="Cảm xúc & Giọng điệu (Emotion)"
        description={
          (view.emotion === null || view.emotion === undefined)
            ? 'Chưa bật emotion override — bot đang dùng cấu hình emotion toàn cục.'
            : 'Đã ghi đè emotion riêng cho bot này.'
        }
        action={
          <InheritBadge
            inherited={view.emotion === null || view.emotion === undefined}
            onReset={
              view.emotion !== null && view.emotion !== undefined
                ? () => onUpdate({ emotion: null })
                : undefined
            }
          />
        }
      >
        <ToggleRow
          checked={emotion.enabled ?? false}
          onChange={(v) => updateEmotion({ enabled: v })}
          label="Bật tùy biến emotion cho bot này"
          hint="Tắt = dùng emotion toàn cục của hệ thống."
        />

        {emotion.enabled && (
          <div className="mt-4 space-y-4">
            <Field label="Preset">
              <div className="grid grid-cols-2 gap-2">
                {EMOTION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateEmotion({ preset: p.value })}
                    className="px-2.5 py-2 rounded-md text-left transition-colors lin-focus-visible"
                    style={{
                      border: `1px solid ${
                        emotion.preset === p.value
                          ? 'var(--lin-accent-border)'
                          : 'var(--lin-border)'
                      }`,
                      background:
                        emotion.preset === p.value
                          ? 'var(--lin-accent-soft)'
                          : 'var(--lin-bg-elevated)',
                    }}
                  >
                    <div className="text-[12px] font-medium lin-t-primary">{p.label}</div>
                    <div className="text-[10.5px] lin-t-quaternary mt-0.5">{p.hint}</div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Cường độ">
              <div className="flex gap-1.5">
                {INTENSITY.map((i) => (
                  <ChipToggle
                    key={i.value}
                    label={i.label}
                    active={emotion.intensity === i.value}
                    onClick={() => updateEmotion({ intensity: i.value as EmotionConfig['intensity'] })}
                  />
                ))}
              </div>
            </Field>

            <Field label={`Đồng cảm (${emotion.empathy})`}>
              <RangeRow
                value={emotion.empathy ?? 50}
                onChange={(v) => updateEmotion({ empathy: v })}
                format={(v) => `${v}%`}
              />
            </Field>

            <Field label={`Hình thức (${emotion.formality})`}>
              <RangeRow
                value={emotion.formality ?? 50}
                onChange={(v) => updateEmotion({ formality: v })}
                format={(v) => `${v}%`}
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  updateEmotion({
                    preset: 'mada-care',
                    intensity: 'medium',
                    empathy: 70,
                    formality: 40,
                    enabled: true,
                  })
                }
                className="lin-btn lin-btn-secondary lin-btn-sm lin-focus-visible"
              >
                <Wand2 className="w-3 h-3" />
                <span className="text-[12px]">Preset mặc định</span>
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}