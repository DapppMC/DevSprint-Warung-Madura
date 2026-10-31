import { StockAdjustmentReason } from '@prisma/client';
import { z } from 'zod';

export const stockAdjustmentSchema = z
  .object({
    productId: z
      .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
      .uuid('ID produk tidak valid'),
    type: z.enum(['IN', 'OUT'], {
      required_error: 'Jenis penyesuaian wajib dipilih',
      invalid_type_error: 'Jenis penyesuaian harus IN atau OUT',
    }),
    quantity: z
      .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
      .int('Jumlah harus berupa bilangan bulat')
      .min(1, 'Jumlah harus lebih dari 0')
      .max(1_000_000, 'Jumlah terlalu besar'),
    reason: z.nativeEnum(StockAdjustmentReason, {
      required_error: 'Alasan penyesuaian wajib dipilih',
      invalid_type_error: 'Alasan penyesuaian tidak valid',
    }),
    note: z
      .string()
      .trim()
      .max(200, 'Catatan maksimal 200 karakter')
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine(
    (data) => {
      if (data.reason === 'LAINNYA') {
        return !!data.note && data.note.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Catatan wajib diisi jika alasan penyesuaian adalah LAINNYA',
      path: ['note'],
    },
  );

export const listStockMovementsQuerySchema = z.object({
  productId: z.string().uuid('ID produk tidak valid').optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ListStockMovementsFilter = z.infer<typeof listStockMovementsQuerySchema>;
