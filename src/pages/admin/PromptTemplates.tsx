import { useState, useEffect } from 'react';
import { Loader2, Search, Star, X, Check, Zap, FileText, ArrowRight } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { usePromptStore, useLanguageStore } from '@/stores';

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

// ============== TYPES ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

// ============== TRANSLATIONS ==============
const promptTemplateTranslations: Record<string, Record<Language, string>> = {
  // Categories
  'promptTemplate.cat.general': { vi: 'Tổng quát', en: 'General', ar: 'عام', fr: 'Général' },
  'promptTemplate.cat.medical': { vi: 'Y tế', en: 'Medical', ar: 'طبي', fr: 'Médical' },
  'promptTemplate.cat.legal': { vi: 'Pháp lý', en: 'Legal', ar: 'قانوني', fr: 'Juridique' },
  'promptTemplate.cat.finance': { vi: 'Tài chính', en: 'Finance', ar: 'مالي', fr: 'Finance' },
  'promptTemplate.cat.support': { vi: 'Hỗ trợ', en: 'Support', ar: 'دعم', fr: 'Support' },
  'promptTemplate.cat.sales': { vi: 'Bán hàng', en: 'Sales', ar: 'مبيعات', fr: 'Ventes' },
  'promptTemplate.cat.technical': { vi: 'Kỹ thuật', en: 'Technical', ar: 'تقني', fr: 'Technique' },

  // Language filter
  'promptTemplate.lang.all': { vi: 'Tất cả', en: 'All', ar: 'الكل', fr: 'Tous' },
  'promptTemplate.lang.vi': { vi: 'Tiếng Việt', en: 'Vietnamese', ar: 'الفيتنامية', fr: 'Vietnamien' },
  'promptTemplate.lang.en': { vi: 'English', en: 'English', ar: 'الإنجليزية', fr: 'Anglais' },
  'promptTemplate.lang.ar': { vi: 'العربية', en: 'Arabic', ar: 'العربية', fr: 'Arabe' },
  'promptTemplate.lang.fr': { vi: 'Français', en: 'French', ar: 'الفرنسية', fr: 'Français' },

  // Main UI
  'promptTemplate.title': { vi: 'Prompt Templates', en: 'Prompt Templates', ar: 'قوالب الأوامر', fr: 'Modèles de prompts' },
  'promptTemplate.subtitle': { vi: 'Templates có sẵn theo ngành', en: 'Available templates by industry', ar: 'القوالب المتاحة حسب الصناعة', fr: 'Modèles disponibles par secteur' },
  'promptTemplate.searchPlaceholder': { vi: 'Tìm kiếm template...', en: 'Search templates...', ar: 'البحث في القوالب...', fr: 'Rechercher des modèles...' },
  'promptTemplate.featured': { vi: 'Nổi bật', en: 'Featured', ar: 'مميز', fr: 'À la une' },
  'promptTemplate.language': { vi: 'Ngôn ngữ:', en: 'Language:', ar: 'اللغة:', fr: 'Langue:' },
  'promptTemplate.templates': { vi: 'templates', en: 'templates', ar: 'قوالب', fr: 'modèles' },
  'promptTemplate.refresh': { vi: 'Làm mới', en: 'Refresh', ar: 'تحديث', fr: 'Actualiser' },
  'promptTemplate.languageFilter': { vi: 'Ngôn ngữ', en: 'Language', ar: 'اللغة', fr: 'Langue' },
  'promptTemplate.usageCount': { vi: 'lượt sử dụng', en: 'uses', ar: 'استخدامات', fr: 'utilisations' },

  // Empty state
  'promptTemplate.noTemplates': { vi: 'Không tìm thấy template', en: 'No templates found', ar: 'لم يتم العثور على قوالب', fr: 'Aucun modèle trouvé' },
  'promptTemplate.tryChangeFilter': { vi: 'Thử thay đổi bộ lọc hoặc tạo template mới', en: 'Try changing filters or create a new template', ar: 'حاول تغيير الفلاتر أو إنشاء قالب جديد', fr: 'Essayez de modifier les filtres ou créez un nouveau modèle' },

  // Apply Modal
  'promptTemplate.applyTemplate': { vi: 'Áp dụng Template', en: 'Apply Template', ar: 'تطبيق القالب', fr: 'Appliquer le modèle' },
  'promptTemplate.targetPrompt': { vi: 'Prompt đích', en: 'Target Prompt', ar: 'الهدف', fr: 'Prompt cible' },
  'promptTemplate.selectPrompt': { vi: '-- Chọn prompt --', en: '-- Select prompt --', ar: '-- اختر الأمر --', fr: '-- Sélectionner --' },
  'promptTemplate.changeDescription': { vi: 'Mô tả thay đổi', en: 'Change Description', ar: 'وصف التغيير', fr: 'Description du changement' },
  'promptTemplate.changeDescriptionPlaceholder': { vi: 'VD: Áp dụng template Y tế cho chatbot tư vấn sức khỏe', en: 'Example: Apply medical template for health consultation chatbot', ar: 'مثال: تطبيق قالب طبي على روبوت الاستشارة الصحية', fr: 'Exemple: Appliquer le modèle médical au chatbot de consultation' },
  'promptTemplate.previewTemplate': { vi: 'Preview Template', en: 'Preview Template', ar: 'معاينة القالب', fr: 'Aperçu du modèle' },
  'promptTemplate.cancel': { vi: 'Hủy', en: 'Cancel', ar: 'إلغاء', fr: 'Annuler' },
  'promptTemplate.apply': { vi: 'Áp dụng', en: 'Apply', ar: 'تطبيق', fr: 'Appliquer' },
  'promptTemplate.applySuccess': { vi: 'Đã áp dụng template "{name}" thành công!', en: 'Template "{name}" applied successfully!', ar: 'تم تطبيق القالب "{name}" بنجاح!', fr: 'Modèle "{name}" appliqué avec succès!' },
  'promptTemplate.newVersion': { vi: 'Phiên bản mới:', en: 'New version:', ar: 'الإصدار الجديد:', fr: 'Nouvelle version:' },
  'promptTemplate.applyError': { vi: 'Có lỗi khi áp dụng template', en: 'Error applying template', ar: 'خطأ في تطبيق القالب', fr: 'Erreur lors de l\'application du modèle' },
  'promptTemplate.note': { vi: 'Lưu ý:', en: 'Note:', ar: 'ملاحظة:', fr: 'Remarque:' },
  'promptTemplate.noteContent': { vi: 'Khi áp dụng template, phiên bản hiện tại sẽ được lưu vào lịch sử trước khi thay đổi. Bạn có thể khôi phục lại bất kỳ lúc nào.', en: 'When applying a template, the current version will be saved to history before changes. You can restore it at any time.', ar: 'عند تطبيق قالب، سيتم حفظ الإصدار الحالي في السجل قبل التغييرات. يمكنك استعادته في أي وقت.', fr: 'Lors de l\'application d\'un modèle, la version actuelle sera sauvegardée dans l\'historique avant les modifications. Vous pouvez la restaurer à tout moment.' },
  'promptTemplate.required': { vi: '*', en: '*', ar: '*', fr: '*' },

  // Preview Modal
  'promptTemplate.preview': { vi: 'Xem trước', en: 'Preview', ar: 'معاينة', fr: 'Aperçu' },
  'promptTemplate.variables': { vi: 'Variables', en: 'Variables', ar: 'المتغيرات', fr: 'Variables' },
  'promptTemplate.exampleQuestions': { vi: 'Câu hỏi mẫu', en: 'Example Questions', ar: 'أسئلة نموذجية', fr: 'Questions exemple' },
  'promptTemplate.promptContent': { vi: 'Nội dung Prompt', en: 'Prompt Content', ar: 'محتوى الأمر', fr: 'Contenu du prompt' },
  'promptTemplate.close': { vi: 'Đóng', en: 'Close', ar: 'إغلاق', fr: 'Fermer' },
  'promptTemplate.usedCount': { vi: 'Đã sử dụng', en: 'Used', ar: 'مستخدم', fr: 'Utilisé' },
  'promptTemplate.times': { vi: 'lần', en: 'times', ar: 'مرة', fr: 'fois' },

  // Action titles
  'promptTemplate.title.preview': { vi: 'Xem trước', en: 'Preview', ar: 'معاينة', fr: 'Aperçu' },
  'promptTemplate.title.selectTemplate': { vi: 'Chọn template', en: 'Select template', ar: 'اختيار القالب', fr: 'Sélectionner' },
  'promptTemplate.title.applyTemplate': { vi: 'Áp dụng template', en: 'Apply template', ar: 'تطبيق القالب', fr: 'Appliquer' },
  'promptTemplate.sampleQuestions': { vi: 'Câu hỏi mẫu:', en: 'Sample questions:', ar: 'أسئلة نموذجية:', fr: 'Questions exemple:' },
};

// ============== CATEGORIES ==============
const CATEGORIES = [
  { value: 'general', icon: '💬', color: 'bg-sky-50 text-sky-600 border-sky-200' },
  { value: 'medical', icon: '🏥', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { value: 'legal', icon: '⚖️', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'finance', icon: '💰', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'support', icon: '🎧', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { value: 'sales', icon: '🛒', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'technical', icon: '🔧', color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

const LANGUAGES = [
  { value: 'all' },
  { value: 'vi' },
  { value: 'en' },
  { value: 'ar' },
  { value: 'fr' },
];

interface Props {
  onSelectTemplate?: (template: PromptTemplate) => void;
  onClose?: () => void;
  isInline?: boolean;
}

export function PromptTemplates({ onSelectTemplate, onClose, isInline = false }: Props) {
  const language = useLanguageStore((s) => s.language) as Language;
  const t = (key: string, params?: Record<string, string>) => {
    const text = promptTemplateTranslations[key]?.[language] || promptTemplateTranslations[key]?.['vi'] || key;
    if (params) {
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), text);
    }
    return text;
  };

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
        applyChangeSummary || t('promptTemplate.applyTemplate') + `: ${selectedTemplate.name}`
      );
      if (res.success && res.data) {
        const data = res.data as unknown as { message: string; prompt_id: string; version: number; template_id: string };
        alert(`${t('promptTemplate.applySuccess', { name: selectedTemplate.name })}\n${t('promptTemplate.newVersion')} ${data.version}`);
        setShowApplyModal(false);
        setSelectedTemplate(null);
        setApplyTargetPrompt('');
        setApplyChangeSummary('');
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert(t('promptTemplate.applyError'));
    } finally {
      setApplying(false);
    }
  };

  const getCategoryConfig = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  };

  const getCategoryLabel = (cat: string) => {
    return t(`promptTemplate.cat.${cat}` as keyof typeof promptTemplateTranslations);
  };

  const getLangLabel = (lang: string) => {
    if (lang === 'all') return t('promptTemplate.lang.all');
    return t(`promptTemplate.lang.${lang}` as keyof typeof promptTemplateTranslations);
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
              <h2 className="text-lg font-bold text-slate-800">{t('promptTemplate.applyTemplate')}</h2>
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
              <strong>{t('promptTemplate.note')}</strong> {t('promptTemplate.noteContent')}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('promptTemplate.targetPrompt')} <span className="text-red-500">{t('promptTemplate.required')}</span>
            </label>
            <select
              value={applyTargetPrompt}
              onChange={(e) => setApplyTargetPrompt(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
            >
              <option value="">{t('promptTemplate.selectPrompt')}</option>
              {activePrompts.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('promptTemplate.changeDescription')}
            </label>
            <input
              type="text"
              value={applyChangeSummary}
              onChange={(e) => setApplyChangeSummary(e.target.value)}
              placeholder={t('promptTemplate.changeDescriptionPlaceholder')}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('promptTemplate.previewTemplate')}</h4>
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
            {t('promptTemplate.cancel')}
          </button>
          <button
            onClick={handleApplyTemplate}
            disabled={applying || !applyTargetPrompt}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('promptTemplate.apply')}
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
              <p className="text-sm text-slate-500">{t('promptTemplate.preview')}</p>
            </div>
          </div>
          <button onClick={() => { setShowPreview(false); setPreviewTemplate(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryConfig(previewTemplate.category).color}`}>
              {getCategoryConfig(previewTemplate.category).icon} {getCategoryLabel(previewTemplate.category)}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {getLangLabel(previewTemplate.language)}
            </span>
            {previewTemplate.is_featured && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-500" /> {t('promptTemplate.featured')}
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
              <h4 className="text-xs font-semibold text-blue-600 mb-1">{t('promptTemplate.variables')}</h4>
              <div className="flex flex-wrap gap-1">
                {previewTemplate.variables.map((v, i) => (
                  <code key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{v}</code>
                ))}
              </div>
            </div>
          )}
          
          {previewTemplate.example_questions.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="text-xs font-semibold text-emerald-600 mb-1">{t('promptTemplate.exampleQuestions')}</h4>
              <ul className="text-xs text-emerald-700 space-y-1">
                {previewTemplate.example_questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('promptTemplate.promptContent')}</h4>
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{previewTemplate.prompt}</pre>
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {t('promptTemplate.usedCount')} {previewTemplate.use_count} {t('promptTemplate.times')}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowPreview(false); setPreviewTemplate(null); }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
            >
              {t('promptTemplate.close')}
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
              {t('promptTemplate.applyTemplate')}
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
              <h2 className="text-lg font-bold text-slate-800">{t('promptTemplate.title')}</h2>
              <p className="text-sm text-slate-500">{t('promptTemplate.subtitle')}</p>
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
              placeholder={t('promptTemplate.searchPlaceholder')}
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
              <Star className="w-3 h-3" /> {t('promptTemplate.featured')}
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
                {cat.icon} {getCategoryLabel(cat.value)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400">{t('promptTemplate.language')}</span>
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                onClick={() => setFilterLanguage(lang.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterLanguage === lang.value ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getLangLabel(lang.value)}
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
            <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('promptTemplate.noTemplates')}</h3>
            <p className="text-sm text-slate-500">
              {t('promptTemplate.tryChangeFilter')}
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
                          {catConfig.icon} {getCategoryLabel(template.category)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{getLangLabel(template.language)}</span>
                        <span>•</span>
                        <span>{template.use_count} {t('promptTemplate.usageCount')}</span>
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
                        title={t('promptTemplate.title.preview')}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {onSelectTemplate ? (
                        <button
                          onClick={() => onSelectTemplate(template)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('promptTemplate.title.selectTemplate')}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedTemplate(template); setShowApplyModal(true); }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('promptTemplate.title.applyTemplate')}
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {template.example_questions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">{t('promptTemplate.sampleQuestions')}</p>
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
            {templates.length} {t('promptTemplate.templates')}
          </span>
          <button
            onClick={() => loadTemplates()}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {t('promptTemplate.refresh')}
          </button>
        </div>
      </div>
    </>
  );

  if (isInline) {
    return content;
  }

  return (
    <AdminLayout
      titleKey="promptTemplate.title"
      subtitleKey="promptTemplate.subtitle"
      showLayoutTitle={false}
    >
      {content}
    </AdminLayout>
  );
}

export default PromptTemplates;
