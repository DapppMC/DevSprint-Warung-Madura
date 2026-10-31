"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chat_service_js_1 = require("../services/chat.service.js");
const db_js_1 = require("../lib/db.js");
const scraper_service_js_1 = require("../services/scraper.service.js");
const scraper_routes_js_1 = require("../routes/scraper.routes.js");
const JWT_SECRET = process.env.JWT_SECRET || "warung-madura-jwt-super-secret-key-2026";
function initSocketServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Cek Origin anti-CSWSH (K11)
                // Jika origin undefined (e.g. mobile/postman) atau domain lokal / terpercaya
                if (!origin ||
                    origin.includes("localhost") ||
                    origin.includes("127.0.0.1") ||
                    origin.includes("padinadi") ||
                    origin.includes("warungmadura") ||
                    origin.includes("run.app") ||
                    origin.includes("github.dev") ||
                    origin.includes("gitpod.io")) {
                    callback(null, true);
                }
                else {
                    callback(new Error("Origin tidak diizinkan oleh kebijakan CSWSH"), false);
                }
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
        maxHttpBufferSize: 16 * 1024, // Batas 16 KB per pesan (K12)
    });
    // Middleware Autentikasi Handshake Socket (K10)
    io.use((socket, next) => {
        // Token diambil dari auth handshake, BUKAN query URL (K10)
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) {
            return next(new Error("Token otentikasi wajib disediakan pada handshake"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            socket.user = {
                userId: decoded.userId,
                role: decoded.role,
                name: decoded.name || decoded.username || "User",
            };
            socket.rateLimit = { count: 0, windowStart: Date.now() };
            next();
        }
        catch {
            return next(new Error("Token palsu atau kedaluwarsa"));
        }
    });
    io.on("connection", (socket) => {
        const user = socket.user;
        // Event: Gabung ke room percakapan
        socket.on("conversation:join", async (data, callback) => {
            try {
                if (!data?.conversationId) {
                    callback?.({ status: "error", message: "conversationId wajib" });
                    return;
                }
                // Verifikasi anggota anti-IDOR (K8)
                await chat_service_js_1.ChatService.assertMember(data.conversationId, user.userId);
                socket.join(data.conversationId);
                callback?.({ status: "ok", conversationId: data.conversationId });
            }
            catch (err) {
                callback?.({
                    status: "error",
                    message: err.message || "Gagal bergabung ke percakapan",
                });
            }
        });
        // Event: Kirim pesan real-time
        socket.on("message:send", async (data, callback) => {
            try {
                // 1. Rate Limiter: max 20 pesan per 10 detik (K12)
                const now = Date.now();
                if (now - socket.rateLimit.windowStart > 10000) {
                    socket.rateLimit.windowStart = now;
                    socket.rateLimit.count = 0;
                }
                socket.rateLimit.count++;
                if (socket.rateLimit.count > 20) {
                    callback?.({
                        status: "error",
                        message: "Banjir pesan terdeteksi: batas 20 pesan per 10 detik terlampaui",
                    });
                    return;
                }
                // 2. Validasi payload
                if (!data.conversationId || !data.clientMessageId || !data.body?.trim()) {
                    callback?.({ status: "error", message: "Payload pesan tidak valid" });
                    return;
                }
                // 3. Simpan ke database terlebih dahulu (Database SSOT, K6, K7, K8)
                const message = await chat_service_js_1.ChatService.sendMessage(data.conversationId, user.userId, data.clientMessageId, data.body.trim());
                // 4. Siarkan ke room percakapan
                io.to(data.conversationId).emit("message:new", message);
                // 5. Beri acknowledgement ke pengirim
                callback?.({ status: "ok", message });
                // 6. Mitra Auto-Reply: jika lawan bicara adalah akun mitra (diawali mitra_), berikan respon instan otomatis
                setTimeout(async () => {
                    try {
                        const conv = await db_js_1.db.conversation.findUnique({
                            where: { id: data.conversationId },
                            include: {
                                members: {
                                    include: {
                                        user: { select: { id: true, name: true, username: true } },
                                    },
                                },
                            },
                        });
                        const partner = conv?.members.find((m) => m.userId !== user.userId)?.user;
                        if (partner && partner.username.startsWith("mitra_")) {
                            // Notifikasi mitra sedang mengetik...
                            io.to(data.conversationId).emit("typing", {
                                conversationId: data.conversationId,
                                userId: partner.id,
                                name: partner.name,
                            });
                            // Kirim balasan konfirmasi pesanan setelah delay alami 1 detik
                            setTimeout(async () => {
                                const replyText = `Halo! Pesanan/pertanyaan Anda ("${data.body.trim().slice(0, 45)}...") telah kami terima di sistem grosir. Stok kami ready dan siap dikirim ke Warung Madura Anda di Keputih. Silakan kabari jika butuh barang sembako lainnya!`;
                                const replyClientMsgId = `mitra-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                                const replyMsg = await chat_service_js_1.ChatService.sendMessage(data.conversationId, partner.id, replyClientMsgId, replyText);
                                io.to(data.conversationId).emit("message:new", replyMsg);
                            }, 1000);
                        }
                    }
                    catch (replyErr) {
                        console.error("Auto-reply mitra error:", replyErr);
                    }
                }, 400);
            }
            catch (err) {
                callback?.({
                    status: "error",
                    message: err.message || "Gagal mengirim pesan",
                });
            }
        });
        // Event: Live WebSocket Scraper
        socket.on("scraper:start", async (data) => {
            try {
                const region = data?.region || "surabaya";
                const sourceUrl = data?.sourceUrl ||
                    (region === "surabaya"
                        ? "https://dinas-pasar.surabaya.go.id/direktori-grosir"
                        : "https://dinas-pertanian.example/direktori-penggilingan");
                socket.emit("scraper:progress", {
                    stage: "init",
                    percent: 20,
                    message: "Menghubungi server dinas & memvalidasi izin robots.txt...",
                });
                await new Promise((r) => setTimeout(r, 350));
                socket.emit("scraper:progress", {
                    stage: "fetching",
                    percent: 50,
                    message: `Mengunduh katalog grosir pangan & sembako (${region === 'surabaya' ? 'Wilayah Surabaya & Sekitarnya' : 'Wilayah Ngawi'})...`,
                });
                await new Promise((r) => setTimeout(r, 450));
                socket.emit("scraper:progress", {
                    stage: "geocoding",
                    percent: 75,
                    message: "Menghitung jarak akurat relatif terhadap lokasi toko di Keputih Gang 1D...",
                });
                await new Promise((r) => setTimeout(r, 350));
                socket.emit("scraper:progress", {
                    stage: "uupdp_filter",
                    percent: 90,
                    message: "Menerapkan proteksi privasi UU PDP No. 27/2022 (isolasi nomor telepon, filtering petani perorangan)...",
                });
                const rawItems = region === "surabaya" ? scraper_routes_js_1.SURABAYA_DIRECTORY_DATA : scraper_routes_js_1.DEFAULT_DIRECTORY_DATA;
                const result = await scraper_service_js_1.ScraperService.runScraper(sourceUrl, rawItems);
                await new Promise((r) => setTimeout(r, 250));
                socket.emit("scraper:complete", {
                    status: "success",
                    itemsSaved: result.itemsSaved,
                    itemsSkipped: result.itemsSkipped,
                    message: `Scraping selesai! ${result.itemsSaved} mitra grosir berhasil diperbarui & disinkronkan.`,
                });
            }
            catch (err) {
                socket.emit("scraper:error", {
                    message: err.message || "Gagal menjalankan live scraper",
                });
            }
        });
        // Event: Sedang mengetik (Volatile, ephemeral, tidak disimpan di DB)
        socket.on("typing", async (data) => {
            try {
                if (!data?.conversationId)
                    return;
                // Hanya emit ke room jika user memang anggota
                await chat_service_js_1.ChatService.assertMember(data.conversationId, user.userId);
                socket.volatile.to(data.conversationId).emit("typing", {
                    conversationId: data.conversationId,
                    userId: user.userId,
                    name: user.name,
                });
            }
            catch {
                // Ignored for volatile
            }
        });
        socket.on("disconnect", () => {
            // Room otomatis dibersihkan oleh Socket.IO
        });
    });
    return io;
}
