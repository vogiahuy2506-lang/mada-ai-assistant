// ============== Agent Config Modal ==============
// Config: model, system prompt, mada category, RAG, capabilities.

import React, { useState, useEffect } from 'react';
import { Modal, FieldGroup, BtnPrimary, BtnSecondary, StatusBadge } from './ModalBase';
import type { AgentConfigSection, ChatbotConfig, SaveHandler } from '../types';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gpt-4o-mini',
  'gpt-4o',
  'claude-3.5-sonnet',
];

const AT_CATEGORIES = [
  { value: 'vision', label: '👁️ Vision / Thị giác' },
  { value: 'hearing', label: '👂 Hearing / Thính giác' },
  { value: 'mobility', label: '🦽 Mobility / Vận động' },
  { value: 'cognition', label: '🧠 Cognition / Nhận thức' },
  { value: 'communication', label: '💬 Communication / Giao tiếp' },
  { value: 'daily_living', label: '🏠 Daily Living / Sinh hoạt' },
  { value: 'education', label: '📚 Education / Giáo dục' },
  { value: 'general', label: '🔰 General / Tổng quát' },
];

const CAPABILITIES = [
  { id: 'rag', label: '📚 RAG – Tra cứu tri thức nội bộ' },
  { id: 'web_search', label: '🌐 Web Search – Tìm kiếm internet' },
  { id: 'calculator', label: '🔢 Calculator – Tính toán số học' },
  { id: 'file_reader', label: '📄 File Reader – Đọc tệp đính kèm' },
  { id: 'translation', label: '🌍 Translation – Dịch thuật đa ngôn ngữ' },
  { id: 'image_analysis', label: '🖼️ Image Analysis – Phân tích hình ảnh' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  config: ChatbotConfig;
  onSave: SaveHandler;
}

export function AgentConfigModal({ open, onClose, config, onSave }: Props) {
  const [draft, setDraft] = useState<AgentConfigSection>(config.agent);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(config.agent); }, [open, config.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...config, agent: draft });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const toggleCap = (id: string) =>
    setDraft((d) => ({
      ...d,
      capabilities: d.capabilities.includes(id)
        ? d.capabilities.filter((c) => c !== id)
        : [...d.capabilities, id],
    }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="⚙️ Cấu hình Agent"
      subtitle={`${config.name} — Agent settings`}
      size="lg"
      footer={
        <>
          <BtnSecondary onClick={onClose}>Huỷ</BtnSecondary>
          <BtnPrimary onClick={handleSave} loading={saving}>Lưu thay đổi</BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        {/* Model */}
        <FieldGroup label="Model AI" description="Model dùng để sinh câu trả lời.">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          >
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </FieldGroup>

        {/* Category */}
        <FieldGroup label="MADA Category" description="Chọn loại khuyết tật mà agent hỗ trợ. Agent sẽ kế thừa KB tương ứng.">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={draft.madaCategory ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, madaCategory: e.target.value as any || undefined }))}
          >
            <option value="">— Không chọn —</option>
            {AT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FieldGroup>

        {/* System Prompt */}
        <FieldGroup
          label="System Prompt"
          description="Hướng dẫn cách agent trả lời. Dùng placeholder {language} để tự động chuyển ngôn ngữ."
        >
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px]"
            value={draft.systemPrompt}
            onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
            placeholder="Ví dụ: Bạn là MADA AI, trợ lý chuyên gia về công nghệ hỗ trợ người khuyết tật..."
          />
        </FieldGroup>

        {/* Capabilities */}
        <FieldGroup label="Capabilities / Tools" description="Chọn tools mà agent được phép sử dụng.">
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map((cap) => (
              <label
                key={cap.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  draft.capabilities.includes(cap.id)
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-blue-600 w-4 h-4"
                  checked={draft.capabilities.includes(cap.id)}
                  onChange={() => toggleCap(cap.id)}
                />
                {cap.label}
              </label>
            ))}
          </div>
        </FieldGroup>

        {/* RAG / Knowledge */}
        <FieldGroup label="Knowledge URL" description="URL trỏ tới nguồn tri thức bổ sung (tài liệu, database…). Để trống = không dùng.">
          <input
            type="url"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={draft.knowledgeUrl ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, knowledgeUrl: e.target.value || undefined }))}
            placeholder="https://..."
          />
        </FieldGroup>

        {/* Prompt ID */}
        <FieldGroup label="Prompt Template ID" description="Liên kết tới prompt template đã lưu. Để trống = dùng system prompt trên.">
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={draft.promptId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, promptId: e.target.value || undefined }))}
            placeholder="prompt_xxx"
          />
        </FieldGroup>
      </div>
    </Modal>
  );
}
