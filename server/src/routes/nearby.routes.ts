import { Router, Request, Response, NextFunction } from "express";
import { NearbyService } from "../services/nearby.service.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Endpoint mencari mitra/grosir terdekat (K1, K2, K3, K4)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : -7.4042; // Default Ngawi
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 111.4452;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 25;
    const role = req.query.role as string | undefined;
    const commodity = req.query.commodity as string | undefined;

    const results = await NearbyService.findNearby({
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
  } catch (err) {
    next(err);
  }
});

// Endpoint membuka nomor kontak resmi mitra (Khusus peran PEMILIK sesuai UU PDP)
router.get("/:id/contact", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const businessId = req.params.id as string;
    const contact = await NearbyService.getBusinessContact(businessId, user.role);
    res.json({
      status: "success",
      data: contact,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
