import { useState, useEffect } from 'react';
import { Loader2, Search, Star, X, Check, Zap, FileText, ArrowRight } from 'lucide-react';
import { adminApi } from './adminApi';
import { usePromptStore } from '@/stores';

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

interface Props {
  onSelectTemplate?: (template: PromptTemplate) => void;
  onClose?: () => void;
  isInline?: boolean;
}

export function PromptTemplates({ onSelectTemplate, onClose, isInline = false }: Props) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);
  
  // Apply template modal
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyTargetPrompt, setApplyTargetPrompt] = useState('');
  const [applyChangeSummary, setApplyChangeSummary] = useState('');
  const [applying, setApplying] = useState(false);
  
  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(null);
  
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

  if (showApplyModal && selectedTemplate) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-600" />
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
            <p className="text-sm text-amber-800">
              <strong>Lưu ý:</strong> Khi áp dụng template, phiên bản hiện tại sẽ được lưu vào lịch sử trước khi thay đổi. Bạn có thể khôi phục lại bất kỳ lúc nào.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Prompt đích <span className="text-red-500">*</span>
            </label>
            <select
              value={applyTargetPrompt}
              onChange={(e) => setApplyTargetPrompt(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
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
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Áp dụng Template
          </button>
        </div>
      </div>
    );
  }

  if (showPreview && previewTemplate) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{previewTemplate.name}</h2>
              <p className="text-sm text-slate-500">Preview Template</p>
            </div>
          </div>
          <button onClick={() => { setShowPreview(false); setPreviewTemplate(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryConfig(previewTemplate.category).color}`}>
              {getCategoryConfig(previewTemplate.category).icon} {getCategoryConfig(previewTemplate.category).label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {getLangLabel(previewTemplate.language)}
            </span>
            {previewTemplate.is_featured && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-500" /> Nổi bật
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-600">{previewTemplate.description}</p>
          
          {previewTemplate.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {previewTemplate.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {previewTemplate.variables.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 className="text-xs font-semibold text-blue-600 mb-1">Variables</h4>
              <div className="flex flex-wrap gap-1">
                {previewTemplate.variables.map((v, i) => (
                  <code key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{v}</code>
                ))}
              </div>
            </div>
          )}
          
          {previewTemplate.example_questions.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="text-xs font-semibold text-emerald-600 mb-1">Câu hỏi mẫu</h4>
              <ul className="text-xs text-emerald-700 space-y-1">
                {previewTemplate.example_questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nội dung Prompt</h4>
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{previewTemplate.prompt}</pre>
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            Đã sử dụng {previewTemplate.use_count} lần
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowPreview(false); setPreviewTemplate(null); }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                setSelectedTemplate(previewTemplate);
                setShowApplyModal(true);
              }}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Áp dụng Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Prompt Templates</h2>
              <p className="text-sm text-slate-500">Templates có sẵn theo ngành</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
        
        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setShowFeatured(!showFeatured)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                showFeatured ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-transparent'
              }`}
            >
              <Star className="w-3 h-3" /> Nổi bật
            </button>
            
            <div className="h-4 w-px bg-slate-200 mx-1" />
            
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat.value ? `${cat.color} border` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400">Ngôn ngữ:</span>
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                onClick={() => setFilterLanguage(lang.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterLanguage === lang.value ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Template List */}
      <div className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Không tìm thấy template</h3>
            <p className="text-sm text-slate-500">
              Thử thay đổi bộ lọc hoặc tạo template mới
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(template => {
              const catConfig = getCategoryConfig(template.category);
              return (
                <div
                  key={template.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-slate-800 text-sm truncate">{template.name}</h3>
                        {template.is_featured && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${catConfig.color}`}>
                          {catConfig.icon} {catConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{getLangLabel(template.language)}</span>
                        <span>•</span>
                        <span>{template.use_count} lượt sử dụng</span>
                        {template.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex gap-1">
                              {template.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">
                                  #{tag}
                                </span>
                              ))}
                              {template.tags.length > 2 && (
                                <span className="text-indigo-400">+{template.tags.length - 2}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setPreviewTemplate(template); setShowPreview(true); }}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Xem trước"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {onSelectTemplate ? (
                        <button
                          onClick={() => onSelectTemplate(template)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Chọn template"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedTemplate(template); setShowApplyModal(true); }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Áp dụng template"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {template.example_questions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">Câu hỏi mẫu:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.example_questions.slice(0, 2).map((q, i) => (
                          <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs line-clamp-1">
                            {q}
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
      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {templates.length} templates
          </span>
          <button
            onClick={() => loadTemplates()}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Làm mới
          </button>
        </div>
      </div>
    </>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {content}
    </div>
  );
}

export default PromptTemplates;
