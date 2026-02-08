import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import AuthProvider from '@/components/auth/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import EmployeesPage from '@/pages/EmployeesPage';
import EmployeeDetailPage from '@/pages/EmployeeDetailPage';
import CreateEmployeePage from '@/pages/CreateEmployeePage';
import EditEmployeePage from '@/pages/EditEmployeePage';
import SitesPage from '@/pages/SitesPage';
import SiteDetailPage from '@/pages/SiteDetailPage';
import BatchesPage from '@/pages/BatchesPage';
import BatchDetailPage from '@/pages/BatchDetailPage';
import SalesPage from '@/pages/SalesPage';
import UserManagementPage from '@/pages/UserManagementPage';
import NotFoundPage from '@/pages/NotFoundPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/new" element={<CreateEmployeePage />} />
                <Route path="/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/sites/:id" element={<SiteDetailPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/batches/:id" element={<BatchDetailPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/users" element={<UserManagementPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
