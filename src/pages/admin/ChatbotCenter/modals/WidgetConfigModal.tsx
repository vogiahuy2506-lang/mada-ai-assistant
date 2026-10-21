// ============== Widget Config Modal ==============
// Config: position, theme, border-radius, bubble avatar, language.
//
// Bước 3 — khi agent CHƯA override widget config (cfg.widget undefined)
// thì hiển thị defaults + badge "🟢 dùng global". Một khi user sửa bất kỳ
// field nào thì đánh dấu "🟡 đã override" và lưu thành JSON blob trong DB.
// Nút "↩️ Reset về global" ở footer cho phép unset (ghi undefined → xoá khỏi DB).

import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, FieldGroup, BtnPrimary, BtnSecondary } from './ModalBase';
import type { ChatbotConfig, SaveHandler, LanguageCode, WidgetConfigSection } from '../types';

const POSITIONS = [
  { value: 'bottom-right', label: '🔽 Bottom Right (góc dưới phải)' },
  { value: 'bottom-left', label: '🔽 Bottom Left (góc dưới trái)' },
  { value: 'top-right', label: '🔼 Top Right (góc trên phải)' },
  { value: 'top-left', label: '🔼 Top Left (góc trên trái)' },
];

const THEMES = [
  { value: 'mada-blue', label: '🔵 MADA Blue', swatch: '#0058be' },
  { value: 'soft-green', label: '🟢 Soft Green', swatch: '#22c55e' },
  { value: 'warm-amber', label: '🟡 Warm Amber', swatch: '#f59e0b' },
  { value: 'neutral-gray', label: '⚪ Neutral Gray', swatch: '#6b7280' },
];

const LANGUAGES: { value: LanguageCode; label: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  config: ChatbotConfig;
  onSave: SaveHandler;
}

function toggleLanguage(arr: LanguageCode[], lang: LanguageCode): LanguageCode[] {
  return arr.includes(lang) ? arr.filter((l) => l !== lang) : [...arr, lang];
}

// Defaults hardcoded — đây là fallback khi DB trả `widget_config = NULL`
// và `cfg.widget` undefined. Chỗ "🟢 dùng global" hiển thị khi mở modal.
const GLOBAL_WIDGET_DEFAULTS: WidgetConfigSection = {
  position: 'bottom-right',
  theme: 'mada-blue',
  borderRadius: 12,
  showBubbleAvatar: true,
  defaultLanguage: 'vi',
  enabledLanguages: ['vi', 'en'],
};

export function WidgetConfigModal({ open, onClose, config, onSave }: Props) {
  // Phân biệt chính xác: undefined = "chưa override", object = "đã lưu riêng".
  // Lần đầu mở modal, modal sẽ hiển thị cfg.widget ?? defaults nhưng KHÔNG
  // ghi vào DB cho tới khi user sửa + bấm Lưu.
  const hasOverride = config.widget !== undefined;
  const initial = config.widget ?? GLOBAL_WIDGET_DEFAULTS;
  const [draft, setDraft] = useState<WidgetConfigSection>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config.widget ?? GLOBAL_WIDGET_DEFAULTS);
  }, [open, config.id, config.widget]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Vì user vừa sửa, ta coi như đã override — ghi draft vào DB.
      // Kể cả khi draft giống hệt defaults vẫn lưu; vì user đã chủ động mở modal và lưu.
      await onSave({ ...config, widget: draft });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Reset về global: set widget = undefined → adapter sẽ thấy savedWidget undefined
  // → chatbotToAgent xuất ra `widgetConfig: undefined` → server PATCH với key không có
  // → cột DB giữ nguyên giá trị hiện tại. Cần DB migration để set NULL,
  // nhưng cách an toàn nhất là ghi rõ `widget_config: null`.
  // (chatbotToAgent đã sẵn sàng: cfg.widget === undefined → undefined → store ghi không truyền field
  // → server bỏ qua → cột DB giữ nguyên; ta cần server hiểu undefined = NULL).
  // Cách nhanh nhất: xử lý ngay tại adapter và store — khi widget = undefined, ghi rõ `null`.
  const handleResetToGlobal = async () => {
    setSaving(true);
    try {
      await onSave({ ...config, widget: undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedTheme = THEMES.find((t) => t.value === draft.theme) ?? THEMES[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🖼️ Cấu hình Widget"
      subtitle={`${config.name} — Widget appearance & behavior`}
      size="lg"
      footer={
        <>
          {hasOverride ? (
            <button
              type="button"
              onClick={handleResetToGlobal}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors mr-auto"
              title="Xoá override riêng — widget sẽ trở về global"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset về global
            </button>
          ) : (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mr-auto inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đang dùng cấu hình global — bấm Lưu để ghi đè cho riêng bot này
            </span>
          )}
          <BtnSecondary onClick={onClose}>Huỷ</BtnSecondary>
          <BtnPrimary onClick={handleSave} loading={saving}>Lưu thay đổi</BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        {/* Inline status */}
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {hasOverride
            ? '🟡 Bot này đang có cấu hình widget riêng. Các thay đổi chỉ ảnh hưởng đến bot này.'
            : '🟢 Bot này chưa có cấu hình widget riêng — đang kế thừa từ cấu hình global.'}
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1 font-medium">Preview</p>
            <div
              className="inline-flex items-center gap-2 px-3 py-2 text-white text-xs font-medium rounded-xl shadow"
              style={{ backgroundColor: selectedTheme.swatch }}
            >
              <span>{config.avatar || '🤖'}</span>
              <span>{config.name}</span>
            </div>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow"
            style={{ backgroundColor: selectedTheme.swatch }}
          >
            🤖
          </div>
        </div>

        {/* Position */}
        <FieldGroup label="Vị trí trên trang" description="Nơi widget xuất hiện so với viewport của host page.">
          <div className="grid grid-cols-2 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                  draft.position === p.value
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
                onClick={() => setDraft((d) => ({ ...d, position: p.value as any }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Theme */}
        <FieldGroup label="Màu sắc widget" description="Palette áp dụng cho bubble, button và một số accent.">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                  draft.theme === t.value
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
                onClick={() => setDraft((d) => ({ ...d, theme: t.value as any }))}
              >
                <span
                  className="w-5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Border radius */}
        <FieldGroup label="Border Radius" description={`Bo góc widget (px). Hiện tại: ${draft.borderRadius}px.`}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={24}
              value={draft.borderRadius}
              onChange={(e) => setDraft((d) => ({ ...d, borderRadius: Number(e.target.value) }))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono text-gray-500 w-12 text-right">{draft.borderRadius}px</span>
          </div>
        </FieldGroup>

        {/* Bubble avatar */}
        <FieldGroup label="Hiện avatar" description="Bật = hiện avatar trong chat bubble. Tắt = chỉ hiện text.">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${draft.showBubbleAvatar ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => setDraft((d) => ({ ...d, showBubbleAvatar: !d.showBubbleAvatar }))}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  draft.showBubbleAvatar ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm text-gray-600">
              {draft.showBubbleAvatar ? '✓ Đang bật' : '✗ Đang tắt'}
            </span>
          </label>
        </FieldGroup>

        {/* Languages */}
        <FieldGroup label="Ngôn ngữ mặc định" description="Ngôn ngữ mặc định khi visitor mở widget.">
          <div className="flex gap-2 flex-wrap">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
                  draft.defaultLanguage === l.value
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
                onClick={() => setDraft((d) => ({ ...d, defaultLanguage: l.value }))}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Ngôn ngữ bật trong widget" description="Visitor chỉ thấy các ngôn ngữ được chọn.">
          <div className="flex gap-2 flex-wrap">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
                  draft.enabledLanguages.includes(l.value)
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-400'
                }`}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    enabledLanguages: toggleLanguage(d.enabledLanguages, l.value),
                  }))
                }
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </FieldGroup>
      </div>
    </Modal>
  );
}
