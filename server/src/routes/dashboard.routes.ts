import { Router } from 'express';
import { getDashboard } from '../services/dashboard.service';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from '../services/permission.service';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, async (req, res) => {
  const canViewFinancials = req.user ? await hasPermission(req.user.role, 'dashboard:financial') : false;
  res.json(await getDashboard({ maskFinancials: !canViewFinancials }));
});
