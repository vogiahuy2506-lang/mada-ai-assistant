import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Default translations when store is not available
const defaultTranslations: Record<string, string> = {
  title: 'An error occurred',
  unknown: 'Unknown error',
  clearAndReload: 'Clear data and reload',
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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

  // Get translations safely - don't call hooks in class components
  private getTranslation(key: string): string {
    // Try to get language from store using static getState (safe, no hooks)
    let language = 'vi';
    try {
      // Dynamically import to avoid issues at module load time
      const { useLanguageStore } = require('@/stores');
      language = useLanguageStore.getState()?.language ?? 'vi';
    } catch {
      // Store not available, use default
    }

    try {
      const { translations } = require('@/lib/translations');
      return translations[language]?.[key] || defaultTranslations[key] || key;
    } catch {
      return defaultTranslations[key] || key;
    }
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
            <h1 style={{ color: '#ba1a1a', marginBottom: '16px' }}>{this.getTranslation('error.title')}</h1>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {this.state.error?.message || this.getTranslation('error.unknown')}
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
              {this.getTranslation('error.clearAndReload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
