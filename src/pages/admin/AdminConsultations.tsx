import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, type Consultation } from './adminApi';
import clsx from 'clsx';
import { useLanguageStore } from '@/stores';

// Admin Consultations translations - supports all languages via useLanguageStore
const tC = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Top bar
      'admin.topBar.consultations': 'Tư vấn',
      'admin.topBar.consultationsSub': 'Xem và quản lý các yêu cầu tư vấn',
      // Consultations
      'admin.consult.title': 'Yêu cầu Tư vấn',
      'admin.consult.subtitle': 'Theo dõi và xử lý các yêu cầu tư vấn từ người dùng',
      'admin.consult.totalRequests': 'Tổng yêu cầu',
      'admin.consult.pending': 'Đang chờ',
      'admin.consult.reviewed': 'Đã xem',
      'admin.consult.contacted': 'Đã liên hệ',
      'admin.consult.filter': 'Lọc',
      'admin.consult.all': 'Tất cả',
      'admin.consult.status.pending': 'Đang chờ',
      'admin.consult.status.reviewed': 'Đã xem',
      'admin.consult.status.contacted': 'Đã liên hệ',
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
      'consult.title': 'Yêu cầu Tư vấn',
    },
    en: {
      // Top bar
      'admin.topBar.consultations': 'Consultations',
      'admin.topBar.consultationsSub': 'View and manage consultation requests',
      // Consultations
      'admin.consult.title': 'Consultation Requests',
      'admin.consult.subtitle': 'Track and process consultation requests from users',
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
      'consult.title': 'Consultation Request',
    },
    ar: {
      // Top bar
      'admin.topBar.consultations': 'الاستشارات',
      'admin.topBar.consultationsSub': 'عرض وإدارة طلبات الاستشارة',
      // Consultations
      'admin.consult.title': 'طلبات الاستشارة',
      'admin.consult.subtitle': 'تتبع ومعالجة طلبات الاستشارة من المستخدمين',
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
      'consult.title': 'طلب استشارة',
    },
    fr: {
      // Top bar
      'admin.topBar.consultations': 'Consultations',
      'admin.topBar.consultationsSub': 'Voir et gérer les demandes de consultation',
      // Consultations
      'admin.consult.title': 'Demandes de consultation',
      'admin.consult.subtitle': 'Suivez et traitez les demandes de consultation des utilisateurs',
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
      'admin.consult.dateSent': 'Date d\'envoi',
      'admin.consult.requestContent': 'Contenu de la demande',
      'admin.consult.updateStatus': 'Mettre à jour le statut',
      'admin.consult.replyEmail': 'Répondre par Email',
      'admin.consult.close': 'Fermer',
      'consult.title': 'Demande de consultation',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

export function AdminConsultations() {
  const [requests, setRequests] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Consultation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const language = 'vi';

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getConsultations({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setRequests(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err: any) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const updateStatus = async (id: string, status: 'pending' | 'reviewed' | 'contacted') => {
    try {
      const res = await adminApi.updateConsultation(id, { status });
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        if (selectedRequest?.id === id) {
          setSelectedRequest({ ...selectedRequest, status });
        }
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredRequests = requests;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    reviewed: 'bg-blue-100 text-blue-800 border-blue-300',
    contacted: 'bg-green-100 text-green-800 border-green-300',
  };

  const statusLabels = {
    pending: tC('admin.consult.status.pending'),
    reviewed: tC('admin.consult.status.reviewed'),
    contacted: tC('admin.consult.status.contacted'),
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.consultations"
      subtitleKey="admin.topBar.consultationsSub"
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight flex items-center gap-4">
              {tC('admin.consult.title')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {tC('admin.consult.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Metric 1 - Total */}
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-on-surface text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{tC('admin.consult.totalRequests')}</p>
            <h3 className="text-xl font-black text-on-surface">{requests.length}</h3>
          </div>
        </div>

        {/* Metric 2 - Pending */}
        <div className="relative bg-gradient-to-br from-yellow-50/80 to-yellow-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-yellow-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-yellow-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1">{tC('admin.consult.pending')}</p>
            <h3 className="text-xl font-black text-yellow-700">{requests.filter(r => r.status === 'pending').length}</h3>
          </div>
        </div>

        {/* Metric 3 - Reviewed */}
        <div className="relative bg-gradient-to-br from-blue-50/80 to-blue-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-blue-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">{tC('admin.consult.reviewed')}</p>
            <h3 className="text-xl font-black text-blue-700">{requests.filter(r => r.status === 'reviewed').length}</h3>
          </div>
        </div>

        {/* Metric 4 - Contacted */}
        <div className="relative bg-gradient-to-br from-green-50/80 to-green-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-green-100 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">{tC('admin.consult.contacted')}</p>
            <h3 className="text-xl font-black text-green-700">{requests.filter(r => r.status === 'contacted').length}</h3>
          </div>
        </div>
      </section>

      {/* Filter & Action Row */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2">{tC('admin.consult.filter')}</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              statusFilter === 'all'
                ? 'bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-white/80 border-transparent hover:border-black transition-colors'
            )}
          >
            {tC('admin.consult.all')}
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              statusFilter === 'pending'
                ? 'bg-yellow-400 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-yellow-50 border-transparent hover:border-black transition-colors'
            )}
          >
            {tC('admin.consult.status.pending')}
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              statusFilter === 'reviewed'
                ? 'bg-blue-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-blue-50 border-transparent hover:border-black transition-colors'
            )}
          >
            {tC('admin.consult.status.reviewed')}
          </button>
          <button
            onClick={() => setStatusFilter('contacted')}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              statusFilter === 'contacted'
                ? 'bg-green-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-green-50 border-transparent hover:border-black transition-colors'
            )}
          >
            {tC('admin.consult.status.contacted')}
          </button>
        </div>
        <div>
          <button className="flex items-center gap-2 bg-white text-primary px-6 py-2.5 rounded-full font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group">
            <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-y-1">cloud_download</span>
            {tC('admin.consult.exportReport')}
          </button>
        </div>
      </div>

      {/* Requests List / Empty State */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        
        {loading ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#000] animate-pulse">
              <span className="material-symbols-outlined text-gray-400 text-3xl">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">{tC('admin.consult.loading')}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-6 text-gray-400 transform rotate-[-3deg] hover:rotate-0 transition-all duration-300 shadow-[8px_8px_0px_0px_#000]">
              <span className="material-symbols-outlined text-5xl">inbox</span>
            </div>
            <h4 className="text-2xl font-black text-on-surface mb-2">{tC('admin.consult.noRequests')}</h4>
            <p className="text-base font-medium text-on-surface-variant text-center max-w-sm">
              {tC('admin.consult.noRequestsHint')}
            </p>
          </div>
        ) : (
          <div className="relative z-10 space-y-4">
            {filteredRequests.map((request, index) => (
              <div
                key={request.id}
                className="bg-white/60 backdrop-blur-xl rounded-2xl border-2 border-black p-6 hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all cursor-pointer"
                style={{
                  boxShadow: `${4 + (index % 3) * 2}px ${4 + (index % 3) * 2}px 0px 0px #000`,
                }}
                onClick={() => setSelectedRequest(request)}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
                      <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-lg">{request.name}</h4>
                      <p className="text-sm text-on-surface-variant">{request.email}</p>
                      {request.phone && (
                        <p className="text-sm text-on-surface-variant flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-sm">phone</span>
                          {request.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase border-2 bg-gray-50 border-black">
                      {new Date(request.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    <span className={clsx(
                      'px-4 py-2 rounded-full text-sm font-bold border-2 border-black',
                      statusColors[request.status]
                    )}>
                      {statusLabels[request.status]}
                    </span>
                    <button className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all">
                      {tC('admin.consult.viewDetails')}
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-gray-50/60 rounded-xl border border-black/20">
                  <p className="text-sm text-on-surface-variant line-clamp-2">{request.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-10 right-10 z-50">
        <button className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          <span className="material-symbols-outlined text-2xl font-bold">add</span>
        </button>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedRequest(null); }}
        >
          <div
            className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-3xl border-3 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[12px_12px_0px_0px_#000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
                    <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>clinical_notes</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-on-surface">{tC('admin.consult.requestDetails')}</h3>
                    <p className="text-sm text-on-surface-variant">{tC('admin.consult.code')} #{selectedRequest.id.slice(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{tC('admin.consult.fullName')}</label>
                  <p className="font-bold text-on-surface text-lg">{selectedRequest.name}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{tC('admin.common.email')}</label>
                  <a href={`mailto:${selectedRequest.email}`} className="font-bold text-primary hover:underline">
                    {selectedRequest.email}
                  </a>
                </div>
                {selectedRequest.phone && (
                  <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{tC('admin.consult.phone')}</label>
                    <a href={`tel:${selectedRequest.phone}`} className="font-bold text-primary hover:underline flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">phone</span>
                      {selectedRequest.phone}
                    </a>
                  </div>
                )}
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{tC('admin.consult.dateSent')}</label>
                  <p className="font-bold text-on-surface">
                    {new Date(selectedRequest.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Message Content */}
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{tC('admin.consult.requestContent')}</label>
                <div className="p-4 bg-gray-50/60 rounded-xl border border-black/20">
                  <p className="whitespace-pre-wrap text-on-surface leading-relaxed">{selectedRequest.message}</p>
                </div>
              </div>

              {/* Status Update */}
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{tC('admin.consult.updateStatus')}</label>
                <div className="flex flex-wrap gap-3">
                  {(['pending', 'reviewed', 'contacted'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedRequest.id, status)}
                      className={clsx(
                        'px-5 py-3 rounded-xl text-sm font-bold transition-all border-2 border-black',
                        selectedRequest.status === status
                          ? status === 'pending' ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_#000]'
                            : status === 'reviewed' ? 'bg-blue-500 text-white shadow-[2px_2px_0px_0px_#000]'
                            : 'bg-green-500 text-white shadow-[2px_2px_0px_0px_#000]'
                          : 'bg-white shadow-[2px_2px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000]'
                      )}
                    >
                      {status === 'pending' && <span className="material-symbols-outlined text-sm mr-2">pending_actions</span>}
                      {status === 'reviewed' && <span className="material-symbols-outlined text-sm mr-2">visibility</span>}
                      {status === 'contacted' && <span className="material-symbols-outlined text-sm mr-2">check_circle</span>}
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t-2 border-black bg-white/80 backdrop-blur-xl flex flex-col sm:flex-row justify-end gap-3">
              <a
                href={`mailto:${selectedRequest.email}?subject=Re: ${tC('admin.topBar.consultations')}&body=${tC('consult.title')}, ${selectedRequest.name},`}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
              >
                <span className="material-symbols-outlined">email</span>
                {tC('admin.consult.replyEmail')}
              </a>
              <button
                onClick={() => setSelectedRequest(null)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-on-surface font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
              >
                <span className="material-symbols-outlined">close</span>
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
