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

describe('Uji Blok C: Login + RBAC Matrix (C1 - C8)', () => {
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

  // ========================================================
  // C1: Pengguna Pemilik + Udin + Sari, PIN di-hash di DB
  // ========================================================
  it('C1 - PIN di-hash di database dan tidak terbaca plaintext', async () => {
    const cakRofi = await testDb.user.findUnique({ where: { username: 'cakrofi' } });
    const udin = await testDb.user.findUnique({ where: { username: 'udin' } });
    const sari = await testDb.user.findUnique({ where: { username: 'sari' } });

    expect(cakRofi).toBeTruthy();
    expect(udin).toBeTruthy();
    expect(sari).toBeTruthy();

    expect(cakRofi!.passwordHash).not.toBe('123456');
    expect(cakRofi!.passwordHash.startsWith('$2')).toBe(true); // bcrypt prefix

    expect(udin!.passwordHash).not.toBe('1111');
    expect(udin!.passwordHash.startsWith('$2')).toBe(true);

    expect(sari!.passwordHash).not.toBe('2222');
    expect(sari!.passwordHash.startsWith('$2')).toBe(true);
  });

  // ========================================================
  // C2: Login PIN (Benar -> identitas + peran, Salah -> pesan umum)
  // ========================================================
  it('C2 - Login PIN benar menghasilkan token + peran, PIN salah ditolak pesan umum', async () => {
    // Login Pemilik benar
    const resOwner = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cakrofi', pin: '123456' }),
    });
    expect(resOwner.status).toBe(200);
    expect(resOwner.body.token).toBeTruthy();
    expect((resOwner.body.user as JsonRecord).role).toBe('PEMILIK');

    // Login Staf benar
    const resStaff = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'udin', pin: '1111' }),
    });
    expect(resStaff.status).toBe(200);
    expect(resStaff.body.token).toBeTruthy();
    expect((resStaff.body.user as JsonRecord).role).toBe('STAF');
    expect((resStaff.body.user as JsonRecord).staffId).toBe(master.udin.id);

    // Login PIN salah
    const resWrong = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'udin', pin: '9999' }),
    });
    expect(resWrong.status).toBe(401);
    expect((resWrong.body.error as JsonRecord).message).toBe('Username atau password salah.');
  });

  // ========================================================
  // C3: Tanpa identitas valid -> 401 di semua endpoint terlindung
  // ========================================================
  it('C3 - Anonim tanpa identitas valid ditolak 401 (kecuali health)', async () => {
    // Health tetap bebas 200
    const health = await api('/health');
    expect(health.status).toBe(200);

    // Endpoint terlindung ditolak 401
    const p1 = await api('/products');
    expect(p1.status).toBe(401);

    const p2 = await api('/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({ productId: master.kopi.id, type: 'IN', quantity: 10, reason: 'HITUNG_ULANG' }),
    });
    expect(p2.status).toBe(401);

    const p3 = await api('/goods-receipts');
    expect(p3.status).toBe(401);

    const p4 = await api('/dashboard');
    expect(p4.status).toBe(401);

    // Token palsu/acak ditolak 401
    const fakeToken = await api('/products', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(fakeToken.status).toBe(401);
  });

  // ========================================================
  // C4: Otorisasi per peran, deny by default -> 403
  // ========================================================
  it('C4 - Staf ditolak 403 di aksi-aksi khusus Pemilik', async () => {
    const staffHeaders = { Authorization: `Bearer ${master.udinToken}` };

    // 1. Staf coba koreksi stok manual
    const resAdjust = await api('/stock-adjustments', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ productId: master.kopi.id, type: 'IN', quantity: 5, reason: 'HITUNG_ULANG' }),
    });
    expect(resAdjust.status).toBe(403);

    // 2. Staf coba buat PO
    const resPO = await api('/purchase-orders', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ supplierId: master.pakHaji.id, lines: [{ productId: master.indomie.id, quantity: 5 }] }),
    });
    expect(resPO.status).toBe(403);

    // 3. Staf coba ubah produk / harga
    const resProduct = await api(`/products/${master.indomie.id}`, {
      method: 'PATCH',
      headers: staffHeaders,
      body: JSON.stringify({ sellingPrice: 5000 }),
    });
    expect(resProduct.status).toBe(403);

    // 4. Staf coba hapus produk
    const resDel = await api(`/products/${master.indomie.id}`, {
      method: 'DELETE',
      headers: staffHeaders,
    });
    expect(resDel.status).toBe(403);

    // 5. Staf coba buat supplier
    const resSup = await api('/suppliers', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ name: 'Supplier Ilegal' }),
    });
    expect(resSup.status).toBe(403);

    // 6. Staf coba buat staf baru
    const resStaff = await api('/staff', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ name: 'Karyawan Baru' }),
    });
    expect(resStaff.status).toBe(403);
  });

  // ========================================================
  // C5: Penerima barang dari identitas login, bukan dari body
  // ========================================================
  it('C5 - Staf tidak bisa mengaku staf lain saat terima barang', async () => {
    const udinHeaders = { Authorization: `Bearer ${master.udinToken}` };

    // Udin mencoba memasukkan nama Sari sebagai penerima
    const resImpersonate = await api('/goods-receipts', {
      method: 'POST',
      headers: udinHeaders,
      body: JSON.stringify({
        idempotencyKey: 'idem-anti-impersonate-1',
        supplierId: master.pakHaji.id,
        receivedById: master.sari.id, // Sengaja mencatut ID Sari
        lines: [
          {
            productId: master.kopi.id,
            receivedBase: 20,
            unitCostPerPurchaseUnit: 14000,
          },
        ],
      }),
    });
    // Harus ditolak 403 Forbidden!
    expect(resImpersonate.status).toBe(403);

    // Udin menerima atas namanya sendiri
    const resValid = await api('/goods-receipts', {
      method: 'POST',
      headers: udinHeaders,
      body: JSON.stringify({
        idempotencyKey: 'idem-anti-impersonate-2',
        supplierId: master.pakHaji.id,
        lines: [
          {
            productId: master.kopi.id,
            receivedBase: 20,
            unitCostPerPurchaseUnit: 14000,
          },
        ],
      }),
    });
    expect(resValid.status).toBe(201);
    expect((resValid.body as JsonRecord).receivedById).toBe(master.udin.id);
  });

  // ========================================================
  // C6: Harga modal tidak muncul di response untuk Staf
  // ========================================================
  it('C6 - Harga modal disembunyikan dari response untuk role Staf', async () => {
    // 1. Pemilik panggil GET /products -> purchasePrice ada
    const resOwner = await api('/products', {
      headers: { Authorization: `Bearer ${master.ownerToken}` },
    });
    expect(resOwner.status).toBe(200);
    const ownerProducts = resOwner.body as unknown as Array<JsonRecord>;
    expect(ownerProducts[0].purchasePrice).toBeDefined();

    // 2. Staf panggil GET /products -> purchasePrice hilang / tidak ada
    const resStaff = await api('/products', {
      headers: { Authorization: `Bearer ${master.udinToken}` },
    });
    expect(resStaff.status).toBe(200);
    const staffProducts = resStaff.body as unknown as Array<JsonRecord>;
    expect(staffProducts[0].purchasePrice).toBeUndefined();

    // 3. Staf panggil Dashboard -> todaySalesTotal bernilai null
    const resDashStaff = await api('/dashboard', {
      headers: { Authorization: `Bearer ${master.udinToken}` },
    });
    expect(resDashStaff.status).toBe(200);
    expect((resDashStaff.body as JsonRecord).todaySalesTotal).toBeNull();
  });

  // ========================================================
  // Fitur Role Permission Manager (Dapat Mengatur Hak Akses)
  // ========================================================
  it('Role Permission Manager - Pemilik dapat melihat dan mengubah matriks izin', async () => {
    // 1. Ambil matriks izin saat ini
    const resMatrix = await api('/permissions', {
      headers: { Authorization: `Bearer ${master.ownerToken}` },
    });
    expect(resMatrix.status).toBe(200);
    expect((resMatrix.body as JsonRecord).permissions).toBeDefined();
    expect((resMatrix.body as JsonRecord).matrix).toBeDefined();

    // 2. Staf coba ubah izin -> 403 Forbidden
    const resStaffUpdate = await api('/permissions/STAF', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${master.udinToken}` },
      body: JSON.stringify({ permissions: ['stock:read', 'stock:adjust'] }),
    });
    expect(resStaffUpdate.status).toBe(403);

    // 3. Pemilik update izin Staf
    const resOwnerUpdate = await api('/permissions/STAF', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${master.ownerToken}` },
      body: JSON.stringify({ permissions: ['stock:read', 'goods_receipt:read'] }),
    });
    expect(resOwnerUpdate.status).toBe(200);
    expect(((resOwnerUpdate.body as JsonRecord).permissions as string[])).toEqual([
      'stock:read',
      'goods_receipt:read',
    ]);
  });

  // ========================================================
  // Pengujian Efek Nyata Dinamis: Toggle izin cost:view mengubah response Staf seketika
  // ========================================================
  it('Dynamic Permission Effect - Mengubah izin cost:view mengubah visibilitas modal untuk Staf secara instan', async () => {
    // 1. Secara default, Staf memanggil GET /products -> purchasePrice tidak ada (undefined)
    const resStaffInitial = await api('/products', {
      headers: { Authorization: `Bearer ${master.udinToken}` },
    });
    expect(resStaffInitial.status).toBe(200);
    const initialProducts = resStaffInitial.body as unknown as Array<JsonRecord>;
    expect(initialProducts[0].purchasePrice).toBeUndefined();

    // 2. Pemilik memberikan izin 'cost:view' kepada role STAF
    const resGrant = await api('/permissions/STAF', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${master.ownerToken}` },
      body: JSON.stringify({
        permissions: [
          'product:read',
          'cost:view',
          'stock:read',
          'goods_receipt:read',
          'goods_receipt:create',
          'sale:create',
        ],
      }),
    });
    expect(resGrant.status).toBe(200);

    // 3. Staf panggil GET /products LAGI -> purchasePrice SEKARANG MUNCUL (Bukan undefined lagi!)
    const resStaffWithCost = await api('/products', {
      headers: { Authorization: `Bearer ${master.udinToken}` },
    });
    expect(resStaffWithCost.status).toBe(200);
    const costAllowedProducts = resStaffWithCost.body as unknown as Array<JsonRecord>;
    expect(costAllowedProducts[0].purchasePrice).toBeDefined();
    expect(Number(costAllowedProducts[0].purchasePrice)).toBeGreaterThan(0);

    // 4. Pemilik mencabut kembali izin 'cost:view' dari role STAF
    const resRevoke = await api('/permissions/STAF', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${master.ownerToken}` },
      body: JSON.stringify({
        permissions: [
          'product:read',
          'stock:read',
          'goods_receipt:read',
          'goods_receipt:create',
          'sale:create',
        ],
      }),
    });
    expect(resRevoke.status).toBe(200);

    // 5. Staf panggil GET /products LAGI -> purchasePrice KEMBALI TERSEMBUNYI (undefined)
    const resStaffRevoked = await api('/products', {
      headers: { Authorization: `Bearer ${master.udinToken}` },
    });
    expect(resStaffRevoked.status).toBe(200);
    const revokedProducts = resStaffRevoked.body as unknown as Array<JsonRecord>;
    expect(revokedProducts[0].purchasePrice).toBeUndefined();
  });
});
