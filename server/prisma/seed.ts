import 'dotenv/config';
import { PrismaClient, StockMovementType, PurchaseOrderStatus, GoodsReceiptRejectReason } from '@prisma/client';
import { formatDateKeyWib } from '../src/lib/dates';
import { hashPassword } from '../src/lib/auth-crypto';
import { ensureDefaultPermissions } from '../src/services/permission.service';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  initialStock: number;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
}

// 15 Komoditas Otentik Warung Madura dengan Keragaman Stok & Multi-Satuan
const productSeeds: ProductSeed[] = [
  { sku: 'MIE-001', name: 'Indomie Goreng', category: 'Makanan Instan', purchasePrice: 2800, sellingPrice: 3500, initialStock: 40, baseUnit: 'bungkus', purchaseUnit: 'dus', unitsPerPurchaseUnit: 40 },
  { sku: 'MIE-002', name: 'Indomie Kuah Kari Ayam', category: 'Makanan Instan', purchasePrice: 2750, sellingPrice: 3500, initialStock: 40, baseUnit: 'bungkus', purchaseUnit: 'dus', unitsPerPurchaseUnit: 40 },
  { sku: 'MNM-001', name: 'Aqua 600 ml', category: 'Minuman', purchasePrice: 2300, sellingPrice: 3000, initialStock: 24, baseUnit: 'botol', purchaseUnit: 'dus', unitsPerPurchaseUnit: 24 },
  { sku: 'MNM-002', name: 'Teh Botol Sosro 450ml', category: 'Minuman', purchasePrice: 3800, sellingPrice: 5000, initialStock: 12, baseUnit: 'botol', purchaseUnit: 'dus', unitsPerPurchaseUnit: 24 },
  { sku: 'MNM-003', name: 'Kopi Kapal Api Sachet', category: 'Minuman', purchasePrice: 1100, sellingPrice: 1500, initialStock: 20, baseUnit: 'sachet', purchaseUnit: 'renteng', unitsPerPurchaseUnit: 10 },
  { sku: 'SMB-001', name: 'Minyak Goreng Bimoli 1L', category: 'Sembako', purchasePrice: 17500, sellingPrice: 19500, initialStock: 24, baseUnit: 'pcs', purchaseUnit: 'dus', unitsPerPurchaseUnit: 12 },
  { sku: 'SMB-002', name: 'Gula Pasir Gulaku 1 kg', category: 'Sembako', purchasePrice: 15500, sellingPrice: 17500, initialStock: 8, baseUnit: 'bungkus', purchaseUnit: 'bal', unitsPerPurchaseUnit: 20 },
  { sku: 'SMB-003', name: 'Beras Rojolele Super 5 kg', category: 'Sembako', purchasePrice: 62000, sellingPrice: 68000, initialStock: 3, baseUnit: 'karung', purchaseUnit: 'karung', unitsPerPurchaseUnit: 1 },
  { sku: 'SMB-004', name: 'Garam Dapur Cap Kapal 250g', category: 'Sembako', purchasePrice: 2500, sellingPrice: 3500, initialStock: 4, baseUnit: 'pcs', purchaseUnit: 'pak', unitsPerPurchaseUnit: 10 },
  { sku: 'SMB-005', name: 'Telur Ayam Ras 1 kg', category: 'Sembako', purchasePrice: 25000, sellingPrice: 28500, initialStock: 10, baseUnit: 'kg', purchaseUnit: 'kg', unitsPerPurchaseUnit: 1 },
  { sku: 'SMB-006', name: 'Tepung Terigu Segitiga Biru 1 kg', category: 'Sembako', purchasePrice: 11500, sellingPrice: 13500, initialStock: 0, baseUnit: 'pcs', purchaseUnit: 'dus', unitsPerPurchaseUnit: 10 }, // 0 STOK (HABIS)
  { sku: 'RT-001', name: 'Sabun Mandi Lifebuoy', category: 'Kebutuhan Rumah Tangga', purchasePrice: 2800, sellingPrice: 3500, initialStock: 12, baseUnit: 'pcs', purchaseUnit: 'dus', unitsPerPurchaseUnit: 36 },
  { sku: 'RT-002', name: 'Shampo Sunsilk Sachet', category: 'Kebutuhan Rumah Tangga', purchasePrice: 900, sellingPrice: 1500, initialStock: 24, baseUnit: 'sachet', purchaseUnit: 'renteng', unitsPerPurchaseUnit: 12 },
  { sku: 'SNK-001', name: 'Biskuit Roma Kelapa 300g', category: 'Makanan Ringan', purchasePrice: 6500, sellingPrice: 8000, initialStock: 15, baseUnit: 'pcs', purchaseUnit: 'karton', unitsPerPurchaseUnit: 12 },
  { sku: 'SNK-002', name: 'Chitato Sapi Panggang 68g', category: 'Makanan Ringan', purchasePrice: 9500, sellingPrice: 11500, initialStock: 20, baseUnit: 'pcs', purchaseUnit: 'karton', unitsPerPurchaseUnit: 20 },
];

interface SeededProduct {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPurchaseUnit: number;
}

const seeded = new Map<string, SeededProduct>();

function getSeeded(sku: string): SeededProduct {
  const p = seeded.get(sku);
  if (!p) throw new Error(`Unknown SKU in seed: ${sku}`);
  return p;
}

async function clearDatabase(): Promise<void> {
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.business.deleteMany();
  await prisma.scraperRun.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
}

async function seedProducts(): Promise<void> {
  const createdAt = daysAgo(7);
  for (const s of productSeeds) {
    const product = await prisma.product.create({
      data: {
        sku: s.sku,
        name: s.name,
        category: s.category,
        purchasePrice: s.purchasePrice,
        sellingPrice: s.sellingPrice,
        stock: s.initialStock,
        baseUnit: s.baseUnit,
        purchaseUnit: s.purchaseUnit,
        unitsPerPurchaseUnit: s.unitsPerPurchaseUnit,
        createdAt,
      },
    });

    if (s.initialStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: StockMovementType.INITIAL,
          quantity: s.initialStock,
          beforeStock: 0,
          afterStock: s.initialStock,
          note: 'Stok awal pembukaan toko',
          createdAt,
        },
      });
    }

    seeded.set(s.sku, {
      id: product.id,
      sku: s.sku,
      name: s.name,
      sellingPrice: s.sellingPrice,
      purchasePrice: s.purchasePrice,
      stock: s.initialStock,
      baseUnit: s.baseUnit,
      purchaseUnit: s.purchaseUnit,
      unitsPerPurchaseUnit: s.unitsPerPurchaseUnit,
    });
  }
}

interface SeededEntities {
  staffUdin: { id: string; name: string };
  staffSari: { id: string; name: string };
  staffCakRofi: { id: string; name: string };
  supHaji: { id: string; name: string };
  supJaya: { id: string; name: string };
  supIndomarco: { id: string; name: string };
  supSumberMakmur: { id: string; name: string };
}

async function seedStaffAndSuppliers(): Promise<SeededEntities> {
  const staffCakRofi = await prisma.staff.create({ data: { name: 'Cak Rofi', isActive: true } });
  const staffUdin = await prisma.staff.create({ data: { name: 'Udin', isActive: true } });
  const staffSari = await prisma.staff.create({ data: { name: 'Sari', isActive: true } });

  const supHaji = await prisma.supplier.create({
    data: { name: 'Pak Haji Slamet (Grosir Beras & Pangan)', phone: '081230112233', isActive: true },
  });
  const supJaya = await prisma.supplier.create({
    data: { name: 'Toko Grosir Jaya Abadi Sembako', phone: '081331224455', isActive: true },
  });
  const supIndomarco = await prisma.supplier.create({
    data: { name: 'PT Indomarco Distribusi Surabaya', phone: '081993445577', isActive: true },
  });
  const supSumberMakmur = await prisma.supplier.create({
    data: { name: 'CV Sumber Makmur Sidoarjo', phone: '081334455667', isActive: true },
  });

  const ownerPinHash = await hashPassword('123456');
  const udinPinHash = await hashPassword('1111');
  const sariPinHash = await hashPassword('2222');

  await prisma.user.createMany({
    data: [
      {
        username: 'cakrofi',
        name: 'Cak Rofi',
        passwordHash: ownerPinHash,
        role: 'PEMILIK',
        staffId: staffCakRofi.id,
        isActive: true,
      },
      {
        username: 'udin',
        name: 'Udin',
        passwordHash: udinPinHash,
        role: 'STAF',
        staffId: staffUdin.id,
        isActive: true,
      },
      {
        username: 'sari',
        name: 'Sari',
        passwordHash: sariPinHash,
        role: 'STAF',
        staffId: staffSari.id,
        isActive: true,
      },
    ],
  });

  await ensureDefaultPermissions();

  return {
    staffUdin,
    staffSari,
    staffCakRofi,
    supHaji,
    supJaya,
    supIndomarco,
    supSumberMakmur,
  };
}

async function recordStockReceipt(
  productId: string,
  quantity: number,
  referenceId: string,
  createdAt: Date,
  note: string,
): Promise<void> {
  const p = [...seeded.values()].find((item) => item.id === productId);
  if (!p) return;
  const beforeStock = p.stock;
  const afterStock = beforeStock + quantity;
  p.stock = afterStock;

  await prisma.stockMovement.create({
    data: {
      productId,
      type: StockMovementType.RECEIPT,
      quantity,
      beforeStock,
      afterStock,
      referenceType: 'GOODS_RECEIPT',
      referenceId,
      note,
      createdAt,
    },
  });
}

async function seedPurchaseOrdersAndGoodsReceipts(entities: SeededEntities): Promise<void> {
  const { staffUdin, staffSari, staffCakRofi, supHaji, supJaya, supIndomarco, supSumberMakmur } = entities;

  // =========================================================================
  // SCENARIO 1: GR-202610-0004 - Direct Goods Receipt WITHOUT PO (5 hari lalu)
  // Penerimaan langsung canvasser sales
  // =========================================================================
  const grDirect = await prisma.goodsReceipt.create({
    data: {
      receiptNumber: 'GR-202610-0004',
      idempotencyKey: 'idemp-gr-direct-0004',
      supplierId: supIndomarco.id,
      receivedById: staffCakRofi.id,
      receivedAt: daysAgo(5.2),
      note: 'Surat Jalan: DIRECT-IND-771. Pembelian langsung di tempat saat sales canvasser mampir promo.',
    },
  });

  const pTeh = getSeeded('MNM-002');
  const pSabun = getSeeded('RT-001');

  // Teh Botol: 2 dus = 48 botol
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: grDirect.id,
      productId: pTeh.id,
      receivedBase: 48,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 24,
      unitCostPerPurchaseUnit: 91200,
      costPerBaseUnit: 3800,
      effectiveCostPerBaseUnit: 3800,
      createdAt: daysAgo(5.2),
    },
  });
  await recordStockReceipt(pTeh.id, 48, grDirect.id, daysAgo(5.2), 'Penerimaan langsung GR-202610-0004 (2 dus)');

  // Sabun Lifebuoy: 1 dus = 36 pcs
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: grDirect.id,
      productId: pSabun.id,
      receivedBase: 36,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 36,
      unitCostPerPurchaseUnit: 100800,
      costPerBaseUnit: 2800,
      effectiveCostPerBaseUnit: 2800,
      createdAt: daysAgo(5.2),
    },
  });
  await recordStockReceipt(pSabun.id, 36, grDirect.id, daysAgo(5.2), 'Penerimaan langsung GR-202610-0004 (1 dus)');

  // =========================================================================
  // SCENARIO 2: PO-202610-0004 (COMPLETE via Cancel Remaining) + GR-202610-0003 (with Reject)
  // Supplier: CV Sumber Makmur Sidoarjo (4 hari lalu)
  // Telur ayam pecah 2 kg ditolak, sisa pesanan dibatalkan
  // =========================================================================
  const pTelur = getSeeded('SMB-005');
  const pKopi = getSeeded('MNM-003');

  const po4 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-202610-0004',
      supplierId: supSumberMakmur.id,
      orderedAt: daysAgo(4.8),
      status: PurchaseOrderStatus.COMPLETE,
      cancelReason: 'Sisa 10 kg telur & 4 renteng kopi dibatalkan karena armada supplier mengalami kendala logistik.',
      note: 'Pesanan pasokan telur dan kopi mingguan',
    },
  });

  const polTelur = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po4.id,
      productId: pTelur.id,
      orderedBase: 30, // 30 kg
      fulfilledBase: 20, // diterima bersih 20 kg
      cancelledBase: 10, // sisa dibatalkan
      purchaseUnit: 'kg',
      unitsPerPurchaseUnit: 1,
      createdAt: daysAgo(4.8),
    },
  });

  const polKopi = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po4.id,
      productId: pKopi.id,
      orderedBase: 100, // 10 renteng = 100 sachet
      fulfilledBase: 60, // diterima 6 renteng = 60 sachet
      cancelledBase: 40, // sisa 4 renteng dibatalkan
      purchaseUnit: 'renteng',
      unitsPerPurchaseUnit: 10,
      createdAt: daysAgo(4.8),
    },
  });

  // GR-202610-0003 terkait PO-202610-0004
  const gr3 = await prisma.goodsReceipt.create({
    data: {
      receiptNumber: 'GR-202610-0003',
      idempotencyKey: 'idemp-gr-reject-0003',
      purchaseOrderId: po4.id,
      supplierId: supSumberMakmur.id,
      receivedById: staffUdin.id,
      receivedAt: daysAgo(4.2),
      note: 'Surat Jalan: SJ-SM-1033. 2 kg telur ayam pecah/basah di bak truk langsung ditolak di tempat.',
    },
  });

  // Telur: 22 kg tiba, 2 kg ditolak (PENYOK), 20 kg masuk stok
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr3.id,
      productId: pTelur.id,
      purchaseOrderLineId: polTelur.id,
      receivedBase: 22,
      rejectedBase: 2,
      rejectReason: GoodsReceiptRejectReason.PENYOK,
      rejectNote: '2 kg cangkang retak dan bocor saat ekspedisi',
      bonusBase: 0,
      purchaseUnit: 'kg',
      unitsPerPurchaseUnit: 1,
      unitCostPerPurchaseUnit: 25000,
      costPerBaseUnit: 25000,
      effectiveCostPerBaseUnit: 25000,
      createdAt: daysAgo(4.2),
    },
  });
  await recordStockReceipt(pTelur.id, 20, gr3.id, daysAgo(4.2), 'GR-202610-0003 (Net diterima 20 kg, 2 kg ditolak pecah)');

  // Kopi: 60 sachet (6 renteng) diterima utuh
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr3.id,
      productId: pKopi.id,
      purchaseOrderLineId: polKopi.id,
      receivedBase: 60,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'renteng',
      unitsPerPurchaseUnit: 10,
      unitCostPerPurchaseUnit: 11000,
      costPerBaseUnit: 1100,
      effectiveCostPerBaseUnit: 1100,
      createdAt: daysAgo(4.2),
    },
  });
  await recordStockReceipt(pKopi.id, 60, gr3.id, daysAgo(4.2), 'GR-202610-0003 (6 renteng)');

  // =========================================================================
  // SCENARIO 3: PO-202610-0003 (COMPLETE 100%) + GR-202610-0002 (with Vendor Bonus)
  // Supplier: Pak Haji Slamet (Beras 10 karung & Gula 2 bal + Bonus 5 bungkus) (3 hari lalu)
  // =========================================================================
  const pBeras = getSeeded('SMB-003');
  const pGula = getSeeded('SMB-002');

  const po3 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-202610-0003',
      supplierId: supHaji.id,
      orderedAt: daysAgo(3.8),
      status: PurchaseOrderStatus.COMPLETE,
      note: 'Pesanan beras premium dan gula pasir langsung dari penggilingan Pak Haji.',
    },
  });

  const polBeras = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po3.id,
      productId: pBeras.id,
      orderedBase: 10, // 10 karung
      fulfilledBase: 10,
      cancelledBase: 0,
      purchaseUnit: 'karung',
      unitsPerPurchaseUnit: 1,
      createdAt: daysAgo(3.8),
    },
  });

  const polGula = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po3.id,
      productId: pGula.id,
      orderedBase: 40, // 2 bal = 40 bungkus
      fulfilledBase: 40,
      cancelledBase: 0,
      purchaseUnit: 'bal',
      unitsPerPurchaseUnit: 20,
      createdAt: daysAgo(3.8),
    },
  });

  const gr2 = await prisma.goodsReceipt.create({
    data: {
      receiptNumber: 'GR-202610-0002',
      idempotencyKey: 'idemp-gr-bonus-0002',
      purchaseOrderId: po3.id,
      supplierId: supHaji.id,
      receivedById: staffSari.id,
      receivedAt: daysAgo(3.2),
      note: 'Surat Jalan: SJ-HS-4410. Pak Haji memberikan bonus promo 5 bungkus gula pasir untuk langganan setia.',
    },
  });

  // Beras: 10 karung utuh
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr2.id,
      productId: pBeras.id,
      purchaseOrderLineId: polBeras.id,
      receivedBase: 10,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'karung',
      unitsPerPurchaseUnit: 1,
      unitCostPerPurchaseUnit: 62000,
      costPerBaseUnit: 62000,
      effectiveCostPerBaseUnit: 62000,
      createdAt: daysAgo(3.2),
    },
  });
  await recordStockReceipt(pBeras.id, 10, gr2.id, daysAgo(3.2), 'GR-202610-0002 (10 karung beras)');

  // Gula: 40 diterima + BONUS 5 bungkus! Total 45 bungkus masuk stok
  // Total cost = 2 bal * 310.000 = 620.000. Effective cost per bungkus = 620.000 / 45 = 13.777,7778
  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr2.id,
      productId: pGula.id,
      purchaseOrderLineId: polGula.id,
      receivedBase: 40,
      rejectedBase: 0,
      bonusBase: 5,
      purchaseUnit: 'bal',
      unitsPerPurchaseUnit: 20,
      unitCostPerPurchaseUnit: 310000,
      costPerBaseUnit: 15500,
      effectiveCostPerBaseUnit: 13777.7778,
      createdAt: daysAgo(3.2),
    },
  });
  await recordStockReceipt(pGula.id, 45, gr2.id, daysAgo(3.2), 'GR-202610-0002 (40 bungkus PO + BONUS 5 bungkus)');

  // =========================================================================
  // SCENARIO 4: PO-202610-0002 (PARTIAL) + GR-202610-0001 (Sebagian Barang Tiba)
  // Supplier: Toko Grosir Jaya Abadi Sembako (2 hari lalu)
  // Dipesan 5 dus Indomie & 4 dus Aqua. Baru tiba 3 dus Indomie & 2 dus Aqua.
  // =========================================================================
  const pIndomie = getSeeded('MIE-001');
  const pAqua = getSeeded('MNM-001');

  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-202610-0002',
      supplierId: supJaya.id,
      orderedAt: daysAgo(2.8),
      status: PurchaseOrderStatus.PARTIAL,
      note: 'Pengiriman dua tahap. Tahap 1 dikirim hari ini, tahap 2 sisa 2 dus Indomie dan 2 dus Aqua lusa.',
    },
  });

  const polIndomie = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po2.id,
      productId: pIndomie.id,
      orderedBase: 200, // 5 dus = 200 bungkus
      fulfilledBase: 120, // baru tiba 3 dus = 120 bungkus
      cancelledBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 40,
      createdAt: daysAgo(2.8),
    },
  });

  const polAqua = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po2.id,
      productId: pAqua.id,
      orderedBase: 96, // 4 dus = 96 botol
      fulfilledBase: 48, // baru tiba 2 dus = 48 botol
      cancelledBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 24,
      createdAt: daysAgo(2.8),
    },
  });

  const gr1 = await prisma.goodsReceipt.create({
    data: {
      receiptNumber: 'GR-202610-0001',
      idempotencyKey: 'idemp-gr-partial-0001',
      purchaseOrderId: po2.id,
      supplierId: supJaya.id,
      receivedById: staffUdin.id,
      receivedAt: daysAgo(2.2),
      note: 'Surat Jalan: SJ-JAYA-9982. Pengiriman tahap 1 (3 dus Indomie, 2 dus Aqua). Sisa menyusul.',
    },
  });

  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr1.id,
      productId: pIndomie.id,
      purchaseOrderLineId: polIndomie.id,
      receivedBase: 120,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 40,
      unitCostPerPurchaseUnit: 112000,
      costPerBaseUnit: 2800,
      effectiveCostPerBaseUnit: 2800,
      createdAt: daysAgo(2.2),
    },
  });
  await recordStockReceipt(pIndomie.id, 120, gr1.id, daysAgo(2.2), 'GR-202610-0001 (Tahap 1 PO-0002, 3 dus = 120 bungkus)');

  await prisma.goodsReceiptLine.create({
    data: {
      goodsReceiptId: gr1.id,
      productId: pAqua.id,
      purchaseOrderLineId: polAqua.id,
      receivedBase: 48,
      rejectedBase: 0,
      bonusBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 24,
      unitCostPerPurchaseUnit: 55200,
      costPerBaseUnit: 2300,
      effectiveCostPerBaseUnit: 2300,
      createdAt: daysAgo(2.2),
    },
  });
  await recordStockReceipt(pAqua.id, 48, gr1.id, daysAgo(2.2), 'GR-202610-0001 (Tahap 1 PO-0002, 2 dus = 48 botol)');

  // =========================================================================
  // SCENARIO 5: PO-202610-0001 (OPEN - Menunggu Pengiriman 0%)
  // Supplier: PT Indomarco Distribusi Surabaya (1 hari lalu)
  // Belum ada GR sama sekali (0% progress)
  // =========================================================================
  const pTerigu = getSeeded('SMB-006');
  const pMinyak = getSeeded('SMB-001');

  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-202610-0001',
      supplierId: supIndomarco.id,
      orderedAt: daysAgo(1.2),
      status: PurchaseOrderStatus.OPEN,
      note: 'Pemesanan restok mingguan sembako. Dijadwalkan tiba besok sore menggunakan armada truk box.',
    },
  });

  await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po1.id,
      productId: pTerigu.id,
      orderedBase: 50, // 5 dus = 50 pcs
      fulfilledBase: 0,
      cancelledBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 10,
      createdAt: daysAgo(1.2),
    },
  });

  await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po1.id,
      productId: pMinyak.id,
      orderedBase: 36, // 3 dus = 36 pcs
      fulfilledBase: 0,
      cancelledBase: 0,
      purchaseUnit: 'dus',
      unitsPerPurchaseUnit: 12,
      createdAt: daysAgo(1.2),
    },
  });

  // =========================================================================
  // SCENARIO 6: PO-202610-0005 (CANCELLED - Dibatalkan Sepenuhnya)
  // Supplier: Toko Grosir Jaya Abadi Sembako (6 hari lalu)
  // Dibatalkan sebelum ada barang yang dikirim
  // =========================================================================
  const pChitato = getSeeded('SNK-002');

  const po5 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-202610-0005',
      supplierId: supJaya.id,
      orderedAt: daysAgo(6),
      status: PurchaseOrderStatus.CANCELLED,
      cancelReason: 'Pesanan dibatalkan sepenuhnya oleh Cak Rofi karena terjadi lonjakan harga sepihak dari pihak grosir.',
      note: 'PO darurat snack biskuit & chitato',
    },
  });

  await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po5.id,
      productId: pChitato.id,
      orderedBase: 80, // 4 karton = 80 pcs
      fulfilledBase: 0,
      cancelledBase: 80, // Dibatalkan 100%
      purchaseUnit: 'karton',
      unitsPerPurchaseUnit: 20,
      createdAt: daysAgo(6),
    },
  });
}

let invoiceCounter = 1;
async function seedSale(createdAt: Date, lines: Array<[sku: string, quantity: number]>): Promise<void> {
  const invSeq = String(invoiceCounter++).padStart(4, '0');
  const invoiceNumber = `INV-${formatDateKeyWib(createdAt)}-${invSeq}`;

  const items = lines.map(([sku, quantity]) => {
    const product = getSeeded(sku);
    return { sku, product, quantity, subtotal: product.sellingPrice * quantity };
  });
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const sale = await prisma.sale.create({
    data: {
      invoiceNumber,
      total,
      createdAt,
      items: {
        create: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.sellingPrice,
          subtotal: item.subtotal,
        })),
      },
    },
  });

  for (const item of items) {
    const beforeStock = item.product.stock;
    const afterStock = beforeStock - item.quantity;
    item.product.stock = afterStock;

    await prisma.stockMovement.create({
      data: {
        productId: item.product.id,
        type: StockMovementType.SALE,
        quantity: item.quantity,
        beforeStock,
        afterStock,
        referenceType: 'SALE',
        referenceId: sale.id,
        note: `Penjualan ${invoiceNumber}`,
        createdAt,
      },
    });
  }
}

async function seedAdjustmentOut(createdAt: Date, sku: string, quantity: number, note: string): Promise<void> {
  const product = getSeeded(sku);
  const beforeStock = product.stock;
  const afterStock = beforeStock - quantity;
  product.stock = afterStock;

  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: StockMovementType.ADJUSTMENT_OUT,
      quantity,
      beforeStock,
      afterStock,
      note,
      createdAt,
    },
  });
}

async function syncProductStock(): Promise<void> {
  for (const product of seeded.values()) {
    await prisma.product.update({ where: { id: product.id }, data: { stock: product.stock } });
  }
}

async function seedBusinessesAndChat(): Promise<void> {
  const cakrofi = await prisma.user.findUnique({ where: { username: 'cakrofi' } });
  const udin = await prisma.user.findUnique({ where: { username: 'udin' } });

  if (!cakrofi || !udin) return;

  const mitraPinHash = await hashPassword('mitra12345');
  const userMitraKeputih = await prisma.user.create({
    data: {
      username: 'mitra_keputih',
      name: 'Toko Sembako Keputih Permai',
      passwordHash: mitraPinHash,
      role: 'STAF',
      isActive: true,
    },
  });

  const userMitraSukolilo = await prisma.user.create({
    data: {
      username: 'mitra_sukolilo',
      name: 'UD Sumber Rejeki Beras Sukolilo',
      passwordHash: mitraPinHash,
      role: 'STAF',
      isActive: true,
    },
  });

  const userMitraPgs = await prisma.user.create({
    data: {
      username: 'mitra_pgs',
      name: 'Pusat Grosir Surabaya (PGS) Mitra',
      passwordHash: mitraPinHash,
      role: 'STAF',
      isActive: true,
    },
  });

  // 1. Mitra Surabaya 1: Toko Sembako Keputih Permai (Dekat Gang 1D: ~0.4 km)
  await prisma.business.create({
    data: {
      name: 'Toko Sembako Keputih Permai',
      role: 'GROSIR',
      desa: 'Keputih',
      district: 'Surabaya',
      address: 'Jl. Keputih Tegal No. 24, Sukolilo, Surabaya (Dekat Pasar Keputih)',
      publicLat: -7.2942,
      publicLng: 112.7995,
      source: 'SELF',
      userId: userMitraKeputih.id,
      contactPhone: '081230112233',
      dedupeKey: 'sembako keputih permai|surabaya',
      catalogItems: {
        create: [
          { commodity: 'BERAS_PREMIUM', unit: 'kg', priceMin: 14500, priceMax: 15500, stock: 850, capacityPerMonth: 50 },
          { commodity: 'MINYAK_GORENG', unit: 'liter', priceMin: 17500, priceMax: 18500, stock: 240, capacityPerMonth: 30 },
          { commodity: 'GULA_PASIR', unit: 'kg', priceMin: 16500, priceMax: 17500, stock: 300, capacityPerMonth: 20 },
        ],
      },
    },
  });

  // 2. Mitra Surabaya 2: UD Sumber Rejeki Beras Sukolilo (~1.1 km)
  await prisma.business.create({
    data: {
      name: 'UD Sumber Rejeki Beras Sukolilo',
      role: 'PENGEPUL',
      desa: 'Gebang Putih',
      district: 'Surabaya',
      address: 'Jl. Gebang Putih No. 18, Sukolilo, Surabaya',
      publicLat: -7.2885,
      publicLng: 112.7925,
      source: 'SELF',
      userId: userMitraSukolilo.id,
      contactPhone: '081331224455',
      dedupeKey: 'sumber rejeki beras sukolilo|surabaya',
      catalogItems: {
        create: [
          { commodity: 'BERAS_MEDIUM', unit: 'kg', priceMin: 12800, priceMax: 13500, stock: 2500, capacityPerMonth: 100 },
          { commodity: 'BERAS_PREMIUM', unit: 'kg', priceMin: 15000, priceMax: 15800, stock: 1800, capacityPerMonth: 80 },
        ],
      },
    },
  });

  // 3. Mitra Surabaya 3: Grosir Pangan Pasar Pabean Surabaya (~7.5 km)
  await prisma.business.create({
    data: {
      name: 'Grosir Pangan Pasar Pabean Surabaya',
      role: 'GROSIR',
      desa: 'Pabean',
      district: 'Surabaya',
      address: 'Jl. Panggung No. 41, Pabean Cantikan, Kota Surabaya',
      publicLat: -7.2340,
      publicLng: 112.7410,
      source: 'DINAS',
      contactPhone: '081772334466',
      dedupeKey: 'pangan pasar pabean|surabaya',
      sourceUrl: 'https://dinas-pasar.surabaya.go.id/direktori',
      catalogItems: {
        create: [
          { commodity: 'BERAS_MEDIUM', unit: 'kg', priceMin: 13000, priceMax: 13500, stock: 5000, capacityPerMonth: 200 },
          { commodity: 'GULA_PASIR', unit: 'bal', priceMin: 320000, priceMax: 330000, stock: 150, capacityPerMonth: 50 },
        ],
      },
    },
  });

  // 4. Mitra Surabaya 4: Pusat Grosir Surabaya (PGS) Mitra Sembako (~8.3 km)
  await prisma.business.create({
    data: {
      name: 'Pusat Grosir Surabaya (PGS) Mitra Sembako',
      role: 'GROSIR',
      desa: 'Gundih',
      district: 'Surabaya',
      address: 'Jl. Dupak No. 1, Blok A2, Bubutan, Surabaya',
      publicLat: -7.2510,
      publicLng: 112.7300,
      source: 'SELF',
      userId: userMitraPgs.id,
      contactPhone: '081993445577',
      dedupeKey: 'pgs mitra sembako|surabaya',
      catalogItems: {
        create: [
          { commodity: 'MINYAK_GORENG', unit: 'dus', priceMin: 165000, priceMax: 175000, stock: 120, capacityPerMonth: 60 },
          { commodity: 'TEPUNG_TERIGU', unit: 'kg', priceMin: 11200, priceMax: 11800, stock: 400, capacityPerMonth: 30 },
          { commodity: 'MIE_INSTAN', unit: 'dus', priceMin: 112000, priceMax: 115000, stock: 80, capacityPerMonth: 40 },
        ],
      },
    },
  });

  // 5. Mitra Surabaya 5: Pasar Induk Osowilangun (PIOS) (~18.5 km)
  await prisma.business.create({
    data: {
      name: 'Pasar Induk Osowilangun (PIOS)',
      role: 'GROSIR',
      desa: 'Tambak Osowilangun',
      district: 'Surabaya',
      address: 'Jl. Tambak Osowilangun KM 12, Benowo, Surabaya',
      publicLat: -7.2150,
      publicLng: 112.6350,
      source: 'DINAS',
      contactPhone: '081223344556',
      dedupeKey: 'pasar induk osowilangun|surabaya',
      sourceUrl: 'https://dinas-pasar.surabaya.go.id/direktori',
      catalogItems: {
        create: [
          { commodity: 'BERAS_PREMIUM', unit: 'karung', priceMin: 380000, priceMax: 400000, stock: 450, capacityPerMonth: 150 },
        ],
      },
    },
  });

  // 6. Mitra Sidoarjo: Penggilingan Padi & Gabah Makmur Krian (~26.8 km)
  await prisma.business.create({
    data: {
      name: 'Penggilingan Padi & Gabah Makmur Krian',
      role: 'PENGGILINGAN',
      desa: 'Krian',
      district: 'Sidoarjo',
      address: 'Jl. Raya Krian KM 28, Sidoarjo',
      publicLat: -7.4120,
      publicLng: 112.5850,
      source: 'SELF',
      contactPhone: '081334455667',
      dedupeKey: 'penggilingan makmur krian|sidoarjo',
      catalogItems: {
        create: [
          { commodity: 'GABAH_GKP', unit: 'ton', priceMin: 7200, priceMax: 7500, stock: 45, capacityPerMonth: 60 },
          { commodity: 'BERAS_MEDIUM', unit: 'kg', priceMin: 13100, priceMax: 13600, stock: 3000, capacityPerMonth: 90 },
        ],
      },
    },
  });

  // Percakapan Awal antara Cak Rofi & Udin
  const pairKey = [cakrofi.id, udin.id].sort().join(':');
  await prisma.conversation.create({
    data: {
      pairKey,
      lastMessageAt: new Date(),
      members: {
        create: [{ userId: cakrofi.id }, { userId: udin.id }],
      },
      messages: {
        create: [
          {
            senderId: udin.id,
            clientMessageId: 'init-msg-1',
            body: 'Halo Cak Rofi, pasokan beras dan minyak goreng dari mitra Keputih sudah ready di gudang.',
          },
          {
            senderId: cakrofi.id,
            clientMessageId: 'init-msg-2',
            body: 'Siap Din, tolong periksa nota pengiriman dan pastikan tidak ada kemasan yang bocor atau rusak ya.',
          },
        ],
      },
    },
  });
}

async function main(): Promise<void> {
  console.log('Memulai Comprehensive Database Seeding Warung Madura...');
  await clearDatabase();

  console.log('1. Menanam 15 Master Produk multi-satuan & variasi stok...');
  await seedProducts();

  console.log('2. Menanam Staff, Supplier, Akun Pemilik & Staf...');
  const entities = await seedStaffAndSuppliers();

  console.log('3. Menanam Direktori Grosir Surabaya/Sidoarjo & Live WebSocket Chat...');
  await seedBusinessesAndChat();

  console.log('4. Menanam Purchase Orders (OPEN, PARTIAL, COMPLETE, CANCELLED) & Goods Receipts...');
  await seedPurchaseOrdersAndGoodsReceipts(entities);

  console.log('5. Menjalankan simulasi riwayat penjualan selama 7 hari...');
  // Hari ke-5 lalu: Penjualan 1
  await seedSale(daysAgo(5), [['MIE-001', 12], ['MNM-001', 8], ['MNM-003', 10]]);
  // Hari ke-4 lalu: Penyesuaian stok rusak & Penjualan 2
  await seedAdjustmentOut(daysAgo(4.5), 'MNM-001', 2, 'Barang rusak (kemasan bocor saat penataan rak)');
  await seedSale(daysAgo(4), [['SMB-001', 4], ['SMB-002', 5], ['MNM-002', 6]]);
  // Hari ke-3 lalu: Penjualan 3 & 4
  await seedSale(daysAgo(3.5), [['SMB-003', 2], ['SMB-005', 4], ['SNK-001', 3]]);
  await seedSale(daysAgo(3), [['MIE-001', 20], ['MIE-002', 15], ['MNM-003', 15]]);
  // Hari ke-2 lalu: Penjualan 5
  await seedSale(daysAgo(2), [['SMB-001', 6], ['SMB-002', 8], ['RT-001', 4]]);
  // Hari ke-1 lalu: Penjualan 6
  await seedSale(daysAgo(1), [['MIE-001', 25], ['MNM-001', 10], ['SMB-005', 4], ['RT-002', 6]]);
  // Hari ini: Penjualan 7 & 8
  await seedSale(daysAgo(0.2), [['SMB-003', 3], ['SMB-001', 4], ['MNM-002', 8]]);
  await seedSale(new Date(Date.now() - 25 * 60 * 1000), [['MIE-001', 8], ['MNM-001', 6], ['SNK-002', 5]]);

  console.log('6. Menyelaraskan stok akhir pada tabel Produk...');
  await syncProductStock();

  const [products, pos, grs, sales, movements, staff, suppliers, businesses] = await Promise.all([
    prisma.product.count(),
    prisma.purchaseOrder.count(),
    prisma.goodsReceipt.count(),
    prisma.sale.count(),
    prisma.stockMovement.count(),
    prisma.staff.count(),
    prisma.supplier.count(),
    prisma.business.count(),
  ]);

  console.log('================================================================');
  console.log('COMPREHENSIVE SEED SELESAI DENGAN SEMPURNA:');
  console.log(`- Produk Master    : ${products} komoditas (termasuk out-of-stock & multi-satuan)`);
  console.log(`- Purchase Orders  : ${pos} PO (Mencakup OPEN, PARTIAL, COMPLETE, CANCELLED)`);
  console.log(`- Goods Receipts   : ${grs} GR (Normal, PO Partial, Vendor Bonus, Barang Ditolak/Rusak, Direct GR)`);
  console.log(`- Riwayat Penjualan: ${sales} transaksi faktur (7 hari terakhir)`);
  console.log(`- Pergerakan Stok  : ${movements} mutasi stok tercatat lengkap (Audit trail 100% konsisten)`);
  console.log(`- Staff & Supplier : ${staff} staff, ${suppliers} supplier grosir`);
  console.log(`- Direktori Mitra  : ${businesses} mitra grosir (Surabaya & Sidoarjo)`);
  console.log('================================================================');
}

main()
  .catch((error: unknown) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
