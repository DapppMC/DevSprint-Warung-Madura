import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Download,
  Search,
} from 'lucide-react';
import { getErrorMessage } from '../api/http';
import { deleteProduct, listProducts, updateProduct } from '../api/products';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { ProductFormModal } from '../components/ProductFormModal';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  btnSmallDanger,
  inputClass,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { LOW_STOCK_THRESHOLD } from '../lib/constants';
import { formatNumber, formatRupiah } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/AuthContext';
import type { Product } from '../types/api';

type FormState = { mode: 'create' } | { mode: 'edit'; product: Product } | null;

export function ProductsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [formState, setFormState] = useState<FormState>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(() => listProducts({ search: query }), [query]);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast.success(`Produk "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await updateProduct(deactivateTarget.id, { isActive: false });
      toast.success(`Produk "${deactivateTarget.name}" berhasil dinonaktifkan.`);
      setDeactivateTarget(null);
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      setDeactivateTarget(null);
    } finally {
      setDeactivating(false);
    }
  }

  async function handleActivate(product: Product) {
    try {
      await updateProduct(product.id, { isActive: true });
      toast.success(`Produk "${product.name}" berhasil diaktifkan kembali.`);
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
    }
  }

  const handleExportProductsCsv = () => {
    if (!products || !products.length) return;
    const canViewCost = can('cost:view');
    const headers = [
      'SKU',
      'Nama Produk',
      'Kategori',
      ...(canViewCost ? ['Harga Beli (Modal)'] : []),
      'Harga Jual',
      'Stok Fisik',
      'Satuan Dasar',
      'Satuan Beli',
      'Isi per Satuan Beli',
      'Status',
    ];

    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.category,
      ...(canViewCost ? [p.purchasePrice ?? ''] : []),
      p.sellingPrice,
      p.stock,
      p.baseUnit,
      p.purchaseUnit,
      p.unitsPerPurchaseUnit,
      p.isActive ? 'Aktif' : 'Nonaktif',
    ]);

    downloadCsv(`katalog_produk_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const hasCostPermission = can('cost:view');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog & Master Produk"
        description="Kelola komoditas dagang, harga jual eceran, konversi multi-satuan, dan kuantitas stok fisik."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportProductsCsv}
              disabled={!products || products.length === 0}
              className={btnSecondary}
              title="Unduh Katalog Produk (CSV)"
            >
              <Download className="h-4 w-4" /> Unduh Katalog (CSV)
            </button>
            {can('product:manage') && (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setFormState({ mode: 'create' })}
              >
                <Plus className="h-4 w-4" /> Tambah Produk Baru
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="w-full sm:max-w-sm relative">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="search"
            className={`${inputClass} pl-9`}
            placeholder="Cari nama barang, SKU, atau kategori..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Cari produk"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium self-end sm:self-auto">
          Menampilkan <strong className="font-mono text-slate-900 dark:text-slate-100">{products?.length ?? 0}</strong> produk
        </div>
      </div>

      {/* Main Table with Sticky Header position: sticky; top: 0; z-index: 20 */}
      <div className={tableContainerClass}>
        {loading && !products && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {products && products.length === 0 && !loading && (
          <EmptyState
            title={query ? 'Produk tidak ditemukan' : 'Belum ada produk di katalog'}
            description={
              query ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Tambahkan produk pertama untuk mulai berjualan.'
            }
          />
        )}

        {products && products.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border-separate border-spacing-0">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thStickyClass}>SKU</th>
                <th className={thStickyClass}>Nama Komoditas</th>
                <th className={thStickyClass}>Kategori</th>
                {hasCostPermission && (
                  <th className={`${thStickyClass} text-right`}>Harga Beli (Modal)</th>
                )}
                <th className={`${thStickyClass} text-right`}>Harga Jual</th>
                <th className={`${thStickyClass} text-right`}>Stok Fisik</th>
                <th className={thStickyClass}>Konversi Satuan</th>
                <th className={thStickyClass}>Status</th>
                <th className={`${thStickyClass} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
              {products.map((product) => {
                const isLow = product.stock <= LOW_STOCK_THRESHOLD;
                return (
                  <tr
                    key={product.id}
                    className={`transition-transform duration-100 ease-out ${
                      product.isActive
                        ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
                        : 'bg-slate-50/40 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 hover:bg-slate-100/40 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className={`${tdClass} font-mono font-bold text-slate-700 dark:text-slate-300`}>
                      {product.sku}
                    </td>
                    <td className={`${tdClass} font-bold ${product.isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {product.name}
                    </td>
                    <td className={tdClass}>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {product.category}
                      </span>
                    </td>
                    {hasCostPermission && (
                      <td className={`${tdClass} text-right font-mono font-semibold text-slate-800 dark:text-slate-200`}>
                        {product.purchasePrice !== undefined
                          ? formatRupiah(product.purchasePrice)
                          : '-'}
                      </td>
                    )}
                    <td className={`${tdClass} text-right font-mono font-bold text-emerald-800 dark:text-emerald-400`}>
                      {formatRupiah(product.sellingPrice)}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-extrabold`}>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                          isLow
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {formatNumber(product.stock)} {product.baseUnit}
                      </span>
                    </td>
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400 font-mono text-[11px]`}>
                      1 {product.purchaseUnit} = {product.unitsPerPurchaseUnit} {product.baseUnit}
                    </td>
                    <td className={tdClass}>
                      {product.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1">
                        {can('stock:adjust') && (
                          <button
                            type="button"
                            className={btnSmall}
                            onClick={() => setAdjustTarget(product)}
                            title="Koreksi Stok Fisik"
                          >
                            Koreksi
                          </button>
                        )}
                        {can('product:manage') && (
                          <>
                            <button
                              type="button"
                              className={btnSmall}
                              onClick={() => setFormState({ mode: 'edit', product })}
                              title="Edit Data Produk"
                            >
                              Edit
                            </button>
                            {product.isActive ? (
                              <button
                                type="button"
                                className={btnSmallDanger}
                                onClick={() => setDeactivateTarget(product)}
                                title="Nonaktifkan Produk"
                              >
                                Nonaktifkan
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={btnSmall}
                                onClick={() => handleActivate(product)}
                                title="Aktifkan Kembali"
                              >
                                Aktifkan
                              </button>
                            )}
                            <button
                              type="button"
                              className={btnSmallDanger}
                              onClick={() => setDeleteTarget(product)}
                              title="Hapus Produk"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal (Create / Edit) */}
      {formState && (
        <ProductFormModal
          product={formState.mode === 'edit' ? formState.product : null}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            reload();
          }}
        />
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <StockAdjustmentModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            setAdjustTarget(null);
            reload();
          }}
        />
      )}

      {/* Deactivate Confirmation */}
      {deactivateTarget && (
        <ConfirmDialog
          title="Nonaktifkan Produk"
          message={`Apakah Anda yakin ingin menonaktifkan "${deactivateTarget.name}"? Produk nonaktif tidak akan muncul di kasir penjualan.`}
          confirmLabel="Nonaktifkan"
          busy={deactivating}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Produk"
          message={`Hapus produk "${deleteTarget.name}" permanen? Jika produk sudah memiliki riwayat mutasi stok, sistem akan menyarankan untuk menonaktifkannya.`}
          confirmLabel="Hapus Permanen"
          busy={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
