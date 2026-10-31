import { useCallback, useMemo, useState } from 'react';
import {
  Search,
  ShoppingCart,
  Receipt,
  Plus,
  Trash2,
} from 'lucide-react';
import { getErrorMessage, ApiError } from '../api/http';
import { listProducts } from '../api/products';
import { createSale } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import { ReceiptModal } from '../components/ReceiptModal';
import { useAuth } from '../lib/AuthContext';
import {
  btnPrimary,
  cardClass,
  inputClass,
  labelClass,
} from '../components/ui';
import { formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { SaleRequestItem, SaleDetail } from '../types/api';

export function NewSalePage() {
  const toast = useToast();
  const { user } = useAuth();

  // Only active products that are in stock can be sold.
  const loadProducts = useCallback(() => listProducts({ inStock: true, activeOnly: true }), []);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');
  const [cart, setCart] = useState<SaleRequestItem[]>([]);
  const [cashTendered, setCashTendered] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);

  const productsById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products],
  );

  // Available categories
  const categories = useMemo(() => {
    if (!products) return ['SEMUA'];
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['SEMUA', ...Array.from(set)];
  }, [products]);

  // Filtered product catalog for quick POS drawer
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchCat = selectedCategory === 'SEMUA' || p.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Rows in the active cart
  const rows = cart.flatMap((line) => {
    const product = productsById.get(line.productId);
    return product ? [{ line, product, subtotal: product.sellingPrice * line.quantity }] : [];
  });
  const total = rows.reduce((sum, row) => sum + row.subtotal, 0);

  const parsedCash = Number(cashTendered) || 0;
  const change = Math.max(0, parsedCash - total);
  const isCashSufficient = parsedCash >= total && total > 0;

  function handleAddToCart(productId: string, qtyToAdd = 1) {
    const product = productsById.get(productId);
    if (!product) return;

    const existing = cart.find((line) => line.productId === product.id);
    const newQuantity = (existing?.quantity ?? 0) + qtyToAdd;

    if (newQuantity > product.stock) {
      toast.error(`Stok ${product.name} hanya tersisa ${product.stock} ${product.baseUnit}.`);
      return;
    }

    setCart((current) =>
      existing
        ? current.map((line) =>
            line.productId === product.id ? { ...line, quantity: newQuantity } : line,
          )
        : [...current, { productId: product.id, quantity: qtyToAdd }],
    );
  }

  function handleChangeQuantity(productId: string, value: string, maxStock: number) {
    const parsed = Math.floor(Number(value));
    const next = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maxStock) : 1;
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity: next } : line)),
    );
  }

  function handleRemove(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function handleSetTender(amount: number) {
    setCashTendered(String(amount));
  }

  function handleAddTender(amount: number) {
    setCashTendered(String(parsedCash + amount));
  }

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const sale = await createSale(cart);
      toast.success(`Penjualan ${sale.invoiceNumber} berhasil disimpan.`);
      
      // Construct full detail for receipt
      const detail: SaleDetail = {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        total: sale.total,
        createdAt: sale.createdAt,
        items: rows.map((r) => ({
          id: r.line.productId,
          productId: r.line.productId,
          productName: r.product.name,
          productSku: r.product.sku,
          quantity: r.line.quantity,
          unitPrice: r.product.sellingPrice,
          subtotal: r.subtotal,
        })),
      };

      setCompletedSale(detail);
      setCart([]);
      setCashTendered('');
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      if (caught instanceof ApiError && caught.status === 409) reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kasir Express (POS Sat-Set)"
        description="Pilih atau cari komoditas, kelola keranjang belanja, kalkulasi uang kembalian, dan cetak struk termal."
      />

      {loading && !products && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {products && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Product Selection & Catalog Drawer (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Quick Search & Barcode Input */}
            <div className={`${cardClass} p-4`}>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode atau ketik SKU / Nama Produk (Enter untuk pilih)..."
                  className={`${inputClass} pl-9`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts.length > 0) {
                      e.preventDefault();
                      handleAddToCart(filteredProducts[0].id, 1);
                      toast.success(`Ditambahkan: ${filteredProducts[0].name}`);
                      setSearchQuery('');
                    }
                  }}
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Quick-Pick Cards */}
            <div className={`${cardClass} p-4 max-h-[520px] overflow-y-auto`}>
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Daftar Komoditas Tersedia ({filteredProducts.length})</span>
                <span className="text-[11px] font-mono">Klik untuk tambah ke keranjang</span>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState
                  title="Produk tidak ditemukan"
                  description="Coba gunakan kata kunci pencarian atau kategori lain."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredProducts.map((p) => {
                    const inCart = cart.find((c) => c.productId === p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddToCart(p.id, 1)}
                        className="group flex flex-col justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xs active:scale-[0.98] transition-transform duration-100 ease-out cursor-pointer"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {p.sku}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                              p.stock <= 5
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                              Stok {p.stock}
                            </span>
                          </div>
                          <p className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{p.category}</p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
                          <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatRupiah(p.sellingPrice)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 group-hover:text-emerald-600">
                            {inCart ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold tabular-nums">
                                di keranjang ({inCart.quantity})
                              </span>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" /> Tambah
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Cart & Cash Checkout Drawer (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <section className={`${cardClass} overflow-hidden flex flex-col`}>
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Keranjang Belanja ({rows.length})
                  </h2>
                </div>
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {/* Cart Items Table */}
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Keranjang masih kosong</p>
                    <p>Pilih produk dari katalog di sebelah kiri untuk memulai transaksi.</p>
                  </div>
                ) : (
                  rows.map(({ line, product, subtotal }) => (
                    <div
                      key={line.productId}
                      className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          @ {formatRupiah(product.sellingPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={product.stock}
                          step={1}
                          value={line.quantity}
                          onChange={(e) =>
                            handleChangeQuantity(line.productId, e.target.value, product.stock)
                          }
                          className={`${inputClass} w-16 text-center font-bold tabular-nums px-1 py-1`}
                        />
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums w-20 text-right">
                          {formatRupiah(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(line.productId)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-transform duration-100 ease-out cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment & Cash Calculator Section */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 p-4 space-y-3">
                {/* Total Billing */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Total Tagihan
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatRupiah(total)}
                  </span>
                </div>

                {/* Cash Tender Input */}
                <div>
                  <label className={labelClass} htmlFor="cash-tendered">
                    Uang Diterima dari Pelanggan (Tunai)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      id="cash-tendered"
                      type="number"
                      min={0}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="Masukkan nominal uang tunai..."
                      className={`${inputClass} pl-9 font-mono tabular-nums font-bold`}
                    />
                  </div>

                  {/* Fast Tender Buttons */}
                  <div className="grid grid-cols-5 gap-1 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSetTender(total)}
                      disabled={total === 0}
                      className="px-1.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform duration-100"
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTender(10000)}
                      className="px-1.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer active:scale-[0.98] transition-transform duration-100"
                    >
                      +10rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTender(20000)}
                      className="px-1.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer active:scale-[0.98] transition-transform duration-100"
                    >
                      +20rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTender(50000)}
                      className="px-1.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer active:scale-[0.98] transition-transform duration-100"
                    >
                      +50rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTender(100000)}
                      className="px-1.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer active:scale-[0.98] transition-transform duration-100"
                    >
                      +100rb
                    </button>
                  </div>
                </div>

                {/* Kembalian Pill */}
                {total > 0 && parsedCash > 0 && (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    isCashSufficient
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}>
                    <span>
                      {isCashSufficient ? 'Kembalian Pelanggan:' : 'Uang Pembayaran Kurang:'}
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      {isCashSufficient ? formatRupiah(change) : formatRupiah(total - parsedCash)}
                    </span>
                  </div>
                )}

                {/* Submit Checkout Button */}
                <button
                  type="button"
                  className={`${btnPrimary} w-full py-2.5 text-sm font-bold shadow-md`}
                  onClick={handleSubmit}
                  disabled={rows.length === 0 || submitting}
                >
                  <Receipt className="h-4 w-4" />
                  {submitting ? 'Memproses Transaksi...' : `Bayar & Simpan (${formatRupiah(total)})`}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal on Completed Transaction */}
      <ReceiptModal
        sale={completedSale}
        cashReceived={parsedCash}
        cashierName={user?.name ?? 'Kasir Madura'}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
}
