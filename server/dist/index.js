"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// dotenv must load before anything that reads process.env (Prisma reads DATABASE_URL).
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config();
const app_1 = require("./app");
const db_1 = require("./lib/db");
const index_js_1 = require("./socket/index.js");
const port = Number(process.env.PORT ?? 4000);
const server = app_1.app.listen(port, '0.0.0.0', () => {
    console.log(`API berjalan di http://localhost:${port}`);
});
// Pasang WebSocket server (Socket.IO) untuk Real-time Chat
(0, index_js_1.initSocketServer)(server);
async function shutdown() {
    server.close();
    await db_1.db.$disconnect();
    process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
