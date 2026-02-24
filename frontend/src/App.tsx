import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ConcoursListPage from '@/pages/ConcoursListPage';
import ConcoursCreatePage from '@/pages/ConcoursCreatePage';
import ConcoursDetailPage from '@/pages/ConcoursDetailPage';
import PublicDisplayPage from '@/pages/PublicDisplayPage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminAuditPage from '@/pages/admin/AdminAuditPage';

function PrivateRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  return isSuperAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/:id" element={<PublicDisplayPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="concours" element={<ConcoursListPage />} />
          <Route path="concours/nouveau" element={<ConcoursCreatePage />} />
          <Route path="concours/:id/*" element={<ConcoursDetailPage />} />
          
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
