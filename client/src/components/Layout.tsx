import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  ArrowDownLeft,
  ShoppingCart,
  Receipt,
  History,
  ShieldCheck,
  LogOut,
  Sparkles,
  Building2,
  Crown,
  User,
  Sun,
  Moon,
  Search,
  Command,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  permission?: string;
  anyOfPermissions?: string[];
  ownerOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/penjualan/baru', label: 'Kasir Express', icon: ShoppingCart, permission: 'sales:manage' },
  { to: '/barang-masuk', label: 'Barang Masuk', icon: ArrowDownLeft, permission: 'goods_receipt:read' },
  { to: '/purchase-orders', label: 'Purchase Order', icon: FileSpreadsheet, permission: 'purchase_order:read' },
  { to: '/produk', label: 'Master Produk', icon: Package, permission: 'product:read' },
  {
    to: '/riwayat-penjualan',
    label: 'Riwayat Penjualan',
    icon: Receipt,
    anyOfPermissions: ['sales:manage', 'dashboard:financial'],
  },
  { to: '/riwayat-stok', label: 'Riwayat Stok', icon: History, permission: 'stock:read' },
  {
    to: '/permissions',
    label: 'Manajemen Izin',
    icon: ShieldCheck,
    permission: 'permission:manage',
    ownerOnly: true,
  },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-transform duration-100 ease-out active:scale-[0.98]';
  return isActive
    ? `${base} bg-emerald-600 dark:bg-emerald-600 text-white shadow-xs`
    : `${base} text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100`;
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isOwner, can, quickSwitch, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Global Keyboard Shortcuts (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/penjualan/baru');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const visibleNavItems = navItems.filter((item) => {
    if (isOwner) return true;
    if (item.ownerOnly && !isOwner) return false;
    if (item.permission && !can(item.permission)) return false;
    if (item.anyOfPermissions && !item.anyOfPermissions.some((p) => can(p))) return false;
    return true;
  });

  const handleQuickSwitch = async (username: string, pin: string) => {
    setIsSwitching(true);
    try {
      await quickSwitch(username, pin);
      if (location.pathname === '/permissions' && username !== 'cakrofi') {
        navigate('/');
      }
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 md:flex">
      {/* Sidebar */}
      <aside className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 md:min-h-screen md:w-68 md:shrink-0 md:border-b-0 md:border-r">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/warung-madura-logo.jpg"
              alt="Warung Madura"
              className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
            />
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                Warung Madura
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  3.0
                </span>
              </p>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Berkah 24 Jam</p>
            </div>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
            className="rounded-lg p-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
          </button>
        </div>

        {/* Quick Search Launcher Bar in Sidebar */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/90 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-slate-700 dark:hover:text-slate-300 transition-transform duration-100 ease-out shadow-2xs group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600" />
              <span>Cari atau aksi...</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* User Card & Role Switcher */}
        <div className="mx-3 my-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                {user ? user.name : 'Belum Login'}
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">@{user?.username ?? '-'}</p>
            </div>
            {user && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    isOwner
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  }`}
                >
                  {user.role}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  title="Keluar (Logout)"
                  className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Demo Switcher */}
          <div className="border-t border-slate-200/80 dark:border-slate-700/80 pt-2 mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Shift Switch:
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                disabled={isSwitching || user?.username === 'cakrofi'}
                onClick={() => handleQuickSwitch('cakrofi', '123456')}
                className={`rounded-md py-1 px-1 text-[11px] font-semibold text-center active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer ${
                  user?.username === 'cakrofi'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800'
                }`}
                title="Cak Rofi (PEMILIK - Akses Penuh)"
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" /> Rofi
                </span>
              </button>
              <button
                type="button"
                disabled={isSwitching || user?.username === 'udin'}
                onClick={() => handleQuickSwitch('udin', '1111')}
                className={`rounded-md py-1 px-1 text-[11px] font-semibold text-center active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer ${
                  user?.username === 'udin'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800'
                }`}
                title="Udin (STAF Gudang)"
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <User className="h-3 w-3 text-blue-500" /> Udin
                </span>
              </button>
              <button
                type="button"
                disabled={isSwitching || user?.username === 'sari'}
                onClick={() => handleQuickSwitch('sari', '2222')}
                className={`rounded-md py-1 px-1 text-[11px] font-semibold text-center active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer ${
                  user?.username === 'sari'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800'
                }`}
                title="Sari (STAF Kasir)"
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <User className="h-3 w-3 text-blue-500" /> Sari
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          <div className="hidden md:block px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Modul Bisnis
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 hidden md:flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Berkah 24 Jam
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px]">Aktif</span>
          </span>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="min-w-0 flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Top Operational Bar */}
        <div className="mb-6 hidden md:flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Operasional Aktif · Buka 24 Jam
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Cari Command</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-500 dark:text-slate-300">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => navigate('/penjualan/baru')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-transform duration-100 ease-out shadow-xs cursor-pointer"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Kasir (F2)</span>
            </button>
          </div>
        </div>

        <Outlet />
      </main>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </div>
  );
}
