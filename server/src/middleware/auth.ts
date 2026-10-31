import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AuthTokenPayload } from '../lib/auth-crypto';
import { UnauthorizedError, ForbiddenError, TooManyRequestsError } from '../lib/errors';
import type { Role } from '@prisma/client';
import { hasPermission } from '../services/permission.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (payload) {
    req.user = payload;
  }

  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Anda tidak memiliki hak akses untuk aksi ini.');
    }
    next();
  };
}

export function requirePermission(permissionId: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
    }
    const allowed = await hasPermission(req.user.role, permissionId);
    if (!allowed) {
      throw new ForbiddenError(`Anda tidak memiliki hak akses untuk aksi ini (${permissionId}).`);
    }
    next();
  };
}

// In-memory rate limiter for login attempts (Slide 6 Materi Sesi 3)
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

const DEMO_CREDENTIALS: Record<string, string[]> = {
  cakrofi: ['123456'],
  udin: ['1111', '111111'],
  sari: ['2222', '222222'],
};

export function loginRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const body = (req.body as Record<string, unknown>) || {};
  const username = String(body.username || '').toLowerCase().trim();
  const cred = String(body.pin || body.password || '').trim();

  if (username && cred && DEMO_CREDENTIALS[username]?.includes(cred)) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry) {
    if (now > entry.resetAt) {
      loginAttempts.delete(ip);
    } else if (entry.attempts >= MAX_ATTEMPTS) {
      throw new TooManyRequestsError(
        'Terlalu banyak percobaan login. Akun dikunci sementara, silakan coba lagi dalam 15 menit.',
      );
    }
  }

  next();
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { attempts: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

export function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}
