import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore, useLanguageStore } from '@/stores';
import type { Language } from '@/types';
import clsx from 'clsx';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Code, Globe, X,
  Send, Bot as BotIcon, Eye, EyeOff, Settings, Code2, ArrowLeft,
  Globe as GlobeIcon, Plus, Trash2, Edit3, ChevronDown, ChevronUp, HelpCircle
} from 'lucide-react';
import { adminApi } from '@/pages/admin/adminApi';

// Widget translations - supports all languages via useLanguageStore
const tW = (key: string): string => {
  const lang = useLanguageStore.getState().language;
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'admin.widget.saveFailed': 'Lưu thất bại',
      'admin.widget.loading': 'Đang tải cấu hình...',
      'admin.widget.backHome': 'Quay về trang chủ',
      'admin.widget.configTitle': 'Cấu hình Widget',
      'admin.widget.configDesc': 'Tùy chỉnh giao diện và hành vi của widget chat',
      'admin.widget.hidePreview': 'Ẩn preview',
      'admin.widget.viewPreview': 'Xem preview',
      'admin.widget.saving': 'Đang lưu...',
      'admin.widget.saved': 'Đã lưu!',
      'admin.widget.save': 'Lưu thay đổi',
      'admin.widget.embedCode': 'Mã nhúng',
      'admin.widget.botName': 'Tên Bot',
      'admin.widget.defaultLanguage': 'Ngôn ngữ mặc định',
      'admin.widget.primaryColor': 'Màu chính',
      'admin.widget.welcomeMessage': 'Tin nhắn chào mừng',
      'admin.widget.position': 'Vị trí',
      'admin.widget.positionBottomRight': 'Dưới phải',
      'admin.widget.positionBottomLeft': 'Dưới trái',
      'admin.widget.widgetStyle': 'Kiểu widget',
      'admin.widget.widgetPopup': 'Popup',
      'admin.widget.widgetEmbedded': 'Nhúng',
      'admin.widget.widgetFloating': 'Floating',
      'admin.widget.chatButton': 'Nút chat',
      'admin.widget.enabled': 'Bật',
      'admin.widget.disabled': 'Tắt',
      'admin.widget.chatLabel': 'Nhãn chat',
      'admin.widget.showLabel': 'Hiện nhãn',
      'admin.widget.below': 'Dưới',
      'admin.widget.above': 'Trên',
      'admin.widget.features': 'Tính năng',
      'admin.widget.allowFileUpload': 'Cho phép đính kèm file',
      'admin.widget.allowLanguageSwitch': 'Cho phép đổi ngôn ngữ',
      'admin.widget.allowFaq': 'Cho phép FAQ',
      'admin.widget.iframe': 'iFrame',
      'admin.widget.pasteIframe': 'Dán vào HTML',
      'admin.widget.javascript': 'JavaScript',
      'admin.widget.pasteScript': 'Dán vào website',
      'admin.widget.publicLink': 'Link công khai',
      'admin.widget.shareDirect': 'Chia sẻ trực tiếp',
      'admin.widget.copied': 'Đã copy!',
      'admin.widget.copy': 'Copy',
      'admin.widget.scriptCode': 'Mã Script',
      'admin.widget.openWidget': 'Mở Widget',
      'admin.widget.preview': 'Xem trước',
      'admin.widget.noPermission': 'Bạn không có quyền chỉnh sửa cấu hình này.',
    },
    en: {
      'admin.widget.saveFailed': 'Save failed',
      'admin.widget.loading': 'Loading configuration...',
      'admin.widget.backHome': 'Back to home',
      'admin.widget.configTitle': 'Widget Configuration',
      'admin.widget.configDesc': 'Customize the appearance and behavior of the chat widget',
      'admin.widget.hidePreview': 'Hide preview',
      'admin.widget.viewPreview': 'View preview',
      'admin.widget.saving': 'Saving...',
      'admin.widget.saved': 'Saved!',
      'admin.widget.save': 'Save changes',
      'admin.widget.embedCode': 'Embed Code',
      'admin.widget.botName': 'Bot Name',
      'admin.widget.defaultLanguage': 'Default Language',
      'admin.widget.primaryColor': 'Primary Color',
      'admin.widget.welcomeMessage': 'Welcome Message',
      'admin.widget.position': 'Position',
      'admin.widget.positionBottomRight': 'Bottom Right',
      'admin.widget.positionBottomLeft': 'Bottom Left',
      'admin.widget.widgetStyle': 'Widget Style',
      'admin.widget.widgetPopup': 'Popup',
      'admin.widget.widgetEmbedded': 'Embedded',
      'admin.widget.widgetFloating': 'Floating',
      'admin.widget.chatButton': 'Chat Button',
      'admin.widget.enabled': 'Enabled',
      'admin.widget.disabled': 'Disabled',
      'admin.widget.chatLabel': 'Chat Label',
      'admin.widget.showLabel': 'Show Label',
      'admin.widget.below': 'Below',
      'admin.widget.above': 'Above',
      'admin.widget.features': 'Features',
      'admin.widget.allowFileUpload': 'Allow file attachments',
      'admin.widget.allowLanguageSwitch': 'Allow language switch',
      'admin.widget.allowFaq': 'Allow FAQ',
      'admin.widget.iframe': 'iFrame',
      'admin.widget.pasteIframe': 'Paste into HTML',
      'admin.widget.javascript': 'JavaScript',
      'admin.widget.pasteScript': 'Paste into website',
      'admin.widget.publicLink': 'Public Link',
      'admin.widget.shareDirect': 'Share directly',
      'admin.widget.copied': 'Copied!',
      'admin.widget.copy': 'Copy',
      'admin.widget.scriptCode': 'Script Code',
      'admin.widget.openWidget': 'Open Widget',
      'admin.widget.preview': 'Preview',
      'admin.widget.noPermission': 'You do not have permission to edit this configuration.',
    },
    ar: {
      'admin.widget.saveFailed': 'فشل الحفظ',
      'admin.widget.loading': 'جاري تحميل التكوين...',
      'admin.widget.backHome': 'العودة للرئيسية',
      'admin.widget.configTitle': 'تكوين الأداة',
      'admin.widget.configDesc': 'تخصيص مظهر وسلوك أداة المحادثة',
      'admin.widget.hidePreview': 'إخفاء المعاينة',
      'admin.widget.viewPreview': 'عرض المعاينة',
      'admin.widget.saving': 'جاري الحفظ...',
      'admin.widget.saved': 'تم الحفظ!',
      'admin.widget.save': 'حفظ التغييرات',
      'admin.widget.embedCode': 'كود التضمين',
      'admin.widget.botName': 'اسم البوت',
      'admin.widget.defaultLanguage': 'اللغة الافتراضية',
      'admin.widget.primaryColor': 'اللون الأساسي',
      'admin.widget.welcomeMessage': 'رسالة الترحيب',
      'admin.widget.position': 'الموضع',
      'admin.widget.positionBottomRight': 'أسفل اليمين',
      'admin.widget.positionBottomLeft': 'أسفل اليسار',
      'admin.widget.widgetStyle': 'نمط الأداة',
      'admin.widget.widgetPopup': 'نافذة منبثقة',
      'admin.widget.widgetEmbedded': 'مضمن',
      'admin.widget.widgetFloating': 'عائم',
      'admin.widget.chatButton': 'زر المحادثة',
      'admin.widget.enabled': 'مفعل',
      'admin.widget.disabled': 'معطل',
      'admin.widget.chatLabel': 'تسمية المحادثة',
      'admin.widget.showLabel': 'إظهار التسمية',
      'admin.widget.below': 'أسفل',
      'admin.widget.above': 'أعلى',
      'admin.widget.features': 'الميزات',
      'admin.widget.allowFileUpload': 'السماح بإرفاق الملفات',
      'admin.widget.allowLanguageSwitch': 'السماح بتغيير اللغة',
      'admin.widget.allowFaq': 'السماح بالأسئلة الشائعة',
      'admin.widget.iframe': 'iFrame',
      'admin.widget.pasteIframe': 'لصق في HTML',
      'admin.widget.javascript': 'JavaScript',
      'admin.widget.pasteScript': 'لصق في الموقع',
      'admin.widget.publicLink': 'الرابط العام',
      'admin.widget.shareDirect': 'مشاركة مباشرة',
      'admin.widget.copied': 'تم النسخ!',
      'admin.widget.copy': 'نسخ',
      'admin.widget.scriptCode': 'كود السكريبت',
      'admin.widget.openWidget': 'فتح الأداة',
      'admin.widget.preview': 'معاينة',
      'admin.widget.noPermission': 'ليس لديك صلاحية لتعديل هذا التكوين.',
    },
    fr: {
      'admin.widget.saveFailed': 'Échec de la sauvegarde',
      'admin.widget.loading': 'Chargement de la configuration...',
      'admin.widget.backHome': 'Retour à l\'accueil',
      'admin.widget.configTitle': 'Configuration du Widget',
      'admin.widget.configDesc': 'Personnalisez l\'apparence et le comportement du widget de chat',
      'admin.widget.hidePreview': 'Masquer l\'aperçu',
      'admin.widget.viewPreview': 'Voir l\'aperçu',
      'admin.widget.saving': 'Sauvegarde...',
      'admin.widget.saved': 'Sauvegardé!',
      'admin.widget.save': 'Enregistrer les modifications',
      'admin.widget.embedCode': 'Code d\'intégration',
      'admin.widget.botName': 'Nom du Bot',
      'admin.widget.defaultLanguage': 'Langue par défaut',
      'admin.widget.primaryColor': 'Couleur principale',
      'admin.widget.welcomeMessage': 'Message de bienvenue',
      'admin.widget.position': 'Position',
      'admin.widget.positionBottomRight': 'Bas droite',
      'admin.widget.positionBottomLeft': 'Bas gauche',
      'admin.widget.widgetStyle': 'Style du widget',
      'admin.widget.widgetPopup': 'Popup',
      'admin.widget.widgetEmbedded': 'Intégré',
      'admin.widget.widgetFloating': 'Flottant',
      'admin.widget.chatButton': 'Bouton chat',
      'admin.widget.enabled': 'Activé',
      'admin.widget.disabled': 'Désactivé',
      'admin.widget.chatLabel': 'Étiquette du chat',
      'admin.widget.showLabel': 'Afficher l\'étiquette',
      'admin.widget.below': 'Dessous',
      'admin.widget.above': 'Dessus',
      'admin.widget.features': 'Fonctionnalités',
      'admin.widget.allowFileUpload': 'Autoriser les pièces jointes',
      'admin.widget.allowLanguageSwitch': 'Autoriser le changement de langue',
      'admin.widget.allowFaq': 'Autoriser la FAQ',
      'admin.widget.iframe': 'iFrame',
      'admin.widget.pasteIframe': 'Coller dans HTML',
      'admin.widget.javascript': 'JavaScript',
      'admin.widget.pasteScript': 'Coller dans le site web',
      'admin.widget.publicLink': 'Lien public',
      'admin.widget.shareDirect': 'Partager directement',
      'admin.widget.copied': 'Copié!',
      'admin.widget.copy': 'Copier',
      'admin.widget.scriptCode': 'Code Script',
      'admin.widget.openWidget': 'Ouvrir le Widget',
      'admin.widget.preview': 'Aperçu',
      'admin.widget.noPermission': 'Vous n\'avez pas la permission de modifier cette configuration.',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

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

// ============== SUGGESTED QUESTIONS TYPES ==============
type ATCategory = 'vision' | 'hearing' | 'mobility' | 'cognition' | 'communication' | 'daily_living' | 'education' | 'general';
type ViewMode = 'end_user' | 'at_specialist';
type LanguageType = 'vi' | 'en' | 'ar' | 'fr';

interface SuggestedQuestion {
  id: string;
  agent_id: string | null;
  category: ATCategory;
  view_mode: ViewMode;
  language: LanguageType;
  question: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const SQ_CATEGORIES: { value: ATCategory; label: string; icon: string }[] = [
  { value: 'vision', label: 'Thị giác', icon: '👁️' },
  { value: 'hearing', label: 'Thính giác', icon: '👂' },
  { value: 'mobility', label: 'Vận động', icon: '🦴' },
  { value: 'cognition', label: 'Nhận thức', icon: '🧠' },
  { value: 'communication', label: 'Giao tiếp', icon: '💬' },
  { value: 'daily_living', label: 'Sinh hoạt', icon: '🦽' },
  { value: 'education', label: 'Giáo dục', icon: '📋' },
  { value: 'general', label: 'Tổng quát', icon: '📦' },
];

const SQ_VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'end_user', label: 'Người dùng' },
  { value: 'at_specialist', label: 'Chuyên gia AT' },
];

const SQ_LANGUAGES: { value: LanguageType; label: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
];

interface WidgetCustomizationProps {
  language?: 'vi' | 'en' | 'ar' | 'fr';
  userRole?: 'admin' | 'superadmin' | 'super_admin' | 'user';
}

// Mini Live Preview Widget
function MiniWidgetPreview({ config, t, onClose }: { config: any; t: (key: string) => string; onClose: () => void }) {
  const [messages, setMessages] = useState([
    { id: '1', role: 'bot', content: config.welcomeTitle || 'Xin chào! Tôi là MADA AI.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const getWelcomeMessage = () => {
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

  const getPlaceholder = () => {
    if (config.defaultLanguage === 'en') return 'Type a message...';
    if (config.defaultLanguage === 'ar') return 'اكتب رسالة...';
    if (config.defaultLanguage === 'fr') return 'Tapez un message...';
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

  useEffect(() => {
    if (messages.length === 1 && messages[0].id === '1') {
      setMessages([{ id: '1', role: 'bot', content: getWelcomeMessage() }]);
    }
  }, [config.defaultLanguage]);

  const getTypingMessage = () => {
    if (config.defaultLanguage === 'en') return 'Replying...';
    if (config.defaultLanguage === 'ar') return 'جارٍ الرد...';
    if (config.defaultLanguage === 'fr') return 'En train de répondre...';
    return 'Đang trả lời...';
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
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
      <div className="fixed inset-0 bg-black/20 z-[99] cursor-pointer" onClick={onClose} title="Click to close preview" />
      <div className={`fixed ${config.position === 'bottom-left' ? 'left-4' : 'right-4'} bottom-4 z-[100]`}>
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
          <div className="p-3 flex items-center gap-2 border-b" style={{ backgroundColor: config.primaryColor || '#0891b2' }}>
            <BotIcon className="w-5 h-5 text-white" />
            <div className="flex-1">
              <h4 className="text-white font-bold text-sm">{getBotName()}</h4>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/30 text-white hover:bg-white/50 flex items-center justify-center transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-48 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'}`}>
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

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'relative w-12 h-7 rounded-full transition-all duration-200 border-2',
        enabled ? 'bg-emerald-500 border-emerald-600' : 'bg-gray-200 border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200', enabled ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function WidgetCustomization({ userRole = 'admin' }: Omit<WidgetCustomizationProps, 'language'>) {
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

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const embedParams = `botName=${encodeURIComponent(config.botName)}&primaryColor=${encodeURIComponent(config.primaryColor)}&position=${config.position}&lang=${config.defaultLanguage}&widgetType=${config.widgetType}&chatBubbleEnabled=${config.chatBubbleEnabled}&chatBubbleIcon=${encodeURIComponent(config.chatBubbleIcon)}&showLabel=${config.showLabel}&labelPosition=${config.labelPosition}&labelName=${encodeURIComponent(config.labelName)}&labelColor=${encodeURIComponent(config.labelColor)}`;

    setIframeCode(`<iframe src="${baseUrl}/embed?${embedParams}" width="380" height="600" style="border:none;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15);" title="${config.botName}"></iframe>`);
    setScriptCode(`<script src="${baseUrl}/embed/widget.js"></script>\n<script>\n  MadaWidget.init({\n    botName: '${config.botName}',\n    primaryColor: '${config.primaryColor}',\n    position: '${config.position}',\n    defaultLanguage: '${config.defaultLanguage}',\n    widgetType: '${config.widgetType}',\n    chatBubbleEnabled: ${config.chatBubbleEnabled},\n    chatBubbleIcon: '${config.chatBubbleIcon}',\n    showLabel: ${config.showLabel},\n    labelPosition: '${config.labelPosition}',\n    labelName: '${config.labelName}',\n    labelColor: '${config.labelColor}'\n  });\n</script>`);
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
      setSaveError(e.message || tW('admin.widget.saveFailed'));
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
        <span className="ml-2 text-slate-600">{tW('admin.widget.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showLivePreview && <MiniWidgetPreview config={config} t={t} onClose={() => setShowLivePreview(false)} />}

      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-blue-100"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-200/40 via-transparent to-transparent"></div>
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm" title={tW('admin.widget.backHome')}>
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg">
              <BotIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{tW('admin.widget.configTitle')}</h2>
              <p className="text-sm text-gray-500">{tW('admin.widget.configDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowLivePreview(!showLivePreview)} className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border', showLivePreview ? 'bg-violet-500 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')}>
              {showLivePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showLivePreview ? tW('admin.widget.hidePreview') : tW('admin.widget.viewPreview')}
            </button>
            {!isReadOnly && (
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-violet-600 disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {tW('admin.widget.saving')}</> : saveSuccess ? <><CheckCircle className="w-4 h-4" /> {tW('admin.widget.saved')}</> : <><Settings className="w-4 h-4" /> {tW('admin.widget.save')}</>}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('config')} className={clsx('px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2', activeTab === 'config' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
          <Settings className="w-4 h-4" /> {tW('admin.widget.configTitle')}
        </button>
        <button onClick={() => setActiveTab('embed')} className={clsx('px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2', activeTab === 'embed' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
          <Code2 className="w-4 h-4" /> {tW('admin.widget.embedCode')}
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800">{tW('admin.widget.configTitle')}</h3>
          </div>
          <div className="p-6 space-y-6">
            {/* Bot Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.botName')}</label>
                <input type="text" value={config.botName} onChange={(e) => updateConfig({ botName: e.target.value })} disabled={isReadOnly} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50" placeholder="MADA AI" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.defaultLanguage')}</label>
                <select value={config.defaultLanguage} onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })} disabled={isReadOnly} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white">
                  <option value="vi">Tiếng Việt 🇻🇳</option>
                  <option value="en">English 🇺🇸</option>
                  <option value="ar">العربية 🇸🇦</option>
                  <option value="fr">Français 🇫🇷</option>
                </select>
              </div>
            </div>

            {/* Primary Color */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.primaryColor')}</label>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl border border-gray-200 shadow-inner" style={{ backgroundColor: config.primaryColor }} />
                <input type="text" value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} disabled={isReadOnly} className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50" placeholder="#0891b2" />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((preset) => (
                    <button key={preset.color} onClick={() => !isReadOnly && updateConfig({ primaryColor: preset.color })} className={clsx('w-8 h-8 rounded-lg transition-all hover:scale-110', config.primaryColor === preset.color && 'ring-2 ring-violet-500 ring-offset-2')} style={{ backgroundColor: preset.color }} title={preset.name} />
                  ))}
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.welcomeMessage')}</label>
              <input type="text" value={config.welcomeTitle} onChange={(e) => updateConfig({ welcomeTitle: e.target.value })} disabled={isReadOnly} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50" placeholder="Xin chào! Mình là MADA AI." />
            </div>

            {/* Position & Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.position')}</label>
                <select value={config.position} onChange={(e) => !isReadOnly && updateConfig({ position: e.target.value as any })} disabled={isReadOnly} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white">
                  <option value="bottom-right">{tW('admin.widget.positionBottomRight')}</option>
                  <option value="bottom-left">{tW('admin.widget.positionBottomLeft')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.widgetStyle')}</label>
                <select value={config.widgetType} onChange={(e) => !isReadOnly && updateConfig({ widgetType: e.target.value as any })} disabled={isReadOnly} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white">
                  <option value="popup">{tW('admin.widget.widgetPopup')}</option>
                  <option value="embedded">{tW('admin.widget.widgetEmbedded')}</option>
                  <option value="floating">{tW('admin.widget.widgetFloating')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.chatButton')}</label>
                <div className="flex gap-2">
                  <button onClick={() => !isReadOnly && updateConfig({ chatBubbleEnabled: !config.chatBubbleEnabled })} className={clsx('flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all border', config.chatBubbleEnabled ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100')}>
                    {config.chatBubbleEnabled ? tW('admin.widget.enabled') : tW('admin.widget.disabled')}
                  </button>
                  {config.chatBubbleEnabled && (
                    <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
                      {['💬', '✨', '👤', '➕'].map((icon) => (
                        <button key={icon} onClick={() => !isReadOnly && updateConfig({ chatBubbleIcon: icon })} className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all', config.chatBubbleIcon === icon ? 'bg-violet-500 text-white' : 'hover:bg-gray-200')}>{icon}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Label Settings */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{tW('admin.widget.chatLabel')}</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{tW('admin.widget.showLabel')}</span>
                  <Toggle enabled={config.showLabel} onChange={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })} disabled={isReadOnly} />
                </div>
                {config.showLabel && (
                  <>
                    <input type="text" value={config.labelName} onChange={(e) => updateConfig({ labelName: e.target.value })} disabled={isReadOnly} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50" placeholder="Chat với MADA" />
                    <select value={config.labelPosition} onChange={(e) => !isReadOnly && updateConfig({ labelPosition: e.target.value as any })} disabled={isReadOnly} className="px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white">
                      <option value="bottom">{tW('admin.widget.below')}</option>
                      <option value="top">{tW('admin.widget.above')}</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">{tW('admin.widget.features')}</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">{tW('admin.widget.allowFileUpload')}</span>
                  <Toggle enabled={config.allowFileUpload} onChange={() => !isReadOnly && updateConfig({ allowFileUpload: !config.allowFileUpload })} disabled={isReadOnly} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">{tW('admin.widget.allowLanguageSwitch')}</span>
                  <Toggle enabled={config.allowLanguageSwitch} onChange={() => !isReadOnly && updateConfig({ allowLanguageSwitch: !config.allowLanguageSwitch })} disabled={isReadOnly} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">{tW('admin.widget.allowFaq')}</span>
                  <Toggle enabled={config.allowFaq} onChange={() => !isReadOnly && updateConfig({ allowFaq: !config.allowFaq })} disabled={isReadOnly} />
                </div>
              </div>
            </div>

            {/* Suggested Questions - Inline */}
            <SuggestedQuestionsInline isReadOnly={isReadOnly} />
          </div>
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => handleCopy(iframeCode, 'iframe')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center"><Code className="w-5 h-5 text-white" /></div>
                <div><span className="text-sm font-semibold">{tW('admin.widget.iframe')}</span><p className="text-xs text-slate-400">{tW('admin.widget.pasteIframe')}</p></div>
              </div>
              <button className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'iframe' ? <><CheckCircle className="w-4 h-4" /> {tW('admin.widget.copied')}</> : <><Copy className="w-4 h-4" /> {tW('admin.widget.copy')}</>}
              </button>
            </div>

            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => handleCopy(scriptCode, 'script')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><Code className="w-5 h-5 text-white" /></div>
                <div><span className="text-sm font-semibold">{tW('admin.widget.javascript')}</span><p className="text-xs text-slate-400">{tW('admin.widget.pasteScript')}</p></div>
              </div>
              <button className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'script' ? <><CheckCircle className="w-4 h-4" /> {tW('admin.widget.copied')}</> : <><Copy className="w-4 h-4" /> {tW('admin.widget.copy')}</>}
              </button>
            </div>

            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border border-gray-700 hover:border-green-500/50 transition-all cursor-pointer" onClick={() => handleCopy(publicLink, 'public')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center"><Globe className="w-5 h-5 text-white" /></div>
                <div><span className="text-sm font-semibold">{tW('admin.widget.publicLink')}</span><p className="text-xs text-slate-400">{tW('admin.widget.shareDirect')}</p></div>
              </div>
              <button className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'public' ? <><CheckCircle className="w-4 h-4" /> {tW('admin.widget.copied')}</> : <><Copy className="w-4 h-4" /> {tW('admin.widget.copy')}</>}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-gray-700">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-slate-400 font-mono">{tW('admin.widget.scriptCode')}</span>
            </div>
            <pre className="p-3 rounded-lg bg-slate-800 text-amber-300 text-xs font-mono overflow-x-auto max-h-48"><code>{scriptCode}</code></pre>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a href={publicLink} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-violet-600">
              <Globe className="w-4 h-4" /> {tW('admin.widget.openWidget')}
            </a>
            <button onClick={() => setShowLivePreview(true)} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-amber-600">
              <Eye className="w-4 h-4" /> {tW('admin.widget.preview')}
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {saveError}
        </div>
      )}

      {isReadOnly && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {tW('admin.widget.noPermission')}
        </div>
      )}
    </div>
  );
}

// ============== SUGGESTED QUESTIONS INLINE COMPONENT ==============
function SuggestedQuestionsInline({ isReadOnly }: { isReadOnly: boolean }) {
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: 'general' as ATCategory,
    view_mode: 'end_user' as ViewMode,
    language: 'vi' as LanguageType,
    question: '',
    sort_order: 0,
    is_active: true,
  });

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getSuggestedQuestions({});
      if (res.success && res.data) {
        setQuestions(res.data.slice(0, 10)); // Show max 10 in inline
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const resetForm = () => {
    setFormData({
      category: 'general',
      view_mode: 'end_user',
      language: 'vi',
      question: '',
      sort_order: 0,
      is_active: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formData.question.trim()) {
      alert('Vui lòng nhập câu hỏi');
      return;
    }

    try {
      if (editingId) {
        await adminApi.updateSuggestedQuestion(editingId, formData);
      } else {
        await adminApi.createSuggestedQuestion(formData);
      }
      setShowForm(false);
      resetForm();
      loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (q: SuggestedQuestion) => {
    setFormData({
      category: q.category,
      view_mode: q.view_mode,
      language: q.language,
      question: q.question,
      sort_order: q.sort_order,
      is_active: q.is_active === 1,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    try {
      await adminApi.deleteSuggestedQuestion(id);
      loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (q: SuggestedQuestion) => {
    try {
      await adminApi.updateSuggestedQuestion(q.id, { is_active: q.is_active !== 1 });
      loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getCategoryLabel = (cat: string) => SQ_CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getCategoryIcon = (cat: string) => SQ_CATEGORIES.find(c => c.value === cat)?.icon || '📦';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-cyan-600" />
          <span className="font-bold text-gray-800">Câu hỏi gợi ý</span>
          <span className="text-xs text-gray-500">({questions.length} câu)</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Quick Add Form */}
          {showForm ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-gray-800">{editingId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ATCategory }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  {SQ_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as LanguageType }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  {SQ_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  placeholder="Thứ tự"
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sq_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label 
                    htmlFor="sq_active" 
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000]',
                      formData.is_active 
                        ? 'bg-green-500 text-white translate-y-[-1px] hover:bg-green-600' 
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {formData.is_active ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    {formData.is_active ? 'Hoạt động' : 'Tắt'}
                  </label>
                </div>
              </div>
              <textarea
                value={formData.question}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Nhập câu hỏi gợi ý..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600"
                >
                  {editingId ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                disabled={isReadOnly}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Thêm câu hỏi
              </button>
              <button
                onClick={loadQuestions}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
              >
                ↻ Làm mới
              </button>
            </div>
          )}

          {/* Questions List */}
          {loading ? (
            <div className="text-center py-4 text-gray-500">Đang tải...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-4 text-gray-400">Chưa có câu hỏi gợi ý nào</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {questions.map((q) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">{getCategoryIcon(q.category)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500">{getCategoryLabel(q.category)}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[10px] text-gray-500">{SQ_LANGUAGES.find(l => l.value === q.language)?.flag} {SQ_LANGUAGES.find(l => l.value === q.language)?.label}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', q.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500')}>
                        {q.is_active === 1 ? '✓' : '✕'}
                      </span>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleActive(q)}
                        className="w-7 h-7 rounded hover:bg-gray-200 flex items-center justify-center"
                        title={q.is_active === 1 ? 'Tắt' : 'Bật'}
                      >
                        {q.is_active === 1 ? '🔴' : '⚪'}
                      </button>
                      <button
                        onClick={() => handleEdit(q)}
                        className="w-7 h-7 rounded hover:bg-gray-200 flex items-center justify-center"
                        title="Sửa"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="w-7 h-7 rounded hover:bg-red-100 flex items-center justify-center"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
