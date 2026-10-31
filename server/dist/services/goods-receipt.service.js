"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptNumber = generateReceiptNumber;
exports.listGoodsReceipts = listGoodsReceipts;
exports.getGoodsReceipt = getGoodsReceipt;
exports.createGoodsReceipt = createGoodsReceipt;
const client_1 = require("@prisma/client");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const errors_1 = require("../lib/errors");
const prisma_errors_1 = require("../lib/prisma-errors");
const fallback_data_1 = require("../lib/fallback-data");
const db_health_1 = require("../lib/db-health");
const grSummaryInclude = {
    supplier: { select: { name: true } },
    receivedBy: { select: { name: true } },
    purchaseOrder: { select: { orderNumber: true } },
    _count: { select: { lines: true } },
};
function toGoodsReceiptSummaryDto(gr) {
    return {
        id: gr.id,
        receiptNumber: gr.receiptNumber,
        idempotencyKey: gr.idempotencyKey,
        purchaseOrderId: gr.purchaseOrderId,
        purchaseOrderNumber: gr.purchaseOrder ? gr.purchaseOrder.orderNumber : null,
        supplierId: gr.supplierId,
        supplierName: gr.supplier.name,
        receivedById: gr.receivedById,
        receivedByName: gr.receivedBy.name,
        receivedAt: gr.receivedAt.toISOString(),
        note: gr.note,
        createdAt: gr.createdAt.toISOString(),
        itemCount: gr._count.lines,
    };
}
async function generateReceiptNumber(tx, now) {
    const receiptsToday = await tx.goodsReceipt.count({
        where: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
    });
    return `GR-${(0, dates_1.formatDateKeyWib)(now)}-${String(receiptsToday + 1).padStart(4, '0')}`;
}
async function listGoodsReceipts(filter) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        let list = [...fallback_data_1.FALLBACK_GOODS_RECEIPTS];
        if (filter?.supplierId) {
            list = list.filter((gr) => gr.supplierId === filter.supplierId);
        }
        return list;
    }
    const where = {};
    if (filter?.supplierId) {
        where.supplierId = filter.supplierId;
    }
    try {
        const receipts = await db_1.db.goodsReceipt.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: grSummaryInclude,
        });
        (0, db_health_1.markDatabaseUp)();
        return receipts.map(toGoodsReceiptSummaryDto);
    }
    catch (err) {
        console.warn('[GoodsReceipt] Database query failed, activating fast fallback GRs:', err.message);
        (0, db_health_1.markDatabaseDown)();
        let list = [...fallback_data_1.FALLBACK_GOODS_RECEIPTS];
        if (filter?.supplierId) {
            list = list.filter((gr) => gr.supplierId === filter.supplierId);
        }
        return list;
    }
}
async function getGoodsReceipt(id) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        const fallback = fallback_data_1.FALLBACK_GOODS_RECEIPT_DETAILS[id] ||
            Object.values(fallback_data_1.FALLBACK_GOODS_RECEIPT_DETAILS).find((g) => g.receiptNumber === id);
        if (!fallback)
            throw new errors_1.NotFoundError('Penerimaan barang tidak ditemukan.');
        return fallback;
    }
    try {
        const gr = await db_1.db.goodsReceipt.findUnique({
            where: { id },
            include: {
                supplier: { select: { name: true } },
                receivedBy: { select: { name: true } },
                purchaseOrder: { select: { orderNumber: true } },
                lines: {
                    include: { product: { select: { name: true, sku: true } } },
                    orderBy: { product: { name: 'asc' } },
                },
            },
        });
        if (gr) {
            (0, db_health_1.markDatabaseUp)();
            const lines = gr.lines.map((line) => ({
                id: line.id,
                productId: line.productId,
                productName: line.product.name,
                productSku: line.product.sku,
                purchaseOrderLineId: line.purchaseOrderLineId,
                receivedBase: line.receivedBase,
                rejectedBase: line.rejectedBase,
                rejectReason: line.rejectReason,
                rejectNote: line.rejectNote,
                bonusBase: line.bonusBase,
                purchaseUnit: line.purchaseUnit,
                unitsPerPurchaseUnit: line.unitsPerPurchaseUnit,
                unitCostPerPurchaseUnit: line.unitCostPerPurchaseUnit.toNumber(),
                costPerBaseUnit: line.costPerBaseUnit.toNumber(),
                effectiveCostPerBaseUnit: line.effectiveCostPerBaseUnit.toNumber(),
            }));
            return {
                id: gr.id,
                receiptNumber: gr.receiptNumber,
                idempotencyKey: gr.idempotencyKey,
                purchaseOrderId: gr.purchaseOrderId,
                purchaseOrderNumber: gr.purchaseOrder ? gr.purchaseOrder.orderNumber : null,
                supplierId: gr.supplierId,
                supplierName: gr.supplier.name,
                receivedById: gr.receivedById,
                receivedByName: gr.receivedBy.name,
                receivedAt: gr.receivedAt.toISOString(),
                note: gr.note,
                createdAt: gr.createdAt.toISOString(),
                lines,
            };
        }
    }
    catch (err) {
        console.warn('[GoodsReceipt] Database query failed during getGoodsReceipt, checking fallback:', err.message);
        (0, db_health_1.markDatabaseDown)();
    }
    const fallback = fallback_data_1.FALLBACK_GOODS_RECEIPT_DETAILS[id] ||
        Object.values(fallback_data_1.FALLBACK_GOODS_RECEIPT_DETAILS).find((g) => g.receiptNumber === id);
    if (!fallback)
        throw new errors_1.NotFoundError('Penerimaan barang tidak ditemukan.');
    return fallback;
}
function mergeDuplicateReceiptLines(lines) {
    const mergedMap = new Map();
    for (const line of lines) {
        const existing = mergedMap.get(line.productId);
        if (!existing) {
            mergedMap.set(line.productId, {
                productId: line.productId,
                receivedBase: line.receivedBase,
                rejectedBase: line.rejectedBase ?? 0,
                rejectReason: line.rejectReason ?? null,
                rejectNote: line.rejectNote ?? null,
                bonusBase: line.bonusBase ?? 0,
                unitCostPerPurchaseUnit: line.unitCostPerPurchaseUnit,
            });
        }
        else {
            existing.receivedBase += line.receivedBase;
            existing.rejectedBase = (existing.rejectedBase ?? 0) + (line.rejectedBase ?? 0);
            existing.bonusBase = (existing.bonusBase ?? 0) + (line.bonusBase ?? 0);
            if (!existing.rejectReason && line.rejectReason) {
                existing.rejectReason = line.rejectReason;
            }
            if (!existing.rejectNote && line.rejectNote) {
                existing.rejectNote = line.rejectNote;
            }
        }
    }
    return [...mergedMap.values()];
}
async function createGoodsReceipt(input) {
    const cleanIdempotencyKey = input.idempotencyKey.trim();
    if (!cleanIdempotencyKey) {
        throw new errors_1.ConflictError('Kunci idempotency wajib diisi.');
    }
    try {
        const result = await db_1.db.$transaction(async (tx) => {
            // 1. Cek idempotencyKey
            const existing = await tx.goodsReceipt.findUnique({
                where: { idempotencyKey: cleanIdempotencyKey },
            });
            if (existing) {
                return { receiptId: existing.id, isReplay: true };
            }
            // 2. Validasi supplier, staff aktif, produk aktif, dan PO jika ada
            const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
            if (!supplier)
                throw new errors_1.NotFoundError('Supplier tidak ditemukan.');
            if (!supplier.isActive)
                throw new errors_1.ConflictError('Supplier tidak aktif.');
            const staff = await tx.staff.findUnique({ where: { id: input.receivedById } });
            if (!staff)
                throw new errors_1.NotFoundError('Staff penerima tidak ditemukan.');
            if (!staff.isActive)
                throw new errors_1.ConflictError('Staff penerima tidak aktif.');
            if (input.lines.length === 0) {
                throw new errors_1.ConflictError('Penerimaan barang harus memiliki minimal satu baris barang.');
            }
            // 3. Gabungkan baris duplikat
            const mergedLines = mergeDuplicateReceiptLines(input.lines);
            const products = await tx.product.findMany({
                where: { id: { in: mergedLines.map((l) => l.productId) } },
            });
            const productsById = new Map(products.map((p) => [p.id, p]));
            const inactiveProducts = [];
            for (const line of mergedLines) {
                const product = productsById.get(line.productId);
                if (!product)
                    throw new errors_1.NotFoundError('Produk tidak ditemukan.');
                if (!product.isActive) {
                    inactiveProducts.push(product.name);
                }
            }
            if (inactiveProducts.length > 0) {
                throw new errors_1.ConflictError(`Produk tidak dapat diterima karena nonaktif: ${inactiveProducts.join(', ')}.`);
            }
            // 4. Kunci baris PO & validasi PO jika ada
            let poLineByProductId = new Map();
            if (input.purchaseOrderId) {
                const po = await tx.purchaseOrder.findUnique({
                    where: { id: input.purchaseOrderId },
                });
                if (!po)
                    throw new errors_1.NotFoundError('Pesanan tidak ditemukan.');
                if (po.supplierId !== input.supplierId) {
                    throw new errors_1.ConflictError('Supplier penerimaan tidak cocok dengan pesanan.');
                }
                if (po.status === client_1.PurchaseOrderStatus.COMPLETE ||
                    po.status === client_1.PurchaseOrderStatus.CANCELLED) {
                    throw new errors_1.ConflictError('Pesanan sudah selesai atau dibatalkan.');
                }
                // Kunci baris PO dengan SELECT ... FOR UPDATE
                await tx.$queryRaw `SELECT "id" FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${input.purchaseOrderId}::uuid FOR UPDATE;`;
                const poLines = await tx.purchaseOrderLine.findMany({
                    where: { purchaseOrderId: input.purchaseOrderId },
                });
                poLineByProductId = new Map(poLines.map((l) => [l.productId, l]));
            }
            // 5. Validasi sisa dan kuantitas baris
            for (const line of mergedLines) {
                const product = productsById.get(line.productId);
                const rejectedBase = line.rejectedBase ?? 0;
                const bonusBase = line.bonusBase ?? 0;
                if (rejectedBase > line.receivedBase) {
                    throw new errors_1.ConflictError('Jumlah ditolak tidak boleh melebihi jumlah datang.');
                }
                if (rejectedBase > 0 && !line.rejectReason) {
                    throw new errors_1.ConflictError('Alasan penolakan wajib diisi jika ada barang yang ditolak.');
                }
                if (line.receivedBase + bonusBase <= 0) {
                    throw new errors_1.ConflictError('Total barang masuk (datang + bonus) harus lebih dari 0.');
                }
                if (input.purchaseOrderId) {
                    const poLine = poLineByProductId.get(line.productId);
                    if (!poLine) {
                        throw new errors_1.ConflictError(`Produk ${product.name} tidak ada dalam pesanan.`);
                    }
                    const netReceived = line.receivedBase - rejectedBase;
                    const remainingBase = poLine.orderedBase - poLine.fulfilledBase - poLine.cancelledBase;
                    if (netReceived > remainingBase) {
                        throw new errors_1.ConflictError(`Jumlah diterima bersih (${netReceived}) melebihi sisa pesanan (${remainingBase}) untuk ${product.name}.`);
                    }
                }
            }
            // 6. Hitung costPerBaseUnit dan effectiveCostPerBaseUnit dengan Decimal
            const calculatedLines = mergedLines.map((line) => {
                const product = productsById.get(line.productId);
                const rejectedBase = line.rejectedBase ?? 0;
                const bonusBase = line.bonusBase ?? 0;
                const netReceived = line.receivedBase - rejectedBase;
                const totalIncoming = netReceived + bonusBase;
                const unitCost = new client_1.Prisma.Decimal(line.unitCostPerPurchaseUnit);
                if (unitCost.isNegative()) {
                    throw new errors_1.ConflictError('Harga beli tidak boleh negatif.');
                }
                const unitsPerPurchaseUnit = new client_1.Prisma.Decimal(product.unitsPerPurchaseUnit);
                // costPerBaseUnit = unitCostPerPurchaseUnit / unitsPerPurchaseUnit (4 decimal places)
                const costPerBaseUnit = unitCost.div(unitsPerPurchaseUnit).toDecimalPlaces(4);
                // effectiveCostPerBaseUnit = (netReceived * costPerBaseUnit) / (netReceived + bonusBase)
                let effectiveCostPerBaseUnit;
                if (totalIncoming > 0) {
                    effectiveCostPerBaseUnit = new client_1.Prisma.Decimal(netReceived)
                        .mul(costPerBaseUnit)
                        .div(totalIncoming)
                        .toDecimalPlaces(4);
                }
                else {
                    effectiveCostPerBaseUnit = costPerBaseUnit;
                }
                const poLine = poLineByProductId.get(line.productId);
                return {
                    line,
                    product,
                    rejectedBase,
                    bonusBase,
                    netReceived,
                    totalIncoming,
                    unitCost,
                    costPerBaseUnit,
                    effectiveCostPerBaseUnit,
                    purchaseOrderLineId: poLine ? poLine.id : null,
                };
            });
            // 7. Simpan penerimaan dan baris
            const now = input.receivedAt ? new Date(input.receivedAt) : new Date();
            const receiptNumber = await generateReceiptNumber(tx, now);
            const goodsReceipt = await tx.goodsReceipt.create({
                data: {
                    receiptNumber,
                    idempotencyKey: cleanIdempotencyKey,
                    supplierId: supplier.id,
                    receivedById: staff.id,
                    purchaseOrderId: input.purchaseOrderId ?? null,
                    receivedAt: now,
                    note: input.note ?? null,
                    lines: {
                        create: calculatedLines.map((cl) => ({
                            productId: cl.product.id,
                            purchaseOrderLineId: cl.purchaseOrderLineId,
                            receivedBase: cl.line.receivedBase,
                            rejectedBase: cl.rejectedBase,
                            rejectReason: cl.rejectedBase > 0 ? cl.line.rejectReason : null,
                            rejectNote: cl.line.rejectNote ?? null,
                            bonusBase: cl.bonusBase,
                            purchaseUnit: cl.product.purchaseUnit,
                            unitsPerPurchaseUnit: cl.product.unitsPerPurchaseUnit,
                            unitCostPerPurchaseUnit: cl.unitCost,
                            costPerBaseUnit: cl.costPerBaseUnit,
                            effectiveCostPerBaseUnit: cl.effectiveCostPerBaseUnit,
                        })),
                    },
                },
            });
            // 8. Tambah stok (netReceived + bonusBase) hanya jika > 0 dan tulis StockMovement RECEIPT
            for (const cl of calculatedLines) {
                const qtyToAdd = cl.totalIncoming; // netReceived + bonusBase
                if (qtyToAdd > 0) {
                    await tx.product.update({
                        where: { id: cl.product.id },
                        data: { stock: { increment: qtyToAdd } },
                    });
                    const { stock: afterStock } = await tx.product.findUniqueOrThrow({
                        where: { id: cl.product.id },
                        select: { stock: true },
                    });
                    const beforeStock = afterStock - qtyToAdd;
                    await tx.stockMovement.create({
                        data: {
                            productId: cl.product.id,
                            type: client_1.StockMovementType.RECEIPT,
                            quantity: qtyToAdd,
                            beforeStock,
                            afterStock,
                            referenceType: 'GOODS_RECEIPT',
                            referenceId: goodsReceipt.id,
                        },
                    });
                }
            }
            // 9. Update fulfilledBase dan status PO
            if (input.purchaseOrderId) {
                for (const cl of calculatedLines) {
                    if (cl.purchaseOrderLineId && cl.netReceived > 0) {
                        await tx.purchaseOrderLine.update({
                            where: { id: cl.purchaseOrderLineId },
                            data: { fulfilledBase: { increment: cl.netReceived } },
                        });
                    }
                }
                const allPoLines = await tx.purchaseOrderLine.findMany({
                    where: { purchaseOrderId: input.purchaseOrderId },
                });
                const totalFulfilled = allPoLines.reduce((s, l) => s + l.fulfilledBase, 0);
                const totalRemaining = allPoLines.reduce((s, l) => s + Math.max(0, l.orderedBase - l.fulfilledBase - l.cancelledBase), 0);
                let newStatus;
                if (totalRemaining === 0) {
                    newStatus =
                        totalFulfilled > 0 ? client_1.PurchaseOrderStatus.COMPLETE : client_1.PurchaseOrderStatus.CANCELLED;
                }
                else if (totalFulfilled > 0) {
                    newStatus = client_1.PurchaseOrderStatus.PARTIAL;
                }
                else {
                    newStatus = client_1.PurchaseOrderStatus.OPEN;
                }
                await tx.purchaseOrder.update({
                    where: { id: input.purchaseOrderId },
                    data: { status: newStatus },
                });
            }
            return { receiptId: goodsReceipt.id, isReplay: false };
        });
        const receipt = await getGoodsReceipt(result.receiptId);
        return { receipt, isReplay: result.isReplay };
    }
    catch (error) {
        // Tangani race condition P2002 saat dua request dengan idempotencyKey sama masuk bersamaan
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002')) {
            const existing = await db_1.db.goodsReceipt.findUnique({
                where: { idempotencyKey: cleanIdempotencyKey },
            });
            if (existing) {
                const receipt = await getGoodsReceipt(existing.id);
                return { receipt, isReplay: true };
            }
        }
        throw error;
    }
}
