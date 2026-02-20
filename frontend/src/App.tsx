import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ConcoursListPage from '@/pages/ConcoursListPage';
import ConcoursCreatePage from '@/pages/ConcoursCreatePage';
import ConcoursDetailPage from '@/pages/ConcoursDetailPage';
import PublicDisplayPage from '@/pages/PublicDisplayPage';

function PrivateRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
