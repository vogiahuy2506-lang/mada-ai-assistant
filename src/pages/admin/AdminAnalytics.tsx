import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import { getAccessToken } from '@/lib/api';
import clsx from 'clsx';
import {
  Users, BarChart2, Library, Receipt,
  Activity, Globe, Server, CheckCircle2,
} from 'lucide-react';

// ============== TRANSLATIONS ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

const translations: Record<Language, Record<string, string>> = {
  vi: {
    title: 'Phân tích & Thống kê',
    subtitle: 'Theo dõi hiệu suất chat, phân bố ngôn ngữ và xu hướng sử dụng hệ thống MADA AI.',
    // Stats
    totalUsers: 'Tổng người dùng',
    totalChats: 'Tổng cuộc trò chuyện',
    kbDocuments: 'Tài liệu tri thức',
    logEvents: 'Sự kiện hệ thống',
    // Filters
    timeRange: 'Khoảng thời gian:',
    range24h: '24 giờ',
    range7d: '7 ngày',
    range30d: '30 ngày',
    range90d: '90 ngày',
    // Sections
    chatPerformance: 'Hiệu suất Chat',
    hourlyActivity: 'Hoạt động theo giờ',
    topQueries: 'Câu hỏi phổ biến nhất',
    noQueries: 'Chưa có câu hỏi nào',
    languageDistribution: 'Phân bố ngôn ngữ',
    categoryDistribution: 'Phân bố danh mục',
    serverHealth: 'Sức khỏe Server',
    serverHealthSub: 'Trạng thái & tài nguyên hệ thống',
    userBreakdown: 'Phân bố người dùng',
    userBreakdownSub: 'Theo vai trò và gói dịch vụ',
    logActivity: 'Hoạt động hệ thống',
    // Server info
    nodeVersion: 'Node version',
    platform: 'Platform',
    uptime: 'Uptime',
    memoryRss: 'Memory (RSS)',
    heapUsed: 'Heap used',
    // User stats
    total: 'Tổng',
    active: 'Hoạt động',
    suspended: 'Bị khóa',
    pending: 'Chờ duyệt',
    admins: 'Quản trị',
    enterprise: 'Enterprise',
    pro: 'Pro',
    free: 'Free',
    // KB
    categories: 'Danh mục',
    // Log levels
    logInfo: 'Thông tin',
    logSuccess: 'Thành công',
    logWarn: 'Cảnh báo',
    logError: 'Lỗi',
    // Status
    loading: 'Đang tải...',
    noData: 'Chưa có dữ liệu',
  },
  en: {
    title: 'Analytics & Statistics',
    subtitle: 'Track chat performance, language distribution, and usage trends across MADA AI.',
    totalUsers: 'Total Users',
    totalChats: 'Total Conversations',
    kbDocuments: 'Knowledge Documents',
    logEvents: 'System Events',
    timeRange: 'Time range:',
    range24h: '24 hours',
    range7d: '7 days',
    range30d: '30 days',
    range90d: '90 days',
    chatPerformance: 'Chat Performance',
    hourlyActivity: 'Hourly Activity',
    topQueries: 'Top Queries',
    noQueries: 'No queries yet',
    languageDistribution: 'Language Distribution',
    categoryDistribution: 'Category Distribution',
    serverHealth: 'Server Health',
    serverHealthSub: 'System status & resources',
    userBreakdown: 'User Breakdown',
    userBreakdownSub: 'By role and subscription plan',
    logActivity: 'System Activity',
    nodeVersion: 'Node version',
    platform: 'Platform',
    uptime: 'Uptime',
    memoryRss: 'Memory (RSS)',
    heapUsed: 'Heap used',
    total: 'Total',
    active: 'Active',
    suspended: 'Suspended',
    pending: 'Pending',
    admins: 'Admins',
    enterprise: 'Enterprise',
    pro: 'Pro',
    free: 'Free',
    categories: 'Categories',
    logInfo: 'Info',
    logSuccess: 'Success',
    logWarn: 'Warning',
    logError: 'Error',
    loading: 'Loading...',
    noData: 'No data',
  },
  ar: {
    title: 'التحليلات والإحصائيات',
    subtitle: 'تتبع أداء المحادثة وتوزيع اللغة واتجاهات الاستخدام في MADA AI.',
    totalUsers: 'إجمالي المستخدمين',
    totalChats: 'إجمالي المحادثات',
    kbDocuments: 'مستندات المعرفة',
    logEvents: 'أحداث النظام',
    timeRange: 'النطاق الزمني:',
    range24h: '24 ساعة',
    range7d: '7 أيام',
    range30d: '30 يوم',
    range90d: '90 يوم',
    chatPerformance: 'أداء المحادثة',
    hourlyActivity: 'النشاط حسب الساعة',
    topQueries: 'أهم الاستفسارات',
    noQueries: 'لا توجد استفسارات بعد',
    languageDistribution: 'توزيع اللغة',
    categoryDistribution: 'توزيع الفئة',
    serverHealth: 'صحة الخادم',
    serverHealthSub: 'حالة النظام والموارد',
    userBreakdown: 'تفصيل المستخدمين',
    userBreakdownSub: 'حسب الدور وخطة الاشتراك',
    logActivity: 'نشاط النظام',
    nodeVersion: 'إصدار Node',
    platform: 'المنصة',
    uptime: 'وقت التشغيل',
    memoryRss: 'الذاكرة (RSS)',
    heapUsed: 'الذاكرة المستخدمة',
    total: 'الإجمالي',
    active: 'نشط',
    suspended: 'معلق',
    pending: 'قيد الانتظار',
    admins: 'مديرو النظام',
    enterprise: 'Enterprise',
    pro: 'Pro',
    free: 'Free',
    categories: 'الفئات',
    logInfo: 'معلومات',
    logSuccess: 'نجاح',
    logWarn: 'تحذير',
    logError: 'خطأ',
    loading: 'جاري التحميل...',
    noData: 'لا توجد بيانات',
  },
  fr: {
    title: 'Analyses & Statistiques',
    subtitle: "Suivez les performances du chat, la distribution linguistique et les tendances d'utilisation de MADA AI.",
    totalUsers: 'Total utilisateurs',
    totalChats: 'Total conversations',
    kbDocuments: 'Documents de connaissances',
    logEvents: "Événements système",
    timeRange: 'Période:',
    range24h: '24 heures',
    range7d: '7 jours',
    range30d: '30 jours',
    range90d: '90 jours',
    chatPerformance: 'Performance du chat',
    hourlyActivity: 'Activité horaire',
    topQueries: 'Questions populaires',
    noQueries: 'Pas de questions encore',
    languageDistribution: 'Distribution linguistique',
    categoryDistribution: 'Distribution par catégorie',
    serverHealth: 'Santé du serveur',
    serverHealthSub: "État et ressources du système",
    userBreakdown: 'Répartition utilisateurs',
    userBreakdownSub: 'Par rôle et plan de abonnement',
    logActivity: "Activité système",
    nodeVersion: 'Version Node',
    platform: 'Plateforme',
    uptime: 'Temps de fonctionnement',
    memoryRss: 'Mémoire (RSS)',
    heapUsed: 'Heap utilisé',
    total: 'Total',
    active: 'Actif',
    suspended: 'Suspendu',
    pending: 'En attente',
    admins: 'Administrateurs',
    enterprise: 'Enterprise',
    pro: 'Pro',
    free: 'Free',
    categories: 'Catégories',
    logInfo: 'Info',
    logSuccess: 'Succès',
    logWarn: 'Avertissement',
    logError: 'Erreur',
    loading: 'Chargement...',
    noData: 'Pas de données',
  },
};

function useT() {
  const lang = (localStorage.getItem('mada-language') || 'vi') as Language;
  const t = (key: string) => translations[lang]?.[key] || translations.vi[key] || key;
  return { t, lang };
}

// ============== HELPERS ==============
function bytesToMB(b: number) {
  return (b / 1024 / 1024).toFixed(1);
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ============== CHART COMPONENTS ==============
function BarChart({ data, maxValue }: { data: Array<{ label: string; value: number }>; maxValue: number }) {
  return (
    <div className="flex items-end gap-[2px] h-28">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-indigo-500 rounded-t-sm transition-all hover:opacity-80 cursor-pointer"
            style={{ height: `${maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 4 : 0) : 0}%` }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="text-[7px] text-gray-400 mt-1 truncate w-full text-center select-none">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data, total }: { data: Array<{ label: string; value: number; color: string }>; total: number }) {
  let currentAngle = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
          {data.map((item, i) => {
            if (total === 0) return null;
            const angle = (item.value / total) * 360;
            if (angle === 0) return null;
            const startAngle = currentAngle;
            currentAngle += angle;
            const largeArc = angle > 180 ? 1 : 0;
            const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 50 + 45 * Math.cos((currentAngle * Math.PI) / 180);
            const y2 = 50 + 45 * Math.sin((currentAngle * Math.PI) / 180);
            const path = `M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`;
            return <path key={i} d={path} fill={item.color} className="hover:opacity-80 transition-opacity cursor-pointer"><title>{`${item.label}: ${item.value}`}</title></path>;
          })}
          <circle cx="50" cy="50" r="22" fill="white" />
        </svg>
      </div>
      <div className="space-y-1.5 min-w-0">
        {data.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-gray-600 truncate flex-1">{item.label}</span>
            <span className="font-bold text-gray-800 flex-shrink-0 ml-1">{total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
          </div>
        ))}
        {data.length === 0 && (
          <div className="text-xs text-gray-400 italic">—</div>
        )}
      </div>
    </div>
  );
}

// ============== TYPES ==============
type TimeRange = '24h' | '7d' | '30d' | '90d';

interface ApiAnalytics {
  kb: KnowledgeStats;
  logs: { total: number; byLevel: Record<string, number> };
  server: { uptime: number; memory: any; nodeVersion: string; platform: string };
}

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

// ============== MAIN COMPONENT ==============
export function AdminAnalytics() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [chatMetrics, setChatMetrics] = useState<ChatMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const { t, lang } = useT();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getAccessToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [us, an, cm] = await Promise.all([
          adminApi.getUserStats(),
          adminApi.getAnalytics(),
          adminApi.getChatMetrics(range),
        ]);
        if (cancelled) return;
        if (us.success && us.data) setUserStats(us.data);
        if (an.success && an.data) setAnalytics(an.data as ApiAnalytics);
        if (cm.success && cm.data) setChatMetrics(cm.data as ChatMetrics);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn('AdminAnalytics: Request timed out');
        } else {
          console.error('AdminAnalytics: Failed to load data', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => { void load(); }, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [range]);

  const kb = analytics?.kb;
  const logs = analytics?.logs;
  const srv = analytics?.server;

  const logLevelBars = [
    { level: 'logInfo', count: logs?.byLevel.info || 0, color: 'bg-indigo-500' },
    { level: 'logSuccess', count: logs?.byLevel.success || 0, color: 'bg-emerald-500' },
    { level: 'logWarn', count: logs?.byLevel.warn || 0, color: 'bg-amber-500' },
    { level: 'logError', count: logs?.byLevel.error || 0, color: 'bg-red-500' },
  ];
  const maxLog = Math.max(...logLevelBars.map(l => l.count), 1);

  const hourlyData = (chatMetrics?.chatsByHour ?? []).map(h => ({
    label: h.hour.toString().padStart(2, '0') + 'h',
    value: h.count,
  }));
  const maxHourly = Math.max(...hourlyData.map(d => d.value), 1);

  const catColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
  const categoryData = (chatMetrics?.categoryUsage ?? []).map((c, i) => ({
    label: c.category,
    value: c.count,
    color: catColors[i % catColors.length],
  }));
  const totalCat = categoryData.reduce((s, d) => s + d.value, 0);

  const langColors: Record<string, string> = {
    'Tiếng Việt': '#ef4444',
    'English': '#3b82f6',
    'العربية': '#10b981',
    'Français': '#f59e0b',
  };
  const langData = (chatMetrics?.languageDistribution ?? []).map(l => ({
    label: l.language,
    value: l.count,
    color: langColors[l.language] || '#6b7280',
  }));
  const totalLang = langData.reduce((s, d) => s + d.value, 0);

  return (
    <AdminLayout
      titleKey="admin.topBar.analytics"
      subtitleKey="admin.topBar.analyticsSub"
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-white to-violet-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              {t('title')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="relative bg-gradient-to-br from-indigo-500/10 to-violet-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('totalUsers')}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.total ?? '—'}</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-violet-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-violet-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <BarChart2 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('totalChats')}</p>
            <h3 className="text-xl font-black text-on-surface">{chatMetrics?.totalChats?.toLocaleString() ?? '—'}</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-teal-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-teal-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <Library className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('kbDocuments')}</p>
            <h3 className="text-xl font-black text-on-surface">{kb?.totalDocuments ?? '—'}</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-red-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <Receipt className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('logEvents')}</p>
            <h3 className="text-xl font-black text-on-surface">{logs?.total ?? '—'}</h3>
          </div>
        </div>
      </div>

      {/* ====== TIME RANGE FILTER ====== */}
      <div className="bg-white rounded-xl border border-slate-300 p-3 mb-6 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-slate-600">{t('timeRange')}</span>
        {(['24h', '7d', '30d', '90d'] as TimeRange[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-bold border transition-all',
              range === r
                ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            )}
          >
            {t(`range${r}`)}
          </button>
        ))}
      </div>

      {/* ====== CHARTS ROW ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Hourly Activity */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('hourlyActivity')}</h3>
          </div>
          {loading ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-400">{t('loading')}</div>
          ) : hourlyData.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-400">{t('noData')}</div>
          ) : (
            <BarChart data={hourlyData} maxValue={maxHourly} />
          )}
        </div>

        {/* Language Distribution */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('languageDistribution')}</h3>
          </div>
          {loading ? (
            <div className="h-20 flex items-center justify-center text-xs text-slate-400">{t('loading')}</div>
          ) : (
            <PieChart data={langData} total={totalLang} />
          )}
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('categoryDistribution')}</h3>
          </div>
          {loading ? (
            <div className="h-20 flex items-center justify-center text-xs text-slate-400">{t('loading')}</div>
          ) : categoryData.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-xs text-slate-400">{t('noData')}</div>
          ) : (
            <PieChart data={categoryData} total={totalCat} />
          )}
        </div>
      </div>

      {/* ====== TOP QUERIES ====== */}
      <div className="bg-white rounded-xl border border-slate-300 p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-800">{t('topQueries')}</h3>
        </div>
        {loading ? (
          <p className="text-xs text-slate-400">{t('loading')}</p>
        ) : (chatMetrics?.topQueries ?? []).length === 0 ? (
          <p className="text-xs text-slate-400">{t('noQueries')}</p>
        ) : (
          <div className="space-y-1.5">
            {(chatMetrics?.topQueries ?? []).map((q, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  i === 0 ? 'bg-indigo-500 text-white' : i === 1 ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-600'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm truncate text-slate-700">{q.query}</span>
                <span className="text-sm font-bold text-slate-500 flex-shrink-0">{q.count}x</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== SERVER + LOGS + USER ROW ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Server Health */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('serverHealth')}</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">{t('serverHealthSub')}</p>
          {loading || !srv ? (
            <p className="text-xs text-slate-400">{t('loading')}</p>
          ) : (
            <div className="space-y-2">
              {[
                { label: t('nodeVersion'), value: srv.nodeVersion },
                { label: t('platform'), value: srv.platform },
                { label: t('uptime'), value: formatUptime(srv.uptime) },
                { label: t('memoryRss'), value: `${bytesToMB(srv.memory.rss)} MB` },
                { label: t('heapUsed'), value: `${bytesToMB(srv.memory.heapUsed)} MB` },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                  <span className="text-xs font-bold font-mono text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log Activity */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('logActivity')}</h3>
          </div>
          {loading ? (
            <p className="text-xs text-slate-400">{t('loading')}</p>
          ) : (
            <div className="space-y-3">
              {logLevelBars.map(b => (
                <div key={b.level}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-bold capitalize text-slate-700">{t(b.level)}</span>
                    <span className="text-xs font-black text-slate-800">{b.count}</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full ${b.color} transition-all rounded-full`}
                      style={{ width: `${(b.count / maxLog) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Breakdown */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-black text-slate-800">{t('userBreakdown')}</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">{t('userBreakdownSub')}</p>
          {loading || !userStats ? (
            <p className="text-xs text-slate-400">{t('loading')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('total'), value: userStats.total, color: 'text-indigo-600' },
                { label: t('active'), value: userStats.active, color: 'text-emerald-600' },
                { label: t('admins'), value: userStats.admins, color: 'text-violet-600' },
                { label: t('enterprise'), value: userStats.enterprise, color: 'text-amber-600' },
                { label: t('pro'), value: userStats.pro, color: 'text-blue-600' },
                { label: t('free'), value: userStats.free, color: 'text-slate-500' },
                { label: t('pending'), value: userStats.pending, color: 'text-amber-600' },
                { label: t('suspended'), value: userStats.suspended, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">{s.label}</p>
                  <p className={`text-lg font-black leading-tight ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalytics;
