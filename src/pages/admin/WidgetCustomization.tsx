import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore, useLanguageStore, useAuthStore } from '@/stores';
import clsx from 'clsx';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Globe, X,
  Send, Bot as BotIcon, Eye, Settings, Code2, ArrowLeft,
  ChevronDown
} from 'lucide-react';

// Widget translations
const tW = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'admin.widget.saveFailed': 'Lưu thất bại',
      'admin.widget.loading': 'Đang tải cấu hình...',
      'admin.widget.backHome': 'Quay về trang chủ',
      'admin.widget.configTitle': 'Cấu hình Widget',
      'admin.widget.embedTitle': 'Mã nhúng & Tích hợp',
      'admin.widget.configDesc': 'Tùy chỉnh giao diện, nhận diện thương hiệu và hành vi tương tác của chatbot trên website',
      'admin.widget.hidePreview': 'Ẩn preview',
      'admin.widget.viewPreview': 'Xem preview',
      'admin.widget.saving': 'Đang lưu...',
      'admin.widget.saved': 'Đã lưu!',
      'admin.widget.save': 'Lưu thay đổi',
      'admin.widget.liveMode': 'Live Mode',
      'admin.widget.brandSection': 'Nhận diện Thương hiệu & Lời chào',
      'admin.widget.brandSectionDesc': 'Tùy biến tên bot, màu sắc chủ đạo và thông điệp chào mừng',
      'admin.widget.positionSection': 'Vị trí & Kiểu hiển thị',
      'admin.widget.positionSectionDesc': 'Tùy biến tọa độ neo widget và nút kích hoạt nổi trên màn hình',
      'admin.widget.featuresSection': 'Tính năng Tương tác',
      'admin.widget.featuresSectionDesc': 'Bật/tắt các công cụ hỗ trợ người dùng cuối trên khung chat',
      'admin.widget.botName': 'Tên Bot',
      'admin.widget.defaultLanguage': 'Ngôn ngữ mặc định',
      'admin.widget.primaryColor': 'Màu chủ đạo (Primary Color)',
      'admin.widget.welcomeMessage': 'Tin nhắn chào mừng',
      'admin.widget.position': 'Vị trí hiển thị',
      'admin.widget.positionBottomRight': 'Dưới phải (Bottom Right)',
      'admin.widget.positionBottomLeft': 'Dưới trái (Bottom Left)',
      'admin.widget.widgetType': 'Kiểu Widget',
      'admin.widget.widgetPopup': 'Popup nổi (Floating Popup)',
      'admin.widget.widgetFullPage': 'Toàn màn hình (Full Page modal)',
      'admin.widget.widgetDrawer': 'Thanh kéo bên (Drawer Sidebar)',
      'admin.widget.chatButton': 'Nút Chat (Launcher Icon & State)',
      'admin.widget.enabled': 'Đang Bật',
      'admin.widget.disabled': 'Tắt',
      'admin.widget.chatLabel': 'Nhãn Chat (Label Pill)',
      'admin.widget.showLabel': 'Hiện nhãn',
      'admin.widget.labelLeft': 'Bên trái',
      'admin.widget.labelBottom': 'Bên dưới',
      'admin.widget.labelTop': 'Bên trên',
      'admin.widget.allowFileUpload': 'Cho phép đính kèm file',
      'admin.widget.allowFileUploadDesc': 'Khách hàng có thể tải lên ảnh chụp màn hình, hóa đơn hoặc file PDF (tối đa 25MB)',
      'admin.widget.allowLanguageSwitch': 'Cho phép đổi ngôn ngữ',
      'admin.widget.allowLanguageSwitchDesc': 'Hiển thị menu chọn ngôn ngữ ngay trong tiêu đề cửa sổ chat',
      'admin.widget.allowFaq': 'Gợi ý FAQ nhanh (Quick Prompts)',
      'admin.widget.allowFaqDesc': 'Tự động hiển thị 3-4 câu hỏi phổ biến giúp người dùng bắt đầu nhanh',
      'admin.widget.livePreview': 'Khung xem trước trực tiếp (Live Preview)',
      'admin.widget.realtime': 'Thời gian thực',
      'admin.widget.today': 'Hôm nay',
      'admin.widget.online': 'Trực tuyến',
      'admin.widget.poweredBy': 'Cung cấp bởi',
      'admin.widget.typeMessage': 'Nhập câu hỏi cho MADA AI...',
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
      'admin.widget.section': 'Phần',
      'admin.widget.aiReady': 'Trợ lý AI sẵn sàng hỗ trợ',
    },
    en: {
      'admin.widget.saveFailed': 'Save failed',
      'admin.widget.loading': 'Loading configuration...',
      'admin.widget.backHome': 'Back to home',
      'admin.widget.configTitle': 'Widget Configuration',
      'admin.widget.embedTitle': 'Embed Code & Integration',
      'admin.widget.configDesc': 'Customize appearance, branding, and interaction behavior of the chatbot on your website',
      'admin.widget.hidePreview': 'Hide preview',
      'admin.widget.viewPreview': 'View preview',
      'admin.widget.saving': 'Saving...',
      'admin.widget.saved': 'Saved!',
      'admin.widget.save': 'Save changes',
      'admin.widget.liveMode': 'Live Mode',
      'admin.widget.brandSection': 'Brand Identity & Welcome',
      'admin.widget.brandSectionDesc': 'Customize bot name, primary color, and welcome message',
      'admin.widget.positionSection': 'Position & Display',
      'admin.widget.positionSectionDesc': 'Customize widget anchor coordinates and floating trigger button',
      'admin.widget.featuresSection': 'Interactive Features',
      'admin.widget.featuresSectionDesc': 'Enable/disable user support tools on the chat widget',
      'admin.widget.botName': 'Bot Name',
      'admin.widget.defaultLanguage': 'Default Language',
      'admin.widget.primaryColor': 'Primary Color',
      'admin.widget.welcomeMessage': 'Welcome Message',
      'admin.widget.position': 'Display Position',
      'admin.widget.positionBottomRight': 'Bottom Right',
      'admin.widget.positionBottomLeft': 'Bottom Left',
      'admin.widget.widgetType': 'Widget Type',
      'admin.widget.widgetPopup': 'Floating Popup',
      'admin.widget.widgetFullPage': 'Full Page Modal',
      'admin.widget.widgetDrawer': 'Drawer Sidebar',
      'admin.widget.chatButton': 'Chat Button (Launcher Icon & State)',
      'admin.widget.enabled': 'Enabled',
      'admin.widget.disabled': 'Disabled',
      'admin.widget.chatLabel': 'Chat Label',
      'admin.widget.showLabel': 'Show Label',
      'admin.widget.labelLeft': 'Left',
      'admin.widget.labelBottom': 'Bottom',
      'admin.widget.labelTop': 'Top',
      'admin.widget.allowFileUpload': 'Allow file attachments',
      'admin.widget.allowFileUploadDesc': 'Customers can upload screenshots, invoices, or PDF files (max 25MB)',
      'admin.widget.allowLanguageSwitch': 'Allow language switch',
      'admin.widget.allowLanguageSwitchDesc': 'Show language selector in the chat window header',
      'admin.widget.allowFaq': 'Quick FAQ Prompts',
      'admin.widget.allowFaqDesc': 'Auto-display 3-4 common questions to help users get started quickly',
      'admin.widget.livePreview': 'Live Preview',
      'admin.widget.realtime': 'Real-time',
      'admin.widget.today': 'Today',
      'admin.widget.online': 'Online',
      'admin.widget.poweredBy': 'Powered by',
      'admin.widget.typeMessage': 'Type a message to MADA AI...',
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
      'admin.widget.section': 'Section',
      'admin.widget.aiReady': 'AI Assistant ready to help',
    },
    ar: {
      'admin.widget.saveFailed': 'فشل الحفظ',
      'admin.widget.loading': 'جاري تحميل التكوين...',
      'admin.widget.backHome': 'العودة للرئيسية',
      'admin.widget.configTitle': 'تكوين الأداة',
      'admin.widget.embedTitle': 'كود التضمين والتكامل',
      'admin.widget.configDesc': 'تخصيص المظهر والعلامة التجارية وسلوك التفاعل للدردشة الآلية على موقعك',
      'admin.widget.hidePreview': 'إخفاء المعاينة',
      'admin.widget.viewPreview': 'عرض المعاينة',
      'admin.widget.saving': 'جاري الحفظ...',
      'admin.widget.saved': 'تم الحفظ!',
      'admin.widget.save': 'حفظ التغييرات',
      'admin.widget.liveMode': 'الوضع المباشر',
      'admin.widget.brandSection': 'هوية العلامة التجارية والترحيب',
      'admin.widget.brandSectionDesc': 'تخصيص اسم البوت واللون الأساسي ورسالة الترحيب',
      'admin.widget.positionSection': 'الموضع والعرض',
      'admin.widget.positionSectionDesc': 'تخصيص إحداثيات إرساء الأداة وزر التفعيل العائم',
      'admin.widget.featuresSection': 'ميزات التفاعل',
      'admin.widget.featuresSectionDesc': 'تفعيل/إلغاء أدوات دعم المستخدم في窗口 المحادثة',
      'admin.widget.botName': 'اسم البوت',
      'admin.widget.defaultLanguage': 'اللغة الافتراضية',
      'admin.widget.primaryColor': 'اللون الأساسي',
      'admin.widget.welcomeMessage': 'رسالة الترحيب',
      'admin.widget.position': 'موضع العرض',
      'admin.widget.positionBottomRight': 'أسفل اليمين',
      'admin.widget.positionBottomLeft': 'أسفل اليسار',
      'admin.widget.widgetType': 'نوع الأداة',
      'admin.widget.widgetPopup': 'نافذة منبثقة عائمة',
      'admin.widget.widgetFullPage': 'نافذة ملء الشاشة',
      'admin.widget.widgetDrawer': 'شريط جانبي',
      'admin.widget.chatButton': 'زر المحادثة',
      'admin.widget.enabled': 'مفعل',
      'admin.widget.disabled': 'معطل',
      'admin.widget.chatLabel': 'تسمية المحادثة',
      'admin.widget.showLabel': 'إظهار التسمية',
      'admin.widget.labelLeft': 'يسار',
      'admin.widget.labelBottom': 'أسفل',
      'admin.widget.labelTop': 'أعلى',
      'admin.widget.allowFileUpload': 'السماح بإرفاق الملفات',
      'admin.widget.allowFileUploadDesc': 'يمكن للعملاء تحميل لقطات الشاشة والفواتير وملفات PDF (25 ميجابايت كحد أقصى)',
      'admin.widget.allowLanguageSwitch': 'السماح بتغيير اللغة',
      'admin.widget.allowLanguageSwitchDesc': 'إظهار منتقي اللغة في رأس نافذة المحادثة',
      'admin.widget.allowFaq': 'مطالبات الأسئلة الشائعة السريعة',
      'admin.widget.allowFaqDesc': 'عرض تلقائي لـ 3-4 أسئلة شائعة لمساعدة المستخدمين على البدء بسرعة',
      'admin.widget.livePreview': 'معاينة مباشرة',
      'admin.widget.realtime': 'الوقت الفعلي',
      'admin.widget.today': 'اليوم',
      'admin.widget.online': 'متصل',
      'admin.widget.poweredBy': 'مقدم من',
      'admin.widget.typeMessage': 'اكتب رسالة لـ MADA AI...',
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
      'admin.widget.section': 'القسم',
      'admin.widget.aiReady': 'المساعد الذكي جاهز للمساعدة',
    },
    fr: {
      'admin.widget.saveFailed': 'Échec de la sauvegarde',
      'admin.widget.loading': 'Chargement de la configuration...',
      'admin.widget.backHome': 'Retour à l\'accueil',
      'admin.widget.configTitle': 'Configuration du Widget',
      'admin.widget.embedTitle': 'Code d\'intégration',
      'admin.widget.configDesc': 'Personnalisez l\'apparence, l\'image de marque et le comportement d\'interaction du chatbot',
      'admin.widget.hidePreview': 'Masquer l\'aperçu',
      'admin.widget.viewPreview': 'Voir l\'aperçu',
      'admin.widget.saving': 'Sauvegarde...',
      'admin.widget.saved': 'Sauvegardé!',
      'admin.widget.save': 'Enregistrer les modifications',
      'admin.widget.liveMode': 'Mode Direct',
      'admin.widget.brandSection': 'Identité de marque et accueil',
      'admin.widget.brandSectionDesc': 'Personnalisez le nom du bot, la couleur principale et le message de bienvenue',
      'admin.widget.positionSection': 'Position et affichage',
      'admin.widget.positionSectionDesc': 'Personnalisez les coordonnées d\'ancrage et le bouton d\'activation flottant',
      'admin.widget.featuresSection': 'Fonctionnalités interactives',
      'admin.widget.featuresSectionDesc': 'Activez/désactivez les outils d\'assistance utilisateur sur le widget de chat',
      'admin.widget.botName': 'Nom du Bot',
      'admin.widget.defaultLanguage': 'Langue par défaut',
      'admin.widget.primaryColor': 'Couleur principale',
      'admin.widget.welcomeMessage': 'Message de bienvenue',
      'admin.widget.position': 'Position d\'affichage',
      'admin.widget.positionBottomRight': 'Bas droite',
      'admin.widget.positionBottomLeft': 'Bas gauche',
      'admin.widget.widgetType': 'Type de Widget',
      'admin.widget.widgetPopup': 'Popup flottant',
      'admin.widget.widgetFullPage': 'Page complète',
      'admin.widget.widgetDrawer': 'Barre latérale',
      'admin.widget.chatButton': 'Bouton de chat',
      'admin.widget.enabled': 'Activé',
      'admin.widget.disabled': 'Désactivé',
      'admin.widget.chatLabel': 'Étiquette du chat',
      'admin.widget.showLabel': 'Afficher l\'étiquette',
      'admin.widget.labelLeft': 'Gauche',
      'admin.widget.labelBottom': 'Bas',
      'admin.widget.labelTop': 'Haut',
      'admin.widget.allowFileUpload': 'Autoriser les pièces jointes',
      'admin.widget.allowFileUploadDesc': 'Les clients peuvent télécharger des captures d\'écran, factures ou fichiers PDF (max 25 Mo)',
      'admin.widget.allowLanguageSwitch': 'Autoriser le changement de langue',
      'admin.widget.allowLanguageSwitchDesc': 'Afficher le sélecteur de langue dans l\'en-tête de la fenêtre de chat',
      'admin.widget.allowFaq': 'Questions FAQ rapides',
      'admin.widget.allowFaqDesc': 'Afficher automatiquement 3-4 questions courantes pour aider les utilisateurs à démarrer',
      'admin.widget.livePreview': 'Aperçu en direct',
      'admin.widget.realtime': 'Temps réel',
      'admin.widget.today': 'Aujourd\'hui',
      'admin.widget.online': 'En ligne',
      'admin.widget.poweredBy': 'Fourni par',
      'admin.widget.typeMessage': 'Tapez un message pour MADA AI...',
      'admin.widget.iframe': 'iFrame',
      'admin.widget.pasteIframe': 'Coller dans HTML',
      'admin.widget.javascript': 'JavaScript',
      'admin.widget.pasteScript': 'Coller dans le site',
      'admin.widget.publicLink': 'Lien public',
      'admin.widget.shareDirect': 'Partager directement',
      'admin.widget.copied': 'Copié!',
      'admin.widget.copy': 'Copier',
      'admin.widget.scriptCode': 'Code Script',
      'admin.widget.openWidget': 'Ouvrir le Widget',
      'admin.widget.preview': 'Aperçu',
      'admin.widget.noPermission': 'Vous n\'avez pas la permission de modifier cette configuration.',
      'admin.widget.section': 'Section',
      'admin.widget.aiReady': 'Assistant IA prêt à aider',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

// Color presets
const PRESET_COLORS = [
  { color: '#0891b2', name: 'Cyan', label: 'Cyan' },
  { color: '#8b5cf6', name: 'Violet', label: 'Tím Violet' },
  { color: '#10b981', name: 'Emerald', label: 'Xanh Ngọc' },
  { color: '#f59e0b', name: 'Amber', label: 'Cam Hổ Phách' },
  { color: '#ef4444', name: 'Red', label: 'Đỏ San Hô' },
  { color: '#3b82f6', name: 'Blue', label: 'Xanh Biển' },
  { color: '#ec4899', name: 'Pink', label: 'Hồng Magenta' },
  { color: '#6366f1', name: 'Indigo', label: 'Indigo' },
];

// Launcher icons
const LAUNCHER_ICONS = [
  { id: 'chat', title: 'Bong bóng chat', svg: 'chat' },
  { id: 'sparkles', title: 'Ánh sao AI', svg: 'sparkles' },
  { id: 'bot', title: 'Robot Agent', svg: 'bot' },
  { id: 'plus', title: 'Dấu cộng', svg: 'plus' },
];

// SVG icons for launcher
function LauncherIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  switch (type) {
    case 'chat':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
        </svg>
      );
    case 'bot':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect height="10" rx="2" width="18" x="3" y="11" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" x2="8.01" y1="16" y2="16" />
          <line x1="16" x2="16.01" y1="16" y2="16" />
        </svg>
      );
    case 'plus':
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
  }
}

// Migration: map old emoji values to new icon IDs
function normalizeLauncherIcon(value: string): string {
  if (!value) return 'chat';
  const valid = ['chat', 'sparkles', 'bot', 'plus'];
  if (valid.includes(value)) return value;
  // Map old emoji values to new icons
  if (value === '💬' || value.includes('💬')) return 'chat';
  if (value === '✨' || value.includes('✨')) return 'sparkles';
  if (value === '👤' || value === '🤖' || value.includes('🤖')) return 'bot';
  if (value === '➕' || value.includes('➕')) return 'plus';
  return 'chat';
}

interface WidgetCustomizationProps {
  language?: 'vi' | 'en' | 'ar' | 'fr';
  userRole?: 'admin' | 'superadmin' | 'super_admin' | 'user';
}

// Toggle component - matching the exact HTML sample provided
function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex items-center cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input 
        checked={enabled} 
        onChange={onChange} 
        disabled={disabled}
        className="sr-only peer" 
        type="checkbox"
      />
      <div 
        onClick={() => !disabled && onChange()}
        className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:bg-emerald-500"
      />
    </label>
  );
}

// Enhanced Live Preview Component with Mock Browser
function LiveWidgetPreview({ config, initialChatOpen = false, onClose }: { config: any; initialChatOpen?: boolean; onClose: () => void }) {
  const [isChatOpen, setIsChatOpen] = useState(initialChatOpen);
  
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
    return config.welcomeTitle || 'Xin chào! Mình là MADA AI.';
  };

  const getBotName = () => {
    switch (config.defaultLanguage) {
      case 'en': return config.botNameEn || config.botName || 'MADA AI';
      case 'ar': return config.botNameAr || config.botName || 'MADA AI';
      case 'fr': return config.botNameFr || config.botName || 'MADA AI';
      default: return config.botName || 'MADA AI';
    }
  };

  const getLanguageFlag = () => {
    switch (config.defaultLanguage) {
      case 'en': return '🇺🇸 EN';
      case 'ar': return '🇸🇦 AR';
      case 'fr': return '🇫🇷 FR';
      default: return '🇻🇳 VN';
    }
  };

  const positionClass = config.position === 'bottom-left' ? 'left-4' : 'right-4';
  const launcherPositionClass = config.position === 'bottom-left' ? 'justify-start' : 'justify-end';

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[99] cursor-pointer" onClick={onClose} />
      
      {/* Mock Browser Window */}
      <div className={`fixed ${positionClass} bottom-4 z-[100] w-80`}>
        {/* Chat Window */}
        {isChatOpen && (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden mb-3 animate-in slide-in-from-bottom-2 duration-200">
            {/* Chat Header */}
            <div 
              className="p-4 text-white"
              style={{ background: `linear-gradient(to right, ${config.primaryColor}, ${adjustColor(config.primaryColor, -20)})` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                    <BotIcon className="w-6 h-6 text-white" />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">{getBotName()}</span>
                      <svg className="w-3.5 h-3.5 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-white/80">{tW('admin.widget.aiReady')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {config.allowLanguageSwitch && (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-white/15 text-white mr-1">{getLanguageFlag()}</span>
                  )}
                  <button 
                    onClick={() => setIsChatOpen(false)} 
                    className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="p-4 space-y-3.5 bg-slate-50/60 max-h-[200px] overflow-y-auto">
              <div className="text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-100">
                  {tW('admin.widget.today')}
                </span>
              </div>
              
              {/* Bot Message */}
              <div className="flex items-start gap-2.5">
                <div 
                  className="w-7 h-7 rounded-lg text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {getBotName().charAt(0)}
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm p-3 shadow-xs text-xs text-slate-700 leading-relaxed max-w-[85%]">
                  {getWelcomeMessage()}
                  <span className="block text-[10px] text-slate-400 text-right mt-1.5 font-medium">11:50</span>
                </div>
              </div>

              {/* Quick Prompts */}
              {config.allowFaq && (
                <div className="pl-9 space-y-1.5">
                  <button className="block w-full text-left text-xs bg-white hover:bg-cyan-50/70 text-cyan-800 font-medium px-3 py-1.5 rounded-lg border border-cyan-100 shadow-2xs transition-colors">
                    💡 {config.defaultLanguage === 'en' ? 'API Integration Guide' : config.defaultLanguage === 'ar' ? 'دليل تكامل API' : config.defaultLanguage === 'fr' ? "Guide d'intégration API" : 'Hướng dẫn tích hợp API'}
                  </button>
                  <button className="block w-full text-left text-xs bg-white hover:bg-cyan-50/70 text-cyan-800 font-medium px-3 py-1.5 rounded-lg border border-cyan-100 shadow-2xs transition-colors">
                    📊 {config.defaultLanguage === 'en' ? 'Pricing & Service Policy' : config.defaultLanguage === 'ar' ? 'التسعير وسياسة الخدمة' : config.defaultLanguage === 'fr' ? 'Tarification et politique' : 'Bảng giá và chính sách dịch vụ'}
                  </button>
                </div>
              )}
            </div>

            {/* Chat Footer */}
            <div className="p-3 bg-white border-t border-slate-100">
              <div className="relative flex items-center">
                {config.allowFileUpload && (
                  <button className="p-2 text-slate-400 hover:text-cyan-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                )}
                <input 
                  type="text" 
                  placeholder={tW('admin.widget.typeMessage')}
                  className="block w-full border-none py-2 px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-0"
                  readOnly 
                />
                <button 
                  className="p-2 rounded-xl text-white hover:opacity-90 shadow-sm transition-transform active:scale-95 shrink-0"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <Send className="w-4 h-4 transform rotate-90" fill="currentColor" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-2">
                <span>{tW('admin.widget.poweredBy')} <span className="font-semibold text-slate-600">{getBotName()}</span></span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {tW('admin.widget.online')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Launcher & Label */}
        <div className={clsx('flex items-center gap-3', launcherPositionClass)}>
          {/* Label Pill */}
          {config.showLabel && (
            <div 
              className="bg-white/95 backdrop-blur-sm border border-slate-200/90 text-slate-800 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
              style={{ order: config.labelPosition === 'top' ? -1 : 1 }}
            >
              <span>{config.labelName || 'Chat với MADA'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          )}
          
          {/* Launcher Button */}
          {config.chatBubbleEnabled && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={clsx(
                'w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg ring-4 ring-white transition-transform hover:scale-105 active:scale-95',
                isChatOpen ? 'ring-0 opacity-70' : ''
              )}
              style={{ background: `linear-gradient(to right, ${config.primaryColor}, ${adjustColor(config.primaryColor, 20)})` }}
            >
              {isChatOpen ? (
                <X className="w-7 h-7" />
              ) : (
                <LauncherIcon type={config.chatBubbleIcon || 'chat'} className="w-7 h-7" />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// Helper function to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

export function WidgetCustomization({ userRole: propUserRole }: Omit<WidgetCustomizationProps, 'language'>) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { config, isLoading, loadConfig, updateConfig, saveConfig, resetConfig } = useWidgetSettingsStore();
  
  // Get role from auth store, fallback to prop for backwards compatibility
  const userRole = user?.role || propUserRole || 'admin';
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'embed'>('config');
  const [iframeCode, setIframeCode] = useState('');
  const [scriptCode, setScriptCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewChatOpen, setPreviewChatOpen] = useState(false);
  const [initialConfig, setInitialConfig] = useState<typeof config | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => { 
    loadConfig(); 
  }, [loadConfig]);

  // Track initial config for dirty state
  useEffect(() => {
    if (!isLoading && config && !initialConfig) {
      setInitialConfig({ ...config });
    }
  }, [isLoading, config, initialConfig]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = initialConfig && JSON.stringify(config) !== JSON.stringify(initialConfig);

  // Normalize launcher icon on mount and when config changes
  useEffect(() => {
    if (config.chatBubbleIcon && !['chat', 'sparkles', 'bot', 'plus'].includes(config.chatBubbleIcon)) {
      updateConfig({ chatBubbleIcon: normalizeLauncherIcon(config.chatBubbleIcon) });
    }
  }, [config.chatBubbleIcon]);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const embedParams = `botName=${encodeURIComponent(config.botName)}&primaryColor=${encodeURIComponent(config.primaryColor)}&position=${config.position}&lang=${config.defaultLanguage}&widgetType=${config.widgetType}&chatBubbleEnabled=${config.chatBubbleEnabled}&chatBubbleIcon=${encodeURIComponent(config.chatBubbleIcon)}&showLabel=${config.showLabel}&labelPosition=${config.labelPosition}&labelName=${encodeURIComponent(config.labelName)}&labelColor=${encodeURIComponent(config.labelColor)}&allowFaq=${config.allowFaq}`;

    setIframeCode(`<iframe src="${baseUrl}/embed?${embedParams}" width="380" height="600" style="border:none;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15);" title="${config.botName}"></iframe>`);
    setScriptCode(`<script src="${baseUrl}/embed/widget.js"></script>\n<script>\n  MadaWidget.init({\n    botName: '${config.botName}',\n    primaryColor: '${config.primaryColor}',\n    position: '${config.position}',\n    defaultLanguage: '${config.defaultLanguage}',\n    widgetType: '${config.widgetType}',\n    chatBubbleEnabled: ${config.chatBubbleEnabled},\n    chatBubbleIcon: '${config.chatBubbleIcon}',\n    showLabel: ${config.showLabel},\n    labelPosition: '${config.labelPosition}',\n    labelName: '${config.labelName}',\n    labelColor: '${config.labelColor}',\n    allowFaq: ${config.allowFaq}\n  });\n</script>`);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveConfig();
      setSaveSuccess(true);
      setInitialConfig({ ...config }); // Update initial config after save
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || tW('admin.widget.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetConfig();
    setInitialConfig(null); // Reset tracking
    loadConfig(); // Reload from backend
    setShowResetConfirm(false);
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
    <div className="min-h-full">
      {showLivePreview && <LiveWidgetPreview config={config} initialChatOpen={previewChatOpen} onClose={() => { setShowLivePreview(false); setPreviewChatOpen(false); }} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-cyan-50 via-sky-50 to-cyan-50/50 border-b border-cyan-200/50 shadow-[0_4px_24px_-8px_rgba(6,182,212,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Back button & Title */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/admin')} 
                className="p-2.5 rounded-xl border border-slate-200/90 bg-white text-slate-600 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50/50 shadow-sm transition-all group"
                title={tW('admin.widget.backHome')}
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
              </button>
              
              {/* Bot Avatar */}
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-400 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-100">
                <BotIcon className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                </span>
              </div>

              {/* Page Heading */}
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-700 to-sky-600 bg-clip-text text-transparent tracking-tight">{tW('admin.widget.configTitle')}</h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">{tW('admin.widget.liveMode')}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{tW('admin.widget.configDesc')}</p>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Chưa lưu</span>
                </div>
              )}
              
              <button 
                onClick={() => { setShowLivePreview(true); setPreviewChatOpen(true); }} 
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/90 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Xem preview</span>
              </button>
              
              {/* Reset button */}
              {!isReadOnly && (
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  disabled={saving || !hasUnsavedChanges}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/90 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Khôi phục cấu hình mặc định"
                >
                  <Settings className="w-4 h-4" />
                  <span>Đặt lại</span>
                </button>
              )}
              
              {/* Reset confirmation modal */}
              {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">Xác nhận đặt lại?</h3>
                        <p className="text-sm text-slate-500">Tất cả thay đổi sẽ bị mất.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Hủy
                      </button>
                      <button 
                        onClick={handleReset}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
                      >
                        Đặt lại
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {!isReadOnly && (
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-cyan-700 text-white text-sm font-semibold shadow-lg shadow-cyan-600/25 hover:shadow-cyan-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {tW('admin.widget.saving')}</>
                  ) : saveSuccess ? (
                    <><CheckCircle className="w-4 h-4" /> {tW('admin.widget.saved')}</>
                  ) : (
                    <><Settings className="w-4 h-4" /> {tW('admin.widget.save')}</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-8 border-t border-slate-100">
            <button 
              onClick={() => setActiveTab('config')}
              className={clsx(
                'flex items-center gap-2 py-3.5 px-1 border-b-2 text-sm font-medium transition-all',
                activeTab === 'config' 
                  ? 'border-cyan-600 text-cyan-700' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )}
            >
              <Settings className="w-4 h-4" />
              <span>{tW('admin.widget.configTitle')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('embed')}
              className={clsx(
                'flex items-center gap-2 py-3.5 px-1 border-b-2 text-sm font-medium transition-all',
                activeTab === 'embed' 
                  ? 'border-cyan-600 text-cyan-700' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )}
            >
              <Code2 className="w-4 h-4" />
              <span>{tW('admin.widget.embedTitle')}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Configuration Panels */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Tab: Cấu hình Widget */}
            {activeTab === 'config' && (
            <>
            
            {/* Section 1: Brand Identity & Welcome */}
            <section className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),0_0_1px_1px_rgba(15,23,42,0.04)] p-6 sm:p-7 space-y-6 transition-all hover:border-cyan-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-cyan-100 text-cyan-600 ring-2 ring-cyan-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-cyan-700">{tW('admin.widget.brandSection')}</h2>
                    <p className="text-xs text-slate-500">{tW('admin.widget.brandSectionDesc')}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">{tW('admin.widget.section')} 1/3</span>
              </div>

              {/* Bot Name & Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.botName')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={config.botName}
                      onChange={(e) => updateConfig({ botName: e.target.value })}
                      disabled={isReadOnly}
                      className="block w-full rounded-xl border-slate-200 py-3 pl-4 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all disabled:bg-slate-50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center p-1 rounded-full bg-cyan-50 text-cyan-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.defaultLanguage')}</label>
                  <div className="relative">
                    <select
                      value={config.defaultLanguage}
                      onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })}
                      disabled={isReadOnly}
                      className="block w-full appearance-none rounded-xl border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all disabled:bg-slate-50"
                    >
                      <option value="vi">Tiếng Việt 🇻🇳</option>
                      <option value="en">English 🇺🇸</option>
                      <option value="ar">العربية 🇸🇦</option>
                      <option value="fr">Français 🇫🇷</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.primaryColor')}</label>
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs">
                    <span 
                      className="w-6 h-6 rounded-full ring-2 ring-offset-2 shadow-sm" 
                      style={{ backgroundColor: config.primaryColor, '--tw-ring-color': config.primaryColor + '40' } as any}
                    />
                    <input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                      disabled={isReadOnly}
                      className="w-20 border-none p-0 text-xs font-mono font-bold text-slate-800 focus:ring-0 bg-transparent"
                    />
                  </div>
                  <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => !isReadOnly && updateConfig({ primaryColor: preset.color })}
                        disabled={isReadOnly}
                        className={clsx(
                          'w-7 h-7 rounded-full transition-all hover:scale-110',
                          config.primaryColor === preset.color && 'ring-2 ring-offset-2 scale-110'
                        )}
                        style={{ 
                          backgroundColor: preset.color,
                          ...(config.primaryColor === preset.color && { 
                            '--tw-ring-color': preset.color 
                          } as any)
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Welcome Message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">{tW('admin.widget.welcomeMessage')}</label>
                  <span className="text-xs text-slate-400 font-medium">Tối đa 250 ký tự</span>
                </div>
                <textarea
                  value={config.welcomeTitle}
                  onChange={(e) => updateConfig({ welcomeTitle: e.target.value })}
                  disabled={isReadOnly}
                  rows={3}
                  maxLength={250}
                  className="block w-full rounded-xl border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 leading-relaxed transition-all disabled:bg-slate-50 resize-none px-4 py-3"
                  placeholder="Xin chào! Mình là MADA AI..."
                />
              </div>
            </section>

            {/* Section 2: Position & Display */}
            <section className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),0_0_1px_1px_rgba(15,23,42,0.04)] p-6 sm:p-7 space-y-6 transition-all hover:border-cyan-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-sky-100 text-sky-600 ring-2 ring-sky-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-sky-700">{tW('admin.widget.positionSection')}</h2>
                    <p className="text-xs text-slate-500">{tW('admin.widget.positionSectionDesc')}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-200">{tW('admin.widget.section')} 2/3</span>
              </div>

              {/* Position & Widget Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.position')}</label>
                  <div className="relative">
                    <select
                      value={config.position}
                      onChange={(e) => !isReadOnly && updateConfig({ position: e.target.value as any })}
                      disabled={isReadOnly}
                      className="block w-full appearance-none rounded-xl border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all disabled:bg-slate-50"
                    >
                      <option value="bottom-right">{tW('admin.widget.positionBottomRight')}</option>
                      <option value="bottom-left">{tW('admin.widget.positionBottomLeft')}</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.widgetType')}</label>
                  <div className="relative">
                    <select
                      value={config.widgetType}
                      onChange={(e) => !isReadOnly && updateConfig({ widgetType: e.target.value as any })}
                      disabled={isReadOnly}
                      className="block w-full appearance-none rounded-xl border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all disabled:bg-slate-50"
                    >
                      <option value="popup">{tW('admin.widget.widgetPopup')}</option>
                      <option value="floating">{tW('admin.widget.widgetFullPage')}</option>
                      <option value="embedded">{tW('admin.widget.widgetDrawer')}</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Button Launcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.chatButton')}</label>
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                  {/* State Toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => !isReadOnly && updateConfig({ chatBubbleEnabled: !config.chatBubbleEnabled })}
                      disabled={isReadOnly}
                      className={clsx(
                        'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-colors',
                        config.chatBubbleEnabled 
                          ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600' 
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      )}
                    >
                      <span className={clsx('w-2 h-2 rounded-full bg-white animate-pulse', !config.chatBubbleEnabled && 'animate-none opacity-50')} />
                      <span>{config.chatBubbleEnabled ? tW('admin.widget.enabled') : tW('admin.widget.disabled')}</span>
                    </button>
                    <span className="text-xs text-slate-500">Kích hoạt nút nổi</span>
                  </div>

                  {/* Icon Selector */}
                  {config.chatBubbleEnabled && (
                    <div className="flex items-center gap-2">
                      {LAUNCHER_ICONS.map((icon) => (
                        <button
                          key={icon.id}
                          onClick={() => !isReadOnly && updateConfig({ chatBubbleIcon: icon.svg })}
                          disabled={isReadOnly}
                          className={clsx(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                            config.chatBubbleIcon === icon.svg
                              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-2 ring-offset-2 ring-cyan-500'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          )}
                          title={icon.title}
                        >
                          <LauncherIcon type={icon.svg} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Label */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{tW('admin.widget.chatLabel')}</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
                    <span className="text-xs font-semibold text-slate-700">{tW('admin.widget.showLabel')}</span>
                    <Toggle 
                      enabled={config.showLabel} 
                      onChange={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })}
                      disabled={isReadOnly}
                    />
                  </div>
                  <input
                    type="text"
                    value={config.labelName}
                    onChange={(e) => updateConfig({ labelName: e.target.value })}
                    disabled={isReadOnly || !config.showLabel}
                    className="block w-full rounded-xl border-slate-200 py-2.5 px-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                    placeholder="Chat với MADA"
                  />
                  <div className="relative shrink-0 sm:w-36">
                    <select
                      value={config.labelPosition}
                      onChange={(e) => !isReadOnly && updateConfig({ labelPosition: e.target.value as any })}
                      disabled={isReadOnly || !config.showLabel}
                      className="block w-full appearance-none rounded-xl border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-800 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                    >
                      <option value="left">{tW('admin.widget.labelLeft')}</option>
                      <option value="bottom">{tW('admin.widget.labelBottom')}</option>
                      <option value="top">{tW('admin.widget.labelTop')}</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Interactive Features */}
            <section className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),0_0_1px_1px_rgba(15,23,42,0.04)] p-6 sm:p-7 space-y-5 transition-all hover:border-cyan-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-emerald-700">{tW('admin.widget.featuresSection')}</h2>
                    <p className="text-xs text-slate-500">{tW('admin.widget.featuresSectionDesc')}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">{tW('admin.widget.section')} 3/3</span>
              </div>

              {/* Feature Items */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <span className="text-sm font-bold text-slate-800">{tW('admin.widget.allowFileUpload')}</span>
                  <p className="text-xs text-slate-500">{tW('admin.widget.allowFileUploadDesc')}</p>
                </div>
                <Toggle 
                  enabled={config.allowFileUpload} 
                  onChange={() => !isReadOnly && updateConfig({ allowFileUpload: !config.allowFileUpload })}
                  disabled={isReadOnly}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <span className="text-sm font-bold text-slate-800">{tW('admin.widget.allowLanguageSwitch')}</span>
                  <p className="text-xs text-slate-500">{tW('admin.widget.allowLanguageSwitchDesc')}</p>
                </div>
                <Toggle 
                  enabled={config.allowLanguageSwitch} 
                  onChange={() => !isReadOnly && updateConfig({ allowLanguageSwitch: !config.allowLanguageSwitch })}
                  disabled={isReadOnly}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <span className="text-sm font-bold text-slate-800">{tW('admin.widget.allowFaq')}</span>
                  <p className="text-xs text-slate-500">{tW('admin.widget.allowFaqDesc')}</p>
                </div>
                <Toggle 
                  enabled={config.allowFaq} 
                  onChange={() => !isReadOnly && updateConfig({ allowFaq: !config.allowFaq })}
                  disabled={isReadOnly}
                />
              </div>
            </section>
            </>
            )}

            {/* Tab: Mã nhúng & Tích hợp */}
            {activeTab === 'embed' && (
            <div className="space-y-6">
              {/* Embed Section */}
              <section className="bg-gradient-to-br from-violet-50/70 via-white to-violet-50/40 rounded-2xl border border-violet-200/60 shadow-[0_20px_40px_-15px_rgba(139,92,246,0.08),0_0_1px_1px_rgba(139,92,246,0.06)] p-6 sm:p-7 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-violet-100/60">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-violet-100 text-violet-600 ring-2 ring-violet-200">
                      <Code2 className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-violet-700">{tW('admin.widget.embedTitle')}</h2>
                      <p className="text-xs text-slate-500">{tW('admin.widget.configDesc')}</p>
                    </div>
                  </div>
                </div>

                {/* iFrame Code */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{tW('admin.widget.iframe')}</label>
                    <button
                      onClick={() => handleCopy(iframeCode, 'iframe')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                    >
                      {copiedCode === 'iframe' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode === 'iframe' ? tW('admin.widget.copied') : tW('admin.widget.copy')}
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="p-4 bg-slate-900 rounded-xl text-xs text-slate-100 overflow-x-auto font-mono leading-relaxed">
                      <code>{iframeCode}</code>
                    </pre>
                  </div>
                </div>

                {/* JavaScript Code */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{tW('admin.widget.javascript')}</label>
                    <button
                      onClick={() => handleCopy(scriptCode, 'script')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                    >
                      {copiedCode === 'script' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode === 'script' ? tW('admin.widget.copied') : tW('admin.widget.copy')}
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="p-4 bg-slate-900 rounded-xl text-xs text-slate-100 overflow-x-auto font-mono leading-relaxed">
                      <code>{scriptCode}</code>
                    </pre>
                  </div>
                </div>

                {/* Public Link */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{tW('admin.widget.publicLink')}</label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate flex-1">{window.location.origin}/embed?botId={config.botName || 'default'}</span>
                    <button
                      onClick={() => handleCopy(`${window.location.origin}/embed?botId=${config.botName || 'default'}`, 'link')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors shrink-0"
                    >
                      {copiedCode === 'link' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </section>
            </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{tW('admin.widget.livePreview')}</span>
              </div>
              <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200/50">{tW('admin.widget.realtime')}</span>
            </div>

            {/* Mock Browser Container */}
            <div className="relative w-full rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-2xl p-4 sm:p-6 overflow-hidden min-h-[640px] flex flex-col justify-end">
              {/* Mock Website Header */}
              <div className="absolute top-0 left-0 right-0 p-4 border-b border-slate-100/80 bg-white/70 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/80 inline-block" />
                  <span className="ml-2 text-xs font-mono text-slate-400">your-website.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-2 bg-slate-200 rounded-full" />
                  <div className="w-10 h-2 bg-slate-200 rounded-full" />
                </div>
              </div>

              {/* Dummy page content */}
              <div className="absolute top-20 left-6 right-6 space-y-3 opacity-40 pointer-events-none">
                <div className="h-4 bg-slate-300 rounded-lg w-1/3" />
                <div className="h-3 bg-slate-200 rounded-lg w-3/4" />
                <div className="h-3 bg-slate-200 rounded-lg w-1/2" />
                <div className="grid grid-cols-3 gap-3 pt-3">
                  <div className="h-16 bg-slate-100 rounded-xl border border-slate-200/60" />
                  <div className="h-16 bg-slate-100 rounded-xl border border-slate-200/60" />
                  <div className="h-16 bg-slate-100 rounded-xl border border-slate-200/60" />
                </div>
              </div>

              {/* Chat Window Preview */}
              <div className={clsx(
                'relative w-full max-w-sm bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(8,145,178,0.2),0_0_0_1px_rgba(226,232,240,0.8)] border border-slate-200/90 overflow-hidden flex flex-col z-20 transition-all duration-300',
                config.position === 'bottom-left' ? 'mr-auto' : 'ml-auto'
              )}>
                {/* Chat Header */}
                <div 
                  className="p-4 text-white"
                  style={{ background: `linear-gradient(to right, ${config.primaryColor}, ${adjustColor(config.primaryColor, -10)})` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20">
                        <BotIcon className="w-6 h-6 text-white" />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{config.botName || 'MADA AI'}</span>
                          <svg className="w-3.5 h-3.5 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                          </svg>
                        </div>
                        <p className="text-[11px] text-white/80">{tW('admin.widget.aiReady')}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {config.allowLanguageSwitch && (
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-white/15 text-white mr-1">🇻🇳 VN</span>
                      )}
                      <button className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </button>
                      <button className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="p-4 space-y-3.5 bg-slate-50/60 max-h-[300px] overflow-y-auto">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-100 shadow-2xs">{tW('admin.widget.today')}</span>
                  </div>

                  {/* Bot Message */}
                  <div className="flex items-start gap-2.5">
                    <div 
                      className="w-7 h-7 rounded-lg text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 shadow-sm"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {(config.botName || 'M').charAt(0)}
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm p-3 shadow-xs text-xs text-slate-700 leading-relaxed max-w-[85%]">
                      {config.welcomeTitle || 'Xin chào! Mình là MADA AI. Mình có thể hỗ trợ giải đáp thắc mắc cho bạn.'}
                      <span className="block text-[10px] text-slate-400 text-right mt-1.5 font-medium">11:50</span>
                    </div>
                  </div>

                  {/* Quick Prompts */}
                  {config.allowFaq && (
                    <div className="pl-9 space-y-1.5">
                      <button className="block w-full text-left text-xs bg-white hover:bg-cyan-50/70 text-cyan-800 font-medium px-3 py-1.5 rounded-lg border border-cyan-100 shadow-2xs transition-colors">
                        💡 Hướng dẫn tích hợp API
                      </button>
                      <button className="block w-full text-left text-xs bg-white hover:bg-cyan-50/70 text-cyan-800 font-medium px-3 py-1.5 rounded-lg border border-cyan-100 shadow-2xs transition-colors">
                        📊 Bảng giá và chính sách dịch vụ
                      </button>
                    </div>
                  )}
                </div>

                {/* Chat Footer */}
                <div className="p-3 bg-white border-t border-slate-100">
                  <div className="relative flex items-center">
                    {config.allowFileUpload && (
                      <button className="p-2 text-slate-400 hover:text-cyan-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </button>
                    )}
                    <input
                      type="text"
                      placeholder={tW('admin.widget.typeMessage')}
                      className="block w-full border-none py-2 px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-0 bg-transparent"
                      readOnly
                    />
                    <button
                      className="p-2 rounded-xl text-white hover:opacity-90 shadow-sm transition-transform active:scale-95 shrink-0"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <Send className="w-4 h-4 transform rotate-90" fill="currentColor" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-2">
                    <span>{tW('admin.widget.poweredBy')} <span className="font-semibold text-slate-600">{config.botName || 'MADA AI'}</span></span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {tW('admin.widget.online')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Launcher Preview */}
              <div className={clsx(
                'flex items-center gap-3 mt-4 z-20',
                config.position === 'bottom-left' ? 'justify-start' : 'justify-end'
              )}>
                {config.showLabel && (
                  <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 text-slate-800 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <span>{config.labelName || 'Chat với MADA'}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                )}
                {config.chatBubbleEnabled && (
                  <div
                    className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg ring-4 ring-white"
                    style={{ background: `linear-gradient(to right, ${config.primaryColor}, ${adjustColor(config.primaryColor, 20)})`, boxShadow: `0 10px 25px -5px ${config.primaryColor}40` }}
                  >
                    <LauncherIcon type={config.chatBubbleIcon || 'chat'} className="w-7 h-7" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Error & Permission Messages */}
      {saveError && (
        <div className="fixed bottom-4 right-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 shadow-lg flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-2 hover:bg-red-100 rounded-lg p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="fixed bottom-4 left-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 shadow-lg flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{tW('admin.widget.noPermission')}</span>
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
