"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const permission_service_1 = require("../services/permission.service");
const auth_1 = require("../middleware/auth");
exports.permissionRouter = (0, express_1.Router)();
const updatePermissionsSchema = zod_1.z.object({
    permissions: zod_1.z.array(zod_1.z.string()),
});
// GET /api/permissions -> Ambil daftar permission & matriks peran saat ini
exports.permissionRouter.get('/', auth_1.requireAuth, async (_req, res) => {
    const result = await (0, permission_service_1.getPermissionsMatrix)();
    res.json(result);
});
// PUT /api/permissions/:role -> Pemilik mengubah izin untuk role tertentu
exports.permissionRouter.put('/:role', auth_1.requireAuth, (0, auth_1.requireRole)('PEMILIK'), async (req, res) => {
    const rawRole = Array.isArray(req.params.role) ? req.params.role[0] : req.params.role;
    const role = (rawRole ? String(rawRole).toUpperCase() : '');
    if (role !== 'PEMILIK' && role !== 'STAF') {
        res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role tidak valid.' } });
        return;
    }
    const { permissions } = updatePermissionsSchema.parse(req.body);
    const updated = await (0, permission_service_1.updateRolePermissions)(role, permissions);
    res.json({ role, permissions: updated });
});
