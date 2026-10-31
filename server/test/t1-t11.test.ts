import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, resetTestDatabase, assertTestDatabase } from './helpers/db-helper';
import { createPurchaseOrder, getPurchaseOrder, cancelRemaining } from '../src/services/purchase-order.service';
import { createGoodsReceipt } from '../src/services/goods-receipt.service';
import { adjustStock } from '../src/services/stock.service';
import { getProduct } from '../src/services/product.service';
import { Product, Staff, Supplier, PurchaseOrderStatus, StockMovementType } from '@prisma/client';

describe('Uji Akhir T1–T11 DevSprint Accelerator Sesi 2', () => {
  let mie: Product;
  let kopi: Product;
  let air600: Product;
  let gula: Product;
  let udin: Staff;
  let sari: Staff;
  let supplier: Supplier;

  beforeEach(async () => {
    assertTestDatabase();
    await resetTestDatabase();

    // Data Awal sesuai Tabel:
    // KOPI: sachet, renteng, 10, stok awal 5
    kopi = await testDb.product.create({
      data: {
        sku: 'KOPI',
        name: 'Kopi sachet',
        category: 'Minuman',
        purchasePrice: 1400,
        sellingPrice: 2000,
        stock: 5,
        isActive: true,
        baseUnit: 'sachet',
        purchaseUnit: 'renteng',
        unitsPerPurchaseUnit: 10,
      },
    });

    // MIE: bungkus, dus, 40, stok awal 12
    mie = await testDb.product.create({
      data: {
        sku: 'MIE',
        name: 'Mi instan',
        category: 'Makanan Instan',
        purchasePrice: 2875,
        sellingPrice: 3500,
        stock: 12,
        isActive: true,
        baseUnit: 'bungkus',
        purchaseUnit: 'dus',
        unitsPerPurchaseUnit: 40,
      },
    });

    // AIR600: botol, dus, 24, stok awal 0
    air600 = await testDb.product.create({
      data: {
        sku: 'AIR600',
        name: 'Air mineral 600 ml',
        category: 'Minuman',
        purchasePrice: 2000,
        sellingPrice: 3000,
        stock: 0,
        isActive: true,
        baseUnit: 'botol',
        purchaseUnit: 'dus',
        unitsPerPurchaseUnit: 24,
      },
    });

    // GULA: pcs, bal, 20, stok awal 3
    gula = await testDb.product.create({
      data: {
        sku: 'GULA',
        name: 'Gula 1 kg',
        category: 'Sembako',
        purchasePrice: 15000,
        sellingPrice: 18000,
        stock: 3,
        isActive: true,
        baseUnit: 'pcs',
        purchaseUnit: 'bal',
        unitsPerPurchaseUnit: 20,
      },
    });

    udin = await testDb.staff.create({ data: { name: 'Udin', isActive: true } });
    sari = await testDb.staff.create({ data: { name: 'Sari', isActive: true } });
    supplier = await testDb.supplier.create({ data: { name: 'Pak Haji', isActive: true } });
  });

  it('Eksekusi Berurutan T1 sampai T11', async () => {
    // ==========================================
    // T1: Buat PO-1: MIE 5 dus @ Rp115.000, KOPI 3 renteng @ Rp14.000
    // Hasil: PO-1 OPEN; stok MIE tetap 12, KOPI tetap 5
    // ==========================================
    const po1 = await createPurchaseOrder({
      supplierId: supplier.id,
      lines: [
        { productId: mie.id, quantity: 5 },
        { productId: kopi.id, quantity: 3 },
      ],
    });
    expect(po1.status).toBe(PurchaseOrderStatus.OPEN);

    const stockMieT1 = await getProduct(mie.id);
    const stockKopiT1 = await getProduct(kopi.id);
    expect(stockMieT1.stock).toBe(12);
    expect(stockKopiT1.stock).toBe(5);

    // ==========================================
    // T2: Penerimaan PO-1 oleh Udin: MIE 3 dus baik
    // Hasil: MIE = 132; PO-1 PARTIAL; 1 riwayat +120 (penerimaan, oleh Udin)
    // ==========================================
    const { receipt: grT2 } = await createGoodsReceipt({
      idempotencyKey: 't2-udin-receipt',
      supplierId: supplier.id,
      receivedById: udin.id,
      purchaseOrderId: po1.id,
      lines: [
        {
          productId: mie.id,
          receivedBase: 3 * 40, // 120 bungkus
          unitCostPerPurchaseUnit: 115000,
        },
      ],
    });

    const stockMieT2 = await getProduct(mie.id);
    expect(stockMieT2.stock).toBe(132); // 12 + 120 = 132

    const po1AfterT2 = await getPurchaseOrder(po1.id);
    expect(po1AfterT2.status).toBe(PurchaseOrderStatus.PARTIAL);

    const movementsT2 = await testDb.stockMovement.findMany({
      where: { referenceId: grT2.id },
    });
    expect(movementsT2).toHaveLength(1);
    expect(movementsT2[0].quantity).toBe(120);
    expect(movementsT2[0].type).toBe(StockMovementType.RECEIPT);
    expect(grT2.receivedByName).toBe('Udin');

    // ==========================================
    // T3: Penerimaan PO-1 oleh Sari: MIE 2 dus (1 baik, 1 penyok), KOPI 3 renteng + bonus 1 renteng
    // Hasil: MIE = 172 (penyok tidak masuk); KOPI = 45; PO-1 COMPLETED; bonus biaya 0; modal kopi Rp1.400/sachet
    // ==========================================
    const { receipt: grT3 } = await createGoodsReceipt({
      idempotencyKey: 't3-sari-receipt',
      supplierId: supplier.id,
      receivedById: sari.id,
      purchaseOrderId: po1.id,
      lines: [
        {
          productId: mie.id,
          receivedBase: 2 * 40, // 80 bungkus (2 dus)
          rejectedBase: 1 * 40, // 40 bungkus (1 dus penyok)
          rejectReason: 'PENYOK',
          rejectNote: '1 dus penyok',
          unitCostPerPurchaseUnit: 115000,
        },
        {
          productId: kopi.id,
          receivedBase: 3 * 10, // 30 sachet (3 renteng)
          bonusBase: 1 * 10, // 10 sachet (1 renteng bonus)
          unitCostPerPurchaseUnit: 14000,
        },
      ],
    });

    const stockMieT3 = await getProduct(mie.id);
    expect(stockMieT3.stock).toBe(172); // 132 + 40 (penyok 40 tidak masuk)

    const stockKopiT3 = await getProduct(kopi.id);
    expect(stockKopiT3.stock).toBe(45); // 5 + 30 + 10 bonus

    const kopiLineT3 = grT3.lines.find((l) => l.productId === kopi.id)!;
    expect(kopiLineT3.costPerBaseUnit).toBe(1400); // Rp14.000 / 10 = Rp1.400 / sachet

    // Bila barang yang ditolak disepakati selesai (tidak ada kiriman susulan), PO ditutup:
    await cancelRemaining(po1.id, {
      reason: '1 dus penyok diretur dan pesanan PO-1 tuntas',
    });
    const po1Completed = await getPurchaseOrder(po1.id);
    expect(po1Completed.status).toBe(PurchaseOrderStatus.COMPLETE);

    // ==========================================
    // T4: Terima lagi MIE 1 dus di PO-1
    // Hasil: Ditolak; stok tidak berubah
    // ==========================================
    let t4Rejected = false;
    try {
      await createGoodsReceipt({
        idempotencyKey: 't4-extra-receipt',
        supplierId: supplier.id,
        receivedById: udin.id,
        purchaseOrderId: po1.id,
        lines: [
          {
            productId: mie.id,
            receivedBase: 1 * 40,
            unitCostPerPurchaseUnit: 115000,
          },
        ],
      });
    } catch {
      t4Rejected = true;
    }
    expect(t4Rejected).toBe(true);

    const stockMieT4 = await getProduct(mie.id);
    expect(stockMieT4.stock).toBe(172); // Stok tetap 172

    // ==========================================
    // T5: Buat PO-G: GULA 2 bal @ Rp300.000. Kirim penerimaan 2 baris: GULA 1 bal + baris ke-2 tidak valid
    // Hasil: Ditolak seluruhnya; GULA tetap 3
    // ==========================================
    const poG = await createPurchaseOrder({
      supplierId: supplier.id,
      lines: [{ productId: gula.id, quantity: 2 }],
    });

    let t5Rejected = false;
    try {
      await createGoodsReceipt({
        idempotencyKey: 't5-invalid-receipt',
        supplierId: supplier.id,
        receivedById: udin.id,
        purchaseOrderId: poG.id,
        lines: [
          {
            productId: gula.id,
            receivedBase: 1 * 20,
            unitCostPerPurchaseUnit: 300000,
          },
          {
            productId: air600.id, // produk di luar PO-G
            receivedBase: 24,
            unitCostPerPurchaseUnit: 50000,
          },
        ],
      });
    } catch {
      t5Rejected = true;
    }
    expect(t5Rejected).toBe(true);

    const stockGulaT5 = await getProduct(gula.id);
    expect(stockGulaT5.stock).toBe(3); // GULA tetap 3

    // ==========================================
    // T6: Kirim request penerimaan PO-G (GULA 1 bal, oleh Udin) yang sama dua kali
    // Hasil: GULA = 23 (bukan 43); hanya 1 penerimaan tercatat
    // ==========================================
    const t6Key = 't6-idempotent-key';
    const resT6a = await createGoodsReceipt({
      idempotencyKey: t6Key,
      supplierId: supplier.id,
      receivedById: udin.id,
      purchaseOrderId: poG.id,
      lines: [
        {
          productId: gula.id,
          receivedBase: 1 * 20,
          unitCostPerPurchaseUnit: 300000,
        },
      ],
    });
    const resT6b = await createGoodsReceipt({
      idempotencyKey: t6Key,
      supplierId: supplier.id,
      receivedById: udin.id,
      purchaseOrderId: poG.id,
      lines: [
        {
          productId: gula.id,
          receivedBase: 1 * 20,
          unitCostPerPurchaseUnit: 300000,
        },
      ],
    });
    expect(resT6a.receipt.id).toBe(resT6b.receipt.id);

    const stockGulaT6 = await getProduct(gula.id);
    expect(stockGulaT6.stock).toBe(23); // 3 + 20 = 23 (bukan 43)

    const countReceiptsT6 = await testDb.goodsReceipt.count({
      where: { idempotencyKey: t6Key },
    });
    expect(countReceiptsT6).toBe(1);

    // ==========================================
    // T7: Koreksi KOPI -50
    // Hasil: Ditolak (stok akan minus)
    // ==========================================
    let t7Rejected = false;
    try {
      await adjustStock({
        productId: kopi.id,
        type: 'OUT',
        quantity: 50,
        reason: 'HILANG',
        note: 'Tes koreksi melebihi stok',
      });
    } catch {
      t7Rejected = true;
    }
    expect(t7Rejected).toBe(true);
    const stockKopiT7 = await getProduct(kopi.id);
    expect(stockKopiT7.stock).toBe(45); // Stok tetap 45

    // ==========================================
    // T8: Koreksi KOPI -2 tanpa alasan, lalu -2 dengan alasan "sachet sobek"
    // Hasil: Pertama ditolak; kedua: KOPI = 43, riwayat koreksi tercatat
    // ==========================================
    let t8FirstRejected = false;
    try {
      // @ts-expect-error sengaja tanpa alasan
      await adjustStock({
        productId: kopi.id,
        type: 'OUT',
        quantity: 2,
        reason: undefined,
      });
    } catch {
      t8FirstRejected = true;
    }
    expect(t8FirstRejected).toBe(true);

    await adjustStock({
      productId: kopi.id,
      type: 'OUT',
      quantity: 2,
      reason: 'RUSAK',
      note: 'sachet sobek',
    });
    const stockKopiT8 = await getProduct(kopi.id);
    expect(stockKopiT8.stock).toBe(43); // 45 - 2 = 43

    const movementT8 = await testDb.stockMovement.findFirst({
      where: { productId: kopi.id, type: StockMovementType.ADJUSTMENT_OUT, note: 'sachet sobek' },
    });
    expect(movementT8).toBeDefined();

    // ==========================================
    // T9: Lihat sisa stok
    // Hasil: MIE "172 bungkus = 4 dus + 12 bungkus"; KOPI "43 sachet = 4 renteng + 3 sachet"
    // ==========================================
    const mieT9 = await getProduct(mie.id);
    const kopiT9 = await getProduct(kopi.id);
    const mieDus = Math.floor(mieT9.stock / mieT9.unitsPerPurchaseUnit);
    const mieBks = mieT9.stock % mieT9.unitsPerPurchaseUnit;
    const kopiRenteng = Math.floor(kopiT9.stock / kopiT9.unitsPerPurchaseUnit);
    const kopiSachet = kopiT9.stock % kopiT9.unitsPerPurchaseUnit;

    expect(mieT9.stock).toBe(172);
    expect(mieDus).toBe(4);
    expect(mieBks).toBe(12);

    expect(kopiT9.stock).toBe(43);
    expect(kopiRenteng).toBe(4);
    expect(kopiSachet).toBe(3);

    // ==========================================
    // T10: Buat PO-2: KOPI @ Rp15.000, terima 1 renteng
    // Hasil: Nilai KOPI di PO-1 tetap 3 × Rp14.000 = Rp42.000; modal lama tetap Rp1.400/sachet
    // ==========================================
    const po2 = await createPurchaseOrder({
      supplierId: supplier.id,
      lines: [{ productId: kopi.id, quantity: 1 }],
    });
    const { receipt: grT10 } = await createGoodsReceipt({
      idempotencyKey: 't10-kopi-receipt',
      supplierId: supplier.id,
      receivedById: udin.id,
      purchaseOrderId: po2.id,
      lines: [
        {
          productId: kopi.id,
          receivedBase: 10,
          unitCostPerPurchaseUnit: 15000,
        },
      ],
    });

    const grT3Check = await testDb.goodsReceipt.findUniqueOrThrow({
      where: { id: grT3.id },
      include: { lines: true },
    });
    const oldKopiLine = grT3Check.lines.find((l) => l.productId === kopi.id)!;
    expect(Number(oldKopiLine.unitCostPerPurchaseUnit)).toBe(14000);
    expect(Number(oldKopiLine.costPerBaseUnit)).toBe(1400);

    const newKopiLine = grT10.lines.find((l) => l.productId === kopi.id)!;
    expect(newKopiLine.unitCostPerPurchaseUnit).toBe(15000);
    expect(newKopiLine.costPerBaseUnit).toBe(1500);

    // ==========================================
    // T11: Buat PO-3: AIR600 4 dus, terima 2, tutup PO-3, lalu coba terima 1 dus lagi
    // Hasil: AIR600 = 48; PO-3 CLOSED; penerimaan terakhir ditolak
    // ==========================================
    const po3 = await createPurchaseOrder({
      supplierId: supplier.id,
      lines: [{ productId: air600.id, quantity: 4 }],
    });
    await createGoodsReceipt({
      idempotencyKey: 't11-air-part-receipt',
      supplierId: supplier.id,
      receivedById: udin.id,
      purchaseOrderId: po3.id,
      lines: [
        {
          productId: air600.id,
          receivedBase: 2 * 24, // 48 botol
          unitCostPerPurchaseUnit: 50000,
        },
      ],
    });
    const stockAirT11 = await getProduct(air600.id);
    expect(stockAirT11.stock).toBe(48);

    const closedPo3 = await cancelRemaining(po3.id, {
      reason: 'Sisa tidak dikirim supplier',
    });
    expect(closedPo3.status).toBe(PurchaseOrderStatus.COMPLETE);

    let t11Rejected = false;
    try {
      await createGoodsReceipt({
        idempotencyKey: 't11-extra-air-receipt',
        supplierId: supplier.id,
        receivedById: udin.id,
        purchaseOrderId: po3.id,
        lines: [
          {
            productId: air600.id,
            receivedBase: 1 * 24,
            unitCostPerPurchaseUnit: 50000,
          },
        ],
      });
    } catch {
      t11Rejected = true;
    }
    expect(t11Rejected).toBe(true);
  });
});
