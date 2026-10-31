import { Router } from 'express';
import {
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../services/supplier.service';
import { idParamSchema } from '../validators/common.validator';
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '../validators/supplier.validator';
import { requireAuth, requirePermission } from '../middleware/auth';

export const supplierRouter = Router();

supplierRouter.get('/', requireAuth, async (_req, res) => {
  res.json(await listSuppliers());
});

supplierRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getSupplier(id));
});

supplierRouter.post('/', requireAuth, requirePermission('supplier:manage'), async (req, res) => {
  const input = createSupplierSchema.parse(req.body);
  res.status(201).json(await createSupplier(input));
});

supplierRouter.patch('/:id', requireAuth, requirePermission('supplier:manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateSupplierSchema.parse(req.body);
  res.json(await updateSupplier(id, input));
});
