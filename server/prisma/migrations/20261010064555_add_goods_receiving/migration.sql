-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('HITUNG_ULANG', 'RUSAK', 'KEDALUWARSA', 'HILANG', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('OPEN', 'PARTIAL', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptRejectReason" AS ENUM ('PENYOK', 'KEDALUWARSA', 'LAINNYA');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RECEIPT';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "baseUnit" TEXT NOT NULL DEFAULT 'pcs',
ADD COLUMN     "purchaseUnit" TEXT NOT NULL DEFAULT 'pcs',
ADD COLUMN     "unitsPerPurchaseUnit" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "reason" "StockAdjustmentReason";

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "orderedBase" INTEGER NOT NULL,
    "fulfilledBase" INTEGER NOT NULL DEFAULT 0,
    "cancelledBase" INTEGER NOT NULL DEFAULT 0,
    "purchaseUnit" TEXT NOT NULL,
    "unitsPerPurchaseUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "purchaseOrderId" UUID,
    "supplierId" UUID NOT NULL,
    "receivedById" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" UUID NOT NULL,
    "goodsReceiptId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "purchaseOrderLineId" UUID,
    "receivedBase" INTEGER NOT NULL,
    "rejectedBase" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" "GoodsReceiptRejectReason",
    "rejectNote" TEXT,
    "bonusBase" INTEGER NOT NULL DEFAULT 0,
    "purchaseUnit" TEXT NOT NULL,
    "unitsPerPurchaseUnit" INTEGER NOT NULL,
    "unitCostPerPurchaseUnit" DECIMAL(12,2) NOT NULL,
    "costPerBaseUnit" DECIMAL(14,4) NOT NULL,
    "effectiveCostPerBaseUnit" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_name_key" ON "Staff"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_productId_idx" ON "PurchaseOrderLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_productId_key" ON "PurchaseOrderLine"("purchaseOrderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_idempotencyKey_key" ON "GoodsReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_idx" ON "GoodsReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedById_idx" ON "GoodsReceipt"("receivedById");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_createdAt_idx" ON "GoodsReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_goodsReceiptId_idx" ON "GoodsReceiptLine"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_productId_idx" ON "GoodsReceiptLine"("productId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual additions (not modelled by Prisma): CHECK constraints as a last line of defence.
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitsPerPurchaseUnit_positive" CHECK ("unitsPerPurchaseUnit" >= 1);

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderedBase_positive" CHECK ("orderedBase" > 0);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_fulfilledBase_non_negative" CHECK ("fulfilledBase" >= 0);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_cancelledBase_non_negative" CHECK ("cancelledBase" >= 0);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_fulfilled_plus_cancelled_le_ordered" CHECK ("fulfilledBase" + "cancelledBase" <= "orderedBase");
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_unitsPerPurchaseUnit_positive" CHECK ("unitsPerPurchaseUnit" >= 1);

ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_quantities_non_negative" CHECK ("receivedBase" >= 0 AND "rejectedBase" >= 0 AND "bonusBase" >= 0);
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_rejected_le_received" CHECK ("rejectedBase" <= "receivedBase");
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_reject_reason_required" CHECK ("rejectedBase" = 0 OR "rejectReason" IS NOT NULL);
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_total_incoming_positive" CHECK ("receivedBase" + "bonusBase" > 0);
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_unitsPerPurchaseUnit_positive" CHECK ("unitsPerPurchaseUnit" >= 1);
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_costs_non_negative" CHECK ("unitCostPerPurchaseUnit" >= 0 AND "costPerBaseUnit" >= 0 AND "effectiveCostPerBaseUnit" >= 0);

