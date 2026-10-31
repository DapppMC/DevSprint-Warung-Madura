"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSaleSchema = void 0;
const zod_1 = require("zod");
// The client only says WHICH products and HOW MANY. Prices are never accepted from the client:
// the service reads the selling price from the database.
const saleItemSchema = zod_1.z.object({
    productId: zod_1.z
        .string({ required_error: 'Produk wajib dipilih', invalid_type_error: 'ID produk tidak valid' })
        .uuid('ID produk tidak valid'),
    quantity: zod_1.z
        .number({ required_error: 'Jumlah wajib diisi', invalid_type_error: 'Jumlah harus berupa angka' })
        .int('Jumlah harus berupa bilangan bulat')
        .min(1, 'Jumlah harus lebih dari 0')
        .max(100_000, 'Jumlah terlalu besar'),
});
exports.createSaleSchema = zod_1.z.object({
    items: zod_1.z
        .array(saleItemSchema, {
        required_error: 'Item penjualan wajib diisi',
        invalid_type_error: 'Item penjualan tidak valid',
    })
        .min(1, 'Penjualan harus memiliki minimal satu item'),
});
