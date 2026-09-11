/**
 * AccessibilityToolbar - CORE accessibility controls
 * WCAG 2.2 AA compliant
 * - Font size: A- | A | A+ | A++
 * - High contrast mode
 * - Reduce motion
 * - Underline links
 * - Dyslexia-friendly font
 * Save preferences to localStorage + apply to <html>
 */

import React, { useState, useEffect } from 'react';
import {
  Type, Contrast, Pause, Underline, BookOpen, X, RotateCcw, Accessibility
} from 'lucide-react';
import clsx from 'clsx';

type FontSize = 'small' | 'normal' | 'large' | 'xlarge';
type ContrastMode = 'normal' | 'high';

interface A11yPrefs {
  fontSize: FontSize;
  contrast: ContrastMode;
  reduceMotion: boolean;
  underlineLinks: boolean;
  dyslexiaFont: boolean;
}

const DEFAULTS: A11yPrefs = {
  fontSize: 'normal',
  contrast: 'normal',
  reduceMotion: false,
  underlineLinks: false,
  dyslexiaFont: false,
};

const STORAGE_KEY = 'mada-a11y-prefs';

function loadPrefs(): A11yPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: A11yPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

function applyPrefs(prefs: A11yPrefs) {
  const html = document.documentElement;
  // Font size
  const sizeMap = { small: '14px', normal: '16px', large: '18px', xlarge: '20px' };
  html.style.fontSize = sizeMap[prefs.fontSize];
  html.dataset.fontSize = prefs.fontSize;

  // Contrast
  html.dataset.contrast = prefs.contrast;
  if (prefs.contrast === 'high') {
    html.classList.add('a11y-high-contrast');
  } else {
    html.classList.remove('a11y-high-contrast');
  }

  // Reduce motion
  html.dataset.reduceMotion = String(prefs.reduceMotion);
  if (prefs.reduceMotion) {
    html.classList.add('a11y-reduce-motion');
  } else {
    html.classList.remove('a11y-reduce-motion');
  }

  // Underline links
  if (prefs.underlineLinks) {
    html.classList.add('a11y-underline-links');
  } else {
    html.classList.remove('a11y-underline-links');
  }

  // Dyslexia font
  if (prefs.dyslexiaFont) {
    html.classList.add('a11y-dyslexia-font');
  } else {
    html.classList.remove('a11y-dyslexia-font');
  }
}

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULTS);

  useEffect(() => {
    const loaded = loadPrefs();
    setPrefs(loaded);
    applyPrefs(loaded);
  }, []);

  const update = (patch: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    applyPrefs(next);
  };

  const reset = () => {
    setPrefs(DEFAULTS);
    savePrefs(DEFAULTS);
    applyPrefs(DEFAULTS);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-primary text-on-primary border-2 border-on-background shadow-lg hover:scale-110 transition-transform flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-primary/30"
        aria-label="Mở tùy chọn trợ năng"
        aria-expanded={open}
        aria-controls="a11y-panel"
        title="Accessibility options (Alt+A)"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <aside
            id="a11y-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-title"
            className="fixed bottom-0 left-0 z-50 w-full max-w-sm bg-white border-2 border-on-background rounded-t-2xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="a11y-title" className="text-lg font-black flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-primary" aria-hidden="true" />
                Trợ năng
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Font size */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <Type className="w-4 h-4" aria-hidden="true" />
                Cỡ chữ
              </h3>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Cỡ chữ">
                {(['small', 'normal', 'large', 'xlarge'] as FontSize[]).map((size) => (
                  <button
                    key={size}
                    role="radio"
                    aria-checked={prefs.fontSize === size}
                    onClick={() => update({ fontSize: size })}
                    className={clsx(
                      'px-2 py-2.5 rounded-lg text-xs font-bold border-2 transition-all',
                      prefs.fontSize === size
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-white border-outline hover:border-primary'
                    )}
                  >
                    {size === 'small' && 'A-'}
                    {size === 'normal' && 'A'}
                    {size === 'large' && 'A+'}
                    {size === 'xlarge' && 'A++'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <Contrast className="w-4 h-4" aria-hidden="true" />
                Tương phản
              </h3>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Chế độ tương phản">
                <button
                  role="radio"
                  aria-checked={prefs.contrast === 'normal'}
                  onClick={() => update({ contrast: 'normal' })}
                  className={clsx(
                    'px-3 py-2.5 rounded-lg text-xs font-bold border-2',
                    prefs.contrast === 'normal'
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-white border-outline hover:border-primary'
                  )}
                >
                  Bình thường
                </button>
                <button
                  role="radio"
                  aria-checked={prefs.contrast === 'high'}
                  onClick={() => update({ contrast: 'high' })}
                  className={clsx(
                    'px-3 py-2.5 rounded-lg text-xs font-bold border-2',
                    prefs.contrast === 'high'
                      ? 'bg-black text-white border-black'
                      : 'bg-white border-outline hover:border-black'
                  )}
                >
                  Cao
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5">
              <ToggleRow
                icon={<Pause className="w-4 h-4" />}
                label="Giảm chuyển động"
                hint="Tắt hiệu ứng animation"
                checked={prefs.reduceMotion}
                onChange={(v) => update({ reduceMotion: v })}
              />
              <ToggleRow
                icon={<Underline className="w-4 h-4" />}
                label="Gạch chân liên kết"
                hint="Dễ nhận biết link hơn"
                checked={prefs.underlineLinks}
                onChange={(v) => update({ underlineLinks: v })}
              />
              <ToggleRow
                icon={<BookOpen className="w-4 h-4" />}
                label="Font dyslexia"
                hint="OpenDyslexic - dễ đọc hơn"
                checked={prefs.dyslexiaFont}
                onChange={(v) => update({ dyslexiaFont: v })}
              />
            </div>

            {/* Reset */}
            <button
              onClick={reset}
              className="mt-5 w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Đặt lại mặc định
            </button>

            <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
              Tùy chọn được lưu trên trình duyệt của bạn. Tuân thủ WCAG 2.2 AA.
            </p>
          </aside>
        </>
      )}
    </>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
      <span className="text-slate-500" aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-slate-700">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-primary' : 'bg-slate-300'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </label>
  );
}
