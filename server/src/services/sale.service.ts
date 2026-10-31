import { Prisma, StockMovementType, type Product } from '@prisma/client';
import { db } from '../lib/db';
import { endOfDayWib, formatDateKeyWib, startOfDayWib } from '../lib/dates';
import { ConflictError, NotFoundError } from '../lib/errors';
import type { SaleDetailDto, SaleSummaryDto } from '../types/dto';
import type { CreateSaleInput } from '../validators/sale.validator';
import { FALLBACK_SALES } from '../lib/fallback-data';

const MAX_SALES_IN_LIST = 200;

export const saleSummaryInclude = {
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude;

const saleDetailInclude = {
  items: {
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { product: { name: 'asc' } },
  },
} satisfies Prisma.SaleInclude;

type SaleWithCount = Prisma.SaleGetPayload<{ include: typeof saleSummaryInclude }>;
type SaleWithItems = Prisma.SaleGetPayload<{ include: typeof saleDetailInclude }>;

interface SaleLine {
  product: Product;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

export function toSaleSummaryDto(sale: SaleWithCount): SaleSummaryDto {
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    total: sale.total.toNumber(),
    itemCount: sale._count.items,
    createdAt: sale.createdAt.toISOString(),
  };
}

function toSaleDetailDto(sale: SaleWithItems): SaleDetailDto {
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

export async function listSales(): Promise<SaleSummaryDto[]> {
  try {
    const sales = await db.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_SALES_IN_LIST,
      include: saleSummaryInclude,
    });
    return sales.map(toSaleSummaryDto);
  } catch (err) {
    console.warn(
      '[Sale] Database query failed, returning fallback sales:',
      (err as Error).message,
    );
    return [...FALLBACK_SALES];
  }
}

export async function getSale(id: string): Promise<SaleDetailDto> {
  const sale = await db.sale.findUnique({ where: { id }, include: saleDetailInclude });
  if (!sale) throw new NotFoundError('Penjualan tidak ditemukan.');
  return toSaleDetailDto(sale);
}

// The same product may appear twice in one request; treat it as one line with the summed quantity.
function mergeDuplicateItems(items: CreateSaleInput['items']): CreateSaleInput['items'] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

// INV-YYYYMMDD-NNNN, numbered per WIB day. If two sales race for the same number, the unique
// index on invoiceNumber rejects one of them and the error handler answers 409.
async function generateInvoiceNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const salesToday = await tx.sale.count({
    where: { createdAt: { gte: startOfDayWib(now), lt: endOfDayWib(now) } },
  });
  return `INV-${formatDateKeyWib(now)}-${String(salesToday + 1).padStart(4, '0')}`;
}

// Creates a sale in one database transaction. Any thrown error rolls everything back.
export async function createSale(input: CreateSaleInput): Promise<SaleDetailDto> {
  const requestedItems = mergeDuplicateItems(input.items);

  const saleId = await db.$transaction(async (tx) => {
    // 1. Validate that every product exists.
    const products = await tx.product.findMany({
      where: { id: { in: requestedItems.map((item) => item.productId) } },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    // 2. Validate product active status & stock, and take the price from the database (never from the client).
    const lines: SaleLine[] = [];
    const shortages: string[] = [];
    const inactiveProducts: string[] = [];
    for (const item of requestedItems) {
      const product = productsById.get(item.productId);
      if (!product) throw new NotFoundError('Produk tidak ditemukan.');

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
      throw new ConflictError(
        `Produk tidak dapat dijual karena nonaktif: ${inactiveProducts.join(', ')}.`,
      );
    }
    if (shortages.length > 0) {
      throw new ConflictError(`Stok tidak mencukupi: ${shortages.join(', ')}.`);
    }

    const total = lines.reduce((sum, line) => sum.add(line.subtotal), new Prisma.Decimal(0));

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
        throw new ConflictError(`Stok ${line.product.name} berubah dan tidak lagi mencukupi. Silakan coba lagi.`);
      }

      // 6. Record the movement. The row is locked by the update above, so this read is exact.
      const { stock: afterStock } = await tx.product.findUniqueOrThrow({
        where: { id: line.product.id },
        select: { stock: true },
      });
      await tx.stockMovement.create({
        data: {
          productId: line.product.id,
          type: StockMovementType.SALE,
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
