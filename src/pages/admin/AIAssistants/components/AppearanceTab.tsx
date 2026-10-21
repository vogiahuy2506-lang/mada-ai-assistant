// ===================================================================
// ============== AI ASSISTANTS — Appearance tab ===============
// ===================================================================
// Giao diện widget riêng của bot (position, theme, ngôn ngữ bật).
// NULL = kế thừa global.

import React from 'react';
import { Wand2, RotateCcw } from 'lucide-react';
import {
  LANGUAGES, WIDGET_POSITIONS, WIDGET_THEMES,
  type LanguageCode,
} from '../constants';
import {
  GLOBAL_WIDGET_DEFAULTS,
  type StudioBot,
  type WidgetConfig,
} from '../types';
import {
  ChipToggle, Field, InheritBadge, OptionGrid, RangeRow,
  Section, ToggleRow,
} from './primitives';

interface Props {
  bot: StudioBot;
  draft: StudioBot | null;
  onUpdate: (patch: Partial<StudioBot>) => void;
}

export function AppearanceTab({ bot, draft, onUpdate }: Props) {
  const view = draft ?? bot;
  const isOverriding = bot.widget !== null && bot.widget !== undefined;
  const current: WidgetConfig = view.widget
    ?? { ...GLOBAL_WIDGET_DEFAULTS };

  const updateWidget = (patch: Partial<WidgetConfig>) => {
    // Khi đã từng có override, cập nhật object đó. Khi chưa có, tạo mới từ default.
    const next: WidgetConfig = { ...current, ...patch };
    onUpdate({ widget: next });
  };

  const toggleLang = (lang: LanguageCode) => {
    const cur = current.enabledLanguages ?? GLOBAL_WIDGET_DEFAULTS.enabledLanguages;
    const next = cur.includes(lang) ? cur.filter((l) => l !== lang) : [...cur, lang];
    if (next.length === 0) return; // cần ít nhất 1 ngôn ngữ
    updateWidget({ enabledLanguages: next });
  };

  const widget = current;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] lin-t-quaternary">
          Tùy biến giao diện chat widget cho bot này. Để trống sẽ kế thừa cấu hình widget toàn cục.
        </p>
        <InheritBadge
          inherited={!isOverriding}
          onReset={
            isOverriding
              ? () => onUpdate({ widget: null })
              : undefined
          }
        />
      </div>

      <Section title="Vị trí hiển thị">
        <OptionGrid
          options={[...WIDGET_POSITIONS]}
          value={widget.position}
          onChange={(v) => updateWidget({ position: v })}
          columns={2}
        />
      </Section>

      <Section title="Theme màu">
        <OptionGrid
          options={[...WIDGET_THEMES]}
          value={widget.theme as any}
          onChange={(v) => updateWidget({ theme: v })}
          columns={2}
        />

        <Field label="Bo góc (px)" className="mt-3">
          <RangeRow
            value={widget.borderRadius}
            onChange={(v) => updateWidget({ borderRadius: v })}
            min={0}
            max={32}
            format={(v) => `${v}px`}
          />
        </Field>
      </Section>

      <Section title="Ngôn ngữ">
        <Field
          label="Ngôn ngữ mặc định"
          hint="Widget mở lần đầu sẽ dùng ngôn ngữ này, sau đó user có thể đổi."
        >
          <div className="flex gap-1.5 flex-wrap">
            {LANGUAGES.map((l) => (
              <ChipToggle
                key={l.value}
                label={`${l.flag} ${l.label}`}
                active={widget.defaultLanguage === l.value}
                onClick={() => updateWidget({ defaultLanguage: l.value })}
              />
            ))}
          </div>
        </Field>

        <Field label="Ngôn ngữ được bật" className="mt-3">
          <div className="flex gap-1.5 flex-wrap">
            {LANGUAGES.map((l) => (
              <ChipToggle
                key={l.value}
                label={`${l.flag} ${l.label}`}
                active={widget.enabledLanguages.includes(l.value)}
                onClick={() => toggleLang(l.value)}
              />
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Hiển thị">
        <div className="space-y-3">
          <ToggleRow
            checked={widget.enabled}
            onChange={(v) => updateWidget({ enabled: v })}
            label="Bật widget cho bot này"
            hint="Tắt để không nhúng chatbot này vào website."
          />
          <ToggleRow
            checked={widget.showBubbleAvatar}
            onChange={(v) => updateWidget({ showBubbleAvatar: v })}
            label="Hiện avatar trong bong bóng chat"
            hint="Avatar giúp user nhận biết đang chat với ai."
          />
        </div>
      </Section>

      <Section
        title="Khác"
        description="Một số preset nhanh."
      >
        <button
          type="button"
          onClick={() =>
            onUpdate({
              widget: {
                ...GLOBAL_WIDGET_DEFAULTS,
                ...current,
                enabled: true,
                showBubbleAvatar: true,
                borderRadius: 16,
              },
            })
          }
          className="lin-btn lin-btn-secondary lin-btn-sm lin-focus-visible"
        >
          <Wand2 className="w-3 h-3" />
          <span className="text-[12px]">Reset về preset đầy đủ</span>
        </button>
      </Section>
    </div>
  );
}