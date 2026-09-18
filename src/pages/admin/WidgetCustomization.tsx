import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore, useLanguageStore } from '@/stores';
import type { Language } from '@/types';
import clsx from 'clsx';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Code, Globe, X,
  Send, Bot as BotIcon, Eye, EyeOff, Settings, Code2, ArrowLeft,
  MessageCircle, Palette, Globe2, ToggleLeft, ToggleRight,
  MessageSquare
} from 'lucide-react';

// Color presets
const PRESET_COLORS = [
  { color: '#0891b2', name: 'Cyan' },
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#10b981', name: 'Green' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#ef4444', name: 'Red' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#6366f1', name: 'Indigo' },
];

// Translation helper hook using useLanguageStore
function useTranslation() {
  const storeLanguage = useLanguageStore((state) => state.language);
  const language = storeLanguage || 'vi';
  
  const t = {
    vi: {
      // Widget page
      configTitle: 'Cấu hình Widget',
      configDesc: 'Cấu hình và triển khai chatbot lên website của bạn',
      primaryColor: 'Màu chính',
      predefinedColors: 'Màu có sẵn',
      defaultLanguage: 'Ngôn ngữ mặc định',
      features: 'Tính năng',
      allowFileUpload: 'Đính kèm file',
      allowLanguageSwitch: 'Chuyển ngôn ngữ',
      allowFaq: 'Gợi ý FAQ',
      position: 'Vị trí',
      position_bottomRight: 'Dưới bên phải',
      position_bottomLeft: 'Dưới bên trái',
      widgetStyle: 'Kiểu Widget',
      chatBubble: 'Nút bong bóng chat',
      enableBubble: 'Bật nút bong bóng',
      bubbleIcon: 'Icon bong bóng',
      labels: 'Nhãn',
      showLabel: 'Hiển thị nhãn',
      labelName: 'Tên nhãn',
      labelPosition: 'Vị trí nhãn',
      below: 'Bên dưới',
      above: 'Bên trên',
      embedCode: 'Mã nhúng',
      pasteIframe: 'Dán mã iFrame vào website của bạn',
      pasteScript: 'Dán mã JavaScript vào website của bạn',
      publicLink: 'Liên kết công khai',
      shareDirect: 'Chia sẻ liên kết trực tiếp',
      copied: 'Đã sao chép!',
      copy: 'Sao chép',
      openWidget: 'Mở Widget',
      preview: 'Xem trước',
      hidePreview: 'Ẩn xem trước',
      viewPreview: 'Xem trước',
      saving: 'Đang lưu...',
      saved: 'Đã lưu!',
      save: 'Lưu',
      saveFailed: 'Lưu thất bại',
      noPermission: 'Bạn không có quyền thay đổi cấu hình widget. Liên hệ Super Admin.',
      backHome: 'Quay về trang chủ',
      loading: 'Đang tải...',
      greeting: 'Xin chào! Tôi là MADA AI.',
      typeMessage: 'Nhập tin nhắn...',
      replying: 'Đang trả lời...',
      // Widget types
      widgetPopup: 'Popup',
      widgetEmbedded: 'Nhúng',
      widgetFloating: 'Nổi',
      // Language names
      languageVi: 'Tiếng Việt 🇻🇳',
      languageEn: 'English 🇺🇸',
      languageAr: 'العربية 🇸🇦',
      languageFr: 'Français 🇫🇷',
      // Embed options
      iframe: 'iFrame',
      javascript: 'JavaScript',
      scriptCode: 'Script Code',
      // Bubble icon labels
      chat: 'Chat',
      sparkle: 'Sparkle',
      person: 'Person',
      plus: 'Plus',
      // Placeholder
      chatWithMada: 'Chat với MADA',
    },
    en: {
      // Widget page
      configTitle: 'Widget Configuration',
      configDesc: 'Configure and deploy chatbot to your website',
      primaryColor: 'Primary Color',
      predefinedColors: 'Predefined Colors',
      defaultLanguage: 'Default Language',
      features: 'Features',
      allowFileUpload: 'File Attachment',
      allowLanguageSwitch: 'Language Switch',
      allowFaq: 'FAQ Suggestions',
      position: 'Position',
      position_bottomRight: 'Bottom Right',
      position_bottomLeft: 'Bottom Left',
      widgetStyle: 'Widget Style',
      chatBubble: 'Chat Bubble',
      enableBubble: 'Enable Bubble',
      bubbleIcon: 'Bubble Icon',
      labels: 'Labels',
      showLabel: 'Show Label',
      labelName: 'Label Name',
      labelPosition: 'Label Position',
      below: 'Below',
      above: 'Above',
      embedCode: 'Embed Code',
      pasteIframe: 'Paste iFrame code into your website',
      pasteScript: 'Paste JavaScript code into your website',
      publicLink: 'Public Link',
      shareDirect: 'Share direct link',
      copied: 'Copied!',
      copy: 'Copy',
      openWidget: 'Open Widget',
      preview: 'Preview',
      hidePreview: 'Hide Preview',
      viewPreview: 'View Preview',
      saving: 'Saving...',
      saved: 'Saved!',
      save: 'Save',
      saveFailed: 'Save failed',
      noPermission: 'You do not have permission to change widget configuration. Contact Super Admin.',
      backHome: 'Back to Home',
      loading: 'Loading...',
      greeting: 'Hello! I am MADA AI.',
      typeMessage: 'Type a message...',
      replying: 'Replying...',
      // Widget types
      widgetPopup: 'Popup',
      widgetEmbedded: 'Embedded',
      widgetFloating: 'Floating',
      // Language names
      languageVi: 'Tiếng Việt 🇻🇳',
      languageEn: 'English 🇺🇸',
      languageAr: 'العربية 🇸🇦',
      languageFr: 'Français 🇫🇷',
      // Embed options
      iframe: 'iFrame',
      javascript: 'JavaScript',
      scriptCode: 'Script Code',
      // Bubble icon labels
      chat: 'Chat',
      sparkle: 'Sparkle',
      person: 'Person',
      plus: 'Plus',
      // Placeholder
      chatWithMada: 'Chat with MADA',
    },
    ar: {
      // Widget page
      configTitle: 'إعداد الأداة',
      configDesc: 'تكوين ونشر روبوت المحادثة على موقعك',
      primaryColor: 'اللون الأساسي',
      predefinedColors: 'الألوان المحددة مسبقاً',
      defaultLanguage: 'اللغة الافتراضية',
      features: 'الميزات',
      allowFileUpload: 'إرفاق ملف',
      allowLanguageSwitch: 'تبديل اللغة',
      allowFaq: 'اقتراحات الأسئلة الشائعة',
      position: 'الموضع',
      position_bottomRight: 'أسفل اليمين',
      position_bottomLeft: 'أسفل اليسار',
      widgetStyle: 'نمط الأداة',
      chatBubble: 'فقاعة المحادثة',
      enableBubble: 'تفعيل الفقاعة',
      bubbleIcon: 'أيقونة الفقاعة',
      labels: 'التسميات',
      showLabel: 'إظهار التسمية',
      labelName: 'اسم التسمية',
      labelPosition: 'موضع التسمية',
      below: 'أسفل',
      above: 'أعلى',
      embedCode: 'كود التضمين',
      pasteIframe: 'الصق كود iFrame في موقعك',
      pasteScript: 'الصق كود JavaScript في موقعك',
      publicLink: 'رابط عام',
      shareDirect: 'مشاركة الرابط مباشرة',
      copied: 'تم النسخ!',
      copy: 'نسخ',
      openWidget: 'فتح الأداة',
      preview: 'معاينة',
      hidePreview: 'إخفاء المعاينة',
      viewPreview: 'معاينة',
      saving: 'جارٍ الحفظ...',
      saved: 'تم الحفظ!',
      save: 'حفظ',
      saveFailed: 'فشل الحفظ',
      noPermission: 'ليس لديك إذن لتغيير تكوين الأداة. تواصل مع المشرف الأعلى.',
      backHome: 'العودة للرئيسية',
      loading: 'جارٍ التحميل...',
      greeting: 'مرحباً! أنا MADA AI.',
      typeMessage: 'اكتب رسالة...',
      replying: 'جارٍ الرد...',
      // Widget types
      widgetPopup: 'Popup',
      widgetEmbedded: 'مُضمَّن',
      widgetFloating: 'عائم',
      // Language names
      languageVi: 'Tiếng Việt 🇻🇳',
      languageEn: 'English 🇺🇸',
      languageAr: 'العربية 🇸🇦',
      languageFr: 'Français 🇫🇷',
      // Embed options
      iframe: 'iFrame',
      javascript: 'JavaScript',
      scriptCode: 'كود السكريبت',
      // Bubble icon labels
      chat: 'محادثة',
      sparkle: 'بريق',
      person: 'شخص',
      plus: 'زائد',
      // Placeholder
      chatWithMada: 'الدردشة مع MADA',
    },
    fr: {
      // Widget page
      configTitle: 'Configuration du Widget',
      configDesc: 'Configurez et déployez le chatbot sur votre site web',
      primaryColor: 'Couleur principale',
      predefinedColors: 'Couleurs prédéfinies',
      defaultLanguage: 'Langue par défaut',
      features: 'Fonctionnalités',
      allowFileUpload: 'Pièce jointe',
      allowLanguageSwitch: 'Changement de langue',
      allowFaq: 'Suggestions FAQ',
      position: 'Position',
      position_bottomRight: 'Bas droite',
      position_bottomLeft: 'Bas gauche',
      widgetStyle: 'Style du widget',
      chatBubble: 'Bulle de chat',
      enableBubble: 'Activer la bulle',
      bubbleIcon: 'Icône de bulle',
      labels: 'Étiquettes',
      showLabel: 'Afficher l\'étiquette',
      labelName: 'Nom de l\'étiquette',
      labelPosition: 'Position de l\'étiquette',
      below: 'Dessous',
      above: 'Dessus',
      embedCode: 'Code d\'intégration',
      pasteIframe: 'Collez le code iFrame dans votre site web',
      pasteScript: 'Collez le code JavaScript dans votre site web',
      publicLink: 'Lien public',
      shareDirect: 'Partager le lien directement',
      copied: 'Copié!',
      copy: 'Copier',
      openWidget: 'Ouvrir le widget',
      preview: 'Aperçu',
      hidePreview: 'Masquer l\'aperçu',
      viewPreview: 'Aperçu',
      saving: 'Enregistrement...',
      saved: 'Enregistré!',
      save: 'Enregistrer',
      saveFailed: 'Échec de l\'enregistrement',
      noPermission: 'Vous n\'avez pas la permission de modifier la configuration du widget. Contactez le Super Admin.',
      backHome: 'Retour à l\'accueil',
      loading: 'Chargement...',
      greeting: 'Bonjour! Je suis MADA AI.',
      typeMessage: 'Tapez un message...',
      replying: 'En train de répondre...',
      // Widget types
      widgetPopup: 'Popup',
      widgetEmbedded: 'Intégré',
      widgetFloating: 'Flottant',
      // Language names
      languageVi: 'Tiếng Việt 🇻🇳',
      languageEn: 'English 🇺🇸',
      languageAr: 'العربية 🇸🇦',
      languageFr: 'Français 🇫🇷',
      // Embed options
      iframe: 'iFrame',
      javascript: 'JavaScript',
      scriptCode: 'Code Script',
      // Bubble icon labels
      chat: 'Chat',
      sparkle: 'Étincelle',
      person: 'Personne',
      plus: 'Plus',
      // Placeholder
      chatWithMada: 'Discuter avec MADA',
    },
  };

  const getT = () => t[language as keyof typeof t] || t.vi;
  
  return { t: getT(), language };
}

interface WidgetCustomizationProps {
  language?: 'vi' | 'en' | 'ar' | 'fr';
  userRole?: 'admin' | 'superadmin' | 'super_admin' | 'user';
}

// Mini Live Preview Widget
function MiniWidgetPreview({ config, onClose }: { config: any; onClose: () => void }) {
  const storeLanguage = useLanguageStore((state) => state.language);
  const lang = storeLanguage || 'vi';
  const [messages, setMessages] = useState([
    { id: '1', role: 'bot', content: config.welcomeTitle || 'Xin chào! Tôi là MADA AI.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Get the correct greeting based on selected language
  const getWelcomeMessage = () => {
    // Try welcomeTitle fields first (from widget settings), then fall back to translations
    if (config.defaultLanguage === 'en') {
      return config.welcomeTitleEn || config.welcomeTitle || 'Hello! I am MADA AI.';
    }
    if (config.defaultLanguage === 'ar') {
      return config.welcomeTitleAr || config.welcomeTitle || 'مرحباً! أنا MADA AI.';
    }
    if (config.defaultLanguage === 'fr') {
      return config.welcomeTitleFr || config.welcomeTitle || 'Bonjour! Je suis MADA AI.';
    }
    return config.welcomeTitle || 'Xin chào! Tôi là MADA AI.';
  };

  // Get the correct placeholder based on selected language
  const getPlaceholder = () => {
    if (config.defaultLanguage === 'en') {
      return 'Type a message...';
    }
    if (config.defaultLanguage === 'ar') {
      return 'اكتب رسالة...';
    }
    if (config.defaultLanguage === 'fr') {
      return 'Tapez un message...';
    }
    return 'Nhập tin nhắn...';
  };

  const getBotName = () => {
    switch (config.defaultLanguage) {
      case 'en': return config.botNameEn || config.botName || 'MADA AI';
      case 'ar': return config.botNameAr || config.botName || 'MADA AI';
      case 'fr': return config.botNameFr || config.botName || 'MADA AI';
      default: return config.botName || 'MADA AI';
    }
  };

  // Update welcome message when language changes
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === '1') {
      setMessages([{ id: '1', role: 'bot', content: getWelcomeMessage() }]);
    }
  }, [config.defaultLanguage]);

  // Get typing message based on language
  const getTypingMessage = () => {
    if (config.defaultLanguage === 'en') {
      return 'Replying...';
    }
    if (config.defaultLanguage === 'ar') {
      return 'جارٍ الرد...';
    }
    if (config.defaultLanguage === 'fr') {
      return 'En train de répondre...';
    }
    return 'Đang trả lời...';
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    
    // Simulate bot response
    setTimeout(() => {
      setIsTyping(false);
      const botMsg = { id: (Date.now() + 1).toString(), role: 'bot' as const, content: getTypingMessage() + ' ' + inputValue };
      setMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop overlay - click to close */}
      <div 
        className="fixed inset-0 bg-black/20 z-[99] cursor-pointer"
        onClick={onClose}
        title="Click to close preview"
      />
      
      <div
        className={`fixed ${config.position === 'bottom-left' ? 'left-4' : 'right-4'} bottom-4 z-[100]`}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
          <div
            className="p-3 flex items-center gap-2 border-b"
            style={{ backgroundColor: config.primaryColor || '#0891b2' }}
          >
            <BotIcon className="w-5 h-5 text-white" />
            <div className="flex-1">
              <h4 className="text-white font-bold text-sm">{getBotName()}</h4>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/30 text-white hover:bg-white/50 flex items-center justify-center transition-colors cursor-pointer"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-48 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border px-3 py-1.5 rounded-lg">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <div key={delay} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-2 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleSend}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white cursor-pointer transition-opacity hover:opacity-80"
                style={{ backgroundColor: config.primaryColor || '#0891b2' }}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Toggle Component
function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'relative w-12 h-7 rounded-full transition-all duration-200 border-2',
        enabled 
          ? 'bg-emerald-500 border-emerald-600' 
          : 'bg-gray-200 border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200',
          enabled ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

// Card Section Component
function CardSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export function WidgetCustomization({ language = 'vi', userRole = 'admin' }: WidgetCustomizationProps) {
  const navigate = useNavigate();
  const { config, isLoading, loadConfig, updateConfig, saveConfig } = useWidgetSettingsStore();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'embed'>('config');
  const [iframeCode, setIframeCode] = useState('');
  const [scriptCode, setScriptCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  
  // Use the translation hook that gets language from useLanguageStore
  const { t, language: storeLanguage } = useTranslation();
  const lang = storeLanguage || language || 'vi';

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const embedParams = `botName=${encodeURIComponent(config.botName)}&primaryColor=${encodeURIComponent(config.primaryColor)}&position=${config.position}&lang=${config.defaultLanguage}&widgetType=${config.widgetType}&chatBubbleEnabled=${config.chatBubbleEnabled}&chatBubbleIcon=${encodeURIComponent(config.chatBubbleIcon)}&showLabel=${config.showLabel}&labelPosition=${config.labelPosition}&labelName=${encodeURIComponent(config.labelName)}&labelColor=${encodeURIComponent(config.labelColor)}`;

    setIframeCode(`<iframe src="${baseUrl}/embed?${embedParams}" width="380" height="600" style="border:none;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15);" title="${config.botName}"></iframe>`);

    setScriptCode(`<script src="${baseUrl}/embed/widget.js"></script>
<script>
  MadaWidget.init({
    botName: '${config.botName}',
    primaryColor: '${config.primaryColor}',
    position: '${config.position}',
    defaultLanguage: '${config.defaultLanguage}',
    widgetType: '${config.widgetType}',
    chatBubbleEnabled: ${config.chatBubbleEnabled},
    chatBubbleIcon: '${config.chatBubbleIcon}',
    showLabel: ${config.showLabel},
    labelPosition: '${config.labelPosition}',
    labelName: '${config.labelName}',
    labelColor: '${config.labelColor}'
  });
</script>`);

    setPublicLink(`${baseUrl}/embed?${embedParams}&public=1`);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveConfig();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin';
  const isReadOnly = !isSuperAdmin && userRole !== 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        <span className="ml-2 text-slate-600">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live Preview Widget */}
      {showLivePreview && (
        <MiniWidgetPreview config={config} onClose={() => setShowLivePreview(false)} />
      )}

      {/* Header with Banner */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-blue-100"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-200/40 via-transparent to-transparent"></div>
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
              title={t.backHome}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg">
              <BotIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t.configTitle}</h2>
              <p className="text-sm text-gray-500">{t.configDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border',
                showLivePreview
                  ? 'bg-violet-500 text-white border-violet-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              {showLivePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showLivePreview ? t.hidePreview : t.viewPreview}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-violet-600 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t.saving}</>
                ) : saveSuccess ? (
                  <><CheckCircle className="w-4 h-4" /> {t.saved}</>
                ) : (
                  <><Settings className="w-4 h-4" /> {t.save}</>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('config')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
            activeTab === 'config'
              ? 'bg-white text-violet-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Settings className="w-4 h-4" />
          {t.configTitle}
        </button>
        <button
          onClick={() => setActiveTab('embed')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
            activeTab === 'embed'
              ? 'bg-white text-amber-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Code2 className="w-4 h-4" />
          {t.embedCode}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT COLUMN - Settings */}
          <div className="lg:col-span-2 space-y-4">
            {/* Primary Color */}
            <CardSection title={t.primaryColor} icon={Palette}>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl border border-gray-200 shadow-inner" 
                    style={{ backgroundColor: config.primaryColor }}
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    disabled={isReadOnly}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
                    placeholder="#0891b2"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">{t.predefinedColors}</p>
                  <div className="flex flex-wrap gap-3">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => !isReadOnly && updateConfig({ primaryColor: preset.color })}
                        className={clsx(
                          'w-10 h-10 rounded-lg transition-all hover:scale-110 border border-gray-200',
                          config.primaryColor === preset.color && 'ring-2 ring-violet-500 ring-offset-2'
                        )}
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardSection>

            {/* Language */}
            <CardSection title={t.defaultLanguage} icon={Globe2}>
              <select
                value={config.defaultLanguage}
                onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white"
              >
                <option value="vi">{t.languageVi}</option>
                <option value="en">{t.languageEn}</option>
                <option value="ar">{t.languageAr}</option>
                <option value="fr">{t.languageFr}</option>
              </select>
            </CardSection>

            {/* Features */}
            <CardSection title={t.features} icon={ToggleLeft}>
              <div className="space-y-3">
                {[
                  { key: 'allowFileUpload', label: t.allowFileUpload },
                  { key: 'allowLanguageSwitch', label: t.allowLanguageSwitch },
                  { key: 'allowFaq', label: t.allowFaq },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{label}</span>
                    <Toggle 
                      enabled={config[key as keyof typeof config] as boolean} 
                      onChange={() => !isReadOnly && updateConfig({ [key]: !config[key as keyof typeof config] })}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </CardSection>

            {/* Position & Style */}
            <div className="grid grid-cols-2 gap-4">
              <CardSection title={t.position} icon={ToggleRight}>
                <div className="flex gap-2">
                  <button
                    onClick={() => !isReadOnly && updateConfig({ position: 'bottom-right' as any })}
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border',
                      config.position === 'bottom-right'
                        ? 'bg-violet-500 text-white border-violet-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {t.position_bottomRight}
                  </button>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ position: 'bottom-left' as any })}
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border',
                      config.position === 'bottom-left'
                        ? 'bg-violet-500 text-white border-violet-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {t.position_bottomLeft}
                  </button>
                </div>
              </CardSection>

              <CardSection title={t.widgetStyle} icon={ToggleRight}>
                <select
                  value={config.widgetType}
                  onChange={(e) => !isReadOnly && updateConfig({ widgetType: e.target.value as any })}
                  disabled={isReadOnly}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white"
                >
                  <option value="popup">{t.widgetPopup}</option>
                  <option value="embedded">{t.widgetEmbedded}</option>
                  <option value="floating">{t.widgetFloating}</option>
                </select>
              </CardSection>
            </div>
          </div>

          {/* RIGHT COLUMN - Chat Bubble */}
          <div className="lg:col-span-1 space-y-4">
            <CardSection title={t.chatBubble} icon={MessageSquare}>
              <div className="space-y-4">
                {/* Toggle */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{t.enableBubble}</span>
                  <Toggle 
                    enabled={config.chatBubbleEnabled} 
                    onChange={() => !isReadOnly && updateConfig({ chatBubbleEnabled: !config.chatBubbleEnabled })}
                    disabled={isReadOnly}
                  />
                </div>

                {config.chatBubbleEnabled && (
                  <>
                    {/* Icon Selection */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-3">{t.bubbleIcon}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { icon: '💬', key: 'chat' },
                          { icon: '✨', key: 'sparkle' },
                          { icon: '👤', key: 'person' },
                          { icon: '➕', key: 'plus' },
                        ].map(({ icon, key }) => (
                          <button
                            key={icon}
                            onClick={() => !isReadOnly && updateConfig({ chatBubbleIcon: icon })}
                            className={clsx(
                              'flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all border',
                              config.chatBubbleIcon === icon
                                ? 'bg-violet-500 text-white border-violet-600'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            <span className="text-lg">{icon}</span>
                            <span className={clsx(
                              'text-[10px] font-medium',
                              config.chatBubbleIcon === icon ? 'text-white' : 'text-gray-500'
                            )}>
                              {t[key as keyof typeof t] || key}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
                      <div 
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        {config.chatBubbleIcon}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardSection>

            {/* Labels */}
            <CardSection title={t.labels} icon={MessageCircle}>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{t.showLabel}</span>
                  <Toggle 
                    enabled={config.showLabel} 
                    onChange={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })}
                    disabled={isReadOnly}
                  />
                </div>

                {config.showLabel && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.labelName.toUpperCase()}</label>
                      <input
                        type="text"
                        value={config.labelName}
                        onChange={(e) => updateConfig({ labelName: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
                        placeholder={t.chatWithMada}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.labelPosition.toUpperCase()}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => !isReadOnly && updateConfig({ labelPosition: 'bottom' as any })}
                          className={clsx(
                            'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border',
                            config.labelPosition === 'bottom'
                              ? 'bg-violet-500 text-white border-violet-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          )}
                        >
                          {t.below}
                        </button>
                        <button
                          onClick={() => !isReadOnly && updateConfig({ labelPosition: 'top' as any })}
                          className={clsx(
                            'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border',
                            config.labelPosition === 'top'
                              ? 'bg-violet-500 text-white border-violet-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          )}
                        >
                          {t.above}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardSection>
          </div>
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="space-y-4">
          {/* Embed Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* iFrame */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(iframeCode, 'iframe')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold">{t.iframe}</span>
                  <p className="text-xs text-slate-400">{t.pasteIframe}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'iframe' ? <><CheckCircle className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copy}</>}
              </button>
            </div>

            {/* JavaScript */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-amber-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(scriptCode, 'script')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold">{t.javascript}</span>
                  <p className="text-xs text-slate-400">{t.pasteScript}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'script' ? <><CheckCircle className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copy}</>}
              </button>
            </div>

            {/* Public Link */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-green-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(publicLink, 'public')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold">{t.publicLink}</span>
                  <p className="text-xs text-slate-400">{t.shareDirect}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'public' ? <><CheckCircle className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copy}</>}
              </button>
            </div>
          </div>

          {/* Code Preview */}
          <div className="p-4 rounded-xl bg-slate-900 border border-gray-700">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-slate-400 font-mono">{t.scriptCode}</span>
            </div>
            <pre className="p-3 rounded-lg bg-slate-800 text-amber-300 text-xs font-mono overflow-x-auto max-h-48">
              <code>{scriptCode}</code>
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-violet-600"
            >
              <Globe className="w-4 h-4" />
              {t.openWidget}
            </a>
            <button
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-amber-600"
            >
              <Eye className="w-4 h-4" />
              {t.preview}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {saveError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {isReadOnly && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {t.noPermission}
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
