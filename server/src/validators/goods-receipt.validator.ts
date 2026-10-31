import { GoodsReceiptRejectReason } from '@prisma/client';
import { z } from 'zod';

export const goodsReceiptLineInputSchema = z
  .object({
    productId: z
      .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
      .uuid('ID produk tidak valid'),
    receivedBase: z
      .number({ required_error: 'Jumlah datang wajib diisi', invalid_type_error: 'Jumlah datang harus berupa angka' })
      .int('Jumlah datang harus berupa bilangan bulat')
      .min(0, 'Jumlah datang tidak boleh negatif'),
    rejectedBase: z
      .number({ invalid_type_error: 'Jumlah ditolak harus berupa angka' })
      .int('Jumlah ditolak harus berupa bilangan bulat')
      .min(0, 'Jumlah ditolak tidak boleh negatif')
      .default(0),
    rejectReason: z.nativeEnum(GoodsReceiptRejectReason).optional().nullable(),
    rejectNote: z
      .string()
      .trim()
      .max(200, 'Catatan penolakan maksimal 200 karakter')
      .optional()
      .nullable()
      .transform((val) => (val ? val : null)),
    bonusBase: z
      .number({ invalid_type_error: 'Jumlah bonus harus berupa angka' })
      .int('Jumlah bonus harus berupa bilangan bulat')
      .min(0, 'Jumlah bonus tidak boleh negatif')
      .default(0),
    unitCostPerPurchaseUnit: z
      .number({ required_error: 'Harga beli per satuan beli wajib diisi', invalid_type_error: 'Harga beli harus berupa angka' })
      .min(0, 'Harga beli tidak boleh negatif'),
  })
  .refine((data) => data.rejectedBase <= data.receivedBase, {
    message: 'Jumlah ditolak tidak boleh melebihi jumlah datang',
    path: ['rejectedBase'],
  })
  .refine((data) => data.rejectedBase === 0 || !!data.rejectReason, {
    message: 'Alasan penolakan wajib dipilih jika ada barang yang ditolak',
    path: ['rejectReason'],
  })
  .refine((data) => data.receivedBase + data.bonusBase > 0, {
    message: 'Total barang masuk (datang + bonus) harus lebih dari 0',
    path: ['receivedBase'],
  });

export const createGoodsReceiptSchema = z.object({
  idempotencyKey: z
    .string({ required_error: 'Kunci idempotency wajib diisi', invalid_type_error: 'Kunci idempotency harus berupa teks' })
    .trim()
    .min(1, 'Kunci idempotency wajib diisi')
    .max(100, 'Kunci idempotency maksimal 100 karakter'),
  supplierId: z
    .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
    .uuid('ID supplier tidak valid'),
  receivedById: z
    .string({ required_error: 'Staff penerima wajib dipilih', invalid_type_error: 'ID staff penerima tidak valid' })
    .uuid('ID staff penerima tidak valid'),
  purchaseOrderId: z
    .string({ invalid_type_error: 'ID pesanan tidak valid' })
    .uuid('ID pesanan tidak valid')
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  receivedAt: z
    .string()
    .datetime({ message: 'Format waktu penerimaan tidak valid (ISO 8601)' })
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  note: z
    .string()
    .trim()
    .max(200, 'Catatan maksimal 200 karakter')
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  lines: z
    .array(goodsReceiptLineInputSchema)
    .min(1, 'Penerimaan harus memiliki minimal satu baris barang'),
});

export const listGoodsReceiptsQuerySchema = z.object({
  supplierId: z.string().uuid('ID supplier tidak valid').optional(),
});

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type ListGoodsReceiptsQuery = z.infer<typeof listGoodsReceiptsQuerySchema>;
