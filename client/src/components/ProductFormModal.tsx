import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/http';
import { createProduct, updateProduct } from '../api/products';
import type { Product } from '../types/api';
import { Modal } from './Modal';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui';

interface ProductFormModalProps {
  // null = create a new product, otherwise edit this product.
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const isEdit = product !== null;
  const [sku, setSku] = useState(product?.sku ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [purchasePrice, setPurchasePrice] = useState(product ? String(product.purchasePrice) : '');
  const [sellingPrice, setSellingPrice] = useState(product ? String(product.sellingPrice) : '');
  const [stock, setStock] = useState('0');
  const [baseUnit, setBaseUnit] = useState(product?.baseUnit ?? 'pcs');
  const [purchaseUnit, setPurchaseUnit] = useState(product?.purchaseUnit ?? 'pcs');
  const [unitsPerPurchaseUnit, setUnitsPerPurchaseUnit] = useState(
    product ? String(product.unitsPerPurchaseUnit) : '1',
  );
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const values = {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        baseUnit: baseUnit.trim() || 'pcs',
        purchaseUnit: purchaseUnit.trim() || 'pcs',
        unitsPerPurchaseUnit: Math.max(1, Number(unitsPerPurchaseUnit) || 1),
        isActive,
      };
      const saved = product
        ? await updateProduct(product.id, values)
        : await createProduct({ ...values, stock: Number(stock) });
      onSaved(saved);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Ubah Produk' : 'Tambah Produk'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="product-sku">
              SKU
            </label>
            <input
              id="product-sku"
              className={inputClass}
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              required
              maxLength={40}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-category">
              Kategori
            </label>
            <input
              id="product-category"
              className={inputClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              maxLength={60}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="product-name">
            Nama Produk
          </label>
          <input
            id="product-name"
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="product-purchase-price">
              Harga Beli (Rp)
            </label>
            <input
              id="product-purchase-price"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-selling-price">
              Harga Jual (Rp)
            </label>
            <input
              id="product-selling-price"
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="product-base-unit">
              Satuan Dasar
            </label>
            <input
              id="product-base-unit"
              className={inputClass}
              value={baseUnit}
              onChange={(event) => setBaseUnit(event.target.value)}
              placeholder="mis. pcs, bks"
              required
              maxLength={20}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-purchase-unit">
              Satuan Beli
            </label>
            <input
              id="product-purchase-unit"
              className={inputClass}
              value={purchaseUnit}
              onChange={(event) => setPurchaseUnit(event.target.value)}
              placeholder="mis. dus, slop"
              required
              maxLength={20}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-units-per-purchase">
              Isi per Satuan Beli
            </label>
            <input
              id="product-units-per-purchase"
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={unitsPerPurchaseUnit}
              onChange={(event) => setUnitsPerPurchaseUnit(event.target.value)}
              required
            />
          </div>
        </div>

        {isEdit && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-md">
            Hati-hati: mengubah satuan atau rasio isi dapat mempengaruhi perhitungan stok dan riwayat masa lalu.
          </p>
        )}

        {isEdit ? (
          <p className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Stok saat ini: <strong className="text-slate-900 dark:text-white">{product.stock} {product.baseUnit}</strong>. Stok diubah lewat penjualan, penerimaan barang, atau
            penyesuaian stok.
          </p>
        ) : (
          <div>
            <label className={labelClass} htmlFor="product-stock">
              Stok Awal
            </label>
            <input
              id="product-stock"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              required
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="product-status">
            Status Produk
          </label>
          <select
            id="product-status"
            className={inputClass}
            value={isActive ? 'true' : 'false'}
            onChange={(event) => setIsActive(event.target.value === 'true')}
          >
            <option value="true">Aktif (Dapat Dijual)</option>
            <option value="false">Nonaktif (Tidak Dapat Dijual)</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
