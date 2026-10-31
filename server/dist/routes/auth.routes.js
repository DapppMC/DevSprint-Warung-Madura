"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_validator_1 = require("../validators/auth.validator");
const auth_service_1 = require("../services/auth.service");
const auth_1 = require("../middleware/auth");
const errors_1 = require("../lib/errors");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/login', auth_1.loginRateLimiter, async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    try {
        const input = auth_validator_1.loginSchema.parse(req.body);
        const result = await (0, auth_service_1.login)(input);
        (0, auth_1.resetLoginAttempts)(ip);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errors_1.UnauthorizedError) {
            (0, auth_1.recordFailedLogin)(ip);
        }
        next(error);
    }
});
exports.authRouter.get('/me', auth_1.requireAuth, async (req, res) => {
    const user = await (0, auth_service_1.getMe)(req.user.userId);
    res.json(user);
});
