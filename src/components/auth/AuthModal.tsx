import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, X, Eye, EyeOff, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { RobotLogo } from '@/components/icons/RobotLogo';
import { useAuthModalStore, useAuthStore, useAnonQuotaStore, PLAN_LIMITS } from '@/stores';
import type { User, UserPlan } from '@/types';
import { ADMIN_CREDENTIALS, DEMO_CREDENTIALS } from '@/lib/adminCredentials';

type Tab = 'login' | 'register';

interface FormState {
  email: string;
  password: string;
  name: string;
}

export function AuthModal() {
  const { isOpen, mode, close } = useAuthModalStore();
  const login = useAuthStore((s) => s.login);
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const registerWithEmail = useAuthStore((s) => s.registerWithEmail);
  const navigate = useNavigate();
  const resetAnon = useAnonQuotaStore((s) => s.reset);

  const [tab, setTab] = useState<Tab>(mode);
  const [form, setForm] = useState<FormState>({ email: '', password: '', name: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdminHint, setShowAdminHint] = useState(false);

  useEffect(() => {
    setTab(mode);
    setError(null);
    setShowAdminHint(false);
  }, [mode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const buildUser = (email: string, name: string, provider: 'email' | 'google' = 'email'): User => {
    const plan: UserPlan = 'free';
    return {
      id: crypto.randomUUID(),
      email,
      name: name || email.split('@')[0],
      role: 'user',
      plan,
      quotaUsed: 0,
      quotaLimit: PLAN_LIMITS[plan],
      provider,
      createdAt: new Date(),
      lastLogin: new Date(),
    };
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(form.email)) {
      setError('Email không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (tab === 'register' && !form.name.trim()) {
      setError('Vui lòng nhập tên của bạn.');
      return;
    }

    setLoading(true);
    try {
      const result = tab === 'login'
        ? await loginWithEmail(form.email, form.password)
        : await registerWithEmail(form.email, form.password, form.name);

      if (!result.success) {
        setError(result.error || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        return;
      }

      resetAnon();
      close();
      setForm({ email: '', password: '', name: '' });

      // Redirect theo vai trò
      setTimeout(() => {
        const u = useAuthStore.getState().user;
        if (u?.role === 'admin') navigate('/admin');
        else if (u?.role === 'expert') navigate('/expert');
        else if (u?.role === 'data_manager') navigate('/data');
        else navigate('/');
      }, 50);
    } catch (err) {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      console.error('Email auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = async (credential: typeof ADMIN_CREDENTIALS[number]) => {
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithEmail(credential.email, credential.password);
      if (!result.success) {
        setError(result.error || 'Không thể đăng nhập.');
        return;
      }
      resetAnon();
      close();
      setForm({ email: '', password: '', name: '' });

      // Redirect theo vai trò
      setTimeout(() => {
        const u = useAuthStore.getState().user;
        if (u?.role === 'admin') navigate('/admin');
        else if (u?.role === 'expert') navigate('/expert');
        else if (u?.role === 'data_manager') navigate('/data');
        else navigate('/');
      }, 50);
    } catch (err) {
      setError('Không thể đăng nhập admin.');
      console.error('Admin auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const user = buildUser('user.mada@gmail.com', 'Google User', 'google');
      login(user);
      resetAnon();
      close();

      // Redirect theo vai trò (Google mock = user thường)
      setTimeout(() => navigate('/'), 50);
    } catch (err) {
      setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
      console.error('Google auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    const user = buildUser('demo@mada.ai', 'Demo User', 'email');
    login(user);
    resetAnon();
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.85) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-32 -z-10 opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(59,130,246,0.18) 100%)',
          }}
        />

        <button
          onClick={close}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all z-10"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1.5">
              <RobotLogo variant="white" className="w-full h-full" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
            </h2>
          </div>
          <p className="text-sm text-slate-500 mb-6 ml-12">
            {tab === 'login'
              ? 'Đăng nhập để tiếp tục trò chuyện với MADA AI.'
              : 'Đăng ký miễn phí — nhận 10 lượt trải nghiệm đầu tiên.'}
          </p>

          <div className="flex p-1 bg-slate-100/80 rounded-2xl mb-6">
            <button
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                tab === 'register'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {tab === 'register' && (
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 border border-white/60 focus:border-violet-400 focus:bg-white outline-none text-sm transition-all"
                />
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
              <input
                type="email"
                placeholder="Email của bạn"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 border border-white/60 focus:border-violet-400 focus:bg-white outline-none text-sm transition-all"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/70 border border-white/60 focus:border-violet-400 focus:bg-white outline-none text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {tab === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-semibold text-violet-600 hover:text-violet-700">
                  Quên mật khẩu?
                </button>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium animate-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              style={{
                background: loading
                  ? '#a78bfa'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hoặc</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 text-sm font-bold text-slate-700 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Tiếp tục với Google
          </button>

          <button
            type="button"
            onClick={handleDemo}
            className="w-full mt-3 py-2 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
          >
            ⚡ Dùng thử tài khoản Demo (1 click)
          </button>

          {/* ADMIN QUICK LOGIN */}
          <div className="mt-5 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdminHint(!showAdminHint)}
              className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Đăng nhập với tài khoản đặc biệt
              <span className={`material-icons text-[14px] transition-transform ${showAdminHint ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {showAdminHint && (
              <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-start gap-2 mb-2">
                  <KeyRound className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Tài khoản có sẵn trong hệ thống</p>
                    <p className="text-[10px] text-amber-700/80 leading-relaxed">
                      Click để đăng nhập nhanh — không cần nhớ mật khẩu.
                    </p>
                  </div>
                </div>

                {DEMO_CREDENTIALS.map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickAdminLogin(cred)}
                    className="w-full p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left group disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          cred.role === 'admin'
                            ? 'bg-red-100 text-red-700'
                            : cred.role === 'expert'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {cred.role}
                        </span>
                        <span className="font-bold text-xs text-slate-900 truncate">{cred.name}</span>
                      </div>
                      <span className="material-icons text-[16px] text-amber-600 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mb-1">
                      {cred.email} · {cred.password}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {cred.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-5 leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <span className="font-bold text-slate-600">Điều khoản</span> và{' '}
            <span className="font-bold text-slate-600">Chính sách bảo mật</span> của MADA AI.
          </p>
        </div>
      </div>
    </div>
  );
}
