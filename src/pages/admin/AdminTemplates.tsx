import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Loader2, Search, Star, X, Check, Zap, FileText } from 'lucide-react';
import { adminApi } from './adminApi';
import { usePromptStore } from '@/stores';
import { useTranslation } from '@/lib/translations';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  language: string;
  tags: string[];
  variables: string[];
  example_questions: string[];
  is_featured: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'general', label: 'Tổng quát', icon: '💬', color: 'bg-sky-50 text-sky-600 border-sky-200' },
  { value: 'medical', label: 'Y tế', icon: '🏥', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { value: 'legal', label: 'Pháp lý', icon: '⚖️', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'finance', label: 'Tài chính', icon: '💰', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'support', label: 'Hỗ trợ', icon: '🎧', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { value: 'sales', label: 'Bán hàng', icon: '🛒', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'technical', label: 'Kỹ thuật', icon: '🔧', color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

const LANGUAGES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
];

export function AdminTemplates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);
  
  // Modal states
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  // Apply template state
  const [applyTargetPrompt, setApplyTargetPrompt] = useState('');
  const [applyChangeSummary, setApplyChangeSummary] = useState('');
  const [applying, setApplying] = useState(false);
  
  // Store prompts for target selection
  const storePrompts = usePromptStore(s => s.prompts);
  const loadStorePrompts = usePromptStore(s => s.loadPrompts);

  useEffect(() => {
    loadTemplates();
    loadStorePrompts();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await adminApi.getPromptTemplates({
        category: filterCategory !== 'all' ? filterCategory : undefined,
        language: filterLanguage !== 'all' ? filterLanguage : undefined,
        featured: showFeatured,
        search: searchQuery || undefined,
      });
      if (res.success && res.data) {
        setTemplates(res.data as unknown as PromptTemplate[]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [filterCategory, filterLanguage, showFeatured, searchQuery]);

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !applyTargetPrompt) return;
    
    setApplying(true);
    try {
      const res = await adminApi.applyPromptTemplate(
        selectedTemplate.id,
        applyTargetPrompt,
        applyChangeSummary || `Áp dụng template: ${selectedTemplate.name}`
      );
      if (res.success && res.data) {
        const data = res.data as unknown as { message: string; prompt_id: string; version: number; template_id: string };
        alert(`Đã áp dụng template "${selectedTemplate.name}" thành công!\nPhiên bản mới: ${data.version}`);
        setShowApplyModal(false);
        setSelectedTemplate(null);
        setApplyTargetPrompt('');
        setApplyChangeSummary('');
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert('Có lỗi khi áp dụng template');
    } finally {
      setApplying(false);
    }
  };

  const getCategoryConfig = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  };

  const getLangLabel = (lang: string) => {
    return LANGUAGES.find(l => l.value === lang)?.label || lang;
  };

  const activePrompts = storePrompts.filter(p => p.isActive);

  return (
    <AdminLayout
      title={t('admin.topBar.prompts')}
      titleEn="Prompt Templates"
      titleAr="قوالب التعليمات"
      titleFr="Modèles de Prompts"
      subtitle={t('admin.topBar.promptsSub')}
      subtitleEn="Browse and apply pre-built prompt templates by industry."
      subtitleAr="تصفح وتطبيق قوالب التعليمات الجاهزة حسب الصناعة."
      subtitleFr="Parcourez et appliquez des modèles de prompts prédéfinis par secteur."
    >
      {/* Main Content - Full Width Template Manager */}
      <div className="flex gap-6 h-[calc(100vh-180px)]">
        
        {/* Left Panel - Template List */}
        <div className="w-[480px] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Templates</h2>
                <p className="text-sm text-slate-500">{templates.length} templates có sẵn</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:bg-white transition-colors"
              />
            </div>
            
            {/* Category Filters */}
            <div className="flex flex-wrap gap-1.5 items-center mb-2">
              <button
                onClick={() => setShowFeatured(!showFeatured)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  showFeatured ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Star className="w-3 h-3" /> Nổi bật
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />
              {CATEGORIES.slice(0, 4).map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    filterCategory === cat.value ? `${cat.color} border` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            
            {/* Language Filters */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  onClick={() => setFilterLanguage(lang.value)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    filterLanguage === lang.value ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Không tìm thấy template</h3>
                <p className="text-sm text-slate-500">Thử thay đổi bộ lọc</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => {
                  const catConfig = getCategoryConfig(template.category);
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-4 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-violet-50 border-violet-200 shadow-sm'
                          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 text-sm truncate">{template.name}</h3>
                            {template.is_featured && (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catConfig.color}`}>
                              {catConfig.icon} {catConfig.label}
                            </span>
                            <span>{getLangLabel(template.language)}</span>
                            <span>•</span>
                            <span>{template.use_count} lượt sử dụng</span>
                          </div>
                        </div>
                      </div>
                      
                      {template.tags.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1">
                            {template.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">{templates.length} templates</span>
            <button
              onClick={() => loadTemplates()}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium"
            >
              Làm mới
            </button>
          </div>
        </div>
        
        {/* Right Panel - Template Detail/Preview */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{selectedTemplate.name}</h2>
                      <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTemplate.is_featured && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500" /> Nổi bật
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryConfig(selectedTemplate.category).color}`}>
                      {getCategoryConfig(selectedTemplate.category).icon} {getCategoryConfig(selectedTemplate.category).label}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {getLangLabel(selectedTemplate.language)}
                    </span>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-violet-500">schedule</span>
                    <span>Đã sử dụng <strong>{selectedTemplate.use_count}</strong> lần</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-slate-400">update</span>
                    <span>Cập nhật: {new Date(selectedTemplate.updated_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Tags */}
                {selectedTemplate.tags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Variables */}
                {selectedTemplate.variables.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">code</span>
                      Variables có thể tùy chỉnh
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((v, i) => (
                        <code key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-mono">{v}</code>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Example Questions */}
                {selectedTemplate.example_questions.length > 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <h3 className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">help</span>
                      Câu hỏi mẫu
                    </h3>
                    <ul className="space-y-1">
                      {selectedTemplate.example_questions.map((q, i) => (
                        <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Prompt Content */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">text_snippet</span>
                    Nội dung Prompt
                  </h3>
                  <div className="p-5 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">{selectedTemplate.prompt}</pre>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span>Template ID: <code className="bg-slate-200 px-2 py-0.5 rounded text-xs">{selectedTemplate.id}</code></span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowPreview(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Xem chi tiết
                  </button>
                  <button
                    onClick={() => setShowApplyModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium shadow-lg shadow-violet-200"
                  >
                    <Zap className="w-4 h-4" />
                    Áp dụng Template
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <Zap className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Chọn một Template</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Chọn template từ danh sách bên trái để xem chi tiết và áp dụng
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-sm">lightbulb</span>
                  <span>Template giúp bạn nhanh chóng tạo prompts cho nhiều ngành khác nhau</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedTemplate.name}</h2>
                  <p className="text-sm text-slate-500">Preview Template</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryConfig(selectedTemplate.category).color}`}>
                  {getCategoryConfig(selectedTemplate.category).icon} {getCategoryConfig(selectedTemplate.category).label}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {getLangLabel(selectedTemplate.language)}
                </span>
                {selectedTemplate.is_featured && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-500" /> Nổi bật
                  </span>
                )}
              </div>
              
              <p className="text-sm text-slate-600">{selectedTemplate.description}</p>
              
              {selectedTemplate.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              {selectedTemplate.variables.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <h4 className="text-xs font-semibold text-blue-600 mb-1">Variables</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.variables.map((v, i) => (
                      <code key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{v}</code>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedTemplate.example_questions.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <h4 className="text-xs font-semibold text-emerald-600 mb-1">Câu hỏi mẫu</h4>
                  <ul className="text-xs text-emerald-700 space-y-1">
                    {selectedTemplate.example_questions.map((q, i) => (
                      <li key={i}>• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nội dung Prompt</h4>
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{selectedTemplate.prompt}</pre>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex justify-between items-center">
              <div className="text-xs text-slate-400">
                Đã sử dụng {selectedTemplate.use_count} lần
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setShowApplyModal(true);
                  }}
                  className="px-5 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Áp dụng Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Apply Modal */}
      {showApplyModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Áp dụng Template</h2>
                  <p className="text-sm text-slate-500">{selectedTemplate.name}</p>
                </div>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 shrink-0">info</span>
                  <span>Khi áp dụng template, phiên bản hiện tại sẽ được lưu vào lịch sử trước khi thay đổi. Bạn có thể khôi phục lại bất kỳ lúc nào.</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Prompt đích <span className="text-red-500">*</span>
                </label>
                <select
                  value={applyTargetPrompt}
                  onChange={(e) => setApplyTargetPrompt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white"
                >
                  <option value="">-- Chọn prompt --</option>
                  {activePrompts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mô tả thay đổi
                </label>
                <input
                  type="text"
                  value={applyChangeSummary}
                  onChange={(e) => setApplyChangeSummary(e.target.value)}
                  placeholder="VD: Áp dụng template Y tế cho chatbot tư vấn sức khỏe"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview Template</h4>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-6 font-mono">
                  {selectedTemplate.prompt.slice(0, 500)}...
                </pre>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={applying || !applyTargetPrompt}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-violet-200"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Áp dụng Template
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminTemplates;
