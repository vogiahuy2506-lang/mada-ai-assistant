import { useState } from 'react';
import { Sidebar } from '@/components';
import { 
  Inbox, Clock, CheckCircle, User, 
  Mail, Phone, Send, ChevronRight,
  Loader2
} from 'lucide-react';
import clsx from 'clsx';

interface ConsultationRequest {
  id: string;
  name: string;
  email: string;
  phone?: string;
  content: string;
  aiResponse?: string;
  expertResponse?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
}

const mockRequests: ConsultationRequest[] = [
  { 
    id: '1', 
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@email.com',
    phone: '0912 345 678',
    content: 'Tôi cần tư vấn về bàn phím cho người khiếm thị',
    aiResponse: 'Đã đề xuất: Bàn phím Braille cảm ứng...',
    status: 'pending',
    createdAt: '2024-08-03 10:30'
  },
  { 
    id: '2', 
    name: 'Trần Thị B',
    email: 'tranthib@email.com',
    phone: '0987 654 321',
    content: 'Cần thiết bị hỗ trợ người điếc sử dụng điện thoại',
    aiResponse: 'Đã đề xuất: Thiết bị RTT...',
    status: 'in_progress',
    createdAt: '2024-08-03 09:15'
  },
  { 
    id: '3', 
    name: 'Lê Văn C',
    email: 'levanc@email.com',
    content: 'Tìm thiết bị hỗ trợ vận động cho người già',
    aiResponse: 'Đã đề xuất: Ghế xe lăn điện...',
    status: 'resolved',
    createdAt: '2024-08-02 14:20'
  },
];

const statusConfig = {
  pending: { label: 'Đang chờ', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  in_progress: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  resolved: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Đã đóng', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

export function ExpertPage() {
  const [requests, setRequests] = useState(mockRequests);
  const [selectedRequest, setSelectedRequest] = useState<typeof mockRequests[0] | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredRequests = filter === 'all' 
    ? requests 
    : requests.filter(r => r.status === filter);

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  };

  const handleReply = () => {
    if (selectedRequest && replyContent) {
      setRequests(prev => prev.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, status: 'resolved', expertResponse: replyContent }
          : r
      ));
      setReplyContent('');
      setSelectedRequest(null);
    }
  };

  return (
    <div className="flex h-screen bg-background dark:bg-on-background">
      <Sidebar variant="expert" />

      <main className="flex-1 ml-64 overflow-hidden flex">
        {/* Request List */}
        <div className="w-1/3 border-r-2 border-on-background dark:border-surface flex flex-col">
          {/* Header */}
          <div className="p-4 border-b-2 border-on-background dark:border-surface">
            <h2 className="font-bold text-headline-sm mb-4">Danh sách yêu cầu</h2>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-label-mono">Chờ</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                <div className="text-label-mono">Xử lý</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                <div className="text-label-mono">Xong</div>
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              {['all', 'pending', 'in_progress', 'resolved'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-label-mono transition-colors',
                    filter === status 
                      ? 'bg-primary text-on-primary' 
                      : 'bg-surface-container dark:bg-surface-container-high hover:bg-outline'
                  )}
                >
                  {status === 'all' ? 'Tất cả' : status === 'in_progress' ? 'Xử lý' : status === 'pending' ? 'Chờ' : 'Xong'}
                </button>
              ))}
            </div>
          </div>

          {/* Request List */}
          <div className="flex-1 overflow-y-auto">
            {filteredRequests.map((request) => {
              const status = statusConfig[request.status as keyof typeof statusConfig];
              return (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={clsx(
                    'w-full p-4 text-left border-b border-outline-variant transition-colors',
                    'hover:bg-surface-container dark:hover:bg-surface-container-high',
                    selectedRequest?.id === request.id && 'bg-primary/10 border-l-4 border-l-primary'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{request.name}</span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-label-mono', status.color)}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2 mb-2">
                    {request.content}
                  </p>
                  <div className="flex items-center gap-2 text-label-mono text-on-surface-variant">
                    <Clock className="w-3 h-3" />
                    {request.createdAt}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Request Detail */}
        <div className="flex-1 flex flex-col">
          {selectedRequest ? (
            <>
              {/* Header */}
              <div className="p-6 border-b-2 border-on-background dark:border-surface">
                <div className="flex items-center gap-2 text-label-mono text-on-surface-variant mb-2">
                  <span>Mã yêu cầu: #{selectedRequest.id}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>{new Date(selectedRequest.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <h2 className="font-bold text-headline-sm">Chi tiết yêu cầu</h2>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* User Info */}
                <div className="p-4 bg-surface-container dark:bg-surface-container-high rounded-xl">
                  <h3 className="font-bold text-body-md mb-3">Thông tin người gửi</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-on-surface-variant" />
                      <span>{selectedRequest.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-on-surface-variant" />
                      <span>{selectedRequest.email}</span>
                    </div>
                    {selectedRequest.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-on-surface-variant" />
                        <span>{selectedRequest.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Question */}
                <div className="p-4 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface rounded-xl">
                  <h3 className="font-bold text-body-md mb-3">Câu hỏi của người dùng</h3>
                  <p className="text-body-md">{selectedRequest.content}</p>
                </div>

                {/* AI Response */}
                <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary">smart_toy</span>
                    <h3 className="font-bold text-body-md">Phản hồi của AI</h3>
                  </div>
                  <p className="text-body-md text-on-surface-variant">{selectedRequest.aiResponse}</p>
                </div>

                {/* Reply Section */}
                {selectedRequest.status !== 'resolved' && selectedRequest.status !== 'closed' && (
                  <div className="p-4 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface rounded-xl">
                    <h3 className="font-bold text-body-md mb-3">Phản hồi của chuyên gia</h3>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Nhập phản hồi của bạn..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none resize-none"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button className="px-6 py-2 rounded-lg border-2 border-outline hover:bg-surface-container transition-colors">
                        Gửi Email
                      </button>
                      <button
                        onClick={handleReply}
                        disabled={!replyContent}
                        className="px-6 py-2 rounded-lg bg-primary text-on-primary border-2 border-on-background hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Gửi phản hồi
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Expert Response (if resolved) */}
                {selectedRequest.expertResponse && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-body-md">Phản hồi của bạn</h3>
                    </div>
                    <p className="text-body-md">{selectedRequest.expertResponse}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-16 h-16 mx-auto mb-4 text-on-surface-variant" />
                <p className="text-body-md text-on-surface-variant">
                  Chọn một yêu cầu để xem chi tiết
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
