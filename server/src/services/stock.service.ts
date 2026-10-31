import { Prisma, StockMovementType } from '@prisma/client';
import { db } from '../lib/db';
import { ConflictError, NotFoundError } from '../lib/errors';
import type { StockMovementDto } from '../types/dto';
import {
  ListStockMovementsFilter,
  StockAdjustmentInput,
  stockAdjustmentSchema,
} from '../validators/stock.validator';
import { FALLBACK_STOCK_MOVEMENTS } from '../lib/fallback-data';

const MAX_MOVEMENTS_IN_LIST = 300;

const movementInclude = {
  product: { select: { name: true, sku: true } },
} satisfies Prisma.StockMovementInclude;

type MovementWithProduct = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

function toStockMovementDto(
  movement: MovementWithProduct,
  referenceLabel: string | null,
): StockMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    productSku: movement.product.sku,
    type: movement.type,
    quantity: movement.quantity,
    beforeStock: movement.beforeStock,
    afterStock: movement.afterStock,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    referenceLabel,
    reason: movement.reason,
    note: movement.note,
    createdAt: movement.createdAt.toISOString(),
  };
}

// Manual stock in / stock out. Product stock and its StockMovement change in one transaction.
export async function adjustStock(rawInput: StockAdjustmentInput): Promise<StockMovementDto> {
  const input = stockAdjustmentSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Produk tidak ditemukan.');

    if (input.type === 'OUT') {
      if (product.stock < input.quantity) {
        throw new ConflictError(`Stok ${product.name} tidak mencukupi. Tersedia ${product.stock}.`);
      }
      // Guarded update: refuses to run if the stock dropped in the meantime.
      const { count } = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: input.quantity } },
        data: { stock: { decrement: input.quantity } },
      });
      if (count === 0) {
        throw new ConflictError(`Stok ${product.name} berubah dan tidak lagi mencukupi. Silakan coba lagi.`);
      }
    } else {
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: input.quantity } },
      });
    }

    const { stock: afterStock } = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { stock: true },
    });
    const beforeStock = input.type === 'OUT' ? afterStock + input.quantity : afterStock - input.quantity;

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: input.type === 'OUT' ? StockMovementType.ADJUSTMENT_OUT : StockMovementType.ADJUSTMENT_IN,
        quantity: input.quantity,
        beforeStock,
        afterStock,
        reason: input.reason,
        note: input.note ?? null,
      },
      include: movementInclude,
    });

    return toStockMovementDto(movement, null);
  });
}

export async function listStockMovements(
  filter: ListStockMovementsFilter,
): Promise<StockMovementDto[]> {
  try {
    const movements = await db.stockMovement.findMany({
      where: filter.productId ? { productId: filter.productId } : {},
      orderBy: { createdAt: 'desc' },
      take: MAX_MOVEMENTS_IN_LIST,
      include: movementInclude,
    });

    // Collect sale and receipt IDs to populate referenceLabel
    const saleIds: string[] = [];
    const receiptIds: string[] = [];
    for (const movement of movements) {
      if (movement.referenceId) {
        if (movement.referenceType === 'SALE') {
          saleIds.push(movement.referenceId);
        } else if (movement.referenceType === 'GOODS_RECEIPT') {
          receiptIds.push(movement.referenceId);
        }
      }
    }

    const sales =
      saleIds.length > 0
        ? await db.sale.findMany({
            where: { id: { in: saleIds } },
            select: { id: true, invoiceNumber: true },
          })
        : [];
    const invoiceBySaleId = new Map(sales.map((sale) => [sale.id, sale.invoiceNumber]));

    const receipts =
      receiptIds.length > 0
        ? await db.goodsReceipt.findMany({
            where: { id: { in: receiptIds } },
            select: { id: true, receiptNumber: true },
          })
        : [];
    const receiptNumberById = new Map(receipts.map((gr) => [gr.id, gr.receiptNumber]));

    return movements.map((movement) => {
      let referenceLabel: string | null = null;
      if (movement.referenceId) {
        if (movement.referenceType === 'SALE') {
          referenceLabel = invoiceBySaleId.get(movement.referenceId) ?? null;
        } else if (movement.referenceType === 'GOODS_RECEIPT') {
          referenceLabel = receiptNumberById.get(movement.referenceId) ?? null;
        }
      }
      return toStockMovementDto(movement, referenceLabel);
    });
  } catch (err) {
    console.warn(
      '[Stock] Database query failed, returning fallback stock movements:',
      (err as Error).message,
    );
    let list = [...FALLBACK_STOCK_MOVEMENTS];
    if (filter.productId) {
      list = list.filter((m) => m.productId === filter.productId);
    }
    return list;
  }
}
