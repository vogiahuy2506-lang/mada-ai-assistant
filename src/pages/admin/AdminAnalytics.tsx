import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import clsx from 'clsx';

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
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              Phân tích Hệ thống
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Báo cáo chi tiết về lưu lượng, hành vi người dùng và hiệu suất của MADA AI.
            </p>
          </div>
        </div>
      </section>

      {/* Time Range Tabs */}
      <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black mb-8 w-fit">
        {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={clsx(
              'px-4 py-1.5 rounded-full font-bold text-xs transition-all border-2',
              range === r
                ? 'bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-white/80 border-transparent hover:border-black'
            )}
          >
            {r === '24h' ? '24 giờ' : r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '90 ngày'}
          </button>
        ))}
      </div>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TỔNG NGƯỜI DÙNG</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.total ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{userStats?.active ?? 0} đang hoạt động</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TÀI LIỆU KB</p>
            <h3 className="text-xl font-black text-on-surface">{kb?.totalDocuments ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{kb?.totalCategories ?? 0} danh mục</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-tertiary/10 to-tertiary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-tertiary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>list_alt</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">SỰ KIỆN LOG</p>
            <h3 className="text-xl font-black text-on-surface">{logs?.total ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">Tổng cộng</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-green-50/80 to-green-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-green-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">UPTIME</p>
            <h3 className="text-xl font-black text-on-surface">{srv ? formatUptime(srv.uptime) : '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{srv?.nodeVersion || '—'}</p>
          </div>
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Log Activity */}
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-on-surface mb-6">Phân bổ hoạt động log</h3>
            {loading ? (
              <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
            ) : (
              <div className="space-y-4">
                {logLevelBars.map((b) => (
                  <div key={b.level}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-bold capitalize">{b.level}</span>
                      <span className="text-sm font-black">{b.count}</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-black/20">
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
        </div>

        {/* Server Info */}
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-on-surface mb-6">Thông tin server</h3>
            {loading || !srv ? (
              <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Node version', value: srv.nodeVersion },
                  { label: 'Platform', value: srv.platform },
                  { label: 'Uptime', value: formatUptime(srv.uptime) },
                  { label: 'Memory (RSS)', value: `${bytesToMB(srv.memory.rss)} MB` },
                  { label: 'Heap used', value: `${bytesToMB(srv.memory.heapUsed)} MB` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between p-3 bg-gray-50/50 rounded-xl border border-black/10">
                    <span className="text-sm font-medium text-on-surface-variant">{item.label}</span>
                    <span className="text-sm font-bold font-mono text-on-surface">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Stats & KB Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Breakdown */}
        <div className="lg:col-span-2 relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-on-surface mb-6">Thống kê người dùng</h3>
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
                  { label: 'Free', value: userStats.free, color: 'gray' },
                ].map((s) => (
                  <div key={s.label} className={`p-4 bg-${s.color}/5 rounded-2xl border-2 border-${s.color}/20`}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className={`text-xl font-black text-${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KB Info */}
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-on-surface mb-6">Knowledge Base</h3>
            {loading || !kb ? (
              <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between p-4 bg-primary/10 rounded-xl border-2 border-primary/30">
                  <span className="text-sm font-medium">Tổng tài liệu</span>
                  <span className="text-lg font-black text-primary">{kb.totalDocuments}</span>
                </div>
                <div className="flex justify-between p-4 bg-secondary/10 rounded-xl border-2 border-secondary/30">
                  <span className="text-sm font-medium">Danh mục</span>
                  <span className="text-lg font-black text-secondary">{kb.totalCategories}</span>
                </div>
                {kb.totalSize !== undefined && (
                  <div className="flex justify-between p-4 bg-tertiary/10 rounded-xl border-2 border-tertiary/30">
                    <span className="text-sm font-medium">Dung lượng</span>
                    <span className="text-lg font-black text-tertiary">{(kb.totalSize / 1024).toFixed(2)} KB</span>
                  </div>
                )}
                <a href="/data" className="block mt-4 text-center py-3 bg-primary text-white rounded-xl font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all">
                  Mở trang QL Tri thức →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
