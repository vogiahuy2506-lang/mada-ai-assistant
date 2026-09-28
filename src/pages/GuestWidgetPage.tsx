import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EmbedWidget } from '@/components/widget/EmbedWidget';
import { useLanguageStore, useChatSettingsStore } from '@/stores';
import { Home, ChevronDown, ChevronUp, ExternalLink, Copy, MessageSquare, Globe2, FileText, Accessibility, Check, Languages } from 'lucide-react';
import { useTranslation } from '@/lib/translations';
import clsx from 'clsx';

// Labels cho trang Khách
const LABELS = {
  vi: {
    title: 'Chat Widget cho Khách',
    description: 'Trò chuyện với MADA AI Assistant mà không cần đăng nhập',
    copied: 'Đã sao chép!',
    copyFailed: 'Sao chép thất bại',
    language: 'Ngôn ngữ',
  },
  en: {
    title: 'Guest Chat Widget',
    description: 'Chat with MADA AI Assistant without logging in',
    copied: 'Copied!',
    copyFailed: 'Copy failed',
    language: 'Language',
  },
  ar: {
    title: 'ودجيت الدردشة للضيوف',
    description: 'الدردشة مع مساعد MADA AI دون تسجيل الدخول',
    copied: 'تم النسخ!',
    copyFailed: 'فشل النسخ',
    language: 'اللغة',
  },
  fr: {
    title: 'Widget de chat pour invités',
    description: 'Discutez avec MADA AI Assistant sans vous connecter',
    copied: 'Copié!',
    copyFailed: 'Échec de la copie',
    language: 'Langue',
  },
};

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const GUEST_FEATURES = [
  {
    icon: MessageSquare,
    bgClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    title: 'Chat Widget trực tiếp',
    desc: 'Trò chuyện với AI mà không cần đăng nhập. Phản hồi mượt mà qua cơ chế stream real-time tốc độ cao.',
  },
  {
    icon: Globe2,
    bgClass: 'bg-stone-100 text-stone-700 border-stone-200',
    title: 'Đa ngôn ngữ toàn cầu',
    desc: 'Hỗ trợ tương tác chuẩn xác bằng Tiếng Việt, Tiếng Anh, Tiếng Ả Rập, Pháp và hơn 40 ngôn ngữ phổ biến.',
  },
  {
    icon: FileText,
    bgClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    title: 'Tải lên dữ liệu & Ảnh',
    desc: 'Gửi hình ảnh và các tệp văn bản (PDF, DOCX) trực tiếp để trợ lý AI phân tích và tóm tắt ngay lập tức.',
  },
  {
    icon: Accessibility,
    bgClass: 'bg-stone-100 text-stone-800 border-stone-200',
    title: 'Trợ năng Universal (AT)',
    desc: 'Tối ưu toàn diện cho người khuyết tật, tuân thủ tiêu chuẩn quốc tế WCAG 2.2 AAA và ISO 9999.',
  },
];

export function GuestWidgetPage() {
  const [widgetExpanded, setWidgetExpanded] = useState(true);
  const [embedExpanded, setEmbedExpanded] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'success' | 'error' | null>(null);
  const { language, setLanguage } = useLanguageStore();
  const { fileAttachmentEnabled, loadFromBackend } = useChatSettingsStore();
  const { t } = useTranslation();
  const labels = LABELS[language];

  // Load chat settings on mount
  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  // Get actual domain for embed code
  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://mada.example.com';

  // Generate dynamic embed code
  const embedCode = `<script src="${currentDomain}/widget.js"></script>
<script>
  MADAWidget.init({
    position: 'bottom-right',
    primaryColor: '#D97706',
    defaultLanguage: '${language}',
    apiUrl: '${currentDomain}/api'
  });
</script>`;

  const handleCopyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopyFeedback('success');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('error');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 flex flex-col font-sans selection:bg-amber-600 selection:text-white">
      {/* ──────────────────────────  TOP NAVIGATION  ────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-stone-200/90 px-6 lg:px-12 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-stone-700 bg-white hover:bg-stone-100 hover:text-stone-900 transition-all duration-200 border border-stone-200 shadow-sm"
            >
              <Home className="w-4 h-4 text-amber-700" />
              <span>Về trang chính</span>
            </Link>
            <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-stone-200">
              <img src="/mada-logo.png" alt="MADA" className="h-9" />
            </div>
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs font-medium shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
              </span>
              <span>
                {t('widget.preview')}: <span className="font-semibold text-amber-900">{t('widget.active')}</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg shadow-sm relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 hover:text-stone-900 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{LANGUAGES.find(l => l.code === language)?.flag} {LANGUAGES.find(l => l.code === language)?.name}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showLangMenu && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code as any);
                        setShowLangMenu(false);
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition-colors flex items-center gap-2',
                        language === lang.code && 'bg-amber-50 text-amber-900 font-medium'
                      )}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ──────────────────────────  MAIN CONTENT  ────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ──────────────────────────  HEADER BANNER  ────────────────────────── */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-amber-50/70 text-amber-700 rounded-xl border border-amber-200/70 shadow-sm">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
                    {labels.title}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                    Universal AT v2.4
                  </span>
                </div>
                <p className="text-stone-500 text-sm sm:text-base mt-1">{labels.description}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center self-start md:self-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-amber-50 text-amber-900 border border-amber-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
              </span>
              Widget Đang hoạt động
            </span>
          </div>
        </section>

        {/* ──────────────────────────  WIDGET PREVIEW  ────────────────────────── */}
        <section className="bg-white rounded-2xl border border-stone-200/90 shadow-md overflow-hidden">
          <div className="px-6 py-4.5 sm:px-8 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
            <div className="flex items-center space-x-3.5">
              <div className="w-9 h-9 rounded-xl bg-stone-800 text-amber-400 flex items-center justify-center shadow-sm border border-stone-700/40">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight flex items-center gap-2">
                  Xem trước Widget
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 tracking-wider">
                    Live
                  </span>
                </h2>
                <span className="text-xs text-stone-500 font-medium">
                  Nhấn để {widgetExpanded ? 'thu gọn' : 'mở rộng'} bảng thông số kỹ thuật
                </span>
              </div>
            </div>
            <button
              onClick={() => setWidgetExpanded(!widgetExpanded)}
              aria-label="Toggle Panel"
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition duration-200"
            >
              {widgetExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {widgetExpanded && (
            <div className="p-6 sm:p-8 space-y-7">
              {/* Hero dark card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#18181b] via-[#1e293b] to-[#0f172a] text-white p-7 sm:p-8 shadow-md border border-stone-700/60">
                <div className="relative z-10 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 backdrop-blur-md border border-amber-400/25 text-xs font-semibold text-amber-300 tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    HỆ THỐNG TRỢ LÝ ĐA NĂNG MADA
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-base sm:text-lg font-medium text-stone-100 leading-relaxed">
                    <span>Widget Chat đã sẵn sàng. Nhấn vào biểu tượng</span>
                    <button className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-3 py-1 rounded-lg text-xs sm:text-sm shadow-md transition active:scale-95 border border-amber-400/30">
                      <span>💬</span>
                      <span>Chat</span>
                    </button>
                    <span>ở góc dưới bên phải màn hình để bắt đầu hội thoại.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-2 text-xs sm:text-sm">
                    {[
                      'Hỗ trợ đa ngôn ngữ',
                      'Upload file thông minh',
                      'Streaming response siêu tốc',
                      'Markdown & Khả năng tiếp cận WCAG',
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-stone-700 text-stone-200 font-medium"
                      >
                        <Check className="w-4 h-4 text-amber-400" strokeWidth={2.5} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
              </div>

              {/* Configuration grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Cấu hình hiện tại
                    </h3>
                  </div>
                  <span className="text-xs text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md font-medium border border-stone-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    Đồng bộ tự động
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm hover:border-amber-300 transition-all duration-150">
                    <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                      Màu chính
                    </span>
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-md bg-[#D97706] border border-amber-300 shadow-sm shrink-0"></span>
                      <span className="font-mono text-sm font-bold text-stone-800">#D97706</span>
                      <span className="text-[10px] uppercase font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        TITANIUM AMBER
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm hover:border-amber-300 transition-all duration-150">
                    <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                      Ngôn ngữ
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                        🇻🇳 {language.toUpperCase()}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 font-semibold rounded bg-stone-100 text-stone-600 border border-stone-200">
                        Mặc định
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm hover:border-amber-300 transition-all duration-150">
                    <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                      Upload file
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-stone-800">
                        {fileAttachmentEnabled ? 'Bật sẵn sàng' : 'Đã tắt'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          fileAttachmentEnabled
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            fileAttachmentEnabled ? 'bg-amber-600' : 'bg-stone-400'
                          }`}
                        ></span>
                        {fileAttachmentEnabled ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm hover:border-amber-300 transition-all duration-150">
                    <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                      Domain kết nối
                    </span>
                    <div className="truncate">
                      <code className="text-xs font-mono font-medium text-stone-700 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200 block truncate">
                        {currentDomain}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ──────────────────────────  GUEST FEATURES  ────────────────────────── */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🚀</span>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Tính năng dành cho Khách
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {GUEST_FEATURES.map((f) => (
              <article
                key={f.title}
                className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:border-amber-300 hover:shadow-md transition-all duration-200"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border ${f.bgClass}`}
                >
                  <f.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-1.5">{f.title}</h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ──────────────────────────  EMBED CODE  ────────────────────────── */}
        <section className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
          <div
            className="flex items-center justify-between p-6 sm:p-8 cursor-pointer hover:bg-stone-50/50 transition-colors"
            onClick={() => setEmbedExpanded(!embedExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-stone-800 text-amber-400 flex items-center justify-center shadow-sm border border-stone-700/40">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                  Mã nhúng cho Website
                </h2>
                <span className="text-xs text-stone-500 font-medium">
                  Sao chép và dán vào website của bạn
                </span>
              </div>
            </div>
            <button className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition duration-200">
              {embedExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          {embedExpanded && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 border-t border-stone-200 pt-6">
              <div className="bg-stone-900 rounded-xl p-4 overflow-x-auto border border-stone-700/60">
                <pre className="text-sm text-amber-300 font-mono whitespace-pre-wrap">{embedCode}</pre>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleCopyEmbedCode}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-semibold shadow-sm border',
                    copyFeedback === 'success'
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-500/30'
                      : copyFeedback === 'error'
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-500/30'
                      : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500/30'
                  )}
                >
                  {copyFeedback === 'success' ? (
                    <>
                      <Check className="w-4 h-4" />
                      {labels.copied}
                    </>
                  ) : copyFeedback === 'error' ? (
                    <>
                      <span>✕</span>
                      {labels.copyFailed}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Sao chép mã
                    </>
                  )}
                </button>
                <a
                  href="/integration-guide"
                  className="flex items-center gap-2 px-4 py-2 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors text-sm font-semibold border border-amber-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  Hướng dẫn tích hợp
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ──────────────────────────  FOOTER BRANDING  ────────────────────────── */}
        <footer className="pt-10 pb-6 text-center text-xs text-stone-400 space-y-2">
          <p className="font-medium text-stone-500">MADA AI - HỖ TRỢ TƯ VẤN CHUYÊN GIA AT</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-amber-800/80">
              ✨ Developed by DIGISO Digital Solutions Co., Ltd. - digiso.vn
            </span>
          </div>
        </footer>
      </main>

      {/* ──────────────────────────  FLOATING CHAT WIDGET  ────────────────────────── */}
      <aside className="fixed bottom-6 right-6 z-50 group">
        <div className="absolute bottom-16 right-0 mb-2 w-max max-w-xs bg-stone-900 text-white text-xs px-3.5 py-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden sm:flex items-center gap-1.5 border border-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          Bấm để trò chuyện cùng MADA AI ✨
        </div>
        <button
          aria-label="Mở khung trò chuyện"
          onClick={() => setIsWidgetOpen(true)}
          className="w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shadow-[0_14px_32px_-4px_rgba(217,119,6,0.35),0_6px_16px_-2px_rgba(15,23,42,0.3)] hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white ring-2 ring-amber-500/20"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white"></span>
          </span>
        </button>
      </aside>

      {/* ──────────────────────────  EMBED WIDGET (when open)  ────────────────────────── */}
      {isWidgetOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsWidgetOpen(false)}
          />
          <div className="absolute bottom-6 right-6 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-120px)]">
            <EmbedWidget
              primaryColor="#D97706"
              position="bottom-right"
              defaultLanguage={language}
              isOpen={isWidgetOpen}
              onClose={() => setIsWidgetOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestWidgetPage;
