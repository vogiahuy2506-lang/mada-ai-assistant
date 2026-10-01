/**
 * AdminReports - Unified page combining Activity Logs (Audit) and Analytics tabs.
 * Merged from AdminAudit.tsx + AdminAnalytics.tsx
 */
import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/stores';
import { translations, Language } from '@/lib/translations';
import clsx from 'clsx';
import { RefreshCw, Download as FileDownload } from 'lucide-react';

// ============== SHARED TRANSLATION ==============
function useReportsTranslation() {
  const language = useLanguageStore((state) => state.language ?? 'vi') as Language;
  const t = (key: string) => {
    const typedTranslations = translations as Record<Language, Record<string, string>>;
    return typedTranslations[language]?.[key] || typedTranslations.vi?.[key] || key;
  };
  return { t, language };
}

// ============== AUDIT TAB COMPONENT ==============
const ACTION_BADGE: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  approve: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  update: 'bg-blue-100 text-blue-700 border-blue-300',
  edit: 'bg-blue-100 text-blue-700 border-blue-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
  reject: 'bg-red-100 text-red-700 border-red-300',
  login: 'bg-purple-100 text-purple-700 border-purple-300',
  logout: 'bg-slate-100 text-slate-600 border-slate-300',
  crawl: 'bg-amber-100 text-amber-700 border-amber-300',
  ingest: 'bg-amber-100 text-amber-700 border-amber-300',
  payment: 'bg-cyan-100 text-cyan-700 border-cyan-300',
};

function auditBadgeClass(action: string): string {
  for (const key in ACTION_BADGE) {
    if (action.toLowerCase().includes(key)) return ACTION_BADGE[key];
  }
  return 'bg-slate-100 text-slate-600 border-slate-300';
}

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

function AuditTab() {
  const { t, language } = useReportsTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const [logsRes] = await Promise.all([
        adminApi.getAuditLogs({ action: filterAction || undefined, user_id: filterUser || undefined, limit: 200 }),
      ]);

      const token = getAccessToken();
      if (token) {
        try {
          const actRes = await fetch('/api/admin/audit/actions', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (actRes.ok) {
            const j = await actRes.json();
            if (j.success && Array.isArray(j.data)) setActions(j.data);
          }
        } catch { /* silent */ }
      }

      if (logsRes.data) {
        setLogs(Array.isArray(logsRes.data.data) ? logsRes.data.data : []);
        setTotal(logsRes.data.total || 0);
      }
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  }, [filterAction, filterUser, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (iso: string) => {
    try {
      const locale = language === 'vi' ? 'vi-VN' : language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US';
      return new Date(iso).toLocaleString(locale);
    } catch { return iso; }
  };

  const exportCsv = () => {
    if (!logs.length) return;
    const rows = [
      ['time', 'user_id', 'action', 'target', 'details', 'ip'].join(','),
      ...logs.map((l) => [ `"${l.created_at}"`, `"${l.user_id || ''}"`, `"${l.action}"`, `"${l.target || ''}"`, `"${(l.details || '').replace(/"/g, '""')}"`, `"${l.ip_address || ''}"` ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('admin.audit.statsTotalEvents'), value: total, icon: 'list_alt', bg: 'bg-primary/20', color: 'text-primary' },
          { label: t('admin.audit.statsActionTypes'), value: actions.length, icon: 'category', bg: 'bg-green-200', color: 'text-green-600' },
          { label: t('admin.audit.statsDisplaying'), value: logs.length, icon: 'visibility', bg: 'bg-blue-200', color: 'text-blue-600' },
          { label: t('admin.audit.statsMaxLimit'), value: 200, icon: 'data_usage', bg: 'bg-purple-200', color: 'text-purple-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">filter_list</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">{t('admin.audit.filterAll')}</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <input
          type="text"
          placeholder={t('admin.audit.filterUser')}
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
        />
        <button
          onClick={exportCsv}
          className="ml-auto flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
        >
          <FileDownload className="w-4 h-4" />
          {t('admin.audit.exportCsv')}
        </button>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('admin.common.refresh')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl">receipt_long</span>
            <p className="mt-2">{t('admin.audit.noLogs')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t('admin.audit.colTime')}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t('admin.audit.colUser')}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t('admin.audit.colAction')}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t('admin.audit.colTarget')}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t('admin.audit.colIp')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.user_id}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex px-2 py-0.5 text-xs rounded-full border font-medium', auditBadgeClass(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{log.target || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3">
                        {log.details && (
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            {expandedLogId === log.id ? t('admin.audit.hideDetails') : t('admin.audit.viewDetails')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLogId === log.id && log.details && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3 text-xs text-slate-600">
                          <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono whitespace-pre-wrap">
                            {log.details}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== ANALYTICS TAB COMPONENT ==============
type TimeRange = '24h' | '7d' | '30d' | '90d';

function bytesToMB(b: number) { return (b / 1024 / 1024).toFixed(1); }
function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function PieChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          {data.map((item, i) => {
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;
            const largeArc = angle > 180 ? 1 : 0;
            const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 50 + 45 * Math.cos((currentAngle * Math.PI) / 180);
            const y2 = 50 + 45 * Math.sin((currentAngle * Math.PI) / 180);
            const path = `M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`;
            return <path key={i} d={path} fill={item.color} className="hover:opacity-80 transition-opacity" />;
          })}
          <circle cx="50" cy="50" r="20" fill="white" />
        </svg>
      </div>
      <div className="space-y-1">
        {data.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-gray-600">{item.label}</span>
            <span className="font-bold">{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [chatMetrics, setChatMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useReportsTranslation();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getAccessToken()) { if (!cancelled) setLoading(false); return; }
      try {
        const [us, an, cm] = await Promise.all([
          adminApi.getUserStats(),
          adminApi.getAnalytics(),
          adminApi.getChatMetrics(range),
        ]);
        if (cancelled) return;
        if (us.success && us.data) setUserStats(us.data);
        if (an.success && an.data) setAnalytics(an.data);
        if (cm.success && cm.data) setChatMetrics(cm.data);
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const server = analytics?.server;
  const langDist = chatMetrics?.languageDistribution || [];

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">{t('admin.analytics.timeRange')}:</span>
        {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={clsx('px-3 py-1.5 text-sm rounded-lg transition-colors', range === r ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Top stats */}
      {userStats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t('admin.analytics.totalUsers'), value: userStats.total, icon: 'group', color: 'from-blue-50 to-blue-100/50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
            { label: t('admin.analytics.activeUsers'), value: userStats.active, icon: 'circle', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
            { label: t('admin.analytics.newUsers'), value: userStats.pro, icon: 'person_add', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
            { label: t('admin.analytics.totalDocuments'), value: analytics?.kb?.totalDocuments || 0, icon: 'description', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className={clsx('bg-gradient-to-br rounded-xl border border-white/60 p-4 shadow-sm', s.color)}>
              <div className="flex items-center gap-3">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', s.iconBg)}>
                  <span className="material-symbols-outlined text-xl">{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Language distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">{t('admin.analytics.languageDistribution')}</h3>
          {langDist.length > 0 ? (
            <PieChart data={langDist.map((l: any, i: number) => ({ label: l.language || `Lang ${i+1}`, value: l.count || 0, color: ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444'][i % 5] }))} />
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">{t('admin.analytics.noData')}</p>
          )}
        </div>

        {/* Server stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">{t('admin.analytics.serverStatus')}</h3>
          {server ? (
            <div className="space-y-3">
              {[
                { label: 'Uptime', value: formatUptime(server.uptime || 0), icon: 'schedule' },
                { label: 'Memory', value: `${bytesToMB(server.memory?.heapUsed || 0)} / ${bytesToMB(server.memory?.heapTotal || 0)} MB`, icon: 'memory' },
                { label: 'Node', value: server.nodeVersion || '—', icon: 'code' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-base">{s.icon}</span>
                    {s.label}
                  </div>
                  <span className="font-mono text-slate-700">{s.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">{t('admin.analytics.noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== MAIN AdminReports PAGE ==============
export function AdminReports() {
  const { t, language } = useReportsTranslation();
  const [tab, setTab] = useState<'audit' | 'analytics'>('analytics');

  return (
    <AdminLayout
      title={tab === 'analytics' ? t('admin.topBar.analytics') : t('admin.topBar.audit')}
      subtitle={tab === 'analytics' ? t('admin.topBar.analyticsSub') : t('admin.topBar.auditSub')}
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-white to-violet-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {t('admin.topBar.analytics')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {t('admin.topBar.analyticsSub')}
            </p>
          </div>
        </div>
      </section>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('analytics')}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === 'analytics' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700')}
        >
          <span className="material-symbols-outlined text-base">analytics</span>
          {t('admin.analytics.tab')}
        </button>
        <button
          onClick={() => setTab('audit')}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === 'audit' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700')}
        >
          <span className="material-symbols-outlined text-base">history_edu</span>
          {t('admin.audit.tab')}
        </button>
      </div>

      {tab === 'audit' ? <AuditTab /> : <AnalyticsTab />}
    </AdminLayout>
  );
}

export default AdminReports;
