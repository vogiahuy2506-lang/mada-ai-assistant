import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken, validateLocalToken, clearTokens } from '@/lib/api';
import clsx from 'clsx';
import {
  ThumbsUp, ThumbsDown, MessageSquare, MessageCircle,
  BarChart2, Calendar, TrendingUp, TrendingDown,
  Loader2, ExternalLink, History,
  Filter, Eye, RefreshCw,
  ChevronLeft, ChevronRight,
  Search, X,
  SmilePlus, Frown,
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
    viewChatHistory: 'Xem lịch sử chat',
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
    showAll: 'Xem tất cả',
    noData: 'Chưa có dữ liệu',
    viewDetail: 'Xem chi tiết',
    dislikeUp: 'Tăng',
    dislikeDown: 'Giảm',
    comparedLastMonth: 'so với tháng trước',
    chatHistory: 'Lịch sử chat',
    feedbackDetail: 'Chi tiết phản hồi',
    close: 'Đóng',
    prev: 'Trước',
    next: 'Tiếp',
    page: 'Trang',
    of: 'của',
    items: 'mục',
    reasonStats: 'Thống kê theo lý do',
    periodStats: 'Thống kê theo thời gian',
    dailyStats: 'Phản hồi theo ngày',
    monthlyTrend: 'Xu hướng hàng tháng',
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
    viewChatHistory: 'View chat history',
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
    showAll: 'Show all',
    noData: 'No data',
    viewDetail: 'View detail',
    dislikeUp: 'Increased',
    dislikeDown: 'Decreased',
    comparedLastMonth: 'compared to last month',
    chatHistory: 'Chat History',
    feedbackDetail: 'Feedback Detail',
    close: 'Close',
    prev: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    items: 'items',
    reasonStats: 'Reason Statistics',
    periodStats: 'Period Statistics',
    dailyStats: 'Daily Feedback',
    monthlyTrend: 'Monthly Trend',
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
    viewChatHistory: 'عرض سجل المحادثة',
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
    showAll: 'عرض الكل',
    noData: 'لا توجد بيانات',
    viewDetail: 'عرض التفاصيل',
    dislikeUp: 'زادت',
    dislikeDown: 'انخفضت',
    comparedLastMonth: 'مقارنة بالشهر الماضي',
    chatHistory: 'سجل المحادثة',
    feedbackDetail: 'تفاصيل التعليق',
    close: 'إغلاق',
    prev: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    items: 'عناصر',
    reasonStats: 'إحصائيات الأسباب',
    periodStats: 'إحصائيات الفترة',
    dailyStats: 'التعليقات اليومية',
    monthlyTrend: 'الاتجاه الشهري',
  },
  fr: {
    title: 'Commentaires du Chatbot',
    subtitle: 'Statistiques des commentaires des utilisateurs sur les réponses du chatbot.',
    likeCount: "J'aime",
    dislikeCount: "Je n'aime pas",
    totalFeedback: 'Total des commentaires',
    satisfactionRate: 'Taux de satisfaction',
    topDislikeReasons: 'Raisons des commentaires négatifs',
    noDislikeReasons: 'Pas encore de commentaires négatifs',
    recentFeedback: 'Commentaires récents',
    noFeedback: 'Pas encore de commentaires',
    viewChatHistory: "Voir l'historique",
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
    showAll: 'Tout afficher',
    noData: 'Pas de données',
    viewDetail: 'Voir les détails',
    dislikeUp: 'Augmenté',
    dislikeDown: 'Diminué',
    comparedLastMonth: 'par rapport au mois dernier',
    chatHistory: "Historique du chat",
    feedbackDetail: 'Détail du commentaire',
    close: 'Fermer',
    prev: 'Précédent',
    next: 'Suivant',
    page: 'Page',
    of: 'sur',
    items: 'éléments',
    reasonStats: 'Statistiques par raison',
    periodStats: 'Statistiques par période',
    dailyStats: 'Commentaires quotidiens',
    monthlyTrend: 'Tendance mensuelle',
  },
};

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

interface FeedbackItem {
  id: string;
  message_id: string;
  session_id: string;
  user_id: string | null;
  rating: 'like' | 'dislike';
  reason: string | null;
  agent_id: string | null;
  language: string | null;
  created_at: string;
}

interface StatsData {
  stats: { rating: string; count: number }[];
  total: number;
  reasons: { reason: string; count: number }[];
}

export default function AdminFeedback() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [chatHistoryModal, setChatHistoryModal] = useState<{ sessionId: string; isOpen: boolean } | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string; created_at?: string }>>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  
  const itemsPerPage = 10;
  const language: Language = 'vi';

  const t = (key: string) => translations[language]?.[key] || translations.vi[key] || key;

  // Calculate date range
  const getDateRange = useCallback(() => {
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

    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  }, [timeRange]);

  // Fetch feedback list with pagination
  const fetchFeedbackList = async (page = 1) => {
    setLoadingList(true);
    try {
      const token = validateLocalToken();
      if (!token.valid) {
        clearTokens();
        return;
      }

      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams();
      params.append('limit', String(itemsPerPage));
      params.append('offset', String((page - 1) * itemsPerPage));
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      const res = await fetch(`/api/chat/feedback/list?${params}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });

      if (res.ok) {
        const data = await res.json();
        setFeedbackList(data.data?.feedback || []);
        setTotalCount(data.data?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch feedback list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = validateLocalToken();
      if (!token.valid) {
        clearTokens();
        return;
      }

      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      const res = await fetch(`/api/chat/feedback/stats?${params}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
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

  useEffect(() => {
    fetchStats();
    fetchFeedbackList(1);
    setCurrentPage(1);
  }, [timeRange]);

  useEffect(() => {
    if (!loading) {
      fetchFeedbackList(currentPage);
    }
  }, [currentPage]);

  const getLikeCount = () => stats?.stats.find((s) => s.rating === 'like')?.count || 0;
  const getDislikeCount = () => stats?.stats.find((s) => s.rating === 'dislike')?.count || 0;
  const getSatisfactionRate = () => {
    const total = stats?.total || 0;
    if (total === 0) return 0;
    return Math.round((getLikeCount() / total) * 100);
  };

  // Filter feedback by search
  const filteredFeedback = searchQuery
    ? feedbackList.filter(
        (f) =>
          f.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.session_id?.includes(searchQuery) ||
          f.language?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : feedbackList;

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch chat history for a session
  const fetchChatHistory = async (sessionId: string) => {
    setLoadingChat(true);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/chat/feedback/conversation/${sessionId}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.feedback) {
          // Transform feedback data into chat messages format
          const messages = data.data.feedback
            .filter((f: any) => f.message_content)
            .map((f: any) => ({
              role: f.message_role || (f.rating === 'like' ? 'assistant' : 'user'),
              content: f.message_content,
              created_at: f.created_at,
            }));
          setChatMessages(messages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Open chat history modal
  const openChatHistory = (sessionId: string) => {
    setChatHistoryModal({ sessionId, isOpen: true });
    fetchChatHistory(sessionId);
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.feedback"
      subtitleKey="admin.topBar.feedbackSub"
      showLayoutTitle={false}
    >
      {/* Material Symbols font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      />

      <div className="space-y-6">
        {/* Time Range Filter */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 bg-white rounded-2xl p-2 shadow-sm border border-slate-200/60">
            <Calendar className="w-5 h-5 text-slate-500 ml-2" />
            <span className="text-sm text-slate-600 font-medium">{t('timeRange')}</span>
            {(['24h', '7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setCurrentPage(1);
                }}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                  timeRange === range
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {range === '24h'
                  ? t('range24h')
                  : range === '7d'
                  ? t('range7d')
                  : range === '30d'
                  ? t('range30d')
                  : range === '90d'
                  ? t('range90d')
                  : t('allTime')}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search') || 'Tìm kiếm...'}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <span className="text-slate-500">{t('loading')}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Feedback */}
              <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-sm">
                    <MessageSquare className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-900">{stats?.total || 0}</p>
                    <p className="text-sm text-slate-500 font-medium">{t('totalFeedback')}</p>
                  </div>
                </div>
              </div>

              {/* Likes */}
              <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
                    <ThumbsUp className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-900">{getLikeCount()}</p>
                    <p className="text-sm text-slate-500 font-medium">{t('likeCount')}</p>
                  </div>
                </div>
              </div>

              {/* Dislikes */}
              <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shadow-sm">
                    <ThumbsDown className="w-7 h-7 text-red-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-900">{getDislikeCount()}</p>
                    <p className="text-sm text-slate-500 font-medium">{t('dislikeCount')}</p>
                  </div>
                </div>
              </div>

              {/* Satisfaction Rate */}
              <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
                <div
                  className={clsx(
                    'absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500',
                    getSatisfactionRate() >= 70
                      ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/10'
                      : getSatisfactionRate() >= 50
                      ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10'
                      : 'bg-gradient-to-br from-red-500/10 to-orange-500/10'
                  )}
                />
                <div className="relative flex items-center gap-4">
                  <div
                    className={clsx(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm',
                      getSatisfactionRate() >= 70
                        ? 'bg-gradient-to-br from-emerald-100 to-green-100'
                        : getSatisfactionRate() >= 50
                        ? 'bg-gradient-to-br from-amber-100 to-orange-100'
                        : 'bg-gradient-to-br from-red-100 to-orange-100'
                    )}
                  >
                    <TrendingUp
                      className={clsx(
                        'w-7 h-7',
                        getSatisfactionRate() >= 70
                          ? 'text-emerald-600'
                          : getSatisfactionRate() >= 50
                          ? 'text-amber-600'
                          : 'text-red-600'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-900">{getSatisfactionRate()}%</p>
                    <p className="text-sm text-slate-500 font-medium">{t('satisfactionRate')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Satisfaction Bar + Dislike Reasons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Satisfaction Bar */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Phân bố đánh giá</h3>
                    <p className="text-xs text-slate-500">Tỷ lệ like/dislike</p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="flex h-10 rounded-xl overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center text-white text-sm font-bold transition-all duration-500"
                    style={{ width: `${getSatisfactionRate()}%` }}
                  >
                    {getSatisfactionRate() > 15 && (
                      <span className="flex items-center gap-1.5 px-3">
                        <ThumbsUp className="w-4 h-4" />
                        {getSatisfactionRate()}%
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-gradient-to-r from-red-400 to-rose-500 flex items-center justify-center text-white text-sm font-bold transition-all duration-500"
                    style={{ width: `${100 - getSatisfactionRate()}%` }}
                  >
                    {100 - getSatisfactionRate() > 15 && (
                      <span className="flex items-center gap-1.5 px-3">
                        <ThumbsDown className="w-4 h-4" />
                        {100 - getSatisfactionRate()}%
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
                    <span className="text-sm text-slate-600 font-medium">
                      {t('likeCount')}: {getLikeCount()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-rose-500" />
                    <span className="text-sm text-slate-600 font-medium">
                      {t('dislikeCount')}: {getDislikeCount()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dislike Reasons */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Frown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{t('topDislikeReasons')}</h3>
                    <p className="text-xs text-slate-500">{t('reasonStats')}</p>
                  </div>
                </div>
                
                {stats?.reasons && stats.reasons.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {stats.reasons.slice(0, 5).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-red-50/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{item.reason}</p>
                        </div>
                        <div className="px-3 py-1.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                          {item.count}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <SmilePlus className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t('noDislikeReasons')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Feedback List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <History className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{t('recentFeedback')}</h3>
                    <p className="text-xs text-slate-500">
                      {totalCount} {t('items')}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    fetchStats();
                    fetchFeedbackList(currentPage);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Làm mới
                </button>
              </div>

              {/* Table */}
              {loadingList ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : filteredFeedback.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('rating')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('reason')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Ngôn ngữ
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('date')}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('chatHistory')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredFeedback.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className={clsx(
                                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold',
                                  item.rating === 'like'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                )}
                              >
                                {item.rating === 'like' ? (
                                  <>
                                    <ThumbsUp className="w-4 h-4" />
                                    Thích
                                  </>
                                ) : (
                                  <>
                                    <ThumbsDown className="w-4 h-4" />
                                    Không thích
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-xs">
                                <p className="text-sm text-slate-700 truncate">
                                  {item.reason || (
                                    <span className="text-slate-400 italic">Không có lý do</span>
                                  )}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-slate-600 capitalize">
                                {item.language || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-slate-500">
                                {formatDate(item.created_at)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              {item.session_id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedFeedback(item)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title={t('viewDetail')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openChatHistory(item.session_id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title={t('viewChatHistory')}
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="hidden lg:inline">Xem chat</span>
                                  </button>
                                  <a
                                    href={`/chat?session=${item.session_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title={t('viewChatHistory')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        {t('page')} {currentPage} {t('of')} {totalPages} • {totalCount} {t('items')}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={clsx(
                                'w-10 h-10 rounded-xl text-sm font-semibold transition-all',
                                currentPage === pageNum
                                  ? 'bg-indigo-500 text-white shadow-md'
                                  : 'text-slate-600 hover:bg-slate-100'
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">{t('noFeedback')}</p>
                  <p className="text-sm text-slate-400 mt-1">{t('noData')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedFeedback(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    selectedFeedback.rating === 'like'
                      ? 'bg-emerald-100'
                      : 'bg-red-100'
                  )}
                >
                  {selectedFeedback.rating === 'like' ? (
                    <ThumbsUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <ThumbsDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{t('feedbackDetail')}</h3>
                  <p className="text-xs text-slate-500">{formatDate(selectedFeedback.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Rating */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-20">{t('rating')}:</span>
                <span
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm font-semibold',
                    selectedFeedback.rating === 'like'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {selectedFeedback.rating === 'like' ? 'Thích' : 'Không thích'}
                </span>
              </div>

              {/* Reason */}
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-500 w-20 pt-1">{t('reason')}:</span>
                <span className="text-sm text-slate-700 flex-1">
                  {selectedFeedback.reason || (
                    <span className="text-slate-400 italic">Không có lý do</span>
                  )}
                </span>
              </div>

              {/* Language */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-20">Ngôn ngữ:</span>
                <span className="text-sm text-slate-700 capitalize">
                  {selectedFeedback.language || 'N/A'}
                </span>
              </div>

              {/* Session ID */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-20">Session:</span>
                <span className="text-sm text-slate-700 font-mono text-xs">
                  {selectedFeedback.session_id || 'N/A'}
                </span>
              </div>

              {/* Actions */}
              {selectedFeedback.session_id && (
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSelectedFeedback(null);
                      openChatHistory(selectedFeedback.session_id);
                    }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-violet-600 transition-all shadow-md hover:shadow-lg"
                  >
                    <MessageCircle className="w-5 h-5" />
                    {t('viewChatHistory')}
                  </button>
                  <a
                    href={`/chat?session=${selectedFeedback.session_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Mở trong tab mới
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat History Modal */}
      {chatHistoryModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setChatHistoryModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{t('chatHistory')}</h3>
                  <p className="text-xs text-slate-500 font-mono">{chatHistoryModal.sessionId}</p>
                </div>
              </div>
              <button
                onClick={() => setChatHistoryModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {loadingChat ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-sm text-slate-500">Đang tải lịch sử chat...</span>
                  </div>
                </div>
              ) : chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={clsx(
                        'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.created_at && (
                        <p className={clsx(
                          'text-[10px] mt-1',
                          msg.role === 'user' ? 'text-white/60' : 'text-slate-400'
                        )}>
                          {formatDate(msg.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium">Không có tin nhắn nào</p>
                  <p className="text-xs text-slate-400 mt-1">Lịch sử chat không khả dụng</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <a
                href={`/chat?session=${chatHistoryModal.sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-violet-600 transition-all shadow-md hover:shadow-lg"
              >
                <ExternalLink className="w-5 h-5" />
                Mở cuộc trò chuyện đầy đủ
              </a>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
