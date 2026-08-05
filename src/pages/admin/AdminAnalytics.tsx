import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';

type TimeRange = '24h' | '7d' | '30d' | '90d';

interface ApiAnalytics {
  kb: KnowledgeStats;
  logs: { total: number; byLevel: Record<string, number> };
  server: { uptime: number; memory: any; nodeVersion: string; platform: string };
}

function bytesToMB(b: number) {
  return (b / 1024 / 1024).toFixed(1);
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export function AdminAnalytics() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [us, an] = await Promise.all([
        adminApi.getUserStats(),
        adminApi.getAnalytics(),
      ]);
      if (us.success && us.data) setUserStats(us.data);
      if (an.success && an.data) setAnalytics(an.data);
      setLoading(false);
    };
    load();
    const id = setInterval(() => { void load(); }, 10000);
    return () => clearInterval(id);
  }, []);

  const kb = analytics?.kb;
  const logs = analytics?.logs;
  const srv = analytics?.server;

  const overviewCards = [
    {
      label: 'Tổng người dùng',
      value: userStats?.total != null ? userStats.total.toLocaleString('vi-VN') : '—',
      icon: 'group',
      color: 'primary',
      sub: `${userStats?.active ?? 0} đang hoạt động`,
    },
    {
      label: 'Tài liệu KB',
      value: kb?.totalDocuments != null ? kb.totalDocuments.toLocaleString('vi-VN') : '—',
      icon: 'description',
      color: 'secondary',
      sub: kb?.totalCategories != null ? `${kb.totalCategories} danh mục` : '—',
    },
    {
      label: 'Sự kiện log',
      value: logs?.total != null ? logs.total.toLocaleString('vi-VN') : '—',
      icon: 'list_alt',
      color: 'tertiary',
      sub: 'Tổng cộng',
    },
    {
      label: 'Uptime',
      value: srv ? formatUptime(srv.uptime) : '—',
      icon: 'bolt',
      color: 'primary',
      sub: srv?.nodeVersion || '—',
    },
  ];

  const logLevelBars = [
    { level: 'info', count: logs?.byLevel.info || 0, color: 'bg-primary' },
    { level: 'success', count: logs?.byLevel.success || 0, color: 'bg-secondary' },
    { level: 'warn', count: logs?.byLevel.warn || 0, color: 'bg-tertiary' },
    { level: 'error', count: logs?.byLevel.error || 0, color: 'bg-error' },
  ];
  const maxLog = Math.max(...logLevelBars.map((l) => l.count), 1);

  return (
    <AdminLayout
      title="Phân tích Hệ thống"
      subtitle="Báo cáo chi tiết về lưu lượng, hành vi người dùng và hiệu suất của MADA AI."
    >
      {/* TIME RANGE */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-2 rounded-2xl inline-flex gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-5 py-2 rounded-xl font-label-md transition-all ${
              range === r
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {r === '24h' ? '24 giờ' : r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '90 ngày'}
          </button>
        ))}
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewCards.map((s) => (
          <div
            key={s.label}
            className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-3xl transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-${s.color}/10 flex items-center justify-center text-${s.color}`}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
            </div>
            <h3 className="font-label-md text-on-surface-variant">{s.label}</h3>
            <p className="font-display-lg text-headline-lg font-bold mt-1">{loading ? '...' : s.value}</p>
            <p className="font-label-sm text-on-surface-variant mt-2">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* TWO COLUMN: LOG ACTIVITY + SERVER INFO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Log activity */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="font-headline-md text-on-surface mb-6">Phân bổ hoạt động log</h3>
          {loading ? (
            <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="space-y-4">
              {logLevelBars.map((b) => (
                <div key={b.level}>
                  <div className="flex justify-between font-label-sm mb-1">
                    <span className="capitalize">{b.level}</span>
                    <span className="font-bold">{b.count}</span>
                  </div>
                  <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full ${b.color} transition-all`}
                      style={{ width: `${(b.count / maxLog) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server info */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="font-headline-md text-on-surface mb-6">Thông tin server</h3>
          {loading || !srv ? (
            <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-surface-container/50 rounded-xl">
                <span className="font-label-md text-on-surface-variant">Node version</span>
                <span className="font-mono font-bold">{srv.nodeVersion}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-container/50 rounded-xl">
                <span className="font-label-md text-on-surface-variant">Platform</span>
                <span className="font-mono font-bold">{srv.platform}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-container/50 rounded-xl">
                <span className="font-label-md text-on-surface-variant">Uptime</span>
                <span className="font-mono font-bold">{formatUptime(srv.uptime)}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-container/50 rounded-xl">
                <span className="font-label-md text-on-surface-variant">Memory (RSS)</span>
                <span className="font-mono font-bold">{bytesToMB(srv.memory.rss)} MB</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-container/50 rounded-xl">
                <span className="font-label-md text-on-surface-variant">Heap used</span>
                <span className="font-mono font-bold">{bytesToMB(srv.memory.heapUsed)} MB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USER BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="font-headline-md text-on-surface mb-6">Thống kê người dùng</h3>
          {loading || !userStats ? (
            <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tổng', value: userStats.total, color: 'primary' },
                { label: 'Active', value: userStats.active, color: 'secondary' },
                { label: 'Suspended', value: userStats.suspended, color: 'error' },
                { label: 'Pending', value: userStats.pending, color: 'tertiary' },
                { label: 'Admins', value: userStats.admins, color: 'primary' },
                { label: 'Enterprise', value: userStats.enterprise, color: 'secondary' },
                { label: 'Pro', value: userStats.pro, color: 'tertiary' },
                { label: 'Free', value: userStats.free, color: 'outline' },
              ].map((s) => (
                <div key={s.label} className={`p-4 bg-${s.color}/5 rounded-2xl border border-${s.color}/20`}>
                  <p className="font-label-sm text-on-surface-variant">{s.label}</p>
                  <p className={`font-display-lg text-headline-md font-bold text-${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KB info */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="font-headline-md text-on-surface mb-6">Knowledge Base</h3>
          {loading || !kb ? (
            <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-primary/5 rounded-xl">
                <span className="font-label-md">Tổng tài liệu</span>
                <span className="font-bold text-primary">{kb.totalDocuments}</span>
              </div>
              <div className="flex justify-between p-3 bg-secondary/5 rounded-xl">
                <span className="font-label-md">Danh mục</span>
                <span className="font-bold text-secondary">{kb.totalCategories}</span>
              </div>
              {kb.totalSize !== undefined && (
                <div className="flex justify-between p-3 bg-tertiary/5 rounded-xl">
                  <span className="font-label-md">Dung lượng</span>
                  <span className="font-bold text-tertiary">{(kb.totalSize / 1024).toFixed(2)} KB</span>
                </div>
              )}
              <a href="/data" className="block mt-4 text-center py-3 bg-primary/10 text-primary rounded-xl font-label-md hover:bg-primary/20 transition-all">
                Mở trang QL Tri thức →
              </a>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
