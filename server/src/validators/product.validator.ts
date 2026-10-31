import { z } from 'zod';

const MAX_PRICE = 999_999_999;
const MAX_STOCK = 1_000_000;

function requiredText(label: string, maxLength: number) {
  return z
    .string({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa teks` })
    .trim()
    .min(1, `${label} wajib diisi`)
    .max(maxLength, `${label} maksimal ${maxLength} karakter`);
}

// Rupiah has no minor unit in daily use, so prices are whole numbers.
function wholeNumber(label: string) {
  return z
    .number({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa angka` })
    .int(`${label} harus berupa bilangan bulat`);
}

export const createProductSchema = z.object({
  sku: requiredText('SKU', 40),
  name: requiredText('Nama produk', 120),
  category: requiredText('Kategori', 60),
  purchasePrice: wholeNumber('Harga beli')
    .min(0, 'Harga beli tidak boleh negatif')
    .max(MAX_PRICE, 'Harga beli terlalu besar'),
  sellingPrice: wholeNumber('Harga jual')
    .min(1, 'Harga jual harus lebih dari 0')
    .max(MAX_PRICE, 'Harga jual terlalu besar'),
  stock: wholeNumber('Stok')
    .min(0, 'Stok tidak boleh negatif')
    .max(MAX_STOCK, 'Stok terlalu besar')
    .default(0),
  isActive: z.boolean().default(true),
  baseUnit: z
    .string({ invalid_type_error: 'Satuan dasar harus berupa teks' })
    .trim()
    .min(1, 'Satuan dasar wajib diisi')
    .max(20, 'Satuan dasar maksimal 20 karakter')
    .default('pcs'),
  purchaseUnit: z
    .string({ invalid_type_error: 'Satuan beli harus berupa teks' })
    .trim()
    .min(1, 'Satuan beli wajib diisi')
    .max(20, 'Satuan beli maksimal 20 karakter')
    .default('pcs'),
  unitsPerPurchaseUnit: wholeNumber('Isi per satuan beli')
    .min(1, 'Isi per satuan beli minimal 1')
    .max(1_000_000, 'Isi per satuan beli terlalu besar')
    .default(1),
});

// Stock is not editable here: it only changes through sales and stock adjustments.
export const updateProductSchema = createProductSchema
  .omit({ stock: true })
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Tidak ada data yang diubah',
  });

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsFilter = z.infer<typeof listProductsQuerySchema>;
