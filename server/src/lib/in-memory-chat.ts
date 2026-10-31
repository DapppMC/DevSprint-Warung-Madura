export interface InMemoryMember {
  id: string;
  userId: string;
  conversationId: string;
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
  };
}

export interface InMemoryMessage {
  id: string;
  seqId: number;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
  };
}

export interface InMemoryConversation {
  id: string;
  pairKey: string;
  createdAt: string;
  updatedAt: string;
  members: InMemoryMember[];
  messages: InMemoryMessage[];
}

const memoryConversations = new Map<string, InMemoryConversation>();
const memoryMessages = new Map<string, InMemoryMessage[]>();
let seqCounter = 1;

// Seed data percakapan default
function initDefaultMemoryChat() {
  if (memoryConversations.size > 0) return;

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

  const initialMsg: InMemoryMessage = {
    id: 'msg-demo-1',
    seqId: seqCounter++,
    conversationId: convId1,
    senderId: mitraKeputih.id,
    clientMessageId: 'welcome-1',
    body: 'Halo Cak Rofi! Stok beras premium Pandan Wangi & minyak goreng kemasan sudah ready di Keputih. Mau diantar berapa dus hari ini?',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    sender: mitraKeputih,
  };

  const conv1: InMemoryConversation = {
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
  const udinMsg: InMemoryMessage = {
    id: 'msg-demo-2',
    seqId: seqCounter++,
    conversationId: convId2,
    senderId: udin.id,
    clientMessageId: 'udin-1',
    body: 'Cak, barang masuk dari Indofood tadi sudah saya terima 2 dus mie goreng. Sudah saya cek fisiknya tidak ada yang penyok.',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    sender: udin,
  };
  const conv2: InMemoryConversation = {
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

export function getMemoryConversationsForUser(userId: string): InMemoryConversation[] {
  initDefaultMemoryChat();
  const result: InMemoryConversation[] = [];
  for (const conv of memoryConversations.values()) {
    if (conv.members.some((m) => m.userId === userId)) {
      result.push(conv);
    }
  }
  return result;
}

export function getMemoryConversation(id: string): InMemoryConversation | null {
  initDefaultMemoryChat();
  return memoryConversations.get(id) || null;
}

export function getOrCreateMemoryConversation(
  userA: { id: string; name: string; username: string; role: string },
  userB: { id: string; name: string; username: string; role: string },
): InMemoryConversation {
  initDefaultMemoryChat();
  const pairKey = [userA.id, userB.id].sort().join(':');

  for (const conv of memoryConversations.values()) {
    if (conv.pairKey === pairKey) {
      return conv;
    }
  }

  const id = `conv-mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const conv: InMemoryConversation = {
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

export function sendMemoryMessage(
  conversationId: string,
  sender: { id: string; name: string; username: string },
  clientMessageId: string,
  body: string,
): InMemoryMessage {
  initDefaultMemoryChat();
  const conv = memoryConversations.get(conversationId);
  const msgs = memoryMessages.get(conversationId) || [];

  const existing = msgs.find(
    (m) => m.senderId === sender.id && m.clientMessageId === clientMessageId,
  );
  if (existing) return existing;

  const msg: InMemoryMessage = {
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

export function getMemoryMessages(
  conversationId: string,
  afterSeqId?: number,
): InMemoryMessage[] {
  initDefaultMemoryChat();
  const msgs = memoryMessages.get(conversationId) || [];
  if (afterSeqId !== undefined) {
    return msgs.filter((m) => m.seqId > afterSeqId);
  }
  return msgs;
}
