// Shapes returned by the API. Keep in sync with server/src/types/dto.ts.

export interface Product {
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

export interface ProductInput {
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  isActive?: boolean;
  baseUnit?: string;
  purchaseUnit?: string;
  unitsPerPurchaseUnit?: number;
}

export type ProductUpdateInput = Partial<Omit<ProductInput, 'stock'>>;

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  phone?: string | null;
  isActive?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface StaffInput {
  name: string;
  isActive?: boolean;
}

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetail {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  items: SaleItem[];
}

export interface SaleRequestItem {
  productId: string;
  quantity: number;
}

export type StockMovementType = 'INITIAL' | 'SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RECEIPT';

export type StockAdjustmentReason = 'HITUNG_ULANG' | 'RUSAK' | 'KEDALUWARSA' | 'HILANG' | 'LAINNYA';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: StockMovementType;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  reason: StockAdjustmentReason | null;
  note: string | null;
  createdAt: string;
}

export interface StockAdjustmentInput {
  productId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reason: StockAdjustmentReason;
  note?: string;
}

export type PurchaseOrderStatus = 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED';

export interface PurchaseOrderLine {
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

export interface PurchaseOrderSummary {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderedAt: string;
  note: string | null;
  status: PurchaseOrderStatus;
  cancelReason: string | null;
  createdAt: string;
  lineCount: number;
}

export interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderedAt: string;
  note: string | null;
  status: PurchaseOrderStatus;
  cancelReason: string | null;
  createdAt: string;
  lines: PurchaseOrderLine[];
  goodsReceipts: GoodsReceiptSummary[];
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  note?: string;
  lines: Array<{
    productId: string;
    quantity: number; // in purchaseUnit
  }>;
}

export type GoodsReceiptRejectReason = 'PENYOK' | 'KEDALUWARSA' | 'LAINNYA';

export interface GoodsReceiptLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  purchaseOrderLineId: string | null;
  receivedBase: number;
  rejectedBase: number;
  rejectReason: GoodsReceiptRejectReason | null;
  rejectNote: string | null;
  bonusBase: number;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
  unitCostPerPurchaseUnit: number;
  costPerBaseUnit: number;
  effectiveCostPerBaseUnit: number;
}

export interface GoodsReceiptSummary {
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

export interface GoodsReceiptDetail {
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
  lines: GoodsReceiptLine[];
}

export interface CreateGoodsReceiptLineInput {
  productId: string;
  receivedBase: number;
  rejectedBase?: number;
  rejectReason?: GoodsReceiptRejectReason;
  rejectNote?: string;
  bonusBase?: number;
  unitCostPerPurchaseUnit: number;
}

export interface CreateGoodsReceiptInput {
  idempotencyKey: string;
  supplierId: string;
  receivedById: string;
  purchaseOrderId?: string;
  receivedAt?: string;
  note?: string;
  lines: CreateGoodsReceiptLineInput[];
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface DailySalesTrend {
  date: string;
  dayName: string;
  totalRevenue: number;
  transactionCount: number;
  unitsSold: number;
}

export interface ReorderRecommendation {
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

export interface Dashboard {
  totalProducts: number;
  totalUnits: number;
  todaySalesTotal: number | null;
  todayGrossProfit?: number | null;
  lowStockCount: number;
  lowStockThreshold: number;
  latestSales?: SaleSummary[];
  lowStockProducts: Product[];
  topProducts?: TopProduct[];
  weeklyTrends?: DailySalesTrend[];
  reorderRecommendations?: ReorderRecommendation[];
}

export type Role = 'PEMILIK' | 'STAF';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  permissions?: string[];
  staffId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PermissionDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
}

export interface RolePermissionsMatrix {
  definitions?: PermissionDefinition[];
  permissions?: PermissionDefinition[];
  roles?: {
    PEMILIK: string[];
    STAF: string[];
  };
  matrix?: {
    PEMILIK: string[];
    STAF: string[];
  };
}
