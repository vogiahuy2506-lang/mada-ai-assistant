import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useThemeStore } from '@/stores';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { RoleLanding } from '@/components/RoleLanding';
import { Loader2 } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';

// Lazy load all page components for code splitting.
// Some pages export only `function X()` (named), others have both named + default.
// Resolve helper picks whichever exists so we don't depend on default-export policy.
const Fallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);
const lazyNamed = (name: string, loader: () => Promise<any>) =>
  lazy(() =>
    loader().then((m) => {
      const Component = m.default ?? m[name];
      if (!Component) {
        console.error(`[lazyNamed] Could not find component "${name}" in module`, Object.keys(m));
        return { default: Fallback };
      }
      return { default: Component };
    })
  );

const ChatPage = lazyNamed('ChatPage', () => import('@/pages/ChatPage'));
const AdminOverview = lazyNamed('AdminOverview', () => import('@/pages/admin/AdminOverview'));
const AdminUsers = lazyNamed('AdminUsers', () => import('@/pages/admin/AdminUsers'));
const AdminAnalytics = lazyNamed('AdminAnalytics', () => import('@/pages/admin/AdminAnalytics'));
const AdminSettings = lazyNamed('AdminSettings', () => import('@/pages/admin/AdminSettings'));
const AdminAgents = lazyNamed('AdminAgents', () => import('@/pages/admin/AdminAgents'));
const AdminPrompts = lazyNamed('AdminPrompts', () => import('@/pages/admin/AdminPrompts'));
const AdminConsultations = lazyNamed('AdminConsultations', () => import('@/pages/admin/AdminConsultations'));
const AdminProducts = lazyNamed('AdminProducts', () => import('@/pages/admin/AdminProducts'));
const AdminScraper = lazyNamed('AdminScraper', () => import('@/pages/admin/AdminScraper'));
const AdminAudit = lazyNamed('AdminAudit', () => import('@/pages/admin/AdminAudit'));
const DataManagerPage = lazyNamed('DataManagerPage', () => import('@/pages/DataManagerPage'));
const ExpertPage = lazyNamed('ExpertPage', () => import('@/pages/ExpertPage'));
const ProfilePage = lazyNamed('ProfilePage', () => import('@/pages/ProfilePage'));
const PricingPage = lazyNamed('PricingPage', () => import('@/pages/PricingPage'));
const ProductsPage = lazyNamed('ProductsPage', () => import('@/pages/ProductsPage'));
const ProductDetailPage = lazyNamed('ProductDetailPage', () => import('@/pages/ProductDetailPage'));
const CategoryPage = lazyNamed('CategoryPage', () => import('@/pages/CategoryPage'));
const SearchPage = lazyNamed('SearchPage', () => import('@/pages/SearchPage'));
const ComparePage = lazyNamed('ComparePage', () => import('@/pages/ComparePage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Trang chính: redirect theo vai trò */}
          <Route path="/" element={<RoleLanding />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/history" element={<ProfilePage />} />
          <Route path="/favorites" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<ProfilePage />} />

          {/* Public Product Routes */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/compare" element={<ComparePage />} />

          {/* Expert Routes */}
          <Route path="/expert" element={<ExpertPage />} />
          <Route path="/expert/requests" element={<ExpertPage />} />
          <Route path="/expert/history" element={<ExpertPage />} />
          <Route path="/expert/stats" element={<ExpertPage />} />

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
            element={
              <RoleGuard requiredRole="admin">
                <AdminAudit />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <RoleGuard requiredRole="admin">
                <AdminAnalytics />
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
            path="/admin/prompts"
            element={
              <RoleGuard requiredRole="admin">
                <AdminPrompts />
              </RoleGuard>
            }
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
          {/* Legacy admin routes - redirect */}
          <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/ai" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/stats" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/admin/deploy" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/crawler" element={<Navigate to="/admin/scraper" replace />} />
          <Route path="/admin/audit" element={<Navigate to="/admin/logs" replace />} />
        </Routes>
      </Suspense>

      {/* Global Modals - rendered outside lazy boundary to avoid hook context issues */}
      <AuthModal />
      <PaywallModal />
    </BrowserRouter>
  );
}

export default App;