import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { 
  Bell, BellOff, Check, CheckCheck, Trash2, AlertTriangle, 
  AlertCircle, Info, CheckCircle, RefreshCw, 
  ExternalLink, Clock, Filter as FilterIcon 
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'system';
  title: string;
  message: string;
  link?: string;
  link_label?: string;
  is_read: boolean;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'general' | 'user' | 'product' | 'system' | 'security' | 'performance' | 'support';
  metadata?: any;
  createdAt: string;
  readAt?: string;
}

// Translations
const tL = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'notifications.title': 'Thông báo',
      'notifications.subtitle': 'Quản lý thông báo hệ thống',
      'notifications.empty': 'Không có thông báo nào',
      'notifications.emptyDesc': 'Tất cả thông báo đã được đọc hoặc chưa có thông báo mới.',
      'notifications.markAllRead': 'Đánh dấu tất cả đã đọc',
      'notifications.clearRead': 'Xóa thông báo đã đọc',
      'notifications.filter': 'Lọc',
      'notifications.all': 'Tất cả',
      'notifications.unread': 'Chưa đọc',
      'notifications.read': 'Đã đọc',
      'notifications.priority': 'Mức ưu tiên',
      'notifications.category': 'Danh mục',
      'notifications.type': 'Loại',
      'notifications.low': 'Thấp',
      'notifications.normal': 'Bình thường',
      'notifications.high': 'Cao',
      'notifications.urgent': 'Khẩn cấp',
      'notifications.general': 'Tổng quát',
      'notifications.user': 'Người dùng',
      'notifications.product': 'Sản phẩm',
      'notifications.system': 'Hệ thống',
      'notifications.security': 'Bảo mật',
      'notifications.performance': 'Hiệu suất',
      'notifications.support': 'Hỗ trợ',
      'notifications.justNow': 'Vừa xong',
      'notifications.minutesAgo': 'phút trước',
      'notifications.hoursAgo': 'giờ trước',
      'notifications.daysAgo': 'ngày trước',
      'notifications.info': 'Thông tin',
      'notifications.warning': 'Cảnh báo',
      'notifications.error': 'Lỗi tải thông báo',
      'notifications.success': 'Thành công',
      'notifications.unreadCount': 'chưa đọc',
      'notifications.markRead': 'Đánh dấu đã đọc',
      'notifications.delete': 'Xóa',
      'notifications.view': 'Xem',
      'notifications.loading': 'Đang tải...',
    },
    en: {
      'notifications.title': 'Notifications',
      'notifications.subtitle': 'System notifications management',
      'notifications.empty': 'No notifications',
      'notifications.emptyDesc': 'All notifications have been read or there are no new notifications.',
      'notifications.markAllRead': 'Mark all as read',
      'notifications.clearRead': 'Clear read notifications',
      'notifications.filter': 'Filter',
      'notifications.all': 'All',
      'notifications.unread': 'Unread',
      'notifications.read': 'Read',
      'notifications.priority': 'Priority',
      'notifications.category': 'Category',
      'notifications.type': 'Type',
      'notifications.low': 'Low',
      'notifications.normal': 'Normal',
      'notifications.high': 'High',
      'notifications.urgent': 'Urgent',
      'notifications.general': 'General',
      'notifications.user': 'Users',
      'notifications.product': 'Products',
      'notifications.system': 'System',
      'notifications.security': 'Security',
      'notifications.performance': 'Performance',
      'notifications.support': 'Support',
      'notifications.justNow': 'Just now',
      'notifications.minutesAgo': 'minutes ago',
      'notifications.hoursAgo': 'hours ago',
      'notifications.daysAgo': 'days ago',
      'notifications.info': 'Info',
      'notifications.warning': 'Warning',
      'notifications.error': 'Error loading notifications',
      'notifications.success': 'Success',
      'notifications.unreadCount': 'unread',
      'notifications.markRead': 'Mark as read',
      'notifications.delete': 'Delete',
      'notifications.view': 'View',
      'notifications.loading': 'Loading...',
    },
    ar: {
      'notifications.title': 'الإشعارات',
      'notifications.subtitle': 'إدارة إشعارات النظام',
      'notifications.empty': 'لا توجد إشعارات',
      'notifications.emptyDesc': 'تم قراءة جميع الإشعارات أو لا توجد إشعارات جديدة.',
      'notifications.markAllRead': 'تعيين الكل كمقروء',
      'notifications.clearRead': 'مسح الإشعارات المقروءة',
      'notifications.filter': 'تصفية',
      'notifications.all': 'الكل',
      'notifications.unread': 'غير مقروء',
      'notifications.read': 'مقروء',
      'notifications.priority': 'الأولوية',
      'notifications.category': 'الفئة',
      'notifications.type': 'النوع',
      'notifications.low': 'منخفض',
      'notifications.normal': 'عادي',
      'notifications.high': 'مرتفع',
      'notifications.urgent': 'عاجل',
      'notifications.general': 'عام',
      'notifications.user': 'المستخدمين',
      'notifications.product': 'المنتجات',
      'notifications.system': 'النظام',
      'notifications.security': 'الأمان',
      'notifications.performance': 'الأداء',
      'notifications.support': 'الدعم',
      'notifications.justNow': 'الآن',
      'notifications.minutesAgo': 'دقائق',
      'notifications.hoursAgo': 'ساعات',
      'notifications.daysAgo': 'أيام',
      'notifications.info': 'معلومات',
      'notifications.warning': 'تحذير',
      'notifications.error': 'خطأ في تحميل الإشعارات',
      'notifications.success': 'نجاح',
      'notifications.unreadCount': 'غير مقروء',
      'notifications.markRead': 'تعيين كمقروء',
      'notifications.delete': 'حذف',
      'notifications.view': 'عرض',
      'notifications.loading': 'جاري التحميل...',
    },
    fr: {
      'notifications.title': 'Notifications',
      'notifications.subtitle': 'Gestion des notifications système',
      'notifications.empty': 'Aucune notification',
      'notifications.emptyDesc': 'Toutes les notifications ont été lues ou il n\'y a pas de nouvelles notifications.',
      'notifications.markAllRead': 'Tout marquer comme lu',
      'notifications.clearRead': 'Effacer les notifications lues',
      'notifications.filter': 'Filtrer',
      'notifications.all': 'Tout',
      'notifications.unread': 'Non lu',
      'notifications.read': 'Lu',
      'notifications.priority': 'Priorité',
      'notifications.category': 'Catégorie',
      'notifications.type': 'Type',
      'notifications.low': 'Faible',
      'notifications.normal': 'Normal',
      'notifications.high': 'Élevé',
      'notifications.urgent': 'Urgent',
      'notifications.general': 'Général',
      'notifications.user': 'Utilisateurs',
      'notifications.product': 'Produits',
      'notifications.system': 'Système',
      'notifications.security': 'Sécurité',
      'notifications.performance': 'Performance',
      'notifications.support': 'Support',
      'notifications.justNow': 'À l\'instant',
      'notifications.minutesAgo': 'minutes',
      'notifications.hoursAgo': 'heures',
      'notifications.daysAgo': 'jours',
      'notifications.info': 'Info',
      'notifications.warning': 'Avertissement',
      'notifications.error': 'Erreur de chargement des notifications',
      'notifications.success': 'Succès',
      'notifications.unreadCount': 'non lu',
      'notifications.markRead': 'Marquer comme lu',
      'notifications.delete': 'Supprimer',
      'notifications.view': 'Voir',
      'notifications.loading': 'Chargement...',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'system': return <Bell className="w-5 h-5 text-purple-500" />;
    default: return <Bell className="w-5 h-5 text-gray-500" />;
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

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'security': return 'bg-red-50 text-red-600';
    case 'user': return 'bg-blue-50 text-blue-600';
    case 'product': return 'bg-green-50 text-green-600';
    case 'system': return 'bg-purple-50 text-purple-600';
    case 'performance': return 'bg-yellow-50 text-yellow-600';
    case 'support': return 'bg-indigo-50 text-indigo-600';
    default: return 'bg-gray-50 text-gray-600';
  }
};

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return tL('notifications.justNow');
  if (diffMins < 60) return `${diffMins} ${tL('notifications.minutesAgo')}`;
  if (diffHours < 24) return `${diffHours} ${tL('notifications.hoursAgo')}`;
  return `${diffDays} ${tL('notifications.daysAgo')}`;
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const params: any = { limit: 100 };
      
      if (filter === 'unread') params.is_read = false;
      if (filter === 'read') params.is_read = true;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      
      const res = await adminApi.getNotifications(params);
      if (res.success && res.data) {
        setNotifications(res.data.notifications as any);
        setUnreadCount(res.data.unreadCount);
      } else {
        setError(res.error || 'Failed to load notifications');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading notifications');
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter, typeFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: string) => {
    const res = await adminApi.markNotificationRead(id);
    if (res.success) {
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, is_read: true, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    const res = await adminApi.markAllNotificationsRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, isRead: true })));
      setUnreadCount(0);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await adminApi.deleteNotification(id);
    if (res.success) {
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const handleClearRead = async () => {
    const res = await adminApi.clearAllReadNotifications();
    if (res.success) {
      setNotifications(prev => prev.filter(n => !n.is_read));
    }
  };

  const filteredNotifications = notifications;

  return (
    <AdminLayout titleKey="notifications.title" subtitleKey="notifications.subtitle">
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-indigo-500/20 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-400/20 via-transparent to-transparent rounded-3xl"></div>
          
          {/* Decorative Elements */}
          <div className="absolute top-4 right-4 w-32 h-32 bg-gradient-to-br from-violet-300/30 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-tr from-purple-300/30 to-transparent rounded-full blur-xl"></div>
          
          {/* Content */}
          <div className="relative z-10 p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Icon and Title Row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Bell className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-on-surface tracking-tight">
                      {tL('notifications.title')}
                    </h1>
                    <p className="text-base font-medium text-on-surface-variant mt-1">
                      {tL('notifications.subtitle')}
                    </p>
                  </div>
                </div>
                
                {/* Stats Summary */}
                <div className="flex items-center gap-6 mt-6">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-violet-200">
                    <Bell className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-gray-700">{notifications.length}</span>
                    <span className="text-xs text-gray-500">{tL('notifications.all')}</span>
                  </div>
                  {unreadCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 backdrop-blur-sm rounded-full border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-700">{unreadCount}</span>
                      <span className="text-xs text-red-500">{tL('notifications.unreadCount')}</span>
                    </div>
                  )}
                  {notifications.filter(n => n.priority === 'urgent' && !n.is_read).length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 backdrop-blur-sm rounded-full border border-orange-200">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-semibold text-orange-700">
                        {notifications.filter(n => n.priority === 'urgent' && !n.is_read).length}
                      </span>
                      <span className="text-xs text-orange-500">{tL('notifications.urgent')}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Decorative Icon */}
              <div className="hidden lg:block relative">
                <div className="w-32 h-32 bg-gradient-to-br from-violet-100 to-purple-100 rounded-3xl flex items-center justify-center border-2 border-violet-200/50">
                  <div className="w-24 h-24 bg-gradient-to-br from-violet-200/50 to-indigo-200/50 rounded-2xl flex items-center justify-center">
                    <Bell className="w-12 h-12 text-violet-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions Bar */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-violet-50">
          {/* Filter Tabs */}
          <div className="flex rounded-xl bg-violet-50 p-1 gap-1">
            {(['all', 'unread', 'read'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filter === f
                    ? 'bg-white text-violet-700 shadow-sm border border-violet-200'
                    : 'text-violet-600 hover:text-violet-800'
                )}
              >
                {f === 'all' && tL('notifications.all')}
                {f === 'unread' && tL('notifications.unread')}
                {f === 'read' && tL('notifications.read')}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              showFilters
                ? 'bg-violet-100 text-violet-700'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            )}
          >
            <FilterIcon className="w-4 h-4" />
            {tL('notifications.filter')}
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 hover:text-gray-900 text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          </button>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 text-sm font-medium transition-all shadow-sm shadow-violet-500/30"
            >
              <CheckCheck className="w-4 h-4" />
              {tL('notifications.markAllRead')}
            </button>
          )}

          {/* Clear Read */}
          <button
            onClick={handleClearRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 hover:text-gray-900 text-sm font-medium transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {tL('notifications.category')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">{tL('notifications.all')}</option>
                <option value="general">{tL('notifications.general')}</option>
                <option value="user">{tL('notifications.user')}</option>
                <option value="product">{tL('notifications.product')}</option>
                <option value="system">{tL('notifications.system')}</option>
                <option value="security">{tL('notifications.security')}</option>
                <option value="performance">{tL('notifications.performance')}</option>
                <option value="support">{tL('notifications.support')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {tL('notifications.type')}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">{tL('notifications.all')}</option>
                <option value="info">{tL('notifications.info')}</option>
                <option value="warning">{tL('notifications.warning')}</option>
                <option value="error">{tL('notifications.error')}</option>
                <option value="success">{tL('notifications.success')}</option>
                <option value="system">{tL('notifications.system')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {tL('notifications.priority')}
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">{tL('notifications.all')}</option>
                <option value="urgent">{tL('notifications.urgent')}</option>
                <option value="high">{tL('notifications.high')}</option>
                <option value="normal">{tL('notifications.normal')}</option>
                <option value="low">{tL('notifications.low')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{tL('notifications.loading')}</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{error}</p>
              <button
                onClick={loadNotifications}
                className="mt-3 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
              >
                Thử lại
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {tL('notifications.empty')}
              </h3>
              <p className="text-gray-500 text-sm">{tL('notifications.emptyDesc')}</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={clsx(
                  'p-4 hover:bg-gray-50 transition-colors',
                  !notification.is_read && 'bg-blue-50/50'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={clsx(
                            'font-semibold text-sm',
                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                          )}>
                            {notification.title}
                          </h4>
                          {notification.priority === 'urgent' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full uppercase">
                              {tL('notifications.urgent')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {notification.link && (
                          <a
                            href={notification.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                            title={tL('notifications.markRead')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-2 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                          title={tL('notifications.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Tags & Time */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={clsx(
                        'px-2 py-0.5 text-xs font-medium rounded-full border',
                        getCategoryColor(notification.category)
                      )}>
                        {tL(`notifications.${notification.category}`)}
                      </span>
                      <span className={clsx(
                        'px-2 py-0.5 text-xs font-medium rounded-full border',
                        getPriorityColor(notification.priority)
                      )}>
                        {tL(`notifications.${notification.priority}`)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
