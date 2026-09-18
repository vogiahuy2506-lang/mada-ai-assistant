import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetSettingsStore } from '@/stores';
import { t } from '@/lib/translations';
import clsx from 'clsx';
import {
  CheckCircle, Loader2, AlertCircle, Copy, Code, Globe, X,
  Send, Bot as BotIcon, Eye, EyeOff, Settings, Code2, ArrowLeft,
  MessageCircle, Palette, Globe2, ToggleLeft, ToggleRight,
  MessageSquare
} from 'lucide-react';

const WIDGET_TYPES = [
  { value: 'popup', label: 'Popup' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'floating', label: 'Floating' },
];

// Chat bubble icons
const BUBBLE_ICONS = [
  { icon: '💬', label: 'Chat' },
  { icon: '✨', label: 'Sparkle' },
  { icon: '👤', label: 'Person' },
  { icon: '➕', label: 'Plus' },
];

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
  const [messages, setMessages] = useState([
    { id: '1', role: 'bot', content: config.welcomeTitle || t('widget.greeting') }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Get the correct greeting based on selected language
  const getWelcomeMessage = () => {
    // Try welcomeTitle fields first (from widget settings), then fall back to translations
    if (config.defaultLanguage === 'en') {
      return config.welcomeTitleEn || config.welcomeTitle || t('widget.greeting', 'en');
    }
    if (config.defaultLanguage === 'ar') {
      return config.welcomeTitleAr || config.welcomeTitle || t('widget.greeting', 'ar');
    }
    if (config.defaultLanguage === 'fr') {
      return config.welcomeTitleFr || config.welcomeTitle || t('widget.greeting', 'fr');
    }
    return config.welcomeTitle || t('widget.greeting');
  };

  // Get the correct placeholder based on selected language
  const getPlaceholder = () => {
    if (config.defaultLanguage === 'en') {
      return t('widget.typeMessage', 'en');
    }
    if (config.defaultLanguage === 'ar') {
      return t('widget.typeMessage', 'ar');
    }
    if (config.defaultLanguage === 'fr') {
      return t('widget.typeMessage', 'fr');
    }
    return t('widget.typeMessage');
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

  const getTypingMessage = () => {
    if (config.defaultLanguage === 'en') {
      return t('widget.replying', 'en');
    }
    if (config.defaultLanguage === 'ar') {
      return t('widget.replying', 'ar');
    }
    if (config.defaultLanguage === 'fr') {
      return t('widget.replying', 'fr');
    }
    return t('widget.replying');
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
  const lang = language || 'vi';

  // Get translations based on language prop
  const tr = (key: string) => {
    // Try to get from translations first, fallback to Vietnamese
    return (t as any)(key, lang) || (t as any)(key, 'vi') || key;
  };

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
      setSaveError(e.message || tr('widget.saveFailed'));
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
        <span className="ml-2 text-slate-600">{tr('widget.loading')}</span>
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
              title={tr('widget.backHome')}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg">
              <BotIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{tr('widget.configTitle')}</h2>
              <p className="text-sm text-gray-500">{tr('widget.configDesc')}</p>
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
              {showLivePreview ? tr('widget.hidePreview') : tr('widget.viewPreview')}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-violet-600 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {tr('widget.saving')}</>
                ) : saveSuccess ? (
                  <><CheckCircle className="w-4 h-4" /> {tr('widget.saved')}</>
                ) : (
                  <><Settings className="w-4 h-4" /> {tr('widget.save')}</>
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
          {tr('widget.configTitle')}
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
          {tr('widget.embedCode')}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT COLUMN - Settings */}
          <div className="lg:col-span-2 space-y-4">
            {/* Màu sắc */}
            <CardSection title={tr('widget.primaryColor')} icon={Palette}>
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
                  <p className="text-xs font-medium text-gray-500 mb-3">{tr('widget.predefinedColors')}</p>
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

            {/* Ngôn ngữ */}
            <CardSection title={tr('widget.defaultLanguage')} icon={Globe2}>
              <select
                value={config.defaultLanguage}
                onChange={(e) => updateConfig({ defaultLanguage: e.target.value as any })}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white"
              >
                <option value="vi">Tiếng Việt 🇻🇳</option>
                <option value="en">English 🇺🇸</option>
                <option value="ar">العربية 🇸🇦</option>
                <option value="fr">Français 🇫🇷</option>
              </select>
            </CardSection>

            {/* Tính năng */}
            <CardSection title={tr('widget.features')} icon={ToggleLeft}>
              <div className="space-y-3">
                {[
                  { key: 'allowFileUpload', label: tr('widget.allowFileUpload') },
                  { key: 'allowLanguageSwitch', label: tr('widget.allowLanguageSwitch') },
                  { key: 'allowFaq', label: tr('widget.allowFaq') },
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

            {/* Vị trí & Kiểu */}
            <div className="grid grid-cols-2 gap-4">
              <CardSection title={tr('widget.position')} icon={ToggleRight}>
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
                    {tr('widget.position_bottomRight')}
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
                    {tr('widget.position_bottomLeft')}
                  </button>
                </div>
              </CardSection>

              <CardSection title={tr('widget.widgetStyle')} icon={ToggleRight}>
                <select
                  value={config.widgetType}
                  onChange={(e) => !isReadOnly && updateConfig({ widgetType: e.target.value as any })}
                  disabled={isReadOnly}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white"
                >
                  {WIDGET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </CardSection>
            </div>
          </div>

          {/* RIGHT COLUMN - Chat Bubble */}
          <div className="lg:col-span-1 space-y-4">
            <CardSection title={tr('widget.chatBubble')} icon={MessageSquare}>
              <div className="space-y-4">
                {/* Toggle */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{tr('widget.enableBubble')}</span>
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
                      <p className="text-xs font-medium text-gray-500 mb-3">{tr('widget.bubbleIcon')}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {BUBBLE_ICONS.map(({ icon, label }) => (
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
                              {label}
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

            {/* Nhãn */}
            <CardSection title={tr('widget.labels')} icon={MessageCircle}>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{tr('widget.showLabel')}</span>
                  <Toggle 
                    enabled={config.showLabel} 
                    onChange={() => !isReadOnly && updateConfig({ showLabel: !config.showLabel })}
                    disabled={isReadOnly}
                  />
                </div>

                {config.showLabel && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('widget.labelName').toUpperCase()}</label>
                      <input
                        type="text"
                        value={config.labelName}
                        onChange={(e) => updateConfig({ labelName: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
                        placeholder="Chat với MADA"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('widget.labelPosition').toUpperCase()}</label>
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
                          {tr('widget.below')}
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
                          {tr('widget.above')}
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
                  <span className="text-sm font-semibold">iFrame</span>
                  <p className="text-xs text-slate-400">{tr('widget.pasteIframe')}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'iframe' ? <><CheckCircle className="w-4 h-4" /> {tr('widget.copied')}</> : <><Copy className="w-4 h-4" /> {tr('widget.copy')}</>}
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
                  <span className="text-sm font-semibold">JavaScript</span>
                  <p className="text-xs text-slate-400">{tr('widget.pasteScript')}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'script' ? <><CheckCircle className="w-4 h-4" /> {tr('widget.copied')}</> : <><Copy className="w-4 h-4" /> {tr('widget.copy')}</>}
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
                  <span className="text-sm font-semibold">{tr('widget.publicLink')}</span>
                  <p className="text-xs text-slate-400">{tr('widget.shareDirect')}</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                {copiedCode === 'public' ? <><CheckCircle className="w-4 h-4" /> {tr('widget.copied')}</> : <><Copy className="w-4 h-4" /> {tr('widget.copy')}</>}
              </button>
            </div>
          </div>

          {/* Code Preview */}
          <div className="p-4 rounded-xl bg-slate-900 border border-gray-700">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-slate-400 font-mono">Script Code</span>
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
              {tr('widget.openWidget')}
            </a>
            <button
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium flex items-center gap-2 hover:bg-amber-600"
            >
              <Eye className="w-4 h-4" />
              {tr('widget.preview')}
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
          {tr('widget.noPermission')}
        </div>
      )}
    </div>
  );
}

export default WidgetCustomization;
