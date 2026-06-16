import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LangProvider } from './context/LangContext';
import { WishlistProvider } from './context/WishlistContext';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import { usePublicConfig } from './hooks/useAppLogo';
import {
  TourProvider,
  TourOverlay,
  TourHighlight,
  TourTooltip,
  TourWelcomeModal,
} from './components/tour';

import RequireAuth from './components/guards/RequireAuth';
import RequireRole from './components/guards/RequireRole';
import MaintenanceGuard from './components/guards/MaintenanceGuard';
import CustomerShell from './components/layout/CustomerShell';
import StaffShell from './components/layout/StaffShell';

// Public pages
import LoginCustomerPage from './pages/customer/LoginCustomerPage';
import RegisterPage from './pages/customer/RegisterPage';
import LoginStaffPage from './pages/staff/LoginStaffPage';
import OTPVerificationPage from './pages/staff/OTPVerificationPage';
import TrustedDevicesPage from './pages/staff/TrustedDevicesPage';
import NotFound from './pages/public/NotFound';
import MaintenancePage from './pages/public/MaintenancePage';

// Customer pages
import BrowsePage from './pages/customer/BrowsePage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import MockProductDetailPage from './pages/customer/MockProductDetailPage';
import ProductCartPage from './pages/customer/ProductCartPage';
import CartPage from './pages/customer/CartPage';
import CheckoutSuccessPage from './pages/customer/CheckoutSuccessPage';
import OrderHistoryPage from './pages/customer/OrderHistoryPage';
import OrderTrackingPage from './pages/customer/OrderTrackingPage';
import PaymentConfirmedPage from './pages/customer/PaymentConfirmedPage';
import ReceiptPickupPage from './pages/customer/ReceiptPickupPage';
import PickupStatusPage from './pages/customer/PickupStatusPage';
import ProfilePage from './pages/customer/ProfilePage';

// Cashier pages
import CashierDashboardPage from './pages/cashier/CashierDashboardPage';
import CashierPOSPage from './pages/cashier/CashierPOSPage';
import PaymentPage from './pages/cashier/PaymentPage';
import RecapPage from './pages/cashier/RecapPage';
import GroupMergePage from './pages/cashier/GroupMergePage';
import GroupPaymentPage from './pages/cashier/GroupPaymentPage';

// Tenant pages
import TenantOrdersPage from './pages/tenant/TenantOrdersPage';
import TenantDashboardPage from './pages/tenant/TenantDashboardPage';
import LaporanHarianPage from './pages/tenant/LaporanHarianPage';
import StockReportPage from './pages/tenant/StockReportPage';

// Helper pages
import HelperPage                   from './pages/helper/HelperPage';
import HelperOrderSuccessPage       from './pages/helper/HelperOrderSuccessPage';
import HandoverPage                 from './pages/helper/HandoverPage';
import ProductPreorderTogglePage    from './pages/helper/ProductPreorderTogglePage';

// Admin page
import AdminPage              from './pages/admin/AdminPage';
import PreorderShipmentPage   from './pages/admin/PreorderShipmentPage';
// Leader pages
import LeaderDashboardPage from './pages/leader/LeaderDashboardPage';
import SalesReportPage from './pages/leader/SalesReportPage';
import VisitorStatsPage from './pages/leader/VisitorStatsPage';
import ReturnsPage from './pages/leader/ReturnsPage';
import LeaderDeleteApprovalPage from './pages/leader/LeaderDeleteApprovalPage';
import TenantRankingPage from './pages/leader/TenantRankingPage';
import SettlementPage from './pages/leader/SettlementPage';
import VoucherReportPage from './pages/leader/VoucherReportPage';
import TopProductsPage from './pages/leader/TopProductsPage';
import ConversionPage from './pages/leader/ConversionPage';
import HelperPerformancePage from './pages/leader/HelperPerformancePage';
import TaxReportPage from './pages/leader/TaxReportPage';
import TopCustomersPage from './pages/leader/TopCustomersPage';

const CASHIER_NAV = [
  { to: '/cashier', icon: '💳', label: 'Pembayaran' },
  { to: '/cashier/pos', icon: '🛒', label: 'POS Langsung' },
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
  { to: '/admin/preorder', icon: '📦', label: 'Pengiriman Pre-Order' },
];

const LEADER_NAV = [
  { to: '/leader', icon: '📈', label: 'Dashboard KPI' },
  { to: '/leader/penjualan', icon: '💰', label: 'Laporan Penjualan' },
  { to: '/leader/ranking-tenant', icon: '🏆', label: 'Ranking Tenant' },
  { to: '/leader/settlement', icon: '💳', label: 'Settlement' },
  { to: '/leader/voucher', icon: '🎟️', label: 'Laporan Voucher' },
  { to: '/leader/top-produk', icon: '🏷️', label: 'Top Produk' },
  { to: '/leader/top-customer', icon: '👑', label: 'Top Customer' },
  { to: '/leader/konversi', icon: '📊', label: 'Konversi' },
  { to: '/leader/kinerja-helper', icon: '🙋', label: 'Kinerja Helper' },
  { to: '/leader/pajak', icon: '🧾', label: 'Laporan Pajak' },
  { to: '/leader/pengunjung', icon: '👥', label: 'Pengunjung' },
  { to: '/leader/retur', icon: '↩️', label: 'Retur' },
  { to: '/leader/hapus-approval', icon: '🗑️', label: 'Hapus Approval' },
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
  if (role === 'HELPER') return <Navigate to="/helper" replace />;
  return <Navigate to="/masuk" replace />;
}

// WebSocket initializer (needs auth context)
function WSInit() {
  useWebSocket();
  return null;
}

// CR-049 + CR-050: sync browser tab title and favicon from admin config
function AppMetaSync() {
  const config = usePublicConfig();
  useEffect(() => {
    if (config?.event_name) document.title = config.event_name;
  }, [config?.event_name]);
  useEffect(() => {
    if (!config?.logo_url) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = config.logo_url;
    link.removeAttribute('type');
  }, [config?.logo_url]);
  return null;
}

function AppRoutes() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  // SPA session-expiry handler: intercepts the 'sos:session-expired' event
  // dispatched by api/client.js on 401. Calls logout() to clear React auth
  // state, then navigates via React Router — no full page reload.
  useEffect(() => {
    const handleExpiry = () => {
      logout();
      navigate('/masuk', { replace: true });
    };
    window.addEventListener('sos:session-expired', handleExpiry);
    return () => window.removeEventListener('sos:session-expired', handleExpiry);
  }, [logout, navigate]);

  return (
    <>
      <WSInit />
      <AppMetaSync />
      <TourWelcomeModal />
      <TourOverlay />
      <TourHighlight />
      <TourTooltip />
      <Routes>
        {/* Always-accessible — staff login & the maintenance page itself */}
        <Route path="/staff/masuk" element={<LoginStaffPage />} />
        <Route path="/staff/otp"   element={<OTPVerificationPage />} />
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
            <Route path="/settings/devices" element={<TrustedDevicesPage />} />
          </Route>

          {/* CR-036: public order tracking — accessible without login via ?token= */}
          <Route path="/pesanan/:transactionId" element={<OrderTrackingPage />} />

          {/* Customer routes — gated behind order_mode in HELPER_INPUT mode */}
          <Route element={<RequireRole allowedRoles={['CUSTOMER']} />}>
            <Route element={<CustomerShell />}>
              {/* Read-only tracking always accessible */}
              <Route path="/pesanan" element={<OrderHistoryPage />} />
              <Route path="/pesanan/:transactionId/confirmed" element={<PaymentConfirmedPage />} />
              <Route path="/pesanan/:transactionId/pickup" element={<PickupStatusPage />} />
              {/* Self-order routes: still present for rollback; backend enforces mode */}
              <Route path="/katalog" element={<BrowsePage />} />
              <Route path="/katalog/:productId" element={<ProductDetailPage />} />
              <Route path="/product/:id" element={<MockProductDetailPage />} />
              <Route path="/product_cart/:id" element={<ProductCartPage />} />
              <Route path="/keranjang" element={<CartPage />} />
              <Route path="/checkout/sukses" element={<CheckoutSuccessPage />} />
              <Route path="/profil" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* Helper routes */}
          <Route element={<RequireRole allowedRoles={['HELPER']} />}>
            <Route path="/helper" element={<HelperPage />} />
            <Route path="/helper/preorder-handover" element={<HandoverPage />} />
            <Route path="/helper/products/preorder" element={<ProductPreorderTogglePage />} />
            <Route element={<StaffShell navItems={[]} title="Helper" />}>
              <Route path="/helper/order-success" element={<HelperOrderSuccessPage />} />
            </Route>
          </Route>

          {/* Cashier routes */}
          <Route element={<RequireRole allowedRoles={['CASHIER', 'LEADER']} />}>
            <Route element={<StaffShell navItems={CASHIER_NAV} title="Kasir" />}>
              <Route path="/cashier" element={<CashierDashboardPage />} />
              <Route path="/cashier/pos" element={<CashierPOSPage />} />
              <Route path="/cashier/bayar/:transactionId" element={<PaymentPage />} />
              <Route path="/cashier/rekap" element={<RecapPage />} />
              <Route path="/cashier/group-merge" element={<GroupMergePage />} />
              <Route path="/cashier/group-bayar" element={<GroupPaymentPage />} />
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
              <Route path="/leader/ranking-tenant" element={<TenantRankingPage />} />
              <Route path="/leader/settlement" element={<SettlementPage />} />
              <Route path="/leader/voucher" element={<VoucherReportPage />} />
              <Route path="/leader/top-produk" element={<TopProductsPage />} />
              <Route path="/leader/top-customer" element={<TopCustomersPage />} />
              <Route path="/leader/konversi" element={<ConversionPage />} />
              <Route path="/leader/kinerja-helper" element={<HelperPerformancePage />} />
              <Route path="/leader/pajak" element={<TaxReportPage />} />
              <Route path="/leader/pengunjung" element={<VisitorStatsPage />} />
              <Route path="/leader/retur" element={<ReturnsPage />} />
              <Route path="/leader/hapus-approval" element={<LeaderDeleteApprovalPage />} />
            </Route>
          </Route>

          {/* Admin routes — guard's role==='ADMIN' check always passes these through */}
          <Route element={<RequireRole allowedRoles={['ADMIN']} />}>
            <Route element={<StaffShell navItems={ADMIN_NAV} title="Administrator" />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="/admin/preorder" element={<PreorderShipmentPage />} />
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
            <WishlistProvider>
              <TourProvider>
                <AppRoutes />
              </TourProvider>
            </WishlistProvider>
          </CartProvider>
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
