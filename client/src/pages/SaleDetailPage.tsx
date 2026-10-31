import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSale } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { btnSecondary, cardClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';

export function SaleDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const loadSale = useCallback(() => getSale(id), [id]);
  const { data: sale, error, loading, reload } = useAsyncData(loadSale);

  return (
    <div>
      <PageHeader
        title={sale ? sale.invoiceNumber : 'Detail Penjualan'}
        description={sale ? formatDateTime(sale.createdAt) : undefined}
        actions={
          <Link to="/riwayat-penjualan" className={btnSecondary}>
            Kembali
          </Link>
        }
      />

      {loading && !sale && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {sale && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Produk</th>
                  <th className={`${thClass} text-right`}>Jumlah</th>
                  <th className={`${thClass} text-right`}>Harga Satuan</th>
                  <th className={`${thClass} text-right`}>Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                {sale.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className={tdClass}>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</span>
                      <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">{item.productSku}</span>
                    </td>
                    <td className={`${tdClass} text-right font-mono font-bold text-slate-800 dark:text-slate-200`}>{item.quantity}</td>
                    <td className={`${tdClass} text-right font-mono text-slate-600 dark:text-slate-300`}>{formatRupiah(item.unitPrice)}</td>
                    <td className={`${tdClass} text-right font-mono font-bold text-emerald-800 dark:text-emerald-400`}>{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 px-5 py-4">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total Transaksi</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatRupiah(sale.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
