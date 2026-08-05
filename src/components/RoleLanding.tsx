import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

export function RoleLanding() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Đợi 1 tick để store hydrate từ localStorage
    const id = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(id);
  }, []);

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
            Đang tải...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/chat" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'expert':
      return <Navigate to="/expert" replace />;
    case 'data_manager':
      return <Navigate to="/data" replace />;
    default:
      return <Navigate to="/chat" replace />;
  }
}
