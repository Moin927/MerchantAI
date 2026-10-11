import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { queryClient } from '@/lib/query-client';
import { ToastProvider } from '@/components/toast';
import { AppLayout } from '@/components/app-layout';
import { LandingPage } from '@/pages/landing';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { DashboardPage } from '@/pages/dashboard';
import { AssistantPage } from '@/pages/assistant';
import { TransactionsPage } from '@/pages/transactions';
import { NewSalePage, NewPurchasePage, NewExpensePage } from '@/pages/new-transactions';
import { TransactionDetailPage } from '@/pages/transaction-detail';
import { ProductsPage, InventoryPage } from '@/pages/products';
import { ProductDetailPage } from '@/pages/product-detail';
import { CustomersPage, CustomerDetailPage, SuppliersPage, SupplierDetailPage } from '@/pages/contacts';
import { InvoicesPage, InvoiceDetailPage } from '@/pages/invoices';
import { SolanaPaymentPage } from '@/pages/solana-payment';
import { PaymentsPage } from '@/pages/payments';
import { ReportsPage } from '@/pages/reports';
import { SettingsPage } from '@/pages/settings';
import { Spinner } from '@/components/ui';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/new-sale" element={<NewSalePage />} />
        <Route path="transactions/new-purchase" element={<NewPurchasePage />} />
        <Route path="transactions/new-expense" element={<NewExpensePage />} />
        <Route path="transactions/:id" element={<TransactionDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="invoices/:id/pay" element={<SolanaPaymentPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
