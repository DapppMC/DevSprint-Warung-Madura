import { Router } from 'express';
import { loginSchema } from '../validators/auth.validator';
import { login, getMe } from '../services/auth.service';
import { requireAuth, loginRateLimiter, recordFailedLogin, resetLoginAttempts } from '../middleware/auth';
import { UnauthorizedError } from '../lib/errors';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, async (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    resetLoginAttempts(ip);
    res.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      recordFailedLogin(ip);
    }
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await getMe(req.user!.userId);
  res.json(user);
});
