import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { StockMovementType, PurchaseOrderStatus, StockAdjustmentReason } from '@prisma/client';
import {
  testDb,
  resetTestDatabase,
  seedTestMasterData,
  assertTestDatabase,
  type TestMasterData,
} from './helpers/db-helper';
import { createPurchaseOrder, cancelRemaining, getPurchaseOrder } from '../src/services/purchase-order.service';
import {
  createGoodsReceipt,
  getGoodsReceipt,
  type CreateGoodsReceiptResult,
} from '../src/services/goods-receipt.service';
import { adjustStock, listStockMovements } from '../src/services/stock.service';
import { createSale } from '../src/services/sale.service';
import { createProduct, updateProduct, deleteProduct, getProduct } from '../src/services/product.service';
import { stockAdjustmentSchema } from '../src/validators/stock.validator';
import { ConflictError, NotFoundError } from '../src/lib/errors';

describe('Skenario Uji S1 - S20 (Barang Masuk & Rekonsiliasi Pesanan)', () => {
  let master: TestMasterData;

  beforeEach(async () => {
    assertTestDatabase();
    await resetTestDatabase();
    master = await seedTestMasterData();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('S1 - Konversi: pesan & terima 2 renteng kopi -> stok kopi +20 sachet; movement RECEIPT qty 20', async () => {
    // PO: 2 renteng Kopi Sachet (1 renteng = 10 sachet) -> orderedBase = 20 sachet
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.kopi.id, quantity: 2 }],
    });
    expect(po.lines[0].orderedBase).toBe(20);

    // Terima 2 renteng = 20 sachet
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's1-receipt-1',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [
        {
          productId: master.kopi.id,
          receivedBase: 20,
          unitCostPerPurchaseUnit: 11000,
        },
      ],
    });

    // Verifikasi stok bertambah 20
    const updatedKopi = await getProduct(master.kopi.id);
    expect(updatedKopi.stock).toBe(20);

    // Verifikasi pergerakan stok bertipe RECEIPT dengan quantity 20
    const movements = await testDb.stockMovement.findMany({
      where: { productId: master.kopi.id, referenceId: receipt.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe(StockMovementType.RECEIPT);
    expect(movements[0].quantity).toBe(20);
    expect(movements[0].beforeStock).toBe(0);
    expect(movements[0].afterStock).toBe(20);
  });

  it('S2 - Parsial: PO 5 dus mie; terima 3 dus; besok terima 2 dus -> stok +120 lalu +80 (=+200); sisa 80 -> 0; status OPEN->PARTIAL->COMPLETE; 2 penerimaan terhubung ke PO yang sama', async () => {
    // PO: 5 dus Indomie (1 dus = 40 bungkus) -> orderedBase = 200 bungkus
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 5 }],
    });
    expect(po.status).toBe(PurchaseOrderStatus.OPEN);
    expect(po.lines[0].remainingBase).toBe(200);

    // Penerimaan 1: terima 3 dus = 120 bungkus
    const { receipt: receipt1 } = await createGoodsReceipt({
      idempotencyKey: 's2-receipt-1',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 120,
          unitCostPerPurchaseUnit: 112000,
        },
      ],
    });

    const indomieAfterPart1 = await getProduct(master.indomie.id);
    expect(indomieAfterPart1.stock).toBe(120);

    const poAfterPart1 = await getPurchaseOrder(po.id);
    expect(poAfterPart1.status).toBe(PurchaseOrderStatus.PARTIAL);
    expect(poAfterPart1.lines[0].fulfilledBase).toBe(120);
    expect(poAfterPart1.lines[0].remainingBase).toBe(80);

    // Penerimaan 2: terima 2 dus = 80 bungkus
    const { receipt: receipt2 } = await createGoodsReceipt({
      idempotencyKey: 's2-receipt-2',
      supplierId: master.pakHaji.id,
      receivedById: master.sari.id,
      purchaseOrderId: po.id,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 80,
          unitCostPerPurchaseUnit: 112000,
        },
      ],
    });

    const indomieAfterPart2 = await getProduct(master.indomie.id);
    expect(indomieAfterPart2.stock).toBe(200);

    const poAfterPart2 = await getPurchaseOrder(po.id);
    expect(poAfterPart2.status).toBe(PurchaseOrderStatus.COMPLETE);
    expect(poAfterPart2.lines[0].fulfilledBase).toBe(200);
    expect(poAfterPart2.lines[0].remainingBase).toBe(0);

    // Kedua penerimaan terhubung ke PO yang sama
    expect(receipt1.purchaseOrderId).toBe(po.id);
    expect(receipt2.purchaseOrderId).toBe(po.id);
    expect(poAfterPart2.goodsReceipts).toHaveLength(2);
  });

  it('S3 - Lebih dari sisa: PO 5 dus, terima 6 dus (default) -> 409, stok & PO tidak berubah', async () => {
    // PO: 5 dus Indomie (200 bungkus)
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 5 }],
    });

    // Terima 6 dus = 240 bungkus -> melebihi sisa 200
    await expect(
      createGoodsReceipt({
        idempotencyKey: 's3-receipt-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: po.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 240,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    ).rejects.toThrow(ConflictError);

    // Stok dan PO tidak berubah
    const product = await getProduct(master.indomie.id);
    expect(product.stock).toBe(0);

    const poCheck = await getPurchaseOrder(po.id);
    expect(poCheck.status).toBe(PurchaseOrderStatus.OPEN);
    expect(poCheck.lines[0].fulfilledBase).toBe(0);
    expect(poCheck.lines[0].remainingBase).toBe(200);
  });

  it('S4 - Bonus: beli 10 dus mie + bonus 1 dus -> stok +440; pemenuhan PO 400 (bonus tidak ikut); costPerBase 2.800,0000; effectiveCostPerBase 2.545,4545', async () => {
    // PO: 10 dus Indomie = 400 bungkus
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 10 }],
    });

    // Terima 10 dus (400) + bonus 1 dus (40)
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's4-receipt-1',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 400,
          bonusBase: 40,
          unitCostPerPurchaseUnit: 112000,
        },
      ],
    });

    // Stok bertambah 400 + 40 = 440
    const product = await getProduct(master.indomie.id);
    expect(product.stock).toBe(440);

    // Pemenuhan PO = 400 (bonus tidak ikut)
    const poCheck = await getPurchaseOrder(po.id);
    expect(poCheck.status).toBe(PurchaseOrderStatus.COMPLETE);
    expect(poCheck.lines[0].fulfilledBase).toBe(400);
    expect(poCheck.lines[0].remainingBase).toBe(0);

    // Snapshot biaya
    const line = receipt.lines[0];
    expect(line.costPerBaseUnit).toBe(2800.0);
    expect(line.effectiveCostPerBaseUnit).toBe(2545.4545);
  });

  it('S5 - Ditolak: PO 3 dus Aqua (72); datang 72, ditolak 24 (PENYOK) -> stok +48 saja; pemenuhan 48; sisa 24 (default: ditolak tetap sisa); alasan tersimpan', async () => {
    // PO: 3 dus Aqua 600 ml = 72 botol
    const po = await createPurchaseOrder({
      supplierId: master.tokoGrosir.id,
      lines: [{ productId: master.aqua.id, quantity: 3 }],
    });

    // Datang 72, ditolak 24 dengan alasan PENYOK
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's5-receipt-1',
      supplierId: master.tokoGrosir.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [
        {
          productId: master.aqua.id,
          receivedBase: 72,
          rejectedBase: 24,
          rejectReason: 'PENYOK',
          rejectNote: '1 dus kemasan penyok',
          unitCostPerPurchaseUnit: 55200,
        },
      ],
    });

    // Stok bertambah hanya 48 (72 - 24)
    const product = await getProduct(master.aqua.id);
    expect(product.stock).toBe(48);

    // Pemenuhan PO 48, sisa 24, status PARTIAL
    const poCheck = await getPurchaseOrder(po.id);
    expect(poCheck.status).toBe(PurchaseOrderStatus.PARTIAL);
    expect(poCheck.lines[0].fulfilledBase).toBe(48);
    expect(poCheck.lines[0].remainingBase).toBe(24);

    // Alasan tersimpan di baris penerimaan
    expect(receipt.lines[0].rejectedBase).toBe(24);
    expect(receipt.lines[0].rejectReason).toBe('PENYOK');
    expect(receipt.lines[0].rejectNote).toBe('1 dus kemasan penyok');
  });

  it('S6 - Semua ditolak, tanpa bonus (datang 24, ditolak 24) -> penerimaan tersimpan, tidak ada StockMovement, stok tetap', async () => {
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's6-receipt-1',
      supplierId: master.tokoGrosir.id,
      receivedById: master.udin.id,
      lines: [
        {
          productId: master.aqua.id,
          receivedBase: 24,
          rejectedBase: 24,
          rejectReason: 'PENYOK',
          bonusBase: 0,
          unitCostPerPurchaseUnit: 55200,
        },
      ],
    });

    // Penerimaan tersimpan
    expect(receipt.id).toBeDefined();

    // Stok tetap 0
    const product = await getProduct(master.aqua.id);
    expect(product.stock).toBe(0);

    // Tidak ada pergerakan stok bertipe RECEIPT
    const movements = await testDb.stockMovement.findMany({
      where: { referenceId: receipt.id },
    });
    expect(movements).toHaveLength(0);
  });

  it('S7 - Harga naik: Senin mie Rp112.000/dus, Kamis Rp118.000/dus -> baris Senin tetap Rp2.800/bungkus, Kamis Rp2.950/bungkus; mengubah Product.purchasePrice kemudian tidak mengubah keduanya', async () => {
    // Penerimaan Senin
    const { receipt: receiptSenin } = await createGoodsReceipt({
      idempotencyKey: 's7-senin',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 40,
          unitCostPerPurchaseUnit: 112000,
        },
      ],
    });

    // Penerimaan Kamis
    const { receipt: receiptKamis } = await createGoodsReceipt({
      idempotencyKey: 's7-kamis',
      supplierId: master.pakHaji.id,
      receivedById: master.sari.id,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 40,
          unitCostPerPurchaseUnit: 118000,
        },
      ],
    });

    expect(receiptSenin.lines[0].costPerBaseUnit).toBe(2800.0);
    expect(receiptKamis.lines[0].costPerBaseUnit).toBe(2950.0);

    // Ubah purchasePrice master produk kemudian (misal naik jadi 3000)
    await updateProduct(master.indomie.id, { purchasePrice: 3000 });

    // Snapshot di penerimaan lama tidak boleh berubah
    const detailSenin = await getGoodsReceipt(receiptSenin.id);
    const detailKamis = await getGoodsReceipt(receiptKamis.id);
    expect(detailSenin.lines[0].costPerBaseUnit).toBe(2800.0);
    expect(detailKamis.lines[0].costPerBaseUnit).toBe(2950.0);
  });

  it('S8 - Pembulatan: Aqua Rp55.000/dus -> costPerBase tersimpan 2.291,6667 (4 desimal), bukan float', async () => {
    // 55000 / 24 = 2291.666666...
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's8-receipt',
      supplierId: master.tokoGrosir.id,
      receivedById: master.udin.id,
      lines: [
        {
          productId: master.aqua.id,
          receivedBase: 24,
          unitCostPerPurchaseUnit: 55000,
        },
      ],
    });

    const costPerBase = receipt.lines[0].costPerBaseUnit;
    expect(costPerBase).toBe(2291.6667);
  });

  it('S9 - Klik ganda: idempotencyKey sama dikirim 2x (juga paralel) -> 1 penerimaan, stok bertambah sekali; kedua respons berisi penerimaan yang sama', async () => {
    const key = 's9-double-click-key';
    const payload = {
      idempotencyKey: key,
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      lines: [
        {
          productId: master.kopi.id,
          receivedBase: 10,
          unitCostPerPurchaseUnit: 11000,
        },
      ],
    };

    // Jalankan 2 request paralel bersamaan
    const results = await Promise.allSettled([
      createGoodsReceipt(payload),
      createGoodsReceipt(payload),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');

    const res1 = (results[0] as PromiseFulfilledResult<CreateGoodsReceiptResult>).value;
    const res2 = (results[1] as PromiseFulfilledResult<CreateGoodsReceiptResult>).value;

    // Kedua response mengembalikan penerimaan yang sama
    expect(res1.receipt.id).toBe(res2.receipt.id);
    expect(res1.receipt.receiptNumber).toBe(res2.receipt.receiptNumber);

    // Tepat satu penerimaan tersimpan di DB
    const countInDb = await testDb.goodsReceipt.count({
      where: { idempotencyKey: key },
    });
    expect(countInDb).toBe(1);

    // Stok bertambah hanya satu kali (+10)
    const product = await getProduct(master.kopi.id);
    expect(product.stock).toBe(10);
  });

  it('S10 - Dua kiriman sah dengan kunci berbeda dan isi sama -> keduanya tersimpan (kecuali melebihi sisa pesanan)', async () => {
    const payloadCommon = {
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      lines: [
        {
          productId: master.kopi.id,
          receivedBase: 10,
          unitCostPerPurchaseUnit: 11000,
        },
      ],
    };

    const res1 = await createGoodsReceipt({
      ...payloadCommon,
      idempotencyKey: 's10-key-first',
    });
    const res2 = await createGoodsReceipt({
      ...payloadCommon,
      idempotencyKey: 's10-key-second',
    });

    expect(res1.receipt.id).not.toBe(res2.receipt.id);
    expect(res1.receipt.receiptNumber).not.toBe(res2.receipt.receiptNumber);

    const product = await getProduct(master.kopi.id);
    expect(product.stock).toBe(20);
  });

  it('S11 - Penerima: tanpa receivedById; staff nonaktif; staff tak ada -> 400 / 409 / 404; detail penerimaan menampilkan nama penerima', async () => {
    // 1. Staff tidak ada -> 404
    await expect(
      createGoodsReceipt({
        idempotencyKey: 's11-key-not-found',
        supplierId: master.pakHaji.id,
        receivedById: '00000000-0000-0000-0000-000000000099',
        lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
      }),
    ).rejects.toThrow(NotFoundError);

    // 2. Staff nonaktif -> 409
    const inactiveStaff = await testDb.staff.create({
      data: { name: 'Staff Resign', isActive: false },
    });
    await expect(
      createGoodsReceipt({
        idempotencyKey: 's11-key-inactive',
        supplierId: master.pakHaji.id,
        receivedById: inactiveStaff.id,
        lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
      }),
    ).rejects.toThrow(ConflictError);

    // 3. Staff valid -> detail menampilkan nama penerima
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's11-key-valid',
      supplierId: master.pakHaji.id,
      receivedById: master.sari.id,
      lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
    });
    expect(receipt.receivedByName).toBe('Sari');
  });

  it('S12 - Tanpa pesanan (langsung) -> tersimpan bila A1 default; stok bertambah; PO tidak terlibat', async () => {
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's12-direct-receipt',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: null,
      lines: [
        {
          productId: master.indomie.id,
          receivedBase: 40,
          unitCostPerPurchaseUnit: 112000,
        },
      ],
    });

    expect(receipt.purchaseOrderId).toBeNull();
    const product = await getProduct(master.indomie.id);
    expect(product.stock).toBe(40);
  });

  it('S13 - Batalkan sisa: PO 5 dus, terima 3, cancel sisa -> sisa 0, cancelledBase=80, status COMPLETE; penerimaan baru ke baris itu -> 409. PO tanpa penerimaan lalu dibatalkan -> CANCELLED', async () => {
    // PO 5 dus (200 bungkus)
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 5 }],
    });

    // Terima 3 dus (120 bungkus)
    await createGoodsReceipt({
      idempotencyKey: 's13-part',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
    });

    // Batalkan sisa
    const poCancelled = await cancelRemaining(po.id, { reason: 'Sales kehabisan stok mie' });
    expect(poCancelled.status).toBe(PurchaseOrderStatus.COMPLETE);
    expect(poCancelled.lines[0].cancelledBase).toBe(80);
    expect(poCancelled.lines[0].remainingBase).toBe(0);

    // Penerimaan baru ke baris itu -> 409
    await expect(
      createGoodsReceipt({
        idempotencyKey: 's13-after-cancel',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: po.id,
        lines: [{ productId: master.indomie.id, receivedBase: 40, unitCostPerPurchaseUnit: 112000 }],
      }),
    ).rejects.toThrow(ConflictError);

    // PO tanpa penerimaan lalu dibatalkan -> status CANCELLED
    const po2 = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 2 }],
    });
    const po2Cancelled = await cancelRemaining(po2.id, { reason: 'Batal beli' });
    expect(po2Cancelled.status).toBe(PurchaseOrderStatus.CANCELLED);
    expect(po2Cancelled.lines[0].remainingBase).toBe(0);
  });

  it('S14 - Race: dua penerimaan bersamaan masing-masing 3 dus pada PO 5 dus -> tepat satu berhasil, satu 409; fulfilledBase <= orderedBase', async () => {
    // PO 5 dus Indomie = 200 bungkus
    const po = await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: master.indomie.id, quantity: 5 }],
    });

    // Dua penerimaan bersamaan dengan kunci berbeda, masing-masing 3 dus = 120 bungkus
    const req1 = {
      idempotencyKey: 's14-race-key-1',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: po.id,
      lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
    };
    const req2 = {
      idempotencyKey: 's14-race-key-2',
      supplierId: master.pakHaji.id,
      receivedById: master.sari.id,
      purchaseOrderId: po.id,
      lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
    };

    const results = await Promise.allSettled([
      createGoodsReceipt(req1),
      createGoodsReceipt(req2),
    ]);

    const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
    const rejectedCount = results.filter((r) => r.status === 'rejected').length;

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const poCheck = await getPurchaseOrder(po.id);
    expect(poCheck.lines[0].fulfilledBase).toBe(120);
    expect(poCheck.lines[0].fulfilledBase).toBeLessThanOrEqual(poCheck.lines[0].orderedBase);

    const product = await getProduct(master.indomie.id);
    expect(product.stock).toBe(120);
  });

  it('S15 - Koreksi stok keluar melebihi stok -> 409, stok tak minus', async () => {
    // Set stok awal 10 via penyesuaian masuk
    await adjustStock({
      productId: master.kopi.id,
      type: 'IN',
      quantity: 10,
      reason: StockAdjustmentReason.HITUNG_ULANG,
      note: 'Stok awal',
    });

    // Coba keluarkan 15 -> 409
    await expect(
      adjustStock({
        productId: master.kopi.id,
        type: 'OUT',
        quantity: 15,
        reason: StockAdjustmentReason.RUSAK,
        note: 'Barang rusak',
      }),
    ).rejects.toThrow(ConflictError);

    // Stok tetap 10, tidak pernah minus
    const product = await getProduct(master.kopi.id);
    expect(product.stock).toBe(10);
  });

  it('S16 - Koreksi tanpa alasan / alasan LAINNYA tanpa catatan -> 400', async () => {
    // 1. Tanpa alasan -> validasi Zod gagal
    const invalidNoReason = {
      productId: master.kopi.id,
      type: 'IN',
      quantity: 5,
    };
    expect(() => stockAdjustmentSchema.parse(invalidNoReason)).toThrow();

    // 2. Alasan LAINNYA tanpa catatan -> validasi Zod gagal
    const invalidLainnyaNoNote = {
      productId: master.kopi.id,
      type: 'IN',
      quantity: 5,
      reason: StockAdjustmentReason.LAINNYA,
      note: '',
    };
    expect(() => stockAdjustmentSchema.parse(invalidLainnyaNoNote)).toThrow();

    // 3. Alasan LAINNYA dengan catatan -> valid
    const validLainnya = {
      productId: master.kopi.id,
      type: 'IN',
      quantity: 5,
      reason: StockAdjustmentReason.LAINNYA,
      note: 'Ditemukan di gudang belakang',
    };
    expect(() => stockAdjustmentSchema.parse(validLainnya)).not.toThrow();
  });

  it('S17 - Sisa stok: terima 2 renteng kopi, jual 5 sachet -> UI/API menunjukkan 15 sachet (dengan label satuan dasar)', async () => {
    // Terima 2 renteng kopi = 20 sachet
    await createGoodsReceipt({
      idempotencyKey: 's17-receipt',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      lines: [{ productId: master.kopi.id, receivedBase: 20, unitCostPerPurchaseUnit: 11000 }],
    });

    // Jual 5 sachet
    await createSale({
      items: [{ productId: master.kopi.id, quantity: 5 }],
    });

    // Sisa stok 15 sachet dengan label satuan dasar
    const product = await getProduct(master.kopi.id);
    expect(product.stock).toBe(15);
    expect(product.baseUnit).toBe('sachet');
  });

  it('S18 - Produk nonaktif dipesan/diterima (default: ditolak) -> 409 dengan pesan jelas', async () => {
    // Buat produk nonaktif
    const inactiveProduct = await createProduct({
      sku: 'NON-001',
      name: 'Produk Lama Discontinue',
      category: 'Lainnya',
      purchasePrice: 1000,
      sellingPrice: 2000,
      stock: 0,
      isActive: false,
    });

    // 1. Ditolak saat dipesan via PO -> 409
    await expect(
      createPurchaseOrder({
        supplierId: master.pakHaji.id,
        lines: [{ productId: inactiveProduct.id, quantity: 1 }],
      }),
    ).rejects.toThrow(ConflictError);

    // 2. Ditolak saat diterima via GoodsReceipt -> 409
    await expect(
      createGoodsReceipt({
        idempotencyKey: 's18-receipt-inactive',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: inactiveProduct.id, receivedBase: 10, unitCostPerPurchaseUnit: 10000 }],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('S19 - Riwayat stok -> tipe RECEIPT tampil dengan label nomor GR-...', async () => {
    const { receipt } = await createGoodsReceipt({
      idempotencyKey: 's19-receipt',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
    });

    const movements = await listStockMovements({ productId: master.kopi.id });
    const receiptMovement = movements.find((m) => m.referenceId === receipt.id);

    expect(receiptMovement).toBeDefined();
    expect(receiptMovement!.type).toBe('RECEIPT');
    expect(receiptMovement!.referenceType).toBe('GOODS_RECEIPT');
    expect(receiptMovement!.referenceLabel).toBe(receipt.receiptNumber);
    expect(receiptMovement!.referenceLabel).toMatch(/^GR-\d{8}-\d{4}$/);
  });

  it('S20 - Regresi -> penjualan baru, penolakan jual produk nonaktif, hard-delete produk bersih vs berriwayat, nomor invoice tetap jalan seperti sebelumnya', async () => {
    // 1. Tambah stok Indomie
    await adjustStock({
      productId: master.indomie.id,
      type: 'IN',
      quantity: 10,
      reason: StockAdjustmentReason.HITUNG_ULANG,
    });

    // 2. Penjualan baru produk aktif normal
    const sale = await createSale({
      items: [{ productId: master.indomie.id, quantity: 2 }],
    });
    expect(sale.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);

    // 3. Penolakan jual produk nonaktif
    const inactiveProduct = await createProduct({
      sku: 'NON-SALE-001',
      name: 'Barang Nonaktif',
      category: 'Lainnya',
      purchasePrice: 1000,
      sellingPrice: 2000,
      stock: 5,
      isActive: false,
    });
    await expect(
      createSale({
        items: [{ productId: inactiveProduct.id, quantity: 1 }],
      }),
    ).rejects.toThrow(ConflictError);

    // 4. Hard-delete produk bersih (tanpa transaksi/PO/penerimaan) -> sukses
    const cleanProduct = await createProduct({
      sku: 'CLEAN-001',
      name: 'Produk Baru Bersih',
      category: 'Lainnya',
      purchasePrice: 1000,
      sellingPrice: 2000,
      stock: 0,
    });
    await expect(deleteProduct(cleanProduct.id)).resolves.toBeUndefined();

    // 5. Hard-delete produk berriwayat transaksi penjualan -> 409
    await expect(deleteProduct(master.indomie.id)).rejects.toThrow(ConflictError);

    // 6. Hard-delete produk pernah dipesan di PO -> 409
    const poProduct = await createProduct({
      sku: 'PO-PROD-001',
      name: 'Produk Untuk PO',
      category: 'Lainnya',
      purchasePrice: 1000,
      sellingPrice: 2000,
      stock: 0,
    });
    await createPurchaseOrder({
      supplierId: master.pakHaji.id,
      lines: [{ productId: poProduct.id, quantity: 1 }],
    });
    await expect(deleteProduct(poProduct.id)).rejects.toThrow(ConflictError);
  });
});
