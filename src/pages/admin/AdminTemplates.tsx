import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Loader2, Search, Star, X, Check, Zap, FileText } from 'lucide-react';
import { adminApi } from './adminApi';
import { usePromptStore, useLanguageStore } from '@/stores';

// Admin Templates translations - supports all languages via useLanguageStore
const tT = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Categories
      'adminTemplate.category.general': 'Tổng quát',
      'adminTemplate.category.medical': 'Y tế',
      'adminTemplate.category.legal': 'Pháp lý',
      'adminTemplate.category.finance': 'Tài chính',
      'adminTemplate.category.support': 'Hỗ trợ',
      'adminTemplate.category.sales': 'Bán hàng',
      'adminTemplate.category.technical': 'Kỹ thuật',
      // Languages
      'adminTemplate.lang.all': 'Tất cả',
      'adminTemplate.lang.vi': 'Tiếng Việt',
      'adminTemplate.lang.en': 'English',
      'adminTemplate.lang.ar': 'العربية',
      'adminTemplate.lang.fr': 'Français',
      // UI Text
      'adminTemplate.templates': 'Templates',
      'adminTemplate.templatesAvailable': 'templates có sẵn',
      'adminTemplate.searchPlaceholder': 'Tìm kiếm template...',
      'adminTemplate.featured': 'Nổi bật',
      'adminTemplate.noTemplateFound': 'Không tìm thấy template',
      'adminTemplate.tryChangeFilter': 'Thử thay đổi bộ lọc',
      'adminTemplate.usageCount': 'lượt sử dụng',
      'adminTemplate.refresh': 'Làm mới',
      'adminTemplate.templateDetail': 'Chi tiết Template',
      'adminTemplate.usedCount': 'Đã sử dụng',
      'adminTemplate.times': 'lần',
      'adminTemplate.updated': 'Cập nhật',
      'adminTemplate.tags': 'Tags',
      'adminTemplate.variables': 'Variables có thể tùy chỉnh',
      'adminTemplate.exampleQuestions': 'Câu hỏi mẫu',
      'adminTemplate.promptContent': 'Nội dung Prompt',
      'adminTemplate.templateId': 'Template ID',
      'adminTemplate.viewDetails': 'Xem chi tiết',
      'adminTemplate.applyTemplate': 'Áp dụng Template',
      'adminTemplate.selectTemplate': 'Chọn một Template',
      'adminTemplate.selectFromList': 'Chọn template từ danh sách bên trái để xem chi tiết và áp dụng',
      'adminTemplate.templateHelp': 'Template giúp bạn nhanh chóng tạo prompts cho nhiều ngành khác nhau',
      'adminTemplate.preview': 'Preview Template',
      'adminTemplate.close': 'Đóng',
      'adminTemplate.apply': 'Áp dụng Template',
      'adminTemplate.applyConfirm': 'Áp dụng Template',
      'adminTemplate.templateName': 'Template Name',
      'adminTemplate.templateInfo': 'Khi áp dụng template, phiên bản hiện tại sẽ được lưu vào lịch sử trước khi thay đổi. Bạn có thể khôi phục lại bất kỳ lúc nào.',
      'adminTemplate.targetPrompt': 'Prompt đích',
      'adminTemplate.required': 'Bắt buộc',
      'adminTemplate.selectPrompt': '-- Chọn prompt --',
      'adminTemplate.changeDescription': 'Mô tả thay đổi',
      'adminTemplate.changePlaceholder': 'VD: Áp dụng template Y tế cho chatbot tư vấn sức khỏe',
      'adminTemplate.templatePreview': 'Preview Template',
      'adminTemplate.cancel': 'Hủy',
      'adminTemplate.applying': 'Đang áp dụng...',
      'adminTemplate.applySuccess': 'Đã áp dụng template',
      'adminTemplate.success': 'thành công!',
      'adminTemplate.newVersion': 'Phiên bản mới',
      'adminTemplate.applyError': 'Có lỗi khi áp dụng template',
      'adminTemplate.appliedTemplate': 'Áp dụng template',
    },
    en: {
      // Categories
      'adminTemplate.category.general': 'General',
      'adminTemplate.category.medical': 'Medical',
      'adminTemplate.category.legal': 'Legal',
      'adminTemplate.category.finance': 'Finance',
      'adminTemplate.category.support': 'Support',
      'adminTemplate.category.sales': 'Sales',
      'adminTemplate.category.technical': 'Technical',
      // Languages
      'adminTemplate.lang.all': 'All',
      'adminTemplate.lang.vi': 'Tiếng Việt',
      'adminTemplate.lang.en': 'English',
      'adminTemplate.lang.ar': 'العربية',
      'adminTemplate.lang.fr': 'Français',
      // UI Text
      'adminTemplate.templates': 'Templates',
      'adminTemplate.templatesAvailable': 'templates available',
      'adminTemplate.searchPlaceholder': 'Search template...',
      'adminTemplate.featured': 'Featured',
      'adminTemplate.noTemplateFound': 'No template found',
      'adminTemplate.tryChangeFilter': 'Try changing the filter',
      'adminTemplate.usageCount': 'uses',
      'adminTemplate.refresh': 'Refresh',
      'adminTemplate.templateDetail': 'Template Details',
      'adminTemplate.usedCount': 'Used',
      'adminTemplate.times': 'times',
      'adminTemplate.updated': 'Updated',
      'adminTemplate.tags': 'Tags',
      'adminTemplate.variables': 'Customizable Variables',
      'adminTemplate.exampleQuestions': 'Example Questions',
      'adminTemplate.promptContent': 'Prompt Content',
      'adminTemplate.templateId': 'Template ID',
      'adminTemplate.viewDetails': 'View details',
      'adminTemplate.applyTemplate': 'Apply Template',
      'adminTemplate.selectTemplate': 'Select a Template',
      'adminTemplate.selectFromList': 'Select a template from the list on the left to view details and apply',
      'adminTemplate.templateHelp': 'Templates help you quickly create prompts for various industries',
      'adminTemplate.preview': 'Preview Template',
      'adminTemplate.close': 'Close',
      'adminTemplate.apply': 'Apply Template',
      'adminTemplate.applyConfirm': 'Apply Template',
      'adminTemplate.templateName': 'Template Name',
      'adminTemplate.templateInfo': 'When applying a template, the current version will be saved to history before changes. You can restore it anytime.',
      'adminTemplate.targetPrompt': 'Target Prompt',
      'adminTemplate.required': 'Required',
      'adminTemplate.selectPrompt': '-- Select prompt --',
      'adminTemplate.changeDescription': 'Change description',
      'adminTemplate.changePlaceholder': 'E.g: Apply medical template for health consultation chatbot',
      'adminTemplate.templatePreview': 'Preview Template',
      'adminTemplate.cancel': 'Cancel',
      'adminTemplate.applying': 'Applying...',
      'adminTemplate.applySuccess': 'Template applied',
      'adminTemplate.success': 'successfully!',
      'adminTemplate.newVersion': 'New version',
      'adminTemplate.applyError': 'Error applying template',
      'adminTemplate.appliedTemplate': 'Apply template',
    },
    ar: {
      // Categories
      'adminTemplate.category.general': 'عام',
      'adminTemplate.category.medical': 'طبي',
      'adminTemplate.category.legal': 'قانوني',
      'adminTemplate.category.finance': 'مالي',
      'adminTemplate.category.support': 'دعم',
      'adminTemplate.category.sales': 'مبيعات',
      'adminTemplate.category.technical': 'تقني',
      // Languages
      'adminTemplate.lang.all': 'الكل',
      'adminTemplate.lang.vi': 'Tiếng Việt',
      'adminTemplate.lang.en': 'English',
      'adminTemplate.lang.ar': 'العربية',
      'adminTemplate.lang.fr': 'Français',
      // UI Text
      'adminTemplate.templates': 'القوالب',
      'adminTemplate.templatesAvailable': 'قوالب متاحة',
      'adminTemplate.searchPlaceholder': 'البحث في القوالب...',
      'adminTemplate.featured': 'مميز',
      'adminTemplate.noTemplateFound': 'لم يتم العثور على قالب',
      'adminTemplate.tryChangeFilter': 'جرب تغيير الفلتر',
      'adminTemplate.usageCount': 'استخدامات',
      'adminTemplate.refresh': 'تحديث',
      'adminTemplate.templateDetail': 'تفاصيل القالب',
      'adminTemplate.usedCount': 'مستخدم',
      'adminTemplate.times': 'مرات',
      'adminTemplate.updated': 'تم التحديث',
      'adminTemplate.tags': 'العلامات',
      'adminTemplate.variables': 'متغيرات قابلة للتخصيص',
      'adminTemplate.exampleQuestions': 'أسئلة نموذجية',
      'adminTemplate.promptContent': 'محتوى الطلب',
      'adminTemplate.templateId': 'معرف القالب',
      'adminTemplate.viewDetails': 'عرض التفاصيل',
      'adminTemplate.applyTemplate': 'تطبيق القالب',
      'adminTemplate.selectTemplate': 'اختر قالب',
      'adminTemplate.selectFromList': 'اختر قالباً من القائمة على اليسار لعرض التفاصيل والتطبيق',
      'adminTemplate.templateHelp': 'تساعدك القوالب في إنشاء الطلبات بسرعة لمختلف الصناعات',
      'adminTemplate.preview': 'معاينة القالب',
      'adminTemplate.close': 'إغلاق',
      'adminTemplate.apply': 'تطبيق القالب',
      'adminTemplate.applyConfirm': 'تطبيق القالب',
      'adminTemplate.templateName': 'اسم القالب',
      'adminTemplate.templateInfo': 'عند تطبيق القالب، سيتم حفظ النسخة الحالية في السجل قبل التغييرات. يمكنك استعادتها في أي وقت.',
      'adminTemplate.targetPrompt': 'الطلب المستهدف',
      'adminTemplate.required': 'مطلوب',
      'adminTemplate.selectPrompt': '-- اختر طلب --',
      'adminTemplate.changeDescription': 'وصف التغيير',
      'adminTemplate.changePlaceholder': 'مثال: تطبيق قالب طبي لروبوت استشارة صحية',
      'adminTemplate.templatePreview': 'معاينة القالب',
      'adminTemplate.cancel': 'إلغاء',
      'adminTemplate.applying': 'جاري التطبيق...',
      'adminTemplate.applySuccess': 'تم تطبيق القالب',
      'adminTemplate.success': 'بنجاح!',
      'adminTemplate.newVersion': 'النسخة الجديدة',
      'adminTemplate.applyError': 'خطأ في تطبيق القالب',
      'adminTemplate.appliedTemplate': 'تطبيق القالب',
    },
    fr: {
      // Categories
      'adminTemplate.category.general': 'Général',
      'adminTemplate.category.medical': 'Médical',
      'adminTemplate.category.legal': 'Juridique',
      'adminTemplate.category.finance': 'Finance',
      'adminTemplate.category.support': 'Support',
      'adminTemplate.category.sales': 'Ventes',
      'adminTemplate.category.technical': 'Technique',
      // Languages
      'adminTemplate.lang.all': 'Tous',
      'adminTemplate.lang.vi': 'Tiếng Việt',
      'adminTemplate.lang.en': 'English',
      'adminTemplate.lang.ar': 'العربية',
      'adminTemplate.lang.fr': 'Français',
      // UI Text
      'adminTemplate.templates': 'Modèles',
      'adminTemplate.templatesAvailable': 'modèles disponibles',
      'adminTemplate.searchPlaceholder': 'Rechercher un modèle...',
      'adminTemplate.featured': 'En vedette',
      'adminTemplate.noTemplateFound': 'Aucun modèle trouvé',
      'adminTemplate.tryChangeFilter': 'Essayez de modifier le filtre',
      'adminTemplate.usageCount': 'utilisations',
      'adminTemplate.refresh': 'Actualiser',
      'adminTemplate.templateDetail': 'Détails du modèle',
      'adminTemplate.usedCount': 'Utilisé',
      'adminTemplate.times': 'fois',
      'adminTemplate.updated': 'Mis à jour',
      'adminTemplate.tags': 'Tags',
      'adminTemplate.variables': 'Variables personnalisables',
      'adminTemplate.exampleQuestions': 'Questions exemple',
      'adminTemplate.promptContent': 'Contenu du prompt',
      'adminTemplate.templateId': 'ID du modèle',
      'adminTemplate.viewDetails': 'Voir les détails',
      'adminTemplate.applyTemplate': 'Appliquer le modèle',
      'adminTemplate.selectTemplate': 'Sélectionner un modèle',
      'adminTemplate.selectFromList': 'Sélectionnez un modèle dans la liste de gauche pour voir les détails et appliquer',
      'adminTemplate.templateHelp': 'Les modèles vous aident à créer rapidement des prompts pour différents secteurs',
      'adminTemplate.preview': 'Aperçu du modèle',
      'adminTemplate.close': 'Fermer',
      'adminTemplate.apply': 'Appliquer le modèle',
      'adminTemplate.applyConfirm': 'Appliquer le modèle',
      'adminTemplate.templateName': 'Nom du modèle',
      'adminTemplate.templateInfo': 'Lors de l\'application d\'un modèle, la version actuelle sera enregistrée dans l\'historique avant les modifications. Vous pouvez la restaurer à tout moment.',
      'adminTemplate.targetPrompt': 'Prompt cible',
      'adminTemplate.required': 'Requis',
      'adminTemplate.selectPrompt': '-- Sélectionner prompt --',
      'adminTemplate.changeDescription': 'Description du changement',
      'adminTemplate.changePlaceholder': 'Ex: Appliquer le modèle médical pour le chatbot de consultation santé',
      'adminTemplate.templatePreview': 'Aperçu du modèle',
      'adminTemplate.cancel': 'Annuler',
      'adminTemplate.applying': 'Application...',
      'adminTemplate.applySuccess': 'Modèle appliqué',
      'adminTemplate.success': 'avec succès!',
      'adminTemplate.newVersion': 'Nouvelle version',
      'adminTemplate.applyError': 'Erreur lors de l\'application du modèle',
      'adminTemplate.appliedTemplate': 'Appliquer le modèle',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

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

const CATEGORIES = (t: (key: string) => string) => [
  { value: 'general', label: t('adminTemplate.category.general'), icon: '💬', color: 'bg-sky-50 text-sky-600 border-sky-200' },
  { value: 'medical', label: t('adminTemplate.category.medical'), icon: '🏥', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { value: 'legal', label: t('adminTemplate.category.legal'), icon: '⚖️', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'finance', label: t('adminTemplate.category.finance'), icon: '💰', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'support', label: t('adminTemplate.category.support'), icon: '🎧', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { value: 'sales', label: t('adminTemplate.category.sales'), icon: '🛒', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'technical', label: t('adminTemplate.category.technical'), icon: '🔧', color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

const LANGUAGES = (t: (key: string) => string) => [
  { value: 'all', label: t('adminTemplate.lang.all') },
  { value: 'vi', label: t('adminTemplate.lang.vi') },
  { value: 'en', label: t('adminTemplate.lang.en') },
  { value: 'ar', label: t('adminTemplate.lang.ar') },
  { value: 'fr', label: t('adminTemplate.lang.fr') },
];

export function AdminTemplates() {
  const categories = CATEGORIES(tT);
  const languages = LANGUAGES(tT);
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
        applyChangeSummary || `${tT('adminTemplate.appliedTemplate')}: ${selectedTemplate.name}`
      );
      if (res.success && res.data) {
        const data = res.data as unknown as { message: string; prompt_id: string; version: number; template_id: string };
        alert(`${tT('adminTemplate.applySuccess')} "${selectedTemplate.name}" ${tT('adminTemplate.success')}\n${tT('adminTemplate.newVersion')}: ${data.version}`);
        setShowApplyModal(false);
        setSelectedTemplate(null);
        setApplyTargetPrompt('');
        setApplyChangeSummary('');
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert(tT('adminTemplate.applyError'));
    } finally {
      setApplying(false);
    }
  };

  const getCategoryConfig = (cat: string) => {
    return categories.find(c => c.value === cat) || categories[0];
  };

  const getLangLabel = (lang: string) => {
    return languages.find(l => l.value === lang)?.label || lang;
  };

  const activePrompts = storePrompts.filter(p => p.isActive);

  return (
    <AdminLayout
      titleKey="admin.topBar.templates"
      subtitleKey="admin.topBar.templatesSub"
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
                <h2 className="text-lg font-bold text-slate-800">{tT('adminTemplate.templates')}</h2>
                <p className="text-sm text-slate-500">{templates.length} {tT('adminTemplate.templatesAvailable')}</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={tT('adminTemplate.searchPlaceholder')}
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
                <Star className="w-3 h-3" /> {tT('adminTemplate.featured')}
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />
              {categories.slice(0, 4).map(cat => (
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
              {languages.map(lang => (
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
                <h3 className="text-lg font-semibold text-slate-700 mb-2">{tT('adminTemplate.noTemplateFound')}</h3>
                <p className="text-sm text-slate-500">{tT('adminTemplate.tryChangeFilter')}</p>
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
                            <span>{template.use_count} {tT('adminTemplate.usageCount')}</span>
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
            <span className="text-xs text-slate-500">{templates.length} {tT('adminTemplate.templates').toLowerCase()}</span>
            <button
              onClick={() => loadTemplates()}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium"
            >
              {tT('adminTemplate.refresh')}
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
                        <Star className="w-3 h-3 fill-amber-500" /> {tT('adminTemplate.featured')}
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
                    <span>{tT('adminTemplate.usedCount')} <strong>{selectedTemplate.use_count}</strong> {tT('adminTemplate.times')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-slate-400">update</span>
                    <span>{tT('adminTemplate.updated')}: {new Date(selectedTemplate.updated_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Tags */}
                {selectedTemplate.tags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{tT('adminTemplate.tags')}</h3>
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
                      {tT('adminTemplate.variables')}
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
                      {tT('adminTemplate.exampleQuestions')}
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
                    {tT('adminTemplate.promptContent')}
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
                  <span>{tT('adminTemplate.templateId')}: <code className="bg-slate-200 px-2 py-0.5 rounded text-xs">{selectedTemplate.id}</code></span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowPreview(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    {tT('adminTemplate.viewDetails')}
                  </button>
                  <button
                    onClick={() => setShowApplyModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium shadow-lg shadow-violet-200"
                  >
                    <Zap className="w-4 h-4" />
                    {tT('adminTemplate.applyTemplate')}
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
                <h3 className="text-xl font-bold text-slate-700 mb-2">{tT('adminTemplate.selectTemplate')}</h3>
                <p className="text-sm text-slate-500 mb-6">
                  {tT('adminTemplate.selectFromList')}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-sm">lightbulb</span>
                  <span>{tT('adminTemplate.templateHelp')}</span>
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
                  <p className="text-sm text-slate-500">{tT('adminTemplate.preview')}</p>
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
                    <Star className="w-3 h-3 fill-amber-500" /> {tT('adminTemplate.featured')}
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
                  <h4 className="text-xs font-semibold text-emerald-600 mb-1">{tT('adminTemplate.exampleQuestions')}</h4>
                  <ul className="text-xs text-emerald-700 space-y-1">
                    {selectedTemplate.example_questions.map((q, i) => (
                      <li key={i}>• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{tT('adminTemplate.promptContent')}</h4>
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{selectedTemplate.prompt}</pre>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex justify-between items-center">
              <div className="text-xs text-slate-400">
                {tT('adminTemplate.usedCount')} {selectedTemplate.use_count} {tT('adminTemplate.times')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                >
                  {tT('adminTemplate.close')}
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setShowApplyModal(true);
                  }}
                  className="px-5 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {tT('adminTemplate.applyTemplate')}
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
                  <h2 className="text-lg font-bold text-slate-800">{tT('adminTemplate.applyConfirm')}</h2>
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
                  <span>{tT('adminTemplate.templateInfo')}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {tT('adminTemplate.targetPrompt')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={applyTargetPrompt}
                  onChange={(e) => setApplyTargetPrompt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white"
                >
                  <option value="">{tT('adminTemplate.selectPrompt')}</option>
                  {activePrompts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {tT('adminTemplate.changeDescription')}
                </label>
                <input
                  type="text"
                  value={applyChangeSummary}
                  onChange={(e) => setApplyChangeSummary(e.target.value)}
                  placeholder={tT('adminTemplate.changePlaceholder')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{tT('adminTemplate.templatePreview')}</h4>
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
                {tT('adminTemplate.cancel')}
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={applying || !applyTargetPrompt}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-violet-200"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {applying ? tT('adminTemplate.applying') : tT('adminTemplate.applyTemplate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminTemplates;
