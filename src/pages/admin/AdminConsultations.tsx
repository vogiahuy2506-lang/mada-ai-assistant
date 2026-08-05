import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import clsx from 'clsx';

interface ConsultationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'contacted';
}

export function AdminConsultations() {
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/consultation');
      const data = await response.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: ConsultationRequest['status']) => {
    try {
      const response = await fetch(`/api/consultation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        setRequests(prev =>
          prev.map(r => (r.id === id ? { ...r, status } : r))
        );
        if (selectedRequest?.id === id) {
          setSelectedRequest({ ...selectedRequest, status });
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    contacted: 'bg-green-100 text-green-800',
  };

  const statusLabels = {
    pending: 'Chờ xử lý',
    reviewed: 'Đã xem',
    contacted: 'Đã liên hệ',
  };

  return (
    <AdminLayout
      title="Quản lý Yêu cầu Tư vấn"
      subtitle="Xem và xử lý các yêu cầu tư vấn từ người dùng."
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng yêu cầu', count: requests.length, color: 'bg-slate-100 text-slate-700' },
          { label: 'Chờ xử lý', count: requests.filter(r => r.status === 'pending').length, color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Đã xem', count: requests.filter(r => r.status === 'reviewed').length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Đã liên hệ', count: requests.filter(r => r.status === 'contacted').length, color: 'bg-green-100 text-green-700' },
        ].map((stat) => (
          <div key={stat.label} className={clsx('p-4 rounded-2xl', stat.color)}>
            <div className="text-2xl font-bold">{stat.count}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-on-surface-variant">Lọc:</span>
        {['all', 'pending', 'reviewed', 'contacted'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-label-md transition-all',
              statusFilter === status
                ? 'bg-primary text-white'
                : 'bg-surface-container hover:bg-surface-container-high'
            )}
          >
            {status === 'all' ? 'Tất cả' : statusLabels[status as keyof typeof statusLabels]}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Đang tải...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
            <p>Không có yêu cầu nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-on-surface">Người gửi</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-on-surface">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-on-surface hidden md:table-cell">Ngày gửi</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-on-surface">Trạng thái</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-on-surface">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className="border-t border-outline-variant/20 hover:bg-surface-container-low/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-on-surface">{request.name}</div>
                    {request.phone && (
                      <div className="text-xs text-on-surface-variant">{request.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{request.email}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant hidden md:table-cell">
                    {new Date(request.timestamp).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-1 rounded-full text-xs font-semibold', statusColors[request.status])}>
                      {statusLabels[request.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm transition-colors"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant/30">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-lg text-on-surface">Chi tiết yêu cầu</h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 rounded-full hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Họ tên</label>
                  <p className="font-medium text-on-surface">{selectedRequest.name}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Email</label>
                  <a href={`mailto:${selectedRequest.email}`} className="text-primary hover:underline">
                    {selectedRequest.email}
                  </a>
                </div>
                {selectedRequest.phone && (
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Điện thoại</label>
                    <a href={`tel:${selectedRequest.phone}`} className="text-primary hover:underline">
                      {selectedRequest.phone}
                    </a>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ngày gửi</label>
                  <p className="text-on-surface">
                    {new Date(selectedRequest.timestamp).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nội dung yêu cầu</label>
                <div className="p-4 bg-surface-container-low rounded-xl">
                  <p className="whitespace-pre-wrap text-on-surface">{selectedRequest.message}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-2">Cập nhật trạng thái</label>
                <div className="flex gap-2">
                  {(['pending', 'reviewed', 'contacted'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedRequest.id, status)}
                      className={clsx(
                        'px-4 py-2 rounded-xl text-sm font-label-md transition-all',
                        selectedRequest.status === status
                          ? statusColors[status] + ' ring-2 ring-offset-2 ring-primary'
                          : 'bg-surface-container hover:bg-surface-container-high'
                      )}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/30 flex justify-end gap-3">
              <a
                href={`mailto:${selectedRequest.email}?subject=Re: Yêu cầu tư vấn MADA&body=Xin chào ${selectedRequest.name},`}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all"
              >
                Trả lời qua Email
              </a>
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-6 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high font-label-md transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
