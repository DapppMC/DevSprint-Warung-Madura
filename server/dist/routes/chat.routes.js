"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_service_js_1 = require("../services/chat.service.js");
const auth_js_1 = require("../middleware/auth.js");
const db_js_1 = require("../lib/db.js");
const auth_crypto_js_1 = require("../lib/auth-crypto.js");
const fallback_data_js_1 = require("../lib/fallback-data.js");
const in_memory_chat_js_1 = require("../lib/in-memory-chat.js");
const db_health_js_1 = require("../lib/db-health.js");
const router = (0, express_1.Router)();
// Semua rute chat memerlukan login
router.use(auth_js_1.requireAuth);
// Ambil daftar percakapan aktif milik user
router.get("/", async (req, res, next) => {
    try {
        const user = req.user;
        const conversations = await chat_service_js_1.ChatService.listUserConversations(user.userId);
        res.json(conversations);
    }
    catch (err) {
        next(err);
    }
});
// Mulai percakapan baru atau buka yang sudah ada dengan targetUserId (K5)
router.post("/", async (req, res, next) => {
    try {
        const user = req.user;
        const { targetUserId } = req.body;
        if (!targetUserId) {
            res.status(400).json({ error: { message: "targetUserId wajib disertakan" } });
            return;
        }
        const conversation = await chat_service_js_1.ChatService.getOrCreateConversation(user.userId, targetUserId);
        res.json(conversation);
    }
    catch (err) {
        next(err);
    }
});
// Mulai percakapan langsung dengan Mitra Grosir / Supplier berdasarkan businessId
router.post("/start-with-business/:businessId", async (req, res, next) => {
    try {
        const user = req.user;
        const businessId = req.params.businessId;
        let business = null;
        if ((0, db_health_js_1.getDatabaseStatus)()) {
            try {
                business = await db_js_1.db.business.findUnique({
                    where: { id: businessId },
                    include: { user: true },
                });
            }
            catch {
                // Fallback below
            }
        }
        if (!business) {
            business = fallback_data_js_1.FALLBACK_BUSINESSES.find((b) => b.id === businessId);
        }
        if (!business) {
            res.status(404).json({ error: { message: "Mitra / Bisnis tidak ditemukan" } });
            return;
        }
        let partnerUserId = business.userId;
        if (!partnerUserId) {
            partnerUserId = `user-mitra-${business.id}`;
            if ((0, db_health_js_1.getDatabaseStatus)()) {
                try {
                    const sanitizedUsername = `mitra_${business.id.slice(0, 8)}`;
                    let partnerUser = await db_js_1.db.user.findUnique({ where: { username: sanitizedUsername } });
                    if (!partnerUser) {
                        partnerUser = await db_js_1.db.user.create({
                            data: {
                                username: sanitizedUsername,
                                name: business.name,
                                passwordHash: await (0, auth_crypto_js_1.hashPassword)("mitra12345"),
                                role: "STAF",
                                isActive: true,
                            },
                        });
                    }
                    partnerUserId = partnerUser.id;
                }
                catch {
                    partnerUserId = `user-mitra-${business.id}`;
                }
            }
        }
        const conversation = await chat_service_js_1.ChatService.getOrCreateConversation(user.userId, partnerUserId);
        // Kirim salam pembuka otomatis
        try {
            const initialGreeting = `Halo! Kami dari ${business.name}. Terima kasih sudah menghubungi kami melalui Warung Madura. Kami siap melayani pemesanan sembako, beras, atau barang grosir kebutuhan warung Anda. Silakan sampaikan barang yang ingin dipesan!`;
            const clientMessageId = `auto-welcome-${Date.now()}`;
            await chat_service_js_1.ChatService.sendMessage(conversation.id, partnerUserId, clientMessageId, initialGreeting);
        }
        catch {
            // Ignore greeting error
        }
        // Ambil percakapan lengkap dari DB jika tersedia
        if ((0, db_health_js_1.getDatabaseStatus)()) {
            try {
                const fullConv = await db_js_1.db.conversation.findUnique({
                    where: { id: conversation.id },
                    include: {
                        members: {
                            include: {
                                user: { select: { id: true, name: true, username: true, role: true } },
                            },
                        },
                        messages: {
                            take: 20,
                            orderBy: { createdAt: "asc" },
                            include: {
                                sender: { select: { id: true, name: true, username: true } },
                            },
                        },
                    },
                });
                if (fullConv) {
                    res.json(fullConv);
                    return;
                }
            }
            catch {
                // Fallback
            }
        }
        const memConv = (0, in_memory_chat_js_1.getMemoryConversation)(conversation.id);
        res.json(memConv || conversation);
    }
    catch (err) {
        next(err);
    }
});
// Ambil pesan dari suatu percakapan (K8, K9)
router.get("/:id/messages", async (req, res, next) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const afterSeqId = req.query.after ? parseInt(req.query.after, 10) : undefined;
        const messages = await chat_service_js_1.ChatService.getMessages(conversationId, user.userId, afterSeqId);
        res.json(messages);
    }
    catch (err) {
        next(err);
    }
});
// Kirim pesan lewat REST (K6, K7, K8)
router.post("/:id/messages", async (req, res, next) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { clientMessageId, body } = req.body;
        if (!clientMessageId || !body?.trim()) {
            res.status(400).json({ error: "clientMessageId dan body wajib diisi" });
            return;
        }
        const message = await chat_service_js_1.ChatService.sendMessage(conversationId, user.userId, clientMessageId, body.trim());
        res.status(201).json(message);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
