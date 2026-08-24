import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';
import madaLogo from '@/assets/mada-logo.png';

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
  { label: 'Scraper & KB', labelEn: 'Scraper & KB', labelAr: 'الكاشطة', labelFr: 'Scraper', href: '/admin/scraper', icon: 'cloud_download' },
  { label: 'Nhật ký Hoạt động', labelEn: 'Activity Logs', labelAr: 'سجل النشاط', labelFr: 'Journal d\'activité', href: '/admin/logs', icon: 'history_edu' },
  { label: 'Phân tích', labelEn: 'Analytics', labelAr: 'التحليلات', labelFr: 'Analytique', href: '/admin/analytics', icon: 'analytics' },
  { label: 'Agents', labelEn: 'Agents', labelAr: 'الوكلاء', labelFr: 'Agents', href: '/admin/agents', icon: 'smart_toy' },
  { label: 'System Prompts', labelEn: 'System Prompts', labelAr: 'التعليمات', labelFr: 'Prompts Système', href: '/admin/prompts', icon: 'edit_note' },
  { label: 'Tư vấn', labelEn: 'Consultations', labelAr: 'الاستشارات', labelFr: 'Consultations', href: '/admin/consultations', icon: 'support_agent' },
  { label: 'Cấu hình', labelEn: 'Settings', labelAr: 'الإعدادات', labelFr: 'Paramètres', href: '/admin/settings', icon: 'settings_suggest' },
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
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { language } = useLanguageStore();

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
        {/* PAGE BODY */}
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );

}

export default AdminLayout;
