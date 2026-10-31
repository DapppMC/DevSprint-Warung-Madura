import { Prisma, StockMovementType, type Product } from '@prisma/client';
import {
  PRODUCT_HAS_STOCK_HISTORY_MESSAGE,
  PRODUCT_IN_TRANSACTION_MESSAGE,
} from '../lib/constants';
import { db } from '../lib/db';
import { ConflictError, NotFoundError } from '../lib/errors';
import { hasPrismaCode } from '../lib/prisma-errors';
import type { ProductDto } from '../types/dto';
import type {
  CreateProductInput,
  ListProductsFilter,
  UpdateProductInput,
} from '../validators/product.validator';
import { FALLBACK_PRODUCTS } from '../lib/fallback-data';
import { getDatabaseStatus, markDatabaseDown, markDatabaseUp } from '../lib/db-health';

const PRODUCT_NOT_FOUND = 'Produk tidak ditemukan.';
const SKU_ALREADY_USED = 'SKU sudah digunakan oleh produk lain.';

export function toProductDto(
  product: Product,
  options?: { hidePurchasePrice?: boolean },
): ProductDto {
  const dto: ProductDto = {
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

function getFallbackProducts(
  filter: ListProductsFilter,
  options?: { hidePurchasePrice?: boolean },
): ProductDto[] {
  let list = [...FALLBACK_PRODUCTS];
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
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

export async function listProducts(
  filter: ListProductsFilter,
  options?: { hidePurchasePrice?: boolean },
): Promise<ProductDto[]> {
  if (!getDatabaseStatus()) {
    return getFallbackProducts(filter, options);
  }

  const where: Prisma.ProductWhereInput = {};

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
    const products = await db.product.findMany({ where, orderBy: { name: 'asc' } });
    markDatabaseUp();
    return products.map((p) => toProductDto(p, options));
  } catch (err) {
    console.warn(
      '[Product] Database query failed, activating fast fallback products:',
      (err as Error).message,
    );
    markDatabaseDown();
    return getFallbackProducts(filter, options);
  }
}

export async function getProduct(
  id: string,
  options?: { hidePurchasePrice?: boolean },
): Promise<ProductDto> {
  if (!getDatabaseStatus()) {
    const fallback = FALLBACK_PRODUCTS.find((p) => p.id === id || p.sku === id);
    if (!fallback) throw new NotFoundError(PRODUCT_NOT_FOUND);
    return options?.hidePurchasePrice ? { ...fallback, purchasePrice: undefined } : fallback;
  }

  try {
    const product = await db.product.findUnique({ where: { id } });
    if (product) {
      markDatabaseUp();
      return toProductDto(product, options);
    }
  } catch (err) {
    console.warn(
      '[Product] Database query failed during getProduct, checking fallback:',
      (err as Error).message,
    );
    markDatabaseDown();
  }

  const fallback = FALLBACK_PRODUCTS.find((p) => p.id === id || p.sku === id);
  if (!fallback) throw new NotFoundError(PRODUCT_NOT_FOUND);
  if (options?.hidePurchasePrice) {
    return { ...fallback, purchasePrice: undefined };
  }
  return fallback;
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  try {
    const product = await db.$transaction(async (tx) => {
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
            type: StockMovementType.INITIAL,
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
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) throw new ConflictError(SKU_ALREADY_USED);
    throw error;
  }
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  try {
    const product = await db.product.update({ where: { id }, data: input });
    return toProductDto(product);
  } catch (error) {
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    if (hasPrismaCode(error, 'P2002')) throw new ConflictError(SKU_ALREADY_USED);
    throw error;
  }
}

// Hard delete. A product can only be removed while nothing but its own initial stock entry refers
// to it. The foreign keys in PostgreSQL (ON DELETE RESTRICT) are the final guard; the checks below
// exist to give the owner a clear message.
export async function deleteProduct(id: string): Promise<void> {
  const product = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND);

  const saleItemCount = await db.saleItem.count({ where: { productId: id } });
  if (saleItemCount > 0) throw new ConflictError(PRODUCT_IN_TRANSACTION_MESSAGE);

  const otherMovementCount = await db.stockMovement.count({
    where: { productId: id, type: { not: StockMovementType.INITIAL } },
  });
  if (otherMovementCount > 0) throw new ConflictError(PRODUCT_HAS_STOCK_HISTORY_MESSAGE);

  const poLineCount = await db.purchaseOrderLine.count({ where: { productId: id } });
  if (poLineCount > 0) {
    throw new ConflictError('Produk tidak dapat dihapus karena sudah pernah dipesan.');
  }

  const grLineCount = await db.goodsReceiptLine.count({ where: { productId: id } });
  if (grLineCount > 0) {
    throw new ConflictError('Produk tidak dapat dihapus karena sudah pernah diterima.');
  }

  try {
    await db.$transaction([
      db.stockMovement.deleteMany({ where: { productId: id, type: StockMovementType.INITIAL } }),
      db.product.delete({ where: { id } }),
    ]);
  } catch (error) {
    // Someone referenced the product between the checks above and the delete.
    if (hasPrismaCode(error, 'P2003')) throw new ConflictError(PRODUCT_IN_TRANSACTION_MESSAGE);
    if (hasPrismaCode(error, 'P2025')) throw new NotFoundError(PRODUCT_NOT_FOUND);
    throw error;
  }
}
