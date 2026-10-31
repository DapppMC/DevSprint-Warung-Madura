import { db } from "../lib/db.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";
import { FALLBACK_BUSINESSES } from "../lib/fallback-data";
import { getDatabaseStatus, markDatabaseDown, markDatabaseUp } from "../lib/db-health.js";

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  role?: string;
  commodity?: string;
}

export interface NearbyBusinessResult {
  id: string;
  name: string;
  role: string;
  desa: string;
  district: string | null;
  publicLat: number;
  publicLng: number;
  source: string;
  distanceKm: number;
  distanceRounded: string; // "±X km" (K3: jarak bulat, tanpa lat/lng persis)
  canChat: boolean;        // false jika data DINAS (K4)
  address?: string | null;
  mapsUrl?: string;
  hasContactPhone?: boolean; // Tanda tersedia nomor di DB tanpa melanggar UU PDP
  catalog: Array<{
    id: string;
    commodity: string;
    unit: string;
    priceMin: number | null;
    priceMax: number | null;
    stock: number | null;
    capacityPerMonth: number | null;
  }>;
}

export class NearbyService {
  /**
   * Menghitung jarak menggunakan formula Haversine (km)
   */
  static calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius Bumi dalam km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Bounding box kasar untuk memfilter sebelum perhitungan Haversine
   */
  static getBoundingBox(lat: number, lon: number, radiusKm: number) {
    const latDelta = radiusKm / 111.0;
    const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lon - lonDelta,
      maxLng: lon + lonDelta,
    };
  }

  /**
   * Cari mitra terdekat dalam radius
   */
  static async findNearby(query: NearbyQuery): Promise<NearbyBusinessResult[]> {
    const radius = query.radiusKm || 25;
    const bbox = this.getBoundingBox(query.latitude, query.longitude, radius);

    let businesses: any[] = [];
    if (!getDatabaseStatus()) {
      businesses = FALLBACK_BUSINESSES.map((b) => ({
        ...b,
        catalogItems: b.catalog,
      }));
    } else {
      try {
        businesses = await db.business.findMany({
          where: {
            publicLat: {
              gte: bbox.minLat,
              lte: bbox.maxLat,
            },
            publicLng: {
              gte: bbox.minLng,
              lte: bbox.maxLng,
            },
            ...(query.role ? { role: query.role.toUpperCase() } : {}),
            ...(query.commodity
              ? {
                  catalogItems: {
                    some: {
                      commodity: {
                        contains: query.commodity.toUpperCase(),
                      },
                    },
                  },
                }
              : {}),
          },
          include: {
            catalogItems: true,
          },
        });
        markDatabaseUp();
      } catch (err) {
        console.warn(
          '[Nearby] Database query failed, returning fallback businesses:',
          (err as Error).message,
        );
        markDatabaseDown();
        businesses = FALLBACK_BUSINESSES.map((b) => ({
          ...b,
          catalogItems: b.catalog,
        }));
      }
    }

    const results: NearbyBusinessResult[] = [];

    for (const b of businesses) {
      const dist = this.calculateHaversineKm(
        query.latitude,
        query.longitude,
        b.publicLat,
        b.publicLng
      );

      // Filter ketat sesuai radius (K1)
      if (dist <= radius) {
        // Pembulatan jarak dan label (K3: tanpa lat/lng persis privat, jarak bulat)
        const roundedKm = Math.round(dist);
        const searchQuery = encodeURIComponent(`${b.name} ${b.address || b.desa || ''} ${b.district || ''}`);
        results.push({
          id: b.id,
          name: b.name,
          role: b.role,
          desa: b.desa,
          district: b.district,
          publicLat: b.publicLat,
          publicLng: b.publicLng,
          source: b.source,
          distanceKm: Number(dist.toFixed(1)),
          distanceRounded: `±${roundedKm} km`,
          canChat: b.source === "SELF" && Boolean(b.userId || b.id), // K4: data dinas tidak bisa dichat
          address: b.address || null,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${searchQuery}`,
          hasContactPhone: Boolean(b.contactPhone),
          catalog: (b.catalogItems || b.catalog || []).map((c: any) => ({
            id: c.id,
            commodity: c.commodity,
            unit: c.unit,
            priceMin: c.priceMin ? Number(c.priceMin) : null,
            priceMax: c.priceMax ? Number(c.priceMax) : null,
            stock: c.stock,
            capacityPerMonth: c.capacityPerMonth,
          })),
        });
      }
    }

    // Urutkan dari yang terdekat (K2)
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    return results;
  }

  /**
   * Mengambil kontak mitra secara aman (Hanya untuk peran PEMILIK sesuai UU PDP)
   */
  static async getBusinessContact(businessId: string, userRole: string) {
    if (userRole !== "PEMILIK") {
      throw new ForbiddenError("Hanya akun PEMILIK warung yang berhak membuka kontak langsung mitra sesuai UU PDP");
    }

    let b: any = null;
    try {
      b = await db.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          address: true,
          contactPhone: true,
          source: true,
        },
      });
    } catch (_err) {
      console.warn('[Nearby] DB error during getBusinessContact, checking fallback:', (_err as Error).message);
    }

    if (!b) {
      b = FALLBACK_BUSINESSES.find((item) => item.id === businessId);
    }

    if (!b) {
      throw new NotFoundError("Mitra tidak ditemukan");
    }

    const searchQuery = encodeURIComponent(`${b.name} ${b.address || ''}`);
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      contactPhone: b.contactPhone,
      whatsappUrl: b.contactPhone
        ? `https://wa.me/62${b.contactPhone.replace(/^0+/, '')}`
        : null,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${searchQuery}`,
    };
  }
}
