"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nearby_service_js_1 = require("../services/nearby.service.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
// Endpoint mencari mitra/grosir terdekat (K1, K2, K3, K4)
router.get("/", async (req, res, next) => {
    try {
        const lat = req.query.lat ? parseFloat(req.query.lat) : -7.4042; // Default Ngawi
        const lng = req.query.lng ? parseFloat(req.query.lng) : 111.4452;
        const radius = req.query.radius ? parseFloat(req.query.radius) : 25;
        const role = req.query.role;
        const commodity = req.query.commodity;
        const results = await nearby_service_js_1.NearbyService.findNearby({
            latitude: lat,
            longitude: lng,
            radiusKm: radius,
            role,
            commodity,
        });
        res.json({
            status: "success",
            total: results.length,
            center: { lat, lng, radiusKm: radius },
            data: results,
        });
    }
    catch (err) {
        next(err);
    }
});
// Endpoint membuka nomor kontak resmi mitra (Khusus peran PEMILIK sesuai UU PDP)
router.get("/:id/contact", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const businessId = req.params.id;
        const contact = await nearby_service_js_1.NearbyService.getBusinessContact(businessId, user.role);
        res.json({
            status: "success",
            data: contact,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
