"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleSummaryInclude = void 0;
exports.toSaleSummaryDto = toSaleSummaryDto;
exports.listSales = listSales;
exports.getSale = getSale;
exports.createSale = createSale;
const client_1 = require("@prisma/client");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const errors_1 = require("../lib/errors");
const fallback_data_1 = require("../lib/fallback-data");
const MAX_SALES_IN_LIST = 200;
exports.saleSummaryInclude = {
    _count: { select: { items: true } },
};
const saleDetailInclude = {
    items: {
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { product: { name: 'asc' } },
    },
};
function toSaleSummaryDto(sale) {
    return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        total: sale.total.toNumber(),
        itemCount: sale._count.items,
        createdAt: sale.createdAt.toISOString(),
    };
}
function toSaleDetailDto(sale) {
    return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        total: sale.total.toNumber(),
        createdAt: sale.createdAt.toISOString(),
        items: sale.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            // The name comes from the Product relation, not from a copy stored on the sale item.
            productName: item.product.name,
            productSku: item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toNumber(),
            subtotal: item.subtotal.toNumber(),
        })),
    };
}
async function listSales() {
    try {
        const sales = await db_1.db.sale.findMany({
            orderBy: { createdAt: 'desc' },
            take: MAX_SALES_IN_LIST,
            include: exports.saleSummaryInclude,
        });
        return sales.map(toSaleSummaryDto);
    }
    catch (err) {
        console.warn('[Sale] Database query failed, returning fallback sales:', err.message);
        return [...fallback_data_1.FALLBACK_SALES];
    }
}
async function getSale(id) {
    const sale = await db_1.db.sale.findUnique({ where: { id }, include: saleDetailInclude });
    if (!sale)
        throw new errors_1.NotFoundError('Penjualan tidak ditemukan.');
    return toSaleDetailDto(sale);
}
// The same product may appear twice in one request; treat it as one line with the summed quantity.
function mergeDuplicateItems(items) {
    const quantities = new Map();
    for (const item of items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
    return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
// INV-YYYYMMDD-NNNN, numbered per WIB day. If two sales race for the same number, the unique
// index on invoiceNumber rejects one of them and the error handler answers 409.
async function generateInvoiceNumber(tx, now) {
    const salesToday = await tx.sale.count({
        where: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
    });
    return `INV-${(0, dates_1.formatDateKeyWib)(now)}-${String(salesToday + 1).padStart(4, '0')}`;
}
// Creates a sale in one database transaction. Any thrown error rolls everything back.
async function createSale(input) {
    const requestedItems = mergeDuplicateItems(input.items);
    const saleId = await db_1.db.$transaction(async (tx) => {
        // 1. Validate that every product exists.
        const products = await tx.product.findMany({
            where: { id: { in: requestedItems.map((item) => item.productId) } },
        });
        const productsById = new Map(products.map((product) => [product.id, product]));
        // 2. Validate product active status & stock, and take the price from the database (never from the client).
        const lines = [];
        const shortages = [];
        const inactiveProducts = [];
        for (const item of requestedItems) {
            const product = productsById.get(item.productId);
            if (!product)
                throw new errors_1.NotFoundError('Produk tidak ditemukan.');
            if (!product.isActive) {
                inactiveProducts.push(product.name);
                continue;
            }
            if (product.stock < item.quantity) {
                shortages.push(`${product.name} (tersedia ${product.stock})`);
                continue;
            }
            lines.push({
                product,
                quantity: item.quantity,
                unitPrice: product.sellingPrice,
                subtotal: product.sellingPrice.mul(item.quantity),
            });
        }
        if (inactiveProducts.length > 0) {
            throw new errors_1.ConflictError(`Produk tidak dapat dijual karena nonaktif: ${inactiveProducts.join(', ')}.`);
        }
        if (shortages.length > 0) {
            throw new errors_1.ConflictError(`Stok tidak mencukupi: ${shortages.join(', ')}.`);
        }
        const total = lines.reduce((sum, line) => sum.add(line.subtotal), new client_1.Prisma.Decimal(0));
        // 3 + 4. Create the sale together with its items.
        const sale = await tx.sale.create({
            data: {
                invoiceNumber: await generateInvoiceNumber(tx, new Date()),
                total,
                items: {
                    create: lines.map((line) => ({
                        productId: line.product.id,
                        quantity: line.quantity,
                        unitPrice: line.unitPrice,
                        subtotal: line.subtotal,
                    })),
                },
            },
        });
        for (const line of lines) {
            // 5. Decrease stock. The `stock >= quantity` condition makes the update safe even if another
            //    sale touched the same product after step 2.
            const { count } = await tx.product.updateMany({
                where: { id: line.product.id, stock: { gte: line.quantity } },
                data: { stock: { decrement: line.quantity } },
            });
            if (count === 0) {
                throw new errors_1.ConflictError(`Stok ${line.product.name} berubah dan tidak lagi mencukupi. Silakan coba lagi.`);
            }
            // 6. Record the movement. The row is locked by the update above, so this read is exact.
            const { stock: afterStock } = await tx.product.findUniqueOrThrow({
                where: { id: line.product.id },
                select: { stock: true },
            });
            await tx.stockMovement.create({
                data: {
                    productId: line.product.id,
                    type: client_1.StockMovementType.SALE,
                    quantity: line.quantity,
                    beforeStock: afterStock + line.quantity,
                    afterStock,
                    referenceType: 'SALE',
                    referenceId: sale.id,
                },
            });
        }
        return sale.id;
    });
    return getSale(saleId);
}
