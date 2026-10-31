"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupplierSchema = exports.createSupplierSchema = void 0;
const zod_1 = require("zod");
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: 'Nama supplier wajib diisi', invalid_type_error: 'Nama supplier harus berupa teks' })
        .trim()
        .min(1, 'Nama supplier wajib diisi')
        .max(100, 'Nama supplier maksimal 100 karakter'),
    phone: zod_1.z
        .string()
        .trim()
        .max(30, 'Nomor telepon maksimal 30 karakter')
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial().refine((data) => Object.values(data).some((val) => val !== undefined), { message: 'Tidak ada data yang diubah' });
