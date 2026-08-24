import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import { getAccessToken } from '@/lib/api';
import clsx from 'clsx';

type TimeRange = '24h' | '7d' | '30d' | '90d';

interface ApiAnalytics {
  kb: KnowledgeStats;
  logs: { total: number; byLevel: Record<string, number> };
  server: { uptime: number; memory: any; nodeVersion: string; platform: string };
}

// Extended analytics for advanced dashboard
interface ChatMetrics {
  totalChats: number;
  avgResponseTime: number;
  avgConfidence: number;
  topQueries: Array<{ query: string; count: number }>;
  chatsByHour: Array<{ hour: number; count: number }>;
  categoryUsage: Array<{ category: string; count: number }>;
  languageDistribution: Array<{ language: string; count: number; color?: string }>;
  errorRate: number;
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

// Simple bar chart component
function BarChart({ data, maxValue }: { data: Array<{ label: string; value: number }>; maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-gradient-to-t from-primary to-secondary rounded-t-sm transition-all hover:opacity-80"
            style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: item.value > 0 ? '4px' : '0' }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="text-[8px] text-gray-500 mt-1 truncate w-full text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Pie chart component
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

export function AdminAnalytics() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [chatMetrics, setChatMetrics] = useState<ChatMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Load analytics data
  useEffect(() => {
    const load = async () => {
      // Skip when not authenticated to avoid 401 spam in console
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      const [us, an, cm] = await Promise.all([
        adminApi.getUserStats(),
        adminApi.getAnalytics(),
        adminApi.getChatMetrics(range),
      ]);
      if (us.success && us.data) setUserStats(us.data);
      if (an.success && an.data) setAnalytics(an.data);
      if (cm.success && cm.data) setChatMetrics(cm.data as ChatMetrics);
      setLoading(false);
    };
    load();
    const id = setInterval(() => { void load(); }, 10000);
    return () => clearInterval(id);
  }, [range]);

  const kb = analytics?.kb;
  const logs = analytics?.logs;
  const srv = analytics?.server;

  const logLevelBars = [
    { level: 'info', count: logs?.byLevel.info || 0, color: 'bg-primary' },
    { level: 'success', count: logs?.byLevel.success || 0, color: 'bg-secondary' },
    { level: 'warn', count: logs?.byLevel.warn || 0, color: 'bg-tertiary' },
    { level: 'error', count: logs?.byLevel.error || 0, color: 'bg-red-500' },
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

      {/* ====== NEW ADVANCED METRICS ROW ====== */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {/* Total Chats */}
        <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-2xl p-3 border-2 border-violet-200">
          <p className="text-[10px] font-bold text-violet-600 uppercase">Tổng chat</p>
          <p className="text-xl font-black text-violet-700">{chatMetrics?.totalChats?.toLocaleString() || '—'}</p>
          <p className="text-[10px] text-violet-500">Hội thoại</p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-3 border-2 border-blue-200">
          <p className="text-[10px] font-bold text-blue-600 uppercase">Phản hồi TB</p>
          <p className="text-xl font-black text-blue-700">{chatMetrics?.avgResponseTime != null ? (Math.round(chatMetrics.avgResponseTime / 100) / 10) + 's' : '—'}</p>
          <p className="text-[10px] text-blue-500">Mili giây</p>
        </div>

        {/* Avg Confidence */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-3 border-2 border-green-200">
          <p className="text-[10px] font-bold text-green-600 uppercase">Độ tin cậy TB</p>
          <p className="text-xl font-black text-green-700">{chatMetrics?.avgConfidence != null ? chatMetrics.avgConfidence.toFixed(0) + '%' : '—'}</p>
          <p className="text-[10px] text-green-500">Confidence</p>
        </div>

        {/* Error Rate */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-3 border-2 border-red-200">
          <p className="text-[10px] font-bold text-red-600 uppercase">Tỷ lệ lỗi</p>
          <p className="text-xl font-black text-red-700">{chatMetrics?.errorRate != null ? chatMetrics.errorRate.toFixed(1) + '%' : '—'}</p>
          <p className="text-[10px] text-red-500">Thất bại</p>
        </div>

        {/* Total Users */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-3 border-2 border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase">Tổng user</p>
          <p className="text-xl font-black text-primary">{userStats?.total ?? '—'}</p>
          <p className="text-[10px] text-primary/70">Người dùng</p>
        </div>

        {/* KB Documents */}
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-2xl p-3 border-2 border-secondary/20">
          <p className="text-[10px] font-bold text-secondary uppercase">Tài liệu KB</p>
          <p className="text-xl font-black text-secondary">{kb?.totalDocuments ?? '—'}</p>
          <p className="text-[10px] text-secondary/70">Documents</p>
        </div>
      </section>

      {/* ====== CHARTS ROW ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Hourly Activity Chart */}
        <div className="bg-white rounded-2xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000]">
          <h3 className="text-lg font-bold mb-4">Hoạt động theo giờ</h3>
          <BarChart
            data={(chatMetrics?.chatsByHour ?? []).map(h => ({
              label: h.hour.toString().padStart(2, '0') + 'h',
              value: h.count,
            }))}
            maxValue={Math.max(...((chatMetrics?.chatsByHour ?? []).map(h => h.count).length ? chatMetrics!.chatsByHour.map(h => h.count) : [1]))}
          />
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-2xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000]">
          <h3 className="text-lg font-bold mb-4">Phân bố danh mục AT</h3>
          <PieChart
            data={(chatMetrics?.categoryUsage ?? []).map((c, i) => ({
              label: c.category,
              value: c.count,
              color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'][i % 7],
            }))}
          />
        </div>
      </div>

      {/* ====== TOP QUERIES & LANGUAGE ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Queries */}
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000]">
          <h3 className="text-lg font-bold mb-4">Câu hỏi phổ biến nhất</h3>
          <div className="space-y-2">
            {(chatMetrics?.topQueries ?? []).map((q, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <span className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  i === 0 ? 'bg-primary text-white' : i === 1 ? 'bg-secondary text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm truncate">{q.query}</span>
                <span className="text-sm font-bold text-gray-500">{q.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Language Distribution */}
        <div className="bg-white rounded-2xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000]">
          <h3 className="text-lg font-bold mb-4">Ngôn ngữ sử dụng</h3>
          <div className="space-y-3">
            {(chatMetrics?.languageDistribution ?? []).map((l, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{l.language}</span>
                  <span className="text-sm font-bold">{l.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(l.count / (chatMetrics?.totalChats || 1)) * 100}%`,
                      backgroundColor: l.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== LEGACY METRICS ROW ====== */}
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
export default AdminAnalytics;
