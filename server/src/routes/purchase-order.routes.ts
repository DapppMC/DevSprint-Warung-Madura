import { Router } from 'express';
import {
  cancelRemaining,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
} from '../services/purchase-order.service';
import { idParamSchema } from '../validators/common.validator';
import {
  cancelRemainingSchema,
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
} from '../validators/purchase-order.validator';
import { requireAuth, requirePermission } from '../middleware/auth';

export const purchaseOrderRouter = Router();

purchaseOrderRouter.get('/', requireAuth, async (req, res) => {
  const query = listPurchaseOrdersQuerySchema.parse(req.query);
  res.json(await listPurchaseOrders(query));
});

purchaseOrderRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getPurchaseOrder(id));
});

// Buat pesanan baru hanya boleh dilakukan oleh role dengan izin purchase_order:manage
purchaseOrderRouter.post('/', requireAuth, requirePermission('purchase_order:manage'), async (req, res) => {
  const input = createPurchaseOrderSchema.parse(req.body);
  res.status(201).json(await createPurchaseOrder(input));
});

// Tutup / batalkan sisa pesanan hanya boleh dilakukan oleh role dengan izin purchase_order:manage
purchaseOrderRouter.post('/:id/cancel-remaining', requireAuth, requirePermission('purchase_order:manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = cancelRemainingSchema.parse(req.body);
  res.json(await cancelRemaining(id, input));
});
