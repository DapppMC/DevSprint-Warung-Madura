"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearbyService = void 0;
const db_js_1 = require("../lib/db.js");
const errors_js_1 = require("../lib/errors.js");
const fallback_data_1 = require("../lib/fallback-data");
const db_health_js_1 = require("../lib/db-health.js");
class NearbyService {
    /**
     * Menghitung jarak menggunakan formula Haversine (km)
     */
    static calculateHaversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius Bumi dalam km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
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
    static getBoundingBox(lat, lon, radiusKm) {
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
    static async findNearby(query) {
        const radius = query.radiusKm || 25;
        const bbox = this.getBoundingBox(query.latitude, query.longitude, radius);
        let businesses = [];
        if (!(0, db_health_js_1.getDatabaseStatus)()) {
            businesses = fallback_data_1.FALLBACK_BUSINESSES.map((b) => ({
                ...b,
                catalogItems: b.catalog,
            }));
        }
        else {
            try {
                businesses = await db_js_1.db.business.findMany({
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
                (0, db_health_js_1.markDatabaseUp)();
            }
            catch (err) {
                console.warn('[Nearby] Database query failed, returning fallback businesses:', err.message);
                (0, db_health_js_1.markDatabaseDown)();
                businesses = fallback_data_1.FALLBACK_BUSINESSES.map((b) => ({
                    ...b,
                    catalogItems: b.catalog,
                }));
            }
        }
        const results = [];
        for (const b of businesses) {
            const dist = this.calculateHaversineKm(query.latitude, query.longitude, b.publicLat, b.publicLng);
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
                    catalog: (b.catalogItems || b.catalog || []).map((c) => ({
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
    static async getBusinessContact(businessId, userRole) {
        if (userRole !== "PEMILIK") {
            throw new errors_js_1.ForbiddenError("Hanya akun PEMILIK warung yang berhak membuka kontak langsung mitra sesuai UU PDP");
        }
        let b = null;
        try {
            b = await db_js_1.db.business.findUnique({
                where: { id: businessId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    contactPhone: true,
                    source: true,
                },
            });
        }
        catch (_err) {
            console.warn('[Nearby] DB error during getBusinessContact, checking fallback:', _err.message);
        }
        if (!b) {
            b = fallback_data_1.FALLBACK_BUSINESSES.find((item) => item.id === businessId);
        }
        if (!b) {
            throw new errors_js_1.NotFoundError("Mitra tidak ditemukan");
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
exports.NearbyService = NearbyService;
