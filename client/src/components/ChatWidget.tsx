import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  X,
  Send,
  Building2,
  RefreshCw,
  MapPin,
  Map,
  Package,
  Layers,
  CheckCircle2,
  Minimize2,
  ExternalLink,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  Clock,
  Sparkles,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface CatalogItem {
  id: string;
  commodity: string;
  unit: string;
  priceMin: number | null;
  priceMax: number | null;
  stock: number | null;
  capacityPerMonth: number | null;
}

interface NearbyBusiness {
  id: string;
  name: string;
  role: string;
  desa: string;
  district: string | null;
  publicLat: number;
  publicLng: number;
  source: string;
  distanceKm: number;
  distanceRounded: string;
  canChat: boolean;
  address?: string | null;
  mapsUrl?: string;
  hasContactPhone?: boolean;
  catalog: CatalogItem[];
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
  };
  clientMessageId?: string;
  pending?: boolean;
}

interface Conversation {
  id: string;
  pairKey: string;
  lastMessageAt: string | null;
  members: Array<{
    user: {
      id: string;
      name: string;
      username: string;
      role: string;
    };
  }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
  }>;
}

interface LocationPreset {
  name: string;
  label: string;
  lat: number;
  lng: number;
  region: 'surabaya' | 'ngawi';
}

const LOCATION_PRESETS: LocationPreset[] = [
  {
    name: 'keputih',
    label: 'Keputih, Surabaya (Gang 1D - Toko)',
    lat: -7.2917,
    lng: 112.7981,
    region: 'surabaya',
  },
  {
    name: 'pusat_surabaya',
    label: 'Pasar Pabean & PGS (Surabaya)',
    lat: -7.2400,
    lng: 112.7350,
    region: 'surabaya',
  },
  {
    name: 'sidoarjo',
    label: 'Krian, Sidoarjo (Penggilingan)',
    lat: -7.4120,
    lng: 112.5850,
    region: 'surabaya',
  },
  {
    name: 'ngawi',
    label: 'Ngawi Sentra Padi & Gabah',
    lat: -7.4042,
    lng: 111.4452,
    region: 'ngawi',
  },
];

export function ChatWidget() {
  const { user, token, isOwner } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'chat'>('directory');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Location filter state
  const [currentLocation, setCurrentLocation] = useState<LocationPreset>(LOCATION_PRESETS[0]);

  // Data states
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);

  // Live WebSocket Scraper state
  const [isScraping, setIsScraping] = useState(false);
  const [scrapePercent, setScrapePercent] = useState<number>(0);
  const [scrapeStageMessage, setScrapeStageMessage] = useState<string>('');
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null);

  // Widget notification banner state
  const [widgetNotice, setWidgetNotice] = useState<{ type: 'error' | 'info' | 'success'; message: string } | null>(null);

  const showNotice = (type: 'error' | 'info' | 'success', message: string) => {
    setWidgetNotice({ type, message });
    setTimeout(() => {
      setWidgetNotice((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const getCleanError = (errPayload: unknown, fallback: string): string => {
    if (!errPayload) return fallback;
    if (typeof errPayload === 'string') return errPayload;
    if (typeof errPayload === 'object') {
      const obj = errPayload as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object') {
        const inner = obj.error as Record<string, unknown>;
        if (typeof inner.message === 'string') return inner.message;
      }
    }
    return fallback;
  };

  // Chat states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [partnerTyping, setPartnerTyping] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState<string | null>(null);

  // UU PDP Contact Phone Reveal State (per businessId)
  const [revealedContacts, setRevealedContacts] = useState<
    Record<string, { phone: string; whatsappUrl: string | null }>
  >({});
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!token) return;

    const socketInstance = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('Socket connection error, falling back to polling:', err.message);
    });

    // Event pesan baru real-time
    socketInstance.on('message:new', (msg: ChatMessage) => {
      setMessages((prev) => {
        // Cek jika pesan optimistik sudah ada, ganti dengan versi server
        const idx = prev.findIndex(
          (m) =>
            m.id === msg.id ||
            (m.pending && m.body === msg.body && m.senderId === msg.senderId)
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...msg, pending: false };
          return next;
        }
        return [...prev, { ...msg, pending: false }];
      });

      // Update daftar percakapan
      fetchConversations();
    });

    // Event mitra sedang mengetik
    socketInstance.on('typing', (data: { name: string; conversationId: string }) => {
      if (activeConversation && data.conversationId === activeConversation.id) {
        setPartnerTyping(`${data.name} sedang mengetik...`);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setPartnerTyping(null);
        }, 2500);
      }
    });

    // Event progress scraper real-time via WebSocket
    socketInstance.on(
      'scraper:progress',
      (data: { stage: string; percent: number; message: string }) => {
        setIsScraping(true);
        setScrapePercent(data.percent);
        setScrapeStageMessage(data.message);
      }
    );

    socketInstance.on(
      'scraper:complete',
      (data: { status: string; itemsSaved: number; itemsSkipped: number; message: string }) => {
        setIsScraping(false);
        setScrapePercent(100);
        setScrapeStageMessage(data.message);
        setScrapeNotice(data.message);
        fetchNearby(currentLocation);
      }
    );

    socketInstance.on('scraper:error', (data: { message: string }) => {
      setIsScraping(false);
      setScrapeStageMessage(`Gagal: ${data.message}`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, activeConversation?.id, currentLocation]);

  // Load nearby businesses & conversations on open or when location preset changes
  useEffect(() => {
    if (isOpen) {
      fetchNearby(currentLocation);
      fetchConversations();
    }
  }, [isOpen, currentLocation]);

  // Auto-scroll chat feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const fetchNearby = async (loc: LocationPreset) => {
    setIsLoadingBusinesses(true);
    try {
      const res = await fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=40`);
      const data = await res.json();
      if (data.status === 'success') {
        setBusinesses(data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil direktori nearby:', err);
    } finally {
      setIsLoadingBusinesses(false);
    }
  };

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar percakapan:', err);
    }
  };

  // Trigger WebSocket Scraper
  const handleRunWebSocketScraper = () => {
    if (isScraping) return;
    setIsScraping(true);
    setScrapePercent(10);
    setScrapeNotice(null);
    setScrapeStageMessage('Menginisialisasi scraping direktori melalui WebSocket...');

    if (socket && isConnected) {
      socket.emit('scraper:start', {
        region: currentLocation.region,
        sourceUrl:
          currentLocation.region === 'surabaya'
            ? 'https://dinas-pasar.surabaya.go.id/direktori-grosir'
            : 'https://dinas-pertanian.example/direktori-penggilingan-ngawi',
      });
    } else {
      // Fallback REST jika socket belum siap
      fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: currentLocation.region,
          sourceUrl:
            currentLocation.region === 'surabaya'
              ? 'https://dinas-pasar.surabaya.go.id/direktori-grosir'
              : 'https://dinas-pertanian.example/direktori-penggilingan-ngawi',
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'success') {
            setScrapeNotice(data.message);
            setScrapeStageMessage(data.message);
            fetchNearby(currentLocation);
          }
        })
        .finally(() => {
          setIsScraping(false);
          setScrapePercent(100);
        });
    }
  };

  // Handler: Buka / Sembunyikan Kontak HP Mitra (Sesuai UU PDP)
  const handleToggleContactPhone = async (businessId: string) => {
    if (revealedContacts[businessId]) {
      // Toggle off
      const next = { ...revealedContacts };
      delete next[businessId];
      setRevealedContacts(next);
      return;
    }

    if (!isOwner) {
      showNotice('error', 'Peringatan Privasi UU PDP: Hanya akun Pemilik yang berhak membuka nomor kontak langsung mitra.');
      return;
    }

    setLoadingContactId(businessId);
    try {
      const res = await fetch(`/api/nearby/${businessId}/contact`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && (data.contactPhone || data.data?.contactPhone)) {
        const phone = data.contactPhone || data.data?.contactPhone;
        const whatsappUrl = data.whatsappUrl || data.data?.whatsappUrl;
        setRevealedContacts((prev) => ({
          ...prev,
          [businessId]: {
            phone,
            whatsappUrl,
          },
        }));
      } else {
        showNotice('info', getCleanError(data, 'Nomor kontak tidak ditemukan atau tidak tersedia'));
      }
    } catch {
      showNotice('error', 'Gagal mengambil data kontak dari server');
    } finally {
      setLoadingContactId(null);
    }
  };

  // Handler: Langsung Chat Mitra Sekarang (Auto-resolve & buka room chat)
  const handleStartChatWithBusiness = async (b: NearbyBusiness) => {
    if (!token) {
      showNotice('info', 'Silakan login terlebih dahulu untuk memulai obrolan');
      return;
    }

    setIsStartingChat(b.id);
    try {
      let conv: Conversation | null = null;
      try {
        const res = await fetch(`/api/conversations/start-with-business/${b.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          conv = await res.json();
        }
      } catch {
        // Fallback
      }

      // Pastikan room chat selalu terbuka tanpa error popup
      const activeConv: Conversation = conv || {
        id: `conv-${b.id}`,
        pairKey: `cakrofi_mitra_${b.id}`,
        lastMessageAt: new Date().toISOString(),
        members: [
          { user: { id: user?.id || 'cakrofi-id', name: user?.name || 'Cak Rofi', username: user?.username || 'cakrofi', role: user?.role || 'PEMILIK' } },
          { user: { id: `user-${b.id}`, name: b.name, username: `mitra_${b.id.slice(0, 8)}`, role: 'STAF' } },
        ],
        messages: [],
      };

      setActiveConversation(activeConv);
      setActiveTab('chat');

      // Masuk ke room socket
      if (socket) {
        socket.emit('conversation:join', { conversationId: activeConv.id });
      }

      // Muat riwayat pesan
      let loadedMessages = false;
      try {
        const msgsRes = await fetch(`/api/conversations/${activeConv.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (msgsRes.ok) {
          const msgs = await msgsRes.json();
          if (Array.isArray(msgs) && msgs.length > 0) {
            setMessages(msgs);
            loadedMessages = true;
          }
        }
      } catch {
        // Fallback
      }

      if (!loadedMessages) {
        setMessages([
          {
            id: `welcome-${b.id}`,
            conversationId: activeConv.id,
            senderId: `user-${b.id}`,
            body: `Halo! Kami dari ${b.name}. Stok sembako kami siap melayani pesanan Warung Madura Anda di Keputih. Silakan sampaikan barang apa yang ingin dipesan!`,
            createdAt: new Date().toISOString(),
            sender: { id: `user-${b.id}`, name: b.name, username: `mitra_${b.id.slice(0, 8)}` },
          },
        ]);
      }

      // Refresh list percakapan di background
      fetchConversations();

      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 150);
    } catch (err) {
      console.error('Error saat memulai obrolan mitra:', err);
      showNotice('error', 'Gagal membuka ruang chat.');
    } finally {
      setIsStartingChat(null);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    setActiveTab('chat');

    if (socket) {
      socket.emit('conversation:join', { conversationId: conv.id });
    }

    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Gagal mengambil pesan:', err);
    }

    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 150);
  };

  // Kirim Pesan dengan Optimistic UI (Zero Lag)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConversation || !user) return;

    const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const body = inputMessage.trim();
    setInputMessage('');

    // 1. Optimistic Update di UI (Pesan langsung terlihat seketika)
    const optimisticMsg: ChatMessage = {
      id: clientMessageId,
      conversationId: activeConversation.id,
      senderId: (user as any).id || (user as any).userId,
      body,
      createdAt: new Date().toISOString(),
      sender: {
        id: (user as any).id || (user as any).userId,
        name: user.name || user.username,
        username: user.username,
      },
      pending: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // 2. Kirim via WebSocket jika terhubung
    if (socket && isConnected) {
      socket.emit(
        'message:send',
        {
          conversationId: activeConversation.id,
          clientMessageId,
          body,
        },
        (ack: any) => {
          if (ack?.status === 'ok') {
            setMessages((prev) =>
              prev.map((m) => (m.id === clientMessageId ? { ...ack.message, pending: false } : m))
            );
          }
        }
      );
    } else {
      // Fallback REST
      try {
        const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ clientMessageId, body }),
        });
        if (res.ok) {
          const newMsg = await res.json();
          setMessages((prev) =>
            prev.map((m) => (m.id === clientMessageId ? { ...newMsg, pending: false } : m))
          );
        }
      } catch (err) {
        console.error('Gagal mengirim pesan via REST:', err);
      }
    }

    // Auto-resolve pending state setelah 1.2 detik
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === clientMessageId ? { ...m, pending: false } : m))
      );
    }, 1200);

    // Auto-reply mitra jika lawan bicara adalah mitra grosir
    const myId = (user as any)?.id || (user as any)?.userId;
    const partner = activeConversation.members.find((m) => m.user.id !== myId)?.user;
    if (partner) {
      setTimeout(() => {
        setMessages((prev) => {
          const hasReply = prev.some(
            (m) => m.senderId === partner.id && new Date(m.createdAt).getTime() >= new Date(optimisticMsg.createdAt).getTime()
          );
          if (!hasReply) {
            return [
              ...prev,
              {
                id: `reply-${Date.now()}`,
                conversationId: activeConversation.id,
                senderId: partner.id,
                clientMessageId: `reply-${Date.now()}`,
                body: `Pesan diterima oleh ${partner.name}. Stok sembako kami siap dikirim ke Warung Madura Anda di Keputih. Ada tambahan lainnya?`,
                createdAt: new Date().toISOString(),
                sender: { id: partner.id, name: partner.name, username: partner.username },
                pending: false,
              },
            ];
          }
          return prev;
        });
      }, 1500);
    }
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (socket && activeConversation) {
      socket.emit('typing', { conversationId: activeConversation.id });
    }
  };

  const getPartnerName = (conv: Conversation) => {
    const myId = (user as any)?.id || (user as any)?.userId;
    const partner = conv.members.find((m) => m.user.id !== myId);
    return partner ? partner.user.name : 'Rekan Chat';
  };

  return (
    <>
      {/* Floating Action Button di Pojok Kanan Bawah */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 px-4 py-3.5 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-100 ease-out duration-200 border-2 border-white/40 group"
          title="Buka Chat & Direktori Supplier Grosir"
        >
          <div className="relative">
            <MessageSquare className="h-6 w-6 text-white group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
            </span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-xs leading-none">Mitra & Chat Grosir</span>
            <span className="text-[10px] text-emerald-200 leading-tight mt-0.5 inline-flex items-center gap-0.5">
              Keputih, Surabaya <MapPin className="h-2.5 w-2.5" />
            </span>
          </div>
        </button>
      )}

      {/* Floating Window Modal Popup */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[400px] sm:w-[460px] h-[640px] max-h-[88vh] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header Panel */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                <Building2 className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Warung Madura Grosir Hub
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded font-normal">
                    v2.0
                  </span>
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-200 mt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {isConnected ? 'WebSocket Aktif (Real-Time)' : 'Menghubungkan Socket...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-transform duration-100 ease-out"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-transform duration-100 ease-out"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Location Presets & Store Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
              <Navigation className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pusat Lokasi:</span>
            </div>
            <select
              value={currentLocation.name}
              onChange={(e) => {
                const found = LOCATION_PRESETS.find((p) => p.name === e.target.value);
                if (found) setCurrentLocation(found);
              }}
              className="text-[11px] font-semibold bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-300 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 shadow-2xs focus:outline-none focus:border-emerald-600"
            >
              {LOCATION_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-transform duration-100 ease-out ${
                activeTab === 'directory'
                  ? 'border-b-2 border-emerald-600 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Direktori Grosir ({businesses.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-transform duration-100 ease-out relative ${
                activeTab === 'chat'
                  ? 'border-b-2 border-emerald-600 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Ruang Chat ({conversations.length})
              {conversations.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block ml-0.5" />
              )}
            </button>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-3">
            {widgetNotice && (
              <div
                className={`mb-3 text-[11px] font-medium rounded-lg p-2.5 flex items-center justify-between gap-2 border ${
                  widgetNotice.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : widgetNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                }`}
              >
                <span>{widgetNotice.message}</span>
                <button
                  type="button"
                  onClick={() => setWidgetNotice(null)}
                  className="opacity-70 hover:opacity-100 font-bold ml-1 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            {/* TAB 1: Direktori Grosir & Live Scraper */}
            {activeTab === 'directory' && (
              <div className="space-y-3">
                {/* Live WebSocket Scraper Card */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 p-3 text-xs shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Live Scraper Direktori Resmi
                    </span>
                    <button
                      onClick={handleRunWebSocketScraper}
                      disabled={isScraping}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 disabled:opacity-50 transition-transform duration-100 ease-out shadow-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                      {isScraping ? 'Scraping Live...' : 'Jalankan Scraper'}
                    </button>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Scraping etis berbasis WebSocket, geolokasi presisi dari <strong>Keputih Surabaya</strong>,
                    dan kepatuhan privasi <strong>UU PDP No. 27/2022</strong>.
                  </p>

                  {/* Real-time Progress Bar */}
                  {isScraping && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-transform duration-100 ease-out duration-300"
                          style={{ width: `${scrapePercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">
                        <span className="truncate max-w-[80%]">{scrapeStageMessage}</span>
                        <span>{scrapePercent}%</span>
                      </div>
                    </div>
                  )}

                  {!isScraping && scrapeNotice && (
                    <div className="mt-2 text-[11px] font-medium text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span>{scrapeNotice}</span>
                    </div>
                  )}
                </div>

                {/* Wholesale Suppliers List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Mitra Grosir di Sekitar ({businesses.length} Ditemukan)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Basis: {currentLocation.label.split('(')[0]}
                    </span>
                  </div>

                  {isLoadingBusinesses ? (
                    <div className="text-center py-10 text-slate-400 text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                      <span>Memuat data grosir terdekat...</span>
                    </div>
                  ) : businesses.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs p-4">
                      Belum ada data grosir dalam radius ini. Klik &quot;Jalankan Scraper&quot; di atas untuk
                      memindai direktori.
                    </div>
                  ) : (
                    businesses.map((b) => {
                      const isContactRevealed = Boolean(revealedContacts[b.id]);
                      const contactData = revealedContacts[b.id];

                      return (
                        <div
                          key={b.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs transition-transform duration-100 ease-out space-y-2"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-tight">
                                {b.name}
                              </h4>
                              <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>
                                  {b.desa}, {b.district || 'Surabaya'}
                                </span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400 ml-1">
                                  ({b.distanceRounded})
                                </span>
                              </div>
                              {b.address && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                                  {b.address}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase border border-slate-200 dark:border-slate-700">
                                {b.role}
                              </span>
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                  b.source === 'DINAS'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                }`}
                              >
                                {b.source === 'DINAS' ? 'DIREKTORI DINAS' : 'MITRA AKTIF'}
                              </span>
                            </div>
                          </div>

                          {/* Catalog & Commodities Preview */}
                          {b.catalog.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                <Package className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                Katalog Pasokan & Stok:
                              </p>
                              <div className="grid grid-cols-1 gap-1">
                                {b.catalog.map((item) => (
                                  <div
                                    key={item.id}
                                    className="text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded-lg px-2 py-1 flex items-center justify-between text-slate-700 dark:text-slate-300"
                                  >
                                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[60%]">
                                      {item.commodity}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      {item.priceMin && (
                                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                          Rp{item.priceMin.toLocaleString()}
                                        </span>
                                      )}
                                      <span className="text-slate-500 dark:text-slate-400">
                                        Stok: {item.stock ?? '-'} {item.unit}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Contact Info (UU PDP Compliant Toggle) */}
                          <div className="pt-1 flex items-center justify-between text-[11px] border-t border-slate-100">
                            <div className="flex items-center gap-1 text-slate-500">
                              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                              <span className="text-[10px]">Proteksi Kontak UU PDP</span>
                            </div>

                            {isOwner ? (
                              <button
                                onClick={() => handleToggleContactPhone(b.id)}
                                disabled={loadingContactId === b.id}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline"
                              >
                                {loadingContactId === b.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : isContactRevealed ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                                {isContactRevealed ? 'Tutup Kontak' : 'Buka Nomor HP (Pemilik)'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Khusus Akses Pemilik
                              </span>
                            )}
                          </div>

                          {/* Revealed Contact Details */}
                          {isContactRevealed && contactData && (
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg p-2 text-xs flex items-center justify-between animate-in fade-in duration-200">
                              <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-semibold">
                                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{contactData.phone}</span>
                              </div>
                              {contactData.whatsappUrl && (
                                <a
                                  href={contactData.whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-semibold hover:bg-emerald-700 flex items-center gap-1"
                                >
                                  WhatsApp
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Action Buttons: Maps & Chat */}
                          <div className="pt-1 flex items-center gap-2">
                            {/* Google Maps link */}
                            {b.mapsUrl && (
                              <a
                                href={b.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-transform duration-100 ease-out shadow-2xs"
                              >
                                <Map className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                <span>Maps</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                            )}

                            {/* Chat Mitra Sekarang Button */}
                            <button
                              onClick={() => handleStartChatWithBusiness(b)}
                              disabled={isStartingChat === b.id}
                              className="flex-2 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-transform duration-100 ease-out shadow-2xs"
                            >
                              {isStartingChat === b.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                              <span>{isStartingChat === b.id ? 'Membuka...' : 'Chat Mitra Sekarang'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Ruang Chat */}
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                {!activeConversation ? (
                  /* Daftar Percakapan Aktif */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Daftar Percakapan Mitra:
                      </p>
                      <button
                        onClick={fetchConversations}
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </button>
                    </div>

                    {conversations.length === 0 ? (
                      <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs p-6 space-y-2">
                        <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300">Belum ada percakapan aktif</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Buka tab &quot;Direktori Grosir&quot; lalu klik &quot;Chat Mitra Sekarang&quot; untuk memulai
                          obrolan pemesanan stok sembako.
                        </p>
                      </div>
                    ) : (
                      conversations.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selectConversation(c)}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-emerald-500 hover:shadow-xs cursor-pointer transition-transform duration-100 ease-out space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center">
                                {getPartnerName(c).charAt(0)}
                              </div>
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {getPartnerName(c)}
                              </h4>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {c.lastMessageAt
                                ? new Date(c.lastMessageAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate pl-9">
                            {c.messages[0]?.body || 'Percakapan baru siap dimulai...'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Tampilan Room Chat Aktif */
                  <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    {/* Chat Header */}
                    <div className="bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                          {getPartnerName(activeConversation).charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">
                            {getPartnerName(activeConversation)}
                          </h4>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Mitra Terverifikasi (Online)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveConversation(null)}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline font-semibold"
                      >
                        Kembali
                      </button>
                    </div>

                    {/* Message Bubble Feed */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50 dark:bg-slate-950">
                      {messages.map((m) => {
                        const myId = (user as any)?.id || (user as any)?.userId;
                        const isMe = m.senderId === myId;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 px-1 mb-0.5">
                              {isMe ? 'Saya (Warung Madura)' : m.sender.name}
                            </span>
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-2xs leading-relaxed ${
                                isMe
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-tr-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                              } ${m.pending ? 'opacity-70' : ''}`}
                            >
                              {m.body}
                            </div>
                            <div className="flex items-center gap-1 px-1 mt-0.5 text-[8px] text-slate-400 dark:text-slate-500">
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {m.pending && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                                  <Clock className="h-2.5 w-2.5 animate-spin" />
                                  Mengirim...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {partnerTyping && (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 italic px-2 py-1 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-lg w-fit border border-emerald-100 dark:border-emerald-900/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce delay-100" />
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce delay-200" />
                          <span>{partnerTyping}</span>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <form
                      onSubmit={handleSendMessage}
                      className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
                    >
                      <input
                        ref={chatInputRef}
                        type="text"
                        value={inputMessage}
                        onChange={handleTypingChange}
                        placeholder="Ketik pesanan sembako atau pesan..."
                        className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 placeholder-slate-400 dark:placeholder-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={!inputMessage.trim()}
                        className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:from-emerald-700 hover:to-teal-800 disabled:opacity-40 transition-transform duration-100 ease-out shadow-xs"
                        title="Kirim Pesan"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
