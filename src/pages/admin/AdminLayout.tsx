import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import madaLogo from '@/assets/mada-logo.png';
import madaLogoFull from '@/assets/mada-logo-full.svg';

interface NavItem {
  label: string;
  labelEn: string;
  labelAr: string;
  labelFr: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', labelEn: 'Overview', labelAr: 'نظرة عامة', labelFr: 'Aperçu', href: '/admin', icon: 'dashboard' },
  { label: 'Người dùng', labelEn: 'Users', labelAr: 'المستخدمين', labelFr: 'Utilisateurs', href: '/admin/users', icon: 'group' },
  { label: 'Sản phẩm', labelEn: 'Products', labelAr: 'المنتجات', labelFr: 'Produits', href: '/admin/products', icon: 'inventory_2' },
  { label: 'Nhật ký', labelEn: 'Logs', labelAr: 'السجلات', labelFr: 'Journaux', href: '/admin/logs', icon: 'receipt_long' },
  { label: 'Phân tích', labelEn: 'Analytics', labelAr: 'التحليلات', labelFr: 'Analytique', href: '/admin/analytics', icon: 'analytics' },
  { label: 'Agents', labelEn: 'Agents', labelAr: 'الوكلاء', labelFr: 'Agents', href: '/admin/agents', icon: 'smart_toy' },
  { label: 'Tư vấn', labelEn: 'Consultations', labelAr: 'الاستشارات', labelFr: 'Consultations', href: '/admin/consultations', icon: 'support_agent' },
  { label: 'Cấu hình', labelEn: 'Settings', labelAr: 'الإعدادات', labelFr: 'Paramètres', href: '/admin/settings', icon: 'settings_suggest' },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showFab?: boolean;
  showLayoutTitle?: boolean;
}

export function AdminLayout({
  children,
  title = 'Trung tâm Điều khiển',
  titleEn = 'Control Center',
  titleAr = 'مركز التحكم',
  subtitle,
  subtitleEn,
  subtitleAr,
  showFab = true,
  showLayoutTitle = true,
}: AdminLayoutProps & { titleEn?: string; titleAr?: string; subtitleEn?: string; subtitleAr?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);

  const LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt', nameEn: 'Vietnamese', flag: '🇻🇳' },
    { code: 'en', name: 'English', nameEn: 'English', flag: '🇬🇧' },
    { code: 'ar', name: 'العربية', nameEn: 'Arabic', flag: '🇸🇦' },
    { code: 'fr', name: 'Français', nameEn: 'French', flag: '🇫🇷' },
  ];

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const getNavLabel = (item: NavItem) => {
    if (language === 'en') return item.labelEn;
    if (language === 'ar') return item.labelAr;
    if (language === 'fr') return item.labelFr;
    return item.label;
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const backToHome = () => {
    navigate('/');
  };

  return (
    <div className="font-body-md antialiased bg-background text-on-background min-h-screen" style={{ overflowX: 'hidden' }}>
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

      {/* SIDEBAR */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/10 z-50 flex flex-col p-4 gap-2 backdrop-blur-xl bg-white/70 border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        {/* Logo */}
        <div className="mb-6 px-2 flex items-center gap-3">
          <img src={madaLogo} alt="MADA" className="h-10 w-auto" />
          <div>
            <h1 className="font-display-lg text-base font-bold tracking-tight text-slate-900 leading-tight">MADA AI</h1>
            <p className="font-label-sm text-on-surface-variant leading-none">
              {language === 'vi' ? 'Universal Access' : language === 'en' ? 'Universal Access' : language === 'ar' ? 'وصول عالمي' : 'Accès Universel'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
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
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/20 flex flex-col gap-1">
          <div className="px-4 py-3 mb-4 bg-primary/5 rounded-2xl border border-primary/10">
            <p className="font-label-sm text-primary font-bold">
              Plan: {user?.plan === 'enterprise' ? 'Enterprise' : user?.plan === 'pro' ? 'Pro Edition' : 'Free'}
            </p>
            <div className="w-full bg-surface-variant h-1 rounded-full mt-2 overflow-hidden">
              <div className={clsx(
                'h-full transition-all',
                user?.plan === 'enterprise' ? 'w-full bg-gradient-to-r from-primary to-tertiary' :
                user?.plan === 'pro' ? 'w-3/4 bg-primary' : 'w-1/3 bg-outline'
              )} />
            </div>
          </div>

          <button
            onClick={backToHome}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-all text-left"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-label-md">{language === 'vi' ? 'Về trang chính' : language === 'en' ? 'Back to Home' : language === 'ar' ? 'العودة للرئيسية' : 'Retour'}</span>
          </button>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-all"
          >
            <span className="material-symbols-outlined">help</span>
            <span className="font-label-md">{language === 'vi' ? 'Hỗ trợ' : language === 'en' ? 'Help' : language === 'ar' ? 'مساعدة' : 'Aide'}</span>
          </a>

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
        {/* TOP NAV BAR */}
        <header className="fixed top-0 right-0 w-[calc(100%-256px)] h-16 z-40 backdrop-blur-xl bg-white/70 border-b border-white/40 px-margin-desktop flex justify-between items-center shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant/30 w-96">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm kiếm tài nguyên, người dùng...' : language === 'en' ? 'Search resources, users...' : language === 'ar' ? 'البحث في الموارد والمستخدمين...' : 'Rechercher ressources, utilisateurs...'}
              className="bg-transparent border-none focus:ring-0 text-body-md w-full placeholder:text-on-surface-variant/60 outline-none"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-2">
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all"
                aria-label="Thông báo"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all"
                aria-label="Cài đặt"
              >
                <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'settings'}</span>
              </button>
              
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full border border-outline-variant/30 hover:bg-surface-container-low transition-all"
                >
                  <span className="text-lg">{currentLang.flag}</span>
                  <ChevronDown className={clsx('w-4 h-4 text-on-surface-variant transition-transform', showLangMenu && 'rotate-180')} />
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden z-50">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as any);
                          setShowLangMenu(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left',
                          language === lang.code && 'bg-primary/10 text-primary font-semibold'
                        )}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <div>
                          <p className="font-label-md">{lang.name}</p>
                          <p className="text-xs text-on-surface-variant">{lang.nameEn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant/30">
              <div className="text-right">
                <p className="font-label-md text-on-surface leading-tight">{user?.name ?? 'Admin'}</p>
                <p className="font-label-sm text-primary">
                  {language === 'vi' ? 'Quản trị viên cấp cao' : language === 'en' ? 'Senior Administrator' : language === 'ar' ? 'مدير أول' : 'Administrateur Senior'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold">
                {(user?.name ?? 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* PAGE BODY */}
        <div className="mt-16 p-8 max-w-[1600px] mx-auto space-y-8">
          {showLayoutTitle && (
            <section className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                <h2 className="font-display-lg text-headline-lg text-on-surface leading-tight">
                  {titleEn && language === 'en' ? titleEn : titleAr && language === 'ar' ? titleAr : title} <span className="animate-pulse">👋</span>
                </h2>
                {subtitle && (
                  <p className="font-body-lg text-on-surface-variant mt-2 max-w-2xl">
                    {subtitleEn && language === 'en' ? subtitleEn : subtitleAr && language === 'ar' ? subtitleAr : subtitle}
                  </p>
                )}
              </div>

              <button className="group relative px-8 py-4 bg-primary text-white rounded-2xl font-label-md shadow-lg shadow-primary/25 overflow-hidden transition-all hover:shadow-primary/40 active:scale-95">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  <span className="material-symbols-outlined">cloud_download</span>
                  {language === 'vi' ? 'Xuất báo cáo hệ thống' : language === 'en' ? 'Export System Report' : language === 'ar' ? 'تصدير تقرير النظام' : 'Exporter le rapport'}
                </span>
              </button>
            </section>
          )}

          {children}
        </div>
      </main>

      {/* FLOATING ACTION BUTTON */}
      {showFab && (
        <button
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group"
          aria-label="Triển khai mô hình mới"
        >
          <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform duration-300">add</span>
          <div className="absolute right-full mr-4 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-label-md">
            {language === 'vi' ? 'Triển khai mô hình mới' : language === 'en' ? 'Deploy new model' : language === 'ar' ? 'نشر نموذج جديد' : 'Déployer un nouveau modèle'}
          </div>
        </button>
      )}
    </div>
  );
}