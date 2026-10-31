import { z } from 'zod';

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, 'Username wajib diisi.'),
    password: z.string().trim().optional(),
    pin: z.string().trim().optional(),
  })
  .refine((data) => !!(data.password || data.pin), {
    message: 'PIN / password wajib diisi.',
    path: ['pin'],
  })
  .transform((data) => ({
    username: data.username,
    password: data.pin ?? data.password!,
  }));

export type LoginInput = z.infer<typeof loginSchema>;

