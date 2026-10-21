// ============== Behavior Config Modal ==============
// Config: guardrails, fallback, auto-suggest, rate-limit, escalation.
//
// Bước 3 — phân biệt chính xác "chưa override (kế thừa global)" với
// "đã set riêng cho bot". Modal hiển thị badge trạng thái và nút
// Reset về global.

import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, FieldGroup, BtnPrimary, BtnSecondary } from './ModalBase';
import type { BehaviorConfigSection, ChatbotConfig, SaveHandler } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  config: ChatbotConfig;
  onSave: SaveHandler;
}

// Defaults hardcoded khi backend chưa lưu config riêng.
const GLOBAL_BEHAVIOR_DEFAULTS: BehaviorConfigSection = {
  fallbackMessage: 'Xin lỗi, mình chưa có câu trả lời phù hợp. Bạn có thể mô tả rõ hơn không?',
  enableGuardrails: true,
  enableAutoSuggest: true,
  rateLimitPerMinute: 0,
  adminEscalationThreshold: 0.6,
};

export function BehaviorConfigModal({ open, onClose, config, onSave }: Props) {
  const hasOverride = config.behavior !== undefined;
  const initial: BehaviorConfigSection = config.behavior ?? GLOBAL_BEHAVIOR_DEFAULTS;
  const [draft, setDraft] = useState<BehaviorConfigSection>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config.behavior ?? GLOBAL_BEHAVIOR_DEFAULTS);
  }, [open, config.id, config.behavior]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...config, behavior: draft });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleResetToGlobal = async () => {
    setSaving(true);
    try {
      await onSave({ ...config, behavior: undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🧠 Cấu hình Hành vi"
      subtitle={`${config.name} — Fallback, guardrails, auto-suggest`}
      size="lg"
      footer={
        <>
          {hasOverride ? (
            <button
              type="button"
              onClick={handleResetToGlobal}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors mr-auto"
              title="Xoá override riêng — behavior sẽ trở về global"
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
            ? '🟡 Bot này đang có cấu hình hành vi riêng. Các thay đổi chỉ ảnh hưởng đến bot này.'
            : '🟢 Bot này chưa có cấu hình hành vi riêng — đang kế thừa từ cấu hình global.'}
        </div>

        {/* Guardrails */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <FieldGroup
            label="🛡️ Guardrails an toàn nội dung"
            description="Bật để agent từ chối trả lời câu hỏi vi phạm chính sách."
          >
            <label className="flex items-center gap-3 cursor-pointer mt-2">
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${draft.enableGuardrails ? 'bg-blue-600' : 'bg-gray-300'}`}
                onClick={() => setDraft((d) => ({ ...d, enableGuardrails: !d.enableGuardrails }))}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    draft.enableGuardrails ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {draft.enableGuardrails ? '✓ Guardrails đang bật' : '✗ Guardrails đang tắt'}
              </span>
            </label>
          </FieldGroup>

          {draft.enableGuardrails && (
            <div className="mt-3">
              <FieldGroup label="Tin nhắn từ chối" description="Tin nhắn hiển thị khi guardrail kích hoạt.">
                <textarea
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px]"
                  value={draft.refusalMessage ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, refusalMessage: e.target.value || undefined }))}
                  placeholder="Xin lỗi, mình không thể hỗ trợ nội dung này..."
                />
              </FieldGroup>
            </div>
          )}
        </div>

        {/* Fallback */}
        <FieldGroup
          label="💬 Tin nhắn fallback"
          description="Tin nhắn khi agent không tìm được câu trả lời phù hợp."
        >
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
            value={draft.fallbackMessage}
            onChange={(e) => setDraft((d) => ({ ...d, fallbackMessage: e.target.value }))}
            placeholder="Xin lỗi, mình chưa có thông tin cho câu hỏi này..."
          />
        </FieldGroup>

        {/* Auto-suggest */}
        <FieldGroup
          label="💡 Tự động gợi ý"
          description="Bật để agent gợi ý câu hỏi tiếp theo khi visitor idle."
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${draft.enableAutoSuggest ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => setDraft((d) => ({ ...d, enableAutoSuggest: !d.enableAutoSuggest }))}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  draft.enableAutoSuggest ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {draft.enableAutoSuggest ? '✓ Đang bật' : '✗ Đang tắt'}
            </span>
          </label>
        </FieldGroup>

        {/* Rate limit */}
        <FieldGroup
          label="⚡ Rate limit"
          description="Giới hạn truy vấn/phút. 0 = không giới hạn."
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={1000}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={draft.rateLimitPerMinute}
              onChange={(e) =>
                setDraft((d) => ({ ...d, rateLimitPerMinute: Math.max(0, Number(e.target.value)) }))
              }
            />
            <span className="text-sm text-gray-500">truy vấn / phút</span>
          </div>
        </FieldGroup>

        {/* Escalation */}
        <FieldGroup
          label="📞 Ngưỡng chuyển admin"
          description="Nếu confidence < ngưỡng này, tự động chuyển cho admin. 0 = không bao giờ chuyển."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(draft.adminEscalationThreshold * 100)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  adminEscalationThreshold: Number(e.target.value) / 100,
                }))
              }
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono text-gray-500 w-14 text-right">
              {Math.round(draft.adminEscalationThreshold * 100)}%
            </span>
          </div>
        </FieldGroup>
      </div>
    </Modal>
  );
}
