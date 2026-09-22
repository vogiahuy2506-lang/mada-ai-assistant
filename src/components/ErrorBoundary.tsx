import React, { ReactNode } from 'react';
import { useLanguageStore } from '@/stores';
import { t } from '@/lib/translations';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Use static store access since hooks can't be used in class components
  private static language = useLanguageStore.getState().language ?? 'vi';

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9f9ff',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '500px',
          }}>
            <h1 style={{ color: '#ba1a1a', marginBottom: '16px' }}>{t('error.title', ErrorBoundary.language)}</h1>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {this.state.error?.message || t('error.unknown', ErrorBoundary.language)}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                background: '#0058be',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {t('error.clearAndReload', ErrorBoundary.language)}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
