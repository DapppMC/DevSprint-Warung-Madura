import { Router } from 'express';
import { z } from 'zod';
import { getPermissionsMatrix, updateRolePermissions } from '../services/permission.service';
import { requireAuth, requireRole } from '../middleware/auth';
import type { Role } from '@prisma/client';

export const permissionRouter = Router();

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

// GET /api/permissions -> Ambil daftar permission & matriks peran saat ini
permissionRouter.get('/', requireAuth, async (_req, res) => {
  const result = await getPermissionsMatrix();
  res.json(result);
});

// PUT /api/permissions/:role -> Pemilik mengubah izin untuk role tertentu
permissionRouter.put('/:role', requireAuth, requireRole('PEMILIK'), async (req, res) => {
  const rawRole = Array.isArray(req.params.role) ? req.params.role[0] : req.params.role;
  const role = (rawRole ? String(rawRole).toUpperCase() : '') as Role;
  if (role !== 'PEMILIK' && role !== 'STAF') {
    res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role tidak valid.' } });
    return;
  }

  const { permissions } = updatePermissionsSchema.parse(req.body);
  const updated = await updateRolePermissions(role, permissions);
  res.json({ role, permissions: updated });
});
