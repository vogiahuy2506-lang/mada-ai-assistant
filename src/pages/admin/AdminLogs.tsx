import { useState, useMemo, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, AdminLog } from './adminApi';
import clsx from 'clsx';

type LogLevel = AdminLog['level'] | 'critical';
type DisplayLevel = LogLevel | 'all';

const LEVEL_BADGE: Record<LogLevel, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-error', text: 'text-white', icon: 'crisis_alert' },
  error: { bg: 'bg-error/10', text: 'text-error', icon: 'error' },
  warn: { bg: 'bg-tertiary/10', text: 'text-tertiary', icon: 'warning' },
  info: { bg: 'bg-primary/10', text: 'text-primary', icon: 'info' },
  success: { bg: 'bg-secondary/10', text: 'text-secondary', icon: 'check_circle' },
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  critical: 'Critical',
  error: 'Error',
  warn: 'Warning',
  info: 'Info',
  success: 'Success',
};

const DISPLAY_LEVELS: LogLevel[] = ['critical', 'error', 'warn', 'info', 'success'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour12: false });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<DisplayLevel>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    const params: { level?: string; source?: string } = {};
    if (levelFilter !== 'all') params.level = levelFilter;
    if (sourceFilter !== 'all') params.source = sourceFilter;
    const q = new URLSearchParams(params as any).toString();
    const res = await adminApi.getLogs(q);
    if (res.success && res.data) {
      setLogs(res.data.logs);
      setLoading(false);
    }
  }, [levelFilter, sourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void fetchLogs(); }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    adminApi.getLogs().then((res) => {
      if (res.success && res.data) {
        const set = new Set(res.data.logs.map((l) => l.source));
        setSources(Array.from(set));
      }
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        (l.user ?? '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const counts = useMemo(() => {
    const acc: Record<LogLevel, number> = { critical: 0, error: 0, warn: 0, info: 0, success: 0 };
    logs.forEach((l) => acc[l.level]++);
    return acc;
  }, [logs]);

  const handleClear = async () => {
    if (!confirm('Xóa toàn bộ nhật ký?')) return;
    const res = await fetch('/api/admin/logs', { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('mada-auth') ? JSON.parse(localStorage.getItem('mada-auth')!).accessToken || '' : ''}` } });
    if (res.ok) fetchLogs();
  };

  return (
    <AdminLayout
      title="Nhật ký Hệ thống"
      subtitle="Theo dõi real-time các sự kiện, lỗi và cảnh báo từ toàn bộ microservices của MADA AI."
    >
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {DISPLAY_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
            className={clsx(
              'backdrop-blur-xl bg-white/70 border p-4 rounded-2xl text-left transition-all shadow-[0_4px_12px_rgba(0,0,0,0.03)]',
              levelFilter === level ? `${LEVEL_BADGE[level].bg} ${LEVEL_BADGE[level].text} border-current` : 'border-white/40'
            )}
          >
            <span className={clsx('material-symbols-outlined mb-2', LEVEL_BADGE[level].text)}>
              {LEVEL_BADGE[level].icon}
            </span>
            <p className="font-display-lg text-2xl font-bold tabular-nums">{counts[level]}</p>
            <p className="font-label-sm opacity-80">{LEVEL_LABELS[level]}</p>
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-4 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong log..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Mọi nguồn</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-label-md transition-all',
            autoRefresh
              ? 'bg-secondary/10 text-secondary border border-secondary/30'
              : 'bg-surface-container-low border border-outline-variant/30 text-on-surface-variant'
          )}
        >
          <span className="material-symbols-outlined text-[18px]">
            {autoRefresh ? 'autorenew' : 'pause'}
          </span>
          {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
        </button>

        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 text-error border border-error/20 hover:bg-error/20 font-label-md transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          Xóa log
        </button>
      </div>

      {/* LOG LIST */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="divide-y divide-outline-variant/20">
          {filtered.map((log) => {
            const badge = LEVEL_BADGE[log.level];
            return (
              <div key={log.id} className="p-5 hover:bg-surface-container-low/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        badge.bg,
                        badge.text
                      )}
                    >
                      {LEVEL_LABELS[log.level]}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant mt-1.5 tabular-nums">
                      {formatDate(log.timestamp)}
                    </span>
                    <span className="font-mono text-[11px] text-on-surface font-bold tabular-nums">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                        {badge.icon}
                      </span>
                      <span className="font-label-md font-mono text-primary">{log.source}</span>
                      {log.user && (
                        <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-mono text-on-surface-variant">
                          {log.user}
                        </span>
                      )}
                    </div>
                    <p className="font-label-md text-on-surface">{log.message}</p>
                    {log.details && (
                      <p className="font-label-sm text-on-surface-variant mt-1 font-mono">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loading && filtered.length === 0 && (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-40 animate-spin">progress_activity</span>
            <p className="mt-2 font-label-md">Đang tải nhật ký...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-40">search_off</span>
            <p className="mt-2 font-label-md">Không có log nào khớp bộ lọc</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
