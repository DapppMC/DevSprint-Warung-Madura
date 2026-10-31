"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProductDto = toProductDto;
exports.listProducts = listProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
const client_1 = require("@prisma/client");
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const prisma_errors_1 = require("../lib/prisma-errors");
const fallback_data_1 = require("../lib/fallback-data");
const db_health_1 = require("../lib/db-health");
const PRODUCT_NOT_FOUND = 'Produk tidak ditemukan.';
const SKU_ALREADY_USED = 'SKU sudah digunakan oleh produk lain.';
function toProductDto(product, options) {
    const dto = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        sellingPrice: product.sellingPrice.toNumber(),
        stock: product.stock,
        isActive: product.isActive,
        baseUnit: product.baseUnit,
        purchaseUnit: product.purchaseUnit,
        unitsPerPurchaseUnit: product.unitsPerPurchaseUnit,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    };
    if (!options?.hidePurchasePrice) {
        dto.purchasePrice = product.purchasePrice.toNumber();
    }
    return dto;
}
function getFallbackProducts(filter, options) {
    let list = [...fallback_data_1.FALLBACK_PRODUCTS];
    if (filter.search) {
        const q = filter.search.toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q));
    }
    if (filter.inStock) {
        list = list.filter((p) => p.stock > 0);
    }
    if (filter.activeOnly) {
        list = list.filter((p) => p.isActive);
    }
    if (options?.hidePurchasePrice) {
        list = list.map((p) => ({ ...p, purchasePrice: undefined }));
    }
    return list;
}
async function listProducts(filter, options) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        return getFallbackProducts(filter, options);
    }
    const where = {};
    if (filter.search) {
        where.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { sku: { contains: filter.search, mode: 'insensitive' } },
            { category: { contains: filter.search, mode: 'insensitive' } },
        ];
    }
    if (filter.inStock) {
        where.stock = { gt: 0 };
    }
    if (filter.activeOnly) {
        where.isActive = true;
    }
    try {
        const products = await db_1.db.product.findMany({ where, orderBy: { name: 'asc' } });
        (0, db_health_1.markDatabaseUp)();
        return products.map((p) => toProductDto(p, options));
    }
    catch (err) {
        console.warn('[Product] Database query failed, activating fast fallback products:', err.message);
        (0, db_health_1.markDatabaseDown)();
        return getFallbackProducts(filter, options);
    }
}
async function getProduct(id, options) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        const fallback = fallback_data_1.FALLBACK_PRODUCTS.find((p) => p.id === id || p.sku === id);
        if (!fallback)
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        return options?.hidePurchasePrice ? { ...fallback, purchasePrice: undefined } : fallback;
    }
    try {
        const product = await db_1.db.product.findUnique({ where: { id } });
        if (product) {
            (0, db_health_1.markDatabaseUp)();
            return toProductDto(product, options);
        }
    }
    catch (err) {
        console.warn('[Product] Database query failed during getProduct, checking fallback:', err.message);
        (0, db_health_1.markDatabaseDown)();
    }
    const fallback = fallback_data_1.FALLBACK_PRODUCTS.find((p) => p.id === id || p.sku === id);
    if (!fallback)
        throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
    if (options?.hidePurchasePrice) {
        return { ...fallback, purchasePrice: undefined };
    }
    return fallback;
}
async function createProduct(input) {
    try {
        const product = await db_1.db.$transaction(async (tx) => {
            const created = await tx.product.create({
                data: {
                    sku: input.sku,
                    name: input.name,
                    category: input.category,
                    purchasePrice: input.purchasePrice,
                    sellingPrice: input.sellingPrice,
                    stock: input.stock,
                    isActive: input.isActive ?? true,
                    baseUnit: input.baseUnit ?? 'pcs',
                    purchaseUnit: input.purchaseUnit ?? 'pcs',
                    unitsPerPurchaseUnit: input.unitsPerPurchaseUnit ?? 1,
                },
            });
            // Every unit of stock must be explainable by the stock history, including the first ones.
            if (created.stock > 0) {
                await tx.stockMovement.create({
                    data: {
                        productId: created.id,
                        type: client_1.StockMovementType.INITIAL,
                        quantity: created.stock,
                        beforeStock: 0,
                        afterStock: created.stock,
                        note: 'Stok awal',
                    },
                });
            }
            return created;
        });
        return toProductDto(product);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002'))
            throw new errors_1.ConflictError(SKU_ALREADY_USED);
        throw error;
    }
}
async function updateProduct(id, input) {
    try {
        const product = await db_1.db.product.update({ where: { id }, data: input });
        return toProductDto(product);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025'))
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002'))
            throw new errors_1.ConflictError(SKU_ALREADY_USED);
        throw error;
    }
}
// Hard delete. A product can only be removed while nothing but its own initial stock entry refers
// to it. The foreign keys in PostgreSQL (ON DELETE RESTRICT) are the final guard; the checks below
// exist to give the owner a clear message.
async function deleteProduct(id) {
    const product = await db_1.db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product)
        throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
    const saleItemCount = await db_1.db.saleItem.count({ where: { productId: id } });
    if (saleItemCount > 0)
        throw new errors_1.ConflictError(constants_1.PRODUCT_IN_TRANSACTION_MESSAGE);
    const otherMovementCount = await db_1.db.stockMovement.count({
        where: { productId: id, type: { not: client_1.StockMovementType.INITIAL } },
    });
    if (otherMovementCount > 0)
        throw new errors_1.ConflictError(constants_1.PRODUCT_HAS_STOCK_HISTORY_MESSAGE);
    const poLineCount = await db_1.db.purchaseOrderLine.count({ where: { productId: id } });
    if (poLineCount > 0) {
        throw new errors_1.ConflictError('Produk tidak dapat dihapus karena sudah pernah dipesan.');
    }
    const grLineCount = await db_1.db.goodsReceiptLine.count({ where: { productId: id } });
    if (grLineCount > 0) {
        throw new errors_1.ConflictError('Produk tidak dapat dihapus karena sudah pernah diterima.');
    }
    try {
        await db_1.db.$transaction([
            db_1.db.stockMovement.deleteMany({ where: { productId: id, type: client_1.StockMovementType.INITIAL } }),
            db_1.db.product.delete({ where: { id } }),
        ]);
    }
    catch (error) {
        // Someone referenced the product between the checks above and the delete.
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2003'))
            throw new errors_1.ConflictError(constants_1.PRODUCT_IN_TRANSACTION_MESSAGE);
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025'))
            throw new errors_1.NotFoundError(PRODUCT_NOT_FOUND);
        throw error;
    }
}
