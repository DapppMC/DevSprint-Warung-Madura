import { z } from 'zod';

// The client only says WHICH products and HOW MANY. Prices are never accepted from the client:
// the service reads the selling price from the database.
const saleItemSchema = z.object({
  productId: z
    .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
    .uuid('ID produk tidak valid'),
  quantity: z
    .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
    .int('Jumlah harus berupa bilangan bulat')
    .min(1, 'Jumlah harus lebih dari 0')
    .max(100_000, 'Jumlah terlalu besar'),
});

export const createSaleSchema = z.object({
  items: z
    .array(saleItemSchema, {
      required_error: 'Item penjualan wajib diisi',
      invalid_type_error: 'Item penjualan tidak valid',
    })
    .min(1, 'Penjualan harus memiliki minimal satu item'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
