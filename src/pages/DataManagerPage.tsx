import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components';
import {
  CloudUpload, Globe, FileText,
  Loader2, CheckCircle, AlertCircle, Trash2, Eye,
  Search, Filter, Plus, Clock, Database, Brain, Upload, FilePlus, Sparkles,
  X, Link, BookOpen, RefreshCw, Trash, FileCheck, Lightbulb, MessageCircle, Package
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/translations';

interface KnowledgeItem {
  id: string;
  title: string;
  source: string;
  type: 'pdf' | 'web' | 'text' | 'manual';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documentsAdded?: number;
  date: string;
  category?: string;
}

interface AISuggestion {
  questions: string[];
  topics: string[];
  products: { name: string; description: string }[];
  raw?: string;
}

interface KnowledgeStats {
  totalDocuments: number;
  collectionName: string;
  isInitialized: boolean;
}

export function DataManagerPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const locale = language === 'vi' ? 'vi-VN' : language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // AI Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [lastCollectedTitle, setLastCollectedTitle] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch stats and items on mount
  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  // Fetch suggestions for a knowledge item
  const fetchSuggestions = async (itemId: string) => {
    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    setSuggestions(null);
    
    try {
      // Get the item content first
      const itemRes = await fetch(`/api/kb/items/${itemId}`);
      const itemData = await itemRes.json();
      
      if (itemData.success && itemData.data.content) {
        // Call the suggestion endpoint
        const suggestRes = await fetch('/api/kb/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: itemData.data.content,
            category: itemData.data.category,
            title: itemData.data.title
          })
        });
        
        const suggestData = await suggestRes.json();
        
        if (suggestData.success) {
          setSuggestions(suggestData.data.suggestions);
          setLastCollectedTitle(itemData.data.title);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

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
          date: new Date(log.timestamp).toLocaleDateString(locale),
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
      const response = await fetch('/api/kb/scrape-with-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      });

      const data = await response.json();

      if (data.success) {
        const newItem: KnowledgeItem = {
          id: data.data.itemId,
          title: data.data.title || new URL(websiteUrl).hostname,
          source: websiteUrl,
          type: 'web',
          status: 'completed',
          documentsAdded: data.data.documentsAdded,
          date: new Date().toLocaleDateString(locale),
          category: data.data.category,
        };
        setKnowledgeItems(prev => [newItem, ...prev]);
        
        // Show AI suggestions
        if (data.data.suggestions) {
          setSuggestions(data.data.suggestions);
          setLastCollectedTitle(data.data.title || new URL(websiteUrl).hostname);
          setShowSuggestions(true);
        }
        
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
      const response = await fetch('/api/knowledge/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: manualContent,
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
          date: new Date().toLocaleDateString(locale),
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
        alert(t('dataManager.alertSampleAdded').replace('{{count}}', String(data.data.documentsAdded)));
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
        alert(t('dataManager.alertTopicsAdded').replace('{{count}}', String(data.data.topicsAdded)));
      }
    } catch (error) {
      console.error('Load seed failed:', error);
    } finally {
      setIsAddingSeed(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        setUploadSuccess(t('dataManager.alertFileAdded').replace('{{count}}', String(data.data.documentsAdded)).replace('{{filename}}', selectedFile.name));
        
        // Add to list
        const newItem: KnowledgeItem = {
          id: data.data.taskId,
          title: selectedFile.name,
          source: `upload:${selectedFile.name}`,
          type: selectedFile.name.endsWith('.pdf') ? 'pdf' : 'text',
          status: 'completed',
          documentsAdded: data.data.documentsAdded,
          date: new Date().toLocaleDateString(locale),
        };
        setKnowledgeItems(prev => [newItem, ...prev]);
        
        // Reset form after delay
        setTimeout(() => {
          setShowAddModal(false);
          setSelectedFile(null);
          setUploadProgress(0);
          setUploadSuccess(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          fetchKnowledgeBase();
        }, 1500);
      } else {
        setUploadError(data.error || t('dataManager.uploadFailed'));
      }
    } catch (error: any) {
      setUploadError(error.message || t('dataManager.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, fetchKnowledgeBase]);

  const handleClearKnowledge = async () => {
    if (!confirm(t('dataManager.confirmClearKb'))) {
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
    pending: { label: t('dataManager.statusPending'), color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    processing: { label: t('dataManager.statusProcessing'), color: 'bg-blue-100 text-blue-800', icon: Loader2 },
    completed: { label: t('dataManager.statusCompleted'), color: 'bg-green-100 text-green-800', icon: CheckCircle },
    failed: { label: t('dataManager.statusFailed'), color: 'bg-red-100 text-red-800', icon: AlertCircle },
  };

  return (
    <div className="flex h-screen bg-background dark:bg-on-background">
      <Sidebar variant="data_manager" />

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-headline-md font-bold mb-2">{t('dataManager.pageTitle')}</h1>
              <p className="text-body-md text-on-surface-variant">
                {t('dataManager.pageSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchKnowledgeBase}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                {t('dataManager.refresh')}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary border-2 border-on-background neo-brutalist-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all"
              >
                <Plus className="w-5 h-5" />
                {t('dataManager.addData')}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-8 h-8 text-primary" />
                <span className="text-on-surface-variant text-label-md">{t('dataManager.totalDocs')}</span>
              </div>
              <p className="text-headline-lg font-bold">{stats?.totalDocuments || 0}</p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-8 h-8 text-blue-500" />
                <span className="text-on-surface-variant text-label-md">{t('dataManager.knowledgeBase')}</span>
              </div>
              <p className="text-headline-lg font-bold">
                {stats?.isInitialized ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6" /> {t('dataManager.ready')}
                  </span>
                ) : (
                  <span className="text-yellow-600 flex items-center gap-2">
                    <Clock className="w-6 h-6" /> {t('dataManager.initializing')}
                  </span>
                )}
              </p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-8 h-8 text-purple-500" />
                <span className="text-on-surface-variant text-label-md">{t('dataManager.topics')}</span>
              </div>
              <p className="text-headline-lg font-bold">{knowledgeItems.length}</p>
            </div>
            <div className="p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-8 h-8 text-amber-500" />
                <span className="text-on-surface-variant text-label-md">{t('dataManager.quickActions')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadSample}
                  disabled={isAddingSeed}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {isAddingSeed ? t('dataManager.loading') : t('dataManager.loadSample')}
                </button>
                <button
                  onClick={handleLoadSeed}
                  disabled={isAddingSeed}
                  className="px-3 py-1.5 text-xs bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                >
                  {t('dataManager.loadKnowledge')}
                </button>
              </div>
            </div>
          </div>

          {/* Collection Section */}
          <div className="mb-8 p-6 bg-surface dark:bg-on-background border-2 border-on-background dark:border-surface neo-brutalist-shadow-sm">
            <h2 className="font-bold text-headline-sm mb-4 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              {t('dataManager.collectFromWebsite')}
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
                    {t('dataManager.collecting')}
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5" />
                    {t('dataManager.startCollect')}
                  </>
                )}
              </button>
            </div>

            {/* Collection Progress */}
            {isCollecting && (
              <div className="mt-4 p-4 bg-surface-container dark:bg-surface-container-high rounded-xl">
                <div className="flex items-center gap-4 mb-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-body-md">{t('dataManager.collectingAnalyzing')}</span>
                </div>
                <div className="h-2 bg-outline rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* AI Suggestions Panel */}
            {showSuggestions && (suggestions || isLoadingSuggestions) && (
              <div className="mt-4 p-6 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-violet-200 dark:border-violet-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{t('dataManager.aiDone')}</h3>
                      <p className="text-sm text-on-surface-variant">
                        {lastCollectedTitle && `${t('dataManager.topicLabel')}: ${lastCollectedTitle}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isLoadingSuggestions ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                    <span>{t('dataManager.aiAnalyzing')}</span>
                  </div>
                ) : suggestions && (
                  <div className="space-y-6">
                    {/* Questions */}
                    {suggestions.questions && suggestions.questions.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold mb-3 text-violet-700 dark:text-violet-300">
                          <MessageCircle className="w-5 h-5" />
                          {t('dataManager.suggestedQuestions')}
                        </h4>
                        <div className="space-y-2">
                          {suggestions.questions.slice(0, 3).map((q, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-violet-100 dark:border-violet-800 hover:border-violet-300 dark:hover:border-violet-600 transition-colors cursor-pointer"
                              onClick={() => {
                                // Copy to clipboard or use in chat
                                navigator.clipboard.writeText(q);
                              }}
                            >
                              <span className="w-7 h-7 bg-violet-100 dark:bg-violet-900 rounded-lg flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-300">
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-sm">{q}</span>
                              <span className="text-xs text-on-surface-variant">{t('dataManager.clickToCopy')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Topics */}
                    {suggestions.topics && suggestions.topics.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold mb-3 text-indigo-700 dark:text-indigo-300">
                          <Lightbulb className="w-5 h-5" />
                          {t('dataManager.relatedTopics')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.topics.slice(0, 4).map((topic, idx) => (
                            <button
                              key={idx}
                              className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors border border-indigo-200 dark:border-indigo-800"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {suggestions.products && suggestions.products.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold mb-3 text-purple-700 dark:text-purple-300">
                          <Package className="w-5 h-5" />
                          {t('dataManager.suggestedProducts')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {suggestions.products.slice(0, 4).map((product, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-800"
                            >
                              <h5 className="font-bold text-purple-700 dark:text-purple-300">{product.name}</h5>
                              {product.description && (
                                <p className="text-sm text-on-surface-variant mt-1">{product.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowSuggestions(false)}
                        className="flex-1 py-2 px-4 border-2 border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-300 rounded-xl font-medium hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                      >
                        {t('dataManager.close')}
                      </button>
                      <button
                        onClick={() => navigate('/chat')}
                        className="flex-1 py-2 px-4 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                      >
                        {t('dataManager.askMadaAbout')}
                      </button>
                    </div>
                  </div>
                )}
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
                placeholder={t('dataManager.searchPlaceholder')}
                className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            </div>
            <button className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors">
              <Filter className="w-5 h-5" />
              {t('dataManager.filter')}
            </button>
            <button
              onClick={handleClearKnowledge}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash className="w-5 h-5" />
              {t('dataManager.clearKb')}
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
                  {searchTerm ? t('dataManager.emptyNoResults') : t('dataManager.emptyNoData')}
                </p>
                {!searchTerm && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleLoadSample}
                      disabled={isAddingSeed}
                      className="px-4 py-2 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {t('dataManager.addSampleData')}
                    </button>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2 border-2 border-outline rounded-xl hover:bg-surface-container transition-colors"
                    >
                      {t('dataManager.importData')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container dark:bg-surface-container-high border-b-2 border-on-background dark:border-surface">
                  <tr>
                    <th className="text-left p-4 font-bold">{t('dataManager.colTitle')}</th>
                    <th className="text-left p-4 font-bold">{t('dataManager.colSource')}</th>
                    <th className="text-left p-4 font-bold">{t('dataManager.colType')}</th>
                    <th className="text-left p-4 font-bold">{t('dataManager.colStatus')}</th>
                    <th className="text-left p-4 font-bold">{t('dataManager.colDate')}</th>
                    <th className="text-right p-4 font-bold">{t('dataManager.colActions')}</th>
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
                            <button
                              className="p-2 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-600 transition-colors"
                              title={t('dataManager.tipViewAi')}
                              onClick={() => {
                                const itemStatus = item.status === 'completed';
                                if (itemStatus) {
                                  fetchSuggestions(item.id);
                                }
                              }}
                            >
                              <Sparkles className="w-5 h-5" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-surface-container transition-colors" title={t('dataManager.tipViewDetail')}>
                              <Eye className="w-5 h-5" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 transition-colors" title={t('dataManager.tipDelete')}>
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
              <h2 className="text-lg font-bold">{t('dataManager.modalTitle')}</h2>
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
                  {t('dataManager.tabText')}
                </button>
                <button
                  onClick={() => setAddMode('url')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    addMode === 'url' ? 'bg-primary text-on-primary' : 'bg-surface-container'
                  )}
                >
                  <Link className="w-4 h-4" />
                  {t('dataManager.tabUrl')}
                </button>
                <button
                  onClick={() => setAddMode('file')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    addMode === 'file' ? 'bg-primary text-on-primary' : 'bg-surface-container'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  {t('dataManager.tabFile')}
                </button>
              </div>

              {/* Text Input Mode */}
              {addMode === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('dataManager.labelTitleOptional')}</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder={t('dataManager.placeholderTitle')}
                      className="w-full px-4 py-3 rounded-xl border-2 border-outline bg-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('dataManager.labelContent')}</label>
                    <textarea
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder={t('dataManager.placeholderContent')}
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
                    {t('dataManager.urlHelp')}
                  </p>
                </div>
              )}

              {/* File Upload Mode */}
              {addMode === 'file' && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.docx,.doc,.csv,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* File Drop Zone */}
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-outline rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-surface-container transition-colors"
                    >
                      <Upload className="w-12 h-12 mx-auto mb-4 text-on-surface-variant" />
                      <p className="font-medium">{t('dataManager.clickToUploadFile')}</p>
                      <p className="text-sm text-on-surface-variant mt-2">
                        {t('dataManager.supportedFormats')} TXT, MD, PDF, DOCX, CSV, JPG, PNG, WEBP
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected File Info */}
                      <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl border-2 border-primary/50">
                        <div className="flex items-center gap-3">
                          <FileCheck className="w-8 h-8 text-primary" />
                          <div>
                            <p className="font-medium">{selectedFile.name}</p>
                            <p className="text-sm text-on-surface-variant">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Upload Progress */}
                      {isUploading && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('dataManager.uploading')}
                            </span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Upload Success */}
                      {uploadSuccess && (
                        <div className="flex items-center gap-2 p-3 bg-green-100 text-green-800 rounded-xl">
                          <CheckCircle className="w-5 h-5" />
                          {uploadSuccess}
                        </div>
                      )}

                      {/* Upload Error */}
                      {uploadError && (
                        <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-xl">
                          <AlertCircle className="w-5 h-5" />
                          {uploadError}
                        </div>
                      )}

                      {/* Upload Button */}
                      <button
                        onClick={handleFileUpload}
                        disabled={isUploading}
                        className={clsx(
                          'w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                          isUploading 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-primary text-on-primary hover:bg-primary/90 neo-brutalist-shadow-sm hover:-translate-y-0.5'
                        )}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {t('dataManager.processing')}
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-5 h-5" />
                            {t('dataManager.uploadToKb')}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-[#191b23] flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 rounded-xl border-2 border-outline hover:bg-surface-container transition-colors"
              >
                {t('dataManager.cancel')}
              </button>
              <button
                onClick={addMode === 'url' ? handleCollect : handleAddManual}
                disabled={isCollecting || (addMode === 'text' && !manualContent.trim())}
                className="px-6 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isCollecting ? t('dataManager.processing') : t('dataManager.confirmAdd')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataManagerPage;
