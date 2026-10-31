import { Router } from 'express';
import { createSale, getSale, listSales } from '../services/sale.service';
import { idParamSchema } from '../validators/common.validator';
import { createSaleSchema } from '../validators/sale.validator';
import { requireAuth } from '../middleware/auth';

export const saleRouter = Router();

saleRouter.get('/', requireAuth, async (_req, res) => {
  res.json(await listSales());
});

saleRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getSale(id));
});

saleRouter.post('/', requireAuth, async (req, res) => {
  const input = createSaleSchema.parse(req.body);
  res.status(201).json(await createSale(input));
});
