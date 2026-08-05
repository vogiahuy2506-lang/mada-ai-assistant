import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components';
import {
  CloudUpload, Globe, FileText,
  Loader2, CheckCircle, AlertCircle, Trash2, Eye,
  Search, Filter, Plus, Clock, Database, Brain, Upload, FilePlus, Sparkles,
  X, Link, BookOpen, RefreshCw, Trash
} from 'lucide-react';
import clsx from 'clsx';

interface KnowledgeItem {
  id: string;
  title: string;
  source: string;
  type: 'pdf' | 'web' | 'text' | 'manual';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documentsAdded?: number;
  date: string;
}

interface KnowledgeStats {
  totalDocuments: number;
  collectionName: string;
  isInitialized: boolean;
}

export function DataManagerPage() {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isAddingSeed, setIsAddingSeed] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'text' | 'url' | 'file'>('text');
  const [manualContent, setManualContent] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch stats and items on mount
  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    setIsLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch('/api/knowledge/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      // Fetch logs
      const logsRes = await fetch('/api/data/logs');
      const logsData = await logsRes.json();
      if (logsData.success) {
        const items: KnowledgeItem[] = logsData.data.slice(0, 50).map((log: any) => ({
          id: log.taskId,
          title: log.source.replace(/^(sample:|seed:|upload:)/, ''),
          source: log.source,
          type: log.type || 'text',
          status: 'completed' as const,
          documentsAdded: log.documentsAdded,
          date: new Date(log.timestamp).toLocaleDateString('vi-VN'),
        }));
        setKnowledgeItems(items);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollect = async () => {
    if (!websiteUrl) return;
    setIsCollecting(true);

    try {
      const response = await fetch('/api/data/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      });

      const data = await response.json();

      if (data.success) {
        const newItem: KnowledgeItem = {
          id: data.data.taskId,
          title: new URL(websiteUrl).hostname,
          source: websiteUrl,
          type: 'web',
          status: data.data.status === 'completed' ? 'completed' : 'processing',
          documentsAdded: data.data.documentsAdded,
          date: new Date().toLocaleDateString('vi-VN'),
        };
        setKnowledgeItems(prev => [newItem, ...prev]);
        setWebsiteUrl('');
        await fetchKnowledgeBase();
      }
    } catch (error) {
      console.error('Collection failed:', error);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualContent.trim()) return;
    setIsCollecting(true);

    try {
      const response = await fetch('/api/data/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: manualContent,
          type: 'text',
          title: manualTitle || 'Manual input',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newItem: KnowledgeItem = {
          id: data.data.taskId,
          title: manualTitle || 'Manual input',
          source: 'manual-input',
          type: 'text',
          status: 'completed',
          documentsAdded: data.data.documentsAdded,
          date: new Date().toLocaleDateString('vi-VN'),
        };
        setKnowledgeItems(prev => [newItem, ...prev]);
        setManualContent('');
        setManualTitle('');
        setShowAddModal(false);
        await fetchKnowledgeBase();
      }
    } catch (error) {
      console.error('Add manual failed:', error);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleLoadSample = async () => {
    setIsAddingSeed(true);

    try {
      const response = await fetch('/api/data/sample', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        await fetchKnowledgeBase();
        alert(`Đã thêm ${data.data.documentsAdded} tài liệu mẫu vào cơ sở tri thức!`);
      }
    } catch (error) {
      console.error('Load sample failed:', error);
    } finally {
      setIsAddingSeed(false);
    }
  };

  const handleLoadSeed = async () => {
    setIsAddingSeed(true);

    try {
      const response = await fetch('/api/data/seed', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        await fetchKnowledgeBase();
        alert(`Đã thêm ${data.data.topicsAdded} chủ đề kiến thức!`);
      }
    } catch (error) {
      console.error('Load seed failed:', error);
    } finally {
      setIsAddingSeed(false);
    }
  };

  const handleClearKnowledge = async () => {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ cơ sở tri thức? Hành động này không thể hoàn tác.')) {
      return;
    }

    try {
      await fetch('/api/knowledge', { method: 'DELETE' });
      setKnowledgeItems([]);
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Clear failed:', error);
    }
  };

  const filteredItems = knowledgeItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusConfig = {
    pending: { label: 'Đang chờ', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    processing: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
    completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    failed: { label: 'Thất bại', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  };

  return (
    <div className="flex h-screen bg-background dark:bg-on-background">
      <Sidebar variant="data_manager" />

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-headline-md font-bold mb-2">Quản lý dữ liệu</h1>
              <p className="text-body-md text-on-surface-variant">
                Thu thập, làm sạch và quản lý kho tri thức AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchKnowledgeBase}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                Làm mới
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary border-2 border-on-background neo-brutalist-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all"
              >
                <Plus className="w-5 h-5" />
                Thêm dữ liệu
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-8 h-8 text-primary" />
                <span className="text-on-surface-variant text-label-md">Tổng tài liệu</span>
              </div>
              <p className="text-headline-lg font-bold">{stats?.totalDocuments || 0}</p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-8 h-8 text-blue-500" />
                <span className="text-on-surface-variant text-label-md">Knowledge Base</span>
              </div>
              <p className="text-headline-lg font-bold">
                {stats?.isInitialized ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6" /> Ready
                  </span>
                ) : (
                  <span className="text-yellow-600 flex items-center gap-2">
                    <Clock className="w-6 h-6" /> Initializing
                  </span>
                )}
              </p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-8 h-8 text-purple-500" />
                <span className="text-on-surface-variant text-label-md">Chủ đề</span>
              </div>
              <p className="text-headline-lg font-bold">{knowledgeItems.length}</p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-8 h-8 text-amber-500" />
                <span className="text-on-surface-variant text-label-md">Quick Actions</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadSample}
                  disabled={isAddingSeed}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {isAddingSeed ? 'Đang thêm...' : 'Load Sample'}
                </button>
                <button
                  onClick={handleLoadSeed}
                  disabled={isAddingSeed}
                  className="px-3 py-1.5 text-xs bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                >
                  Load Knowledge
                </button>
              </div>
            </div>
          </div>

          {/* Collection Section */}
          <div className="mb-8 p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
            <h2 className="font-bold text-headline-sm mb-4 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              Thu thập từ Website
            </h2>

            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none transition-colors"
                />
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
              </div>
              <button
                onClick={handleCollect}
                disabled={!websiteUrl || isCollecting}
                className={clsx(
                  'px-8 py-3 rounded-xl font-bold border-2 border-on-background',
                  'flex items-center gap-2 transition-all',
                  isCollecting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary text-on-primary neo-brutalist-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5'
                )}
              >
                {isCollecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang thu thập...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5" />
                    Bắt đầu thu thập
                  </>
                )}
              </button>
            </div>

            {/* Collection Progress */}
            {isCollecting && (
              <div className="mt-4 p-4 bg-surface-container dark:bg-surface-container-high rounded-xl">
                <div className="flex items-center gap-4 mb-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-body-md">Đang thu thập dữ liệu...</span>
                </div>
                <div className="h-2 bg-outline rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm dữ liệu..."
                className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            </div>
            <button className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors">
              <Filter className="w-5 h-5" />
              Bộ lọc
            </button>
            <button
              onClick={handleClearKnowledge}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash className="w-5 h-5" />
              Xóa KB
            </button>
          </div>

          {/* Data List */}
          <div className="bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12">
                <Database className="w-16 h-16 text-on-surface-variant mb-4" />
                <p className="text-on-surface-variant text-lg mb-4">
                  {searchTerm ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu trong cơ sở tri thức'}
                </p>
                {!searchTerm && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleLoadSample}
                      disabled={isAddingSeed}
                      className="px-4 py-2 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Thêm dữ liệu mẫu
                    </button>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2 border-2 border-outline rounded-xl hover:bg-surface-container transition-colors"
                    >
                      Nhập dữ liệu
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container dark:bg-surface-container-high border-b-2 border-on-background dark:border-surface">
                  <tr>
                    <th className="text-left p-4 font-bold">Tiêu đề</th>
                    <th className="text-left p-4 font-bold">Nguồn</th>
                    <th className="text-left p-4 font-bold">Loại</th>
                    <th className="text-left p-4 font-bold">Trạng thái</th>
                    <th className="text-left p-4 font-bold">Ngày</th>
                    <th className="text-right p-4 font-bold">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const status = statusConfig[item.status];
                    return (
                      <tr key={item.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container dark:hover:bg-surface-container-high transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-on-surface-variant" />
                            <span className="font-medium">{item.title}</span>
                          </div>
                          {item.documentsAdded && (
                            <span className="text-xs text-on-surface-variant ml-8">
                              {item.documentsAdded} chunks
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-on-surface-variant text-sm max-w-[200px] truncate">
                          {item.source}
                        </td>
                        <td className="p-4">
                          <span className={clsx(
                            'px-2 py-1 rounded-lg text-xs font-medium',
                            item.type === 'web' && 'bg-blue-100 text-blue-800',
                            item.type === 'pdf' && 'bg-red-100 text-red-800',
                            item.type === 'text' && 'bg-green-100 text-green-800',
                            item.type === 'manual' && 'bg-purple-100 text-purple-800'
                          )}>
                            {item.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={clsx('px-3 py-1 rounded-full text-label-mono flex items-center gap-1 w-fit', status.color)}>
                            <status.icon className={clsx('w-3 h-3', item.status === 'processing' && 'animate-spin')} />
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 text-on-surface-variant">{item.date}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Xem chi tiết">
                              <Eye className="w-5 h-5" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 transition-colors" title="Xóa">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Add Data Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#2e3038] rounded-2xl border-2 border-[#191b23] w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b-2 border-[#191b23] flex items-center justify-between">
              <h2 className="text-lg font-bold">Thêm dữ liệu vào cơ sở tri thức</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              {/* Mode Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setAddMode('text')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    addMode === 'text' ? 'bg-primary text-on-primary' : 'bg-surface-container'
                  )}
                >
                  <FilePlus className="w-4 h-4" />
                  Nhập văn bản
                </button>
                <button
                  onClick={() => setAddMode('url')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    addMode === 'url' ? 'bg-primary text-on-primary' : 'bg-surface-container'
                  )}
                >
                  <Link className="w-4 h-4" />
                  Từ URL
                </button>
                <button
                  onClick={() => setAddMode('file')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    addMode === 'file' ? 'bg-primary text-on-primary' : 'bg-surface-container'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  Upload file
                </button>
              </div>

              {/* Text Input Mode */}
              {addMode === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tiêu đề (tùy chọn)</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Nhập tiêu đề cho dữ liệu này"
                      className="w-full px-4 py-3 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nội dung</label>
                    <textarea
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="Dán nội dung văn bản vào đây..."
                      rows={10}
                      className="w-full px-4 py-3 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* URL Input Mode */}
              {addMode === 'url' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">URL</label>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    Hệ thống sẽ tự động thu thập nội dung từ trang web và thêm vào cơ sở tri thức.
                  </p>
                </div>
              )}

              {/* File Upload Mode */}
              {addMode === 'file' && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.csv"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-surface-container transition-colors"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-on-surface-variant" />
                    <p className="font-medium">Click để upload file</p>
                    <p className="text-sm text-on-surface-variant mt-2">
                      Hỗ trợ: TXT, MD, PDF, CSV
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-[#191b23] flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={addMode === 'url' ? handleCollect : handleAddManual}
                disabled={isCollecting || (addMode === 'text' && !manualContent.trim())}
                className="px-6 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isCollecting ? 'Đang xử lý...' : 'Thêm vào cơ sở tri thức'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
