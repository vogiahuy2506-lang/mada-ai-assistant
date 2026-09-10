import { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';
import madaLogo from '@/assets/mada-logo.png';

// ============== LANGUAGE SWITCHER (top bar) ==============
const LANGUAGES: Array<{ code: 'vi' | 'en' | 'ar' | 'fr'; label: string; flag: string }> = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Apply RTL for Arabic globally on the admin root
  useEffect(() => {
    const root = document.documentElement;
    if (language === 'ar') root.setAttribute('dir', 'rtl');
    else root.setAttribute('dir', 'ltr');
  }, [language]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/40 bg-white/60 hover:bg-white/90 transition-all shadow-sm"
        title="Switch language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-label-sm font-semibold text-on-surface">{current.code.toUpperCase()}</span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-outline-variant/30 overflow-hidden z-[60]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-primary/5 transition-colors',
                language === l.code && 'bg-primary/10 text-primary font-semibold'
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="font-label-md">{l.label}</span>
              {language === l.code && (
                <span className="material-symbols-outlined text-[18px] ml-auto text-primary">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NavItem {
  label: string;
  labelEn: string;
  labelAr: string;
  labelFr: string;
  href: string;
  icon: string;
  superAdminOnly?: boolean; // Chỉ Super Admin mới thấy
  adminOnly?: boolean; // Chỉ Admin trở lên mới thấy
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', labelEn: 'Overview', labelAr: 'نظرة عامة', labelFr: 'Aperçu', href: '/admin', icon: 'dashboard' },
  { label: 'AI chatbox', labelEn: 'AI chatbox', labelAr: 'مربع الدردشة', labelFr: 'Chatbot IA', href: '/admin/widget', icon: 'smart_toy' },
  { label: 'Người dùng', labelEn: 'Users', labelAr: 'المستخدمين', labelFr: 'Utilisateurs', href: '/admin/users', icon: 'group' },
  { label: 'Sản phẩm', labelEn: 'Products', labelAr: 'المنتجات', labelFr: 'Produits', href: '/admin/products', icon: 'inventory_2' },
  { label: 'Scraper & KB', labelEn: 'Scraper & KB', labelAr: 'الكاشطة', labelFr: 'Scraper', href: '/admin/scraper', icon: 'cloud_download' },
  { label: 'Nhật ký Hoạt động', labelEn: 'Activity Logs', labelAr: 'سجل النشاط', labelFr: 'Journal d\'activité', href: '/admin/logs', icon: 'history_edu' },
  { label: 'Phân tích', labelEn: 'Analytics', labelAr: 'التحليلات', labelFr: 'Analytique', href: '/admin/analytics', icon: 'analytics' },
  { label: 'Agents', labelEn: 'Agents', labelAr: 'الوكلاء', labelFr: 'Agents', href: '/admin/agents', icon: 'smart_toy' },
  { label: 'System Prompts', labelEn: 'System Prompts', labelAr: 'التعليمات', labelFr: 'Prompts Système', href: '/admin/prompts', icon: 'edit_note' },
  { label: 'Tư vấn', labelEn: 'Consultations', labelAr: 'الاستشارات', labelFr: 'Consultations', href: '/admin/consultations', icon: 'support_agent' },
  { label: 'Cấu hình', labelEn: 'Settings', labelAr: 'الإعدادات', labelFr: 'Paramètres', href: '/admin/settings', icon: 'settings_suggest', superAdminOnly: true },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  titleFr?: string;
  subtitle?: string;
  subtitleEn?: string;
  subtitleAr?: string;
  subtitleFr?: string;
  showFab?: boolean;
  showLayoutTitle?: boolean;
}

export function AdminLayout({
  children,
  title = 'Trung tâm Điều khiển',
  titleEn = 'Control Center',
  titleAr,
  titleFr,
  subtitle,
  subtitleEn,
  subtitleAr,
  subtitleFr,
  showFab: _showFab = false,
  showLayoutTitle = true,
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin, isAdmin } = useAuthStore();
  const { language } = useLanguageStore();
  const isRtl = language === 'ar';
  const isUserSuperAdmin = isSuperAdmin();
  const isUserAdmin = isAdmin();

  const getNavLabel = (item: NavItem) => {
    if (language === 'en') return item.labelEn;
    if (language === 'ar') return item.labelAr;
    if (language === 'fr') return item.labelFr;
    return item.label;
  };

  // Pick title/subtitle theo ngôn ngữ hiện tại
  const currentTitle =
    language === 'en' ? (titleEn || title) :
    language === 'ar' ? (titleAr || title) :
    language === 'fr' ? (titleFr || title) :
    title;
  const currentSubtitle =
    language === 'en' ? (subtitleEn || subtitle) :
    language === 'ar' ? (subtitleAr || subtitle) :
    language === 'fr' ? (subtitleFr || subtitle) :
    subtitle;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="font-body-md antialiased bg-background text-on-background min-h-screen"
      style={{ overflowX: 'hidden' }}
    >
      {/* Material Symbols font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap" />
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .font-display-lg { font-family: 'Manrope', sans-serif; }
        .font-body-lg, .font-body-md, .font-label-md, .font-label-sm { font-family: 'Inter', sans-serif; }
      `}</style>
      <style>{`
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        nav::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* SIDEBAR */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/10 z-50 flex flex-col p-4 gap-2 backdrop-blur-xl bg-white/70 border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        {/* Logo */}
        <div className="mb-6 px-2 flex items-center">
          <img src={madaLogo} alt="MADA" className="h-12 w-auto" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS
            .filter((item) => {
              // Lọc menu theo role
              if (item.superAdminOnly && !isUserSuperAdmin) return false;
              return true;
            })
            .map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-150 active:scale-95',
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-md'
                    : 'text-on-surface-variant hover:bg-surface-variant/50 hover:scale-[1.02]'
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-label-md">{getNavLabel(item)}</span>
                {item.superAdminOnly && (
                  <span className="material-symbols-outlined text-xs text-warning ml-auto" title={language === 'vi' ? 'Chỉ Super Admin' : 'Super Admin Only'}>lock</span>
                )}
              </Link>
            );
          })}

        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/20 flex flex-col gap-1">
          {/* User Role Badge */}
          <div className="px-4 py-3 mb-4 rounded-2xl border border-primary/10 bg-primary/5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_circle</span>
              <span className="font-label-sm font-bold text-primary truncate flex-1">{user?.name || user?.email || 'Admin'}</span>
              {isUserSuperAdmin ? (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                  SUPER
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  ADMIN
                </span>
              )}
            </div>
            <p className="font-label-sm text-primary/70 mt-1">
              Plan: {user?.plan === 'enterprise' ? 'Enterprise' : user?.plan === 'pro' ? 'Pro' : 'Free'}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-error/5 hover:text-error transition-all text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-md">{language === 'vi' ? 'Đăng xuất' : language === 'en' ? 'Logout' : language === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="ml-64 min-h-screen">
        {/* TOP BAR */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-outline-variant/30 px-8 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            {showLayoutTitle && (
              <div>
                <h1 className="font-display-lg text-xl font-bold text-on-surface truncate">{currentTitle}</h1>
                {currentSubtitle && (
                  <p className="text-xs text-on-surface-variant truncate mt-0.5">{currentSubtitle}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20">
              <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
              <span className="font-label-sm font-semibold text-primary">{user?.email || user?.name || 'Admin'}</span>
              {isUserSuperAdmin && (
                <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                  SUPER
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PAGE BODY */}
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );

}

export default AdminLayout;
