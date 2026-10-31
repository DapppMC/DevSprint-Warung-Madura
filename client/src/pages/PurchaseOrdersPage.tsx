import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowDownLeft,
} from 'lucide-react';
import { getErrorMessage } from '../api/http';
import { listProducts } from '../api/products';
import {
  cancelRemainingPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
} from '../api/purchase-orders';
import { listSuppliers } from '../api/suppliers';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { useToast } from '../components/ToastProvider';
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  btnSmallDanger,
  inputClass,
  labelClass,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { formatDate } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/AuthContext';
import type {
  Product,
  PurchaseOrderDetail,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
  Supplier,
} from '../types/api';

export function statusBadge(status: PurchaseOrderStatus) {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Clock className="h-3 w-3" /> OPEN
        </span>
      );
    case 'PARTIAL':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" /> SEBAGIAN
        </span>
      );
    case 'COMPLETE':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> SELESAI
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <XCircle className="h-3 w-3" /> DIBATALKAN
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {status}
        </span>
      );
  }
}

interface NewPOLineItem {
  productId: string;
  quantity: string;
}

interface CreatePOModalProps {
  onClose: () => void;
  onSaved: () => void;
  suppliers: Supplier[];
  products: Product[];
  onSupplierAdded?: (supplier: Supplier) => void;
}

function CreatePOModal({
  onClose,
  onSaved,
  suppliers,
  products,
  onSupplierAdded,
}: CreatePOModalProps) {
  const toast = useToast();
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<NewPOLineItem[]>([
    { productId: products[0]?.id ?? '', quantity: '1' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSuppliers(suppliers);
    if (!supplierId && suppliers[0]?.id) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers, supplierId]);

  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? '', quantity: '1' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof NewPOLineItem, val: string) {
    setLines((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Supplier wajib dipilih');
      return;
    }

    if (lines.length === 0) {
      setError('Minimal harus ada satu item pesanan');
      return;
    }

    for (const line of lines) {
      if (!line.productId) {
        setError('Pilih produk untuk semua baris');
        return;
      }
      const qty = Number(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        setError('Jumlah pesanan harus lebih besar dari 0');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createPurchaseOrder({
        supplierId,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
        })),
      });
      toast.success('Purchase Order berhasil dibuat.');
      onSaved();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Buat Purchase Order Baru" onClose={onClose} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass} htmlFor="po-supplier">
              Supplier / Pemasok Grosir <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold underline"
              onClick={() => setShowAddSupplier(true)}
            >
              + Tambah Supplier Baru
            </button>
          </div>
          <select
            id="po-supplier"
            className={inputClass}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">-- Pilih Supplier --</option>
            {localSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.phone ? `(${s.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="po-note">
            Catatan Pemesanan (Opsional)
          </label>
          <input
            id="po-note"
            className={inputClass}
            placeholder="misal: Kirim sebelum pukul 11 siang"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelClass}>Daftar Komoditas yang Dipesan</label>
            <button type="button" className={btnSmall} onClick={addLine}>
              + Tambah Baris
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const selectedProduct = products.find((p) => p.id === line.productId);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 text-xs"
                >
                  <div className="flex-1">
                    <select
                      className={inputClass}
                      value={line.productId}
                      onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                      required
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Satuan Beli: {p.purchaseUnit} (isi {p.unitsPerPurchaseUnit} {p.baseUnit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={inputClass}
                      placeholder="Jumlah"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <span className="w-16 font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                    {selectedProduct?.purchaseUnit ?? 'dus'}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-bold p-1"
                      onClick={() => removeLine(idx)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Memproses PO...' : 'Simpan Purchase Order'}
          </button>
        </div>
      </form>

      {showAddSupplier && (
        <SupplierFormModal
          onClose={() => setShowAddSupplier(false)}
          onSuccess={(newSup: Supplier) => {
            setShowAddSupplier(false);
            setLocalSuppliers((prev) => [...prev, newSup]);
            setSupplierId(newSup.id);
            if (onSupplierAdded) onSupplierAdded(newSup);
          }}
        />
      )}
    </Modal>
  );
}

interface DetailModalProps {
  poId: string;
  onClose: () => void;
  onCancelRemainingClick: (po: PurchaseOrderDetail) => void;
}

function DetailModal({ poId, onClose, onCancelRemainingClick }: DetailModalProps) {
  const { can } = useAuth();
  const loadDetail = useCallback(() => getPurchaseOrder(poId), [poId]);
  const { data: po, error, loading } = useAsyncData(loadDetail);

  const handleExportDetail = () => {
    if (!po) return;
    const headers = ['SKU', 'Nama Produk', 'Satuan Beli', 'Isi Konversi', 'Dipesan', 'Diterima', 'Sisa'];
    const rows = po.lines.map((l) => [
      l.productSku,
      l.productName,
      l.purchaseUnit,
      l.unitsPerPurchaseUnit,
      l.orderedBase / l.unitsPerPurchaseUnit,
      l.fulfilledBase / l.unitsPerPurchaseUnit,
      l.remainingBase / l.unitsPerPurchaseUnit,
    ]);
    downloadCsv(`rekonsiliasi_po_${po.orderNumber}.csv`, headers, rows);
  };

  return (
    <Modal
      title={`Detail Rekonsiliasi: ${po?.orderNumber ?? 'Memuat...'}`}
      subtitle={po ? `Distributor: ${po.supplierName} · Tanggal: ${formatDate(po.orderedAt)}` : undefined}
      onClose={onClose}
      size="2xl"
      headerAction={
        po && (
          <button type="button" onClick={handleExportDetail} className={btnSmall} title="Unduh CSV Rekonsiliasi">
            <Download className="h-3 w-3" /> Unduh Arsip
          </button>
        )
      }
    >
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {po && (
        <div className="space-y-5 text-xs">
          {/* Header Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Supplier Grosir:</span>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{po.supplierName}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Status Rekonsiliasi:</span>
              <div className="mt-1">{statusBadge(po.status)}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tanggal Dipesan:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(po.orderedAt)}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Item PO:</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">{po.lines.length} komoditas</p>
            </div>
            {po.note && (
              <div className="col-span-2 sm:col-span-4 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Catatan: </span> {po.note}
              </div>
            )}
            {po.cancelReason && (
              <div className="col-span-2 sm:col-span-4 rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2.5 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                <span className="font-bold">Alasan Pembatalan Sisa: </span>
                {po.cancelReason}
              </div>
            )}
          </div>

          {/* Line Items Table with Reconciliation Progress */}
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Progres Pemenuhan Baris Komoditas</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thStickyClass}>Komoditas & SKU</th>
                    <th className={`${thStickyClass} text-right`}>Dipesan</th>
                    <th className={`${thStickyClass} text-right`}>Diterima</th>
                    <th className={`${thStickyClass} text-right`}>Sisa</th>
                    <th className={`${thStickyClass} w-36 text-center`}>Progres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                  {po.lines.map((line) => {
                    const ratio = line.unitsPerPurchaseUnit || 1;
                    const orderedPurch = line.orderedBase / ratio;
                    const fulfilledPurch = line.fulfilledBase / ratio;
                    const remainingPurch = line.remainingBase / ratio;
                    const pct = line.orderedBase > 0 ? Math.min(100, Math.round((line.fulfilledBase / line.orderedBase) * 100)) : 0;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className={tdClass}>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{line.productName}</span>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            {line.productSku} (1 {line.purchaseUnit} = {line.unitsPerPurchaseUnit} {line.baseUnit})
                          </span>
                        </td>
                        <td className={`${tdClass} text-right font-mono font-bold text-slate-800 dark:text-slate-200`}>
                          {orderedPurch} {line.purchaseUnit}
                        </td>
                        <td className={`${tdClass} text-right font-mono font-bold text-emerald-700 dark:text-emerald-400`}>
                          {fulfilledPurch} {line.purchaseUnit}
                        </td>
                        <td
                          className={`${tdClass} text-right font-mono font-bold ${
                            remainingPurch > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {remainingPurch} {line.purchaseUnit}
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                              <div
                                className={`h-full rounded-full transition-transform duration-100 ease-out ${
                                  pct >= 100 ? 'bg-emerald-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[11px] w-9 text-right text-slate-600 dark:text-slate-400">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Linked Goods Receipts History */}
          {po.goodsReceipts && po.goodsReceipts.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Riwayat Penerimaan Fisik Terkait (GR)</h4>
              <div className="space-y-2">
                {po.goodsReceipts.map((gr) => (
                  <div
                    key={gr.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{gr.receiptNumber}</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDate(gr.receivedAt)} · Penerima: {gr.receivedByName}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                      {gr.itemCount} barang masuk
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
            <div>
              {can('purchase_order:manage') && (po.status === 'OPEN' || po.status === 'PARTIAL') && (
                <button
                  type="button"
                  className={btnSmallDanger}
                  onClick={() => onCancelRemainingClick(po)}
                >
                  Batalkan Sisa Pesanan Ini
                </button>
              )}
            </div>
            <button type="button" className={btnSecondary} onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PurchaseOrdersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [detailPoId, setDetailPoId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; orderNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    return Promise.all([
      listPurchaseOrders(filterStatus === 'ALL' ? undefined : { status: filterStatus }),
      listSuppliers(),
      listProducts({}),
    ]);
  }, [filterStatus]);

  const { data, error, loading, reload } = useAsyncData(loadData);
  const purchaseOrders: PurchaseOrderSummary[] = data ? data[0] : [];
  const suppliers: Supplier[] = data ? data[1] : [];
  const products: Product[] = data ? data[2].filter((p) => p.isActive) : [];

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelRemainingPurchaseOrder(cancelTarget.id, { reason: cancelReason.trim() });
      toast.success(`Sisa pesanan ${cancelTarget.orderNumber} berhasil dibatalkan.`);
      setCancelTarget(null);
      setCancelReason('');
      reload();
    } catch (err) {
      setCancelError(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const handleExportAllPos = () => {
    if (!purchaseOrders.length) return;
    const headers = ['Nomor PO', 'Supplier', 'Tanggal', 'Status', 'Jumlah Item', 'Catatan'];
    const rows = purchaseOrders.map((po) => [
      po.orderNumber,
      po.supplierName,
      formatDate(po.orderedAt),
      po.status,
      po.lineCount,
      po.note ?? '',
    ]);
    downloadCsv(`daftar_purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Order & Rekonsiliasi"
        description="Pantau pemesanan grosir, rekonsiliasi pengiriman parsial, dan penyelesaian sisa pesanan."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportAllPos}
              disabled={purchaseOrders.length === 0}
              className={btnSecondary}
              title="Unduh Daftar PO (CSV)"
            >
              <Download className="h-4 w-4" /> Unduh Daftar (CSV)
            </button>
            {can('purchase_order:manage') && (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" /> Buat PO Baru
              </button>
            )}
          </div>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-2">Filter Status:</span>
        {[
          { id: 'ALL', label: 'Semua Status' },
          { id: 'OPEN', label: 'Open' },
          { id: 'PARTIAL', label: 'Sebagian (Partial)' },
          { id: 'COMPLETE', label: 'Selesai' },
          { id: 'CANCELLED', label: 'Dibatalkan' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id as PurchaseOrderStatus | 'ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-transform duration-100 ease-out cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table with Sticky Header position: sticky; top: 0; z-index: 20 */}
      <div className={tableContainerClass}>
        {loading && !data && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {purchaseOrders && purchaseOrders.length === 0 && !loading && (
          <EmptyState
            title="Tidak ada Purchase Order ditemukan"
            description="Buat pesanan pertama ke supplier untuk memulai pencatatan logistik."
          />
        )}

        {purchaseOrders && purchaseOrders.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border-separate border-spacing-0">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thStickyClass}>Nomor PO</th>
                <th className={thStickyClass}>Supplier</th>
                <th className={thStickyClass}>Tanggal Pesan</th>
                <th className={thStickyClass}>Status</th>
                <th className={`${thStickyClass} text-right`}>Jumlah Item</th>
                <th className={thStickyClass}>Catatan</th>
                <th className={`${thStickyClass} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
              {purchaseOrders.map((po) => {
                return (
                  <tr key={po.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-transform duration-100 ease-out">
                    <td className={`${tdClass} font-mono font-bold text-slate-900 dark:text-slate-100`}>
                      <button
                        type="button"
                        onClick={() => setDetailPoId(po.id)}
                        className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left cursor-pointer"
                      >
                        {po.orderNumber}
                      </button>
                    </td>
                    <td className={`${tdClass} font-semibold text-slate-800 dark:text-slate-200`}>
                      {po.supplierName}
                    </td>
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400`}>
                      {formatDate(po.orderedAt)}
                    </td>
                    <td className={tdClass}>
                      {statusBadge(po.status)}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-bold text-slate-700 dark:text-slate-300`}>
                      {po.lineCount} jenis barang
                    </td>
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400 truncate max-w-[180px]`}>
                      {po.note ?? '-'}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          className={btnSmall}
                          onClick={() => setDetailPoId(po.id)}
                        >
                          Lihat Detail
                        </button>
                        {can('purchase_order:manage') && (po.status === 'OPEN' || po.status === 'PARTIAL') && (
                          <button
                            type="button"
                            className={btnSmallDanger}
                            onClick={() => setCancelTarget({ id: po.id, orderNumber: po.orderNumber })}
                            title="Batalkan Sisa Pesanan"
                          >
                            Batal Sisa
                          </button>
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

      {/* Create PO Modal */}
      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          products={products}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            reload();
          }}
          onSupplierAdded={() => reload()}
        />
      )}

      {/* Interactive Detail Modal */}
      {detailPoId && (
        <DetailModal
          poId={detailPoId}
          onClose={() => setDetailPoId(null)}
          onCancelRemainingClick={(po) => {
            setDetailPoId(null);
            setCancelTarget({ id: po.id, orderNumber: po.orderNumber });
          }}
        />
      )}

      {/* Cancel Remaining Modal Prompt */}
      {cancelTarget && (
        <Modal
          title={`Batalkan Sisa Pesanan: ${cancelTarget.orderNumber}`}
          onClose={() => setCancelTarget(null)}
          size="md"
        >
          <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
            {cancelError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
                {cancelError}
              </div>
            )}

            <p className="text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin membatalkan sisa barang yang belum dikirim untuk PO{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100">{cancelTarget.orderNumber}</strong>?
              Sisa kuantitas akan dihapus dari antrean pengiriman dan status PO akan ditutup secara transaksional.
            </p>

            <div>
              <label className={labelClass} htmlFor="cancel-reason">
                Alasan Pembatalan (Opsional)
              </label>
              <textarea
                id="cancel-reason"
                className={inputClass}
                rows={3}
                placeholder="misal: Supplier kehabisan stok pabrik, sisa tidak dikirim."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Kembali
              </button>
              <button
                type="submit"
                className={btnDanger}
                disabled={cancelling}
              >
                {cancelling ? 'Membatalkan...' : 'Konfirmasi Batalkan Sisa'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
