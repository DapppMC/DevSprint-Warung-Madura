import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { db } from '../lib/db';
import { endOfDayWib, formatDateKeyWib, startOfDayWib } from '../lib/dates';
import { ConflictError, NotFoundError } from '../lib/errors';
import type {
  PurchaseOrderDetailDto,
  PurchaseOrderLineDto,
  PurchaseOrderSummaryDto,
} from '../types/dto';
import {
  FALLBACK_PURCHASE_ORDERS,
  FALLBACK_PURCHASE_ORDER_DETAILS,
  FALLBACK_SUPPLIERS,
  FALLBACK_PRODUCTS,
} from '../lib/fallback-data';
import { getDatabaseStatus, markDatabaseDown, markDatabaseUp } from '../lib/db-health';

export interface CreatePurchaseOrderLineInput {
  productId: string;
  quantity: number; // in purchaseUnit
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  note?: string | null;
  lines: CreatePurchaseOrderLineInput[];
}

export interface CancelRemainingInput {
  reason: string;
}

const poSummaryInclude = {
  supplier: { select: { name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.PurchaseOrderInclude;

type PurchaseOrderWithCount = Prisma.PurchaseOrderGetPayload<{ include: typeof poSummaryInclude }>;

function toPurchaseOrderSummaryDto(po: PurchaseOrderWithCount): PurchaseOrderSummaryDto {
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

export async function generateOrderNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const ordersToday = await tx.purchaseOrder.count({
    where: { createdAt: { gte: startOfDayWib(now), lt: endOfDayWib(now) } },
  });
  return `PO-${formatDateKeyWib(now)}-${String(ordersToday + 1).padStart(4, '0')}`;
}

export async function listPurchaseOrders(filter?: {
  status?: PurchaseOrderStatus;
}): Promise<PurchaseOrderSummaryDto[]> {
  if (!getDatabaseStatus()) {
    let list = [...FALLBACK_PURCHASE_ORDERS];
    if (filter?.status) {
      list = list.filter((po) => po.status === filter.status);
    }
    return list;
  }

  const where: Prisma.PurchaseOrderWhereInput = {};
  if (filter?.status) {
    where.status = filter.status;
  }

  try {
    const orders = await db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: poSummaryInclude,
    });
    markDatabaseUp();
    return orders.map(toPurchaseOrderSummaryDto);
  } catch (err) {
    console.warn(
      '[PurchaseOrder] Database query failed, activating fast fallback POs:',
      (err as Error).message,
    );
    markDatabaseDown();
    let list = [...FALLBACK_PURCHASE_ORDERS];
    if (filter?.status) {
      list = list.filter((po) => po.status === filter.status);
    }
    return list;
  }
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDetailDto> {
  if (!getDatabaseStatus()) {
    const fallback =
      FALLBACK_PURCHASE_ORDER_DETAILS[id] ||
      Object.values(FALLBACK_PURCHASE_ORDER_DETAILS).find((p) => p.orderNumber === id);
    if (fallback) return fallback;
    const summary = FALLBACK_PURCHASE_ORDERS.find((p) => p.id === id || p.orderNumber === id);
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
    throw new NotFoundError('Pesanan tidak ditemukan.');
  }

  try {
    const po = await db.purchaseOrder.findUnique({
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
      markDatabaseUp();
      const lines: PurchaseOrderLineDto[] = po.lines.map((line) => ({
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
  } catch (err) {
    console.warn(
      '[PurchaseOrder] Database query failed during getPurchaseOrder, checking fallback:',
      (err as Error).message,
    );
    markDatabaseDown();
  }

  const fallback =
    FALLBACK_PURCHASE_ORDER_DETAILS[id] ||
    Object.values(FALLBACK_PURCHASE_ORDER_DETAILS).find((p) => p.orderNumber === id);
  if (fallback) return fallback;
  const summary = FALLBACK_PURCHASE_ORDERS.find((p) => p.id === id || p.orderNumber === id);
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
  throw new NotFoundError('Pesanan tidak ditemukan.');
}

function mergeDuplicatePoLines(
  lines: CreatePurchaseOrderLineInput[],
): CreatePurchaseOrderLineInput[] {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDetailDto> {
  const mergedLines = mergeDuplicatePoLines(input.lines);

  if (!getDatabaseStatus()) {
    const supplier = FALLBACK_SUPPLIERS.find((s) => s.id === input.supplierId);
    if (!supplier) throw new NotFoundError('Supplier tidak ditemukan.');
    const now = new Date();
    const poNum = `PO-${now.toISOString().slice(0, 7).replace('-', '')}-${String(FALLBACK_PURCHASE_ORDERS.length + 1).padStart(3, '0')}`;
    const newId = `po-dyn-${Date.now()}`;
    const lines: PurchaseOrderLineDto[] = mergedLines.map((l, idx) => {
      const prod = FALLBACK_PRODUCTS.find((p) => p.id === l.productId);
      if (!prod) throw new NotFoundError('Produk tidak ditemukan.');
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

    const newDetail: PurchaseOrderDetailDto = {
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

    FALLBACK_PURCHASE_ORDERS.unshift({
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
    FALLBACK_PURCHASE_ORDER_DETAILS[newId] = newDetail;
    return newDetail;
  }

  const poId = await db.$transaction(async (tx) => {
    // 1. Validate supplier
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new NotFoundError('Supplier tidak ditemukan.');
    if (!supplier.isActive) throw new ConflictError('Supplier tidak aktif.');

    // 2. Validate products
    const products = await tx.product.findMany({
      where: { id: { in: mergedLines.map((l) => l.productId) } },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    const inactiveProducts: string[] = [];
    for (const item of mergedLines) {
      const product = productsById.get(item.productId);
      if (!product) throw new NotFoundError('Produk tidak ditemukan.');
      if (!product.isActive) {
        inactiveProducts.push(product.name);
      }
    }

    if (inactiveProducts.length > 0) {
      throw new ConflictError(
        `Produk tidak dapat dipesan karena nonaktif: ${inactiveProducts.join(', ')}.`,
      );
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
        status: PurchaseOrderStatus.OPEN,
        lines: {
          create: mergedLines.map((line) => {
            const product = productsById.get(line.productId)!;
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

export async function cancelRemaining(
  id: string,
  input: CancelRemainingInput,
): Promise<PurchaseOrderDetailDto> {
  await db.$transaction(async (tx) => {
    // Lock lines for update
    await tx.$queryRaw`SELECT "id" FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${id}::uuid FOR UPDATE;`;

    const po = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!po) throw new NotFoundError('Pesanan tidak ditemukan.');

    if (po.status === PurchaseOrderStatus.COMPLETE || po.status === PurchaseOrderStatus.CANCELLED) {
      throw new ConflictError('Pesanan sudah selesai atau dibatalkan.');
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

    const newStatus =
      totalFulfilled > 0 ? PurchaseOrderStatus.COMPLETE : PurchaseOrderStatus.CANCELLED;

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
