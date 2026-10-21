// ============== Admin UI Primitives (Linear-style) ==============
// Tập các component nền tảng dùng chung cho toàn bộ admin pages.
// Minimal, consistent, theme-aware (light/dark tự động qua CSS vars).

import React, { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

// ── Button ──────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const sizeCls = size === 'sm' ? 'lin-btn-sm' : size === 'lg' ? 'lin-btn-lg' : '';
  return (
    <button
      className={`lin-btn lin-btn-${variant} ${sizeCls} lin-focus-visible ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Icon Button ─────────────────────────────────────────────────

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'ghost' | 'secondary';
  size?: 'sm' | 'md';
}

export function IconButton({ label, variant = 'ghost', size = 'md', className = '', children, ...rest }: IconButtonProps) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center ${dim} rounded lin-btn-${variant} lin-focus-visible ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Input ───────────────────────────────────────────────────────

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="lin-label">
          {label}
          {required && <span style={{ color: 'var(--lin-danger)' }}> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs mt-1.5" style={{ color: 'var(--lin-danger)' }}>{error}</p>
      ) : hint ? (
        <p className="lin-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`lin-input ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`lin-textarea ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`lin-select ${className}`} {...rest}>
      {children}
    </select>
  );
}

// ── Search input with icon ──────────────────────────────────────

export function SearchInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: 'var(--lin-text-quaternary)' }}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input className="lin-input pl-8" {...rest} />
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`lin-badge lin-badge-${tone} ${className}`}>{children}</span>;
}

// ── Card ────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  hover = false,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
}) {
  return (
    <div className={`lin-card ${hover ? 'lin-card-hover' : ''} ${padding ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold lin-t-primary truncate">{title}</h3>
        {subtitle && <p className="text-xs lin-t-tertiary mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 border-b ${className}`} style={{ borderColor: 'var(--lin-border)' }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="relative px-3 py-2 text-[13px] font-medium transition-colors lin-focus-visible"
            style={{ color: isActive ? 'var(--lin-text-primary)' : 'var(--lin-text-tertiary)' }}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && (
                <span
                  className="text-[11px] px-1.5 rounded-full"
                  style={{
                    background: isActive ? 'var(--lin-accent-soft)' : 'var(--lin-bg-sunken)',
                    color: isActive ? 'var(--lin-accent)' : 'var(--lin-text-tertiary)',
                  }}
                >
                  {t.count}
                </span>
              )}
            </span>
            {isActive && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full"
                style={{ background: 'var(--lin-accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="lin-card my-8 w-full"
        style={{ maxWidth: width, background: 'var(--lin-bg-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: '1px solid var(--lin-border)' }}
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold lin-t-primary">{title}</h2>
            {subtitle && <p className="text-xs lin-t-tertiary mt-0.5">{subtitle}</p>}
          </div>
          <IconButton label="Đóng" onClick={onClose}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto lin-scroll">{children}</div>

        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--lin-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toggle switch ───────────────────────────────────────────────

export function Toggle({
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
    <label className="flex items-start gap-3 cursor-pointer" style={{ opacity: disabled ? 0.5 : 1 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 mt-0.5 rounded-full transition-colors lin-focus-visible"
        style={{
          width: 32,
          height: 18,
          background: checked ? 'var(--lin-accent)' : 'var(--lin-border-strong)',
        }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-transform"
          style={{
            width: 14,
            height: 14,
            left: checked ? 16 : 2,
            transition: 'transform 180ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium lin-t-primary">{label}</span>
        {hint && <span className="block text-xs lin-t-tertiary mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

// ── Empty state ─────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
          style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-text-quaternary)' }}
        >
          {icon}
        </div>
      )}
      <p className="text-[14px] font-medium lin-t-secondary">{title}</p>
      {description && <p className="text-xs lin-t-tertiary mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold lin-t-primary tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-[13px] lin-t-tertiary mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────

export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 mb-4 ${className}`}
    >
      {children}
    </div>
  );
}

// ── Stat tile ───────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive: boolean };
  icon?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs lin-t-tertiary font-medium">{label}</p>
          <p className="text-2xl font-semibold lin-t-primary mt-1.5 tracking-[-0.02em]">{value}</p>
          {delta && (
            <p
              className="text-xs mt-1 font-medium"
              style={{ color: delta.positive ? 'var(--lin-success)' : 'var(--lin-danger)' }}
            >
              {delta.positive ? '↑' : '↓'} {delta.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-text-tertiary)' }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}