import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayoutLinear';
import { adminApi } from './adminApi';
import { useLanguageStore, useAuthStore } from '@/stores';
import clsx from 'clsx';
import { 
  Ticket, Send, Clock, AlertCircle, CheckCircle, 
  X, Search, User, MessageSquare, ChevronDown,
  Star, UserCheck
} from 'lucide-react';

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
  attachments?: any[];
  user_name?: string;
  user_email?: string;
  created_at: string;
}

// Translations
const tL = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
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
      'support.updated': 'Cập nhật',
      'support.reply': 'Phản hồi',
      'support.sendReply': 'Gửi phản hồi',
      'support.replyPlaceholder': 'Nhập phản hồi của bạn...',
      'support.noTickets': 'Không có ticket nào',
      'support.noTicketsDesc': 'Chưa có ticket hỗ trợ nào được tạo.',
      'support.loading': 'Đang tải...',
      'support.search': 'Tìm kiếm ticket...',
      'support.filter': 'Lọc',
      'support.all': 'Tất cả',
      'support.selectTicket': 'Chọn một ticket để xem chi tiết',
      'support.viewDetails': 'Xem chi tiết',
      'support.replySent': 'Phản hồi đã được gửi',
      'support.updateSuccess': 'Cập nhật thành công',
      'support.assignTo': 'Giao cho',
      'support.unassigned': 'Chưa phân công',
      'support.rate': 'Đánh giá',
      'support.rating': 'Đánh giá khách hàng',
    },
    en: {
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
      'support.updated': 'Updated',
      'support.reply': 'Reply',
      'support.sendReply': 'Send Reply',
      'support.replyPlaceholder': 'Enter your reply...',
      'support.noTickets': 'No tickets',
      'support.noTicketsDesc': 'No support tickets have been created yet.',
      'support.loading': 'Loading...',
      'support.search': 'Search tickets...',
      'support.filter': 'Filter',
      'support.all': 'All',
      'support.selectTicket': 'Select a ticket to view details',
      'support.viewDetails': 'View Details',
      'support.replySent': 'Reply sent',
      'support.updateSuccess': 'Update successful',
      'support.assignTo': 'Assign to',
      'support.unassigned': 'Unassigned',
      'support.rate': 'Rate',
      'support.rating': 'Customer Rating',
    },
    ar: {
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
    },
    fr: {
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
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open': return <div className="w-3 h-3 rounded-full bg-blue-500" />;
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
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface Admin {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
}

export default function AdminSupport() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setError(null);
      const params: any = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await adminApi.getSupportTickets(params);
      if (res.success && res.data) {
        setTickets(res.data.tickets as any);
        setStats(res.data.stats);
      } else {
        setError(res.error || 'Failed to load tickets');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const loadAdmins = async () => {
    const res = await adminApi.getSupportAdmins();
    if (res.success && res.data) {
      setAdmins(res.data);
    }
  };

  const loadTicketDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      const res = await adminApi.getSupportTicket(id);
      if (res.success && res.data) {
        setSelectedTicket(res.data.ticket as any);
        setReplies(res.data.replies);
      }
    } catch (err: any) {
      console.error('Error loading ticket details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadTickets();
    loadAdmins();
  }, [loadTickets]);

  const handleSelectTicket = (ticket: TicketData) => {
    setSelectedTicket(ticket);
    loadTicketDetails(ticket.id);
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedTicket) return;
    
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { status });
    if (res.success) {
      setSelectedTicket(prev => prev ? { ...prev, status: status as any } : null);
      loadTickets();
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!selectedTicket) return;
    
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { priority });
    if (res.success) {
      setSelectedTicket(prev => prev ? { ...prev, priority: priority as any } : null);
      loadTickets();
    }
  };

  const handleAssign = async (adminId: string | null) => {
    if (!selectedTicket) return;
    
    const res = await adminApi.updateSupportTicket(selectedTicket.id, { assigned_to: adminId || undefined });
    if (res.success) {
      const assignedAdmin = adminId ? admins.find(a => a.id === adminId) : null;
      setSelectedTicket(prev => prev ? {
        ...prev,
        assigned_to: adminId || undefined,
        assigned_to_name: assignedAdmin?.name
      } : null);
      setShowAssignDropdown(false);
      loadTickets();
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    try {
      setSending(true);
      const res = await adminApi.replyToSupportTicket(selectedTicket.id, {
        message: replyMessage.trim(),
      });
      
      if (res.success && res.data) {
        const replyData = res.data;
        setReplies(prev => [...prev, {
          id: replyData.id,
          ticket_id: selectedTicket.id,
          user_id: user?.id,
          is_admin_reply: true,
          message: replyMessage.trim(),
          user_name: user?.name || user?.email,
          created_at: replyData.createdAt,
        }]);
        setReplyMessage('');
        
        // Update ticket status to in_progress if it was open
        if (selectedTicket.status === 'open') {
          await adminApi.updateSupportTicket(selectedTicket.id, { status: 'in_progress' });
          setSelectedTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
        }
        
        loadTickets();
      }
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredTickets = tickets;

  return (
    <AdminLayout titleKey="support.title" subtitleKey="support.subtitle">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={clsx(
            'bg-white rounded-2xl p-4 border shadow-sm transition-all text-left',
            statusFilter === 'all' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
              <p className="text-xs text-gray-500">{tL('support.all')}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('open')}
          className={clsx(
            'bg-white rounded-2xl p-4 border shadow-sm transition-all text-left',
            statusFilter === 'open' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.open || 0}</p>
              <p className="text-xs text-gray-500">{tL('support.open')}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('in_progress')}
          className={clsx(
            'bg-white rounded-2xl p-4 border shadow-sm transition-all text-left',
            statusFilter === 'in_progress' ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.in_progress || 0}</p>
              <p className="text-xs text-gray-500">{tL('support.in_progress')}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('resolved')}
          className={clsx(
            'bg-white rounded-2xl p-4 border shadow-sm transition-all text-left',
            statusFilter === 'resolved' ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.resolved || 0}</p>
              <p className="text-xs text-gray-500">{tL('support.resolved')}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('closed')}
          className={clsx(
            'bg-white rounded-2xl p-4 border shadow-sm transition-all text-left',
            statusFilter === 'closed' ? 'border-gray-500 ring-2 ring-gray-500/20' : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.closed || 0}</p>
              <p className="text-xs text-gray-500">{tL('support.closed')}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex h-[600px]">
          {/* Ticket List */}
          <div className="w-1/3 border-r border-gray-100 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tL('support.search')}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">{tL('support.loading')}</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {tL('support.noTickets')}
                  </h3>
                  <p className="text-gray-500 text-sm">{tL('support.noTicketsDesc')}</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={clsx(
                      'w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors',
                      selectedTicket?.id === ticket.id && 'bg-primary/5 border-l-4 border-l-primary'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(ticket.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            #{ticket.ticket_number}
                          </span>
                          {ticket.priority === 'urgent' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded">
                              {tL('support.urgent')}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {ticket.subject}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 truncate">{ticket.user_name}</span>
                          {ticket.reply_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
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
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-bold bg-gray-100 rounded">
                          #{selectedTicket.ticket_number}
                        </span>
                        <span className={clsx(
                          'px-2 py-1 text-xs font-medium rounded-full border',
                          getStatusColor(selectedTicket.status)
                        )}>
                          {tL(`support.${selectedTicket.status}`)}
                        </span>
                        <span className={clsx(
                          'px-2 py-1 text-xs font-medium rounded-full border',
                          getPriorityColor(selectedTicket.priority)
                        )}>
                          {tL(`support.${selectedTicket.priority}`)}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedTicket.subject}
                      </h2>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                      >
                        <option value="open">{tL('support.open')}</option>
                        <option value="in_progress">{tL('support.in_progress')}</option>
                        <option value="resolved">{tL('support.resolved')}</option>
                        <option value="closed">{tL('support.closed')}</option>
                        <option value="spam">{tL('support.spam')}</option>
                      </select>

                      <select
                        value={selectedTicket.priority}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                      >
                        <option value="low">{tL('support.low')}</option>
                        <option value="normal">{tL('support.normal')}</option>
                        <option value="high">{tL('support.high')}</option>
                        <option value="urgent">{tL('support.urgent')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">{tL('support.customer')}: </span>
                      <span className="font-medium">{selectedTicket.user_name}</span>
                      <span className="text-gray-400 ml-1">({selectedTicket.user_email})</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{tL('support.category')}: </span>
                      <span className="font-medium">{tL(`support.${selectedTicket.category}`)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{tL('support.assignee')}: </span>
                      <div className="relative inline-block">
                        <button
                          onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {selectedTicket.assigned_to_name || tL('support.unassigned')}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showAssignDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[200px]">
                            <button
                              onClick={() => handleAssign(null)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              {tL('support.unassigned')}
                            </button>
                            {admins.map((admin) => (
                              <button
                                key={admin.id}
                                onClick={() => handleAssign(admin.id)}
                                className={clsx(
                                  'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2',
                                  selectedTicket.assigned_to === admin.id && 'bg-primary/5'
                                )}
                              >
                                <User className="w-4 h-4 text-gray-400" />
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
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-gray-500">{tL('support.rating')}:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={clsx(
                              'w-4 h-4',
                              star <= (selectedTicket.rating || 0)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                            )}
                          />
                        ))}
                      </div>
                      {selectedTicket.rating_comment && (
                        <span className="text-xs text-gray-500">({selectedTicket.rating_comment})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Replies */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Original Message */}
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm">{selectedTicket.user_name}</span>
                      <span className="text-xs text-gray-400">{formatDate(selectedTicket.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Reply Messages */}
                  {replies.filter(r => !r.is_admin_reply || r.user_id !== user?.id).map((reply) => (
                    <div
                      key={reply.id}
                      className={clsx(
                        'rounded-2xl p-4',
                        reply.is_admin_reply
                          ? 'bg-primary/5 ml-8'
                          : 'bg-gray-50 mr-8'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {reply.is_admin_reply ? (
                          <>
                            <UserCheck className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm text-primary">
                              {reply.user_name || 'Admin'}
                            </span>
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-sm">{reply.user_name}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {reply.message}
                      </p>
                    </div>
                  ))}

                  {loadingDetails && (
                    <div className="text-center py-4">
                      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                    </div>
                  )}
                </div>

                {/* Reply Input */}
                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'spam' && (
                  <div className="p-4 border-t border-gray-100">
                    <div className="flex gap-3">
                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder={tL('support.replyPlaceholder')}
                        rows={2}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyMessage.trim() || sending}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {sending ? (
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {tL('support.sendReply')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500">{tL('support.selectTicket')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
