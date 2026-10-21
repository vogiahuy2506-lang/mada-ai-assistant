import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayoutLinear';
import { adminApi, type Consultation } from './adminApi';
import { getAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores';
import clsx from 'clsx';
import {
  ThumbsUp, ThumbsDown, TrendingUp, Ticket, Search, User, MessageSquare,
  ChevronDown, UserCheck, Star, Send, AlertCircle, Clock, CheckCircle, X
} from 'lucide-react';

// ============== TRANSLATIONS ==============
const tC = (key: string): string => {
  const lang = 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Nav
      'admin.nav.consultations': 'Hỗ trợ',
      // Hero
      'admin.consult.title': 'Yêu cầu Tư vấn',
      'admin.consult.subtitle': 'Theo dõi và xử lý các yêu cầu tư vấn từ người dùng',
      // Tabs
      'admin.consult.tab.consultations': 'Yêu cầu Tư vấn',
      'admin.consult.tab.feedback': 'Phản hồi',
      'admin.consult.tab.support': 'Hỗ trợ',
      // Metrics
      'admin.consult.totalRequests': 'Tổng yêu cầu',
      'admin.consult.pending': 'Đang chờ',
      'admin.consult.reviewed': 'Đã xem',
      'admin.consult.contacted': 'Đã liên hệ',
      // Filters
      'admin.consult.filter': 'Lọc',
      'admin.consult.all': 'Tất cả',
      'admin.consult.status.pending': 'Đang chờ',
      'admin.consult.status.reviewed': 'Đã xem',
      'admin.consult.status.contacted': 'Đã liên hệ',
      // Actions
      'admin.consult.exportReport': 'Xuất báo cáo',
      'admin.consult.loading': 'Đang tải dữ liệu...',
      'admin.consult.noRequests': 'Chưa có yêu cầu nào',
      'admin.consult.noRequestsHint': 'Các yêu cầu tư vấn sẽ xuất hiện ở đây khi có người dùng gửi.',
      'admin.consult.viewDetails': 'Xem chi tiết',
      'admin.consult.requestDetails': 'Chi tiết yêu cầu',
      'admin.consult.fullName': 'Họ tên',
      'admin.consult.email': 'Email',
      'admin.consult.phone': 'Số điện thoại',
      'admin.consult.dateSent': 'Ngày gửi',
      'admin.consult.requestContent': 'Nội dung yêu cầu',
      'admin.consult.updateStatus': 'Cập nhật trạng thái',
      'admin.consult.replyEmail': 'Trả lời qua Email',
      'admin.consult.close': 'Đóng',
      // Feedback
      'admin.consult.feedback': 'Phản hồi',
      'admin.consult.feedbackTitle': 'Phản hồi Chatbot',
      'admin.consult.feedbackSubtitle': 'Thống kê đánh giá của người dùng về các câu trả lời của chatbot',
      'admin.consult.likes': 'Lượt thích',
      'admin.consult.dislikes': 'Lượt không thích',
      'admin.consult.satisfactionRate': 'Tỷ lệ hài lòng',
      'admin.consult.topDislikeReasons': 'Lý do phản hồi tiêu cực',
      'admin.consult.noDislikeReasons': 'Chưa có phản hồi tiêu cực',
      // Support
      'support.title': 'Hỗ trợ',
      'support.subtitle': 'Quản lý ticket hỗ trợ người dùng',
      'support.open': 'Mới',
      'support.in_progress': 'Đang xử lý',
      'support.resolved': 'Đã giải quyết',
      'support.closed': 'Đã đóng',
      'support.spam': 'Spam',
      'support.low': 'Thấp',
      'support.normal': 'Bình thường',
      'support.high': 'Cao',
      'support.urgent': 'Khẩn cấp',
      'support.general': 'Tổng quát',
      'support.technical': 'Kỹ thuật',
      'support.billing': 'Thanh toán',
      'support.feature': 'Tính năng',
      'support.bug': 'Lỗi',
      'support.feedback': 'Phản hồi',
      'support.ticketNumber': 'Ticket',
      'support.customer': 'Khách hàng',
      'support.subject': 'Chủ đề',
      'support.description': 'Mô tả',
      'support.status': 'Trạng thái',
      'support.priority': 'Ưu tiên',
      'support.category': 'Danh mục',
      'support.assignee': 'Người phụ trách',
      'support.created': 'Tạo lúc',
      'support.reply': 'Phản hồi',
      'support.sendReply': 'Gửi phản hồi',
      'support.replyPlaceholder': 'Nhập phản hồi của bạn...',
      'support.noTickets': 'Không có ticket nào',
      'support.noTicketsDesc': 'Chưa có ticket hỗ trợ nào được tạo.',
      'support.loading': 'Đang tải...',
      'support.search': 'Tìm kiếm ticket...',
      'support.selectTicket': 'Chọn một ticket để xem chi tiết',
      'support.unassigned': 'Chưa phân công',
      'support.rating': 'Đánh giá khách hàng',
    },
    en: {
      'admin.nav.consultations': 'Support',
      'admin.consult.title': 'Consultation Requests',
      'admin.consult.subtitle': 'Track and process consultation requests from users',
      'admin.consult.tab.consultations': 'Consultation Requests',
      'admin.consult.tab.feedback': 'Feedback',
      'admin.consult.tab.support': 'Support',
      'admin.consult.totalRequests': 'Total Requests',
      'admin.consult.pending': 'Pending',
      'admin.consult.reviewed': 'Reviewed',
      'admin.consult.contacted': 'Contacted',
      'admin.consult.filter': 'Filter',
      'admin.consult.all': 'All',
      'admin.consult.status.pending': 'Pending',
      'admin.consult.status.reviewed': 'Reviewed',
      'admin.consult.status.contacted': 'Contacted',
      'admin.consult.exportReport': 'Export Report',
      'admin.consult.loading': 'Loading data...',
      'admin.consult.noRequests': 'No requests yet',
      'admin.consult.noRequestsHint': 'Consultation requests will appear here when users submit them.',
      'admin.consult.viewDetails': 'View details',
      'admin.consult.requestDetails': 'Request Details',
      'admin.consult.fullName': 'Full Name',
      'admin.consult.email': 'Email',
      'admin.consult.phone': 'Phone',
      'admin.consult.dateSent': 'Date Sent',
      'admin.consult.requestContent': 'Request Content',
      'admin.consult.updateStatus': 'Update Status',
      'admin.consult.replyEmail': 'Reply via Email',
      'admin.consult.close': 'Close',
      'admin.consult.feedback': 'Feedback',
      'admin.consult.feedbackTitle': 'Chatbot Feedback',
      'admin.consult.feedbackSubtitle': 'Statistics of user feedback on chatbot responses',
      'admin.consult.likes': 'Likes',
      'admin.consult.dislikes': 'Dislikes',
      'admin.consult.satisfactionRate': 'Satisfaction Rate',
      'admin.consult.topDislikeReasons': 'Top Negative Feedback Reasons',
      'admin.consult.noDislikeReasons': 'No negative feedback yet',
      'support.title': 'Support',
      'support.subtitle': 'Manage user support tickets',
      'support.open': 'Open',
      'support.in_progress': 'In Progress',
      'support.resolved': 'Resolved',
      'support.closed': 'Closed',
      'support.spam': 'Spam',
      'support.low': 'Low',
      'support.normal': 'Normal',
      'support.high': 'High',
      'support.urgent': 'Urgent',
      'support.general': 'General',
      'support.technical': 'Technical',
      'support.billing': 'Billing',
      'support.feature': 'Feature',
      'support.bug': 'Bug',
      'support.feedback': 'Feedback',
      'support.ticketNumber': 'Ticket',
      'support.customer': 'Customer',
      'support.subject': 'Subject',
      'support.description': 'Description',
      'support.status': 'Status',
      'support.priority': 'Priority',
      'support.category': 'Category',
      'support.assignee': 'Assignee',
      'support.created': 'Created',
      'support.reply': 'Reply',
      'support.sendReply': 'Send Reply',
      'support.replyPlaceholder': 'Enter your reply...',
      'support.noTickets': 'No tickets',
      'support.noTicketsDesc': 'No support tickets have been created yet.',
      'support.loading': 'Loading...',
      'support.search': 'Search tickets...',
      'support.selectTicket': 'Select a ticket to view details',
      'support.unassigned': 'Unassigned',
      'support.rating': 'Customer Rating',
    },
    ar: {
      'admin.nav.consultations': 'الدعم',
      'admin.consult.title': 'طلبات الاستشارة',
      'admin.consult.subtitle': 'تتبع ومعالجة طلبات الاستشارة من المستخدمين',
      'admin.consult.tab.consultations': 'طلبات الاستشارة',
      'admin.consult.tab.feedback': 'التعليقات',
      'admin.consult.tab.support': 'الدعم',
      'admin.consult.totalRequests': 'إجمالي الطلبات',
      'admin.consult.pending': 'معلق',
      'admin.consult.reviewed': 'تم المراجعة',
      'admin.consult.contacted': 'تم التواصل',
      'admin.consult.filter': 'تصفية',
      'admin.consult.all': 'الكل',
      'admin.consult.status.pending': 'معلق',
      'admin.consult.status.reviewed': 'تم المراجعة',
      'admin.consult.status.contacted': 'تم التواصل',
      'admin.consult.exportReport': 'تصدير التقرير',
      'admin.consult.loading': 'جاري تحميل البيانات...',
      'admin.consult.noRequests': 'لا توجد طلبات بعد',
      'admin.consult.noRequestsHint': 'ستظهر طلبات الاستشارة هنا عند إرسالها من المستخدمين.',
      'admin.consult.viewDetails': 'عرض التفاصيل',
      'admin.consult.requestDetails': 'تفاصيل الطلب',
      'admin.consult.fullName': 'الاسم الكامل',
      'admin.consult.email': 'البريد الإلكتروني',
      'admin.consult.phone': 'الهاتف',
      'admin.consult.dateSent': 'تاريخ الإرسال',
      'admin.consult.requestContent': 'محتوى الطلب',
      'admin.consult.updateStatus': 'تحديث الحالة',
      'admin.consult.replyEmail': 'الرد عبر البريد',
      'admin.consult.close': 'إغلاق',
      'admin.consult.feedback': 'التعليقات',
      'admin.consult.feedbackTitle': 'تعليقات الشات بوت',
      'admin.consult.feedbackSubtitle': 'إحصائيات تعليقات المستخدمين على ردود الشات بوت',
      'admin.consult.likes': 'إعجابات',
      'admin.consult.dislikes': 'عدم الإعجاب',
      'admin.consult.satisfactionRate': 'معدل الرضا',
      'admin.consult.topDislikeReasons': 'أسباب التعليقات السلبية',
      'admin.consult.noDislikeReasons': 'لا توجد تعليقات سلبية بعد',
      'support.title': 'الدعم',
      'support.subtitle': 'إدارة تذاكر دعم المستخدمين',
      'support.open': 'مفتوح',
      'support.in_progress': 'قيد التنفيذ',
      'support.resolved': 'تم الحل',
      'support.closed': 'مغلق',
      'support.spam': 'بريد مزعج',
      'support.low': 'منخفض',
      'support.normal': 'عادي',
      'support.high': 'مرتفع',
      'support.urgent': 'عاجل',
      'support.general': 'عام',
      'support.technical': 'تقني',
      'support.billing': 'الفواتير',
      'support.feature': 'ميزة',
      'support.bug': 'خطأ',
      'support.feedback': 'تعليق',
      'support.loading': 'جاري التحميل...',
      'support.search': 'البحث في التذاكر...',
      'support.selectTicket': 'اختر تذكرة لعرض التفاصيل',
      'support.unassigned': 'غير معين',
      'support.rating': 'تقييم العميل',
    },
    fr: {
      'admin.nav.consultations': 'Support',
      'admin.consult.title': 'Demandes de consultation',
      'admin.consult.subtitle': 'Suivez et traitez les demandes de consultation des utilisateurs',
      'admin.consult.tab.consultations': 'Demandes de consultation',
      'admin.consult.tab.feedback': 'Commentaires',
      'admin.consult.tab.support': 'Support',
      'admin.consult.totalRequests': 'Total des demandes',
      'admin.consult.pending': 'En attente',
      'admin.consult.reviewed': 'Examiné',
      'admin.consult.contacted': 'Contacté',
      'admin.consult.filter': 'Filtrer',
      'admin.consult.all': 'Tous',
      'admin.consult.status.pending': 'En attente',
      'admin.consult.status.reviewed': 'Examiné',
      'admin.consult.status.contacted': 'Contacté',
      'admin.consult.exportReport': 'Exporter le rapport',
      'admin.consult.loading': 'Chargement des données...',
      'admin.consult.noRequests': 'Aucune demande',
      'admin.consult.noRequestsHint': 'Les demandes de consultation apparaîtront ici lorsque les utilisateurs les soumettront.',
      'admin.consult.viewDetails': 'Voir les détails',
      'admin.consult.requestDetails': 'Détails de la demande',
      'admin.consult.fullName': 'Nom complet',
      'admin.consult.email': 'Email',
      'admin.consult.phone': 'Téléphone',
      'admin.consult.dateSent': "Date d'envoi",
      'admin.consult.requestContent': 'Contenu de la demande',
      'admin.consult.updateStatus': 'Mettre à jour le statut',
      'admin.consult.replyEmail': "Répondre par Email",
      'admin.consult.close': 'Fermer',
      'admin.consult.feedback': 'Commentaires',
      'admin.consult.feedbackTitle': 'Commentaires du Chatbot',
      'admin.consult.feedbackSubtitle': "Statistiques des commentaires des utilisateurs sur les réponses du chatbot",
      'admin.consult.likes': "J'aime",
      'admin.consult.dislikes': "Je n'aime pas",
      'admin.consult.satisfactionRate': 'Taux de satisfaction',
      'admin.consult.topDislikeReasons': 'Raisons des commentaires négatifs',
      'admin.consult.noDislikeReasons': 'Pas encore de commentaires négatifs',
      'support.title': 'Support',
      'support.subtitle': 'Gérer les tickets de support utilisateurs',
      'support.open': 'Ouvert',
      'support.in_progress': 'En cours',
      'support.resolved': 'Résolu',
      'support.closed': 'Fermé',
      'support.spam': 'Spam',
      'support.low': 'Faible',
      'support.normal': 'Normal',
      'support.high': 'Élevé',
      'support.urgent': 'Urgent',
      'support.general': 'Général',
      'support.technical': 'Technique',
      'support.billing': 'Facturation',
      'support.feature': 'Fonctionnalité',
      'support.bug': 'Bug',
      'support.feedback': 'Retour',
      'support.loading': 'Chargement...',
      'support.search': 'Rechercher des tickets...',
      'support.selectTicket': 'Sélectionnez un ticket pour voir les détails',
      'support.unassigned': 'Non assigné',
      'support.rating': 'Évaluation du client',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

// ============== SUPPORT TYPES ==============
interface TicketData {
  id: string;
  ticket_number: string;
  user_id?: string;
  user_email: string;
  user_name: string;
  subject: string;
  description: string;
  category: 'general' | 'technical' | 'billing' | 'feature' | 'bug' | 'feedback';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'spam';
  assigned_to?: string;
  assigned_to_name?: string;
  reply_count: number;
  rating?: number;
  rating_comment?: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  user_id?: string;
  is_admin_reply: boolean;
  message: string;
  user_name?: string;
  created_at: string;
}

interface SupportAdmin {
  id: string;
  email: string;
  name: string;
}

// ============== HELPERS ==============
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open': return <div className="w-3 h-3 rounded-full bg-indigo-500" />;
    case 'in_progress': return <div className="w-3 h-3 rounded-full bg-yellow-500" />;
    case 'resolved': return <div className="w-3 h-3 rounded-full bg-green-500" />;
    case 'closed': return <div className="w-3 h-3 rounded-full bg-gray-400" />;
    case 'spam': return <div className="w-3 h-3 rounded-full bg-red-400" />;
    default: return <div className="w-3 h-3 rounded-full bg-gray-300" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
    case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'spam': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'normal': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'low': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ============== MAIN COMPONENT ==============
export function AdminConsultations() {
  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<'consultations' | 'feedback' | 'support'>('consultations');

  // ---- Consultation state ----
  const [requests, setRequests] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Consultation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ---- Feedback state ----
  const [feedbackStats, setFeedbackStats] = useState<{
    stats: { rating: string; count: number }[];
    total: number;
    reasons: { reason: string; count: number }[];
  } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ---- Support state ----
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [supportAdmins, setSupportAdmins] = useState<SupportAdmin[]>([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportStats, setSupportStats] = useState<any>({});
  const [supportStatusFilter, setSupportStatusFilter] = useState<string>('all');
  const [supportSearch, setSupportSearch] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const { user } = useAuthStore();

  // ---- Consultation API ----
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getConsultations({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setRequests(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err: unknown) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ---- Feedback API ----
  useEffect(() => {
    if (activeTab === 'feedback') {
      setFeedbackLoading(true);
      fetch(`/api/chat/feedback/stats`, {
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      })
        .then((r) => r.json())
        .then((d) => { if (d.success !== false) setFeedbackStats(d.data); })
        .catch(console.error)
        .finally(() => setFeedbackLoading(false));
    }
  }, [activeTab]);

  const getLikeCount = () => feedbackStats?.stats.find((s) => s.rating === 'like')?.count || 0;
  const getDislikeCount = () => feedbackStats?.stats.find((s) => s.rating === 'dislike')?.count || 0;
  const getSatisfactionRate = () => {
    const total = feedbackStats?.total || 0;
    if (total === 0) return 0;
    return Math.round((getLikeCount() / total) * 100);
  };

  // ---- Support API ----
  const loadTickets = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (supportStatusFilter !== 'all') params.status = supportStatusFilter;
      if (supportSearch) params.search = supportSearch;
      const res = await adminApi.getSupportTickets(params);
      if (res.success && res.data) {
        setTickets(res.data.tickets as TicketData[]);
        setSupportStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setSupportLoading(false);
    }
  }, [supportStatusFilter, supportSearch]);

  const loadAdmins = async () => {
    const res = await adminApi.getSupportAdmins();
    if (res.success && res.data) setSupportAdmins(res.data);
  };

  const loadTicketDetails = async (id: string) => {
    const res = await adminApi.getSupportTicket(id);
    if (res.success && res.data) {
      setSelectedTicket(res.data.ticket as unknown as TicketData);
      setReplies((res.data.replies || []) as unknown as Reply[]);
    }
  };

  useEffect(() => {
    if (activeTab === 'support') {
      loadTickets();
      loadAdmins();
    }
  }, [activeTab]);

  const handleSelectTicket = (ticket: TicketData) => {
    setSelectedTicket(ticket);
    loadTicketDetails(ticket.id);
  };

  const handleSupportStatusChange = async (status: string) => {
    if (!selectedTicket) return;
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { status });
    if (res.success) {
      setSelectedTicket((prev) => prev ? { ...prev, status: status as any } : null);
      loadTickets();
    }
  };

  const handleSupportPriorityChange = async (priority: string) => {
    if (!selectedTicket) return;
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { priority });
    if (res.success) {
      setSelectedTicket((prev) => prev ? { ...prev, priority: priority as any } : null);
      loadTickets();
    }
  };

  const handleAssign = async (adminId: string | null) => {
    if (!selectedTicket) return;
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { assigned_to: adminId || undefined });
    if (res.success) {
      const assignedAdmin = adminId ? supportAdmins.find((a) => a.id === adminId) : null;
      setSelectedTicket((prev) => prev ? { ...prev, assigned_to: adminId || undefined, assigned_to_name: assignedAdmin?.name } : null);
      setShowAssignDropdown(false);
      loadTickets();
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setSending(true);
    try {
      const res = await adminApi.replyToSupportTicket(selectedTicket.id, { message: replyMessage.trim() });
      if (res.success && res.data) {
        const replyData = res.data;
        setReplies((prev) => [...prev, {
          id: replyData.id,
          ticket_id: selectedTicket.id,
          user_id: user?.id,
          is_admin_reply: true,
          message: replyMessage.trim(),
          user_name: user?.name || user?.email,
          created_at: replyData.createdAt,
        }]);
        setReplyMessage('');
        if (selectedTicket.status === 'open') {
          await adminApi.updateSupportTicket(selectedTicket.id, { status: 'in_progress' });
          setSelectedTicket((prev) => prev ? { ...prev, status: 'in_progress' } : null);
        }
        loadTickets();
      }
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setSending(false);
    }
  };

  // ---- Consultation status update ----
  const updateStatus = async (id: string, status: 'pending' | 'reviewed' | 'contacted') => {
    try {
      const res = await adminApi.updateConsultation(id, { status });
      if (res.success) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        if (selectedRequest?.id === id) setSelectedRequest({ ...selectedRequest, status });
      } else {
        alert(res.error);
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // ---- Colors / labels ----
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    reviewed: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    contacted: 'bg-green-100 text-green-800 border-green-300',
  };
  const statusLabels: Record<string, string> = {
    pending: tC('admin.consult.status.pending'),
    reviewed: tC('admin.consult.status.reviewed'),
    contacted: tC('admin.consult.status.contacted'),
  };

  return (
    <AdminLayout titleKey="admin.nav.consultations" subtitleKey="admin.consult.subtitle" showLayoutTitle={false}>
      {/* Hero Banner */}
      <section className="mb-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-6 shadow-lg">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
          <div className="absolute top-4 right-20 w-8 h-8 bg-white/20 rounded-full"></div>
          <div className="absolute bottom-6 right-40 w-4 h-4 bg-white/10 rounded-full"></div>

          <div className="relative flex justify-between items-center flex-wrap gap-4">
            {/* Left: Title & Subtitle */}
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>clinical_notes</span>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    {tC('admin.consult.title')}
                  </h2>
                  <p className="text-sm text-white/80 font-medium">
                    {tC('admin.consult.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Tabs + Export */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Consultation Tab */}
              <button
                onClick={() => { setActiveTab('consultations'); setStatusFilter('all'); }}
                className={clsx(
                  'px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2',
                  activeTab === 'consultations'
                    ? 'bg-white text-indigo-600 border-white shadow-md'
                    : 'bg-white/20 text-white border-white/40 hover:bg-white/30',
                )}
              >
                <span className="material-symbols-outlined text-sm mr-1 align-text-bottom">clinical_notes</span>
                {tC('admin.consult.tab.consultations')}
              </button>
              {/* Feedback Tab */}
              <button
                onClick={() => setActiveTab('feedback')}
                className={clsx(
                  'px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2',
                  activeTab === 'feedback'
                    ? 'bg-white text-indigo-600 border-white shadow-md'
                    : 'bg-white/20 text-white border-white/40 hover:bg-white/30',
                )}
              >
                <span className="material-symbols-outlined text-sm mr-1 align-text-bottom">chat_info</span>
                {tC('admin.consult.tab.feedback')}
              </button>
              {/* Support Tab */}
              <button
                onClick={() => { setActiveTab('support'); setSupportStatusFilter('all'); }}
                className={clsx(
                  'px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2',
                  activeTab === 'support'
                    ? 'bg-white text-indigo-600 border-white shadow-md'
                    : 'bg-white/20 text-white border-white/40 hover:bg-white/30',
                )}
              >
                <span className="material-symbols-outlined text-sm mr-1 align-text-bottom">support_agent</span>
                {tC('admin.consult.tab.support')}
              </button>
              {/* Export Button */}
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 font-bold text-sm border-2 border-white shadow-md hover:bg-white/90 transition-all">
                <span className="material-symbols-outlined text-sm">cloud_download</span>
                {tC('admin.consult.exportReport')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CONSULTATIONS TAB ========== */}
      {activeTab === 'consultations' && (
        <div>
          {/* Metrics */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{requests.length}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.totalRequests')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{requests.filter((r) => r.status === 'pending').length}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.pending')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{requests.filter((r) => r.status === 'reviewed').length}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.reviewed')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{requests.filter((r) => r.status === 'contacted').length}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.contacted')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { key: 'all', label: tC('admin.consult.all') },
              { key: 'pending', label: tC('admin.consult.status.pending'), color: 'yellow' },
              { key: 'reviewed', label: tC('admin.consult.status.reviewed'), color: 'blue' },
              { key: 'contacted', label: tC('admin.consult.status.contacted'), color: 'green' },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border',
                  statusFilter === key
                    ? color === 'yellow' ? 'bg-yellow-400 text-black border-yellow-400'
                    : color === 'blue' ? 'bg-indigo-500 text-white border-indigo-500'
                    : color === 'green' ? 'bg-green-500 text-white border-green-500'
                    : 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-slate-400 text-2xl animate-pulse">hourglass_empty</span>
                </div>
                <p className="text-sm font-medium text-slate-500">{tC('admin.consult.loading')}</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">inbox</span>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">{tC('admin.consult.noRequests')}</h4>
                <p className="text-xs text-slate-500 text-center max-w-xs">{tC('admin.consult.noRequestsHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-indigo-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{request.name}</h4>
                          <p className="text-sm text-slate-500">{request.email}</p>
                          {request.phone && (
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-xs">phone</span>
                              {request.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {new Date(request.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <span className={clsx('px-2.5 py-1 rounded-lg text-xs font-semibold border', statusColors[request.status])}>
                          {statusLabels[request.status]}
                        </span>
                        <button className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold border border-indigo-600 hover:bg-indigo-600 transition-colors">
                          {tC('admin.consult.viewDetails')}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-600 line-clamp-2">{request.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== FEEDBACK TAB ========== */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white">
                  <ThumbsUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{getLikeCount()}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.likes')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center text-white">
                  <ThumbsDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{getDislikeCount()}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.dislikes')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{getSatisfactionRate()}%</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.satisfactionRate')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-black">{feedbackStats?.total || 0}</p>
                  <p className="text-xs text-slate-500 font-medium">{tC('admin.consult.totalRequests')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Dislike Reasons */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-600 text-base">warning</span>
                </span>
                {tC('admin.consult.topDislikeReasons')}
              </h4>
            </div>
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : feedbackStats?.reasons && feedbackStats.reasons.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {feedbackStats.reasons.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600 shrink-0">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 break-words">{item.reason || '(Không có lý do)'}</p>
                    </div>
                    <div className="px-3 py-1 bg-red-100 rounded-full shrink-0">
                      <span className="text-xs font-bold text-red-600">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">check_circle</span>
                <p className="text-sm font-medium text-gray-500">{tC('admin.consult.noDislikeReasons')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SUPPORT TAB ========== */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'all', label: tC('support.all'), icon: <Ticket className="w-5 h-5" />, bgColor: 'bg-slate-500' },
              { key: 'open', label: tC('support.open'), icon: <AlertCircle className="w-5 h-5" />, bgColor: 'bg-indigo-500' },
              { key: 'in_progress', label: tC('support.in_progress'), icon: <Clock className="w-5 h-5" />, bgColor: 'bg-amber-500' },
              { key: 'resolved', label: tC('support.resolved'), icon: <CheckCircle className="w-5 h-5" />, bgColor: 'bg-emerald-500' },
              { key: 'closed', label: tC('support.closed'), icon: <X className="w-5 h-5" />, bgColor: 'bg-slate-500' },
            ].map(({ key, label, icon, bgColor }) => (
              <button
                key={key}
                onClick={() => { setSupportStatusFilter(key); }}
                className={clsx(
                  'bg-white rounded-xl border p-4 shadow-sm transition-all text-left',
                  supportStatusFilter === key ? 'border-indigo-500' : 'border-slate-300 hover:border-slate-400',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-white', bgColor)}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-black">
                      {key === 'all' ? supportStats.total || 0
                        : key === 'open' ? supportStats.open || 0
                        : key === 'in_progress' ? supportStats.in_progress || 0
                        : key === 'resolved' ? supportStats.resolved || 0
                        : supportStats.closed || 0}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Main Content: Ticket List + Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex" style={{ height: '500px' }}>
              {/* Ticket List */}
              <div className="w-80 border-r border-slate-200 flex flex-col">
                {/* Search */}
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={supportSearch}
                      onChange={(e) => setSupportSearch(e.target.value)}
                      placeholder={tC('support.search')}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {supportLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-slate-500 text-sm">{tC('support.loading')}</p>
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="p-8 text-center">
                      <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{tC('support.noTickets')}</h3>
                      <p className="text-slate-500 text-xs">{tC('support.noTicketsDesc')}</p>
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => handleSelectTicket(ticket)}
                        className={clsx(
                          'w-full p-4 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors',
                          selectedTicket?.id === ticket.id && 'bg-indigo-50 border-l-4 border-l-indigo-500',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(ticket.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-500">#{ticket.ticket_number}</span>
                              {ticket.priority === 'urgent' && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded">
                                  {tC('support.urgent')}
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-sm text-gray-900 truncate">{ticket.subject}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 truncate">{ticket.user_name}</span>
                              {ticket.reply_count > 0 && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <MessageSquare className="w-3 h-3" />
                                  {ticket.reply_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Ticket Details */}
              <div className="flex-1 flex flex-col">
                {selectedTicket ? (
                  <>
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 rounded">#{selectedTicket.ticket_number}</span>
                            <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full border', getStatusColor(selectedTicket.status))}>
                              {tC(`support.${selectedTicket.status}`)}
                            </span>
                            <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full border', getPriorityColor(selectedTicket.priority))}>
                              {tC(`support.${selectedTicket.priority}`)}
                            </span>
                          </div>
                          <h2 className="text-base font-semibold text-gray-900">{selectedTicket.subject}</h2>
                        </div>
                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={selectedTicket.status}
                            onChange={(e) => handleSupportStatusChange(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                          >
                            <option value="open">{tC('support.open')}</option>
                            <option value="in_progress">{tC('support.in_progress')}</option>
                            <option value="resolved">{tC('support.resolved')}</option>
                            <option value="closed">{tC('support.closed')}</option>
                            <option value="spam">{tC('support.spam')}</option>
                          </select>
                          <select
                            value={selectedTicket.priority}
                            onChange={(e) => handleSupportPriorityChange(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                          >
                            <option value="low">{tC('support.low')}</option>
                            <option value="normal">{tC('support.normal')}</option>
                            <option value="high">{tC('support.high')}</option>
                            <option value="urgent">{tC('support.urgent')}</option>
                          </select>
                        </div>
                      </div>
                      {/* Meta */}
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">{tC('support.customer')}: </span>
                          <span className="font-medium">{selectedTicket.user_name}</span>
                          <span className="text-gray-400 ml-1">({selectedTicket.user_email})</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{tC('support.category')}: </span>
                          <span className="font-medium">{tC(`support.${selectedTicket.category}`)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{tC('support.assignee')}: </span>
                          <div className="relative inline-block">
                            <button
                              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                              className="font-medium text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              {selectedTicket.assigned_to_name || tC('support.unassigned')}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {showAssignDropdown && (
                              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[180px]">
                                <button
                                  onClick={() => handleAssign(null)}
                                  className="w-full px-4 py-2 text-left text-xs hover:bg-gray-50"
                                >
                                  {tC('support.unassigned')}
                                </button>
                                {supportAdmins.map((admin) => (
                                  <button
                                    key={admin.id}
                                    onClick={() => handleAssign(admin.id)}
                                    className={clsx(
                                      'w-full px-4 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2',
                                      selectedTicket.assigned_to === admin.id && 'bg-indigo-50',
                                    )}
                                  >
                                    <User className="w-3 h-3 text-gray-400" />
                                    {admin.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Rating */}
                      {selectedTicket.rating && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">{tC('support.rating')}:</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={clsx(
                                  'w-3 h-3',
                                  star <= (selectedTicket.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Replies */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                      {/* Original Message */}
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="font-medium text-xs">{selectedTicket.user_name}</span>
                          <span className="text-xs text-gray-400">{formatDate(selectedTicket.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>

                      {/* Reply Messages */}
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={clsx(
                            'rounded-2xl p-4',
                            reply.is_admin_reply ? 'bg-indigo-50 ml-12' : 'bg-gray-50 mr-12',
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {reply.is_admin_reply ? (
                              <>
                                <UserCheck className="w-3 h-3 text-indigo-600" />
                                <span className="font-medium text-xs text-indigo-600">{reply.user_name || 'Admin'}</span>
                              </>
                            ) : (
                              <>
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="font-medium text-xs">{reply.user_name}</span>
                              </>
                            )}
                            <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Input */}
                    {selectedTicket.status !== 'closed' && selectedTicket.status !== 'spam' && (
                      <div className="p-4 border-t border-gray-100">
                        <div className="flex gap-2">
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder={tC('support.replyPlaceholder')}
                            rows={2}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button
                            onClick={handleSendReply}
                            disabled={!replyMessage.trim() || sending}
                            className="px-4 py-2.5 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {sending ? (
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">{tC('support.selectTicket')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== CONSULTATION DETAIL MODAL ========== */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedRequest(null); }}
        >
          <div
            className="relative bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>clinical_notes</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{tC('admin.consult.requestDetails')}</h3>
                    <p className="text-xs text-slate-500">#{selectedRequest.id.slice(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm text-slate-600">close</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{tC('admin.consult.fullName')}</label>
                  <p className="font-bold text-gray-900 text-base">{selectedRequest.name}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{tC('admin.consult.email')}</label>
                  <a href={`mailto:${selectedRequest.email}`} className="font-semibold text-indigo-600 hover:underline text-sm">
                    {selectedRequest.email}
                  </a>
                </div>
                {selectedRequest.phone && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{tC('admin.consult.phone')}</label>
                    <a href={`tel:${selectedRequest.phone}`} className="font-semibold text-indigo-600 hover:underline flex items-center gap-1.5 text-sm">
                      <span className="material-symbols-outlined text-xs">phone</span>
                      {selectedRequest.phone}
                    </a>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{tC('admin.consult.dateSent')}</label>
                  <p className="font-bold text-gray-900 text-sm">
                    {new Date(selectedRequest.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{tC('admin.consult.requestContent')}</label>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <p className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">{selectedRequest.message}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{tC('admin.consult.updateStatus')}</label>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'reviewed', 'contacted'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedRequest.id, status)}
                      className={clsx(
                        'px-4 py-2 rounded-lg text-xs font-semibold transition-all border',
                        selectedRequest.status === status
                          ? status === 'pending' ? 'bg-amber-400 border-amber-400 text-black'
                          : status === 'reviewed' ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-white border-slate-300 text-gray-700 hover:bg-slate-50',
                      )}
                    >
                      {status === 'pending' && <span className="material-symbols-outlined text-xs mr-1.5">pending_actions</span>}
                      {status === 'reviewed' && <span className="material-symbols-outlined text-xs mr-1.5">visibility</span>}
                      {status === 'contacted' && <span className="material-symbols-outlined text-xs mr-1.5">check_circle</span>}
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-end gap-2">
              <a
                href={`mailto:${selectedRequest.email}?subject=Re: ${tC('admin.consult.title')}`}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-colors border border-indigo-600"
              >
                <span className="material-symbols-outlined text-sm">email</span>
                {tC('admin.consult.replyEmail')}
              </a>
              <button
                onClick={() => setSelectedRequest(null)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-700 font-semibold text-sm border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                {tC('admin.consult.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminConsultations;
