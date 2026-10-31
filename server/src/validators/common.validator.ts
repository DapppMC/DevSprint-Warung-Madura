import { z } from 'zod';

const UUID_OR_SLUG_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-zA-Z0-9_-]{2,64}$/i;

export const idParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'ID tidak boleh kosong')
    .refine((val) => UUID_OR_SLUG_REGEX.test(val), { message: 'ID tidak valid' }),
});
