import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z
    .string({ required_error: 'Nama staff wajib diisi', invalid_type_error: 'Nama staff harus berupa teks' })
    .trim()
    .min(1, 'Nama staff wajib diisi')
    .max(100, 'Nama staff maksimal 100 karakter'),
  isActive: z.boolean().default(true),
});

export const updateStaffSchema = createStaffSchema.partial().refine(
  (data) => Object.values(data).some((val) => val !== undefined),
  { message: 'Tidak ada data yang diubah' },
);

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
