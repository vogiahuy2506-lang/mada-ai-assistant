import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken } from '@/lib/api';
import clsx from 'clsx';
import {
  ThumbsUp, ThumbsDown, MessageSquare,
  BarChart2, Calendar, TrendingUp,
  Loader2,
} from 'lucide-react';

type Language = 'vi' | 'en' | 'ar' | 'fr';

const translations: Record<Language, Record<string, string>> = {
  vi: {
    title: 'Phản hồi Chatbot',
    subtitle: 'Thống kê đánh giá của người dùng về các câu trả lời của chatbot.',
    likeCount: 'Lượt thích',
    dislikeCount: 'Lượt không thích',
    totalFeedback: 'Tổng phản hồi',
    satisfactionRate: 'Tỷ lệ hài lòng',
    topDislikeReasons: 'Lý do phản hồi tiêu cực',
    noDislikeReasons: 'Chưa có phản hồi tiêu cực',
    recentFeedback: 'Phản hồi gần đây',
    noFeedback: 'Chưa có phản hồi nào',
    timeRange: 'Khoảng thời gian:',
    range24h: '24 giờ',
    range7d: '7 ngày',
    range30d: '30 ngày',
    range90d: '90 ngày',
    allTime: 'Tất cả',
    loading: 'Đang tải...',
    reason: 'Lý do',
    count: 'Số lượng',
    date: 'Ngày',
    agent: 'Agent',
    rating: 'Đánh giá',
  },
  en: {
    title: 'Chatbot Feedback',
    subtitle: 'Statistics of user feedback on chatbot responses.',
    likeCount: 'Likes',
    dislikeCount: 'Dislikes',
    totalFeedback: 'Total Feedback',
    satisfactionRate: 'Satisfaction Rate',
    topDislikeReasons: 'Top Negative Feedback Reasons',
    noDislikeReasons: 'No negative feedback yet',
    recentFeedback: 'Recent Feedback',
    noFeedback: 'No feedback yet',
    timeRange: 'Time range:',
    range24h: '24 hours',
    range7d: '7 days',
    range30d: '30 days',
    range90d: '90 days',
    allTime: 'All time',
    loading: 'Loading...',
    reason: 'Reason',
    count: 'Count',
    date: 'Date',
    agent: 'Agent',
    rating: 'Rating',
  },
  ar: {
    title: 'تعليقات الشات بوت',
    subtitle: 'إحصائيات تعليقات المستخدمين على ردود الشات بوت.',
    likeCount: 'إعجابات',
    dislikeCount: 'عدم الإعجاب',
    totalFeedback: 'إجمالي التعليقات',
    satisfactionRate: 'معدل الرضا',
    topDislikeReasons: 'أسباب التعليقات السلبية',
    noDislikeReasons: 'لا توجد تعليقات سلبية بعد',
    recentFeedback: 'التعليقات الأخيرة',
    noFeedback: 'لا توجد تعليقات بعد',
    timeRange: 'الفترة الزمنية:',
    range24h: '24 ساعة',
    range7d: '7 أيام',
    range30d: '30 يومًا',
    range90d: '90 يومًا',
    allTime: 'كل الوقت',
    loading: 'جارٍ التحميل...',
    reason: 'السبب',
    count: 'العدد',
    date: 'التاريخ',
    agent: 'الوكيل',
    rating: 'التقييم',
  },
  fr: {
    title: 'Commentaires du Chatbot',
    subtitle: 'Statistiques des commentaires des utilisateurs sur les réponses du chatbot.',
    likeCount: 'J\'aime',
    dislikeCount: 'Je n\'aime pas',
    totalFeedback: 'Total des commentaires',
    satisfactionRate: 'Taux de satisfaction',
    topDislikeReasons: 'Raisons des commentaires négatifs',
    noDislikeReasons: 'Pas encore de commentaires négatifs',
    recentFeedback: 'Commentaires récents',
    noFeedback: 'Pas encore de commentaires',
    timeRange: 'Période:',
    range24h: '24 heures',
    range7d: '7 jours',
    range30d: '30 jours',
    range90d: '90 jours',
    allTime: 'Tout',
    loading: 'Chargement...',
    reason: 'Raison',
    count: 'Nombre',
    date: 'Date',
    agent: 'Agent',
    rating: 'Évaluation',
  },
};

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export default function AdminFeedback() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    stats: { rating: string; count: number }[];
    total: number;
    reasons: { reason: string; count: number }[];
  } | null>(null);

  const language: Language = 'vi'; // Default to Vietnamese

  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      
      if (timeRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (timeRange) {
          case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        params.append('start_date', startDate.toISOString());
      }
      
      const res = await fetch(`/api/chat/feedback/stats?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch feedback stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLikeCount = () => stats?.stats.find((s) => s.rating === 'like')?.count || 0;
  const getDislikeCount = () => stats?.stats.find((s) => s.rating === 'dislike')?.count || 0;
  const getSatisfactionRate = () => {
    const total = stats?.total || 0;
    if (total === 0) return 0;
    return Math.round((getLikeCount() / total) * 100);
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.feedback"
      subtitleKey="admin.topBar.feedbackSub"
      showLayoutTitle={false}
    >
      <div className="space-y-6">
        {/* Time Range Filter */}
        <div className="flex items-center gap-2 bg-white rounded-xl p-2 shadow-sm border border-slate-200/60">
          <Calendar className="w-4 h-4 text-slate-500 ml-2" />
          <span className="text-sm text-slate-600 font-medium">{t('timeRange')}</span>
          {(['24h', '7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                timeRange === range
                  ? 'bg-[#0047ff] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {range === '24h' ? t('range24h') :
               range === '7d' ? t('range7d') :
               range === '30d' ? t('range30d') :
               range === '90d' ? t('range90d') :
               t('allTime')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0047ff]" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Feedback */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
                    <p className="text-xs text-slate-500">{t('totalFeedback')}</p>
                  </div>
                </div>
              </div>

              {/* Likes */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ThumbsUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{getLikeCount()}</p>
                    <p className="text-xs text-slate-500">{t('likeCount')}</p>
                  </div>
                </div>
              </div>

              {/* Dislikes */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <ThumbsDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{getDislikeCount()}</p>
                    <p className="text-xs text-slate-500">{t('dislikeCount')}</p>
                  </div>
                </div>
              </div>

              {/* Satisfaction Rate */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    getSatisfactionRate() >= 70 ? 'bg-emerald-100' :
                    getSatisfactionRate() >= 50 ? 'bg-amber-100' : 'bg-red-100'
                  )}>
                    <TrendingUp className={clsx(
                      'w-5 h-5',
                      getSatisfactionRate() >= 70 ? 'text-emerald-600' :
                      getSatisfactionRate() >= 50 ? 'text-amber-600' : 'text-red-600'
                    )} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{getSatisfactionRate()}%</p>
                    <p className="text-xs text-slate-500">{t('satisfactionRate')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Satisfaction Bar */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3 mb-3">
                <BarChart2 className="w-5 h-5 text-slate-500" />
                <h3 className="font-semibold text-slate-900">Phân bố đánh giá</h3>
              </div>
              <div className="flex h-8 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${getSatisfactionRate()}%` }}
                >
                  {getSatisfactionRate() > 10 && `${getSatisfactionRate()}%`}
                </div>
                <div
                  className="bg-red-400 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${100 - getSatisfactionRate()}%` }}
                >
                  {100 - getSatisfactionRate() > 10 && `${100 - getSatisfactionRate()}%`}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {t('likeCount')}: {getLikeCount()}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  {t('dislikeCount')}: {getDislikeCount()}
                </span>
              </div>
            </div>

            {/* Dislike Reasons */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
              <h3 className="font-semibold text-slate-900 mb-4">{t('topDislikeReasons')}</h3>
              {stats?.reasons && stats.reasons.length > 0 ? (
                <div className="space-y-3">
                  {stats.reasons.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{item.reason}</p>
                      </div>
                      <div className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                        {item.count} {t('count').toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <ThumbsDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{t('noDislikeReasons')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
