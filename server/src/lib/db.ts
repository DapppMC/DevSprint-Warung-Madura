import { PrismaClient } from '@prisma/client';

let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && databaseUrl.includes('pooler.supabase.com') && !databaseUrl.includes('pgbouncer=true')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

// The one shared Prisma client. Every service imports `db` from here.
export const db = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  log: ['warn', 'error'],
});
