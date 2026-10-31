"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDatabaseAlive = isDatabaseAlive;
exports.markDatabaseDown = markDatabaseDown;
exports.markDatabaseUp = markDatabaseUp;
exports.getDatabaseStatus = getDatabaseStatus;
const db_1 = require("./db");
let isDbHealthy = true;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 30_000; // 30 detik
/**
 * Memeriksa apakah database aktif dan dapat dihubungi.
 * Menggunakan circuit-breaker dengan timeout agresif (1.5 detik)
 * agar server tidak pernah menggantung (hang) saat TCP pooler remote mati/paused.
 */
async function isDatabaseAlive() {
    const now = Date.now();
    // Jika status sebelumnya tidak sehat dan belum lewat interval, langsung kembalikan false
    if (!isDbHealthy && now - lastCheckTime < CHECK_INTERVAL_MS) {
        return false;
    }
    // Jika status sehat dan baru saja dicek, gunakan status cache
    if (isDbHealthy && now - lastCheckTime < 10_000) {
        return true;
    }
    try {
        const probePromise = db_1.db.$queryRaw `SELECT 1`;
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DATABASE_CONNECTION_TIMEOUT')), 1500));
        await Promise.race([probePromise, timeoutPromise]);
        isDbHealthy = true;
        lastCheckTime = now;
        return true;
    }
    catch (err) {
        console.warn('[CircuitBreaker] Database connection offline or timed out, activating fast fallback mode:', err.message);
        isDbHealthy = false;
        lastCheckTime = now;
        return false;
    }
}
/**
 * Tandai database offline segera setelah query pertama gagal
 */
function markDatabaseDown() {
    isDbHealthy = false;
    lastCheckTime = Date.now();
}
/**
 * Tandai database online segera setelah query berhasil
 */
function markDatabaseUp() {
    isDbHealthy = true;
    lastCheckTime = Date.now();
}
function getDatabaseStatus() {
    return isDbHealthy;
}
