import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguageStore, useThemeStore, useAuthStore, useAuthModalStore } from '@/stores';
import { LANGUAGE_NAMES, type Language } from '@/types';
import { t } from '@/lib/translations';
import { Menu, X, Moon, Sun, LogIn, LogOut, User, ChevronDown, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export function Header() {
  const { language, setLanguage } = useLanguageStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const authModal = useAuthModalStore();
  const navigate = useNavigate();
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

  // Navigation links với translation
  const navLinks = [
    { href: '/products', label: t('header.products', language) },
  ];

  const handleLogout = async () => {
    await logout();
    setIsProfileMenuOpen(false);
    navigate('/');
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
              {user.name.split(' ')[0] || user.name}
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
                    {t('auth.profile', language)}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 text-primary text-sm font-bold transition-colors"
                    >
                      <span className="material-symbols-outlined w-4 h-4 text-[16px]">admin_panel_settings</span>
                      {t('menu.admin', language)}
                    </Link>
                  )}
                  <hr className="my-1 border-outline-variant" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('auth.logout', language)}
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
          {t('auth.login', language)}
        </button>
        <a
          href="/chat"
          className={clsx(
            'flex items-center justify-center bg-primary text-on-primary border-2 border-on-background hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 active:scale-95',
            isMobile ? 'px-5 py-3 text-sm rounded-xl w-full' : 'px-8 py-2.5 text-xs font-mono uppercase tracking-widest rounded-full'
          )}
        >
          {isMobile ? t('auth.tryFree', language) : 'Terminal'}
        </a>
      </>
    );
  };

  return (
    <>
      {/* Desktop Header */}
      <nav
        className={clsx(
          'fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-48px)] max-w-6xl',
          'hidden md:flex justify-between items-center px-6 py-3',
          'bg-white/60 backdrop-blur-[30px]',
          'rounded-2xl border-2 border-on-background',
          'shadow-[8px_8px_0px_0px_rgba(0,0,0,0.08)]',
          'transition-all duration-300'
        )}
      >
        <Link to="/" className="flex items-center gap-2">
          <img src="/mada-logo.png" alt="MADA" className="h-8" />
          <div className="font-black text-xl tracking-tight">
            MADA AI
          </div>
          <span className="hidden xl:inline-flex items-center text-on-surface-variant/40 text-xs mx-1">×</span>
          <img src="/digiso-logo.svg" alt="DIGISO" className="hidden xl:block h-7" />
        </Link>

        <div className="hidden lg:flex gap-8 items-center">
          {navLinks.map((link) => (
            link.href.startsWith('/') ? (
              <Link
                key={link.href}
                to={link.href}
                className="text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            )
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="hidden lg:flex items-center gap-1">
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={clsx(
                  'px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all',
                  language === lang 
                    ? 'bg-primary text-on-primary font-bold' 
                    : 'text-on-surface-variant hover:text-primary'
                )}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div className="w-px h-5 bg-outline-variant/50"></div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={clsx(
              'relative p-2 rounded-xl transition-all duration-300',
              'hover:bg-surface-container active:scale-90',
              isDark 
                ? 'bg-violet-500/20 hover:bg-violet-500/30' 
                : 'bg-slate-100 hover:bg-slate-200'
            )}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <div className="relative w-5 h-5">
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400 absolute inset-0 transition-all duration-300 rotate-0 scale-100" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500 absolute inset-0 transition-all duration-300 rotate-0 scale-100" />
              )}
            </div>
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[9px] font-medium text-on-surface-variant whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {t(isDark ? 'header.themeLight' : 'header.themeDark', language)}
            </span>
          </button>

          {renderAuthSection()}
        </div>
      </nav>

      {/* Mobile Header */}
      <nav
        className={clsx(
          'fixed top-3 left-3 right-3 z-50 md:hidden',
          'flex justify-between items-center px-4 py-2.5',
          'bg-white/60 backdrop-blur-[20px]',
          'rounded-xl border-2 border-on-background',
          'shadow-[6px_6px_0px_0px_rgba(0,0,0,0.08)]'
        )}
      >
        <Link to="/" className="flex items-center gap-2">
          <img src="/mada-logo.png" alt="MADA" className="h-8" />
          <div className="font-black text-xl tracking-tight">
            MADA AI
          </div>
          <span className="hidden xl:inline-flex items-center text-on-surface-variant/40 text-xs mx-1">×</span>
          <img src="/digiso-logo.svg" alt="DIGISO" className="hidden xl:block h-7" />
        </Link>

        <div className="flex items-center gap-2">
          {/* Theme Toggle - Mobile */}
          <button
            onClick={toggleTheme}
            className={clsx(
              'p-2.5 rounded-xl transition-all duration-300',
              isDark 
                ? 'bg-violet-500/20' 
                : 'bg-slate-100'
            )}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
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
