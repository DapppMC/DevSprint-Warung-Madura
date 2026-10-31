import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
} from 'lucide-react';
import { getSale, listSales } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { Modal } from '../components/Modal';
import {
  btnSecondary,
  btnSmall,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { formatDateTime, formatRupiah } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { useAsyncData } from '../lib/useAsyncData';
import type { SaleDetail } from '../types/api';

export function SalesHistoryPage() {
  const { data: sales, error, loading, reload } = useAsyncData(listSales);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [activeSaleDetail, setActiveSaleDetail] = useState<SaleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleOpenDetailModal = async (saleId: string) => {
    setDetailSaleId(saleId);
    setLoadingDetail(true);
    try {
      const res = await getSale(saleId);
      setActiveSaleDetail(res);
    } catch {
      setActiveSaleDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExportSalesCsv = () => {
    if (!sales || !sales.length) return;
    const headers = ['Nomor Faktur', 'Waktu Transaksi', 'Jumlah Item', 'Total Transaksi (Rp)'];
    const rows = sales.map((s) => [
      s.invoiceNumber,
      formatDateTime(s.createdAt),
      s.itemCount,
      s.total,
    ]);
    downloadCsv(`riwayat_penjualan_kasir_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Penjualan & Transaksi Kasir"
        description="Arsip seluruh faktur penjualan eceran di warung secara kronologis."
        actions={
          <button
            type="button"
            onClick={handleExportSalesCsv}
            disabled={!sales || sales.length === 0}
            className={btnSecondary}
            title="Unduh Riwayat Penjualan (CSV)"
          >
            <Download className="h-4 w-4" /> Unduh Arsip (CSV)
          </button>
        }
      />

      {/* Main Table with Sticky Header position: sticky; top: 0; z-index: 20 */}
      <div className={tableContainerClass}>
        {loading && !sales && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {sales && sales.length === 0 && !loading && (
          <EmptyState
            title="Belum ada transaksi penjualan"
            description="Faktur penjualan akan muncul di sini setelah transaksi kasir berhasil dicatat."
          />
        )}

        {sales && sales.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thStickyClass}>No. Faktur / Invoice</th>
                <th className={thStickyClass}>Waktu Transaksi</th>
                <th className={`${thStickyClass} text-right`}>Jumlah Item</th>
                <th className={`${thStickyClass} text-right`}>Total Transaksi</th>
                <th className={`${thStickyClass} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60 text-xs">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-transform duration-100 ease-out">
                  <td className={`${tdClass} font-mono font-bold text-slate-900 dark:text-slate-100`}>
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(sale.id)}
                      className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left"
                    >
                      {sale.invoiceNumber}
                    </button>
                  </td>
                  <td className={`${tdClass} text-slate-500 dark:text-slate-400`}>
                    {formatDateTime(sale.createdAt)}
                  </td>
                  <td className={`${tdClass} text-right font-mono font-bold text-slate-700 dark:text-slate-300`}>
                    {sale.itemCount} barang
                  </td>
                  <td className={`${tdClass} text-right font-mono font-extrabold text-emerald-800 dark:text-emerald-400 text-sm`}>
                    {formatRupiah(sale.total)}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        className={btnSmall}
                        onClick={() => handleOpenDetailModal(sale.id)}
                      >
                        Lihat Detail
                      </button>
                      <Link
                        to={`/riwayat-penjualan/${sale.id}`}
                        className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-transform duration-100 ease-out"
                      >
                        Halaman Faktur
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Interactive Detail Modal for Historical Sale */}
      {detailSaleId && (
        <Modal
          title={`Detail Faktur Penjualan: ${activeSaleDetail?.invoiceNumber ?? 'Memuat...'}`}
          subtitle={
            activeSaleDetail
              ? `Tanggal: ${formatDateTime(activeSaleDetail.createdAt)} · Total: ${formatRupiah(activeSaleDetail.total)}`
              : undefined
          }
          onClose={() => {
            setDetailSaleId(null);
            setActiveSaleDetail(null);
          }}
          size="lg"
          headerAction={
            activeSaleDetail && (
              <button
                type="button"
                onClick={() => {
                  const headers = ['SKU', 'Nama Produk', 'Jumlah', 'Harga Satuan', 'Subtotal'];
                  const rows = activeSaleDetail.items.map((i) => [
                    i.productSku,
                    i.productName,
                    i.quantity,
                    i.unitPrice,
                    i.subtotal,
                  ]);
                  downloadCsv(`slip_${activeSaleDetail.invoiceNumber}.csv`, headers, rows);
                }}
                className={btnSmall}
                title="Unduh Slip CSV"
              >
                <Download className="h-3 w-3" /> Unduh Slip
              </button>
            )
          }
        >
          {loadingDetail && <LoadingState label="Memuat rincian transaksi..." />}
          {activeSaleDetail && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-4 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Nomor Nota:</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {activeSaleDetail.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Pembayaran:</span>
                  <p className="font-mono font-extrabold text-emerald-800 dark:text-emerald-400 text-base">
                    {formatRupiah(activeSaleDetail.total)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Item Belanja</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className={thStickyClass}>Komoditas</th>
                        <th className={`${thStickyClass} text-right`}>Qty</th>
                        <th className={`${thStickyClass} text-right`}>Harga</th>
                        <th className={`${thStickyClass} text-right`}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                      {activeSaleDetail.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className={tdClass}>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.productName}</span>
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-400">{item.productSku}</span>
                          </td>
                          <td className={`${tdClass} text-right font-mono font-bold text-slate-800 dark:text-slate-200`}>
                            {item.quantity}
                          </td>
                          <td className={`${tdClass} text-right font-mono text-slate-600 dark:text-slate-300`}>
                            {formatRupiah(item.unitPrice)}
                          </td>
                          <td className={`${tdClass} text-right font-mono font-bold text-emerald-800 dark:text-emerald-400`}>
                            {formatRupiah(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <Link
                  to={`/riwayat-penjualan/${activeSaleDetail.id}`}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-transform duration-100 ease-out"
                >
                  Buka Halaman Penuh Nota
                </Link>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setDetailSaleId(null);
                    setActiveSaleDetail(null);
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
