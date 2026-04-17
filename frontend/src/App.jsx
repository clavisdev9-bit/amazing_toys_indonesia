import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LangProvider } from './context/LangContext';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';

import RequireAuth from './components/guards/RequireAuth';
import RequireRole from './components/guards/RequireRole';
import MaintenanceGuard from './components/guards/MaintenanceGuard';
import CustomerShell from './components/layout/CustomerShell';
import StaffShell from './components/layout/StaffShell';

// Public pages
import LoginCustomerPage from './pages/customer/LoginCustomerPage';
import RegisterPage from './pages/customer/RegisterPage';
import LoginStaffPage from './pages/staff/LoginStaffPage';
import NotFound from './pages/public/NotFound';
import MaintenancePage from './pages/public/MaintenancePage';

// Customer pages
import BrowsePage from './pages/customer/BrowsePage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import CartPage from './pages/customer/CartPage';
import CheckoutSuccessPage from './pages/customer/CheckoutSuccessPage';
import OrderHistoryPage from './pages/customer/OrderHistoryPage';
import OrderTrackingPage from './pages/customer/OrderTrackingPage';
import PaymentConfirmedPage from './pages/customer/PaymentConfirmedPage';
import ReceiptPickupPage from './pages/customer/ReceiptPickupPage';
import PickupStatusPage from './pages/customer/PickupStatusPage';

// Cashier pages
import CashierDashboardPage from './pages/cashier/CashierDashboardPage';
import PaymentPage from './pages/cashier/PaymentPage';
import RecapPage from './pages/cashier/RecapPage';

// Tenant pages
import TenantOrdersPage from './pages/tenant/TenantOrdersPage';
import TenantDashboardPage from './pages/tenant/TenantDashboardPage';
import LaporanHarianPage from './pages/tenant/LaporanHarianPage';
import StockReportPage from './pages/tenant/StockReportPage';

// Admin page
import AdminPage from './pages/admin/AdminPage';

// Leader pages
import LeaderDashboardPage from './pages/leader/LeaderDashboardPage';
import SalesReportPage from './pages/leader/SalesReportPage';
import VisitorStatsPage from './pages/leader/VisitorStatsPage';
import ReturnsPage from './pages/leader/ReturnsPage';

const CASHIER_NAV = [
  { to: '/cashier', icon: '💳', label: 'Pembayaran' },
  { to: '/cashier/rekap', icon: '📋', label: 'Rekap Harian' },
];

const TENANT_NAV = [
  { to: '/tenant', icon: '📦', label: 'Pesanan Masuk' },
  { to: '/tenant/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/tenant/laporan-harian', icon: '📋', label: 'Laporan Harian' },
  { to: '/tenant/stok', icon: '🏷️', label: 'Stok' },
];

const ADMIN_NAV = [
  { to: '/admin', icon: '🛡️', label: 'Administrator Panel' },
];

const LEADER_NAV = [
  { to: '/leader', icon: '📈', label: 'Dashboard KPI' },
  { to: '/leader/penjualan', icon: '💰', label: 'Laporan Penjualan' },
  { to: '/leader/pengunjung', icon: '👥', label: 'Pengunjung' },
  { to: '/leader/retur', icon: '↩️', label: 'Retur' },
];

// Root redirect based on role
function RootRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/masuk" replace />;
  if (role === 'CUSTOMER') return <Navigate to="/katalog" replace />;
  if (role === 'CASHIER') return <Navigate to="/cashier" replace />;
  if (role === 'TENANT') return <Navigate to="/tenant" replace />;
  if (role === 'LEADER') return <Navigate to="/leader" replace />;
  if (role === 'ADMIN')  return <Navigate to="/admin"  replace />;
  return <Navigate to="/masuk" replace />;
}

// WebSocket initializer (needs auth context)
function WSInit() {
  useWebSocket();
  return null;
}

function AppRoutes() {
  return (
    <>
      <WSInit />
      <Routes>
        {/* Always-accessible — staff login & the maintenance page itself */}
        <Route path="/staff/masuk" element={<LoginStaffPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        {/* ── Maintenance guard — blocks ALL roles except ADMIN ─────────────── */}
        <Route element={<MaintenanceGuard />}>

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Customer public pages */}
          <Route path="/masuk" element={<LoginCustomerPage />} />
          <Route path="/daftar" element={<RegisterPage />} />

          {/* Receipt page — standalone, accessible to all authenticated roles */}
          <Route element={<RequireAuth />}>
            <Route path="/pesanan/:transactionId/receipt" element={<ReceiptPickupPage />} />
          </Route>

          {/* Customer routes */}
          <Route element={<RequireRole allowedRoles={['CUSTOMER']} />}>
            <Route element={<CustomerShell />}>
              <Route path="/katalog" element={<BrowsePage />} />
              <Route path="/katalog/:productId" element={<ProductDetailPage />} />
              <Route path="/keranjang" element={<CartPage />} />
              <Route path="/checkout/sukses" element={<CheckoutSuccessPage />} />
              <Route path="/pesanan" element={<OrderHistoryPage />} />
              <Route path="/pesanan/:transactionId" element={<OrderTrackingPage />} />
              <Route path="/pesanan/:transactionId/confirmed" element={<PaymentConfirmedPage />} />
              <Route path="/pesanan/:transactionId/pickup" element={<PickupStatusPage />} />
            </Route>
          </Route>

          {/* Cashier routes */}
          <Route element={<RequireRole allowedRoles={['CASHIER', 'LEADER']} />}>
            <Route element={<StaffShell navItems={CASHIER_NAV} title="Kasir" />}>
              <Route path="/cashier" element={<CashierDashboardPage />} />
              <Route path="/cashier/bayar/:transactionId" element={<PaymentPage />} />
              <Route path="/cashier/rekap" element={<RecapPage />} />
            </Route>
          </Route>

          {/* Tenant routes */}
          <Route element={<RequireRole allowedRoles={['TENANT']} />}>
            <Route element={<StaffShell navItems={TENANT_NAV} title="Tenant" />}>
              <Route path="/tenant" element={<TenantOrdersPage />} />
              <Route path="/tenant/dashboard" element={<TenantDashboardPage />} />
              <Route path="/tenant/laporan-harian" element={<LaporanHarianPage />} />
              <Route path="/tenant/stok" element={<StockReportPage />} />
            </Route>
          </Route>

          {/* Leader routes */}
          <Route element={<RequireRole allowedRoles={['LEADER']} />}>
            <Route element={<StaffShell navItems={LEADER_NAV} title="Leader" />}>
              <Route path="/leader" element={<LeaderDashboardPage />} />
              <Route path="/leader/penjualan" element={<SalesReportPage />} />
              <Route path="/leader/pengunjung" element={<VisitorStatsPage />} />
              <Route path="/leader/retur" element={<ReturnsPage />} />
            </Route>
          </Route>

          {/* Admin routes — guard's role==='ADMIN' check always passes these through */}
          <Route element={<RequireRole allowedRoles={['ADMIN']} />}>
            <Route element={<StaffShell navItems={ADMIN_NAV} title="Administrator" />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />

        </Route>
        {/* ── End maintenance guard ─────────────────────────────────────────── */}
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthProvider>
        <LangProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
