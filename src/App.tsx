import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useThemeStore, useAuthStore, useLanguageStore } from '@/stores';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { RoleLanding } from '@/components/RoleLanding';
import { Loader2 } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';
import { translations } from '@/lib/translations';
import { validateLocalToken, clearTokens } from '@/lib/api';

// Import ChatPage directly to avoid lazy loading issues
import { ChatPage } from '@/pages/ChatPage';
import { WidgetPage } from '@/pages/WidgetPage';
import { GuestWidgetPage } from '@/pages/GuestWidgetPage';
import { IntegrationGuidePage } from '@/pages/IntegrationGuidePage';
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminAgents = lazy(() => import('@/pages/admin/AdminAgents'));
const AdminPrompts = lazy(() => import('@/pages/admin/AdminPrompts'));
const AdminConsultations = lazy(() => import('@/pages/admin/AdminConsultations'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminScraper = lazy(() => import('@/pages/admin/AdminScraper'));
const AdminSuggestedQuestions = lazy(() => import('@/pages/admin/AdminSuggestedQuestions'));
const AdminFeedback = lazy(() => import('@/pages/admin/AdminFeedback'));
const AdminFeedbackQuestions = lazy(() => import('@/pages/admin/AdminFeedbackQuestions'));
const AdminPermissions = lazy(() => import('@/pages/admin/Permissions'));
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'));
const FileManagement = lazy(() => import('@/pages/admin/FileManagement'));
const WidgetCustomization = lazy(() => import('@/pages/admin/WidgetCustomization'));
const DataManagerPage = lazy(() => import('@/pages/DataManagerPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage'));

// Translation helper hook for App component
function useAppTranslations() {
  const language = useLanguageStore((s) => s.language ?? 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  const typedTranslations = translations as Record<'vi' | 'en' | 'ar' | 'fr', Record<string, string>>;
  const t = (key: string) => {
    return typedTranslations[language]?.[key] || typedTranslations.vi[key] || key;
  };
  return { language, t };
}

// Loading fallback component
function PageLoader({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{t('app.loading')}</span>
      </div>
    </div>
  );
}

function App() {
  const { isDark } = useThemeStore();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const user = useAuthStore((s) => s.user);
  const { t } = useAppTranslations();

  // Refresh user data from server on mount to ensure role is correct
  useEffect(() => {
    // Validate token locally FIRST — prevents unnecessary 401 API calls
    const tokenCheck = validateLocalToken();
    if (!tokenCheck.valid) {
      // Token is missing, expired, or malformed — clear it immediately
      if (tokenCheck.reason !== 'missing') {
        console.warn('[Auth] Local token invalid:', tokenCheck.reason, '— clearing tokens');
        clearTokens();
      }
      return; // Don't call /api/auth/me with an invalid token
    }

    // Token is locally valid — only refresh if user data might be stale
    if (!user) {
      refreshUser().catch(() => {
        // If refresh fails, tokens will be cleared by the store's refreshUser
        // No need to manually clear here
      });
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader t={t} />}>
        <Routes>
          {/* Trang chính: redirect theo vai trò */}
          <Route path="/" element={<RoleLanding />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/embed" element={<WidgetPage />} />
          <Route path="/widget" element={<GuestWidgetPage />} />
          <Route path="/guest-widget" element={<GuestWidgetPage />} />
          <Route path="/integration-guide" element={<IntegrationGuidePage />} />
          <Route path="/history" element={<ProfilePage />} />
          <Route path="/favorites" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<ProfilePage />} />

          {/* Public Product Routes */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />

          {/* Data Manager Routes */}
          <Route path="/data" element={<DataManagerPage />} />
          <Route path="/data/knowledge" element={<DataManagerPage />} />
          <Route path="/data/collect" element={<DataManagerPage />} />
          <Route path="/data/documents" element={<DataManagerPage />} />
          <Route path="/data/categories" element={<DataManagerPage />} />

          {/* Admin Routes - protected by RoleGuard */}
          <Route
            path="/admin"
            element={
              <RoleGuard requiredRole="admin">
                <AdminOverview />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RoleGuard requiredRole="admin">
                <AdminUsers />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/logs"
            element={<Navigate to="/admin/analytics" replace />}
          />
          <Route
            path="/admin/analytics"
            element={
              <RoleGuard requiredRole="admin">
                <AdminReports />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/feedback"
            element={
              <RoleGuard requiredRole="admin">
                <AdminFeedback />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/feedback-questions"
            element={
              <RoleGuard requiredRole="admin">
                <AdminFeedbackQuestions />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RoleGuard requiredRole="admin">
                <AdminSettings />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/permissions"
            element={
              <RoleGuard requiredRole="admin">
                <AdminPermissions />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/file-management"
            element={
              <RoleGuard requiredRole="admin">
                <FileManagement />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/agents"
            element={
              <RoleGuard requiredRole="admin">
                <AdminAgents />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/consultations"
            element={
              <RoleGuard requiredRole="admin">
                <AdminConsultations />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/suggested-questions"
            element={
              <RoleGuard requiredRole="admin">
                <AdminSuggestedQuestions />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/prompts"
            element={
              <RoleGuard requiredRole="admin">
                <AdminPrompts />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/templates"
            element={<Navigate to="/admin/prompts" replace />}
          />
          <Route
            path="/admin/products"
            element={
              <RoleGuard requiredRole="admin">
                <AdminProducts />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/scraper"
            element={
              <RoleGuard requiredRole="admin">
                <AdminScraper />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/widget"
            element={
              <RoleGuard requiredRole="admin">
                <WidgetCustomization />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/support"
            element={
              <RoleGuard requiredRole="admin">
                <AdminSupport />
              </RoleGuard>
            }
          />
          {/* Legacy admin routes - redirect */}
          <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/ai" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/stats" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/admin/deploy" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/crawler" element={<Navigate to="/admin/scraper" replace />} />
          <Route path="/admin/audit" element={<Navigate to="/admin/analytics" replace />} />
        </Routes>
      </Suspense>

      {/* Global Modals - rendered outside lazy boundary to avoid hook context issues */}
      <AuthModal />
      <PaywallModal />
    </BrowserRouter>
  );
}

export default App;
