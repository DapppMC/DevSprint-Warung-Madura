"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStaffSchema = exports.createStaffSchema = void 0;
const zod_1 = require("zod");
exports.createStaffSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: 'Nama staff wajib diisi', invalid_type_error: 'Nama staff harus berupa teks' })
        .trim()
        .min(1, 'Nama staff wajib diisi')
        .max(100, 'Nama staff maksimal 100 karakter'),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateStaffSchema = exports.createStaffSchema.partial().refine((data) => Object.values(data).some((val) => val !== undefined), { message: 'Tidak ada data yang diubah' });
