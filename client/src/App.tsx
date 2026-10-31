import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageHeader } from './components/PageHeader';
import { btnSecondary } from './components/ui';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import { DashboardPage } from './pages/DashboardPage';
import { GoodsReceiptsPage } from './pages/GoodsReceiptsPage';
import { LoginPage } from './pages/LoginPage';
import { NewSalePage } from './pages/NewSalePage';
import { PermissionsPage } from './pages/PermissionsPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { SaleDetailPage } from './pages/SaleDetailPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { StockHistoryPage } from './pages/StockHistoryPage';
import { ChatWidget } from './components/ChatWidget';

function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Halaman tidak ditemukan" description="Alamat yang kamu buka tidak tersedia." />
      <Link to="/" className={btnSecondary}>
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

function ProtectedRoute({
  children,
  permission,
  anyOfPermissions,
  ownerOnly,
}: {
  children: React.ReactNode;
  permission?: string;
  anyOfPermissions?: string[];
  ownerOnly?: boolean;
}) {
  const { isOwner, can } = useAuth();
  if (ownerOnly && !isOwner) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 p-6 text-center max-w-lg mx-auto my-12 shadow-xs">
        <h3 className="font-bold text-rose-800 dark:text-rose-200 text-base mb-1">Akses Ditolak (Khusus Pemilik)</h3>
        <p className="text-xs text-rose-600 dark:text-rose-300 mb-4">
          Halaman ini khusus untuk Pemilik Warung Madura. Akun Staf tidak memiliki wewenang untuk membuka modul ini.
        </p>
        <Link to="/" className={btnSecondary}>
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }
  if (permission && !isOwner && !can(permission)) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 p-6 text-center max-w-lg mx-auto my-12 shadow-xs">
        <h3 className="font-bold text-rose-800 dark:text-rose-200 text-base mb-1">Izin Tidak Memadai</h3>
        <p className="text-xs text-rose-600 dark:text-rose-300 mb-4">
          Akun Anda tidak memiliki izin <code>{permission}</code> untuk membuka modul ini. Hubungi Pemilik untuk memberikan hak akses.
        </p>
        <Link to="/" className={btnSecondary}>
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }
  if (anyOfPermissions && !isOwner && !anyOfPermissions.some((p) => can(p))) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 p-6 text-center max-w-lg mx-auto my-12 shadow-xs">
        <h3 className="font-bold text-rose-800 dark:text-rose-200 text-base mb-1">Izin Tidak Memadai</h3>
        <p className="text-xs text-rose-600 dark:text-rose-300 mb-4">
          Akun Anda tidak memiliki izin <code>{anyOfPermissions.join(' atau ')}</code> untuk membuka modul ini. Hubungi Pemilik untuk memberikan hak akses.
        </p>
        <Link to="/" className={btnSecondary}>
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function AuthenticatedApp() {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 dark:border-slate-700 border-t-emerald-600 dark:border-t-emerald-500" />
          <p className="text-sm font-medium">Memuat Warung Madura...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <LoginPage />;
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="produk"
            element={
              <ProtectedRoute permission="product:read">
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <ProtectedRoute permission="purchase_order:read">
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="barang-masuk"
            element={
              <ProtectedRoute permission="goods_receipt:read">
                <GoodsReceiptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="penjualan/baru"
            element={
              <ProtectedRoute permission="sales:manage">
                <NewSalePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="riwayat-penjualan"
            element={
              <ProtectedRoute anyOfPermissions={['sales:manage', 'dashboard:financial']}>
                <SalesHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="riwayat-penjualan/:id"
            element={
              <ProtectedRoute anyOfPermissions={['sales:manage', 'dashboard:financial']}>
                <SaleDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="riwayat-stok"
            element={
              <ProtectedRoute permission="stock:read">
                <StockHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="permissions"
            element={
              <ProtectedRoute ownerOnly permission="permission:manage">
                <PermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ChatWidget />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
