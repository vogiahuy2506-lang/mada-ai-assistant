import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { t } from '@/lib/translations';

export function RoleLanding() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [ready, setReady] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Handle Google OAuth callback
    const googleAuth = searchParams.get('google_auth');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresAt = searchParams.get('expires_at');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      navigate('/chat?error=google_failed', { replace: true });
      return;
    }

    if (googleAuth === 'success' && accessToken && refreshToken && expiresAt) {
      // Process Google OAuth login then mark ready
      loginWithGoogle({ accessToken, refreshToken, expiresAt })
        .catch((err) => console.error('Google login failed:', err))
        .finally(() => setReady(true));
      return;
    }

    // Đợi 1 tick để store hydrate từ localStorage
    const id = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(id);
  }, [searchParams, loginWithGoogle, navigate]);

  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background, #f8fafc)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #e2e8f0',
            borderTopColor: '#0052ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: 16, color: '#64748b', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
            {t('roleLanding.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/chat" replace />;
  }

  switch (user.role) {
    case 'super_admin':
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'data_manager':
      return <Navigate to="/data" replace />;
    default:
      return <Navigate to="/chat" replace />;
  }
}
