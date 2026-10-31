"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPurchaseOrdersQuerySchema = exports.cancelRemainingSchema = exports.createPurchaseOrderSchema = exports.purchaseOrderLineInputSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.purchaseOrderLineInputSchema = zod_1.z.object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    quantity: zod_1.z
        .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
        .int('Jumlah harus berupa bilangan bulat')
        .min(1, 'Jumlah pesanan minimal 1')
        .max(1_000_000, 'Jumlah pesanan terlalu besar'),
});
exports.createPurchaseOrderSchema = zod_1.z.object({
    supplierId: zod_1.z
        .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
        .uuid('ID supplier tidak valid'),
    note: zod_1.z
        .string()
        .trim()
        .max(200, 'Catatan maksimal 200 karakter')
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    lines: zod_1.z
        .array(exports.purchaseOrderLineInputSchema)
        .min(1, 'Pesanan harus memiliki minimal satu baris barang'),
});
exports.cancelRemainingSchema = zod_1.z.object({
    reason: zod_1.z
        .string({ required_error: 'Alasan pembatalan sisa wajib diisi', invalid_type_error: 'Alasan pembatalan harus berupa teks' })
        .trim()
        .min(1, 'Alasan pembatalan sisa wajib diisi')
        .max(200, 'Alasan pembatalan maksimal 200 karakter'),
});
exports.listPurchaseOrdersQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.PurchaseOrderStatus).optional(),
});
