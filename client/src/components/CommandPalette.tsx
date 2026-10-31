import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  ArrowDownLeft,
  FileSpreadsheet,
  Package,
  Receipt,
  History,
  ShieldCheck,
  Sun,
  Moon,
  User,
  Crown,
  LayoutDashboard,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { listProducts } from '../api/products';
import { formatRupiah, formatNumber } from '../lib/format';
import type { Product } from '../types/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { isOwner, quickSwitch } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  // Load products once when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      listProducts({ activeOnly: true })
        .then((data) => setProducts(data))
        .catch(() => setProducts([]));
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navActions = useMemo(() => {
    return [
      {
        id: 'nav-dashboard',
        label: 'Buka Dashboard Analitik',
        category: 'Navigasi Cepat',
        icon: LayoutDashboard,
        action: () => {
          navigate('/');
          onClose();
        },
      },
      {
        id: 'nav-pos',
        label: 'Kasir Penjualan Baru (POS)',
        category: 'Transaksi',
        icon: ShoppingCart,
        action: () => {
          navigate('/penjualan/baru');
          onClose();
        },
      },
      {
        id: 'nav-gr',
        label: 'Catat Barang Masuk (Goods Receipt)',
        category: 'Inventaris',
        icon: ArrowDownLeft,
        action: () => {
          navigate('/barang-masuk');
          onClose();
        },
      },
      {
        id: 'nav-po',
        label: 'Purchase Order ke Supplier',
        category: 'Pengadaan',
        icon: FileSpreadsheet,
        action: () => {
          navigate('/purchase-orders');
          onClose();
        },
      },
      {
        id: 'nav-products',
        label: 'Katalog & Master Produk',
        category: 'Inventaris',
        icon: Package,
        action: () => {
          navigate('/produk');
          onClose();
        },
      },
      {
        id: 'nav-sales',
        label: 'Riwayat Transaksi Kasir',
        category: 'Transaksi',
        icon: Receipt,
        action: () => {
          navigate('/riwayat-penjualan');
          onClose();
        },
      },
      {
        id: 'nav-stock',
        label: 'Buku Mutasi & Riwayat Stok',
        category: 'Inventaris',
        icon: History,
        action: () => {
          navigate('/riwayat-stok');
          onClose();
        },
      },
      ...(isOwner
        ? [
            {
              id: 'nav-permissions',
              label: 'Manajemen Izin & Staf (RBAC)',
              category: 'Pengaturan',
              icon: ShieldCheck,
              action: () => {
                navigate('/permissions');
                onClose();
              },
            },
          ]
        : []),
      {
        id: 'action-theme',
        label: isDark ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode',
        category: 'Tampilan',
        icon: isDark ? Sun : Moon,
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'switch-cakrofi',
        label: 'Ganti Akun: Cak Rofi (Pemilik)',
        category: 'Ganti Shift Kasir',
        icon: Crown,
        action: async () => {
          await quickSwitch('cakrofi', '123456');
          onClose();
        },
      },
      {
        id: 'switch-udin',
        label: 'Ganti Akun: Mas Udin (Kasir Pagi)',
        category: 'Ganti Shift Kasir',
        icon: User,
        action: async () => {
          await quickSwitch('udin', '1111');
          onClose();
        },
      },
      {
        id: 'switch-sari',
        label: 'Ganti Akun: Mbak Sari (Kasir Malam)',
        category: 'Ganti Shift Kasir',
        icon: User,
        action: async () => {
          await quickSwitch('sari', '2222');
          onClose();
        },
      },
    ];
  }, [navigate, onClose, isOwner, isDark, toggleTheme, quickSwitch]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return navActions;
    const q = query.toLowerCase();
    return navActions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [navActions, query]);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    ).slice(0, 5);
  }, [products, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-xs overscroll-contain">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-transform duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/90">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik tujuan, menu, atau cari nama komoditas/SKU..."
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-transform duration-100 ease-out"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          {/* Product Hits (If Any) */}
          {filteredProducts.length > 0 && (
            <div className="p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 py-1">
                Katalog Produk Terkait
              </p>
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    navigate('/produk');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-transform duration-100 ease-out text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono text-[10px] font-bold">
                      {prod.sku}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{prod.name}</p>
                      <p className="text-[11px] text-slate-400">{prod.category} · {formatRupiah(prod.sellingPrice)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                      prod.stock <= 5
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      Stok: {formatNumber(prod.stock)} {prod.baseUnit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions & Navigation */}
          <div className="p-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Perintah & Navigasi
            </p>
            {filteredActions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ada aksi yang cocok dengan "{query}".</p>
            ) : (
              filteredActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-transform duration-100 ease-out text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-transform duration-100 ease-out">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.category}</p>
                      </div>
                    </div>
                    <CornerDownLeft className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">Esc</kbd> untuk menutup
          </span>
          <span className="font-medium text-slate-500 dark:text-slate-400">
            Warung Madura Quick Launcher
          </span>
        </div>
      </div>
    </div>
  );
}
