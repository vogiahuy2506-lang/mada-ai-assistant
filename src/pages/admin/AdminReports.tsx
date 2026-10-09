/**
 * AdminReports - Unified page combining Activity Logs (Audit) and Analytics tabs.
 * Merged from AdminAudit.tsx + AdminAnalytics.tsx
 * 
 * Enhanced Analytics with:
 * - KPI Overview Cards
 * - Like/Dislike Trend Charts
 * - Satisfaction by Module
 * - Detailed Feedback Logs Table
 * - Chat Review Drawer
 */
import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/stores';
import { translations, Language } from '@/lib/translations';
import clsx from 'clsx';
import { RefreshCw, Download as FileDownload, Search, Filter, X, MessageSquare, Star, Check, ShieldCheck, Loader2 } from 'lucide-react';

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

// ============== ENHANCED ANALYTICS TAB COMPONENT ==============
type TimeRange = '7d' | '30d' | 'quarter';

// Mock data for demonstration - in production, this would come from API
interface FeedbackItem {
  id: string;
  time: string;
  date: string;
  module: string;
  moduleIcon: string;
  question: string;
  userType: string;
  rating: 'like' | 'dislike';
  reason: string;
  feedback: string;
  status: 'pending' | 'fine-tuned' | 'resolved' | 'ignored';
  chatTranscript?: {
    user: string;
    ai: string;
    userFeedback: string;
  };
}

interface ModuleStats {
  name: string;
  icon: string;
  satisfaction: number;
  totalResponses: number;
  likes: number;
  dislikes: number;
}

// Sample data
const SAMPLE_MODULE_STATS: ModuleStats[] = [
  { name: 'Thị giác', icon: 'visibility', satisfaction: 96.4, totalResponses: 14120, likes: 13611, dislikes: 509 },
  { name: 'Thính giác', icon: 'hearing', satisfaction: 95.1, totalResponses: 11430, likes: 10870, dislikes: 560 },
  { name: 'Hỗ trợ Nhận thức', icon: 'psychology', satisfaction: 92.8, totalResponses: 8290, likes: 7693, dislikes: 597 },
  { name: 'Vận động Tinh tế', icon: 'front_hand', satisfaction: 91.6, totalResponses: 6140, likes: 5624, dislikes: 516 },
  { name: 'Di chuyển & K.gian', icon: 'accessible_forward', satisfaction: 93.9, totalResponses: 4180, likes: 3925, dislikes: 255 },
  { name: 'Học tập Hòa nhập', icon: 'school', satisfaction: 94.7, totalResponses: 2850, likes: 2699, dislikes: 151 },
  { name: 'Lời nói & AAC', icon: 'record_voice_over', satisfaction: 88.5, totalResponses: 1240, likes: 1098, dislikes: 142 },
];

const SAMPLE_FEEDBACK: FeedbackItem[] = [
  {
    id: '#MADA-94812',
    time: '10:42 SA',
    date: 'Hôm nay, 24/11',
    module: 'Thính giác',
    moduleIcon: 'hearing',
    question: 'Máy trợ thính Phonak Audeo Lumity có tính năng khử nhiễu gió ngoài trời không?',
    userType: 'Người dùng cao tuổi',
    rating: 'dislike',
    reason: 'Chưa chính xác',
    feedback: 'AI bảo dòng L30 có AutoSense 5.0 khử gió hoàn toàn là sai, dòng này chỉ cắt giảm tiếng ồn cơ bản. Tôi suýt mua nhầm.',
    status: 'pending',
    chatTranscript: {
      user: 'Máy trợ thính Phonak Audeo Lumity có tính năng khử nhiễu gió ngoài trời không? Tôi hay tập thể dục buổi sáng ven hồ thì nên mua model nào?',
      ai: 'Chào bác, dòng máy trợ thính Phonak Audéo Lumity được trang bị công nghệ nhận diện môi trường AutoSense OS 5.0. Bác hoàn toàn có thể chọn phiên bản Lumity L30 (mức cơ bản), máy đã tích hợp tính năng Speech in Wind giúp lọc sạch hoàn toàn tiếng rít gió. Bác có muốn kết nối với trung tâm trợ thính gần nhất để đo thính lực đồ miễn phí không?',
      userFeedback: 'AI bảo dòng L30 có Speech in Wind là sai nghiêm trọng! Tính năng này chỉ có trên dòng cao cấp L70 và L90.',
    }
  },
  {
    id: '#MADA-94788',
    time: '09:18 SA',
    date: 'Hôm nay, 24/11',
    module: 'Thị giác',
    moduleIcon: 'visibility',
    question: 'Hướng dẫn thiết lập phím tắt đọc màn hình NVDA đọc văn bản song ngữ Việt - Anh',
    userType: 'Sinh viên khiếm thị',
    rating: 'like',
    reason: 'Rất hữu ích',
    feedback: 'Hướng dẫn chi tiết từng tổ hợp phím NVDA+Ctrl+V chuyển đổi voice profile rất mạch lạc, áp dụng được ngay.',
    status: 'fine-tuned',
  },
  {
    id: '#MADA-94692',
    time: '08:50 SA',
    date: 'Hôm nay, 24/11',
    module: 'Vận động Tinh tế',
    moduleIcon: 'front_hand',
    question: 'Tìm chuột máy tính điều khiển bằng mắt hoặc cằm cho người liệt tứ chi sau tai nạn',
    userType: 'Thân nhân người bệnh',
    rating: 'dislike',
    reason: 'Gợi ý sản phẩm chưa khớp',
    feedback: 'MADA gợi ý chuột bi xoay thông thường (Trackball). Người bệnh không dùng được tay thì làm sao xoay bi? Cần thiết bị Tobii Dynavox.',
    status: 'resolved',
  },
  {
    id: '#MADA-94520',
    time: '22:15 CH',
    date: 'Hôm qua, 23/11',
    module: 'Hỗ trợ Nhận thức',
    moduleIcon: 'psychology',
    question: 'Lịch biểu trực quan dành cho trẻ tự kỷ 6 tuổi bắt đầu vào lớp hòa nhập',
    userType: 'Phụ huynh can thiệp sớm',
    rating: 'dislike',
    reason: 'Chưa đủ thông tin',
    feedback: 'Lời khuyên chung chung. Cần biểu mẫu hình ảnh PECS cụ thể có thể tải về in ra ngay cho cháu.',
    status: 'pending',
  },
  {
    id: '#MADA-94411',
    time: '18:40 CH',
    date: 'Hôm qua, 23/11',
    module: 'Học tập Hòa nhập',
    moduleIcon: 'school',
    question: 'Chính sách hỗ trợ chi phí mua trang thiết bị học tập trợ năng theo luật NKT 2024',
    userType: 'Giáo viên đặc biệt',
    rating: 'like',
    reason: 'Trích dẫn chính xác',
    feedback: 'Trích đúng điều 28 và nghị định liên quan, kèm địa chỉ nộp hồ sơ tại Sở LĐ-TB&XH địa phương.',
    status: 'fine-tuned',
  },
];

function getStatusBadge(status: FeedbackItem['status'], lang: string) {
  const statusConfig = {
    pending: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Chờ chuyên gia', pulse: true },
    'fine-tuned': { bg: 'bg-tertiary/20', text: 'text-tertiary', label: 'Đã nạp fine-tune', pulse: false },
    resolved: { bg: 'bg-secondary/20', text: 'text-secondary', label: 'Đã giải quyết', pulse: false },
    ignored: { bg: 'bg-outline', text: 'text-on-surface-variant', label: 'Bỏ qua', pulse: false },
  };
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bg} ${config.text} text-xs font-semibold`}>
      {config.pulse && <span className="w-2 h-2 rounded-full bg-error animate-ping" />}
      {config.label}
    </span>
  );
}

function AnalyticsTab() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterModule, setFilterModule] = useState('ALL');
  const [filterRating, setFilterRating] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedChat, setSelectedChat] = useState<FeedbackItem | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [expertNotes, setExpertNotes] = useState('');
  const [includeRLHF, setIncludeRLHF] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ modules: ModuleStats[]; totals: { totalResponses: number; likes: number; dislikes: number; satisfaction: number } }>({ modules: [], totals: { totalResponses: 0, likes: 0, dislikes: 0, satisfaction: 0 } });
  const { t, language } = useReportsTranslation();

  // Module display name mapping
  const moduleDisplayMap: Record<string, string> = {
    'vision': 'Thị giác',
    'hearing': 'Thính giác',
    'mobility': 'Vận động',
    'communication': 'Giao tiếp',
    'cognition': 'Nhận thức',
    'daily_living': 'Sinh hoạt',
    'education': 'Giáo dục',
    'general': 'Tổng quát',
  };

  // Fetch real data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch stats and feedback in parallel
      const [statsRes, feedbackRes] = await Promise.all([
        fetch('/api/admin/feedback/stats', { headers }),
        fetch('/api/admin/feedback?limit=100', { headers }),
      ]);

      const statsData = await statsRes.json();
      const feedbackData = await feedbackRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }

      if (feedbackData.success) {
        // Map API response to FeedbackItem format
        const mappedFeedback: FeedbackItem[] = feedbackData.data.items.map((item: any) => ({
          id: item.id,
          time: new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          module: item.module || 'general',
          moduleIcon: item.module || 'general',
          question: item.question || 'Không có nội dung',
          userType: item.userName || 'Khách',
          rating: item.rating,
          reason: item.reason || '',
          feedback: item.reason || '',
          status: item.status as 'pending' | 'fine-tuned' | 'resolved' | 'ignored',
          userId: item.userId,
          sessionId: item.sessionId,
          messageId: item.messageId,
        }));
        setFeedback(mappedFeedback);
      }
    } catch (error) {
      console.error('Failed to fetch feedback data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter feedback based on filters
  const filteredFeedback = feedback.filter((item) => {
    const searchMatch = !filterSearch || 
      item.question.toLowerCase().includes(filterSearch.toLowerCase()) ||
      item.reason.toLowerCase().includes(filterSearch.toLowerCase()) ||
      item.userType.toLowerCase().includes(filterSearch.toLowerCase());
    const moduleMatch = filterModule === 'ALL' || item.module === filterModule;
    const ratingMatch = filterRating === 'ALL' || 
      (filterRating === 'DISLIKE' && item.rating === 'dislike') ||
      (filterRating === 'LIKE' && item.rating === 'like');
    const statusMap: Record<string, string> = {
      'Chờ chuyên gia': 'pending',
      'Đã nạp fine-tune': 'fine-tuned',
      'Đã giải quyết': 'resolved',
      'Bỏ qua': 'ignored',
    };
    const statusMatch = filterStatus === 'ALL' || 
      (statusMap[filterStatus] === item.status);
    return searchMatch && moduleMatch && ratingMatch && statusMatch;
  });

  // Use real stats from API
  const totalResponses = stats.totals.totalResponses;
  const totalLikes = stats.totals.likes;
  const totalDislikes = stats.totals.dislikes;
  const satisfactionRate = stats.totals.satisfaction.toFixed(1);
  const avgResponseRate = stats.modules.length > 0 ? Math.round(totalResponses / Math.max(1, stats.modules.length)) : 0;
  // Staff escalations = dislikes that need expert review (pending status)
  const staffEscalations = feedback.filter(f => f.rating === 'dislike' && f.status === 'pending').length;
  const resolvedRate = totalDislikes > 0 ? Math.round(((totalDislikes - staffEscalations) / totalDislikes) * 100) : 100;
  const avgInterventionTime = '3.4 phút';

  // Dislike reasons breakdown
  const dislikeReasons = [
    { label: 'Chưa chính xác', value: 42, count: 1176, color: 'bg-error' },
    { label: 'Chưa đủ thông tin', value: 28, count: 784, color: 'bg-primary' },
    { label: 'Gợi ý SP chưa khớp', value: 18, count: 504, color: 'bg-secondary' },
    { label: 'Lý do khác', value: 12, count: 336, color: 'bg-outline-variant' },
  ];

  const handleOpenChat = (item: FeedbackItem) => {
    setSelectedChat(item);
    setExpertNotes('');
    setIncludeRLHF(true);
    setChatDrawerOpen(true);
  };

  const handleFlagForReview = (id: string) => {
    alert(`Đã đưa đoạn hội thoại ${id} vào hàng đợi xét duyệt của Hội đồng Y tế Trợ năng MADA.`);
  };

  const handleSubmitResolution = () => {
    alert('Đã cập nhật vector dữ liệu mới và chuyển trạng thái: ĐÃ NẠP FINE-TUNE MODEL.');
    if (selectedChat) {
      setFeedback(prev => prev.map(f => 
        f.id === selectedChat.id ? { ...f, status: 'fine-tuned' as const } : f
      ));
    }
    setChatDrawerOpen(false);
  };

  const resetFilters = () => {
    setFilterSearch('');
    setFilterModule('ALL');
    setFilterRating('ALL');
    setFilterStatus('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Top Command & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Hệ thống Giám sát Lâm sàng & Độ chính xác AI</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface">Đánh Giá & Phản Hồi Mô Hình MADA AI</h2>
          <p className="text-sm text-on-surface-variant">Phân tích tín hiệu tương tác thời gian thực từ mạng lưới hỗ trợ trợ năng quốc gia</p>
        </div>
        
        {/* Quick Date Filter & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-container rounded-xl p-1 shadow-sm">
            {(['7d', '30d', 'quarter'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                  range === r 
                    ? 'bg-white shadow-sm text-primary' 
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                {r === '7d' ? '7 ngày qua' : r === '30d' ? '30 ngày' : 'Quý này'}
              </button>
            ))}
          </div>
          <button className="h-11 px-4 bg-primary hover:bg-primary-container text-on-primary rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-sm">
            <span className="material-symbols-outlined text-xl">download</span>
            <span className="hidden sm:inline">Xuất báo cáo (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Total Responses */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-surface-container rounded-full opacity-40 group-hover:scale-110 transition-transform"></div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tổng Lượt Phản Hồi</span>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">forum</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-on-surface">{totalResponses.toLocaleString()}</span>
              <span className="text-xs font-semibold text-tertiary flex items-center">
                <span className="material-symbols-outlined text-sm">arrow_upward</span> +8.4%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-container-low">
            <span className="text-sm text-on-surface-variant">Tốc độ sinh phản hồi</span>
            <span className="text-sm font-semibold text-on-surface">{avgResponseRate} câu/giờ</span>
          </div>
        </div>

        {/* Card 2: Satisfaction Rate */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-tertiary-fixed/30 rounded-full opacity-40 group-hover:scale-110 transition-transform"></div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tỷ Lệ Hài Lòng (Like)</span>
              <div className="w-10 h-10 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">sentiment_very_satisfied</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-tertiary">{satisfactionRate}%</span>
              <span className="text-xs font-semibold text-tertiary flex items-center">
                <span className="material-symbols-outlined text-sm">arrow_upward</span> +1.8%
              </span>
            </div>
          </div>
          {/* Mini Progress Meter */}
          <div className="pt-4 mt-4 border-t border-surface-container-low flex items-center gap-3">
            <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-tertiary h-full rounded-full" style={{ width: `${satisfactionRate}%` }}></div>
            </div>
            <span className="text-xs font-semibold text-tertiary">Đạt chuẩn WCAG</span>
          </div>
        </div>

        {/* Card 3: Like vs Dislike Breakdown */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tỷ Trọng Đánh Giá</span>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-xl">thumbs_up_down</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-1">
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5 text-tertiary mb-1">
                  <span className="material-symbols-outlined text-sm">thumb_up</span>
                  <span className="text-xs font-semibold">Like</span>
                </div>
                <span className="text-lg font-bold text-on-surface block">{totalLikes.toLocaleString()}</span>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5 text-error mb-1">
                  <span className="material-symbols-outlined text-sm">thumb_down</span>
                  <span className="text-xs font-semibold">Dislike</span>
                </div>
                <span className="text-lg font-bold text-on-surface block">{totalDislikes.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-container-low">
            <span className="text-sm text-on-surface-variant">Tỷ lệ Dislike thực</span>
            <span className="text-sm font-semibold text-error">{((totalDislikes/totalResponses)*100).toFixed(1)}% (Ngưỡng an toàn &lt;8%)</span>
          </div>
        </div>

        {/* Card 4: Staff Escalations */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-surface-container-high rounded-full opacity-40 group-hover:scale-110 transition-transform"></div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Chuyển Tiếp Chuyên Gia</span>
              <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">support_agent</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-on-surface">{staffEscalations}</span>
              <span className="text-xs font-semibold text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span> {resolvedRate}% Đã giải quyết
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-container-low">
            <span className="text-sm text-on-surface-variant">Thời gian can thiệp TB</span>
            <span className="text-sm font-semibold text-primary">{avgInterventionTime}</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Section (2 Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Like/Dislike Trend Line Chart (7 Columns) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Xu Hướng Tương Tác Theo Ngày</h3>
              <p className="text-sm text-on-surface-variant">Biến thiên phản hồi đánh giá trong 7 chu kỳ gần nhất</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary"></span>
                <span className="text-xs text-on-surface-variant">Lượt Like</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-error"></span>
                <span className="text-xs text-on-surface-variant">Lượt Dislike</span>
              </div>
            </div>
          </div>
          
          {/* Trend Chart SVG */}
          <div className="w-full h-64 relative flex flex-col justify-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 240">
              {/* Background Grid Lines */}
              <line stroke="#eaedff" strokeDasharray="4" strokeWidth="1" x1="40" x2="680" y1="30" y2="30"></line>
              <line stroke="#eaedff" strokeDasharray="4" strokeWidth="1" x1="40" x2="680" y1="90" y2="90"></line>
              <line stroke="#eaedff" strokeDasharray="4" strokeWidth="1" x1="40" x2="680" y1="150" y2="150"></line>
              <line stroke="#eaedff" strokeWidth="1" x1="40" x2="680" y1="210" y2="210"></line>
              {/* Axis Labels */}
              <text className="fill-outline text-[11px]" x="10" y="34">7.5k</text>
              <text className="fill-outline text-[11px]" x="10" y="94">5.0k</text>
              <text className="fill-outline text-[11px]" x="10" y="154">2.5k</text>
              <text className="fill-outline text-[11px]" x="15" y="214">0</text>
              {/* Area Under Like Trend Curve */}
              <linearGradient id="likeGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#006b5f" stopOpacity="0.25"></stop>
                <stop offset="100%" stopColor="#006b5f" stopOpacity="0.0"></stop>
              </linearGradient>
              <path d="M 60,140 Q 150,110 240,80 T 420,60 T 510,75 T 660,40 L 660,210 L 60,210 Z" fill="url(#likeGradient)"></path>
              {/* Like Trend Line */}
              <path d="M 60,140 Q 150,110 240,80 T 420,60 T 510,75 T 660,40" fill="none" stroke="#006b5f" strokeLinecap="round" strokeWidth="3.5"></path>
              {/* Dislike Trend Line */}
              <path d="M 60,195 Q 150,190 240,185 T 420,188 T 510,180 T 660,192" fill="none" stroke="#ba1a1a" strokeDasharray="6 3" strokeLinecap="round" strokeWidth="2.5"></path>
              {/* Data Points (Likes) */}
              <circle cx="60" cy="140" fill="#ffffff" r="4.5" stroke="#006b5f" strokeWidth="3"></circle>
              <circle cx="240" cy="80" fill="#ffffff" r="4.5" stroke="#006b5f" strokeWidth="3"></circle>
              <circle cx="420" cy="60" fill="#ffffff" r="4.5" stroke="#006b5f" strokeWidth="3"></circle>
              <circle cx="510" cy="75" fill="#ffffff" r="4.5" stroke="#006b5f" strokeWidth="3"></circle>
              <circle cx="660" cy="40" fill="#006b5f" r="5" stroke="#ffffff" strokeWidth="2"></circle>
            </svg>
            {/* X-Axis Labels */}
            <div className="flex justify-between px-6 pt-3 text-on-surface-variant text-xs">
              <span>Thứ 2 (18/11)</span>
              <span>Thứ 3</span>
              <span>Thứ 4</span>
              <span>Thứ 5</span>
              <span>Thứ 6</span>
              <span>Thứ 7</span>
              <span className="text-primary font-bold">Chủ Nhật (Hôm nay)</span>
            </div>
          </div>
          
          {/* Quick Insight Footer */}
          <div className="mt-4 p-3.5 bg-surface-container-low rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-xl">insights</span>
              <span className="text-sm text-on-surface">Độ hài lòng đạt mức đỉnh <strong>96.8%</strong> vào ngày Thứ Năm sau khi cập nhật bộ quy chuẩn Thính Giác v2.4.</span>
            </div>
            <span className="text-xs text-secondary font-semibold cursor-pointer hover:underline hidden sm:inline">Chi tiết bản vá</span>
          </div>
        </div>

        {/* Chart 2: Dislike Reasons Breakdown (Donut + Progress) (5 Columns) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Lý Do Đánh Giá Dislike</h3>
              <p className="text-sm text-on-surface-variant">Phân tích từ {totalDislikes.toLocaleString()} lượt phản hồi tiêu cực</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-error-container text-on-error-container text-xs font-semibold">Cần tối ưu</span>
          </div>

          {/* Donut Visual + Centered Stat */}
          <div className="flex items-center justify-center gap-6 my-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="none" r="38" stroke="#eaedff" strokeWidth="14"></circle>
                <circle cx="50" cy="50" fill="none" r="38" stroke="#ba1a1a" strokeDasharray="100.2 238.7" strokeDashoffset="0" strokeWidth="14"></circle>
                <circle cx="50" cy="50" fill="none" r="38" stroke="#004d57" strokeDasharray="66.8 238.7" strokeDashoffset="-100.2" strokeWidth="14"></circle>
                <circle cx="50" cy="50" fill="none" r="38" stroke="#006b5f" strokeDasharray="43.0 238.7" strokeDashoffset="-167" strokeWidth="14"></circle>
                <circle cx="50" cy="50" fill="none" r="38" stroke="#bec8ca" strokeDasharray="28.6 238.7" strokeDashoffset="-210" strokeWidth="14"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-on-surface">{(totalDislikes/1000).toFixed(1)}k</span>
                <span className="text-xs text-on-surface-variant">Lượt phản hồi</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
              {dislikeReasons.map((reason, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="flex items-center gap-1.5 text-on-surface">
                      <span className={`w-2.5 h-2.5 rounded-full ${reason.color}`}></span>
                      {reason.label}
                    </span>
                    <span className={`font-semibold ${idx === 0 ? 'text-error' : 'text-on-surface'}`}>{reason.value}% ({reason.count.toLocaleString()})</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${reason.color}`} style={{ width: `${reason.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Note */}
          <button className="w-full mt-3 py-2.5 bg-surface-container-low hover:bg-surface-container text-primary text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined text-xl">psychology_alt</span>
            <span>Gửi dữ liệu huấn luyện Reinforcement Learning</span>
          </button>
        </div>
      </div>

      {/* Satisfaction by Specialized Chatbot Module */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Mức Độ Hài Lòng Theo 7 Module Chuyên Ngành</h3>
            <p className="text-sm text-on-surface-variant">So sánh tỷ lệ Like, chỉ số phản hồi và khối lượng tương tác phân theo khoa trợ năng</p>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-xl">verified</span>
            <span>Dữ liệu xác thực bởi Hội đồng Y tế Trợ năng Quốc gia</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="ml-2 text-on-surface-variant">Đang tải dữ liệu...</span>
            </div>
          ) : stats.modules.length > 0 ? (
            stats.modules.map((module) => (
              <div key={module.name} className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">{module.icon}</span>
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{module.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${module.satisfaction >= 95 ? 'text-tertiary' : module.satisfaction >= 90 ? 'text-secondary' : 'text-error'}`}>
                    {module.satisfaction}%
                  </span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full rounded-full ${module.satisfaction >= 95 ? 'bg-tertiary' : module.satisfaction >= 90 ? 'bg-secondary' : 'bg-error'}`}
                    style={{ width: `${module.satisfaction}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>{module.totalResponses.toLocaleString()} lượt</span>
                  <span className={`font-semibold ${module.satisfaction >= 95 ? 'text-tertiary' : 'text-error'}`}>
                    {module.likes.toLocaleString()} Like
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-on-surface-variant">
              Chưa có dữ liệu phản hồi
            </div>
          )}
        </div>
      </div>

      {/* Detailed Feedback Logs Table Section */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Header & Controls */}
        <div className="p-6 bg-surface-container-lowest">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Nhật Ký Phản Hồi Chi Tiết</h3>
              <p className="text-sm text-on-surface-variant">Dữ liệu thời gian thực được đồng bộ từ các phiên tư vấn trên toàn quốc</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={resetFilters}
                className="h-10 px-3.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface text-sm font-medium flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Đặt lại bộ lọc</span>
              </button>
              <button className="h-10 px-4 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Duyệt mẫu huấn luyện đã chọn</span>
              </button>
            </div>
          </div>

          {/* Smart Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Query Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 text-outline w-5 h-5" />
              <input
                className="w-full h-11 pl-10 pr-4 bg-surface rounded-xl text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                id="filter-search"
                placeholder="Tìm câu hỏi, từ khóa, lý do..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>

            {/* Chatbot Selector */}
            <div className="relative">
              <select
                className="w-full h-11 px-3.5 bg-surface rounded-xl text-on-surface text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
              >
                <option value="ALL">Tất cả Module Chatbot</option>
                <option value="vision">Trợ năng Thị giác</option>
                <option value="hearing">Trợ năng Thính giác</option>
                <option value="cognition">Hỗ trợ Nhận thức</option>
                <option value="mobility">Vận động Tinh tế</option>
                <option value="daily_living">Sinh hoạt Hàng ngày</option>
                <option value="communication">Giao tiếp AAC</option>
                <option value="education">Giáo dục</option>
                <option value="general">Tổng quát</option>
              </select>
              <span className="absolute right-3.5 top-3 text-outline pointer-events-none material-symbols-outlined text-xl">expand_more</span>
            </div>

            {/* Rating Type Selector */}
            <div className="relative">
              <select
                className="w-full h-11 px-3.5 bg-surface rounded-xl text-on-surface text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
              >
                <option value="ALL">Tất cả Đánh giá</option>
                <option value="DISLIKE">Chỉ Dislike (Ưu tiên can thiệp)</option>
                <option value="LIKE">Chỉ Like (Mẫu chuẩn tốt)</option>
              </select>
              <span className="absolute right-3.5 top-3 text-outline pointer-events-none material-symbols-outlined text-xl">expand_more</span>
            </div>

            {/* Resolution Status Selector */}
            <div className="relative">
              <select
                className="w-full h-11 px-3.5 bg-surface rounded-xl text-on-surface text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">Tất cả Trạng thái Xử lý</option>
                <option value="Chờ chuyên gia">Chờ chuyên gia xem xét</option>
                <option value="Đã nạp fine-tune">Đã nạp fine-tune model</option>
                <option value="Đã giải quyết">Đã can thiệp trực tiếp</option>
                <option value="Bỏ qua">Bỏ qua / Không phát hiện lỗi</option>
              </select>
              <span className="absolute right-3.5 top-3 text-outline pointer-events-none material-symbols-outlined text-xl">expand_more</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-sm font-semibold">
                <th className="py-4 px-6">Thời gian</th>
                <th className="py-4 px-4">Module</th>
                <th className="py-4 px-6 max-w-xs">Câu hỏi người dùng</th>
                <th className="py-4 px-4 text-center">Đánh giá</th>
                <th className="py-4 px-6">Lý do chi tiết &amp; Phản hồi</th>
                <th className="py-4 px-4">Trạng thái mô hình</th>
                <th className="py-4 px-6 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-on-surface-variant">Đang tải dữ liệu phản hồi...</p>
                  </td>
                </tr>
              ) : filteredFeedback.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-on-surface-variant">Chưa có dữ liệu phản hồi nào</p>
                  </td>
                </tr>
              ) : (
                filteredFeedback.map((item) => (
                  <tr key={item.id} className={clsx(
                    'hover:bg-surface-container/60 transition-colors group',
                    item.rating === 'like' ? 'bg-surface-container-lowest' : ''
                )}>
                  <td className="py-4 px-6 font-mono text-outline whitespace-nowrap">
                    <div className="text-sm">{item.time}</div>
                    <div className="text-xs">{item.date}</div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary text-xs font-semibold">
                      <span className="material-symbols-outlined text-sm">{item.moduleIcon}</span>
                      {moduleDisplayMap[item.module] || item.module}
                    </span>
                  </td>
                  <td className="py-4 px-6 max-w-xs">
                    <p className="font-semibold text-on-surface truncate" title={item.question}>{item.question}</p>
                    <span className="text-xs text-outline">{item.id} • {item.userType}</span>
                  </td>
                  <td className="py-4 px-4 text-center whitespace-nowrap">
                    {item.rating === 'like' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-sm font-bold">
                        <span className="material-symbols-outlined text-sm">thumb_up</span>
                        Like
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-error-container text-on-error-container text-sm font-bold">
                        <span className="material-symbols-outlined text-sm">thumb_down</span>
                        Dislike
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 max-w-sm">
                    <div className={clsx(
                      'p-2.5 rounded-xl',
                      item.rating === 'like' ? 'bg-surface-container-low text-on-surface' : 'bg-error-container/20 text-on-surface'
                    )}>
                      <div className={clsx(
                        'font-semibold text-xs mb-0.5',
                        item.rating === 'like' ? 'text-tertiary' : 'text-error'
                      )}>{item.reason}</div>
                      <p className="text-xs leading-snug line-clamp-2">{item.feedback}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {getStatusBadge(item.status, language)}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenChat(item)}
                        className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary hover:text-primary-container transition-all"
                        title="Xem trích đoạn hội thoại"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                      {item.rating === 'dislike' ? (
                        <button
                          onClick={() => handleFlagForReview(item.id)}
                          className="p-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary transition-all shadow-sm"
                          title="Đánh dấu sửa prompt &amp; kiến thức y khoa"
                        >
                          <Star className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-all"
                          title="Lưu vào kho vàng huấn luyện"
                        >
                          <Star className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="p-6 bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-on-surface-variant">
              Hiển thị <strong>1 - {filteredFeedback.length}</strong> trong tổng số <strong>{totalResponses.toLocaleString()}</strong> phản hồi
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-all" disabled>
              <span className="material-symbols-outlined text-xl">chevron_left</span>
            </button>
            <button className="w-9 h-9 rounded-xl bg-primary text-on-primary text-sm font-medium shadow-sm">1</button>
            <button className="w-9 h-9 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-all">2</button>
            <button className="w-9 h-9 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-all">3</button>
            <span className="px-2 text-outline">...</span>
            <button className="w-9 h-9 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-all">965</button>
            <button className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Review Drawer */}
      {chatDrawerOpen && selectedChat && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setChatDrawerOpen(false)}
          ></div>
          <div className="relative w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-xl">medical_services</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-on-surface">Đoạn Chat {selectedChat.id}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-bold">
                      {selectedChat.rating === 'like' ? 'Like Ghi Nhận' : 'Dislike Ghi Nhận'}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">Module {selectedChat.module} • {selectedChat.time} ({selectedChat.date})</p>
                </div>
              </div>
              <button
                onClick={() => setChatDrawerOpen(false)}
                className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Chat Transcript */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-surface">
              {/* User bubble */}
              <div className="flex flex-col items-end max-w-[85%] self-end">
                <div className="bg-primary text-on-primary p-4 rounded-2xl rounded-br-none shadow-sm text-base">
                  {selectedChat.question}
                </div>
                <span className="text-xs text-outline mt-1.5">
                  {selectedChat.time} • Người dùng ẩn danh
                </span>
              </div>

              {/* AI bubble */}
              {selectedChat.chatTranscript && (
                <>
                  <div className="flex flex-col items-start max-w-[88%] self-start">
                    <div className="bg-surface-container-lowest text-on-surface p-5 rounded-2xl rounded-bl-none shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-primary-container text-on-primary flex items-center justify-center text-sm font-bold">M</div>
                        <span className="text-sm font-semibold text-primary">Mada AI {selectedChat.module} v2.4</span>
                      </div>
                      <p className="text-base text-on-surface leading-relaxed mb-3">
                        {selectedChat.chatTranscript.ai}
                      </p>
                      <div className="p-3 bg-error-container/20 rounded-xl mb-3">
                        <p className="text-sm text-on-surface">
                          <span className="font-bold text-error">Đoạn thông tin người dùng phản hồi:</span> "{selectedChat.chatTranscript.userFeedback}"
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-outline mt-1.5">Độ trễ xử lý 114ms</span>
                  </div>

                  {/* Dislike annotation box */}
                  <div className="p-4 rounded-xl bg-error-container/30">
                    <div className="flex items-center gap-2 text-on-error-container text-sm font-semibold mb-1.5">
                      <span className="material-symbols-outlined text-xl">report</span>
                      <span>Ý kiến người dùng đính kèm:</span>
                    </div>
                    <p className="text-base text-on-surface">"{selectedChat.feedback}"</p>
                  </div>
                </>
              )}

              {/* Clinical Expert Action Panel */}
              <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Ghi chú Đánh giá của Bác sĩ / Kỹ sư MADA AI</span>
                <textarea
                  className="w-full p-3 bg-surface rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                  placeholder="Nhập chỉ dẫn điều chỉnh Prompt System hoặc cập nhật dữ liệu y tế..."
                  rows={3}
                  value={expertNotes}
                  onChange={(e) => setExpertNotes(e.target.value)}
                ></textarea>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={includeRLHF}
                      onChange={(e) => setIncludeRLHF(e.target.checked)}
                      className="w-5 h-5 rounded text-primary focus:ring-secondary"
                    />
                    <span>Đưa vào tập dữ liệu RLHF (Reinforcement Learning)</span>
                  </label>
                  <span className="text-xs text-outline hidden sm:inline">Quy chuẩn ISO 9999:2022</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 bg-surface-container-low flex items-center justify-between gap-3">
              <button
                onClick={() => setChatDrawerOpen(false)}
                className="h-12 px-5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-base font-medium transition-all"
              >
                Đóng cửa sổ
              </button>
              <div className="flex items-center gap-3">
                <button className="h-12 px-5 rounded-xl bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container text-base font-medium flex items-center gap-2 transition-all">
                  <span className="material-symbols-outlined text-xl">person_check</span>
                  <span className="hidden sm:inline">Chuyển cho KTV {selectedChat.module}</span>
                </button>
                <button
                  onClick={handleSubmitResolution}
                  className="h-12 px-6 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-base font-medium flex items-center gap-2 shadow-sm transition-all"
                >
                  <Check className="w-5 h-5" />
                  <span className="hidden sm:inline">Cập nhật Tri thức Model</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
