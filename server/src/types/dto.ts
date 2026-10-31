// Shapes returned by the API. Money is sent as plain numbers (Rupiah), dates as ISO strings.
// The client keeps its own copy in client/src/types/api.ts, so change both when you change one.

export type RoleDto = 'PEMILIK' | 'STAF';

export interface UserDto {
  id: string;
  username: string;
  name: string;
  role: RoleDto;
  permissions?: string[];
  staffId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchasePrice?: number;
  sellingPrice: number;
  stock: number;
  isActive: boolean;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface StaffDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface SaleSummaryDto {
  id: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetailDto {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  items: SaleItemDto[];
}

export type StockMovementTypeDto = 'INITIAL' | 'SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RECEIPT';

export type StockAdjustmentReasonDto = 'HITUNG_ULANG' | 'RUSAK' | 'KEDALUWARSA' | 'HILANG' | 'LAINNYA';

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: StockMovementTypeDto;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  reason: StockAdjustmentReasonDto | null;
  note: string | null;
  createdAt: string;
}

export type PurchaseOrderStatusDto = 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED';

export interface PurchaseOrderLineDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  orderedBase: number;
  fulfilledBase: number;
  cancelledBase: number;
  remainingBase: number;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
}

export interface PurchaseOrderSummaryDto {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderedAt: string;
  note: string | null;
  status: PurchaseOrderStatusDto;
  cancelReason: string | null;
  createdAt: string;
  lineCount: number;
}

export interface PurchaseOrderDetailDto {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderedAt: string;
  note: string | null;
  status: PurchaseOrderStatusDto;
  cancelReason: string | null;
  createdAt: string;
  lines: PurchaseOrderLineDto[];
  goodsReceipts: GoodsReceiptSummaryDto[];
}

export type GoodsReceiptRejectReasonDto = 'PENYOK' | 'KEDALUWARSA' | 'LAINNYA';

export interface GoodsReceiptLineDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  purchaseOrderLineId: string | null;
  receivedBase: number;
  rejectedBase: number;
  rejectReason: GoodsReceiptRejectReasonDto | null;
  rejectNote: string | null;
  bonusBase: number;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
  unitCostPerPurchaseUnit?: number;
  costPerBaseUnit?: number;
  effectiveCostPerBaseUnit?: number;
}

export interface GoodsReceiptSummaryDto {
  id: string;
  receiptNumber: string;
  idempotencyKey: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  supplierId: string;
  supplierName: string;
  receivedById: string;
  receivedByName: string;
  receivedAt: string;
  note: string | null;
  createdAt: string;
  itemCount: number;
}

export interface GoodsReceiptDetailDto {
  id: string;
  receiptNumber: string;
  idempotencyKey: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  supplierId: string;
  supplierName: string;
  receivedById: string;
  receivedByName: string;
  receivedAt: string;
  note: string | null;
  createdAt: string;
  lines: GoodsReceiptLineDto[];
}

export interface TopProductDto {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface DailySalesTrendDto {
  date: string;
  dayName: string;
  totalRevenue: number;
  transactionCount: number;
  unitsSold: number;
}

export interface ReorderRecommendationDto {
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
  recommendedPurchaseQty: number;
  estimatedCost: number;
  supplierName?: string;
  supplierId?: string;
}

export interface DashboardDto {
  totalProducts: number;
  totalUnits: number;
  todaySalesTotal: number | null;
  todayGrossProfit?: number | null;
  lowStockCount: number;
  lowStockThreshold: number;
  latestSales: SaleSummaryDto[] | null;
  lowStockProducts: ProductDto[];
  topProducts?: TopProductDto[];
  weeklyTrends?: DailySalesTrendDto[];
  reorderRecommendations?: ReorderRecommendationDto[];
}
