import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore } from '@/stores';
import clsx from 'clsx';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Code, Globe, X,
  Send, Bot as BotIcon, Eye, EyeOff, Settings, Code2, ArrowLeft,
  MessageSquare, LayoutGrid, Layers, Sparkles
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

      {/* Hero Banner Section - Match AdminOverview style */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative gap-4 flex-wrap">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-5 px-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center hover:bg-gray-50 transition-colors shadow-[2px_2px_0px_0px_#000]"
                title="Quay về trang chủ"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-[3px_3px_0px_0px_#000] border-2 border-black">
                <BotIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-on-surface">
                  {lang.title}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {lang.subtitle}
                </p>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="relative z-10 py-5 px-5 flex items-center gap-3">
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_0px_#000]',
                showLivePreview
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                  : 'bg-white text-black hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000]'
              )}
            >
              {showLivePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showLivePreview ? 'Ẩn Preview' : 'Xem Preview'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white text-sm font-bold border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 disabled:opacity-50 hover:-translate-x-[1px] hover:-translate-y-[1px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 
                    <span>{lang.saving}</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> 
                    <span>{lang.saved}</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    <span>{lang.save}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs - Horizontal Navigation */}
      <div className="inline-flex gap-1 bg-white rounded-xl border-2 border-black p-0.5 shadow-[2px_2px_0px_0px_#000]">
        <button
          onClick={() => setActiveTab('config')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-2',
            activeTab === 'config'
              ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{lang.tabs.config}</span>
        </button>
        <button
          onClick={() => setActiveTab('embed')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-2',
            activeTab === 'embed'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{lang.tabs.embed}</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bot Settings */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2 text-gray-900 uppercase tracking-wider">
                <BotIcon className="w-4 h-4 text-violet-500" />
                Cấu hình Bot
              </h4>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{lang.config.botName}</label>
                <input
                  type="text"
                  value={config.botName}
                  onChange={(e) => updateConfig({ botName: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 font-medium"
                  placeholder="MADA AI"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{lang.config.welcomeTitle}</label>
                <textarea
                  value={config.welcomeTitle}
                  onChange={(e) => updateConfig({ welcomeTitle: e.target.value })}
                  disabled={isReadOnly}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 resize-none font-medium"
                  placeholder="Xin chào! Mình là MADA AI..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Ngôn ngữ mặc định</label>
                <select
                  value={config.defaultLanguage}
                  onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })}
                  disabled={isReadOnly}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 bg-white font-medium"
                >
                  <option value="vi">Tiếng Việt 🇻🇳</option>
                  <option value="en">English 🇺🇸</option>
                  <option value="ar">العربية 🇸🇦</option>
                  <option value="fr">Français 🇫🇷</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 border-2 border-black">
                  <span className="text-sm font-bold text-gray-900">{lang.config.allowFile}</span>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ allowFileUpload: !config.allowFileUpload })}
                    className={clsx(
                      'relative w-12 h-7 rounded-full transition-colors flex-shrink-0 border-2 border-black',
                      config.allowFileUpload ? 'bg-emerald-500' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        config.allowFileUpload ? 'left-[22px]' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 border-2 border-black">
                  <span className="text-sm font-bold text-gray-900">{lang.config.allowLangSwitch}</span>
                  <button
                    onClick={() => !isReadOnly && updateConfig({ allowLanguageSwitch: !config.allowLanguageSwitch })}
                    className={clsx(
                      'relative w-12 h-7 rounded-full transition-colors flex-shrink-0',
                      config.allowLanguageSwitch ? 'bg-emerald-500' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        config.allowLanguageSwitch ? 'left-[22px]' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2 text-gray-900 uppercase tracking-wider">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: config.primaryColor }} />
                Giao diện
              </h4>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{lang.config.primaryColor}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    className="w-12 h-10 rounded-lg cursor-pointer border-2 border-black"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    className="flex-1 px-4 py-2.5 rounded-lg border-2 border-black text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">{lang.config.presets}</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => !isReadOnly && updateConfig({ primaryColor: preset.color })}
                      className={`w-9 h-9 rounded-lg transition-all hover:scale-110 border-2 border-black ${
                        config.primaryColor === preset.color ? 'ring-2 ring-offset-2 ring-violet-500' : ''
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">{lang.config.position}</label>
                <div className="flex gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      onClick={() => !isReadOnly && updateConfig({ position: pos.value as any })}
                      className={clsx(
                        'flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all border-2 border-black',
                        config.position === pos.value
                          ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Type */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">{lang.config.widgetType}</label>
                <div className="grid grid-cols-3 gap-2">
                  {WIDGET_TYPES.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => !isReadOnly && updateConfig({ widgetType: type.value as any })}
                        className={clsx(
                          'flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-xs font-bold transition-all border-2 border-black',
                          config.widgetType === type.value
                            ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
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
            <div className="space-y-4 md:col-span-2">
              <h4 className="font-bold text-sm flex items-center gap-2 text-gray-900 uppercase tracking-wider">
                <MessageSquare className="w-4 h-4 text-violet-500" />
                {lang.config.chatBubble}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chat Bubble Settings */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border-2 border-black shadow-sm">
                  {/* Chat Bubble Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">{lang.config.chatBubble}</span>
                    <button
                      onClick={() => !isReadOnly && updateConfig({ chatBubbleEnabled: !config.chatBubbleEnabled })}
                      className={clsx(
                        'relative w-12 h-7 rounded-full transition-colors border-2 border-black',
                        config.chatBubbleEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          config.chatBubbleEnabled ? 'left-[22px]' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {/* Bubble Icon */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">{lang.config.bubbleIcon}</label>
                    <div className="flex flex-wrap gap-2">
                      {BUBBLE_ICONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => !isReadOnly && updateConfig({ chatBubbleIcon: icon })}
                          className={clsx(
                            'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-2 border-black',
                            config.chatBubbleIcon === icon
                              ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                              : 'bg-white hover:bg-gray-100'
                          )}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Label Settings */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border-2 border-black shadow-sm">
                  {/* Show Label Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">{lang.config.showLabel}</span>
                    <button
                      onClick={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })}
                      className={clsx(
                        'relative w-12 h-7 rounded-full transition-colors border-2 border-black',
                        config.showLabel ? 'bg-emerald-500' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          config.showLabel ? 'left-[22px]' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {config.showLabel && (
                    <>
                      {/* Label Name */}
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">{lang.config.labelName}</label>
                        <input
                          type="text"
                          value={config.labelName}
                          onChange={(e) => updateConfig({ labelName: e.target.value })}
                          disabled={isReadOnly}
                          className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 font-medium"
                          placeholder="Chat với MADA"
                        />
                      </div>

                      {/* Label Position */}
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2">{lang.config.labelPosition}</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => !isReadOnly && updateConfig({ labelPosition: 'bottom' as any })}
                            className={clsx(
                              'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border-2 border-black',
                              config.labelPosition === 'bottom'
                                ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            )}
                          >
                            Dưới
                          </button>
                          <button
                            onClick={() => !isReadOnly && updateConfig({ labelPosition: 'top' as any })}
                            className={clsx(
                              'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border-2 border-black',
                              config.labelPosition === 'top'
                                ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            )}
                          >
                            Trên
                          </button>
                        </div>
                      </div>

                      {/* Label Color */}
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">{lang.config.labelColor}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.labelColor}
                            onChange={(e) => updateConfig({ labelColor: e.target.value })}
                            className="w-10 h-8 rounded-lg cursor-pointer border-2 border-black"
                          />
                          <input
                            type="text"
                            value={config.labelColor}
                            onChange={(e) => updateConfig({ labelColor: e.target.value })}
                            className="flex-1 px-3 py-1.5 rounded-lg border-2 border-black text-sm font-mono font-bold"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="space-y-4">
          {/* Embed Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* iFrame */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:border-violet-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(iframeCode, 'iframe')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border border-black">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold">{lang.embed.iframeTab}</span>
                  <p className="text-xs text-slate-400">Dán mã iFrame vào website</p>
                </div>
              </div>
              <button
                className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-black"
              >
                {copiedCode === 'iframe' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {lang.embed.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {lang.embed.copy}
                  </>
                )}
              </button>
            </div>

            {/* JavaScript */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:border-amber-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(scriptCode, 'script')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center border border-black">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold">{lang.embed.scriptTab}</span>
                  <p className="text-xs text-slate-400">Dán mã JavaScript vào website</p>
                </div>
              </div>
              <button
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-black"
              >
                {copiedCode === 'script' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {lang.embed.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {lang.embed.copy}
                  </>
                )}
              </button>
            </div>

            {/* Public Link */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden group border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:border-green-500/50 transition-all cursor-pointer"
              onClick={() => handleCopy(publicLink, 'public')}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center border border-black">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold">{lang.embed.publicTab}</span>
                  <p className="text-xs text-slate-400">Chia sẻ link trực tiếp</p>
                </div>
              </div>
              <button
                className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-black"
              >
                {copiedCode === 'public' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {lang.embed.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {lang.embed.copy}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Code Preview */}
          <div className="p-4 rounded-xl bg-slate-900 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-slate-400 font-mono">Script Code</span>
            </div>
            <pre className="p-3 rounded-lg bg-slate-800 text-amber-300 text-xs font-mono overflow-x-auto max-h-48 border border-black">
              <code>{scriptCode}</code>
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white text-sm font-bold border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000]"
            >
              <Globe className="w-4 h-4" />
              <span>{lang.embed.open}</span>
            </a>
            <button
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000]"
            >
              <Eye className="w-4 h-4" />
              <span>{lang.embed.preview}</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {saveError && (
        <div className="p-3 rounded-xl bg-red-50 border-2 border-red-300 text-red-700 text-sm flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {isReadOnly && (
        <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-700 text-sm flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4" />
          Bạn không có quyền thay đổi cấu hình Widget. Liên hệ Super Admin.
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
