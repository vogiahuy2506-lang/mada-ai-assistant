import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { RefreshCw, Search, User as UserIcon, Clock, Download as FileDownload, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_BADGE: Record<string, string> = {
  // CRUD
  create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  approve: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  update: 'bg-blue-100 text-blue-700 border-blue-300',
  edit: 'bg-blue-100 text-blue-700 border-blue-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
  reject: 'bg-red-100 text-red-700 border-red-300',
  // System
  login: 'bg-purple-100 text-purple-700 border-purple-300',
  logout: 'bg-slate-100 text-slate-600 border-slate-300',
  crawl: 'bg-amber-100 text-amber-700 border-amber-300',
  ingest: 'bg-amber-100 text-amber-700 border-amber-300',
  payment: 'bg-cyan-100 text-cyan-700 border-cyan-300',
};

function badgeClass(action: string): string {
  for (const key in ACTION_BADGE) {
    if (action.toLowerCase().includes(key)) return ACTION_BADGE[key];
  }
  return 'bg-slate-100 text-slate-600 border-slate-300';
}

export function AdminAudit() {
  const { language } = useLanguageStore();
  const isEn = language === 'en';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes] = await Promise.all([
        adminApi.getAuditLogs({
          action: filterAction || undefined,
          user_id: filterUser || undefined,
          limit: 200,
        }),
      ]);

      try {
        const actRes = await fetch('/api/admin/audit/actions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('mada-auth') ? JSON.parse(localStorage.getItem('mada-auth')!).accessToken || '' : ''}` },
        });
        if (actRes.status === 401 || actRes.status === 403) {
          // Auth required or forbidden — silently skip action filter
        } else if (actRes.ok) {
          const j = await actRes.json();
          if (j.success && Array.isArray(j.data)) setActions(j.data);
        }
      } catch { /* ignore network/server errors */ }

      if (logsRes.data) {
        setLogs(Array.isArray(logsRes.data.data) ? logsRes.data.data : []);
        setTotal(logsRes.data.total || 0);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUser]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (iso: string): string => {
    try { return new Date(iso).toLocaleString(isEn ? 'en-US' : 'vi-VN'); } catch { return iso; }
  };

  const exportCsv = () => {
    if (!logs.length) return;
    const rows = [
      ['time', 'user_id', 'action', 'target', 'details', 'ip'].join(','),
      ...logs.map((l) => [
        `"${l.created_at}"`,
        `"${l.user_id || ''}"`,
        `"${l.action}"`,
        `"${l.target || ''}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.ip_address || ''}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: isEn ? 'TOTAL EVENTS' : 'TỔNG SỰ KIỆN', value: total, color: 'from-primary/10 to-primary/5', iconColor: 'text-primary', icon: 'list_alt', iconBg: 'bg-primary/20' },
    { label: isEn ? 'ACTION TYPES' : 'LOẠI HÀNH ĐỘNG', value: actions.length, color: 'from-green-50/80 to-green-100/40', iconColor: 'text-green-600', icon: 'category', iconBg: 'bg-green-200' },
    { label: isEn ? 'DISPLAYING' : 'ĐANG HIỂN THỊ', value: logs.length, color: 'from-blue-50/80 to-blue-100/40', iconColor: 'text-blue-600', icon: 'visibility', iconBg: 'bg-blue-200' },
    { label: isEn ? 'MAX LIMIT' : 'GIỚI HẠN', value: 200, color: 'from-purple-50/80 to-purple-100/40', iconColor: 'text-purple-600', icon: 'data_usage', iconBg: 'bg-purple-200' },
  ];

  return (
    <AdminLayout
      title={isEn ? 'Activity Logs' : 'Nhật ký Hoạt động'}
      titleEn="Activity Logs"
      subtitle={isEn ? 'Track every user & admin action across the MADA AI system.' : 'Truy vết mọi hành vi của người dùng & admin trong hệ thống MADA AI.'}
      subtitleEn="Track every user & admin action across the MADA AI system."
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-white to-blue-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {isEn ? 'Activity Logs' : 'Nhật ký Hoạt động'}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-purple-500 pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {isEn
                ? 'Every user & admin action (login, CRUD, crawl, ingest, approval, payment) is recorded — track behaviour, audit changes, and investigate violations.'
                : 'Mọi hành vi của người dùng & admin (đăng nhập, CRUD, crawl, ingest, duyệt, thanh toán) đều được ghi lại — theo dõi hành vi, truy vết thay đổi và điều tra vi phạm.'}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={clsx(
              'relative bg-gradient-to-br backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 transition-shadow hover:shadow-[8px_8px_0px_0px_#000]',
              s.color,
              i % 2 === 0 ? 'transform rotate-[-0.3deg] hover:rotate-0' : 'transform rotate-[0.3deg] hover:rotate-0',
              'shadow-[6px_6px_0px_0px_#000]'
            )}
          >
            <div className={clsx('w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]', s.iconBg)}>
              <span className={clsx('material-symbols-outlined text-lg', s.iconColor)} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
              <h3 className="text-xl font-black text-on-surface">{s.value}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* Filter & Action Row */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2 flex items-center gap-1">
            <Filter className="w-4 h-4" />
            {isEn ? 'Filter:' : 'Lọc:'}
          </span>
          <button
            onClick={() => { setFilterAction(''); setFilterUser(''); }}
            disabled={loading}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              !filterAction && !filterUser
                ? 'bg-purple-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-white/80 border-transparent hover:border-black transition-colors'
            )}
          >
            {isEn ? 'All' : 'Tất cả'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              placeholder={isEn ? 'User ID...' : 'User ID...'}
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-full border-2 border-black bg-white/60 backdrop-blur-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 w-56"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="h-10 px-4 rounded-full border-2 border-black bg-white/60 backdrop-blur-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium"
          >
            <option value="">{isEn ? 'All actions' : 'Tất cả actions'}</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-xl border-2 border-black font-bold text-sm hover:bg-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            <span>{isEn ? 'Refresh' : 'Làm mới'}</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={!logs.length}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-500 text-white border-2 border-black font-bold text-sm hover:bg-purple-600 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-40"
          >
            <FileDownload className="w-4 h-4" />
            <span>{isEn ? 'Export CSV' : 'Xuất CSV'}</span>
          </button>
        </div>
      </div>

      {/* Logs List */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl pointer-events-none"></div>

        {loading ? (
          <div className="relative z-10 p-16 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="relative z-10 p-16 text-center">
            <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 mb-3 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>history_edu</span>
            <p className="text-sm text-on-surface-variant mt-2">
              {isEn ? 'No activity logs yet. Try logging in or performing CRUD actions.' : 'Chưa có nhật ký hoạt động nào. Thử tạo thao tác (login, CRUD product, etc.)'}
            </p>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-black/10">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="py-4 px-6 hover:bg-purple-500/5 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Action badge */}
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border-2 shrink-0',
                      badgeClass(log.action)
                    )}>
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {log.action.includes('delete') || log.action.includes('reject') ? 'cancel' :
                         log.action.includes('create') || log.action.includes('approve') ? 'check_circle' :
                         log.action.includes('update') || log.action.includes('edit') ? 'edit' :
                         log.action.includes('login') ? 'login' :
                         log.action.includes('logout') ? 'logout' :
                         log.action.includes('crawl') || log.action.includes('ingest') ? 'cloud_download' :
                         log.action.includes('payment') ? 'payments' :
                         'bolt'}
                      </span>
                      {log.action}
                    </span>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs font-bold tabular-nums">{formatDate(log.created_at)}</span>
                        </div>
                        {log.user_id && (
                          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                              <UserIcon className="w-2.5 h-2.5" />
                            </div>
                            <span className="font-mono">{log.user_id}</span>
                          </span>
                        )}
                        {log.target && (
                          <span className="font-mono text-xs text-on-surface-variant bg-gray-100 px-2 py-0.5 rounded border border-black/10 truncate max-w-xs">
                            {log.target}
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-on-surface-variant font-mono truncate">
                          {log.details.replace(/\s+/g, ' ').slice(0, 200)}
                        </p>
                      )}
                    </div>

                    {/* Detail toggle */}
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className={clsx(
                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black transition-all',
                        isExpanded
                          ? 'bg-purple-500 text-white shadow-[2px_2px_0px_0px_#000]'
                          : 'bg-white text-on-surface hover:bg-purple-500/10 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000]'
                      )}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                      {isExpanded ? (isEn ? 'Close' : 'Thu gọn') : (isEn ? 'Details' : 'Chi tiết')}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-[1px] bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-black p-5 shadow-[4px_4px_0px_0px_#000]">
                      {/* Summary grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        <div className="bg-white rounded-lg border border-black/10 p-3">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">ID</p>
                          <p className="font-mono text-xs font-bold text-on-surface truncate">{log.id}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-black/10 p-3">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">{isEn ? 'User' : 'User'}</p>
                          <p className="font-mono text-xs font-bold text-on-surface truncate">{log.user_id || '—'}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-black/10 p-3">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">{isEn ? 'Action' : 'Hành động'}</p>
                          <p className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', badgeClass(log.action))}>
                            {log.action}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg border border-black/10 p-3">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">IP Address</p>
                          <p className="font-mono text-xs font-bold text-on-surface">{log.ip_address || '—'}</p>
                        </div>
                      </div>

                      {/* Target */}
                      {log.target && (
                        <div className="mb-4">
                          <h5 className="text-xs font-black uppercase tracking-wider text-on-surface mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">target</span>
                            {isEn ? 'Target / Resource' : 'Đối tượng'}
                          </h5>
                          <div className="bg-white rounded-lg border border-black/10 p-3 font-mono text-xs text-on-surface break-all">
                            {log.target}
                          </div>
                        </div>
                      )}

                      {/* User-Agent */}
                      {log.user_agent && (
                        <div className="mb-4">
                          <h5 className="text-xs font-black uppercase tracking-wider text-on-surface mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">devices</span>
                            {isEn ? 'User Agent (Browser / Device)' : 'Thiết bị / Trình duyệt'}
                          </h5>
                          <div className="bg-white rounded-lg border border-black/10 p-3 font-mono text-[11px] text-on-surface-variant break-all">
                            {log.user_agent}
                          </div>
                        </div>
                      )}

                      {/* Raw details JSON */}
                      {log.details && (
                        <div>
                          <h5 className="text-xs font-black uppercase tracking-wider text-on-surface mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">data_object</span>
                            {isEn ? 'Change Payload (JSON)' : 'Dữ liệu thay đổi (JSON)'}
                          </h5>
                          <pre className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-emerald-300 break-all whitespace-pre-wrap border-2 border-black overflow-x-auto">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(log.details), null, 2); }
                              catch { return log.details; }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Info Card */}
      <div className="mt-8 relative bg-gradient-to-br from-blue-50/80 to-cyan-50/40 backdrop-blur-xl rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-5 flex gap-4 items-start">
        <div className="w-12 h-12 rounded-xl bg-blue-100 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] shrink-0">
          <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
        </div>
        <div className="text-sm text-blue-900">
          <p className="font-bold mb-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
            {isEn ? 'How Audit Logs Work' : 'Cách hoạt động của Audit Logs'}
          </p>
          <p className="leading-relaxed">
            {isEn ? (
              <>Logs are auto-generated by <code className="px-1.5 py-0.5 bg-white/60 rounded font-mono text-xs border border-blue-200">db.prepare('INSERT INTO audit_logs...')</code> in each admin route. See code in <code className="px-1.5 py-0.5 bg-white/60 rounded font-mono text-xs border border-blue-200">server/routes/</code>.</>
            ) : (
              <>Logs được tạo tự động bởi <code className="px-1.5 py-0.5 bg-white/60 rounded font-mono text-xs border border-blue-200">db.prepare('INSERT INTO audit_logs...')</code> ở các route admin. Xem code chi tiết trong <code className="px-1.5 py-0.5 bg-white/60 rounded font-mono text-xs border border-blue-200">server/routes/</code>.</>
            )}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAudit;