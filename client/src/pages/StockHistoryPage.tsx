import { useCallback, useState } from 'react';
import {
  Download,
  ArrowDownLeft,
  ShoppingCart,
  Scale,
  Sparkles,
  Layers,
} from 'lucide-react';
import { listProducts } from '../api/products';
import { listStockMovements } from '../api/stock';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { Modal } from '../components/Modal';
import {
  btnSecondary,
  btnSmall,
  cardClass,
  inputClass,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { formatDateTime, formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { useAsyncData } from '../lib/useAsyncData';
import type { StockMovement, StockMovementType } from '../types/api';

const typeStyles: Record<
  StockMovementType,
  { label: string; className: string; sign: string; icon: typeof ArrowDownLeft }
> = {
  INITIAL: {
    label: 'Stok Awal',
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    sign: '+',
    icon: Sparkles,
  },
  SALE: {
    label: 'Penjualan',
    className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    sign: '−',
    icon: ShoppingCart,
  },
  ADJUSTMENT_IN: {
    label: 'Penyesuaian Masuk',
    className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    sign: '+',
    icon: Scale,
  },
  ADJUSTMENT_OUT: {
    label: 'Penyesuaian Keluar',
    className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    sign: '−',
    icon: Scale,
  },
  RECEIPT: {
    label: 'Barang Masuk',
    className: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    sign: '+',
    icon: ArrowDownLeft,
  },
};

export function StockHistoryPage() {
  const [productId, setProductId] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'TIMELINE'>('TABLE');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  const loadProducts = useCallback(() => listProducts(), []);
  const { data: products } = useAsyncData(loadProducts);

  const loadMovements = useCallback(
    () => listStockMovements({ productId: productId || undefined }),
    [productId],
  );
  const { data: movements, error, loading, reload } = useAsyncData(loadMovements);

  const filteredMovements = (movements ?? []).filter((m) => {
    if (selectedType === 'ALL') return true;
    if (selectedType === 'ADJUSTMENT') return m.type.startsWith('ADJUSTMENT_');
    return m.type === selectedType;
  });

  const handleExportCsv = () => {
    if (!movements || movements.length === 0) return;
    const headers = [
      'ID Mutasi',
      'Waktu Transaksi',
      'Nama Produk',
      'SKU',
      'Klasifikasi',
      'Jumlah Mutasi',
      'Stok Sebelum',
      'Stok Sesudah',
      'Tipe Referensi',
      'Label Dokumen',
      'Alasan Penyesuaian',
      'Catatan Audit',
    ];
    const rows = filteredMovements.map((m) => [
      m.id,
      formatDateTime(m.createdAt),
      m.productName,
      m.productSku,
      typeStyles[m.type].label,
      `${typeStyles[m.type].sign}${m.quantity}`,
      m.beforeStock,
      m.afterStock,
      m.referenceType ?? '-',
      m.referenceLabel ?? '-',
      m.reason ?? '-',
      m.note ?? '-',
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`riwayat_mutasi_stok_warung_madura_${dateStr}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Mutasi Stok"
        description="Audit trail kronologis seluruh aliran barang masuk, barang keluar kasir, dan penyesuaian fisik rak."
        actions={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!movements || filteredMovements.length === 0}
            className={btnSecondary}
            title="Ekspor Seluruh Log Mutasi ke Format CSV Spreadsheet (RFC 4180)"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Unduh Arsip (CSV)</span>
          </button>
        }
      />

      {/* Filter and Mode Controls */}
      <div className={`${cardClass} p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Product Select Dropdown */}
          <div className="min-w-[200px] flex-1 sm:flex-initial">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputClass}
              aria-label="Filter produk"
            >
              <option value="">Semua Produk ({products?.length ?? 0})</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Pills (No AI Slop / Emojis) */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'Semua Mutasi', icon: Layers },
              { id: 'RECEIPT', label: 'Barang Masuk', icon: ArrowDownLeft },
              { id: 'SALE', label: 'Penjualan', icon: ShoppingCart },
              { id: 'ADJUSTMENT', label: 'Koreksi Stok', icon: Scale },
              { id: 'INITIAL', label: 'Stok Awal', icon: Sparkles },
            ].map((pill) => {
              const Icon = pill.icon;
              const isSelected = selectedType === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedType(pill.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold transition-transform duration-100 ease-out cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode Toggle (Table vs Timeline) */}
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start lg:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`rounded-md px-3 py-1 text-xs font-bold transition-transform duration-100 ease-out cursor-pointer ${
              viewMode === 'TABLE'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tabel Rinci
          </button>
          <button
            type="button"
            onClick={() => setViewMode('TIMELINE')}
            className={`rounded-md px-3 py-1 text-xs font-bold transition-transform duration-100 ease-out cursor-pointer ${
              viewMode === 'TIMELINE'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Timeline Visual
          </button>
        </div>
      </div>

      {loading && !movements && <LoadingState />}
      {error && (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {filteredMovements.length === 0 && !loading && (
        <EmptyState
          title="Belum ada riwayat mutasi stok untuk filter ini"
          description="Lakukan penerimaan barang masuk atau transaksi penjualan untuk mencatat mutasi stok."
        />
      )}

      {/* TABLE VIEW (with Sticky Header position: sticky; top: 0; z-index: 20) */}
      {viewMode === 'TABLE' && filteredMovements.length > 0 && (
        <div className={tableContainerClass}>
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border-separate border-spacing-0">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thStickyClass}>Waktu Transaksi</th>
                <th className={thStickyClass}>Produk</th>
                <th className={thStickyClass}>Klasifikasi</th>
                <th className={`${thStickyClass} text-right`}>Kuantitas</th>
                <th className={`${thStickyClass} text-right`}>Sebelum</th>
                <th className={`${thStickyClass} text-right`}>Sesudah</th>
                <th className={thStickyClass}>Audit Referensi</th>
                <th className={`${thStickyClass} text-right`}>Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredMovements.map((movement) => {
                const style = typeStyles[movement.type];
                const Icon = style.icon;

                return (
                  <tr key={movement.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-transform duration-100 ease-out">
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400`}>
                      {formatDateTime(movement.createdAt)}
                    </td>
                    <td className={tdClass}>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{movement.productName}</span>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                        {movement.productSku}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${style.className}`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span>{style.label}</span>
                      </span>
                    </td>
                    <td
                      className={`${tdClass} text-right font-mono font-bold ${
                        style.sign === '+'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {style.sign}
                      {formatNumber(movement.quantity)}
                    </td>
                    <td className={`${tdClass} text-right font-mono text-slate-500 dark:text-slate-400`}>
                      {formatNumber(movement.beforeStock)}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-bold text-slate-900 dark:text-slate-100`}>
                      {formatNumber(movement.afterStock)}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                          {movement.referenceLabel ?? (movement.referenceType ? `${movement.referenceType}` : 'Manual')}
                        </span>
                        {movement.reason && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            {movement.reason}
                          </span>
                        )}
                        {movement.note && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate max-w-[180px]">
                            "{movement.note}"
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={() => setSelectedMovement(movement)}
                        className={btnSmall}
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TIMELINE VISUAL VIEW */}
      {viewMode === 'TIMELINE' && filteredMovements.length > 0 && (
        <div className={`${cardClass} p-6`}>
          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-6">
            {filteredMovements.map((movement) => {
              const style = typeStyles[movement.type];
              const Icon = style.icon;

              return (
                <div key={movement.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-[37px] top-1 flex h-7 w-7 items-center justify-center rounded-full border shadow-xs ${style.className}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 p-4 transition-transform duration-100 ease-out hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {movement.productName}
                          </span>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            ({movement.productSku})
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${style.className}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatDateTime(movement.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span
                            className={`text-base font-black font-mono ${
                              style.sign === '+'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {style.sign}
                            {formatNumber(movement.quantity)} unit
                          </span>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            Stok: {movement.beforeStock} → <strong>{movement.afterStock}</strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMovement(movement)}
                          className={btnSmall}
                        >
                          Lihat Detail
                        </button>
                      </div>
                    </div>

                    {(movement.referenceLabel || movement.note) && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>
                          Referensi:{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200">
                            {movement.referenceLabel ?? '-'}
                          </strong>
                        </span>
                        {movement.reason && (
                          <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded font-semibold border border-amber-200 dark:border-amber-800">
                            Alasan: {movement.reason}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Modal for Historical Data Inspector */}
      {selectedMovement && (
        <Modal
          title={`Detail Log Mutasi Stok: ${selectedMovement.productName}`}
          subtitle={`Waktu Pencatatan: ${formatDateTime(selectedMovement.createdAt)}`}
          onClose={() => setSelectedMovement(null)}
          size="lg"
          headerAction={
            <button
              type="button"
              onClick={() => {
                downloadCsv(
                  `slip_mutasi_${selectedMovement.id.slice(0, 8)}.csv`,
                  ['ID', 'Produk', 'SKU', 'Tipe', 'Qty', 'Sebelum', 'Sesudah', 'Ref', 'Catatan'],
                  [[
                    selectedMovement.id,
                    selectedMovement.productName,
                    selectedMovement.productSku,
                    selectedMovement.type,
                    selectedMovement.quantity,
                    selectedMovement.beforeStock,
                    selectedMovement.afterStock,
                    selectedMovement.referenceLabel ?? '',
                    selectedMovement.note ?? '',
                  ]]
                );
              }}
              className={btnSmall}
              title="Unduh Slip CSV"
            >
              <Download className="h-3 w-3" /> Unduh Slip
            </button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-4">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Nama Produk:</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedMovement.productName}</p>
                <p className="font-mono text-slate-400 dark:text-slate-500">SKU: {selectedMovement.productSku}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Klasifikasi Mutasi:</span>
                <p className="mt-0.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold border ${typeStyles[selectedMovement.type].className}`}
                  >
                    {typeStyles[selectedMovement.type].label}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Kuantitas Terpengaruh:</span>
                <p className="text-base font-black font-mono text-emerald-800 dark:text-emerald-400">
                  {typeStyles[selectedMovement.type].sign}
                  {formatNumber(selectedMovement.quantity)} unit
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Integritas Stok (Sebelum → Sesudah):</span>
                <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                  {selectedMovement.beforeStock} unit → {selectedMovement.afterStock} unit
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-100">Jejak Audit & Referensi Dokumen</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Tipe Referensi:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedMovement.referenceType ?? 'Manual'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Nomor/Label Dokumen:</span>
                  <p className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                    {selectedMovement.referenceLabel ?? '-'}
                  </p>
                </div>
                {selectedMovement.reason && (
                  <div className="col-span-2">
                    <span className="text-slate-400 dark:text-slate-500">Alasan Penyesuaian:</span>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">{selectedMovement.reason}</p>
                  </div>
                )}
                {selectedMovement.note && (
                  <div className="col-span-2">
                    <span className="text-slate-400 dark:text-slate-500">Catatan Petugas:</span>
                    <p className="italic text-slate-700 dark:text-slate-300">"{selectedMovement.note}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
