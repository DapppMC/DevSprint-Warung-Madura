import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z
    .string({ required_error: 'Nama supplier wajib diisi', invalid_type_error: 'Nama supplier harus berupa teks' })
    .trim()
    .min(1, 'Nama supplier wajib diisi')
    .max(100, 'Nama supplier maksimal 100 karakter'),
  phone: z
    .string()
    .trim()
    .max(30, 'Nomor telepon maksimal 30 karakter')
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  isActive: z.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema.partial().refine(
  (data) => Object.values(data).some((val) => val !== undefined),
  { message: 'Tidak ada data yang diubah' },
);

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
