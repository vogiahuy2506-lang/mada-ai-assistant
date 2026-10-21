// ===================================================================
// ============== AI ASSISTANTS — Bot List (left rail) ==========
// ===================================================================
// Danh sách 7 bot cố định. Mỗi item: avatar, tên, domain, badge
// trạng thái (active / draft / crawl), toggle bật-tắt nhanh.

import React, { useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { FIXED_BOTS } from '../constants';
import type { StudioBot } from '../types';

interface Props {
  bots: Record<string, StudioBot>;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleActive: (id: string, next: boolean) => void;
  loading?: boolean;
}

export function BotList({ bots, selectedId, onSelect, onToggleActive, loading }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIXED_BOTS;
    return FIXED_BOTS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.domain.toLowerCase().includes(q) ||
        b.id.includes(q),
    );
  }, [query]);

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: 'var(--lin-bg-elevated)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold lin-t-primary">Trợ lý AI</h2>
            <p className="text-[11px] lin-t-quaternary mt-0.5">
              {FIXED_BOTS.length} trợ lý cố định
            </p>
          </div>
          <span
            className="lin-badge lin-badge-accent shrink-0"
            title="Danh sách cố định của hệ thống"
          >
            <Plus className="w-2.5 h-2.5" />
            Cố định
          </span>
        </div>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--lin-text-quaternary)' }}
          />
          <input
            className="lin-input pl-8"
            style={{ height: 30 }}
            placeholder="Tìm trợ lý…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto lin-scroll px-2 pb-3 min-h-0">
        {loading && (
          <div className="px-3 py-6 text-center text-[12px] lin-t-quaternary">
            Đang tải trợ lý…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px] lin-t-quaternary">
            Không tìm thấy trợ lý phù hợp.
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {filtered.map((meta) => {
            const bot = bots[meta.id];
            const isSelected = selectedId === meta.id;
            const isActive = bot?.isActive ?? false;
            const missing = !bot;

            return (
              <div key={meta.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelect(meta.id)}
                  className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md text-left transition-colors lin-focus-visible"
                  style={{
                    background: isSelected ? 'var(--lin-accent-soft)' : 'transparent',
                  }}
                >
                  {/* Avatar */}
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[15px] shrink-0"
                    style={{
                      background: isSelected
                        ? `color-mix(in srgb, ${meta.accent} 22%, transparent)`
                        : 'var(--lin-bg-sunken)',
                    }}
                  >
                    {bot?.avatarUrl ? (
                      <img
                        src={bot.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      bot?.avatar || meta.emoji
                    )}
                  </span>

                  {/* Text */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="text-[12.5px] font-medium truncate"
                        style={{
                          color: isSelected
                            ? 'var(--lin-accent)'
                            : 'var(--lin-text-primary)',
                        }}
                      >
                        {bot?.name || meta.name}
                      </span>
                      {missing && (
                        <span
                          className="lin-badge lin-badge-warning shrink-0"
                          title="Chưa có trong DB — sẽ tạo khi lưu"
                        >
                          Chưa tạo
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] lin-t-quaternary truncate mt-0.5">
                      {meta.domain}
                    </span>

                    {/* Meta row */}
                    {!missing && (
                      <span className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            background: isActive
                              ? 'var(--lin-success)'
                              : 'var(--lin-text-quaternary)',
                          }}
                        />
                        <span className="text-[10px] lin-t-quaternary">
                          {isActive ? 'Đang chạy' : 'Đã tắt'}
                        </span>
                        {bot!.lastCrawlCount > 0 && (
                          <>
                            <span className="text-[10px] lin-t-quaternary">·</span>
                            <span
                              className="text-[10px] lin-t-quaternary"
                              title={`${bot!.lastCrawlCount} chunks đã cào`}
                            >
                              {bot!.lastCrawlCount} chunks
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </button>

                {/* Quick toggle (hover) */}
                {!missing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActive(meta.id, !isActive);
                    }}
                    title={isActive ? 'Tắt trợ lý này' : 'Bật trợ lý này'}
                    aria-label={isActive ? 'Tắt trợ lý' : 'Bật trợ lý'}
                    className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity lin-btn-ghost lin-focus-visible"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--lin-success) 18%, transparent)'
                        : 'var(--lin-bg-sunken)',
                      color: isActive ? 'var(--lin-success)' : 'var(--lin-text-quaternary)',
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}