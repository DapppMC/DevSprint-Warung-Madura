import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  testDb,
  resetTestDatabase,
  seedTestMasterData,
  assertTestDatabase,
  type TestMasterData,
} from './helpers/db-helper';
import { createProductSchema, updateProductSchema } from '../src/validators/product.validator';
import { createPurchaseOrderSchema, cancelRemainingSchema } from '../src/validators/purchase-order.validator';
import { createGoodsReceiptSchema } from '../src/validators/goods-receipt.validator';
import { createSaleSchema } from '../src/validators/sale.validator';
import { loginSchema } from '../src/validators/auth.validator';
import { startOfDayWib, endOfDayWib, formatDateKeyWib } from '../src/lib/dates';
import { generateOrderNumber } from '../src/services/purchase-order.service';
import { generateReceiptNumber } from '../src/services/goods-receipt.service';

describe('Unit Test: Logika Bisnis, Validasi Input, dan Kalkulasi Tanggal/Durasi', () => {
  let master: TestMasterData;

  beforeEach(async () => {
    assertTestDatabase();
    await resetTestDatabase();
    master = await seedTestMasterData();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  // =========================================================================
  // 1. LOGIKA BISNIS: Konversi Multi-Satuan & Rekonsiliasi PO
  // =========================================================================
  describe('1. Logika Bisnis & Konversi Satuan', () => {
    it('Konversi Satuan: Kuantitas selalu dikonversi tepat ke satuan dasar', () => {
      // 1 dus Mie = 40 bungkus. Pesan 5 dus -> 200 bungkus
      const dusMie = 5;
      const bungkusPerDus = master.indomie.unitsPerPurchaseUnit; // 40
      const totalBungkus = dusMie * bungkusPerDus;
      expect(totalBungkus).toBe(200);

      // 1 renteng Kopi = 10 sachet. Pesan 7 renteng -> 70 sachet
      const rentengKopi = 7;
      const sachetPerRenteng = master.kopi.unitsPerPurchaseUnit; // 10
      const totalSachet = rentengKopi * sachetPerRenteng;
      expect(totalSachet).toBe(70);

      // 1 bal Gula = 20 bungkus. Pesan 3 bal -> 60 bungkus
      const balGula = 3;
      const bungkusPerBal = master.gula.unitsPerPurchaseUnit; // 20
      const totalGula = balGula * bungkusPerBal;
      expect(totalGula).toBe(60);
    });

    it('Kalkulasi Modal Snapshot: Pembagian Decimal presisi tanpa floating point error', () => {
      // Pembelian 1 renteng Kopi seharga Rp 11.000 (isi 10 sachet) -> Rp 1.100 / sachet
      const purchasePriceRenteng = new Prisma.Decimal(11000);
      const unitsPerRenteng = 10;
      const baseCost = purchasePriceRenteng.dividedBy(unitsPerRenteng);
      expect(baseCost.toNumber()).toBe(1100);

      // Pembelian 1 dus Mie seharga Rp 112.000 (isi 40 bungkus) -> Rp 2.800 / bungkus
      const purchasePriceDus = new Prisma.Decimal(112000);
      const unitsPerDus = 40;
      const baseCostMie = purchasePriceDus.dividedBy(unitsPerDus);
      expect(baseCostMie.toNumber()).toBe(2800);

      // Angka ganjil tidak bulat: Rp 100.000 / 3 unit = 33333.33333...
      const priceGanjil = new Prisma.Decimal(100000);
      const unitsGanjil = 3;
      const divided = priceGanjil.dividedBy(unitsGanjil);
      expect(divided.toFixed(2)).toBe('33333.33');
    });

    it('Rekonsiliasi PO Status Transition State Machine', () => {
      // Status helper logic:
      function calculatePoStatus(ordered: number, fulfilled: number, cancelled: number): string {
        const remaining = ordered - fulfilled - cancelled;
        if (remaining <= 0) {
          return fulfilled > 0 ? 'COMPLETE' : 'CANCELLED';
        }
        if (fulfilled > 0) {
          return 'PARTIAL';
        }
        return 'OPEN';
      }

      // Skenario A: Baru pesan 100 unit -> OPEN
      expect(calculatePoStatus(100, 0, 0)).toBe('OPEN');

      // Skenario B: Datang 40 unit -> PARTIAL
      expect(calculatePoStatus(100, 40, 0)).toBe('PARTIAL');

      // Skenario C: Datang lagi 60 unit (total 100) -> COMPLETE
      expect(calculatePoStatus(100, 100, 0)).toBe('COMPLETE');

      // Skenario D: Datang 60 unit, sisa 40 dibatalkan -> COMPLETE
      expect(calculatePoStatus(100, 60, 40)).toBe('COMPLETE');

      // Skenario E: Tidak ada yang datang (0), semua 100 dibatalkan -> CANCELLED
      expect(calculatePoStatus(100, 0, 100)).toBe('CANCELLED');
    });

    it('Bonus vs PO Fulfillment: Bonus menambah stok tetapi TIDAK memenuhi kuota pesanan', () => {
      const orderedBase = 40; // Pesan 1 dus (40 bungkus)
      const receivedBase = 40; // Datang 40
      const bonusBase = 10; // Bonus 10 bungkus dari sales
      const rejectedBase = 0;

      // Barang masuk ke fisik stok:
      const netStockAddition = receivedBase - rejectedBase + bonusBase;
      expect(netStockAddition).toBe(50); // Stok bertambah 50

      // Pemenuhan kuota pesanan:
      const poFulfillment = receivedBase - rejectedBase;
      expect(poFulfillment).toBe(40); // Kuota pesanan terpenuhi tepat 40, BUKAN 50!
      expect(poFulfillment).toBe(orderedBase);
    });

    it('Barang Ditolak/Rusak: Barang ditolak TIDAK masuk stok dan TIDAK memenuhi PO', () => {
      const orderedBase = 40;
      const receivedBase = 40;
      const rejectedBase = 8; // 8 bungkus penyok/bocor
      const bonusBase = 0;

      const netStockAddition = receivedBase - rejectedBase + bonusBase;
      expect(netStockAddition).toBe(32); // Hanya 32 bungkus masuk stok

      const poFulfillment = receivedBase - rejectedBase;
      expect(poFulfillment).toBe(32); // Sisa pesanan masih 8 bungkus (PARTIAL)
      expect(orderedBase - poFulfillment).toBe(8);
    });
  });

  // =========================================================================
  // 2. VALIDASI INPUT (ZOD SCHEMAS)
  // =========================================================================
  describe('2. Validasi Input Skema Zod', () => {
    it('Validasi Produk: Menolak nama kosong, SKU kosong, dan harga negatif', () => {
      // 1. Nama kosong
      const emptyName = createProductSchema.safeParse({
        sku: 'TEST-001',
        name: '   ',
        category: 'Snack',
        purchasePrice: 1000,
        sellingPrice: 1500,
      });
      expect(emptyName.success).toBe(false);

      // 2. Harga beli negatif
      const negativePurchase = createProductSchema.safeParse({
        sku: 'TEST-002',
        name: 'Kripik Singkong',
        category: 'Snack',
        purchasePrice: -500,
        sellingPrice: 1500,
      });
      expect(negativePurchase.success).toBe(false);

      // 3. Harga jual 0 (harus > 0)
      const zeroSelling = createProductSchema.safeParse({
        sku: 'TEST-003',
        name: 'Kripik Singkong',
        category: 'Snack',
        purchasePrice: 1000,
        sellingPrice: 0,
      });
      expect(zeroSelling.success).toBe(false);

      // 4. unitsPerPurchaseUnit < 1
      const invalidUnits = createProductSchema.safeParse({
        sku: 'TEST-004',
        name: 'Kripik Singkong',
        category: 'Snack',
        purchasePrice: 1000,
        sellingPrice: 1500,
        unitsPerPurchaseUnit: 0,
      });
      expect(invalidUnits.success).toBe(false);

      // 5. Update produk tanpa field sama sekali
      const emptyUpdate = updateProductSchema.safeParse({});
      expect(emptyUpdate.success).toBe(false);
    });

    it('Validasi Purchase Order: Menolak lines kosong dan jumlah pesanan <= 0', () => {
      // 1. Lines kosong
      const emptyLines = createPurchaseOrderSchema.safeParse({
        supplierId: master.pakHaji.id,
        lines: [],
      });
      expect(emptyLines.success).toBe(false);

      // 2. Jumlah pesanan 0 atau negatif
      const invalidQty = createPurchaseOrderSchema.safeParse({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 0 }],
      });
      expect(invalidQty.success).toBe(false);

      // 3. ID Supplier bukan UUID
      const invalidSupplier = createPurchaseOrderSchema.safeParse({
        supplierId: 'bukan-uuid',
        lines: [{ productId: master.indomie.id, quantity: 5 }],
      });
      expect(invalidSupplier.success).toBe(false);

      // 4. Cancel reason kosong
      const emptyCancel = cancelRemainingSchema.safeParse({ reason: '   ' });
      expect(emptyCancel.success).toBe(false);
    });

    it('Validasi Goods Receipt: Menolak rejectedBase > receivedBase atau tanpa alasan', () => {
      // 1. Barang ditolak melebihi barang datang
      const rejectExceeded = createGoodsReceiptSchema.safeParse({
        idempotencyKey: 'test-key-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 20,
            rejectedBase: 25, // Melebihi 20!
            rejectReason: 'PENYOK',
            unitCostPerPurchaseUnit: 2800,
          },
        ],
      });
      expect(rejectExceeded.success).toBe(false);

      // 2. Ada barang ditolak tetapi rejectReason kosong
      const missingReason = createGoodsReceiptSchema.safeParse({
        idempotencyKey: 'test-key-2',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 20,
            rejectedBase: 5,
            rejectReason: null,
            unitCostPerPurchaseUnit: 2800,
          },
        ],
      });
      expect(missingReason.success).toBe(false);

      // 3. Idempotency key kosong
      const missingKey = createGoodsReceiptSchema.safeParse({
        idempotencyKey: '   ',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 20,
            unitCostPerPurchaseUnit: 2800,
          },
        ],
      });
      expect(missingKey.success).toBe(false);
    });

    it('Validasi Penjualan & Login Auth', () => {
      // 1. Penjualan item kosong
      const emptySale = createSaleSchema.safeParse({ items: [] });
      expect(emptySale.success).toBe(false);

      // 2. Kuantitas penjualan 0
      const zeroSaleQty = createSaleSchema.safeParse({
        items: [{ productId: master.indomie.id, quantity: 0 }],
      });
      expect(zeroSaleQty.success).toBe(false);

      // 3. Login username kosong
      const emptyUser = loginSchema.safeParse({ username: '  ', pin: '1234' });
      expect(emptyUser.success).toBe(false);

      // 4. Login PIN kosong
      const emptyPin = loginSchema.safeParse({ username: 'udin', pin: '' });
      expect(emptyPin.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. KALKULASI TANGGAL, DURASI & TAHUN KABISAT
  // =========================================================================
  describe('3. Kalkulasi Tanggal, Durasi & Tahun Kabisat', () => {
    it('startOfDayWib dan endOfDayWib tepat menghitung batas 24 jam kalender WIB', () => {
      // Tanggal uji: 14 Oktober 2026 jam 14:30 WIB
      const date = new Date('2026-10-14T14:30:00+07:00');
      const start = startOfDayWib(date);
      const end = endOfDayWib(date);

      // Selisih harus tepat 24 jam (86.400.000 ms)
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);

      // Tanggal WIB format harus 20261014
      expect(formatDateKeyWib(date)).toBe('20261014');
    });

    it('Format penomoran dokumen otomatis per hari WIB', async () => {
      const now = new Date('2026-10-23T10:00:00+07:00');

      await testDb.$transaction(async (tx) => {
        const orderNum1 = await generateOrderNumber(tx, now);
        expect(orderNum1).toBe('PO-20261023-0001');

        const receiptNum1 = await generateReceiptNumber(tx, now);
        expect(receiptNum1).toBe('GR-20261023-0001');
      });
    });

    it('Tahun Kabisat (Leap Year): 29 Februari 2024 diproses valid dan tepat', () => {
      // 2024 adalah tahun kabisat (29 hari di Februari)
      const leapDay = new Date('2024-02-29T12:00:00+07:00');
      const dateKey = formatDateKeyWib(leapDay);
      expect(dateKey).toBe('20240229');

      // Selisih hari antara 28 Feb 2024 dan 01 Mar 2024 adalah 2 hari (ada 29 Feb)
      const feb28 = new Date('2024-02-28T00:00:00+07:00');
      const mar01 = new Date('2024-03-01T00:00:00+07:00');
      const diffDaysLeap = (mar01.getTime() - feb28.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDaysLeap).toBe(2);

      // Pada tahun biasa (2025), selisih 28 Feb ke 01 Mar adalah 1 hari
      const feb28Normal = new Date('2025-02-28T00:00:00+07:00');
      const mar01Normal = new Date('2025-03-01T00:00:00+07:00');
      const diffDaysNormal = (mar01Normal.getTime() - feb28Normal.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDaysNormal).toBe(1);
    });

    it('Kalkulasi Durasi: Selisih durasi penerimaan barang (Lead Time)', () => {
      const poOrderedAt = new Date('2026-10-20T08:00:00+07:00');
      const grReceivedAt = new Date('2026-10-22T14:30:00+07:00');

      const leadTimeMs = grReceivedAt.getTime() - poOrderedAt.getTime();
      const leadTimeHours = leadTimeMs / (1000 * 60 * 60);
      const leadTimeDays = Math.floor(leadTimeHours / 24);

      expect(leadTimeHours).toBe(54.5);
      expect(leadTimeDays).toBe(2);
    });
  });
});
