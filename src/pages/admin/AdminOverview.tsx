import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayoutLinear';
import { adminApi, AdminUser, KnowledgeStats, UserStats } from './adminApi';
import { useLanguageStore } from '@/stores';

// Admin Overview translations - supports all languages via useLanguageStore
const tO = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Bot names
      'admin.overview.bot1': 'Bot Thính giác',
      'admin.overview.bot2': 'Bot Thị giác',
      'admin.overview.bot3': 'Bot Tiếng nói',
      'admin.overview.bot4': 'Bot Nhận thức',
      'admin.overview.bot5': 'Bot Thần kinh',
      'admin.overview.bot6': 'Bot Vận động',
      'admin.overview.bot7': 'Bot Quy định',
      // Time
      'time.secondsAgo': 'giây trước',
      'time.minutesAgo': 'phút trước',
      'time.hoursAgo': 'giờ trước',
      'time.daysAgo': 'ngày trước',
      // Overview
      'admin.topBar.overview': 'Tổng quan',
      'admin.topBar.overviewSub': 'Xem nhanh tình trạng hệ thống',
      'admin.overview.title': 'Bảng điều khiển',
      'admin.overview.subtitle': 'Chào mừng đến với trang quản trị MADA AI. Theo dõi và quản lý hệ thống của bạn.',
      'admin.overview.totalUsers': 'Tổng người dùng',
      'admin.overview.active': 'hoạt động',
      'admin.overview.kbDocs': 'Tài liệu KB',
      'admin.overview.bot': 'Bot',
      'admin.overview.categories': 'danh mục',
      'admin.overview.enterprisePlans': 'Kế hoạch Enterprise',
      'admin.overview.premiumCustomers': 'Khách hàng cao cấp',
      'admin.overview.suspendedAccounts': 'Tài khoản bị khóa',
      'admin.overview.needsAction': 'Cần xử lý',
      'admin.overview.kbByBot': 'KB theo Bot',
      'admin.overview.filterByBots': 'Lọc theo bot để xem chi tiết',
      'admin.overview.botId': 'Bot ID',
      'admin.overview.allBots': 'Tất cả Bot',
      'admin.overview.documents': 'tài liệu',
      'admin.overview.noKbData': 'Chưa có dữ liệu KB',
      'admin.overview.newestUsers': 'Người dùng mới nhất',
      'admin.overview.recentAccounts': 'Tài khoản được tạo gần đây',
      'admin.overview.viewAll': 'Xem tất cả',
      'admin.overview.user': 'Người dùng',
      'admin.overview.role': 'Vai trò',
      'admin.overview.plan': 'Gói',
      'admin.overview.status': 'Trạng thái',
      'admin.overview.lastLogin': 'Đăng nhập cuối',
      'admin.common.loading': 'Đang tải...',
      'admin.common.active': 'Hoạt động',
      'admin.common.error': 'Có lỗi xảy ra',
      'admin.overview.noUsers': 'Chưa có người dùng nào',
      'admin.users.admin': 'Quản trị',
      'admin.overview.expert': 'Chuyên gia',
      'admin.overview.dataManager': 'Quản lý dữ liệu',
      'admin.users.pending': 'Chờ duyệt',
      'admin.overview.suspended': 'Bị khóa',
      'admin.overview.quickActions': 'Thao tác nhanh',
      'admin.overview.manageUsers': 'Quản lý người dùng',
      'admin.overview.manageUsersDesc': 'Thêm, sửa, xóa và quản lý tài khoản người dùng',
      'admin.overview.systemLogs': 'Nhật ký hệ thống',
      'admin.overview.systemLogsDesc': 'Theo dõi các hoạt động và sự kiện trong hệ thống',
      'admin.overview.systemConfig': 'Cấu hình hệ thống',
      'admin.overview.systemConfigDesc': 'Thiết lập và tùy chỉnh các thông số hệ thống',
    },
    en: {
      // Bot names
      'admin.overview.bot1': 'Hearing Bot',
      'admin.overview.bot2': 'Vision Bot',
      'admin.overview.bot3': 'Speech Bot',
      'admin.overview.bot4': 'Cognitive Bot',
      'admin.overview.bot5': 'Neural Bot',
      'admin.overview.bot6': 'Mobility Bot',
      'admin.overview.bot7': 'Regulatory Bot',
      // Time
      'time.secondsAgo': 'seconds ago',
      'time.minutesAgo': 'minutes ago',
      'time.hoursAgo': 'hours ago',
      'time.daysAgo': 'days ago',
      // Overview
      'admin.topBar.overview': 'Overview',
      'admin.topBar.overviewSub': 'Quick view of system status',
      'admin.overview.title': 'Dashboard',
      'admin.overview.subtitle': 'Welcome to MADA AI admin panel. Monitor and manage your system.',
      'admin.overview.totalUsers': 'Total Users',
      'admin.overview.active': 'active',
      'admin.overview.kbDocs': 'KB Documents',
      'admin.overview.bot': 'Bot',
      'admin.overview.categories': 'categories',
      'admin.overview.enterprisePlans': 'Enterprise Plans',
      'admin.overview.premiumCustomers': 'Premium Customers',
      'admin.overview.suspendedAccounts': 'Suspended Accounts',
      'admin.overview.needsAction': 'Needs Action',
      'admin.overview.kbByBot': 'KB by Bot',
      'admin.overview.filterByBots': 'Filter by bot to see details',
      'admin.overview.botId': 'Bot ID',
      'admin.overview.allBots': 'All Bots',
      'admin.overview.documents': 'documents',
      'admin.overview.noKbData': 'No KB data yet',
      'admin.overview.newestUsers': 'Newest Users',
      'admin.overview.recentAccounts': 'Recently created accounts',
      'admin.overview.viewAll': 'View all',
      'admin.overview.user': 'User',
      'admin.overview.role': 'Role',
      'admin.overview.plan': 'Plan',
      'admin.overview.status': 'Status',
      'admin.overview.lastLogin': 'Last Login',
      'admin.common.loading': 'Loading...',
      'admin.common.active': 'Active',
      'admin.common.error': 'An error occurred',
      'admin.overview.noUsers': 'No users yet',
      'admin.users.admin': 'Admin',
      'admin.overview.expert': 'Expert',
      'admin.overview.dataManager': 'Data Manager',
      'admin.users.pending': 'Pending',
      'admin.overview.suspended': 'Suspended',
      'admin.overview.quickActions': 'Quick Actions',
      'admin.overview.manageUsers': 'Manage Users',
      'admin.overview.manageUsersDesc': 'Add, edit, delete and manage user accounts',
      'admin.overview.systemLogs': 'System Logs',
      'admin.overview.systemLogsDesc': 'Track activities and events in the system',
      'admin.overview.systemConfig': 'System Configuration',
      'admin.overview.systemConfigDesc': 'Set up and customize system parameters',
    },
    ar: {
      // Bot names
      'admin.overview.bot1': 'بوت السمع',
      'admin.overview.bot2': 'بوت الرؤية',
      'admin.overview.bot3': 'بوت الكلام',
      'admin.overview.bot4': 'بوت الإدراك',
      'admin.overview.bot5': 'بوت الأعصاب',
      'admin.overview.bot6': 'بوت الحركة',
      'admin.overview.bot7': 'بوت التنظيم',
      // Time
      'time.secondsAgo': 'ثوانٍ ago',
      'time.minutesAgo': 'دقائق ago',
      'time.hoursAgo': 'ساعات ago',
      'time.daysAgo': 'أيام ago',
      // Overview
      'admin.topBar.overview': 'نظرة عامة',
      'admin.topBar.overviewSub': 'عرض سريع لحالة النظام',
      'admin.overview.title': 'لوحة التحكم',
      'admin.overview.subtitle': 'مرحباً بك في لوحة تحكم MADA AI. راقب وأدر نظامك.',
      'admin.overview.totalUsers': 'إجمالي المستخدمين',
      'admin.overview.active': 'نشط',
      'admin.overview.kbDocs': 'مستندات KB',
      'admin.overview.bot': 'بوت',
      'admin.overview.categories': 'فئات',
      'admin.overview.enterprisePlans': 'خطط المؤسسة',
      'admin.overview.premiumCustomers': 'العملاء المميزين',
      'admin.overview.suspendedAccounts': 'الحسابات المعلقة',
      'admin.overview.needsAction': 'يحتاج إجراء',
      'admin.overview.kbByBot': 'KB حسب البوت',
      'admin.overview.filterByBots': 'تصفية حسب البوت لعرض التفاصيل',
      'admin.overview.botId': 'معرف البوت',
      'admin.overview.allBots': 'جميع البوتات',
      'admin.overview.documents': 'مستندات',
      'admin.overview.noKbData': 'لا توجد بيانات KB بعد',
      'admin.overview.newestUsers': 'أحدث المستخدمين',
      'admin.overview.recentAccounts': 'الحسابات المنشأة مؤخراً',
      'admin.overview.viewAll': 'عرض الكل',
      'admin.overview.user': 'مستخدم',
      'admin.overview.role': 'دور',
      'admin.overview.plan': 'خطة',
      'admin.overview.status': 'حالة',
      'admin.overview.lastLogin': 'آخر تسجيل دخول',
      'admin.common.loading': 'جاري التحميل...',
      'admin.common.active': 'نشط',
      'admin.common.error': 'حدث خطأ',
      'admin.overview.noUsers': 'لا يوجد مستخدمون بعد',
      'admin.users.admin': 'مدير',
      'admin.overview.expert': 'خبير',
      'admin.overview.dataManager': 'مدير البيانات',
      'admin.users.pending': 'قيد الانتظار',
      'admin.overview.suspended': 'معلق',
      'admin.overview.quickActions': 'إجراءات سريعة',
      'admin.overview.manageUsers': 'إدارة المستخدمين',
      'admin.overview.manageUsersDesc': 'إضافة وتعديل وحذف وإدارة حسابات المستخدمين',
      'admin.overview.systemLogs': 'سجلات النظام',
      'admin.overview.systemLogsDesc': 'تتبع الأنشطة والأحداث في النظام',
      'admin.overview.systemConfig': 'إعدادات النظام',
      'admin.overview.systemConfigDesc': 'إعداد وتخصيص معلمات النظام',
    },
    fr: {
      // Bot names
      'admin.overview.bot1': 'Bot Auditif',
      'admin.overview.bot2': 'Bot Visuel',
      'admin.overview.bot3': 'Bot Vocal',
      'admin.overview.bot4': 'Bot Cognitif',
      'admin.overview.bot5': 'Bot Neural',
      'admin.overview.bot6': 'Bot Moteur',
      'admin.overview.bot7': 'Bot Réglementaire',
      // Time
      'time.secondsAgo': 'secondes',
      'time.minutesAgo': 'minutes',
      'time.hoursAgo': 'heures',
      'time.daysAgo': 'jours',
      // Overview
      'admin.topBar.overview': 'Aperçu',
      'admin.topBar.overviewSub': 'Vue rapide de l\'état du système',
      'admin.overview.title': 'Tableau de bord',
      'admin.overview.subtitle': 'Bienvenue dans le panneau d\'administration MADA AI. Surveillez et gérez votre système.',
      'admin.overview.totalUsers': 'Total utilisateurs',
      'admin.overview.active': 'actif',
      'admin.overview.kbDocs': 'Documents KB',
      'admin.overview.bot': 'Bot',
      'admin.overview.categories': 'catégories',
      'admin.overview.enterprisePlans': 'Plans Entreprise',
      'admin.overview.premiumCustomers': 'Clients Premium',
      'admin.overview.suspendedAccounts': 'Comptes suspendus',
      'admin.overview.needsAction': 'Nécessite action',
      'admin.overview.kbByBot': 'KB par Bot',
      'admin.overview.filterByBots': 'Filtrer par bot pour voir les détails',
      'admin.overview.botId': 'ID Bot',
      'admin.overview.allBots': 'Tous les Bots',
      'admin.overview.documents': 'documents',
      'admin.overview.noKbData': 'Pas encore de données KB',
      'admin.overview.newestUsers': 'Nouveaux utilisateurs',
      'admin.overview.recentAccounts': 'Comptes récemment créés',
      'admin.overview.viewAll': 'Voir tout',
      'admin.overview.user': 'Utilisateur',
      'admin.overview.role': 'Rôle',
      'admin.overview.plan': 'Plan',
      'admin.overview.status': 'Statut',
      'admin.overview.lastLogin': 'Dernière connexion',
      'admin.common.loading': 'Chargement...',
      'admin.common.active': 'Actif',
      'admin.common.error': 'Une erreur est survenue',
      'admin.overview.noUsers': 'Pas encore d\'utilisateurs',
      'admin.users.admin': 'Admin',
      'admin.overview.expert': 'Expert',
      'admin.overview.dataManager': 'Gestionnaire de données',
      'admin.users.pending': 'En attente',
      'admin.overview.suspended': 'Suspendu',
      'admin.overview.quickActions': 'Actions rapides',
      'admin.overview.manageUsers': 'Gérer les utilisateurs',
      'admin.overview.manageUsersDesc': 'Ajouter, modifier, supprimer et gérer les comptes utilisateurs',
      'admin.overview.systemLogs': 'Journaux système',
      'admin.overview.systemLogsDesc': 'Suivre les activités et événements du système',
      'admin.overview.systemConfig': 'Configuration système',
      'admin.overview.systemConfigDesc': 'Configurer et personnaliser les paramètres système',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

// Helper to get bot name by ID
const getBotName = (botId: string): string => {
  const botKeyMap: Record<string, string> = {
    'bot-hearing': 'admin.overview.bot1',
    'bot-vision': 'admin.overview.bot2',
    'bot-speech': 'admin.overview.bot3',
    'bot-cognitive': 'admin.overview.bot4',
    'bot-neuro': 'admin.overview.bot5',
    'bot-mobility': 'admin.overview.bot6',
    'bot-regulatory': 'admin.overview.bot7',
  };
  return tO(botKeyMap[botId] || botId);
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} ${tO('time.secondsAgo')}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${tO('time.minutesAgo')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${tO('time.hoursAgo')}`;
  const d = Math.floor(h / 24);
  return `${d} ${tO('time.daysAgo')}`;
}

export function AdminOverview() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [filterBotId, setFilterBotId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [us, kbs, users] = await Promise.all([
        adminApi.getUserStats(),
        adminApi.getKnowledgeStats(filterBotId ? { botId: filterBotId } : undefined),
        adminApi.listUsers(),
      ]);
      if (us.success && us.data) setUserStats(us.data);
      if (kbs.success && kbs.data) setKbStats(kbs.data);
      if (users.success && users.data) {
        setRecentUsers(
          [...users.data.users]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        );
      }
    } catch (err: unknown) {
      // Ignore AbortError (timeout) - user will see stale/empty data
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('AdminOverview: Request timed out');
      } else {
        console.error('AdminOverview: Failed to load data', err);
      }
    } finally {
      setLoading(false);
    }
  }, [filterBotId]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout
      titleKey="admin.topBar.overview"
      subtitleKey="admin.topBar.overviewSub"
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {tO('admin.overview.title')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {tO('admin.overview.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{tO('admin.overview.totalUsers').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.total ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{userStats?.active ?? 0} {tO('admin.overview.active')}</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{tO('admin.overview.kbDocs').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{kbStats?.totalDocuments ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {filterBotId ? `${tO('admin.overview.bot')}: ${filterBotId}` : `${kbStats?.totalCategories ?? 0} ${tO('admin.overview.categories')}`}
            </p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-tertiary/10 to-tertiary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-tertiary/20 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{tO('admin.overview.enterprisePlans').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.enterprise ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{tO('admin.overview.premiumCustomers')}</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-error/10 to-error/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-error/20 border border-slate-300 flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-error text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{tO('admin.overview.suspendedAccounts').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.suspended ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{tO('admin.overview.needsAction')}</p>
          </div>
        </div>
      </section>

      {/* KB Filter + Per-Bot Breakdown - Compact Design */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-5 md:p-8 shadow-[12px_12px_0px_0px_#000] mb-12">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-xl font-black text-on-surface">{tO('admin.overview.kbByBot')}</h3>
            <p className="text-xs text-on-surface-variant">{tO('admin.overview.filterByBots')}</p>
          </div>
          {/* Bot ID Filter - Compact Dropdown */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm">
            <span className="material-symbols-outlined text-primary text-base">filter_list</span>
            <select
              value={filterBotId}
              onChange={(e) => setFilterBotId(e.target.value)}
              className="h-6 px-1 text-xs bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">{tO('admin.overview.allBots')}</option>
              <option value="bot-hearing">{getBotName('bot-hearing')}</option>
              <option value="bot-vision">{getBotName('bot-vision')}</option>
              <option value="bot-speech">{getBotName('bot-speech')}</option>
              <option value="bot-cognitive">{getBotName('bot-cognitive')}</option>
              <option value="bot-neuro">{getBotName('bot-neuro')}</option>
              <option value="bot-mobility">{getBotName('bot-mobility')}</option>
              <option value="bot-regulatory">{getBotName('bot-regulatory')}</option>
            </select>
          </div>
        </div>

        {/* Bot Cards Grid - Compact */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
          {kbStats?.perBot && kbStats.perBot.length > 0 ? (
            kbStats.perBot.map((row: any) => {
              const isActive = filterBotId === row.botId;
              const botName = getBotName(row.botId);
              const isFiltered = filterBotId && !isActive;
              
              const botConfig: Record<string, { icon: string; color: string; gradient: string }> = {
                'bot-hearing': { icon: 'hearing', color: 'text-cyan-600', gradient: 'from-cyan-500 to-blue-600' },
                'bot-vision': { icon: 'visibility', color: 'text-purple-600', gradient: 'from-purple-500 to-pink-600' },
                'bot-speech': { icon: 'record_voice_over', color: 'text-amber-600', gradient: 'from-amber-500 to-orange-600' },
                'bot-cognitive': { icon: 'psychology', color: 'text-rose-600', gradient: 'from-rose-500 to-red-600' },
                'bot-neuro': { icon: 'neurology', color: 'text-indigo-600', gradient: 'from-indigo-500 to-purple-600' },
                'bot-mobility': { icon: 'accessible_forward', color: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
                'bot-regulatory': { icon: 'policy', color: 'text-blue-600', gradient: 'from-blue-500 to-cyan-600' },
              };
              const config = botConfig[row.botId] || { icon: 'smart_toy', color: 'text-gray-600', gradient: 'from-gray-500 to-slate-600' };
              
              return (
                <button
                  key={row.botId}
                  onClick={() => setFilterBotId(isActive ? '' : row.botId)}
                  className={`
                    relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-150
                    ${isActive 
                      ? `bg-gradient-to-br ${config.gradient} text-white border-transparent shadow-md` 
                      : isFiltered
                        ? 'bg-gray-50 text-gray-400 border-gray-100 opacity-40'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-primary/40 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Icon */}
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center mb-1.5
                    ${isActive ? 'bg-white/20' : 'bg-gray-100'}
                  `}>
                    <span className={`material-symbols-outlined text-base ${isActive ? 'text-white' : config.color}`}>
                      {config.icon}
                    </span>
                  </div>
                  
                  {/* Bot Name */}
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                    {botName.replace('Bot ', '')}
                  </span>
                  
                  {/* Document Count */}
                  <span className={`text-xl font-black ${isActive ? 'text-white' : 'text-gray-900'}`}>
                    {row.count}
                  </span>
                  
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <span className="material-symbols-outlined text-emerald-500 text-xs">check</span>
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="col-span-7 flex flex-col items-center justify-center py-8 text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2">folder_open</span>
              <p className="text-xs">{tO('admin.overview.noKbData')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Users Table */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] mb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-black text-on-surface">{tO('admin.overview.newestUsers')}</h3>
              <p className="text-sm text-on-surface-variant">{tO('admin.overview.recentAccounts')}</p>
            </div>
            <a href="/admin/users" className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold border border-slate-200 shadow-sm hover:-translate-x-1 hover:-translate-y-1 hover:shadow-sm transition-all">
              {tO('admin.overview.viewAll')} →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{tO('admin.overview.user')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{tO('admin.overview.role')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{tO('admin.overview.plan')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{tO('admin.overview.status')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{tO('admin.overview.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">{tO('admin.common.loading')}</td></tr>
                ) : recentUsers.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">{tO('admin.overview.noUsers')}</td></tr>
                ) : recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-black/10 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm border border-slate-300">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold border border-slate-300 bg-gray-100">
                        {u.role === 'admin' ? tO('admin.users.admin') : u.role === 'expert' ? tO('admin.overview.expert') : u.role === 'data_manager' ? tO('admin.overview.dataManager') : tO('admin.overview.user')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border border-slate-300 ${
                        u.plan === 'enterprise' ? 'bg-primary/20 text-primary' :
                        u.plan === 'pro' ? 'bg-secondary/20 text-secondary' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-slate-300 ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : u.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          u.status === 'active' ? 'bg-green-500' : u.status === 'suspended' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        {u.status === 'active' ? tO('admin.common.active') : u.status === 'suspended' ? tO('admin.overview.suspended') : tO('admin.users.pending')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface-variant">{timeAgo(u.lastLogin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-on-surface mb-6">{tO('admin.overview.quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/admin/users" className="p-6 rounded-2xl bg-white/60 border border-slate-300 hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-slate-300 flex items-center justify-center mb-4 shadow-sm">
                <span className="material-symbols-outlined text-primary text-xl">person_add</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{tO('admin.overview.manageUsers')}</h4>
              <p className="text-sm text-on-surface-variant">{tO('admin.overview.manageUsersDesc')}</p>
            </a>
            <a href="/admin/logs" className="p-6 rounded-2xl bg-white/60 border border-slate-300 hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 border border-slate-300 flex items-center justify-center mb-4 shadow-sm">
                <span className="material-symbols-outlined text-secondary text-xl">receipt_long</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{tO('admin.overview.systemLogs')}</h4>
              <p className="text-sm text-on-surface-variant">{tO('admin.overview.systemLogsDesc')}</p>
            </a>
            <a href="/admin/settings" className="p-6 rounded-2xl bg-white/60 border border-slate-300 hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-tertiary/20 border border-slate-300 flex items-center justify-center mb-4 shadow-sm">
                <span className="material-symbols-outlined text-tertiary text-xl">settings_suggest</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{tO('admin.overview.systemConfig')}</h4>
              <p className="text-sm text-on-surface-variant">{tO('admin.overview.systemConfigDesc')}</p>
            </a>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
export default AdminOverview;
