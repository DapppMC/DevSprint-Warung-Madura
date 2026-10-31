import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/app';
import {
  testDb,
  resetTestDatabase,
  seedTestMasterData,
  assertTestDatabase,
  type TestMasterData,
} from './helpers/db-helper';
import { createSale } from '../src/services/sale.service';
import { createGoodsReceipt } from '../src/services/goods-receipt.service';

describe('Database & ACID Test: Verifikasi Rollback, Isolasi Transaksi & Retensi Arsip', () => {
  let server: Server;
  let baseUrl: string;
  let master: TestMasterData;

  beforeAll(async () => {
    assertTestDatabase();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}/api`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    assertTestDatabase();
    await resetTestDatabase();
    master = await seedTestMasterData();
  });

  interface JsonRecord {
    [key: string]: unknown;
  }

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let json: JsonRecord = {};
    try {
      json = (text ? JSON.parse(text) : {}) as JsonRecord;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  }

  // =========================================================================
  // 1. ATOMICITY & ROLLBACK UPON ERROR
  // =========================================================================
  describe('1. Atomisitas & Rollback saat Kegagalan Transaksi', () => {
    it('Rollback Goods Receipt: Kegagalan baris transaksi membatalkan seluruh perubahan DB', async () => {
      const stockBefore = (await testDb.product.findUnique({ where: { id: master.indomie.id } }))!.stock;
      expect(stockBefore).toBe(0);

      // Coba transaksi dengan productId tidak valid pada baris kedua
      await expect(
        createGoodsReceipt({
          idempotencyKey: 'acid-gr-fail-key-1',
          supplierId: master.pakHaji.id,
          receivedById: master.udin.id,
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 40,
              unitCostPerPurchaseUnit: 2800,
            },
            {
              productId: '00000000-0000-0000-0000-000000000000', // Non-existent product!
              receivedBase: 20,
              unitCostPerPurchaseUnit: 1000,
            },
          ],
        }),
      ).rejects.toThrow();

      // Verifikasi Atomicity: Rollback 100%, tidak ada data setengah jadi
      const grCount = await testDb.goodsReceipt.count();
      const lineCount = await testDb.goodsReceiptLine.count();
      const movementCount = await testDb.stockMovement.count();
      const productAfter = await testDb.product.findUnique({ where: { id: master.indomie.id } });

      expect(grCount).toBe(0);
      expect(lineCount).toBe(0);
      expect(movementCount).toBe(0);
      expect(productAfter!.stock).toBe(0); // Stok tidak bertambah sebagian
    });

    it('Rollback Sale: Penjualan multi-item gagal jika ada satu item yang stoknya kurang', async () => {
      // Set stok Indomie = 10, Kopi = 0
      await testDb.product.update({ where: { id: master.indomie.id }, data: { stock: 10 } });

      // Coba beli 5 Indomie (cukup) dan 2 Kopi (tidak cukup: 0)
      await expect(
        createSale({
          items: [
            { productId: master.indomie.id, quantity: 5 },
            { productId: master.kopi.id, quantity: 2 },
          ],
        }),
      ).rejects.toThrow();

      // Verifikasi Rollback: Tidak ada invoice penjualan, stok Indomie tetap utuh 10
      const saleCount = await testDb.sale.count();
      const saleItemCount = await testDb.saleItem.count();
      const indomie = await testDb.product.findUnique({ where: { id: master.indomie.id } });

      expect(saleCount).toBe(0);
      expect(saleItemCount).toBe(0);
      expect(indomie!.stock).toBe(10); // Tetap 10, tidak terpotong 5!
    });
  });

  // =========================================================================
  // 2. ISOLASI TRANSAKSI & CONCURRENCY GUARD (ANTI-OVERSELLING)
  // =========================================================================
  describe('2. Isolasi Transaksi & Pencegahan Overselling (Race Condition)', () => {
    it('Race Condition: Dua transaksi simultan tidak boleh menyebabkan stok negatif', async () => {
      // Inisialisasi stok = 10
      await testDb.product.update({ where: { id: master.indomie.id }, data: { stock: 10 } });

      // Dua transaksi penjualan mencoba membeli masing-masing 7 unit secara bersamaan (total butuh 14)
      const attempt1 = createSale({
        items: [{ productId: master.indomie.id, quantity: 7 }],
      }).then(() => 'SUCCESS', () => 'FAILED');

      const attempt2 = createSale({
        items: [{ productId: master.indomie.id, quantity: 7 }],
      }).then(() => 'SUCCESS', () => 'FAILED');

      const results = await Promise.all([attempt1, attempt2]);

      // Tepat 1 transaksi berhasil, dan 1 transaksi gagal
      expect(results).toContain('SUCCESS');
      expect(results).toContain('FAILED');

      // Stok akhir harus tepat 10 - 7 = 3, TIDAK PERNAH -4
      const indomie = await testDb.product.findUnique({ where: { id: master.indomie.id } });
      expect(indomie!.stock).toBe(3);
    });

    it('Integritas Database: Larangan stok negatif ditegakkan ketat', async () => {
      // Set stok = 2
      await testDb.product.update({ where: { id: master.indomie.id }, data: { stock: 2 } });

      // Penyesuaian stok keluar melebihi stok yang ada
      const res = await api('/stock-adjustments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          productId: master.indomie.id,
          type: 'OUT',
          quantity: 5, // Lebih besar dari stok 2!
          reason: 'RUSAK',
          note: 'Uji batas negatif',
        }),
      });

      expect(res.status).toBe(409); // ConflictError: Stok tidak mencukupi
      const indomie = await testDb.product.findUnique({ where: { id: master.indomie.id } });
      expect(indomie!.stock).toBe(2);
    });
  });

  // =========================================================================
  // 3. RETENSI ARSIP & APPEND-ONLY AUDIT TRAIL
  // =========================================================================
  describe('3. Retensi Arsip & Append-Only Audit Trail', () => {
    it('Audit Trail Immutability: Mutasi stok mencatat jejak beforeStock, quantity, dan afterStock', async () => {
      // 1. Terima barang masuk: 40 bungkus Indomie
      await createGoodsReceipt({
        idempotencyKey: 'acid-audit-gr-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 40,
            unitCostPerPurchaseUnit: 2800,
          },
        ],
      });

      // 2. Jual 15 bungkus
      await createSale({
        items: [{ productId: master.indomie.id, quantity: 15 }],
      });

      // 3. Ambil seluruh riwayat StockMovement untuk Indomie
      const movements = await testDb.stockMovement.findMany({
        where: { productId: master.indomie.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(movements.length).toBe(2);

      // Mutasi 1: RECEIPT (+40)
      expect(movements[0].type).toBe('RECEIPT');
      expect(movements[0].beforeStock).toBe(0);
      expect(movements[0].quantity).toBe(40);
      expect(movements[0].afterStock).toBe(40);

      // Mutasi 2: SALE (-15)
      expect(movements[1].type).toBe('SALE');
      expect(movements[1].beforeStock).toBe(40);
      expect(movements[1].quantity).toBe(15);
      expect(movements[1].afterStock).toBe(25);
    });

    it('Retensi Data saat Produk Dinonaktifkan: Data transaksi & riwayat stok tetap utuh', async () => {
      // 1. Catat penerimaan barang
      await createGoodsReceipt({
        idempotencyKey: 'acid-deactivate-gr-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.kopi.id,
            receivedBase: 30,
            unitCostPerPurchaseUnit: 1100,
          },
        ],
      });

      // 2. Jual 10 sachet kopi
      await createSale({
        items: [{ productId: master.kopi.id, quantity: 10 }],
      });

      // 3. Pemilik menonaktifkan produk Kopi
      const resDeactivate = await api(`/products/${master.kopi.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({ isActive: false }),
      });
      expect(resDeactivate.status).toBe(200);

      // 4. Verifikasi produk nonaktif tidak bisa dijual lagi
      const resSaleFail = await api('/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          items: [{ productId: master.kopi.id, quantity: 5 }],
        }),
      });
      expect(resSaleFail.status).toBe(409); // ConflictError: Produk nonaktif tidak dapat dijual

      // 5. Verifikasi arsip tetap 100% utuh
      const grLines = await testDb.goodsReceiptLine.findMany({ where: { productId: master.kopi.id } });
      const saleItems = await testDb.saleItem.findMany({ where: { productId: master.kopi.id } });
      const movements = await testDb.stockMovement.findMany({ where: { productId: master.kopi.id } });

      expect(grLines.length).toBeGreaterThanOrEqual(1);
      expect(saleItems.length).toBeGreaterThanOrEqual(1);
      expect(movements.length).toBeGreaterThanOrEqual(2);
    });
  });
});
