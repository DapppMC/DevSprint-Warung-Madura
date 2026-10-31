// dotenv must load before anything that reads process.env (Prisma reads DATABASE_URL).
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
import { app } from './app';
import { db } from './lib/db';
import { initSocketServer } from './socket/index.js';

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API berjalan di http://localhost:${port}`);
});

// Pasang WebSocket server (Socket.IO) untuk Real-time Chat
initSocketServer(server);

async function shutdown(): Promise<void> {
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
