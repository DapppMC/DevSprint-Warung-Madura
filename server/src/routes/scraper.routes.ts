import { Router, Request, Response, NextFunction } from "express";
import { ScraperService, ScrapedEntityRaw } from "../services/scraper.service.js";

const router = Router();

// Demo dataset yang meniru direktori resmi dinas (dengan kasus nyata: duplikat, komoditas kotor, kolom privat)
export const DEFAULT_DIRECTORY_DATA: ScrapedEntityRaw[] = [
  {
    nama: "PB. Tani Jaya",
    peran: "PENGGILINGAN",
    desa: "Beran",
    kabupaten: "Ngawi",
    komoditas: "Gabah Kering Panen (GKP)",
    satuan: "ton",
    hargaMin: 6800,
    hargaMax: 7200,
    kapasitas: 40,
    stok: 25,
    pemilik: "Haji Sutrisno (Dibuang oleh filter)",
    telepon: "081234567890 (Dibuang oleh filter)",
  },
  {
    nama: "UD Sri Makmur",
    peran: "PENGEPUL",
    desa: "Karangtengah",
    kabupaten: "Ngawi",
    komoditas: "Beras Premium IR64",
    satuan: "kg",
    hargaMin: 13500,
    hargaMax: 14200,
    kapasitas: 20,
    stok: 15,
  },
  {
    nama: "Grosir Berkah Sembako",
    peran: "GROSIR",
    desa: "Grudo",
    kabupaten: "Ngawi",
    komoditas: "Gula Pasir & Minyak Goreng",
    satuan: "dus",
    hargaMin: 175000,
    hargaMax: 185000,
    kapasitas: 100,
    stok: 80,
  },
  {
    nama: "Petani Perorangan · Pak Subur",
    peran: "PETANI PERORANGAN",
    desa: "Beran",
    kabupaten: "Ngawi",
    komoditas: "Gabah GKP",
    satuan: "ton",
    pemilik: "Subur",
  },
  {
    nama: "CV Beras Ngawi Sejahtera",
    peran: "PENGGILINGAN",
    desa: "Jururejo",
    kabupaten: "Ngawi",
    komoditas: "Beras Medium",
    satuan: "kg",
    hargaMin: 12000,
    hargaMax: 12500,
    kapasitas: 50,
    stok: 30,
  },
  {
    nama: "Kios Hantu Fiktif",
    peran: "GROSIR",
    desa: "Ds. Tidakada", // Desa tak dikenal
    kabupaten: "Ngawi",
    komoditas: "Beras",
    satuan: "kg",
  },
  {
    nama: "UD Sri Makmur", // Duplikat halaman 3 (K15)
    peran: "PENGEPUL",
    desa: "Karangtengah",
    kabupaten: "Ngawi",
    komoditas: "Beras Premium IR64",
    satuan: "kg",
  },
];

// Data direktori grosir & distributor resmi Surabaya & Jawa Timur
export const SURABAYA_DIRECTORY_DATA: ScrapedEntityRaw[] = [
  {
    nama: "Toko Sembako Keputih Permai",
    peran: "GROSIR",
    desa: "Keputih",
    kabupaten: "Surabaya",
    komoditas: "Beras Bramo & Minyak Goreng",
    satuan: "kg",
    hargaMin: 14500,
    hargaMax: 18000,
    kapasitas: 80,
    stok: 60,
    telepon: "081230112233",
  },
  {
    nama: "UD Sumber Rejeki Beras Sukolilo",
    peran: "PENGEPUL",
    desa: "Gebang Putih",
    kabupaten: "Surabaya",
    komoditas: "Beras Medium IR64",
    satuan: "kg",
    hargaMin: 12800,
    hargaMax: 13500,
    kapasitas: 50,
    stok: 35,
    telepon: "081331224455",
  },
  {
    nama: "Grosir Pangan Pasar Pabean Surabaya",
    peran: "GROSIR",
    desa: "Pabean",
    kabupaten: "Surabaya",
    komoditas: "Beras Setra Ramos & Sembako",
    satuan: "kg",
    hargaMin: 13500,
    hargaMax: 14000,
    kapasitas: 200,
    stok: 150,
    telepon: "081772334466",
  },
  {
    nama: "Pusat Grosir Surabaya (PGS) Mitra Sembako",
    peran: "GROSIR",
    desa: "Gundih",
    kabupaten: "Surabaya",
    komoditas: "Minyak Goreng & Tepung Terigu",
    satuan: "dus",
    hargaMin: 165000,
    hargaMax: 175000,
    kapasitas: 120,
    stok: 90,
    telepon: "081993445577",
  },
  {
    nama: "Pasar Induk Osowilangun (PIOS)",
    peran: "GROSIR",
    desa: "Tambak Osowilangun",
    kabupaten: "Surabaya",
    komoditas: "Beras Rojolele & Gula Pasir",
    satuan: "karung",
    hargaMin: 380000,
    hargaMax: 400000,
    kapasitas: 500,
    stok: 350,
    telepon: "081223344556",
  },
  {
    nama: "Penggilingan Padi & Gabah Makmur Krian",
    peran: "PENGGILINGAN",
    desa: "Krian",
    kabupaten: "Sidoarjo",
    komoditas: "Gabah Kering Panen (GKP)",
    satuan: "ton",
    hargaMin: 7200,
    hargaMax: 7600,
    kapasitas: 60,
    stok: 40,
    telepon: "081334455667",
  },
  {
    nama: "Petani Perorangan · Cak Slamet",
    peran: "PETANI PERORANGAN",
    desa: "Keputih",
    kabupaten: "Surabaya",
    komoditas: "Sayuran Segar",
    satuan: "ikat",
    pemilik: "Slamet",
    telepon: "081233445566",
  },
];

// Jalankan scraping
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceUrl = "https://dinas-pertanian.example/direktori-penggilingan", items, region } = req.body;
    
    let rawItems: ScrapedEntityRaw[];
    if (items) {
      rawItems = items;
    } else if (region === "surabaya" || sourceUrl.includes("surabaya")) {
      rawItems = SURABAYA_DIRECTORY_DATA;
    } else {
      rawItems = DEFAULT_DIRECTORY_DATA;
    }

    const result = await ScraperService.runScraper(sourceUrl, rawItems);
    res.json({
      status: "success",
      message: `Scraping selesai: ${result.itemsSaved} disimpan, ${result.itemsSkipped} dilewati.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// Ambil riwayat eksekusi scraper
router.get("/runs", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import("../lib/db.js");
    const runs = await db.scraperRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

export default router;
