// ============== Publish Config Modal ==============
// Config: draft / published / archived, version, schedule, release notes.

import React, { useState, useEffect } from 'react';
import { Modal, FieldGroup, BtnPrimary, BtnSecondary, StatusBadge } from './ModalBase';
import type { ChatbotConfig, PublishConfigSection, SaveHandler } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  config: ChatbotConfig;
  onSave: SaveHandler;
}

const STATUS_OPTIONS: { value: PublishConfigSection['status']; label: string; desc: string }[] = [
  {
    value: 'published',
    label: '🚀 Published',
    desc: 'Đang chạy production — visitor thấy và dùng được.',
  },
  {
    value: 'draft',
    label: '📝 Draft',
    desc: 'Chỉ admin thấy — dùng để test trước khi public.',
  },
  {
    value: 'archived',
    label: '🗄️ Archived',
    desc: 'Tắt hoàn toàn — không ai thấy nữa.',
  },
];

export function PublishModal({ open, onClose, config, onSave }: Props) {
  const [draft, setDraft] = useState<PublishConfigSection>(config.publish);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(config.publish); }, [open, config.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...config, publish: draft });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🚀 Publish & Versioning"
      subtitle={`${config.name} — Quản lý trạng thái & phiên bản`}
      size="lg"
      footer={
        <>
          <BtnSecondary onClick={onClose}>Huỷ</BtnSecondary>
          <BtnPrimary onClick={handleSave} loading={saving}>Lưu thay đổi</BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        {/* Status */}
        <FieldGroup label="Trạng thái" description="Chọn trạng thái publish hiện tại.">
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  draft.status === opt.value
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="publish-status"
                  value={opt.value}
                  checked={draft.status === opt.value}
                  onChange={() => setDraft((d) => ({ ...d, status: opt.value }))}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </FieldGroup>

        {/* Version */}
        <FieldGroup
          label="Phiên bản"
          description="Mỗi lần publish thành công → tăng version. Dùng để rollback nếu cần."
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-lg flex items-center justify-center"
              onClick={() => setDraft((d) => ({ ...d, version: Math.max(1, d.version - 1) }))}
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-800 w-12 text-center">
              {draft.version}
            </span>
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-lg flex items-center justify-center"
              onClick={() => setDraft((d) => ({ ...d, version: d.version + 1 }))}
            >
              +
            </button>
            <span className="text-sm text-gray-400">v{draft.version}.x</span>
          </div>
        </FieldGroup>

        {/* Schedule */}
        <FieldGroup
          label="Lên lịch publish"
          description="Để trống = publish ngay. Điền ngày = tự động publish sau."
        >
          <input
            type="datetime-local"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={draft.scheduledAt ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                scheduledAt: e.target.value || null,
              }))
            }
          />
          {draft.scheduledAt && (
            <button
              type="button"
              className="mt-1 text-xs text-red-500 hover:underline"
              onClick={() => setDraft((d) => ({ ...d, scheduledAt: null }))}
            >
              ✕ Xoá lịch — publish ngay
            </button>
          )}
        </FieldGroup>

        {/* Release notes */}
        <FieldGroup
          label="Release notes"
          description="Ghi chú cho phiên bản này. Giúp track thay đổi giữa các lần publish."
        >
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
            value={draft.releaseNotes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, releaseNotes: e.target.value }))}
            placeholder="Ví dụ: Cập nhật system prompt, thêm category mới..."
          />
        </FieldGroup>

        {/* Summary card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tóm tắt</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.avatar}</span>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-sm">{config.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{config.description || 'Không có mô tả'}</p>
            </div>
            <StatusBadge status={draft.status} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <p className="text-lg font-bold text-gray-800">v{draft.version}</p>
              <p className="text-xs text-gray-400">Phiên bản</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <p className="text-xs font-medium text-gray-600">
                {draft.scheduledAt
                  ? new Date(draft.scheduledAt).toLocaleDateString('vi-VN')
                  : 'Ngay lập tức'}
              </p>
              <p className="text-xs text-gray-400">Publish</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <p className="text-xs font-medium text-gray-600">{config.agent.model}</p>
              <p className="text-xs text-gray-400">Model</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
