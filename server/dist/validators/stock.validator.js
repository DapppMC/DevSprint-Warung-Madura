"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStockMovementsQuerySchema = exports.stockAdjustmentSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.stockAdjustmentSchema = zod_1.z
    .object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    type: zod_1.z.enum(['IN', 'OUT'], {
        required_error: 'Jenis penyesuaian wajib dipilih',
        invalid_type_error: 'Jenis penyesuaian harus IN atau OUT',
    }),
    quantity: zod_1.z
        .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
        .int('Jumlah harus berupa bilangan bulat')
        .min(1, 'Jumlah harus lebih dari 0')
        .max(1_000_000, 'Jumlah terlalu besar'),
    reason: zod_1.z.nativeEnum(client_1.StockAdjustmentReason, {
        required_error: 'Alasan penyesuaian wajib dipilih',
        invalid_type_error: 'Alasan penyesuaian tidak valid',
    }),
    note: zod_1.z
        .string()
        .trim()
        .max(200, 'Catatan maksimal 200 karakter')
        .optional()
        .transform((value) => (value ? value : undefined)),
})
    .refine((data) => {
    if (data.reason === 'LAINNYA') {
        return !!data.note && data.note.trim().length > 0;
    }
    return true;
}, {
    message: 'Catatan wajib diisi jika alasan penyesuaian adalah LAINNYA',
    path: ['note'],
});
exports.listStockMovementsQuerySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid('ID produk tidak valid').optional(),
});
