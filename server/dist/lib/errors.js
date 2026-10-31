"use strict";
// Errors thrown by services. The error handler middleware turns them into HTTP responses.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TooManyRequestsError = exports.ForbiddenError = exports.UnauthorizedError = exports.ConflictError = exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = new.target.name;
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message = 'Data tidak ditemukan.') {
        super(404, 'NOT_FOUND', message);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(409, 'CONFLICT', message);
    }
}
exports.ConflictError = ConflictError;
class UnauthorizedError extends AppError {
    constructor(message = 'Autentikasi dibutuhkan. Silakan login terlebih dahulu.') {
        super(401, 'UNAUTHORIZED', message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Anda tidak memiliki hak akses untuk aksi ini.') {
        super(403, 'FORBIDDEN', message);
    }
}
exports.ForbiddenError = ForbiddenError;
class TooManyRequestsError extends AppError {
    constructor(message = 'Terlalu banyak percobaan. Silakan coba lagi nanti.') {
        super(429, 'TOO_MANY_REQUESTS', message);
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
