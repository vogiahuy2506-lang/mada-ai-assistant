import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, AdminUser, KnowledgeStats, UserStats } from './adminApi';
import { useTranslation, TranslationKey } from '@/lib/translations';
import { useLanguageStore } from '@/stores';

// Translation helper hook that uses useLanguageStore
function useAdminOverviewTranslation() {
  const { language } = useLanguageStore();
  const { t } = useTranslation();
  
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
    return t(botKeyMap[botId] || botId);
  };

  return { t, language, getBotName };
}

function timeAgo(iso: string | null, t: (key: TranslationKey) => string): string {
  if (!iso) return t('admin.users.neverLogin');
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} ${t('time.secondsAgo')}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t('time.minutesAgo')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('time.hoursAgo')}`;
  const d = Math.floor(h / 24);
  return `${d} ${t('time.daysAgo')}`;
}

export function AdminOverview() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [filterBotId, setFilterBotId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const { t, getBotName } = useAdminOverviewTranslation();

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
      title={t('admin.topBar.overview')}
      titleEn="System Overview"
      titleAr="نظرة عامة على النظام"
      titleFr="Aperçu du système"
      subtitle={t('admin.topBar.overviewSub')}
      subtitleEn="Track users, knowledge base and MADA AI activity in real time."
      subtitleAr="تتبع المستخدمين وقاعدة المعرفة ونشاط MADA AI في الوقت الفعلي."
      subtitleFr="Suivez les utilisateurs, la base de connaissances et l'activité MADA AI en temps réel."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {t('admin.overview.title')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {t('admin.overview.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.overview.totalUsers').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.total ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{userStats?.active ?? 0} {t('admin.overview.active')}</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.overview.kbDocs').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{kbStats?.totalDocuments ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {filterBotId ? `${t('admin.overview.bot')}: ${filterBotId}` : `${kbStats?.totalCategories ?? 0} ${t('admin.overview.categories')}`}
            </p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-tertiary/10 to-tertiary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-tertiary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.overview.enterprisePlans').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.enterprise ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{t('admin.overview.premiumCustomers')}</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-error/10 to-error/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-error/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-error text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.overview.suspendedAccounts').toUpperCase()}</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.suspended ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{t('admin.overview.needsAction')}</p>
          </div>
        </div>
      </section>

      {/* KB Filter + Per-Bot Breakdown */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] mb-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-black text-on-surface">{t('admin.overview.kbByBot')}</h3>
            <p className="text-sm text-on-surface-variant">{t('admin.overview.filterByBots')}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">{t('admin.overview.botId')}:</label>
            <select
              value={filterBotId}
              onChange={(e) => setFilterBotId(e.target.value)}
              className="h-10 px-3 rounded-lg border-2 border-black font-label-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('admin.overview.allBots')}</option>
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {kbStats?.perBot && kbStats.perBot.length > 0 ? (
            kbStats.perBot.map((row: any) => (
              <button
                key={row.botId}
                onClick={() => setFilterBotId(filterBotId === row.botId ? '' : row.botId)}
                className={`text-left p-3 rounded-xl border-2 border-black transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] ${filterBotId === row.botId ? 'bg-primary text-white' : 'bg-white'}`}
              >
                <div className="text-[10px] font-bold uppercase opacity-70">{row.botId.replace('bot-', '')}</div>
                <div className="text-2xl font-black mt-1">{row.count}</div>
                <div className="text-[10px] mt-1 opacity-60">{t('admin.overview.documents')}</div>
              </button>
            ))
          ) : (
            <div className="col-span-7 text-sm text-on-surface-variant text-center py-8">
              {t('admin.overview.noKbData')}
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
              <h3 className="text-2xl font-black text-on-surface">{t('admin.overview.newestUsers')}</h3>
              <p className="text-sm text-on-surface-variant">{t('admin.overview.recentAccounts')}</p>
            </div>
            <a href="/admin/users" className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all">
              {t('admin.overview.viewAll')} →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.overview.user')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.overview.role')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.overview.plan')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.overview.status')}</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.overview.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">{t('admin.common.loading')}</td></tr>
                ) : recentUsers.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">{t('admin.overview.noUsers')}</td></tr>
                ) : recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-black/10 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm border-2 border-black">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold border-2 border-black bg-gray-100">
                        {u.role === 'admin' ? t('admin.users.admin') : u.role === 'expert' ? t('admin.overview.expert') : u.role === 'data_manager' ? t('admin.overview.dataManager') : t('admin.overview.user')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-black ${
                        u.plan === 'enterprise' ? 'bg-primary/20 text-primary' :
                        u.plan === 'pro' ? 'bg-secondary/20 text-secondary' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-black ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : u.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          u.status === 'active' ? 'bg-green-500' : u.status === 'suspended' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        {u.status === 'active' ? t('admin.common.active') : u.status === 'suspended' ? t('admin.overview.suspended') : t('admin.users.pending')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface-variant">{timeAgo(u.lastLogin, t)}</td>
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
          <h3 className="text-2xl font-black text-on-surface mb-6">{t('admin.overview.quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/admin/users" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-primary text-xl">person_add</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{t('admin.overview.manageUsers')}</h4>
              <p className="text-sm text-on-surface-variant">{t('admin.overview.manageUsersDesc')}</p>
            </a>
            <a href="/admin/logs" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-secondary text-xl">receipt_long</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{t('admin.overview.systemLogs')}</h4>
              <p className="text-sm text-on-surface-variant">{t('admin.overview.systemLogsDesc')}</p>
            </a>
            <a href="/admin/settings" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-tertiary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-tertiary text-xl">settings_suggest</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{t('admin.overview.systemConfig')}</h4>
              <p className="text-sm text-on-surface-variant">{t('admin.overview.systemConfigDesc')}</p>
            </a>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
export default AdminOverview;
