import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole: 'admin' | 'super_admin' | 'data_manager' | 'expert';
}

export function RoleGuard({ children, requiredRole }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [state, setState] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    // Nếu đã có user trong store (từ localStorage persisted) → dùng ngay
    if (user && isAuthenticated) {
      setState('ready');
      return;
    }

    // Nếu chưa có → thử refresh 1 lần với timeout
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tryLoad = async () => {
      timeoutId = setTimeout(() => {
        if (!cancelled) setState('ready');
      }, 3000); // max đợi 3s

      try {
        await refreshUser();
      } catch {
        // ignore
      }

      if (!cancelled) {
        clearTimeout(timeoutId);
        setState('ready');
      }
    };

    tryLoad();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []); // chỉ chạy 1 lần khi mount

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="mt-4 font-label-md text-on-surface-variant">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== requiredRole && user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-12 rounded-3xl text-center max-w-md shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <span className="material-symbols-outlined text-7xl text-error mb-4">block</span>
          <h1 className="font-headline-md text-on-surface mb-2">Không có quyền truy cập</h1>
          <p className="font-label-md text-on-surface-variant">
            Trang này yêu cầu quyền <strong>{requiredRole}</strong>. Tài khoản của bạn hiện là{' '}
            <strong>{user.role}</strong>.
          </p>
          <a
            href="/"
            className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
