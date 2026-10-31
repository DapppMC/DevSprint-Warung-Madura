import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../services/product.service';
import { idParamSchema } from '../validators/common.validator';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '../validators/product.validator';
import { requireAuth, requirePermission } from '../middleware/auth';
import { hasPermission } from '../services/permission.service';

// Route handlers stay thin: validate input with Zod, call a service, send the result.
export const productRouter = Router();

productRouter.get('/', requireAuth, async (req, res) => {
  const filter = listProductsQuerySchema.parse(req.query);
  const canViewCost = req.user ? await hasPermission(req.user.role, 'cost:view') : false;
  res.json(await listProducts(filter, { hidePurchasePrice: !canViewCost }));
});

productRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const canViewCost = req.user ? await hasPermission(req.user.role, 'cost:view') : false;
  res.json(await getProduct(id, { hidePurchasePrice: !canViewCost }));
});

productRouter.post('/', requireAuth, requirePermission('product:manage'), async (req, res) => {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await createProduct(input));
});

productRouter.patch('/:id', requireAuth, requirePermission('product:manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateProductSchema.parse(req.body);
  res.json(await updateProduct(id, input));
});

productRouter.delete('/:id', requireAuth, requirePermission('product:manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await deleteProduct(id);
  res.status(204).send();
});
