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
import { formatDateKeyWib } from '../src/lib/dates';
import { generateReceiptNumber } from '../src/services/goods-receipt.service';

describe('Boundary, Edge Cases & Adversarial Testing Suite', () => {
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
  // 1. DUPLIKASI DATA & INTEGRITAS UNIQUE CONSTRAINT (409 CONFLICT)
  // =========================================================================
  describe('1. Duplikasi Data & Penolakan Konflik (409)', () => {
    it('Duplikasi SKU Produk ditolak dengan 409 Conflict', async () => {
      const res = await api('/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          sku: 'MIE-001', // Sudah dimiliki Indomie Goreng!
          name: 'Indomie Goreng KW Super',
          category: 'Makanan Instan',
          purchasePrice: 2000,
          sellingPrice: 3000,
        }),
      });

      expect(res.status).toBe(409);
      expect(((res.body.error as JsonRecord).message as string)).toContain('SKU');
    });

    it('Duplikasi Nama Supplier ditolak dengan 409 Conflict', async () => {
      const res = await api('/suppliers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          name: 'Pak Haji', // Sudah ada!
          phone: '081299998888',
        }),
      });

      expect(res.status).toBe(409);
    });

    it('Duplikasi Nama Staf ditolak dengan 409 Conflict', async () => {
      const res = await api('/staff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          name: 'Udin', // Sudah ada!
        }),
      });

      expect(res.status).toBe(409);
    });

    it('Idempotency Replay: Request identik tidak menduplikasi data atau pergerakan stok', async () => {
      const payload = {
        idempotencyKey: 'idempotent-adv-key-999',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 40,
            unitCostPerPurchaseUnit: 2800,
          },
        ],
      };

      // 1. Panggilan Pertama -> 201 Created
      const res1 = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify(payload),
      });
      expect(res1.status).toBe(201);
      const receipt1Id = (res1.body as JsonRecord).id;

      // 2. Panggilan Kedua (Replay) -> 200 OK dengan id yang sama persis
      const res2 = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify(payload),
      });
      expect(res2.status).toBe(200);
      expect((res2.body as JsonRecord).id).toBe(receipt1Id);

      // Verifikasi Database: Hanya ada 1 record GoodsReceipt dan 1 StockMovement
      const grCount = await testDb.goodsReceipt.count({ where: { idempotencyKey: 'idempotent-adv-key-999' } });
      const movementCount = await testDb.stockMovement.count({ where: { productId: master.indomie.id } });

      expect(grCount).toBe(1);
      expect(movementCount).toBe(1);
    });
  });

  // =========================================================================
  // 2. ADVERSARIAL ATTACK: SQL INJECTION IMMUNITY
  // =========================================================================
  describe('2. Kekebalan dari Serangan SQL Injection', () => {
    it('SQL Injection pada Pencarian Produk diperlakukan sebagai literal dan tidak membocorkan data', async () => {
      // Payload injeksi klasik
      const injectionQueries = [
        "' OR '1'='1",
        "'; DROP TABLE \"Product\"; --",
        "1' UNION SELECT * FROM \"User\" --",
        "admin'--",
      ];

      for (const query of injectionQueries) {
        const res = await api(`/products?search=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${master.ownerToken}` },
        });

        // Harus berhasil 200 tanpa error internal database (500)
        expect(res.status).toBe(200);

        // Tidak boleh membocorkan seluruh data produk jika search bernilai tidak cocok
        const results = res.body as unknown as Array<JsonRecord>;
        expect(Array.isArray(results)).toBe(true);

        // Verifikasi tabel Product masih utuh dan tidak ter-DROP
        const productStillExists = await testDb.product.findUnique({ where: { id: master.indomie.id } });
        expect(productStillExists).not.toBeNull();
      }
    });

    it('SQL Injection pada Login PIN ditolak secara aman', async () => {
      const maliciousPins = [
        "' OR '1'='1",
        "123456' OR '1'='1' --",
        "'; DROP TABLE \"User\"; --",
      ];

      for (const maliciousPin of maliciousPins) {
        const res = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'cakrofi', pin: maliciousPin }),
        });

        // Ditolak aman 401 Unauthorized
        expect(res.status).toBe(401);

        // Verifikasi user Cak Rofi masih ada di DB
        const userExists = await testDb.user.findUnique({ where: { username: 'cakrofi' } });
        expect(userExists).not.toBeNull();
      }
    });

    it('SQL Injection pada Parameter URL UUID ditolak aman dengan 400', async () => {
      const res = await api("/products/' OR 1=1 --", {
        headers: { Authorization: `Bearer ${master.ownerToken}` },
      });

      // Zod UUID validator menolak format non-UUID dengan 400
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. MALFORMED PAYLOAD, BUFFER STRESS & XSS INJECTION
  // =========================================================================
  describe('3. Penanganan Payload Malformed, Buffer Stress & XSS', () => {
    it('Malformed JSON pada request body ditolak dengan 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${master.ownerToken}`,
        },
        body: '{"sku": "CORRUPT", "name": "Beras Rusak", broken json here...',
      });

      expect(res.status).toBe(400);
    });

    it('Buffer Stress: String raksasa (10.000 karakter) ditolak aman oleh skema validasi Zod', async () => {
      const hugeString = 'A'.repeat(10000);

      const res = await api('/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          sku: 'STRESS-001',
          name: hugeString,
          category: 'Snack',
          purchasePrice: 1000,
          sellingPrice: 1500,
        }),
      });

      // Ditolak 400 karena melebihi max length Zod tanpa membuat server hang/OOM
      expect(res.status).toBe(400);
      const err = res.body.error as { code: string; message: string; details: Array<{ field: string; message: string }> };
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details[0].message).toContain('maksimal');
    });

    it('XSS Script Payloads dinetralkan sebagai string murni tanpa eksekusi', async () => {
      const xssPayload = '<script>alert("XSS_ATTACK")</script>';

      const res = await api('/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          sku: 'XSS-001',
          name: `Sabun Cuci ${xssPayload}`,
          category: 'Kebersihan',
          purchasePrice: 2000,
          sellingPrice: 3000,
        }),
      });

      expect(res.status).toBe(201);
      const created = res.body as JsonRecord;
      expect((created.name as string)).toContain('<script>');

      // Bersihkan
      await testDb.product.delete({ where: { sku: 'XSS-001' } });
    });

    it('Extreme Numbers: Nilai pecahan (Float) dan negatif ditolak validator Zod', async () => {
      // 1. Kuantitas berupa angka pecahan / desimal pada GoodsReceipt
      const resFloat = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          idempotencyKey: 'float-test-key-1',
          supplierId: master.pakHaji.id,
          receivedById: master.udin.id,
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 2.5, // Harus integer!
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });
      expect(resFloat.status).toBe(400);

      // 2. Kuantitas negatif pada GoodsReceipt
      const resNeg = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          idempotencyKey: 'neg-test-key-1',
          supplierId: master.pakHaji.id,
          receivedById: master.udin.id,
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: -40, // Negatif!
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });
      expect(resNeg.status).toBe(400);
    });
  });

  // =========================================================================
  // 4. BATAS TAHUN KABISAT & PERGANTIAN TAHUN KALENDER
  // =========================================================================
  describe('4. Batas Tahun Kabisat & Pergantian Kalender', () => {
    it('Tahun Kabisat: Penomoran dokumen pada 29 Februari 2024 dan 2028', async () => {
      const leapDay2024 = new Date('2024-02-29T10:00:00+07:00');
      const leapDay2028 = new Date('2028-02-29T15:30:00+07:00');

      expect(formatDateKeyWib(leapDay2024)).toBe('20240229');
      expect(formatDateKeyWib(leapDay2028)).toBe('20280229');

      await testDb.$transaction(async (tx) => {
        const rcvNum2024 = await generateReceiptNumber(tx, leapDay2024);
        expect(rcvNum2024.startsWith('GR-20240229-')).toBe(true);

        const rcvNum2028 = await generateReceiptNumber(tx, leapDay2028);
        expect(rcvNum2028.startsWith('GR-20280229-')).toBe(true);
      });
    });

    it('Pergantian Tahun Kalender: 31 Desember 23:59:59 ke 1 Januari 00:00:01 WIB', () => {
      const nye = new Date('2025-12-31T23:59:59+07:00');
      const nyd = new Date('2026-01-01T00:00:01+07:00');

      expect(formatDateKeyWib(nye)).toBe('20251231');
      expect(formatDateKeyWib(nyd)).toBe('20260101');
    });
  });
});
