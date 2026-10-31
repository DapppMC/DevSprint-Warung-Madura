import { Router } from 'express';
import {
  createStaff,
  getStaff,
  listStaff,
  updateStaff,
} from '../services/staff.service';
import { idParamSchema } from '../validators/common.validator';
import {
  createStaffSchema,
  updateStaffSchema,
} from '../validators/staff.validator';
import { requireAuth, requirePermission } from '../middleware/auth';

export const staffRouter = Router();

staffRouter.get('/', requireAuth, async (_req, res) => {
  res.json(await listStaff());
});

staffRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getStaff(id));
});

staffRouter.post('/', requireAuth, requirePermission('staff:manage'), async (req, res) => {
  const input = createStaffSchema.parse(req.body);
  res.status(201).json(await createStaff(input));
});

staffRouter.patch('/:id', requireAuth, requirePermission('staff:manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateStaffSchema.parse(req.body);
  res.json(await updateStaff(id, input));
});
