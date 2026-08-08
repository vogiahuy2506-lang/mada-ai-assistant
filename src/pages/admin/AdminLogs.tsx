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
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              Nhật ký Hệ thống
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Theo dõi real-time các sự kiện, lỗi và cảnh báo từ toàn bộ microservices của MADA AI.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        <button
          onClick={() => setLevelFilter('all')}
          className={clsx(
            'relative backdrop-blur-xl rounded-xl p-3 border-3 transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000]',
            levelFilter === 'all' 
              ? 'bg-primary text-white border-black transform rotate-0' 
              : 'bg-white/80 to-white/40 border-black transform rotate-[-0.3deg] hover:rotate-0'
          )}
        >
          <div className={clsx('w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] mb-2 mx-auto',
            levelFilter === 'all' ? 'bg-white/30' : 'bg-gray-100'
          )}>
            <span className={clsx('material-symbols-outlined text-base', levelFilter === 'all' ? 'text-white' : 'text-gray-600')} style={{ fontVariationSettings: "'FILL' 1" }}>all_inbox</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-80 text-center">TẤT CẢ</p>
          <h3 className="text-lg font-black text-center">{logs.length}</h3>
        </button>

        {DISPLAY_LEVELS.map((level) => {
          const badge = LEVEL_BADGE[level];
          const isActive = levelFilter === level;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(isActive ? 'all' : level)}
              className={clsx(
                'relative backdrop-blur-xl rounded-xl p-3 border-3 transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000]',
                isActive 
                  ? `bg-${level === 'critical' || level === 'error' ? 'red' : level}-500 text-white border-black transform rotate-0` 
                  : 'bg-white/80 to-white/40 border-black transform rotate-[0.3deg] hover:rotate-0'
              )}
            >
              <div className={clsx('w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] mb-2 mx-auto',
                isActive ? 'bg-white/30' : badge.bg
              )}>
                <span className={clsx('material-symbols-outlined text-base', isActive ? 'text-white' : badge.text)} style={{ fontVariationSettings: "'FILL' 1" }}>{badge.icon}</span>
              </div>
              <p className={clsx('text-[9px] font-bold uppercase tracking-wider mb-0.5 text-center', isActive ? 'opacity-80 text-white' : 'text-gray-500')}>{LEVEL_LABELS[level]}</p>
              <h3 className={clsx('text-lg font-black text-center', isActive ? 'text-white' : 'text-on-surface')}>{counts[level]}</h3>
            </button>
          );
        })}
      </section>

      {/* Filter & Action Row */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2">Nguồn:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 rounded-full bg-transparent text-sm font-medium focus:outline-none"
          >
            <option value="all">Tất cả nguồn</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border-2 border-black transition-all shadow-[3px_3px_0px_0px_#000]',
              autoRefresh
                ? 'bg-secondary text-white hover:shadow-[4px_4px_0px_0px_#000]'
                : 'bg-white text-on-surface hover:bg-gray-50'
            )}
          >
            <span className="material-symbols-outlined text-sm">{autoRefresh ? 'autorenew' : 'pause'}</span>
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-100 text-red-600 font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Xóa log
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong log..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/60 backdrop-blur-xl border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Log List */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        
        {loading && filtered.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 animate-pulse shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-gray-400 text-3xl">progress_activity</span>
            </div>
            <p className="text-lg font-bold text-gray-500">Đang tải nhật ký...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-6 text-gray-400 transform rotate-[-3deg] hover:rotate-0 transition-all duration-300 shadow-[8px_8px_0px_0px_#000]">
              <span className="material-symbols-outlined text-5xl">search_off</span>
            </div>
            <h4 className="text-2xl font-black text-on-surface mb-2">Không có log nào</h4>
            <p className="text-base font-medium text-on-surface-variant text-center max-w-sm">
              Không có nhật ký nào khớp với bộ lọc của bạn.
            </p>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-black/10">
            {filtered.map((log) => {
              const badge = LEVEL_BADGE[log.level];
              return (
                <div key={log.id} className="py-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border-2 border-black',
                        badge.bg, badge.text
                      )}>
                        {LEVEL_LABELS[log.level]}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant mt-2 tabular-nums">
                        {formatDate(log.timestamp)}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-on-surface tabular-nums">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                          {badge.icon}
                        </span>
                        <span className="font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">{log.source}</span>
                        {log.user && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-on-surface-variant border border-black/20">
                            {log.user}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-on-surface">{log.message}</p>
                      {log.details && (
                        <p className="font-mono text-xs text-on-surface-variant mt-2 p-2 bg-gray-50/50 rounded border border-black/10">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
