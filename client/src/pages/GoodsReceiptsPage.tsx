import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Plus,
  Lock,
} from 'lucide-react';
import { getGoodsReceipt, listGoodsReceipts, createGoodsReceipt } from '../api/goods-receipts';
import { getErrorMessage } from '../api/http';
import { listProducts } from '../api/products';
import { getPurchaseOrder, listPurchaseOrders } from '../api/purchase-orders';
import { listStaff } from '../api/staff';
import { listSuppliers } from '../api/suppliers';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StaffFormModal } from '../components/StaffFormModal';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { SupplierFormModal } from '../components/SupplierFormModal';
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  inputClass,
  labelClass,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { formatDate, formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/AuthContext';
import type {
  GoodsReceiptDetail,
  GoodsReceiptRejectReason,
  GoodsReceiptSummary,
  Product,
  PurchaseOrderDetail,
  PurchaseOrderSummary,
  Staff,
  Supplier,
} from '../types/api';

interface ReceiptLineDraft {
  productId: string;
  productName: string;
  sku: string;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
  remainingPoQuantity: number | null;
  qtyReceivedPurch: string;
  qtyRejectedPurch: string;
  rejectReason: GoodsReceiptRejectReason | '';
  rejectNote: string;
  qtyBonusPurch: string;
  unitCostPurch: string;
}

interface CreateReceiptModalProps {
  onClose: () => void;
  onSuccess: (receipt: GoodsReceiptDetail) => void;
  suppliers: Supplier[];
  staffList: Staff[];
  products: Product[];
  openPurchaseOrders: PurchaseOrderSummary[];
  onSupplierAdded?: (supplier: Supplier) => void;
  onStaffAdded?: (staff: Staff) => void;
}

function CreateReceiptModal({
  onClose,
  onSuccess,
  suppliers,
  staffList,
  products,
  openPurchaseOrders,
  onSupplierAdded,
  onStaffAdded,
}: CreateReceiptModalProps) {
  const { user, isStaff } = useAuth();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
  const [localStaffList, setLocalStaffList] = useState<Staff[]>(staffList);
  const [showAddSupplier, setShowAddSupplier] = useState<boolean>(false);
  const [showAddStaff, setShowAddStaff] = useState<boolean>(false);
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? '');
  
  // Anti-impersonation: default to logged in user's staffId if staff
  const defaultStaffId = isStaff && user?.staffId ? user.staffId : (staffList[0]?.id ?? '');
  const [receivedById, setReceivedById] = useState<string>(defaultStaffId);
  const [suratJalan, setSuratJalan] = useState<string>('');
  const [lines, setLines] = useState<ReceiptLineDraft[]>([]);
  const [loadingPo, setLoadingPo] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSuppliers(suppliers);
    if (!supplierId && suppliers[0]?.id) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers, supplierId]);

  useEffect(() => {
    setLocalStaffList(staffList);
    if (!receivedById && defaultStaffId) {
      setReceivedById(defaultStaffId);
    }
  }, [staffList, receivedById, defaultStaffId]);

  useEffect(() => {
    if (!selectedPoId) return;

    let active = true;
    setLoadingPo(true);
    getPurchaseOrder(selectedPoId)
      .then((po: PurchaseOrderDetail) => {
        if (!active) return;
        setSupplierId(po.supplierId);
        const draftLines: ReceiptLineDraft[] = po.lines
          .filter((l) => l.remainingBase > 0)
          .map((l) => {
            const prod = products.find((p) => p.id === l.productId);
            const unitsPerPurch = l.unitsPerPurchaseUnit || prod?.unitsPerPurchaseUnit || 1;
            const purchPrice = prod?.purchasePrice ? prod.purchasePrice * unitsPerPurch : 0;
            const remainingPurch = l.remainingBase / unitsPerPurch;
            return {
              productId: l.productId,
              productName: l.productName,
              sku: l.productSku,
              baseUnit: l.baseUnit,
              purchaseUnit: l.purchaseUnit,
              unitsPerPurchaseUnit: unitsPerPurch,
              remainingPoQuantity: remainingPurch,
              qtyReceivedPurch: String(remainingPurch),
              qtyRejectedPurch: '0',
              rejectReason: '',
              rejectNote: '',
              qtyBonusPurch: '0',
              unitCostPurch: String(purchPrice),
            };
          });
        setLines(draftLines);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingPo(false);
      });

    return () => {
      active = false;
    };
  }, [selectedPoId, products]);

  function addManualLine() {
    const prod = products[0];
    if (!prod) return;
    setLines((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        baseUnit: prod.baseUnit,
        purchaseUnit: prod.purchaseUnit,
        unitsPerPurchaseUnit: prod.unitsPerPurchaseUnit,
        remainingPoQuantity: null,
        qtyReceivedPurch: '1',
        qtyRejectedPurch: '0',
        rejectReason: '',
        rejectNote: '',
        qtyBonusPurch: '0',
        unitCostPurch: String((prod.purchasePrice || 0) * prod.unitsPerPurchaseUnit),
      },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine<K extends keyof ReceiptLineDraft>(
    idx: number,
    field: K,
    val: ReceiptLineDraft[K],
  ) {
    setLines((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p.id === val);
        if (prod) {
          copy[idx] = {
            ...copy[idx],
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            baseUnit: prod.baseUnit,
            purchaseUnit: prod.purchaseUnit,
            unitsPerPurchaseUnit: prod.unitsPerPurchaseUnit,
            unitCostPurch: String((prod.purchasePrice || 0) * prod.unitsPerPurchaseUnit),
          };
          return copy;
        }
      }
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Supplier wajib dipilih.');
      return;
    }
    if (!receivedById) {
      setError('Staff penerima wajib dipilih.');
      return;
    }
    if (lines.length === 0) {
      setError('Harap masukkan minimal satu item barang yang diterima.');
      return;
    }

    const payloadLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ratio = line.unitsPerPurchaseUnit || 1;
      const recPurch = Number(line.qtyReceivedPurch);
      const rejPurch = Number(line.qtyRejectedPurch) || 0;
      const bonPurch = Number(line.qtyBonusPurch) || 0;
      const costPurch = Number(line.unitCostPurch) || 0;

      if (isNaN(recPurch) || recPurch < 0) {
        setError(`Item #${i + 1} (${line.productName}): Qty Datang tidak valid.`);
        return;
      }
      if (rejPurch < 0) {
        setError(`Item #${i + 1} (${line.productName}): Qty Ditolak tidak boleh negatif.`);
        return;
      }
      if (rejPurch > recPurch) {
        setError(
          `Item #${i + 1} (${line.productName}): Qty Ditolak (${rejPurch}) melebihi Qty Datang (${recPurch}).`,
        );
        return;
      }
      if (rejPurch > 0 && !line.rejectReason) {
        setError(
          `Item #${i + 1} (${line.productName}): Alasan tolak wajib dipilih karena ada barang ditolak.`,
        );
        return;
      }
      if (line.rejectReason === 'LAINNYA' && !line.rejectNote.trim()) {
        setError(
          `Item #${i + 1} (${line.productName}): Alasan LAINNYA wajib disertai catatan penolakan.`,
        );
        return;
      }

      const receivedBase = Math.round(recPurch * ratio);
      const rejectedBase = Math.round(rejPurch * ratio);
      const bonusBase = Math.round(bonPurch * ratio);

      payloadLines.push({
        productId: line.productId,
        receivedBase,
        rejectedBase,
        rejectReason: rejPurch > 0 ? (line.rejectReason as GoodsReceiptRejectReason) : undefined,
        rejectNote: rejPurch > 0 && line.rejectNote.trim() ? line.rejectNote.trim() : undefined,
        bonusBase,
        unitCostPerPurchaseUnit: costPurch,
      });
    }

    setSubmitting(true);
    try {
      const res = await createGoodsReceipt({
        idempotencyKey,
        purchaseOrderId: selectedPoId || undefined,
        supplierId,
        receivedById,
        note: suratJalan.trim() ? `Surat Jalan: ${suratJalan.trim()}` : undefined,
        lines: payloadLines,
      });
      onSuccess(res);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Penerimaan Barang Masuk (Fisik)" onClose={onClose} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="gr-po-select">
              Hubungkan ke Purchase Order (Opsional)
            </label>
            <select
              id="gr-po-select"
              className={inputClass}
              value={selectedPoId}
              onChange={(e) => {
                setSelectedPoId(e.target.value);
                setLines([]);
              }}
            >
              <option value="">-- Penerimaan Langsung (Tanpa PO) --</option>
              {openPurchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.orderNumber} ({po.supplierName} - {po.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass} htmlFor="gr-supplier">
                Supplier / Pengirim <span className="text-rose-500">*</span>
              </label>
              {!selectedPoId && (
                <button
                  type="button"
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold underline"
                  onClick={() => setShowAddSupplier(true)}
                >
                  + Supplier Baru
                </button>
              )}
            </div>
            <select
              id="gr-supplier"
              className={inputClass}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={Boolean(selectedPoId)}
              required
            >
              <option value="">-- Pilih Supplier --</option>
              {localSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass} htmlFor="gr-staff">
                Petugas Penerima (Staff) <span className="text-rose-500">*</span>
              </label>
              {!isStaff && (
                <button
                  type="button"
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold underline"
                  onClick={() => setShowAddStaff(true)}
                >
                  + Staff Baru
                </button>
              )}
            </div>
            <select
              id="gr-staff"
              className={inputClass}
              value={receivedById}
              onChange={(e) => setReceivedById(e.target.value)}
              disabled={isStaff && Boolean(user?.staffId)}
              required
            >
              <option value="">-- Pilih Staff Penerima --</option>
              {localStaffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {user?.staffId === st.id ? '(Akun Anda)' : ''}
                </option>
              ))}
            </select>
            {isStaff && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium flex items-center gap-1">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Terkunci pada profil staf Anda untuk mencegah impersonasi tanda tangan fisik.</span>
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="gr-surat-jalan">
              Nomor Surat Jalan Distributor
            </label>
            <input
              id="gr-surat-jalan"
              className={inputClass}
              placeholder="misal: SJ-2026-991"
              value={suratJalan}
              onChange={(e) => setSuratJalan(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        {/* Lines Container */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelClass}>Daftar Komoditas Fisik yang Tiba</label>
            {!selectedPoId && (
              <button type="button" className={btnSmall} onClick={addManualLine}>
                + Tambah Komoditas
              </button>
            )}
          </div>

          {lines.length === 0 && !loadingPo && (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-3 text-center bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
              {selectedPoId
                ? 'Semua baris item pada PO ini telah selesai dipenuhi.'
                : 'Belum ada baris barang. Klik "+ Tambah Komoditas" di atas.'}
            </p>
          )}

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const recPurch = Number(line.qtyReceivedPurch) || 0;
              const rejPurch = Number(line.qtyRejectedPurch) || 0;
              const bonPurch = Number(line.qtyBonusPurch) || 0;
              const ratio = line.unitsPerPurchaseUnit || 1;
              const netAcceptedPurch = Math.max(0, recPurch - rejPurch);
              const totalStockInBase = (netAcceptedPurch + bonPurch) * ratio;

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/50 pb-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {line.productName} <span className="font-mono text-slate-400 dark:text-slate-500">({line.sku})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        1 {line.purchaseUnit} = {line.unitsPerPurchaseUnit} {line.baseUnit}
                        {line.remainingPoQuantity !== null && (
                          <span className="ml-2 font-bold text-amber-700 dark:text-amber-400">
                            (Sisa di PO: {line.remainingPoQuantity} {line.purchaseUnit})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 font-bold font-mono text-[11px]">
                        +{totalStockInBase} {line.baseUnit} ke stok
                      </span>
                      {!selectedPoId && lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-bold p-1"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                        Datang ({line.purchaseUnit})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        value={line.qtyReceivedPurch}
                        onChange={(e) => updateLine(idx, 'qtyReceivedPurch', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-1">
                        Ditolak / Rusak
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        value={line.qtyRejectedPurch}
                        onChange={(e) => updateLine(idx, 'qtyRejectedPurch', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block mb-1">
                        Bonus Pabrik
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        value={line.qtyBonusPurch}
                        onChange={(e) => updateLine(idx, 'qtyBonusPurch', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                        Harga / {line.purchaseUnit}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className={inputClass}
                        value={line.unitCostPurch}
                        onChange={(e) => updateLine(idx, 'unitCostPurch', e.target.value)}
                      />
                    </div>
                  </div>

                  {rejPurch > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 p-2 border border-rose-200 dark:border-rose-800/80">
                      <div>
                        <label className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase block mb-1">
                          Alasan Penolakan <span className="text-rose-600 dark:text-rose-400">*</span>
                        </label>
                        <select
                          className={inputClass}
                          value={line.rejectReason}
                          onChange={(e) =>
                            updateLine(idx, 'rejectReason', e.target.value as GoodsReceiptRejectReason)
                          }
                          required
                        >
                          <option value="">-- Pilih Alasan --</option>
                          <option value="PENYOK">PENYOK / KARDUS RUSAK</option>
                          <option value="KEDALUWARSA">KEDALUWARSA / KADALUARSA</option>
                          <option value="LAINNYA">LAINNYA (Wajib Catatan)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase block mb-1">
                          Catatan Rinci Penolakan
                        </label>
                        <input
                          type="text"
                          className={inputClass}
                          placeholder="misal: Segel botol pecah"
                          value={line.rejectNote}
                          onChange={(e) => updateLine(idx, 'rejectNote', e.target.value)}
                        />
                      </div>
                    </div>
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
            {submitting ? 'Menyimpan Penerimaan...' : 'Konfirmasi Barang Masuk'}
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

      {showAddStaff && (
        <StaffFormModal
          onClose={() => setShowAddStaff(false)}
          onSuccess={(newSt: Staff) => {
            setShowAddStaff(false);
            setLocalStaffList((prev) => [...prev, newSt]);
            setReceivedById(newSt.id);
            if (onStaffAdded) onStaffAdded(newSt);
          }}
        />
      )}
    </Modal>
  );
}

interface DetailModalProps {
  receiptId: string;
  onClose: () => void;
}

function DetailModal({ receiptId, onClose }: DetailModalProps) {
  const loadDetail = useCallback(() => getGoodsReceipt(receiptId), [receiptId]);
  const { data: gr, error, loading } = useAsyncData(loadDetail);

  const handleExportCsv = () => {
    if (!gr) return;
    const headers = [
      'Nomor GR',
      'SKU',
      'Nama Produk',
      'Satuan Beli',
      'Diterima (Pcs)',
      'Ditolak (Pcs)',
      'Bonus (Pcs)',
      'HPP Dasar',
      'HPP Efektif',
    ];
    const rows = gr.lines.map((l) => [
      gr.receiptNumber,
      l.productSku,
      l.productName,
      l.purchaseUnit,
      l.receivedBase,
      l.rejectedBase,
      l.bonusBase,
      l.costPerBaseUnit ?? 'Locked',
      l.effectiveCostPerBaseUnit ?? 'Locked',
    ]);
    downloadCsv(`arsip_penerimaan_${gr.receiptNumber}.csv`, headers, rows);
  };

  return (
    <Modal
      title={`Surat Penerimaan Barang: ${gr?.receiptNumber ?? 'Memuat...'}`}
      subtitle={gr ? `Supplier: ${gr.supplierName} · Penerima: ${gr.receivedByName}` : undefined}
      onClose={onClose}
      size="2xl"
      headerAction={
        gr && (
          <button type="button" onClick={handleExportCsv} className={btnSmall} title="Unduh Arsip CSV">
            <Download className="h-3 w-3" /> Unduh Arsip
          </button>
        )
      }
    >
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {gr && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Nomor Dokumen:</span>
              <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{gr.receiptNumber}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Waktu Kedatangan:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDateTime(gr.receivedAt)}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Petugas Penerima:</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">{gr.receivedByName}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">PO Terkait:</span>
              <p className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                {gr.purchaseOrderNumber ?? 'Penerimaan Langsung'}
              </p>
            </div>
            {gr.note && (
              <div className="col-span-2 sm:col-span-4 pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Catatan Pengiriman: </span>
                {gr.note}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Rincian Fisik & Snapshot HPP Modal</h4>
            <div className="space-y-3">
              {gr.lines.map((line) => {
                const netAccepted = line.receivedBase - line.rejectedBase;
                const totalStockIn = netAccepted + line.bonusBase;
                return (
                  <div
                    key={line.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{line.productName}</span>
                        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          SKU: {line.productSku} | Konversi: 1 {line.purchaseUnit} = {line.unitsPerPurchaseUnit} pcs
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 text-xs font-bold font-mono">
                        +{formatNumber(totalStockIn)} unit masuk stok
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold">Datang</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {formatNumber(line.receivedBase)} pcs
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold">Ditolak</span>
                        <p
                          className={`font-bold font-mono ${
                            line.rejectedBase > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatNumber(line.rejectedBase)} pcs {line.rejectReason ? `(${line.rejectReason})` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold">Bonus</span>
                        <p
                          className={`font-bold font-mono ${
                            line.bonusBase > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatNumber(line.bonusBase)} pcs
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold">Biaya Satuan</span>
                        <p className="font-bold font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          {line.unitCostPerPurchaseUnit !== undefined ? (
                            formatRupiah(line.unitCostPerPurchaseUnit)
                          ) : (
                            <>
                              <Lock className="h-3 w-3 text-slate-400" />
                              <span>Terkunci</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Cost Masking Protection */}
                    {line.costPerBaseUnit !== undefined ? (
                      <div className="flex justify-between items-center rounded-lg bg-slate-50 dark:bg-slate-800/80 p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        <span>HPP Dasar: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatRupiah(line.costPerBaseUnit)}</strong> / unit</span>
                        <span>HPP Efektif (Bonus): <strong className="font-mono text-emerald-800 dark:text-emerald-400">{formatRupiah(line.effectiveCostPerBaseUnit)}</strong> / unit</span>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                        <span>HPP modal disembunyikan (memerlukan izin Lihat Harga Modal)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="button" className={btnSecondary} onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function GoodsReceiptsPage() {
  const { can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    return Promise.all([
      listGoodsReceipts(),
      listSuppliers(),
      listStaff(),
      listProducts({}),
      listPurchaseOrders().catch(() => []),
    ]);
  }, []);

  const { data, error, loading, reload } = useAsyncData(loadData);
  const receipts: GoodsReceiptSummary[] = data ? data[0] : [];
  const suppliers: Supplier[] = data ? data[1] : [];
  const staffList: Staff[] = data ? data[2] : [];
  const products: Product[] = data ? data[3].filter((p) => p.isActive) : [];
  const openPurchaseOrders = data
    ? data[4].filter((po: PurchaseOrderSummary) => po.status === 'OPEN' || po.status === 'PARTIAL')
    : [];

  const handleExportSummaryCsv = () => {
    if (!receipts.length) return;
    const headers = ['Nomor GR', 'Tanggal', 'Supplier', 'PO Ref', 'Penerima', 'Item Count'];
    const rows = receipts.map((gr) => [
      gr.receiptNumber,
      formatDate(gr.receivedAt),
      gr.supplierName,
      gr.purchaseOrderNumber ?? 'Langsung',
      gr.receivedByName,
      gr.itemCount,
    ]);
    downloadCsv(`daftar_barang_masuk_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barang Masuk & Rekonsiliasi Logistik"
        description="Pencatatan fisik barang datang, penolakan barang cacat/penyok, bonus pabrik, dan snapshot HPP modal."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSummaryCsv}
              disabled={receipts.length === 0}
              className={btnSecondary}
              title="Unduh Daftar Barang Masuk (CSV)"
            >
              <Download className="h-4 w-4" /> Unduh Arsip (CSV)
            </button>
            {can('goods_receipt:create') && (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" /> Terima Barang Masuk
              </button>
            )}
          </div>
        }
      />

      {/* Main Table with Sticky Header position: sticky; top: 0; z-index: 20 */}
      <div className={tableContainerClass}>
        {loading && !data && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {receipts && receipts.length === 0 && !loading && (
          <EmptyState
            title="Belum ada riwayat penerimaan barang fisik"
            description="Klik tombol 'Terima Barang Masuk' untuk mencatat armada logistik tiba di toko."
          />
        )}

        {receipts && receipts.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thStickyClass}>Nomor GR</th>
                <th className={thStickyClass}>Tanggal Tiba</th>
                <th className={thStickyClass}>Supplier Distributor</th>
                <th className={thStickyClass}>Nomor PO</th>
                <th className={thStickyClass}>Petugas Penerima</th>
                <th className={`${thStickyClass} text-right`}>Jumlah Item</th>
                <th className={`${thStickyClass} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60 text-xs">
              {receipts.map((gr) => (
                <tr key={gr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-transform duration-100 ease-out">
                  <td className={`${tdClass} font-mono font-bold text-slate-900 dark:text-slate-100`}>
                    <button
                      type="button"
                      onClick={() => setDetailId(gr.id)}
                      className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left"
                    >
                      {gr.receiptNumber}
                    </button>
                  </td>
                  <td className={`${tdClass} text-slate-500 dark:text-slate-400`}>
                    {formatDate(gr.receivedAt)}
                  </td>
                  <td className={`${tdClass} font-semibold text-slate-800 dark:text-slate-200`}>
                    {gr.supplierName}
                  </td>
                  <td className={tdClass}>
                    {gr.purchaseOrderNumber ? (
                      <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold">
                        {gr.purchaseOrderNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic">Langsung (Tanpa PO)</span>
                    )}
                  </td>
                  <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>
                    {gr.receivedByName}
                  </td>
                  <td className={`${tdClass} text-right font-mono font-bold text-slate-700 dark:text-slate-300`}>
                    {gr.itemCount} jenis barang
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <button
                      type="button"
                      className={btnSmall}
                      onClick={() => setDetailId(gr.id)}
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateReceiptModal
          suppliers={suppliers}
          staffList={staffList}
          products={products}
          openPurchaseOrders={openPurchaseOrders}
          onClose={() => setShowCreate(false)}
          onSupplierAdded={() => reload()}
          onStaffAdded={() => reload()}
          onSuccess={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}

      {detailId && (
        <DetailModal receiptId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
