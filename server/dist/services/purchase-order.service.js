"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderNumber = generateOrderNumber;
exports.listPurchaseOrders = listPurchaseOrders;
exports.getPurchaseOrder = getPurchaseOrder;
exports.createPurchaseOrder = createPurchaseOrder;
exports.cancelRemaining = cancelRemaining;
const client_1 = require("@prisma/client");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const errors_1 = require("../lib/errors");
const fallback_data_1 = require("../lib/fallback-data");
const db_health_1 = require("../lib/db-health");
const poSummaryInclude = {
    supplier: { select: { name: true } },
    _count: { select: { lines: true } },
};
function toPurchaseOrderSummaryDto(po) {
    return {
        id: po.id,
        orderNumber: po.orderNumber,
        supplierId: po.supplierId,
        supplierName: po.supplier.name,
        orderedAt: po.orderedAt.toISOString(),
        note: po.note,
        status: po.status,
        cancelReason: po.cancelReason,
        createdAt: po.createdAt.toISOString(),
        lineCount: po._count.lines,
    };
}
async function generateOrderNumber(tx, now) {
    const ordersToday = await tx.purchaseOrder.count({
        where: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
    });
    return `PO-${(0, dates_1.formatDateKeyWib)(now)}-${String(ordersToday + 1).padStart(4, '0')}`;
}
async function listPurchaseOrders(filter) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        let list = [...fallback_data_1.FALLBACK_PURCHASE_ORDERS];
        if (filter?.status) {
            list = list.filter((po) => po.status === filter.status);
        }
        return list;
    }
    const where = {};
    if (filter?.status) {
        where.status = filter.status;
    }
    try {
        const orders = await db_1.db.purchaseOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: poSummaryInclude,
        });
        (0, db_health_1.markDatabaseUp)();
        return orders.map(toPurchaseOrderSummaryDto);
    }
    catch (err) {
        console.warn('[PurchaseOrder] Database query failed, activating fast fallback POs:', err.message);
        (0, db_health_1.markDatabaseDown)();
        let list = [...fallback_data_1.FALLBACK_PURCHASE_ORDERS];
        if (filter?.status) {
            list = list.filter((po) => po.status === filter.status);
        }
        return list;
    }
}
async function getPurchaseOrder(id) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        const fallback = fallback_data_1.FALLBACK_PURCHASE_ORDER_DETAILS[id] ||
            Object.values(fallback_data_1.FALLBACK_PURCHASE_ORDER_DETAILS).find((p) => p.orderNumber === id);
        if (fallback)
            return fallback;
        const summary = fallback_data_1.FALLBACK_PURCHASE_ORDERS.find((p) => p.id === id || p.orderNumber === id);
        if (summary) {
            return {
                id: summary.id,
                orderNumber: summary.orderNumber,
                supplierId: summary.supplierId,
                supplierName: summary.supplierName,
                orderedAt: summary.orderedAt,
                note: summary.note,
                status: summary.status,
                cancelReason: summary.cancelReason,
                createdAt: summary.createdAt,
                lines: [],
                goodsReceipts: [],
            };
        }
        throw new errors_1.NotFoundError('Pesanan tidak ditemukan.');
    }
    try {
        const po = await db_1.db.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: { select: { name: true } },
                lines: {
                    include: { product: { select: { name: true, sku: true, baseUnit: true } } },
                    orderBy: { product: { name: 'asc' } },
                },
                goodsReceipts: {
                    include: {
                        supplier: { select: { name: true } },
                        receivedBy: { select: { name: true } },
                        _count: { select: { lines: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (po) {
            (0, db_health_1.markDatabaseUp)();
            const lines = po.lines.map((line) => ({
                id: line.id,
                productId: line.productId,
                productName: line.product.name,
                productSku: line.product.sku,
                orderedBase: line.orderedBase,
                fulfilledBase: line.fulfilledBase,
                cancelledBase: line.cancelledBase,
                remainingBase: Math.max(0, line.orderedBase - line.fulfilledBase - line.cancelledBase),
                baseUnit: line.product.baseUnit,
                purchaseUnit: line.purchaseUnit,
                unitsPerPurchaseUnit: line.unitsPerPurchaseUnit,
            }));
            return {
                id: po.id,
                orderNumber: po.orderNumber,
                supplierId: po.supplierId,
                supplierName: po.supplier.name,
                orderedAt: po.orderedAt.toISOString(),
                note: po.note,
                status: po.status,
                cancelReason: po.cancelReason,
                createdAt: po.createdAt.toISOString(),
                lines,
                goodsReceipts: po.goodsReceipts.map((gr) => ({
                    id: gr.id,
                    receiptNumber: gr.receiptNumber,
                    idempotencyKey: gr.idempotencyKey,
                    purchaseOrderId: gr.purchaseOrderId,
                    purchaseOrderNumber: po.orderNumber,
                    supplierId: gr.supplierId,
                    supplierName: gr.supplier.name,
                    receivedById: gr.receivedById,
                    receivedByName: gr.receivedBy.name,
                    receivedAt: gr.receivedAt.toISOString(),
                    note: gr.note,
                    createdAt: gr.createdAt.toISOString(),
                    itemCount: gr._count.lines,
                })),
            };
        }
    }
    catch (err) {
        console.warn('[PurchaseOrder] Database query failed during getPurchaseOrder, checking fallback:', err.message);
        (0, db_health_1.markDatabaseDown)();
    }
    const fallback = fallback_data_1.FALLBACK_PURCHASE_ORDER_DETAILS[id] ||
        Object.values(fallback_data_1.FALLBACK_PURCHASE_ORDER_DETAILS).find((p) => p.orderNumber === id);
    if (fallback)
        return fallback;
    const summary = fallback_data_1.FALLBACK_PURCHASE_ORDERS.find((p) => p.id === id || p.orderNumber === id);
    if (summary) {
        return {
            id: summary.id,
            orderNumber: summary.orderNumber,
            supplierId: summary.supplierId,
            supplierName: summary.supplierName,
            orderedAt: summary.orderedAt,
            note: summary.note,
            status: summary.status,
            cancelReason: summary.cancelReason,
            createdAt: summary.createdAt,
            lines: [],
            goodsReceipts: [],
        };
    }
    throw new errors_1.NotFoundError('Pesanan tidak ditemukan.');
}
function mergeDuplicatePoLines(lines) {
    const quantities = new Map();
    for (const line of lines) {
        quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    }
    return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
async function createPurchaseOrder(input) {
    const mergedLines = mergeDuplicatePoLines(input.lines);
    if (!(0, db_health_1.getDatabaseStatus)()) {
        const supplier = fallback_data_1.FALLBACK_SUPPLIERS.find((s) => s.id === input.supplierId);
        if (!supplier)
            throw new errors_1.NotFoundError('Supplier tidak ditemukan.');
        const now = new Date();
        const poNum = `PO-${now.toISOString().slice(0, 7).replace('-', '')}-${String(fallback_data_1.FALLBACK_PURCHASE_ORDERS.length + 1).padStart(3, '0')}`;
        const newId = `po-dyn-${Date.now()}`;
        const lines = mergedLines.map((l, idx) => {
            const prod = fallback_data_1.FALLBACK_PRODUCTS.find((p) => p.id === l.productId);
            if (!prod)
                throw new errors_1.NotFoundError('Produk tidak ditemukan.');
            return {
                id: `pol-dyn-${Date.now()}-${idx}`,
                productId: prod.id,
                productName: prod.name,
                productSku: prod.sku,
                orderedBase: l.quantity * prod.unitsPerPurchaseUnit,
                fulfilledBase: 0,
                cancelledBase: 0,
                remainingBase: l.quantity * prod.unitsPerPurchaseUnit,
                baseUnit: prod.baseUnit,
                purchaseUnit: prod.purchaseUnit,
                unitsPerPurchaseUnit: prod.unitsPerPurchaseUnit,
            };
        });
        const newDetail = {
            id: newId,
            orderNumber: poNum,
            supplierId: supplier.id,
            supplierName: supplier.name,
            orderedAt: now.toISOString(),
            note: input.note ?? null,
            status: 'OPEN',
            cancelReason: null,
            createdAt: now.toISOString(),
            lines,
            goodsReceipts: [],
        };
        fallback_data_1.FALLBACK_PURCHASE_ORDERS.unshift({
            id: newId,
            orderNumber: poNum,
            supplierId: supplier.id,
            supplierName: supplier.name,
            orderedAt: now.toISOString(),
            note: input.note ?? null,
            status: 'OPEN',
            cancelReason: null,
            createdAt: now.toISOString(),
            lineCount: lines.length,
        });
        fallback_data_1.FALLBACK_PURCHASE_ORDER_DETAILS[newId] = newDetail;
        return newDetail;
    }
    const poId = await db_1.db.$transaction(async (tx) => {
        // 1. Validate supplier
        const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
        if (!supplier)
            throw new errors_1.NotFoundError('Supplier tidak ditemukan.');
        if (!supplier.isActive)
            throw new errors_1.ConflictError('Supplier tidak aktif.');
        // 2. Validate products
        const products = await tx.product.findMany({
            where: { id: { in: mergedLines.map((l) => l.productId) } },
        });
        const productsById = new Map(products.map((p) => [p.id, p]));
        const inactiveProducts = [];
        for (const item of mergedLines) {
            const product = productsById.get(item.productId);
            if (!product)
                throw new errors_1.NotFoundError('Produk tidak ditemukan.');
            if (!product.isActive) {
                inactiveProducts.push(product.name);
            }
        }
        if (inactiveProducts.length > 0) {
            throw new errors_1.ConflictError(`Produk tidak dapat dipesan karena nonaktif: ${inactiveProducts.join(', ')}.`);
        }
        // 3. Generate PO number
        const now = new Date();
        const orderNumber = await generateOrderNumber(tx, now);
        // 4. Create PO with lines
        const po = await tx.purchaseOrder.create({
            data: {
                orderNumber,
                supplierId: supplier.id,
                note: input.note ?? null,
                status: client_1.PurchaseOrderStatus.OPEN,
                lines: {
                    create: mergedLines.map((line) => {
                        const product = productsById.get(line.productId);
                        const orderedBase = line.quantity * product.unitsPerPurchaseUnit;
                        return {
                            productId: product.id,
                            orderedBase,
                            fulfilledBase: 0,
                            cancelledBase: 0,
                            purchaseUnit: product.purchaseUnit,
                            unitsPerPurchaseUnit: product.unitsPerPurchaseUnit,
                        };
                    }),
                },
            },
        });
        return po.id;
    });
    return getPurchaseOrder(poId);
}
async function cancelRemaining(id, input) {
    await db_1.db.$transaction(async (tx) => {
        // Lock lines for update
        await tx.$queryRaw `SELECT "id" FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${id}::uuid FOR UPDATE;`;
        const po = await tx.purchaseOrder.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!po)
            throw new errors_1.NotFoundError('Pesanan tidak ditemukan.');
        if (po.status === client_1.PurchaseOrderStatus.COMPLETE || po.status === client_1.PurchaseOrderStatus.CANCELLED) {
            throw new errors_1.ConflictError('Pesanan sudah selesai atau dibatalkan.');
        }
        let totalFulfilled = 0;
        for (const line of po.lines) {
            totalFulfilled += line.fulfilledBase;
            const remainingBase = line.orderedBase - line.fulfilledBase - line.cancelledBase;
            if (remainingBase > 0) {
                await tx.purchaseOrderLine.update({
                    where: { id: line.id },
                    data: { cancelledBase: line.cancelledBase + remainingBase },
                });
            }
        }
        const newStatus = totalFulfilled > 0 ? client_1.PurchaseOrderStatus.COMPLETE : client_1.PurchaseOrderStatus.CANCELLED;
        await tx.purchaseOrder.update({
            where: { id },
            data: {
                status: newStatus,
                cancelReason: input.reason.trim(),
            },
        });
    });
    return getPurchaseOrder(id);
}
