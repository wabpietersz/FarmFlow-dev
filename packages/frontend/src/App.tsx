import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from '@/components/ui/sonner';
import AuthProvider from '@/components/auth/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import PWAReloadPrompt from '@/components/layout/PWAReloadPrompt';
import LoginPage from '@/pages/LoginPage';
import { queryPersister, PERSIST_MAX_AGE } from '@/lib/queryPersister';
import { initOfflineSync } from '@/lib/offlineSync';

// Lazy-loaded page components for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TodayCheckPage = lazy(() => import('@/pages/TodayCheckPage'));
const FarmCarePage = lazy(() => import('@/pages/FarmCarePage'));
const ApprovalsPage = lazy(() => import('@/pages/ApprovalsPage'));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage'));
const EmployeeDetailPage = lazy(() => import('@/pages/EmployeeDetailPage'));
const CreateEmployeePage = lazy(() => import('@/pages/CreateEmployeePage'));
const EditEmployeePage = lazy(() => import('@/pages/EditEmployeePage'));
const SitesPage = lazy(() => import('@/pages/SitesPage'));
const SiteDetailPage = lazy(() => import('@/pages/SiteDetailPage'));
const BatchesPage = lazy(() => import('@/pages/BatchesPage'));
const BatchDetailPage = lazy(() => import('@/pages/BatchDetailPage'));
const SalesPage = lazy(() => import('@/pages/SalesPage'));
const SaleDetailPage = lazy(() => import('@/pages/SaleDetailPage'));
const BuyerDetailPage = lazy(() => import('@/pages/BuyerDetailPage'));
const AttendancePage = lazy(() => import('@/pages/AttendancePage'));
const PayrollPage = lazy(() => import('@/pages/PayrollPage'));
const PayrollDetailPage = lazy(() => import('@/pages/PayrollDetailPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const InventoryManagementPage = lazy(() => import('@/pages/InventoryManagementPage'));
const FarmControlPage = lazy(() => import('@/pages/FarmControlPage'));
const TreasuryPage = lazy(() => import('@/pages/TreasuryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: PERSIST_MAX_AGE, // Keep cache for 24h (for offline persistence)
      networkMode: 'offlineFirst', // Return cached data when offline
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function OfflineSyncInitializer() {
  useEffect(() => {
    const cleanup = initOfflineSync();
    return cleanup;
  }, []);
  return null;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE,
        buster: '1.0.0', // Change when cache structure changes
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <OfflineSyncInitializer />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EmployeesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/employees/new"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <CreateEmployeePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EmployeeDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/employees/:id/edit"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EditEmployeePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/sites"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SitesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/sites/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SiteDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/batches"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <BatchesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/batches/:id/today"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <TodayCheckPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/approvals"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ApprovalsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/farm-care"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FarmCarePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/batches/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <BatchDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/sales"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SalesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/sales/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SaleDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/buyers/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <BuyerDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AttendancePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/payroll"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PayrollPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/payroll/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PayrollDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReportsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryManagementPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/farm-control"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FarmControlPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/feed"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FeedPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/treasury"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <TreasuryPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SettingsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/users"
                  element={<Navigate to="/settings?section=users" replace />}
                />
                <Route
                  path="/unauthorized"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <UnauthorizedPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <NotFoundPage />
                </Suspense>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
      <PWAReloadPrompt />
    </PersistQueryClientProvider>
  );
}
