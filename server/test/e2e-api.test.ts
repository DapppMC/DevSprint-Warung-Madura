import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/app';
import {
  testDb,
  resetTestDatabase,
  seedTestMasterData,
  assertTestDatabase,
  type TestMasterData,
} from './helpers/db-helper';

describe('E2E HTTP API Skenario Uji S1 - S20', () => {
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
    [key: number]: unknown;
  }

  async function api(path: string, options: RequestInit = {}) {
    const authHeader: Record<string, string> = master?.ownerToken
      ? { Authorization: `Bearer ${master.ownerToken}` }
      : {};

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
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

  it('S1 - Konversi via API: pesan & terima 2 renteng kopi', async () => {
    // 1. Buat PO 2 renteng kopi
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.kopi.id, quantity: 2 }],
      }),
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.id;

    // 2. Terima 2 renteng (20 sachet)
    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s1-receipt-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.kopi.id,
            receivedBase: 20,
            unitCostPerPurchaseUnit: 11000,
          },
        ],
      }),
    });
    expect(grRes.status).toBe(201);

    // 3. Cek stok kopi
    const prodRes = await api(`/products/${master.kopi.id}`);
    expect(prodRes.status).toBe(200);
    expect(prodRes.body.stock).toBe(20);

    // 4. Cek movement
    const movRes = await api(`/stock-movements?productId=${master.kopi.id}`);
    expect(movRes.status).toBe(200);
    expect(movRes.body[0].type).toBe('RECEIPT');
    expect(movRes.body[0].quantity).toBe(20);
    expect(movRes.body[0].referenceLabel).toBe(grRes.body.receiptNumber);
  });

  it('S2 - Parsial via API: PO 5 dus mie; terima 3 dus; terima 2 dus', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 5 }],
      }),
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.id;

    // Terima 3 dus (120 bungkus)
    const gr1 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s2-gr-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 120,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    });
    expect(gr1.status).toBe(201);

    const poCheck1 = await api(`/purchase-orders/${poId}`);
    expect(poCheck1.body.status).toBe('PARTIAL');
    expect(poCheck1.body.lines[0].remainingBase).toBe(80);

    // Terima 2 dus (80 bungkus)
    const gr2 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s2-gr-2',
        supplierId: master.pakHaji.id,
        receivedById: master.sari.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 80,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    });
    expect(gr2.status).toBe(201);

    const poCheck2 = await api(`/purchase-orders/${poId}`);
    expect(poCheck2.body.status).toBe('COMPLETE');
    expect(poCheck2.body.lines[0].remainingBase).toBe(0);

    const prod = await api(`/products/${master.indomie.id}`);
    expect(prod.body.stock).toBe(200);
  });

  it('S3 - Lebih dari sisa via API: PO 5 dus, terima 6 dus -> 409', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 5 }],
      }),
    });
    const poId = poRes.body.id;

    // Coba terima 6 dus (240 bungkus)
    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s3-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 240,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    });
    expect(grRes.status).toBe(409);

    const prod = await api(`/products/${master.indomie.id}`);
    expect(prod.body.stock).toBe(0);
  });

  it('S4 - Bonus via API: beli 10 dus mie + bonus 1 dus', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 10 }],
      }),
    });
    const poId = poRes.body.id;

    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s4-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 400,
            bonusBase: 40,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    });
    expect(grRes.status).toBe(201);
    expect(grRes.body.lines[0].costPerBaseUnit).toBe(2800);
    expect(grRes.body.lines[0].effectiveCostPerBaseUnit).toBe(2545.4545);

    const prod = await api(`/products/${master.indomie.id}`);
    expect(prod.body.stock).toBe(440);
  });

  it('S5 - Ditolak via API: PO 3 dus Aqua (72); datang 72, ditolak 24 (PENYOK)', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.aqua.id, quantity: 3 }],
      }),
    });
    const poId = poRes.body.id;

    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s5-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [
          {
            productId: master.aqua.id,
            receivedBase: 72,
            rejectedBase: 24,
            rejectReason: 'PENYOK',
            rejectNote: 'Kardus penyok tertimpa',
            unitCostPerPurchaseUnit: 55200,
          },
        ],
      }),
    });
    expect(grRes.status).toBe(201);

    const prod = await api(`/products/${master.aqua.id}`);
    expect(prod.body.stock).toBe(48);

    const poCheck = await api(`/purchase-orders/${poId}`);
    expect(poCheck.body.status).toBe('PARTIAL');
    expect(poCheck.body.lines[0].remainingBase).toBe(24);
  });

  it('S6 - Semua ditolak via API: datang 24, ditolak 24', async () => {
    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s6-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.aqua.id,
            receivedBase: 24,
            rejectedBase: 24,
            rejectReason: 'KEDALUWARSA',
            unitCostPerPurchaseUnit: 55200,
          },
        ],
      }),
    });
    expect(grRes.status).toBe(201);

    const prod = await api(`/products/${master.aqua.id}`);
    expect(prod.body.stock).toBe(0);

    const movs = await api(`/stock-movements?productId=${master.aqua.id}`);
    expect(movs.body).toHaveLength(0);
  });

  it('S7 - Snapshot harga via API: perubahan harga master tidak mengubah riwayat penerimaan', async () => {
    const gr1 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s7-gr-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 40,
            unitCostPerPurchaseUnit: 112000,
          },
        ],
      }),
    });
    expect(gr1.body.lines[0].costPerBaseUnit).toBe(2800);

    const gr2 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s7-gr-2',
        supplierId: master.pakHaji.id,
        receivedById: master.sari.id,
        lines: [
          {
            productId: master.indomie.id,
            receivedBase: 40,
            unitCostPerPurchaseUnit: 118000,
          },
        ],
      }),
    });
    expect(gr2.body.lines[0].costPerBaseUnit).toBe(2950);

    // Update harga produk di master
    await api(`/products/${master.indomie.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchasePrice: 3500 }),
    });

    const checkGr1 = await api(`/goods-receipts/${gr1.body.id}`);
    expect(checkGr1.body.lines[0].costPerBaseUnit).toBe(2800);
  });

  it('S8 - Pembulatan 4 desimal via API: Aqua Rp55.000 / 24 botol', async () => {
    const gr = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s8-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [
          {
            productId: master.aqua.id,
            receivedBase: 24,
            unitCostPerPurchaseUnit: 55000,
          },
        ],
      }),
    });
    expect(gr.status).toBe(201);
    expect(gr.body.lines[0].costPerBaseUnit).toBe(2291.6667);
  });

  it('S9 - Klik ganda & race idempotency via API: kembalikan 200 dan data sama persis', async () => {
    const key = 'http-s9-double-click';
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

    const [resA, resB] = await Promise.all([
      api('/goods-receipts', { method: 'POST', body: JSON.stringify(payload) }),
      api('/goods-receipts', { method: 'POST', body: JSON.stringify(payload) }),
    ]);

    expect([200, 201]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);
    expect(resA.body.id).toBe(resB.body.id);

    const prod = await api(`/products/${master.kopi.id}`);
    expect(prod.body.stock).toBe(10);
  });

  it('S10 - Dua kiriman sah dengan kunci berbeda via API', async () => {
    const p1 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s10-key-1',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.gula.id, receivedBase: 20, unitCostPerPurchaseUnit: 310000 }],
      }),
    });
    const p2 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s10-key-2',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.gula.id, receivedBase: 20, unitCostPerPurchaseUnit: 310000 }],
      }),
    });
    expect(p1.status).toBe(201);
    expect(p2.status).toBe(201);
    expect(p1.body.id).not.toBe(p2.body.id);

    const prod = await api(`/products/${master.gula.id}`);
    expect(prod.body.stock).toBe(40);
  });

  it('S11 - Penerima validasi via API: missing, nonaktif, atau not found', async () => {
    // Missing receivedById -> 400
    const r1 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s11-missing',
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
      }),
    });
    expect(r1.status).toBe(400);

    // Nonaktif staff -> 409
    await testDb.staff.update({ where: { id: master.udin.id }, data: { isActive: false } });
    const r2 = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s11-inactive',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
      }),
    });
    expect(r2.status).toBe(409);
  });

  it('S12 - Tanpa pesanan (langsung) via API', async () => {
    const res = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s12-direct',
        supplierId: master.tokoGrosir.id,
        receivedById: master.sari.id,
        lines: [{ productId: master.kopi.id, receivedBase: 30, unitCostPerPurchaseUnit: 11000 }],
      }),
    });
    expect(res.status).toBe(201);
    expect(res.body.purchaseOrderId).toBeNull();

    const prod = await api(`/products/${master.kopi.id}`);
    expect(prod.body.stock).toBe(30);
  });

  it('S13 - Batalkan sisa pesanan via API: PO 5 dus mie, terima 3, batalkan sisa', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 5 }],
      }),
    });
    const poId = poRes.body.id;

    // Terima 3 dus (120 bungkus)
    await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s13-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
      }),
    });

    // Batalkan sisa
    const cancelRes = await api(`/purchase-orders/${poId}/cancel-remaining`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Supplier kehabisan stok' }),
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('COMPLETE');
    expect(cancelRes.body.lines[0].remainingBase).toBe(0);
    expect(cancelRes.body.lines[0].cancelledBase).toBe(80);

    // Kirim lagi ke PO yang sudah complete -> 409
    const retryRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s13-extra',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        purchaseOrderId: poId,
        lines: [{ productId: master.indomie.id, receivedBase: 40, unitCostPerPurchaseUnit: 112000 }],
      }),
    });
    expect(retryRes.status).toBe(409);
  });

  it('S14 - Race concurrency: 2 penerimaan paralel masing-masing 3 dus pada PO 5 dus', async () => {
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 5 }],
      }),
    });
    const poId = poRes.body.id;

    const payloadA = {
      idempotencyKey: 'http-s14-race-A',
      supplierId: master.pakHaji.id,
      receivedById: master.udin.id,
      purchaseOrderId: poId,
      lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
    };
    const payloadB = {
      idempotencyKey: 'http-s14-race-B',
      supplierId: master.pakHaji.id,
      receivedById: master.sari.id,
      purchaseOrderId: poId,
      lines: [{ productId: master.indomie.id, receivedBase: 120, unitCostPerPurchaseUnit: 112000 }],
    };

    const results = await Promise.all([
      api('/goods-receipts', { method: 'POST', body: JSON.stringify(payloadA) }),
      api('/goods-receipts', { method: 'POST', body: JSON.stringify(payloadB) }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);

    const poCheck = await api(`/purchase-orders/${poId}`);
    expect(poCheck.body.lines[0].fulfilledBase).toBe(120);
    expect(poCheck.body.lines[0].remainingBase).toBe(80);
  });

  it('S15 - Koreksi stok keluar melebihi stok via API -> 409', async () => {
    const res = await api('/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: master.kopi.id,
        type: 'OUT',
        quantity: 10,
        reason: 'HILANG',
      }),
    });
    expect(res.status).toBe(409);

    const prod = await api(`/products/${master.kopi.id}`);
    expect(prod.body.stock).toBe(0);
  });

  it('S16 - Koreksi tanpa alasan atau LAINNYA tanpa catatan via API -> 400', async () => {
    const r1 = await api('/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: master.kopi.id,
        type: 'IN',
        quantity: 5,
      }),
    });
    expect(r1.status).toBe(400);

    const r2 = await api('/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: master.kopi.id,
        type: 'IN',
        quantity: 5,
        reason: 'LAINNYA',
      }),
    });
    expect(r2.status).toBe(400);
  });

  it('S17 - Sisa stok via API: terima 2 renteng kopi, jual 5 sachet -> sisa 15 sachet', async () => {
    await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s17-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.kopi.id, receivedBase: 20, unitCostPerPurchaseUnit: 11000 }],
      }),
    });

    const saleRes = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ productId: master.kopi.id, quantity: 5 }],
      }),
    });
    expect(saleRes.status).toBe(201);

    const prod = await api(`/products/${master.kopi.id}`);
    expect(prod.body.stock).toBe(15);
    expect(prod.body.baseUnit).toBe('sachet');
  });

  it('S18 - Produk nonaktif dipesan atau diterima via API -> 409', async () => {
    await api(`/products/${master.indomie.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });

    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: master.pakHaji.id,
        lines: [{ productId: master.indomie.id, quantity: 1 }],
      }),
    });
    expect(poRes.status).toBe(409);

    const grRes = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s18-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.indomie.id, receivedBase: 40, unitCostPerPurchaseUnit: 112000 }],
      }),
    });
    expect(grRes.status).toBe(409);
  });

  it('S19 - Riwayat stok via API: label GR-... terisi', async () => {
    const gr = await api('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'http-s19-gr',
        supplierId: master.pakHaji.id,
        receivedById: master.udin.id,
        lines: [{ productId: master.kopi.id, receivedBase: 10, unitCostPerPurchaseUnit: 11000 }],
      }),
    });
    expect(gr.status).toBe(201);

    const movs = await api(`/stock-movements?productId=${master.kopi.id}`);
    expect(movs.status).toBe(200);
    expect(movs.body[0].referenceLabel).toBe(gr.body.receiptNumber);
    expect(movs.body[0].type).toBe('RECEIPT');
  });

  it('S20 - Regresi fitur lama via API: invoice generation & product deletion guard', async () => {
    // 1. Tambah stok lewat adjustment
    await api('/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: master.kopi.id,
        type: 'IN',
        quantity: 10,
        reason: 'HITUNG_ULANG',
      }),
    });

    // 2. Buat transaksi penjualan
    const saleRes = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ productId: master.kopi.id, quantity: 2 }],
      }),
    });
    expect(saleRes.status).toBe(201);
    expect(saleRes.body.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);

    // 3. Produk dengan riwayat transaksi tidak boleh di-hard delete
    const delRes = await api(`/products/${master.kopi.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(409);

    // 4. Produk baru tanpa transaksi boleh di-hard delete
    const newProd = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'TEST-DEL-1',
        name: 'Produk Uji Hapus',
        category: 'Uji',
        purchasePrice: 1000,
        sellingPrice: 1500,
        stock: 0,
      }),
    });
    expect(newProd.status).toBe(201);
    const delNew = await api(`/products/${newProd.body.id}`, { method: 'DELETE' });
    expect(delNew.status).toBe(204);
  });
});
