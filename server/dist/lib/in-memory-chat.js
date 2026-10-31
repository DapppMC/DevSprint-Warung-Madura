"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemoryConversationsForUser = getMemoryConversationsForUser;
exports.getMemoryConversation = getMemoryConversation;
exports.getOrCreateMemoryConversation = getOrCreateMemoryConversation;
exports.sendMemoryMessage = sendMemoryMessage;
exports.getMemoryMessages = getMemoryMessages;
const memoryConversations = new Map();
const memoryMessages = new Map();
let seqCounter = 1;
// Seed data percakapan default
function initDefaultMemoryChat() {
    if (memoryConversations.size > 0)
        return;
    const convId1 = 'conv-demo-keputih';
    const cakRofi = {
        id: 'user-cakrofi-demo-id',
        name: 'Cak Rofi',
        username: 'cakrofi',
        role: 'PEMILIK',
    };
    const mitraKeputih = {
        id: 'user-mitra-keputih-id',
        name: 'Toko Sembako Keputih Permai',
        username: 'mitra_keputih',
        role: 'STAF',
    };
    const initialMsg = {
        id: 'msg-demo-1',
        seqId: seqCounter++,
        conversationId: convId1,
        senderId: mitraKeputih.id,
        clientMessageId: 'welcome-1',
        body: 'Halo Cak Rofi! Stok beras premium Pandan Wangi & minyak goreng kemasan sudah ready di Keputih. Mau diantar berapa dus hari ini?',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        sender: mitraKeputih,
    };
    const conv1 = {
        id: convId1,
        pairKey: 'user-cakrofi-demo-id:user-mitra-keputih-id',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        members: [
            {
                id: 'mem-1',
                userId: cakRofi.id,
                conversationId: convId1,
                user: cakRofi,
            },
            {
                id: 'mem-2',
                userId: mitraKeputih.id,
                conversationId: convId1,
                user: mitraKeputih,
            },
        ],
        messages: [initialMsg],
    };
    memoryConversations.set(convId1, conv1);
    memoryMessages.set(convId1, [initialMsg]);
    // Percakapan internal Cak Rofi dengan Udin
    const convId2 = 'conv-demo-udin';
    const udin = {
        id: 'user-udin-demo-id',
        name: 'Udin',
        username: 'udin',
        role: 'STAF',
    };
    const udinMsg = {
        id: 'msg-demo-2',
        seqId: seqCounter++,
        conversationId: convId2,
        senderId: udin.id,
        clientMessageId: 'udin-1',
        body: 'Cak, barang masuk dari Indofood tadi sudah saya terima 2 dus mie goreng. Sudah saya cek fisiknya tidak ada yang penyok.',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        sender: udin,
    };
    const conv2 = {
        id: convId2,
        pairKey: 'user-cakrofi-demo-id:user-udin-demo-id',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        members: [
            { id: 'mem-3', userId: cakRofi.id, conversationId: convId2, user: cakRofi },
            { id: 'mem-4', userId: udin.id, conversationId: convId2, user: udin },
        ],
        messages: [udinMsg],
    };
    memoryConversations.set(convId2, conv2);
    memoryMessages.set(convId2, [udinMsg]);
}
initDefaultMemoryChat();
function getMemoryConversationsForUser(userId) {
    initDefaultMemoryChat();
    const result = [];
    for (const conv of memoryConversations.values()) {
        if (conv.members.some((m) => m.userId === userId)) {
            result.push(conv);
        }
    }
    return result;
}
function getMemoryConversation(id) {
    initDefaultMemoryChat();
    return memoryConversations.get(id) || null;
}
function getOrCreateMemoryConversation(userA, userB) {
    initDefaultMemoryChat();
    const pairKey = [userA.id, userB.id].sort().join(':');
    for (const conv of memoryConversations.values()) {
        if (conv.pairKey === pairKey) {
            return conv;
        }
    }
    const id = `conv-mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const conv = {
        id,
        pairKey,
        createdAt: now,
        updatedAt: now,
        members: [
            { id: `mem-${userA.id}`, userId: userA.id, conversationId: id, user: userA },
            { id: `mem-${userB.id}`, userId: userB.id, conversationId: id, user: userB },
        ],
        messages: [],
    };
    memoryConversations.set(id, conv);
    memoryMessages.set(id, []);
    return conv;
}
function sendMemoryMessage(conversationId, sender, clientMessageId, body) {
    initDefaultMemoryChat();
    const conv = memoryConversations.get(conversationId);
    const msgs = memoryMessages.get(conversationId) || [];
    const existing = msgs.find((m) => m.senderId === sender.id && m.clientMessageId === clientMessageId);
    if (existing)
        return existing;
    const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        seqId: seqCounter++,
        conversationId,
        senderId: sender.id,
        clientMessageId,
        body,
        createdAt: new Date().toISOString(),
        sender,
    };
    msgs.push(msg);
    memoryMessages.set(conversationId, msgs);
    if (conv) {
        conv.updatedAt = msg.createdAt;
        conv.messages = msgs.slice(-20);
    }
    return msg;
}
function getMemoryMessages(conversationId, afterSeqId) {
    initDefaultMemoryChat();
    const msgs = memoryMessages.get(conversationId) || [];
    if (afterSeqId !== undefined) {
        return msgs.filter((m) => m.seqId > afterSeqId);
    }
    return msgs;
}
