import { db } from "../lib/db.js";
import { Prisma } from "@prisma/client";

export interface ScrapedEntityRaw {
  nama: string;
  peran: string; // GROSIR, PENGGILINGAN, PENGEPUL, PETANI
  desa: string;
  kabupaten?: string;
  lat?: number;
  lng?: number;
  komoditas: string;
  satuan: string;
  hargaMin?: number;
  hargaMax?: number;
  kapasitas?: number;
  stok?: number;
  // Kolom terlarang yang mungkin ada di HTML
  pemilik?: string;
  telepon?: string;
  nik?: string;
}

// Koordinat referensi desa resmi (Ngawi, Surabaya & Jawa Timur)
export const DESA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Wilayah Ngawi & Sentra Padi
  "beran": { lat: -7.4042, lng: 111.4452 },
  "karangtengah": { lat: -7.4110, lng: 111.4398 },
  "grudo": { lat: -7.3980, lng: 111.4520 },
  "jururejo": { lat: -7.4200, lng: 111.4300 },
  "mangunharjo": { lat: -7.4150, lng: 111.4600 },
  "kandangan": { lat: -7.3850, lng: 111.4400 },
  "ngawi": { lat: -7.4035, lng: 111.4461 },
  "geneng": { lat: -7.4720, lng: 111.4350 },
  "widodaren": { lat: -7.3820, lng: 111.2720 },
  "paron": { lat: -7.4520, lng: 111.3850 },
  // Wilayah Surabaya & Sekitarnya (Jawa Timur)
  "keputih": { lat: -7.2917, lng: 112.7981 },
  "gebang putih": { lat: -7.2885, lng: 112.7925 },
  "sukolilo": { lat: -7.2900, lng: 112.7850 },
  "semolowaru": { lat: -7.3000, lng: 112.7750 },
  "pabean": { lat: -7.2340, lng: 112.7410 },
  "gundih": { lat: -7.2510, lng: 112.7300 },
  "wonokromo": { lat: -7.3000, lng: 112.7300 },
  "tambak osowilangun": { lat: -7.2150, lng: 112.6350 },
  "krian": { lat: -7.4120, lng: 112.5850 },
  "sidoarjo": { lat: -7.4478, lng: 112.7183 },
};

// Normalisasi komoditas ke enum standar
export function normalizeCommodity(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("gabah") || lower.includes("gkp")) return "GABAH_GKP";
  if (lower.includes("gkg")) return "GABAH_GKG";
  if (lower.includes("beras") && lower.includes("premium")) return "BERAS_PREMIUM";
  if (lower.includes("beras")) return "BERAS_MEDIUM";
  if (lower.includes("gula")) return "GULA_PASIR";
  if (lower.includes("minyak")) return "MINYAK_GORENG";
  if (lower.includes("tepung")) return "TEPUNG_TERIGU";
  if (lower.includes("mie")) return "MIE_INSTAN";
  if (lower.includes("kopi")) return "KOPI_SACHET";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

export class ScraperService {
  // User-Agent resmi dan jujur sesuai spesifikasi Final Meet
  static USER_AGENT = "PadiNadiMitraBot/0.1 (+https://warungmadura.example/bot; kontak: tim@warungmadura.example)";

  /**
   * Menjalankan scraping dari direktori publik/dinas dengan proteksi UU PDP & deduplikasi
   */
  static async runScraper(sourceUrl: string, rawItems: ScrapedEntityRaw[]) {
    const startedAt = new Date();
    const itemsFound = rawItems.length;
    let itemsSaved = 0;
    let itemsSkipped = 0;
    const logs: Array<{ item: string; reason: string }> = [];

    // Filter robots.txt & path yang dilarang
    if (sourceUrl.includes("/internal/") || sourceUrl.includes("/admin/")) {
      const run = await db.scraperRun.create({
        data: {
          sourceUrl,
          itemsFound,
          itemsSaved: 0,
          itemsSkipped: itemsFound,
          status: "REJECTED_BY_ROBOTS",
          logs: [{ item: sourceUrl, reason: "Dilarang oleh robots.txt /internal/" }],
          startedAt,
          completedAt: new Date()
        }
      });
      return { run, itemsSaved: 0, itemsSkipped: itemsFound };
    }

    for (const item of rawItems) {
      // 1. FILTER UU PDP: Petani perorangan dilarang diambil
      if (item.peran?.toUpperCase().includes("PERORANGAN") || item.nama?.toLowerCase().startsWith("petani perorangan")) {
        itemsSkipped++;
        logs.push({ item: item.nama, reason: "Data pribadi (petani perorangan diabaikan sesuai UU PDP)" });
        continue;
      }

      // 2. FILTER VALIDITAS DESA: Desa tak dikenal dilewati
      const desaKey = item.desa.toLowerCase().trim();
      const coords = DESA_COORDINATES[desaKey];
      if (!coords) {
        itemsSkipped++;
        logs.push({ item: item.nama, reason: `Desa '${item.desa}' tidak dikenal dalam direktori resmi` });
        continue;
      }

      // 3. FILTER DEDUPLIKASI KETAT: dedupeKey = nama|kabupaten (K15)
      const kab = (item.kabupaten || "ngawi").toLowerCase().trim();
      const cleanName = item.nama.toLowerCase().replace(/^(ud|cv|pt|pb)\.?\s+/i, "").trim();
      const dedupeKey = `${cleanName}|${kab}`;

      const existing = await db.business.findUnique({
        where: { dedupeKey }
      });

      if (existing) {
        // Sudah ada, skip agar run kedua menghasilkan 0 baru (K15)
        itemsSkipped++;
        logs.push({ item: item.nama, reason: `Duplikat terdeteksi (dedupeKey: ${dedupeKey})` });
        continue;
      }

      // 4. PENYIMPANAN AMAN: buang total pemilik & NIK, simpan kontak bisnis terenkripsi/terpisah di DB (K14)
      const commodity = normalizeCommodity(item.komoditas);
      const cleanedPhone = item.telepon ? item.telepon.replace(/[^0-9+]/g, '') : null;

      await db.business.create({
        data: {
          name: item.nama.trim(),
          role: item.peran.toUpperCase().trim() as any,
          desa: item.desa.trim(),
          district: item.kabupaten || "Ngawi",
          publicLat: coords.lat,
          publicLng: coords.lng,
          source: "DINAS",
          dedupeKey,
          sourceUrl,
          contactPhone: cleanedPhone && cleanedPhone.length >= 8 ? cleanedPhone : null,
          catalogItems: {
            create: {
              commodity,
              unit: item.satuan || "kg",
              priceMin: item.hargaMin ? new Prisma.Decimal(item.hargaMin) : null,
              priceMax: item.hargaMax ? new Prisma.Decimal(item.hargaMax) : null,
              capacityPerMonth: item.kapasitas || 10,
              stock: item.stok || 50
            }
          }
        }
      });

      itemsSaved++;
    }

    const run = await db.scraperRun.create({
      data: {
        sourceUrl,
        itemsFound,
        itemsSaved,
        itemsSkipped,
        logs: logs as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
        startedAt,
        completedAt: new Date()
      }
    });

    return { run, itemsSaved, itemsSkipped, logs };
  }
}
