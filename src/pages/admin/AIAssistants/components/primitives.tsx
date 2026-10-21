// ===================================================================
// ============== AI ASSISTANTS — Shared tab primitives ==========
// ===================================================================
// Các helper nhỏ dùng chung cho mọi tab: section, field, toggle,
// badge "kế thừa global", inline save bar.

import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

// ---------- Section ----------

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold lin-t-primary">{title}</h3>
          {description && (
            <p className="text-[11.5px] lin-t-quaternary mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ---------- Field ----------

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[12px] font-medium lin-t-secondary mb-1.5">
          {label}
          {required && <span style={{ color: 'var(--lin-danger)' }}> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--lin-danger)' }}>
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] lin-t-quaternary mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------- Toggle ----------

/**
 * Track + knob của switch.
 *
 * Lưu ý: `src/index.css` có rule `@media (pointer: coarse) { button { min-height:
 * 44px; min-width: 44px } }` để đảm bảo touch target trên mobile. Switch là
 * control NHỎ — nếu để rule đó áp, track 32×18 bị bóp thành 44×44 (hình tròn
 * to, knob 14px lạc lõng). Vì vậy track phải `min-w-0 min-h-0` để thoát rule,
 * và phần bấm rộng được bù bằng `::after` overlay trải đúng vùng 44×44 quanh
 * track — giữ được cả vẻ đẹp nhỏ gọn lẫn vùng chạm 44px trên mobile.
 *
 * Vì track không còn 44px, hit-area trên DESKTOP cũng được mở rộng bằng
 * chính overlay đó (44×44) → dễ bấm, không phải cố leo 14px.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative shrink-0 rounded-full transition-colors lin-focus-visible"
      style={{
        width: 34,
        height: 20,
        minWidth: 0,
        minHeight: 0,
        padding: 0,
        background: checked ? 'var(--lin-accent)' : 'var(--lin-border-strong)',
        boxShadow: checked
          ? '0 0 0 3px color-mix(in srgb, var(--lin-accent) 18%, transparent)'
          : 'inset 0 1px 2px rgba(0,0,0,0.18)',
      }}
    >
      {/* Vùng bấm 44×44 — tràn ra ngoài track, trong suốt */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{ top: '50%', left: '50%', width: 44, height: 44, transform: 'translate(-50%, -50%)' }}
      />
      {/* Knob */}
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-white pointer-events-none"
        style={{
          width: 16,
          height: 16,
          top: 2,
          left: checked ? 16 : 2,
          boxShadow: '0 1px 2px rgba(0,0,0,0.28)',
          transition: 'left 200ms cubic-bezier(0.16,1,0.3,1), width 140ms ease',
        }}
      />
    </button>
  );
}

export function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 select-none"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="pt-px">
        <Switch
          checked={checked}
          onChange={onChange}
          label={label}
          disabled={disabled}
        />
      </span>
      {/* Label là <button> riêng: bấm chữ cũng toggle, vùng bấm rộng & dễ
          đọc hơn <label> + input ẩn (input ẩn lại dính rule 44px kia). */}
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="min-w-0 text-left rounded transition-opacity lin-focus-visible disabled:cursor-not-allowed"
      >
        <span className="block text-[12.5px] font-medium lin-t-primary leading-snug">{label}</span>
        {hint && (
          <span className="block text-[11px] lin-t-quaternary mt-0.5 leading-relaxed">{hint}</span>
        )}
      </button>
    </div>
  );
}

// ---------- Inheritance badge ----------

/**
 * Badge "đang kế thừa global" / "đã ghi đè riêng".
 * `inherited = true` nghĩa là chưa có override cho bot này.
 */
export function InheritBadge({
  inherited,
  onReset,
  resetting,
}: {
  inherited: boolean;
  onReset?: () => void;
  resetting?: boolean;
}) {
  if (inherited) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
        style={{
          background: 'color-mix(in srgb, var(--lin-success) 12%, transparent)',
          color: 'var(--lin-success)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--lin-success)' }}
        />
        Kế thừa cấu hình toàn cục
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
        style={{
          background: 'color-mix(in srgb, var(--lin-warning) 14%, transparent)',
          color: 'var(--lin-text-secondary)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--lin-warning)' }}
        />
        Đã ghi đè riêng
      </span>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="lin-btn lin-btn-ghost lin-btn-sm lin-focus-visible text-[11px]"
          title="Xoá override — bot này sẽ dùng lại cấu hình toàn cục"
        >
          {resetting ? 'Đang reset…' : '↺ Về global'}
        </button>
      )}
    </span>
  );
}

// ---------- Option grid (radio dạng card) ----------

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Array<{ value: T; label: string; hint?: string; swatch?: string }>;
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors lin-focus-visible"
            style={{
              border: `1px solid ${selected ? 'var(--lin-accent-border)' : 'var(--lin-border)'}`,
              background: selected ? 'var(--lin-accent-soft)' : 'var(--lin-bg-elevated)',
              color: selected ? 'var(--lin-accent)' : 'var(--lin-text-secondary)',
            }}
          >
            {opt.swatch && (
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ background: opt.swatch }}
              />
            )}
            <span className="min-w-0">
              <span className="block text-[12px] font-medium truncate">{opt.label}</span>
              {opt.hint && (
                <span className="block text-[10.5px] lin-t-quaternary truncate">
                  {opt.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Chip multi-select ----------

export function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors lin-focus-visible"
      style={{
        border: `1px solid ${active ? 'var(--lin-accent-border)' : 'var(--lin-border)'}`,
        background: active ? 'var(--lin-accent-soft)' : 'var(--lin-bg-elevated)',
        color: active ? 'var(--lin-accent)' : 'var(--lin-text-tertiary)',
      }}
    >
      {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}
      {label}
    </button>
  );
}

// ---------- Inline alert ----------

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: React.ReactNode;
}) {
  const map = {
    info: { bg: 'var(--lin-accent-soft)', fg: 'var(--lin-accent)' },
    warning: {
      bg: 'color-mix(in srgb, var(--lin-warning) 13%, transparent)',
      fg: 'var(--lin-text-secondary)',
    },
    danger: {
      bg: 'color-mix(in srgb, var(--lin-danger) 12%, transparent)',
      fg: 'var(--lin-danger)',
    },
    success: {
      bg: 'color-mix(in srgb, var(--lin-success) 12%, transparent)',
      fg: 'var(--lin-success)',
    },
  } as const;
  const c = map[tone];

  return (
    <div
      className="px-2.5 py-2 rounded-md text-[11.5px] leading-relaxed flex items-start gap-1.5"
      style={{ background: c.bg, color: c.fg }}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

// ---------- Empty row ----------

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-8 text-[12px] lin-t-quaternary">{children}</div>
  );
}

// ---------- Number input with unit ----------

export function NumberWithUnit({
  value,
  onChange,
  min = 0,
  max = 999,
  unit,
  suffix,
  style,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  suffix?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="lin-input lin-focus-visible"
        style={{ width: 96, ...style }}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
      />
      {(unit || suffix) && (
        <span className="text-[11.5px] lin-t-quaternary">{unit || suffix}</span>
      )}
    </div>
  );
}

// ---------- Range slider ----------

export function RangeRow({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--lin-accent)]"
      />
      <span
        className="text-[11.5px] font-mono lin-t-tertiary text-right shrink-0"
        style={{ width: 48 }}
      >
        {format ? format(value) : value}
      </span>
    </div>
  );
}