import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores';
import {
  ChatPage,
  AdminOverview,
  AdminUsers,
  AdminLogs,
  AdminAnalytics,
  AdminSettings,
  AdminAgents,
  AdminConsultations,
  DataManagerPage,
  ExpertPage,
  ProfilePage,
  PricingPage,
} from '@/pages';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { RoleLanding } from '@/components/RoleLanding';

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
        {/* Legacy admin routes - redirect */}
        <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/ai" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/admin/stats" element={<Navigate to="/admin/analytics" replace />} />
        <Route path="/admin/deploy" element={<Navigate to="/admin/settings" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;