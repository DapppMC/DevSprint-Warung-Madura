import { Printer, Download, CheckCircle2, Store } from 'lucide-react';
import { Modal } from './Modal';
import { btnPrimary, btnSecondary } from './ui';
import { formatDateTime, formatRupiah, formatNumber } from '../lib/format';
import type { SaleDetail, SaleSummary } from '../types/api';

interface ReceiptModalProps {
  sale: SaleDetail | SaleSummary | null;
  cashReceived?: number;
  cashierName?: string;
  onClose: () => void;
}

export function ReceiptModal({ sale, cashReceived, cashierName = 'Kasir Madura', onClose }: ReceiptModalProps) {
  if (!sale) return null;

  const total = sale.total;
  const tender = cashReceived && cashReceived >= total ? cashReceived : total;
  const change = Math.max(0, tender - total);
  const items = 'items' in sale ? sale.items : [];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const lines = [
      '==========================================',
      '       WARUNG MADURA "BERKAH 24 JAM"      ',
      '      Jl. Raya Madura No. 24 - Surabaya   ',
      '           Telp: 0812-3456-7890           ',
      '==========================================',
      `No. Nota  : ${sale.invoiceNumber}`,
      `Tanggal   : ${formatDateTime(sale.createdAt)}`,
      `Kasir     : ${cashierName}`,
      '------------------------------------------',
      ...items.map(
        (it) =>
          `${it.productName.padEnd(24).slice(0, 24)} x${it.quantity}\n` +
          `  @${formatRupiah(it.unitPrice)}`.padEnd(20) +
          `= ${formatRupiah(it.subtotal)}`,
      ),
      '------------------------------------------',
      `TOTAL BELANJA : ${formatRupiah(total)}`,
      `TUNAI         : ${formatRupiah(tender)}`,
      `KEMBALIAN     : ${formatRupiah(change)}`,
      '==========================================',
      '  Matur Sakalangkong (Terima Kasih)       ',
      '    Barang yang sudah dibeli tidak        ',
      '     dapat ditukar / dikembalikan.        ',
      '       Semoga Berkah Selalu!              ',
      '==========================================',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Struk-${sale.invoiceNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Struk Pembayaran Berhasil" onClose={onClose}>
      <div className="space-y-4">
        {/* Success Alert Banner */}
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs">
            <p className="font-bold">Transaksi Penjualan Berhasil Disimpan</p>
            <p className="text-emerald-700 dark:text-emerald-400">
              Stok produk telah terpotong otomatis dan riwayat mutasi kasir tercatat.
            </p>
          </div>
        </div>

        {/* Authentic Thermal Receipt Preview Area */}
        <div
          id="thermal-receipt-print-area"
          className="mx-auto w-full max-w-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm font-mono text-xs text-slate-800 dark:text-slate-200 selection:bg-amber-200"
        >
          {/* Receipt Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-center mb-1">
              <span className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                <Store className="h-5 w-5" />
              </span>
            </div>
            <p className="font-black text-sm tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              WARUNG MADURA
            </p>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tracking-widest">
              "BERKAH 24 JAM"
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Buka Non-Stop · Sembako, Kopi, Mie & Es
            </p>
          </div>

          {/* Metadata */}
          <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Nota:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {sale.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Waktu:</span>
              <span className="tabular-nums">{formatDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Kasir:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{cashierName}</span>
            </div>
          </div>

          {/* Itemized Lines */}
          <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.id} className="text-[11px]">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {item.productName}
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="tabular-nums">
                      {formatNumber(item.quantity)} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-[11px]">
                <span>Total Item Belanja</span>
                <span className="font-bold">{formatRupiah(total)}</span>
              </div>
            )}
          </div>

          {/* Calculation Summary */}
          <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between text-xs font-black text-slate-900 dark:text-slate-100">
              <span>TOTAL</span>
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatRupiah(total)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tunai</span>
              <span className="tabular-nums">{formatRupiah(tender)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
              <span>Kembalian</span>
              <span className="tabular-nums">{formatRupiah(change)}</span>
            </div>
          </div>

          {/* Footer Warm Note */}
          <div className="pt-3 text-center text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-bold text-slate-700 dark:text-slate-300">
              Matur Sakalangkong (Terima Kasih)
            </p>
            <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
            <p className="italic font-medium text-emerald-600 dark:text-emerald-400">
              Semoga Barokah & Lancar Rezeki!
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button type="button" onClick={handleDownloadTxt} className={btnSecondary}>
            <Download className="h-4 w-4" /> Unduh TXT
          </button>
          <button type="button" onClick={handlePrint} className={btnSecondary}>
            <Printer className="h-4 w-4" /> Cetak Struk
          </button>
          <button type="button" onClick={onClose} className={btnPrimary}>
            Selesai
          </button>
        </div>
      </div>
    </Modal>
  );
}
