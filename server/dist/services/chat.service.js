"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const db_js_1 = require("../lib/db.js");
const errors_js_1 = require("../lib/errors.js");
const db_health_js_1 = require("../lib/db-health.js");
const in_memory_chat_js_1 = require("../lib/in-memory-chat.js");
class ChatService {
    /**
     * Helper pairKey unik agar dua orang membuka chat dua kali mengarah ke percakapan yang sama (K5)
     */
    static generatePairKey(userAId, userBId) {
        return [userAId, userBId].sort().join(":");
    }
    /**
     * Membuka atau mendapatkan percakapan yang sudah ada antara 2 pengguna (K5)
     */
    static async getOrCreateConversation(initiatorUserId, targetUserId) {
        if (initiatorUserId === targetUserId) {
            throw new errors_js_1.ConflictError("Tidak bisa membuat percakapan dengan diri sendiri");
        }
        if (!(0, db_health_js_1.getDatabaseStatus)()) {
            const userA = { id: initiatorUserId, name: 'Pengguna', username: 'user', role: 'PEMILIK' };
            const userB = { id: targetUserId, name: 'Mitra', username: 'mitra', role: 'STAF' };
            return (0, in_memory_chat_js_1.getOrCreateMemoryConversation)(userA, userB);
        }
        try {
            // Pastikan kedua pengguna ada
            const users = await db_js_1.db.user.findMany({
                where: { id: { in: [initiatorUserId, targetUserId] } },
            });
            if (users.length < 2) {
                throw new errors_js_1.NotFoundError("Salah satu pengguna tidak ditemukan");
            }
            const pairKey = this.generatePairKey(initiatorUserId, targetUserId);
            let conversation = await db_js_1.db.conversation.findUnique({
                where: { pairKey },
                include: {
                    members: {
                        include: {
                            user: {
                                select: { id: true, name: true, username: true, role: true },
                            },
                        },
                    },
                },
            });
            if (!conversation) {
                conversation = await db_js_1.db.conversation.create({
                    data: {
                        pairKey,
                        members: {
                            create: [
                                { userId: initiatorUserId },
                                { userId: targetUserId },
                            ],
                        },
                    },
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: { id: true, name: true, username: true, role: true },
                                },
                            },
                        },
                    },
                });
            }
            return conversation;
        }
        catch (err) {
            console.warn('[Chat] DB error during getOrCreateConversation, using in-memory fallback:', err.message);
            const userA = { id: initiatorUserId, name: 'Pengguna', username: 'user', role: 'PEMILIK' };
            const userB = { id: targetUserId, name: 'Mitra', username: 'mitra', role: 'STAF' };
            return (0, in_memory_chat_js_1.getOrCreateMemoryConversation)(userA, userB);
        }
    }
    /**
     * Pengecekan anggota percakapan anti-IDOR (K8)
     */
    static async assertMember(conversationId, userId) {
        try {
            const member = await db_js_1.db.conversationMember.findUnique({
                where: {
                    conversationId_userId: {
                        conversationId,
                        userId,
                    },
                },
            });
            if (member)
                return member;
        }
        catch {
            // Fallback below
        }
        const memConv = (0, in_memory_chat_js_1.getMemoryConversation)(conversationId);
        if (memConv) {
            const memMember = memConv.members.find((m) => m.userId === userId);
            if (memMember)
                return memMember;
        }
        throw new errors_js_1.ForbiddenError("Anda bukan anggota dari percakapan ini (Akses Ditolak)");
    }
    /**
     * Menyimpan pesan ke database dengan idempotency clientMessageId (K6, K7)
     */
    static async sendMessage(conversationId, senderId, clientMessageId, body) {
        if (!(0, db_health_js_1.getDatabaseStatus)()) {
            const sender = { id: senderId, name: 'User', username: 'user' };
            return (0, in_memory_chat_js_1.sendMemoryMessage)(conversationId, sender, clientMessageId, body);
        }
        // 1. Cek keanggotaan anti-IDOR (K8)
        await this.assertMember(conversationId, senderId);
        try {
            // 2. Idempotency check: jika clientMessageId sudah ada untuk pengirim ini, return pesan yang sama (K7)
            const existing = await db_js_1.db.message.findUnique({
                where: {
                    senderId_clientMessageId: {
                        senderId,
                        clientMessageId,
                    },
                },
                include: {
                    sender: {
                        select: { id: true, name: true, username: true },
                    },
                },
            });
            if (existing) {
                return existing;
            }
            // 3. Simpan pesan baru secara atomik (Database SSOT)
            const [message] = await db_js_1.db.$transaction([
                db_js_1.db.message.create({
                    data: {
                        conversationId,
                        senderId,
                        clientMessageId,
                        body,
                    },
                    include: {
                        sender: {
                            select: { id: true, name: true, username: true },
                        },
                    },
                }),
                db_js_1.db.conversation.update({
                    where: { id: conversationId },
                    data: { lastMessageAt: new Date() },
                }),
            ]);
            return message;
        }
        catch (err) {
            console.warn('[Chat] DB error during sendMessage, saving to in-memory store:', err.message);
            const sender = { id: senderId, name: 'User', username: 'user' };
            return (0, in_memory_chat_js_1.sendMemoryMessage)(conversationId, sender, clientMessageId, body);
        }
    }
    /**
     * Mengambil riwayat pesan sejak kursor tertentu (K9)
     */
    static async getMessages(conversationId, userId, afterSeqId) {
        if (!(0, db_health_js_1.getDatabaseStatus)()) {
            return (0, in_memory_chat_js_1.getMemoryMessages)(conversationId, afterSeqId);
        }
        // Anti-IDOR (K8)
        await this.assertMember(conversationId, userId);
        try {
            const messages = await db_js_1.db.message.findMany({
                where: {
                    conversationId,
                    ...(afterSeqId ? { seqId: { gt: afterSeqId } } : {}),
                },
                include: {
                    sender: {
                        select: { id: true, name: true, username: true },
                    },
                },
                orderBy: { seqId: "asc" },
            });
            if (messages.length > 0)
                return messages;
        }
        catch {
            // Fallback
        }
        return (0, in_memory_chat_js_1.getMemoryMessages)(conversationId, afterSeqId);
    }
    /**
     * Mengambil daftar percakapan aktif milik seorang user
     */
    static async listUserConversations(userId) {
        if (!(0, db_health_js_1.getDatabaseStatus)()) {
            return (0, in_memory_chat_js_1.getMemoryConversationsForUser)(userId);
        }
        try {
            const list = await db_js_1.db.conversation.findMany({
                where: {
                    members: {
                        some: { userId },
                    },
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: { id: true, name: true, username: true, role: true },
                            },
                        },
                    },
                    messages: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            id: true,
                            body: true,
                            createdAt: true,
                            sender: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { lastMessageAt: "desc" },
            });
            if (list.length > 0)
                return list;
        }
        catch {
            // Fallback
        }
        return (0, in_memory_chat_js_1.getMemoryConversationsForUser)(userId);
    }
}
exports.ChatService = ChatService;
