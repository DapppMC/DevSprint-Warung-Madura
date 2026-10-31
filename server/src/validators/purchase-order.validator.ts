import { PurchaseOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const purchaseOrderLineInputSchema = z.object({
  productId: z
    .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
    .uuid('ID produk tidak valid'),
  quantity: z
    .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
    .int('Jumlah harus berupa bilangan bulat')
    .min(1, 'Jumlah pesanan minimal 1')
    .max(1_000_000, 'Jumlah pesanan terlalu besar'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z
    .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
    .uuid('ID supplier tidak valid'),
  note: z
    .string()
    .trim()
    .max(200, 'Catatan maksimal 200 karakter')
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  lines: z
    .array(purchaseOrderLineInputSchema)
    .min(1, 'Pesanan harus memiliki minimal satu baris barang'),
});

export const cancelRemainingSchema = z.object({
  reason: z
    .string({ required_error: 'Alasan pembatalan sisa wajib diisi', invalid_type_error: 'Alasan pembatalan harus berupa teks' })
    .trim()
    .min(1, 'Alasan pembatalan sisa wajib diisi')
    .max(200, 'Alasan pembatalan maksimal 200 karakter'),
});

export const listPurchaseOrdersQuerySchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CancelRemainingInput = z.infer<typeof cancelRemainingSchema>;
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;
