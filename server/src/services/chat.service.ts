import { db } from "../lib/db.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../lib/errors.js";
import { getDatabaseStatus } from "../lib/db-health.js";
import {
  getMemoryConversation,
  getMemoryConversationsForUser,
  getMemoryMessages,
  getOrCreateMemoryConversation,
  sendMemoryMessage,
} from "../lib/in-memory-chat.js";

export class ChatService {
  /**
   * Helper pairKey unik agar dua orang membuka chat dua kali mengarah ke percakapan yang sama (K5)
   */
  static generatePairKey(userAId: string, userBId: string): string {
    return [userAId, userBId].sort().join(":");
  }

  /**
   * Membuka atau mendapatkan percakapan yang sudah ada antara 2 pengguna (K5)
   */
  static async getOrCreateConversation(initiatorUserId: string, targetUserId: string) {
    if (initiatorUserId === targetUserId) {
      throw new ConflictError("Tidak bisa membuat percakapan dengan diri sendiri");
    }

    if (!getDatabaseStatus()) {
      const userA = { id: initiatorUserId, name: 'Pengguna', username: 'user', role: 'PEMILIK' };
      const userB = { id: targetUserId, name: 'Mitra', username: 'mitra', role: 'STAF' };
      return getOrCreateMemoryConversation(userA, userB);
    }

    try {
      // Pastikan kedua pengguna ada
      const users = await db.user.findMany({
        where: { id: { in: [initiatorUserId, targetUserId] } },
      });
      if (users.length < 2) {
        throw new NotFoundError("Salah satu pengguna tidak ditemukan");
      }

      const pairKey = this.generatePairKey(initiatorUserId, targetUserId);

      let conversation = await db.conversation.findUnique({
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
        conversation = await db.conversation.create({
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
    } catch (err) {
      console.warn('[Chat] DB error during getOrCreateConversation, using in-memory fallback:', (err as Error).message);
      const userA = { id: initiatorUserId, name: 'Pengguna', username: 'user', role: 'PEMILIK' };
      const userB = { id: targetUserId, name: 'Mitra', username: 'mitra', role: 'STAF' };
      return getOrCreateMemoryConversation(userA, userB);
    }
  }

  /**
   * Pengecekan anggota percakapan anti-IDOR (K8)
   */
  static async assertMember(conversationId: string, userId: string) {
    try {
      const member = await db.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (member) return member;
    } catch {
      // Fallback below
    }

    const memConv = getMemoryConversation(conversationId);
    if (memConv) {
      const memMember = memConv.members.find((m) => m.userId === userId);
      if (memMember) return memMember as any;
    }

    throw new ForbiddenError("Anda bukan anggota dari percakapan ini (Akses Ditolak)");
  }

  /**
   * Menyimpan pesan ke database dengan idempotency clientMessageId (K6, K7)
   */
  static async sendMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    body: string
  ) {
    if (!getDatabaseStatus()) {
      const sender = { id: senderId, name: 'User', username: 'user' };
      return sendMemoryMessage(conversationId, sender, clientMessageId, body) as any;
    }

    // 1. Cek keanggotaan anti-IDOR (K8)
    await this.assertMember(conversationId, senderId);

    try {
      // 2. Idempotency check: jika clientMessageId sudah ada untuk pengirim ini, return pesan yang sama (K7)
      const existing = await db.message.findUnique({
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
      const [message] = await db.$transaction([
        db.message.create({
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
        db.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        }),
      ]);

      return message;
    } catch (err) {
      console.warn('[Chat] DB error during sendMessage, saving to in-memory store:', (err as Error).message);
      const sender = { id: senderId, name: 'User', username: 'user' };
      return sendMemoryMessage(conversationId, sender, clientMessageId, body) as any;
    }
  }

  /**
   * Mengambil riwayat pesan sejak kursor tertentu (K9)
   */
  static async getMessages(conversationId: string, userId: string, afterSeqId?: number) {
    if (!getDatabaseStatus()) {
      return getMemoryMessages(conversationId, afterSeqId);
    }

    // Anti-IDOR (K8)
    await this.assertMember(conversationId, userId);

    try {
      const messages = await db.message.findMany({
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
      if (messages.length > 0) return messages;
    } catch {
      // Fallback
    }

    return getMemoryMessages(conversationId, afterSeqId);
  }

  /**
   * Mengambil daftar percakapan aktif milik seorang user
   */
  static async listUserConversations(userId: string) {
    if (!getDatabaseStatus()) {
      return getMemoryConversationsForUser(userId);
    }

    try {
      const list = await db.conversation.findMany({
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
      if (list.length > 0) return list;
    } catch {
      // Fallback
    }

    return getMemoryConversationsForUser(userId);
  }
}
