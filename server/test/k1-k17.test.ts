import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/app';
import { resetTestDatabase, testDb, assertTestDatabase } from './helpers/db-helper';
import { ScraperService, type ScrapedEntityRaw } from '../src/services/scraper.service';
import { ChatService } from '../src/services/chat.service';
import { generateToken, hashPassword } from '../src/lib/auth-crypto';

describe('Uji K1 - K17 (Pak Darto Gabah Marketplace & Real-Time Chat)', () => {
  let server: Server;
  let baseUrl: string;
  let userDarto: any;
  let userJoko: any;
  let userRina: any;
  let tokenDarto: string;
  let tokenJoko: string;
  let tokenRina: string;

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

    const pwdHash = await hashPassword('123456');

    userDarto = await testDb.user.create({
      data: {
        username: 'darto',
        name: 'Pak Darto',
        passwordHash: pwdHash,
        role: 'PEMILIK',
      },
    });

    userJoko = await testDb.user.create({
      data: {
        username: 'joko',
        name: 'Joko Pengepul',
        passwordHash: pwdHash,
        role: 'STAF',
      },
    });

    userRina = await testDb.user.create({
      data: {
        username: 'rina',
        name: 'Rina Pesaing',
        passwordHash: pwdHash,
        role: 'STAF',
      },
    });

    tokenDarto = generateToken({
      userId: userDarto.id,
      username: userDarto.username,
      role: userDarto.role,
      staffId: null,
    });

    tokenJoko = generateToken({
      userId: userJoko.id,
      username: userJoko.username,
      role: userJoko.role,
      staffId: null,
    });

    tokenRina = generateToken({
      userId: userRina.id,
      username: userRina.username,
      role: userRina.role,
      staffId: null,
    });
  });

  describe('K13 - K17: Scraper Sopan, Normalisasi & UU PDP', () => {
    const mockHtmlData: ScrapedEntityRaw[] = [
      {
        nama: 'PB. Tani Jaya',
        peran: 'PENGGILINGAN',
        desa: 'Beran',
        kabupaten: 'Ngawi',
        komoditas: 'Gabah Kering Panen (GKP)',
        satuan: 'ton',
        hargaMin: 6800,
        hargaMax: 7200,
        kapasitas: 40,
        stok: 25,
        pemilik: 'Haji Sutrisno (Data Pribadi)',
        telepon: '081234567890 (Data Pribadi)',
        nik: '3521000000000 (Data Pribadi)',
      },
      {
        nama: 'Petani Perorangan · Sutrisno',
        peran: 'PETANI PERORANGAN',
        desa: 'Beran',
        kabupaten: 'Ngawi',
        komoditas: 'Gabah',
        satuan: 'kg',
      },
      {
        nama: 'Kios Palsu',
        peran: 'GROSIR',
        desa: 'Ds. Tidakada', // Desa tak dikenal
        kabupaten: 'Ngawi',
        komoditas: 'Beras',
        satuan: 'kg',
      },
      {
        nama: 'UD Sri Makmur',
        peran: 'PENGEPUL',
        desa: 'Karangtengah',
        kabupaten: 'Ngawi',
        komoditas: 'Beras Premium',
        satuan: 'kg',
        hargaMin: 14000,
        hargaMax: 14500,
      },
      {
        nama: 'UD Sri Makmur', // Duplikat halaman 3
        peran: 'PENGEPUL',
        desa: 'Karangtengah',
        kabupaten: 'Ngawi',
        komoditas: 'Beras Premium',
        satuan: 'kg',
      },
    ];

    it('K13 - Scraper sopan: menolak URL internal dari robots.txt', async () => {
      const res = await ScraperService.runScraper('https://dinas.example/internal/data', mockHtmlData);
      expect(res.run.status).toBe('REJECTED_BY_ROBOTS');
      expect(res.itemsSaved).toBe(0);
    });

    it('K14 - Pemilik, telepon, NIK, dan perorangan tidak tersimpan (UU PDP)', async () => {
      const res = await ScraperService.runScraper('https://dinas.example/direktori', mockHtmlData);
      expect(res.itemsSaved).toBeGreaterThan(0);

      // Cek apakah ada data tersimpan yang menyimpan nama pemilik / telepon
      const businesses = await testDb.business.findMany();
      for (const b of businesses) {
        expect((b as any).pemilik).toBeUndefined();
        expect((b as any).telepon).toBeUndefined();
        expect((b as any).nik).toBeUndefined();
        expect(b.name.toLowerCase()).not.toContain('sutrisno');
      }
    });

    it('K15 - Dedupe: tidak dobel, run kedua 0 baru', async () => {
      // Run pertama
      const run1 = await ScraperService.runScraper('https://dinas.example/direktori', mockHtmlData);
      expect(run1.itemsSaved).toBe(2); // PB. Tani Jaya & UD Sri Makmur

      // Run kedua dengan data yang sama
      const run2 = await ScraperService.runScraper('https://dinas.example/direktori', mockHtmlData);
      expect(run2.itemsSaved).toBe(0); // 0 data baru tersimpan!
      expect(run2.itemsSkipped).toBe(mockHtmlData.length);
    });

    it('K16 - Normalisasi benar & desa tak dikenal dilewati', async () => {
      await ScraperService.runScraper('https://dinas.example/direktori', mockHtmlData);

      const items = await testDb.catalogItem.findMany();
      const commodities = items.map((i) => i.commodity);
      expect(commodities).toContain('GABAH_GKP');
      expect(commodities).toContain('BERAS_PREMIUM');

      // Desa tidak dikenal tidak ada di DB
      const unknownDesa = await testDb.business.findFirst({
        where: { desa: 'Ds. Tidakada' },
      });
      expect(unknownDesa).toBeNull();
    });

    it('K17 - Laporan run: riwayat tercatat dengan alasan dilewati', async () => {
      const res = await ScraperService.runScraper('https://dinas.example/direktori', mockHtmlData);
      expect(res.run.id).toBeDefined();
      expect(res.logs.length).toBeGreaterThan(0);
      expect(res.run.status).toBe('COMPLETED');
    });
  });

  describe('K1 - K4: Geospatial & Nearby Mitra', () => {
    beforeEach(async () => {
      // Seed data mitra
      // 1. Dekat (Beran Ngawi: ~0 km)
      await testDb.business.create({
        data: {
          name: 'PB. Sumber Rejeki (Pak Darto)',
          role: 'PENGGILINGAN',
          desa: 'Beran',
          district: 'Ngawi',
          publicLat: -7.4042,
          publicLng: 111.4452,
          latitude: -7.404212, // privat persis
          longitude: 111.445234, // privat persis
          source: 'SELF',
          userId: userDarto.id,
          dedupeKey: 'sumber rejeki|ngawi',
          catalogItems: {
            create: {
              commodity: 'GABAH_GKP',
              unit: 'ton',
              capacityPerMonth: 50,
              stock: 30,
            },
          },
        },
      });

      // 2. Dekat (Karangtengah: ~1.5 km) - Mitra Terdaftar
      await testDb.business.create({
        data: {
          name: 'UD Gabah Makmur (Joko)',
          role: 'PENGEPUL',
          desa: 'Karangtengah',
          district: 'Ngawi',
          publicLat: -7.4110,
          publicLng: 111.4398,
          source: 'SELF',
          userId: userJoko.id,
          dedupeKey: 'gabah makmur|ngawi',
          catalogItems: {
            create: {
              commodity: 'GABAH_GKP',
              unit: 'ton',
              capacityPerMonth: 20,
              stock: 15,
            },
          },
        },
      });

      // 3. Sedang (Widodaren: ~19 km) - Data Dinas Scraped
      await testDb.business.create({
        data: {
          name: 'Grosir Beras Widodaren',
          role: 'GROSIR',
          desa: 'Widodaren',
          district: 'Ngawi',
          publicLat: -7.3820,
          publicLng: 111.2720,
          source: 'DINAS',
          dedupeKey: 'beras widodaren|ngawi',
          catalogItems: {
            create: {
              commodity: 'BERAS_MEDIUM',
              unit: 'kg',
              stock: 500,
            },
          },
        },
      });

      // 4. Jauh (Surabaya: ~150 km)
      await testDb.business.create({
        data: {
          name: 'Gudang Beras Surabaya',
          role: 'GROSIR',
          desa: 'Wonokromo',
          district: 'Surabaya',
          publicLat: -7.3000,
          publicLng: 112.7300,
          source: 'DINAS',
          dedupeKey: 'beras surabaya|surabaya',
          catalogItems: {
            create: {
              commodity: 'BERAS_PREMIUM',
              unit: 'ton',
              stock: 1000,
            },
          },
        },
      });
    });

    it('K1 - Cari gabah 25 km: yang dekat muncul, yang jauh (>25 km) tidak', async () => {
      const res = await fetch(`${baseUrl}/nearby?lat=-7.4042&lng=111.4452&radius=25`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      const names = json.data.map((b: any) => b.name);
      expect(names).toContain('PB. Sumber Rejeki (Pak Darto)');
      expect(names).toContain('UD Gabah Makmur (Joko)');
      expect(names).toContain('Grosir Beras Widodaren');
      expect(names).not.toContain('Gudang Beras Surabaya'); // Terlalu jauh (>150 km)
    });

    it('K2 - Filter peran + komoditas, urut jarak', async () => {
      const res = await fetch(`${baseUrl}/nearby?lat=-7.4042&lng=111.4452&role=PENGEPUL&commodity=GABAH`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.data[0].name).toBe('UD Gabah Makmur (Joko)');
      expect(json.data[0].role).toBe('PENGEPUL');
    });

    it('K3 - Tanpa lat/lng persis & HP; jarak bulat', async () => {
      const res = await fetch(`${baseUrl}/nearby?lat=-7.4042&lng=111.4452`);
      expect(res.status).toBe(200);
      const json = await res.json();

      const dartoItem = json.data.find((b: any) => b.name.includes('Pak Darto'));
      expect(dartoItem).toBeDefined();
      // Latitude / Longitude persis tidak boleh ada di JSON output
      expect(dartoItem.latitude).toBeUndefined();
      expect(dartoItem.longitude).toBeUndefined();
      expect(dartoItem.phone).toBeUndefined();
      // Jarak harus berupa string bulat dengan format '±X km'
      expect(dartoItem.distanceRounded).toMatch(/^±\d+\s*km$/);
    });

    it('K4 - Data dinas berlabel, tidak bisa dichat', async () => {
      const res = await fetch(`${baseUrl}/nearby?lat=-7.4042&lng=111.4452`);
      expect(res.status).toBe(200);
      const json = await res.json();

      const dinasItem = json.data.find((b: any) => b.name === 'Grosir Beras Widodaren');
      const selfItem = json.data.find((b: any) => b.name.includes('Joko'));

      expect(dinasItem.source).toBe('DINAS');
      expect(dinasItem.canChat).toBe(false); // K4: Data dinas tidak bisa dichat

      expect(selfItem.source).toBe('SELF');
      expect(selfItem.canChat).toBe(true); // Mitra aktif bisa dichat
    });
  });

  describe('K5 - K12: Chat Real-Time & Security Matrix', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Darto memulai percakapan dengan Joko
      const conv = await ChatService.getOrCreateConversation(userDarto.id, userJoko.id);
      conversationId = conv.id;
    });

    it('K5 - Buka chat dua kali = percakapan sama (pairKey unik)', async () => {
      // Buka pertama kali lewat REST
      const res1 = await fetch(`${baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDarto}`,
        },
        body: JSON.stringify({ targetUserId: userJoko.id }),
      });
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      // Buka kedua kali
      const res2 = await fetch(`${baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDarto}`,
        },
        body: JSON.stringify({ targetUserId: userJoko.id }),
      });
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      expect(json1.id).toBe(json2.id);
      expect(json1.pairKey).toBe(json2.pairKey);
    });

    it('K6 & K7 - Pesan sampai, tersimpan di DB, dan idempotency clientMessageId', async () => {
      const clientMessageId = 'msg-uuid-12345';
      const body = 'Halo Pak Joko, ada gabah kering panen 10 ton?';

      // Kirim pertama kali
      const res1 = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDarto}`,
        },
        body: JSON.stringify({ clientMessageId, body }),
      });
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      expect(json1.body).toBe(body);
      expect(json1.clientMessageId).toBe(clientMessageId);

      // Kirim kedua kali dengan clientMessageId sama (retry / klik dobel)
      const res2 = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDarto}`,
        },
        body: JSON.stringify({ clientMessageId, body }),
      });
      expect(res2.status).toBe(201);
      const json2 = await res2.json();

      // Idempotency: mengembalikan pesan yang sama, tidak membuat baris kedua
      expect(json2.id).toBe(json1.id);

      const count = await testDb.message.count({
        where: { conversationId, clientMessageId },
      });
      expect(count).toBe(1);
    });

    it('K8 - Orang ketiga (Rina) ditolak membaca atau mengirim pesan (Anti-IDOR)', async () => {
      // 1. Rina coba baca pesan percakapan Darto-Joko
      const resRead = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${tokenRina}` },
      });
      expect(resRead.status).toBe(403);

      // 2. Rina coba kirim pesan ke percakapan Darto-Joko
      const resSend = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRina}`,
        },
        body: JSON.stringify({ clientMessageId: 'rina-hack', body: 'Menyusup chat' }),
      });
      expect(resSend.status).toBe(403);
    });

    it('K9 - Putus, sambung, ambil pesan sejak cursor seqId', async () => {
      // Darto kirim 3 pesan
      await ChatService.sendMessage(conversationId, userDarto.id, 'm1', 'Pesan 1');
      const m2 = await ChatService.sendMessage(conversationId, userDarto.id, 'm2', 'Pesan 2');
      await ChatService.sendMessage(conversationId, userDarto.id, 'm3', 'Pesan 3');

      // Joko reconnect, ambil pesan sejak m2 (cursor seqId)
      const res = await fetch(`${baseUrl}/conversations/${conversationId}/messages?after=${m2.seqId}`, {
        headers: { Authorization: `Bearer ${tokenJoko}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.length).toBe(1);
      expect(json[0].body).toBe('Pesan 3');
    });
  });
});
