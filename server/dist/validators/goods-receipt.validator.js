"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGoodsReceiptsQuerySchema = exports.createGoodsReceiptSchema = exports.goodsReceiptLineInputSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.goodsReceiptLineInputSchema = zod_1.z
    .object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    receivedBase: zod_1.z
        .number({ required_error: 'Jumlah datang wajib diisi', invalid_type_error: 'Jumlah datang harus berupa angka' })
        .int('Jumlah datang harus berupa bilangan bulat')
        .min(0, 'Jumlah datang tidak boleh negatif'),
    rejectedBase: zod_1.z
        .number({ invalid_type_error: 'Jumlah ditolak harus berupa angka' })
        .int('Jumlah ditolak harus berupa bilangan bulat')
        .min(0, 'Jumlah ditolak tidak boleh negatif')
        .default(0),
    rejectReason: zod_1.z.nativeEnum(client_1.GoodsReceiptRejectReason).optional().nullable(),
    rejectNote: zod_1.z
        .string()
        .trim()
        .max(200, 'Catatan penolakan maksimal 200 karakter')
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    bonusBase: zod_1.z
        .number({ invalid_type_error: 'Jumlah bonus harus berupa angka' })
        .int('Jumlah bonus harus berupa bilangan bulat')
        .min(0, 'Jumlah bonus tidak boleh negatif')
        .default(0),
    unitCostPerPurchaseUnit: zod_1.z
        .number({ required_error: 'Harga beli per satuan beli wajib diisi', invalid_type_error: 'Harga beli harus berupa angka' })
        .min(0, 'Harga beli tidak boleh negatif'),
})
    .refine((data) => data.rejectedBase <= data.receivedBase, {
    message: 'Jumlah ditolak tidak boleh melebihi jumlah datang',
    path: ['rejectedBase'],
})
    .refine((data) => data.rejectedBase === 0 || !!data.rejectReason, {
    message: 'Alasan penolakan wajib dipilih jika ada barang yang ditolak',
    path: ['rejectReason'],
})
    .refine((data) => data.receivedBase + data.bonusBase > 0, {
    message: 'Total barang masuk (datang + bonus) harus lebih dari 0',
    path: ['receivedBase'],
});
exports.createGoodsReceiptSchema = zod_1.z.object({
    idempotencyKey: zod_1.z
        .string({ required_error: 'Kunci idempotency wajib diisi', invalid_type_error: 'Kunci idempotency harus berupa teks' })
        .trim()
        .min(1, 'Kunci idempotency wajib diisi')
        .max(100, 'Kunci idempotency maksimal 100 karakter'),
    supplierId: zod_1.z
        .string({ required_error: 'Supplier wajib dipilih', invalid_type_error: 'ID supplier tidak valid' })
        .uuid('ID supplier tidak valid'),
    receivedById: zod_1.z
        .string({ required_error: 'Staff penerima wajib dipilih', invalid_type_error: 'ID staff penerima tidak valid' })
        .uuid('ID staff penerima tidak valid'),
    purchaseOrderId: zod_1.z
        .string({ invalid_type_error: 'ID pesanan tidak valid' })
        .uuid('ID pesanan tidak valid')
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    receivedAt: zod_1.z
        .string()
        .datetime({ message: 'Format waktu penerimaan tidak valid (ISO 8601)' })
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    note: zod_1.z
        .string()
        .trim()
        .max(200, 'Catatan maksimal 200 karakter')
        .optional()
        .nullable()
        .transform((val) => (val ? val : null)),
    lines: zod_1.z
        .array(exports.goodsReceiptLineInputSchema)
        .min(1, 'Penerimaan harus memiliki minimal satu baris barang'),
});
exports.listGoodsReceiptsQuerySchema = zod_1.z.object({
    supplierId: zod_1.z.string().uuid('ID supplier tidak valid').optional(),
});
