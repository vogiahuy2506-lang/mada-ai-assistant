import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useThemeStore } from '@/stores';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { RoleLanding } from '@/components/RoleLanding';
import { Loader2 } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';

// Lazy load all page components for code splitting
const ChatPage = lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview').then(m => ({ default: m.AdminOverview })));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminLogs = lazy(() => import('@/pages/admin/AdminLogs').then(m => ({ default: m.AdminLogs })));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAgents = lazy(() => import('@/pages/admin/AdminAgents').then(m => ({ default: m.AdminAgents })));
const AdminConsultations = lazy(() => import('@/pages/admin/AdminConsultations').then(m => ({ default: m.AdminConsultations })));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const DataManagerPage = lazy(() => import('@/pages/DataManagerPage').then(m => ({ default: m.DataManagerPage })));
const ExpertPage = lazy(() => import('@/pages/ExpertPage').then(m => ({ default: m.ExpertPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const PricingPage = lazy(() => import('@/pages/PricingPage').then(m => ({ default: m.PricingPage })));
const ProductsPage = lazy(() => import('@/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const CategoryPage = lazy(() => import('@/pages/CategoryPage').then(m => ({ default: m.CategoryPage })));
const SearchPage = lazy(() => import('@/pages/SearchPage').then(m => ({ default: m.SearchPage })));
const ComparePage = lazy(() => import('@/pages/ComparePage').then(m => ({ default: m.ComparePage })));

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
                <AdminLogs />
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
            path="/admin/products"
            element={
              <RoleGuard requiredRole="admin">
                <AdminProducts />
              </RoleGuard>
            }
          />
          {/* Legacy admin routes - redirect */}
          <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/ai" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/stats" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/admin/deploy" element={<Navigate to="/admin/settings" replace />} />
        </Routes>
      </Suspense>

      {/* Global Modals - rendered outside lazy boundary to avoid hook context issues */}
      <AuthModal />
      <PaywallModal />
    </BrowserRouter>
  );
}

export default App;