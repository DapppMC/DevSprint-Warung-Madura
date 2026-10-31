import { Router } from 'express';
import { adjustStock, listStockMovements } from '../services/stock.service';
import {
  listStockMovementsQuerySchema,
  stockAdjustmentSchema,
} from '../validators/stock.validator';
import { requireAuth, requirePermission } from '../middleware/auth';

export const stockRouter = Router();

// Koreksi stok manual hanya boleh dilakukan jika memiliki izin stock:adjust
stockRouter.post('/stock-adjustments', requireAuth, requirePermission('stock:adjust'), async (req, res) => {
  const input = stockAdjustmentSchema.parse(req.body);
  res.status(201).json(await adjustStock(input));
});

// Melihat riwayat stok boleh dilakukan jika memiliki izin stock:read
stockRouter.get('/stock-movements', requireAuth, requirePermission('stock:read'), async (req, res) => {
  const filter = listStockMovementsQuerySchema.parse(req.query);
  res.json(await listStockMovements(filter));
});
