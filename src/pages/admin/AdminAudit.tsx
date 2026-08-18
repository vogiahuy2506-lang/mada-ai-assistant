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
        if (actRes.ok) {
          const j = await actRes.json();
          if (j.success && Array.isArray(j.data)) setActions(j.data);
        }
      } catch { /* ignore */ }

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
    { label: isEn ? 'TOTAL LOGS' : 'TỔNG LOG', value: total, color: 'from-primary/10 to-primary/5', iconColor: 'text-primary', icon: 'list_alt', iconBg: 'bg-primary/20' },
    { label: isEn ? 'DISTINCT ACTIONS' : 'HÀNH ĐỘNG', value: actions.length, color: 'from-green-50/80 to-green-100/40', iconColor: 'text-green-600', icon: 'category', iconBg: 'bg-green-200' },
    { label: isEn ? 'DISPLAYING' : 'ĐANG HIỂN THỊ', value: logs.length, color: 'from-blue-50/80 to-blue-100/40', iconColor: 'text-blue-600', icon: 'visibility', iconBg: 'bg-blue-200' },
    { label: isEn ? 'MAX LIMIT' : 'GIỚI HẠN', value: 200, color: 'from-purple-50/80 to-purple-100/40', iconColor: 'text-purple-600', icon: 'data_usage', iconBg: 'bg-purple-200' },
  ];

  return (
    <AdminLayout
      title={isEn ? 'Audit Logs' : 'Audit Logs'}
      titleEn="Audit Logs"
      subtitle={isEn ? 'Track every admin action across the MADA AI system.' : 'Truy vết toàn bộ thao tác của admin trong hệ thống MADA AI.'}
      subtitleEn="Track every admin action across the MADA AI system."
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-white to-blue-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {isEn ? 'Audit Logs' : 'Audit Logs'}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-purple-500 pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {isEn
                ? 'Every admin action (login, CRUD, crawl, ingest, approval, payment) is recorded in the audit_logs table.'
                : 'Mọi thao tác admin (login, CRUD, crawl, ingest, approval, payment) đều được ghi lại tại bảng audit_logs.'}
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

      {/* Logs Table */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 mb-3 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>history_edu</span>
            <p className="text-sm text-on-surface-variant mt-2">
              {isEn ? 'No audit logs yet. Try logging in or performing CRUD actions.' : 'Chưa có audit log nào. Thử tạo thao tác (login, CRUD product, etc.)'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-purple-500/5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b-2 border-black/10">
                <tr>
                  <th className="px-5 py-3">{isEn ? 'Time' : 'Thời gian'}</th>
                  <th className="px-5 py-3">{isEn ? 'User' : 'User'}</th>
                  <th className="px-5 py-3">{isEn ? 'Action' : 'Hành động'}</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-purple-500/5 transition-colors">
                    <td className="px-5 py-3 text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-on-surface font-medium">
                        <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                        {formatDate(log.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                          <UserIcon className="w-3 h-3" />
                        </div>
                        <span className="font-mono text-on-surface">{log.user_id || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border-2',
                        badgeClass(log.action)
                      )}>
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {log.action.includes('delete') || log.action.includes('reject') ? 'cancel' :
                           log.action.includes('create') || log.action.includes('approve') ? 'check_circle' :
                           log.action.includes('update') || log.action.includes('edit') ? 'edit' :
                           log.action.includes('login') ? 'login' :
                           log.action.includes('crawl') || log.action.includes('ingest') ? 'cloud_download' :
                           'bolt'}
                        </span>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-on-surface-variant max-w-xs truncate">
                      {log.target || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant max-w-md">
                      {log.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-purple-600 hover:text-purple-700 font-bold hover:underline inline-flex items-center gap-1">
                            {isEn ? 'view JSON' : 'xem JSON'}
                          </summary>
                          <pre className="mt-2 text-[10px] bg-slate-50 border border-slate-200 p-3 rounded-lg overflow-x-auto font-mono">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(log.details), null, 2); }
                              catch { return log.details; }
                            })()}
                          </pre>
                        </details>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-on-surface-variant">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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