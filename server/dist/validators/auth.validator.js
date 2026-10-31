"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z
    .object({
    username: zod_1.z.string().trim().min(1, 'Username wajib diisi.'),
    password: zod_1.z.string().trim().optional(),
    pin: zod_1.z.string().trim().optional(),
})
    .refine((data) => !!(data.password || data.pin), {
    message: 'PIN / password wajib diisi.',
    path: ['pin'],
})
    .transform((data) => ({
    username: data.username,
    password: data.pin ?? data.password,
}));
