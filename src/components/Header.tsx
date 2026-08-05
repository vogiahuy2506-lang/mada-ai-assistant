import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguageStore, useThemeStore, useAuthStore, useAuthModalStore } from '@/stores';
import { LANGUAGE_NAMES, type Language } from '@/types';
import { Menu, X, Moon, Sun, LogIn, LogOut, User, ChevronDown, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { RobotLogo } from './icons/RobotLogo';

const navLinks = [
  { href: '#features', label: 'Mô hình' },
  { href: '#how-it-works', label: 'Trí tuệ' },
  { href: '#standards', label: 'Tiêu chuẩn' },
  { href: '#ecosystem', label: 'Kết nối' },
  { href: '/pricing', label: 'Bảng giá' },
];

export function Header() {
  const { language, setLanguage } = useLanguageStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const authModal = useAuthModalStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const languages: Language[] = ['vi', 'en', 'ar', 'fr'];

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
  };

  const isAdmin = user?.role === 'admin';

  const renderAuthSection = (isMobile = false) => {
    if (user) {
      return (
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={clsx(
              'flex items-center gap-2 rounded-full bg-white border-2 border-on-background hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all',
              isMobile ? 'px-3 py-2' : 'px-3 py-1.5'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-black">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-mono uppercase tracking-widest max-w-[100px] truncate">
              {user.name.split(' ')[0]}
            </span>
            {(user.plan === 'pro' || user.plan === 'enterprise') && (
              <Sparkles className="w-3 h-3 text-violet-500" fill="currentColor" />
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', isProfileMenuOpen && 'rotate-180')} />
          </button>

          {isProfileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border-2 border-on-background rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant">
                  <p className="text-sm font-bold text-on-background truncate">{user.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">{user.email}</p>
                  <span className={clsx(
                    'inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest',
                    user.plan === 'pro' ? 'bg-violet-100 text-violet-700' :
                    user.plan === 'enterprise' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  )}>
                    {user.plan}
                  </span>
                </div>
                <div className="p-1">
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container text-sm transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Hồ sơ
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 text-primary text-sm font-bold transition-colors"
                    >
                      <span className="material-symbols-outlined w-4 h-4 text-[16px]">admin_panel_settings</span>
                      Trang quản trị
                    </Link>
                  )}
                  <Link
                    to="/pricing"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container text-sm transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Nâng cấp gói
                  </Link>
                  <hr className="my-1 border-outline-variant" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        <button
          onClick={() => authModal.open('login')}
          className={clsx(
            'flex items-center gap-1.5 bg-white text-on-background border-2 border-on-background hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 active:scale-95',
            isMobile ? 'px-5 py-3 text-sm' : 'px-5 py-2 text-xs font-mono uppercase tracking-widest'
          )}
        >
          <LogIn className="w-3.5 h-3.5" />
          Đăng nhập
        </button>
        <a
          href="/chat"
          className={clsx(
            'flex items-center justify-center bg-primary text-on-primary border-2 border-on-background hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 active:scale-95',
            isMobile ? 'px-5 py-3 text-sm rounded-xl w-full' : 'px-8 py-2.5 text-xs font-mono uppercase tracking-widest rounded-full'
          )}
        >
          {isMobile ? 'Thử miễn phí' : 'Terminal'}
        </a>
      </>
    );
  };

  return (
    <>
      {/* Desktop Header */}
      <nav
        className={clsx(
          'fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-48px)] max-w-7xl',
          'hidden md:flex justify-between items-center px-8 py-5',
          'bg-white/40 backdrop-blur-[40px]',
          'rounded-full border-2 border-on-background',
          'shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]',
          'transition-all duration-500'
        )}
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1.5">
            <RobotLogo variant="white" className="w-full h-full" />
          </div>
          <div className="font-black text-2xl md:text-[32px] tracking-tight">
            MADA AI
          </div>
        </Link>

        <div className="hidden md:flex gap-10 items-center">
          {navLinks.map((link) => (
            link.href.startsWith('/') ? (
              <Link
                key={link.href}
                to={link.href}
                className="text-xs font-mono uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all duration-300"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-mono uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all duration-300"
              >
                {link.label}
              </a>
            )
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-surface-variant" />
            ) : (
              <Moon className="w-4 h-4 text-on-surface-variant" />
            )}
          </button>

          {renderAuthSection()}
        </div>
      </nav>

      {/* Mobile Header */}
      <nav
        className={clsx(
          'fixed top-3 left-3 right-3 z-50 md:hidden',
          'flex justify-between items-center px-5 py-3',
          'bg-white/40 backdrop-blur-[20px]',
          'rounded-2xl border-2 border-on-background',
          'shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'
        )}
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1">
            <RobotLogo variant="white" className="w-full h-full" />
          </div>
          <div className="font-black text-xl tracking-tight">
            MADA AI
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface-container transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-surface-container transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute right-0 top-16 bottom-2 w-[280px] bg-surface p-6 border-l-2 border-on-background overflow-y-auto">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                link.href.startsWith('/') ? (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="font-mono text-sm uppercase tracking-widest py-3 border-b border-outline-variant hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="font-mono text-sm uppercase tracking-widest py-3 border-b border-outline-variant hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                )
              ))}

              <hr className="border-on-background my-4" />

              <div className="grid grid-cols-2 gap-2 mb-4">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang);
                    }}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-xs font-mono border-2 transition-colors',
                      language === lang ? 'border-primary bg-primary text-on-primary' : 'border-outline hover:border-primary'
                    )}
                  >
                    {LANGUAGE_NAMES[lang]}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {renderAuthSection(true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
