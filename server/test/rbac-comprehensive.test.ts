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
import { generateToken } from '../src/lib/auth-crypto';

describe('Role-Based Access Control (RBAC) & Security Hardening Test Suite', () => {
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
  // 1. UNPROTECTED VS PROTECTED ENDPOINTS (401 UNAUTHORIZED)
  // =========================================================================
  describe('1. Verifikasi Akses Tanpa Token / Token Tidak Valid (401)', () => {
    it('Semua endpoint bisnis menolak akses anonim dengan 401', async () => {
      const endpoints = [
        { path: '/products', method: 'GET' },
        { path: '/purchase-orders', method: 'GET' },
        { path: '/goods-receipts', method: 'GET' },
        { path: '/stock-movements', method: 'GET' },
        { path: '/dashboard', method: 'GET' },
        { path: '/permissions', method: 'GET' },
        { path: '/suppliers', method: 'GET' },
        { path: '/staff', method: 'GET' },
        { path: '/sales', method: 'GET' },
      ];

      for (const ep of endpoints) {
        const res = await api(ep.path, { method: ep.method });
        expect(res.status, `Endpoint ${ep.method} ${ep.path} harus menolak anonim dengan 401`).toBe(401);
      }
    });

    it('Token malformed atau token palsu ditolak dengan 401', async () => {
      const resMalformed = await api('/products', {
        headers: { Authorization: 'Bearer token-palsu-ngawur-12345' },
      });
      expect(resMalformed.status).toBe(401);

      const resNoBearer = await api('/products', {
        headers: { Authorization: 'Basic some-base64-credentials' },
      });
      expect(resNoBearer.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. STAF FORBIDDEN OPERATIONS (403 FORBIDDEN)
  // =========================================================================
  describe('2. Pembatasan Operasi Terlarang untuk Staf (403 Forbidden)', () => {
    it('Staf ditolak 403 saat mencoba mengubah hak akses role (permission:manage)', async () => {
      const res = await api('/permissions/STAF', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({ permissions: ['stock:read', 'cost:view'] }),
      });
      expect(res.status).toBe(403);
    });

    it('Staf ditolak 403 saat mencoba membuat PO baru tanpa izin purchase_order:manage', async () => {
      const res = await api('/purchase-orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({
          supplierId: master.pakHaji.id,
          lines: [{ productId: master.indomie.id, quantity: 2 }],
        }),
      });
      expect(res.status).toBe(403);
    });

    it('Staf ditolak 403 saat mencoba koreksi stok manual tanpa izin stock:adjust', async () => {
      const res = await api('/stock-adjustments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({
          productId: master.indomie.id,
          type: 'IN',
          quantity: 10,
          reason: 'HITUNG_ULANG',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('Staf ditolak 403 saat mencoba mengelola master produk tanpa izin product:manage', async () => {
      // 1. Tambah produk baru
      const resCreate = await api('/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({
          sku: 'NEW-001',
          name: 'Produk Baru Staf',
          category: 'Snack',
          purchasePrice: 1000,
          sellingPrice: 1500,
        }),
      });
      expect(resCreate.status).toBe(403);

      // 2. Hapus produk
      const resDelete = await api(`/products/${master.indomie.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${master.udinToken}` },
      });
      expect(resDelete.status).toBe(403);
    });

    it('Staf ditolak 403 saat mencoba memanipulasi master supplier & staff', async () => {
      const resSupplier = await api('/suppliers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({ name: 'Supplier Baru Ilegal' }),
      });
      expect(resSupplier.status).toBe(403);

      const resStaff = await api('/staff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({ name: 'Staf Baru Ilegal' }),
      });
      expect(resStaff.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. DATA MASKING (DYNAMIC RESPONSE MASKING)
  // =========================================================================
  describe('3. Sensor Finansial & Dynamic Response Masking', () => {
    it('Harga modal kulakan disensor dari respons produk jika tidak punya izin cost:view', async () => {
      // Staf Udin panggil GET /products
      const res = await api('/products', {
        headers: { Authorization: `Bearer ${master.udinToken}` },
      });
      expect(res.status).toBe(200);
      const products = res.body as unknown as Array<JsonRecord>;
      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.purchasePrice).toBeUndefined(); // Disensor!
      }

      // Pemilik Cak Rofi panggil GET /products -> harga modal ada
      const resOwner = await api('/products', {
        headers: { Authorization: `Bearer ${master.ownerToken}` },
      });
      expect(resOwner.status).toBe(200);
      const ownerProducts = resOwner.body as unknown as Array<JsonRecord>;
      expect(ownerProducts[0].purchasePrice).toBeDefined();
      expect(Number(ownerProducts[0].purchasePrice)).toBeGreaterThan(0);
    });

    it('Dashboard omset disensor (null) untuk Staf tanpa izin dashboard:financial', async () => {
      const resStaff = await api('/dashboard', {
        headers: { Authorization: `Bearer ${master.udinToken}` },
      });
      expect(resStaff.status).toBe(200);
      expect((resStaff.body as JsonRecord).todaySalesTotal).toBeNull();

      const resOwner = await api('/dashboard', {
        headers: { Authorization: `Bearer ${master.ownerToken}` },
      });
      expect(resOwner.status).toBe(200);
      expect((resOwner.body as JsonRecord).todaySalesTotal).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. ANTI-IMPERSONATION GUARD
  // =========================================================================
  describe('4. Proteksi Anti-Impersonasi Staf Penerima Barang', () => {
    it('Staf Udin DITOLAK 403 jika mencoba mencatat barang masuk atas nama Sari', async () => {
      const res = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({
          idempotencyKey: 'anti-impersonate-test-1',
          supplierId: master.pakHaji.id,
          receivedById: master.sari.id, // ID Sari, padahal yang login Udin!
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 40,
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });

      expect(res.status).toBe(403);
      expect(((res.body.error as JsonRecord).message as string)).toContain('Tidak dapat menerima barang atas nama staf lain');
    });

    it('Staf Udin BERHASIL 201 mencatat barang masuk atas nama dirinya sendiri', async () => {
      const res = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.udinToken}` },
        body: JSON.stringify({
          idempotencyKey: 'anti-impersonate-test-success',
          supplierId: master.pakHaji.id,
          receivedById: master.udin.id, // Sah: ID Udin sendiri
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 40,
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      expect((res.body as JsonRecord).receivedById).toBe(master.udin.id);
    });

    it('Pemilik Cak Rofi BEBAS memilih siapa saja sebagai penerima barang', async () => {
      const res = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${master.ownerToken}` },
        body: JSON.stringify({
          idempotencyKey: 'owner-free-staff-receipt-1',
          supplierId: master.pakHaji.id,
          receivedById: master.sari.id, // Pemilik menunjuk Sari
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 40,
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      expect((res.body as JsonRecord).receivedById).toBe(master.sari.id);
    });
  });

  // =========================================================================
  // 5. KEAMANAN SESI & PENGGUNA NONAKTIF
  // =========================================================================
  describe('5. Keamanan Sesi & Penonaktifan Pengguna', () => {
    it('Pengguna nonaktif ditolak saat mencoba login dengan pesan umum (anti-probing)', async () => {
      // Nonaktifkan user Udin
      await testDb.user.update({
        where: { id: master.udinUser.id },
        data: { isActive: false },
      });

      const resLogin = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'udin', pin: '1111' }),
      });

      expect(resLogin.status).toBe(401);
      expect(((resLogin.body.error as JsonRecord).message as string)).toBe('Username atau password salah.');
    });

    it('Pengguna dengan token valid tetapi staffId bukan miliknya tidak bisa bypass anti-impersonasi', async () => {
      // Buat token palsu yang memalsukan staffId
      const fakeToken = generateToken({
        userId: master.sariUser.id,
        username: master.sariUser.username,
        role: 'STAF',
        staffId: master.sari.id,
      });

      const res = await api('/goods-receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${fakeToken}` },
        body: JSON.stringify({
          idempotencyKey: 'fake-token-bypass-test',
          supplierId: master.pakHaji.id,
          receivedById: master.udin.id, // Mencoba menembus Udin
          lines: [
            {
              productId: master.indomie.id,
              receivedBase: 40,
              unitCostPerPurchaseUnit: 2800,
            },
          ],
        }),
      });

      expect(res.status).toBe(403);
    });
  });
});
