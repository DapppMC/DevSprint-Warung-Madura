"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && databaseUrl.includes('pooler.supabase.com') && !databaseUrl.includes('pgbouncer=true')) {
    databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
}
// The one shared Prisma client. Every service imports `db` from here.
exports.db = new client_1.PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    log: ['warn', 'error'],
});
