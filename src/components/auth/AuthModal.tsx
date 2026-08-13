import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import madaLogo from '@/assets/mada-logo.png';
import { useAuthModalStore, useAuthStore, useAnonQuotaStore, PLAN_LIMITS } from '@/stores';
import type { User, UserPlan } from '@/types';

interface FormState {
  email: string;
  password: string;
  name: string;
}

export function AuthModal() {
  const { isOpen, mode, close } = useAuthModalStore();
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const registerWithEmail = useAuthStore((s) => s.registerWithEmail);
  const navigate = useNavigate();
  const resetAnon = useAnonQuotaStore((s) => s.reset);

  const [tab, setTab] = useState<Tab>(mode);
  const [form, setForm] = useState<FormState>({ email: '', password: '', name: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(mode);
    setError(null);
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
      console.log('🔐 Auth request:', tab, form.email);
      
      const result = tab === 'login'
        ? await loginWithEmail(form.email, form.password)
        : await registerWithEmail(form.email, form.password, form.name);

      console.log('📦 Auth result:', result);

      if (!result.success) {
        setError(result.error || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        return;
      }

      resetAnon();
      close();
      setForm({ email: '', password: '', name: '' });

      setTimeout(() => {
        const u = useAuthStore.getState().user;
        console.log('👤 User after login:', u);
        if (u?.role === 'admin') navigate('/admin');
        else if (u?.role === 'expert') navigate('/expert');
        else if (u?.role === 'data_manager') navigate('/data');
        else navigate('/');
      }, 50);
    } catch (err: any) {
      console.error('❌ Auth error:', err);
      setError('Đã xảy ra lỗi kết nối. Vui lòng kiểm tra server đang chạy.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google`;
    } catch (err) {
      console.error('Google auth error:', err);
      setError('Có lỗi khi đăng nhập Google. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="relative w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.92) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        {/* Top gradient bar */}
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{
            background: 'linear-gradient(180deg, rgba(139,92,246,0.12) 0%, transparent 100%)',
          }}
        />

        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all z-10 shadow-sm"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative px-8 pt-10 pb-8">
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <img src={madaLogo} alt="MADA" className="h-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">
              {tab === 'login'
                ? 'Đăng nhập để tiếp tục với MADA AI'
                : 'Đăng ký miễn phí — nhận 10 lượt trải nghiệm'}
            </p>
          </div>

          {/* Tab Buttons */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng ký
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {tab === 'register' && (
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                placeholder="Email của bạn"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full pl-11 pr-11 py-3 rounded-xl bg-white border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {tab === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
                  Quên mật khẩu?
                </button>
              </div>
            )}

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              style={{
                background: loading
                  ? '#a78bfa'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-400 uppercase">hoặc</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all flex items-center justify-center gap-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Đăng nhập với Google
          </button>

          {/* Terms */}
          <p className="text-[10px] text-slate-400 text-center mt-5 leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <span className="font-medium text-slate-500">Điều khoản</span> và{' '}
            <span className="font-medium text-slate-500">Chính sách bảo mật</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
