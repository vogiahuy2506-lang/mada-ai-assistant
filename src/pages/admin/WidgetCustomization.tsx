import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore } from '@/stores';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Code, Globe, X,
  Send, Bot as BotIcon, Eye, EyeOff, Settings, Code2, ArrowLeft,
  MessageSquare, LayoutGrid, Layers
} from 'lucide-react';

const POSITIONS = [
  { value: 'bottom-right', label: 'Dưới phải' },
  { value: 'bottom-left', label: 'Dưới trái' },
];

const WIDGET_TYPES = [
  { value: 'popup', label: 'Popup', icon: MessageSquare, description: 'Mở khi click nút bong bóng' },
  { value: 'embedded', label: 'Embedded', icon: LayoutGrid, description: 'Nhúng trực tiếp vào trang' },
  { value: 'floating', label: 'Floating', icon: Layers, description: 'Hiện cố định trên trang' },
];

const BUBBLE_ICONS = ['💬', '🤖', '💭', '✨', '👋', '💡', '🎯', '🔮'];

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

interface WidgetCustomizationProps {
  language?: 'vi' | 'en' | 'ar' | 'fr';
  userRole?: 'admin' | 'superadmin' | 'super_admin' | 'user';
}

// Mini Live Preview Widget
function MiniWidgetPreview({ config, onClose }: { config: any; onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages] = useState([
    { id: '1', role: 'bot', content: config.welcomeTitle || 'Xin chào! Mình là MADA AI.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping] = useState(false);

  const getBotName = () => {
    switch (config.defaultLanguage) {
      case 'en': return config.botNameEn || config.botName || 'MADA AI';
      case 'ar': return config.botNameAr || config.botName || 'MADA AI';
      case 'fr': return config.botNameFr || config.botName || 'MADA AI';
      default: return config.botName || 'MADA AI';
    }
  };

  return (
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
            className="w-7 h-7 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
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
              placeholder="Nhập tin nhắn..."
              className="flex-1 px-3 py-1.5 rounded-lg border text-xs"
            />
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: config.primaryColor || '#0891b2' }}
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
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
      setSaveError(e.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Check both 'superadmin' (DB) and 'super_admin' (code) for backward compatibility
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin';
  const isReadOnly = !isSuperAdmin && userRole !== 'admin';

  const t = {
    vi: {
      title: 'Chat Widget',
      subtitle: 'Cấu hình và triển khai chatbot lên website',
      tabs: { config: 'Cấu hình', embed: 'Mã nhúng' },
      config: {
        botName: 'Tên Chatbot',
        welcomeTitle: 'Lời chào mặc định',
        primaryColor: 'Màu chủ đạo',
        position: 'Vị trí',
        allowFile: 'Đính kèm file',
        allowLangSwitch: 'Đổi ngôn ngữ',
        presets: 'Màu có sẵn',
        widgetType: 'Kiểu Widget',
        chatBubble: 'Nút bong bóng chat',
        bubbleIcon: 'Icon bong bóng',
        label: 'Nhãn',
        showLabel: 'Hiện nhãn',
        labelPosition: 'Vị trí nhãn',
        labelName: 'Tên nhãn',
        labelColor: 'Màu nhãn',
      },
      embed: {
        title: 'Mã nhúng',
        iframeTab: 'iFrame',
        scriptTab: 'JavaScript',
        publicTab: 'Link công khai',
        copy: 'Sao chép',
        copied: 'Đã sao chép!',
        open: 'Mở Widget',
        preview: 'Xem trước',
      },
      save: 'Lưu',
      saving: 'Đang lưu...',
      saved: 'Đã lưu!',
      preview: 'Preview',
    },
    en: {
      title: 'Chat Widget',
      subtitle: 'Configure and deploy chatbot on your website',
      tabs: { config: 'Config', embed: 'Embed' },
      config: { 
        botName: 'Bot Name', 
        welcomeTitle: 'Welcome Message', 
        primaryColor: 'Color', 
        position: 'Position', 
        allowFile: 'File Upload', 
        allowLangSwitch: 'Language Switch', 
        presets: 'Presets',
        widgetType: 'Widget Type',
        chatBubble: 'Chat Bubble Button',
        bubbleIcon: 'Bubble Icon',
        label: 'Label',
        showLabel: 'Show Label',
        labelPosition: 'Label Position',
        labelName: 'Label Name',
        labelColor: 'Label Color',
      },
      embed: { title: 'Embed Code', iframeTab: 'iFrame', scriptTab: 'JavaScript', publicTab: 'Public Link', copy: 'Copy', copied: 'Copied!', open: 'Open', preview: 'Preview' },
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved!',
      preview: 'Preview',
    },
    ar: {
      title: 'أداة المحادثة',
      subtitle: 'تكوين ونشر الشات بوت',
      tabs: { config: 'التكوين', embed: 'كود التضمين' },
      config: { 
        botName: 'الاسم', 
        welcomeTitle: 'رسالة الترحيب', 
        primaryColor: 'اللون', 
        position: 'الموضع', 
        allowFile: 'المرفقات', 
        allowLangSwitch: 'اللغة', 
        presets: 'الألوان',
        widgetType: 'نوع الأداة',
        chatBubble: 'زر الفقاعة',
        bubbleIcon: 'أيقونة الفقاعة',
        label: 'التسمية',
        showLabel: 'إظهار التسمية',
        labelPosition: 'موضع التسمية',
        labelName: 'اسم التسمية',
        labelColor: 'لون التسمية',
      },
      embed: { title: 'كود التضمين', iframeTab: 'iFrame', scriptTab: 'JavaScript', publicTab: 'الرابط', copy: 'نسخ', copied: 'تم!', open: 'فتح', preview: 'معاينة' },
      save: 'حفظ',
      saving: 'جارٍ...',
      saved: 'تم!',
      preview: 'معاينة',
    },
    fr: {
      title: 'Widget Chat',
      subtitle: 'Configurer et déployer le chatbot',
      tabs: { config: 'Config', embed: 'Intégration' },
      config: { 
        botName: 'Nom', 
        welcomeTitle: 'Message', 
        primaryColor: 'Couleur', 
        position: 'Position', 
        allowFile: 'Fichiers', 
        allowLangSwitch: 'Langue', 
        presets: 'Couleurs',
        widgetType: 'Type',
        chatBubble: 'Bulle',
        bubbleIcon: 'Icône',
        label: 'Étiquette',
        showLabel: 'Afficher',
        labelPosition: 'Position',
        labelName: 'Nom',
        labelColor: 'Couleur',
      },
      embed: { title: "Code", iframeTab: 'iFrame', scriptTab: 'JavaScript', publicTab: 'Lien', copy: 'Copier', copied: 'OK!', open: 'Ouvrir', preview: 'Aperçu' },
      save: 'OK',
      saving: '...',
      saved: 'OK!',
      preview: 'Aperçu',
    },
  };

  const lang = t[language] || t.vi;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        <span className="ml-2 text-slate-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live Preview Widget */}
      {showLivePreview && (
        <MiniWidgetPreview config={config} onClose={() => setShowLivePreview(false)} />
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 p-6 text-white">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Quay về trang chủ"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BotIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{lang.title}</h3>
              <p className="text-sm text-white/80 mt-1">{lang.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                showLivePreview
                  ? 'bg-white text-cyan-600 border-white'
                  : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
              }`}
            >
              {showLivePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-white text-cyan-600 text-xs font-medium hover:bg-white/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {lang.saving}</>
                ) : saveSuccess ? (
                  <><CheckCircle className="w-3.5 h-3.5" /> {lang.saved}</>
                ) : (
                  lang.save
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'config'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            {lang.tabs.config}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('embed')}
          className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'embed'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5" />
            {lang.tabs.embed}
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bot Settings */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <BotIcon className="w-4 h-4 text-cyan-600" />
                Cấu hình Bot
              </h4>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{lang.config.botName}</label>
                <input
                  type="text"
                  value={config.botName}
                  onChange={(e) => updateConfig({ botName: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:bg-gray-100"
                  placeholder="MADA AI"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{lang.config.welcomeTitle}</label>
                <textarea
                  value={config.welcomeTitle}
                  onChange={(e) => updateConfig({ welcomeTitle: e.target.value })}
                  disabled={isReadOnly}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:bg-gray-100 resize-none"
                  placeholder="Xin chào! Mình là MADA AI..."
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Ngôn ngữ mặc định</label>
                <select
                  value={config.defaultLanguage}
                  onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:bg-gray-100"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-slate-700">{lang.config.allowFile}</span>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ allowFileUpload: !config.allowFileUpload })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      config.allowFileUpload ? 'bg-cyan-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      config.allowFileUpload ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-slate-700">{lang.config.allowLangSwitch}</span>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ allowLanguageSwitch: !config.allowLanguageSwitch })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      config.allowLanguageSwitch ? 'bg-cyan-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      config.allowLanguageSwitch ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: config.primaryColor }} />
                Giao diện
              </h4>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{lang.config.primaryColor}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-2">{lang.config.presets}</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => !isReadOnly && updateConfig({ primaryColor: preset.color })}
                      className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                        config.primaryColor === preset.color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-2">{lang.config.position}</label>
                <div className="flex gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      onClick={() => !isReadOnly && updateConfig({ position: pos.value as any })}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                        config.position === pos.value
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Type */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">{lang.config.widgetType}</label>
                <div className="grid grid-cols-3 gap-2">
                  {WIDGET_TYPES.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => !isReadOnly && updateConfig({ widgetType: type.value as any })}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                          config.widgetType === type.value
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chat Bubble & Label Settings */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-600" />
                {lang.config.chatBubble}
              </h4>

              {/* Chat Bubble Toggle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                <span className="text-sm text-slate-700">{lang.config.chatBubble}</span>
                <button
                  onClick={() => !isReadOnly && updateConfig({ chatBubbleEnabled: !config.chatBubbleEnabled })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    config.chatBubbleEnabled ? 'bg-cyan-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    config.chatBubbleEnabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {/* Bubble Icon */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">{lang.config.bubbleIcon}</label>
                <div className="flex flex-wrap gap-2">
                  {BUBBLE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => !isReadOnly && updateConfig({ chatBubbleIcon: icon })}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        config.chatBubbleIcon === icon
                          ? 'ring-2 ring-cyan-500 bg-cyan-50'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label Settings */}
              <div className="pt-2 border-t border-gray-200">
                <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  {lang.config.label}
                </h4>

                {/* Show Label Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 mb-3">
                  <span className="text-sm text-slate-700">{lang.config.showLabel}</span>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      config.showLabel ? 'bg-cyan-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      config.showLabel ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {config.showLabel && (
                  <>
                    {/* Label Name */}
                    <div className="mb-3">
                      <label className="block text-xs text-slate-500 mb-1.5">{lang.config.labelName}</label>
                      <input
                        type="text"
                        value={config.labelName}
                        onChange={(e) => updateConfig({ labelName: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:bg-gray-100"
                        placeholder="Chat với MADA"
                      />
                    </div>

                    {/* Label Position */}
                    <div className="mb-3">
                      <label className="block text-xs text-slate-500 mb-2">{lang.config.labelPosition}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => !isReadOnly && updateConfig({ labelPosition: 'bottom' as any })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                            config.labelPosition === 'bottom'
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                              : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                          }`}
                        >
                          Dưới
                        </button>
                        <button
                          onClick={() => !isReadOnly && updateConfig({ labelPosition: 'top' as any })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                            config.labelPosition === 'top'
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                              : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                          }`}
                        >
                          Trên
                        </button>
                      </div>
                    </div>

                    {/* Label Color */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">{lang.config.labelColor}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={config.labelColor}
                          onChange={(e) => updateConfig({ labelColor: e.target.value })}
                          className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.labelColor}
                          onChange={(e) => updateConfig({ labelColor: e.target.value })}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="space-y-4">
          {/* Embed Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* iFrame */}
            <div className="p-4 rounded-xl bg-slate-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">{lang.embed.iframeTab}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Dán mã iFrame vào website</p>
              <button
                onClick={() => handleCopy(iframeCode, 'iframe')}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                {copiedCode === 'iframe' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'iframe' ? lang.embed.copied : lang.embed.copy}
              </button>
            </div>

            {/* JavaScript */}
            <div className="p-4 rounded-xl bg-slate-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">{lang.embed.scriptTab}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Dán mã JavaScript vào website</p>
              <button
                onClick={() => handleCopy(scriptCode, 'script')}
                className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                {copiedCode === 'script' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'script' ? lang.embed.copied : lang.embed.copy}
              </button>
            </div>

            {/* Public Link */}
            <div className="p-4 rounded-xl bg-slate-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium">{lang.embed.publicTab}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Chia sẻ link trực tiếp</p>
              <button
                onClick={() => handleCopy(publicLink, 'public')}
                className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                {copiedCode === 'public' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'public' ? lang.embed.copied : lang.embed.copy}
              </button>
            </div>
          </div>

          {/* Code Preview */}
          <div className="p-4 rounded-xl bg-slate-800">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-slate-400">Script Code</span>
            </div>
            <pre className="p-3 rounded-lg bg-slate-900 text-amber-300 text-xs font-mono overflow-x-auto max-h-48">
              <code>{scriptCode}</code>
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-700 flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang.embed.open}
            </a>
            <button
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-slate-700 text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              {lang.embed.preview}
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
          Bạn không có quyền thay đổi cấu hình Widget. Liên hệ Super Admin.
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
