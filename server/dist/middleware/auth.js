"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.loginRateLimiter = loginRateLimiter;
exports.recordFailedLogin = recordFailedLogin;
exports.resetLoginAttempts = resetLoginAttempts;
const auth_crypto_1 = require("../lib/auth-crypto");
const errors_1 = require("../lib/errors");
const permission_service_1 = require("../services/permission.service");
function authenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7).trim();
    const payload = (0, auth_crypto_1.verifyToken)(token);
    if (payload) {
        req.user = payload;
    }
    next();
}
function requireAuth(req, _res, next) {
    if (!req.user) {
        throw new errors_1.UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
    }
    next();
}
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
        }
        if (!roles.includes(req.user.role)) {
            throw new errors_1.ForbiddenError('Anda tidak memiliki hak akses untuk aksi ini.');
        }
        next();
    };
}
function requirePermission(permissionId) {
    return async (req, _res, next) => {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('Autentikasi dibutuhkan. Silakan login terlebih dahulu.');
        }
        const allowed = await (0, permission_service_1.hasPermission)(req.user.role, permissionId);
        if (!allowed) {
            throw new errors_1.ForbiddenError(`Anda tidak memiliki hak akses untuk aksi ini (${permissionId}).`);
        }
        next();
    };
}
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const DEMO_CREDENTIALS = {
    cakrofi: ['123456'],
    udin: ['1111', '111111'],
    sari: ['2222', '222222'],
};
function loginRateLimiter(req, _res, next) {
    const body = req.body || {};
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
        }
        else if (entry.attempts >= MAX_ATTEMPTS) {
            throw new errors_1.TooManyRequestsError('Terlalu banyak percobaan login. Akun dikunci sementara, silakan coba lagi dalam 15 menit.');
        }
    }
    next();
}
function recordFailedLogin(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { attempts: 1, resetAt: now + WINDOW_MS });
    }
    else {
        entry.attempts += 1;
    }
}
function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}
