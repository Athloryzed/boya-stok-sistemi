/**
 * MessengerPanel — Global FAB + Drawer ile gelen messenger arayüzü.
 * Premium endüstriyel temaya uyumlu, mobil-öncelikli, WCAG AAA.
 *
 * Features: 1:1 DM, grup kanalları, makine kanalları, hızlı şablonlar,
 *           emoji picker, dosya/foto ekleme, okundu/yazıyor/online,
 *           otomatik bot mesajları (Bobin/Boya istek vb.), Web Push.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, X, Users, Search, ArrowLeft, Smile, Paperclip,
  Bell, BellOff, Check, CheckCheck, Hash, Image as ImageIcon,
  CircleAlert, AtSign, ChevronDown, PlusCircle, FileText, Wifi, WifiOff, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { chatApi, connectChatWS, disconnectChatWS, onChatEvent, ensurePushSubscription } from "../../lib/messenger";
import { getSession, isSessionValid } from "../../lib/auth";

const EMOJIS = ["😊","😂","👍","❤️","🎉","🔥","✅","⚠️","🆘","🚀","💪","🙏","👏","✨","💯","☕","🍕","🤝","😴","🤔","😅","😎","🙌","💡","📦","🎨","🚚","🏭","🔧","📋","👷","👑","🆗","⏳","⚡"];

const ROLE_LABELS = { yonetim: "Yönetim", plan: "Plan", operator: "Operatör", depo: "Depo", sofor: "Sürücü" };
const ROLE_COLORS = { yonetim: "#FFD24C", plan: "#60A5FA", operator: "#34D399", depo: "#A78BFA", sofor: "#FB7185" };

function timeAgo(iso) {
  if (!iso) return "";
  try {
    const t = new Date(iso).getTime();
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 60) return "şimdi";
    if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} g`;
    return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch (_) { return ""; }
}

function timeShort(iso) {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch (_) { return ""; }
}

function formatBoldText(text) {
  // **bold** → <strong>
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-amber-300 font-bold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const MessengerPanel = () => {
  const session = isSessionValid() ? getSession() : null;
  const userId = session?.user_id || session?.id;
  const [open, setOpen] = useState(false);
  const [pushPermitted, setPushPermitted] = useState(false);

  // Conversations & users
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [view, setView] = useState("list"); // list | conversation | new-dm
  const [showEmojis, setShowEmojis] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [search, setSearch] = useState("");
  const [typingUsers, setTypingUsers] = useState({}); // {convId: {userId: name}}
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [presence, setPresence] = useState({}); // {userId: bool}
  const [readState, setReadState] = useState({}); // {convId: {userId: lastReadAt}}
  const [wsConnected, setWsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [groupFilter, setGroupFilter] = useState("all"); // all | dm | group | machine
  const [suggested, setSuggested] = useState([]); // Sık kullanılan kullanıcılar

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);

  // ─── Lifecycle ───
  useEffect(() => {
    if (!userId) return;
    loadConversations();
    loadUsers();
    loadTemplates();
    loadUnread();
    loadSuggested();

    // WebSocket
    const ws = connectChatWS();
    setWsConnected(!!ws);
    const off = onChatEvent(handleWsEvent);

    return () => {
      off();
      // Don't disconnect - might be needed by other panels (global state)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (open) {
      // Push abone et (kullanıcı drawer'ı ilk açtığında izin sorulur)
      ensurePushSubscription().then((res) => {
        if (res?.granted) setPushPermitted(true);
      });
    }
  }, [open]);

  useEffect(() => {
    // SW message: bildirime tıklayınca conversation aç
    const handler = (e) => {
      if (e.data?.type === "open_conversation" && e.data.data?.conversation_id) {
        setOpen(true);
        openConversation(e.data.data.conversation_id);
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
      return () => navigator.serviceWorker.removeEventListener("message", handler);
    }
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current && view === "conversation") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, view]);

  // Mark as read when active
  useEffect(() => {
    if (activeId && messages.length > 0 && view === "conversation") {
      const lastMsg = messages[messages.length - 1];
      chatApi.markRead(activeId, lastMsg.id).then(() => loadUnread()).catch(() => {});
    }
  }, [activeId, messages.length, view]);

  // ─── Data loaders ───
  async function loadConversations() {
    try {
      const data = await chatApi.listConversations();
      setConversations(data || []);
    } catch (e) { console.warn("loadConversations:", e); }
  }
  async function loadUsers() {
    try {
      const data = await chatApi.listUsers();
      setUsers(data || []);
      const p = {};
      (data || []).forEach((u) => { p[u.id] = u.is_online; });
      setPresence(p);
    } catch (e) { console.warn("loadUsers:", e); }
  }
  async function loadTemplates() {
    try {
      const data = await chatApi.getTemplates();
      setTemplates(data || []);
    } catch (e) { console.warn("loadTemplates:", e); }
  }
  async function loadUnread() {
    try {
      const data = await chatApi.getUnreadTotal();
      setUnreadTotal(data?.total || 0);
    } catch (e) { console.warn("loadUnread:", e); /* ignore */ }
  }
  async function loadSuggested() {
    try {
      const data = await chatApi.getSuggestedUsers(6);
      setSuggested(data || []);
    } catch (e) { console.warn("loadSuggested:", e); /* ignore */ }
  }
  async function loadMessages(convId) {
    try {
      const data = await chatApi.listMessages(convId, { limit: 100 });
      setMessages(data || []);
    } catch (e) {
      console.warn("loadMessages:", e);
      setMessages([]);
    }
  }

  // ─── WebSocket event handler ───
  function handleWsEvent(evt) {
    if (evt.type === "new_message") {
      const m = evt.message;
      // Eğer aktif conversation ise mesaj listesine ekle
      if (m.conversation_id === activeId) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      }
      // Conversations listesini güncelle
      setConversations((prev) => prev.map((c) => {
        if (c.id === m.conversation_id) {
          return {
            ...c,
            last_message_at: m.created_at,
            last_message_preview: (m.text || "").slice(0, 140),
            last_message_sender_name: m.sender_name,
            unread_count: m.conversation_id === activeId || m.sender_id === userId ? 0 : (c.unread_count || 0) + 1,
          };
        }
        return c;
      }));
      // Genel toplam
      if (m.sender_id !== userId && m.conversation_id !== activeId) {
        setUnreadTotal((t) => t + 1);
        // Toast (sadece drawer kapalıysa)
        if (!open) {
          toast(`${m.sender_name}`, {
            description: m.text?.slice(0, 100) || "Yeni mesaj",
            duration: 4000,
          });
        }
      }
    } else if (evt.type === "typing_start") {
      setTypingUsers((p) => ({ ...p, [evt.conversation_id]: { ...(p[evt.conversation_id] || {}), [evt.user_id]: evt.user_name } }));
      // 5 sn sonra otomatik temizle
      setTimeout(() => {
        setTypingUsers((p) => {
          const conv = { ...(p[evt.conversation_id] || {}) };
          delete conv[evt.user_id];
          return { ...p, [evt.conversation_id]: conv };
        });
      }, 5000);
    } else if (evt.type === "typing_stop") {
      setTypingUsers((p) => {
        const conv = { ...(p[evt.conversation_id] || {}) };
        delete conv[evt.user_id];
        return { ...p, [evt.conversation_id]: conv };
      });
    } else if (evt.type === "presence_update") {
      setPresence((p) => ({ ...p, [evt.user_id]: evt.is_online }));
    } else if (evt.type === "message_read") {
      setReadState((p) => ({
        ...p,
        [evt.conversation_id]: { ...(p[evt.conversation_id] || {}), [evt.user_id]: evt.at },
      }));
    } else if (evt.type === "reaction_added") {
      if (evt.conversation_id === activeId) {
        setMessages((prev) => prev.map((m) => m.id === evt.message_id ? { ...m, reactions: evt.reactions } : m));
      }
    } else if (evt.type === "conversation_update") {
      loadConversations();
    }
  }

  // ─── Actions ───
  async function openConversation(convId) {
    setActiveId(convId);
    setView("conversation");
    await loadMessages(convId);
    // Unread'i sıfırla (UI)
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c));
  }

  async function sendMessage(opts = {}) {
    if (!activeId) return;
    const body = opts.text ?? text;
    const attachments = opts.attachments ?? [];
    if (!body.trim() && attachments.length === 0) return;
    try {
      const msg = await chatApi.sendMessage(activeId, {
        text: body, msg_type: attachments.length ? (attachments[0].mime?.startsWith("image/") ? "image" : "file") : "text",
        attachments,
      });
      setText("");
      setShowEmojis(false);
      setShowTemplates(false);
      setMessages((prev) => prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]);
      loadConversations();
    } catch (e) {
      toast.error("Mesaj gönderilemedi");
      console.error(e);
    }
  }

  function onTyping() {
    if (!activeId) return;
    chatApi.sendTyping(activeId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      chatApi.sendTyping(activeId, false);
    }, 2500);
  }

  async function handleFileUpload(file) {
    if (!file || !activeId) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Dosya 25 MB'tan büyük olamaz");
      return;
    }
    setUploading(true);
    try {
      const att = await chatApi.uploadFile(file);
      const fullUrl = att.url.startsWith("http") ? att.url : `${process.env.REACT_APP_BACKEND_URL}${att.url}`;
      await sendMessage({ text: text, attachments: [{ ...att, url: fullUrl }] });
    } catch (e) {
      toast.error("Dosya yüklenemedi");
      console.error(e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startDM(otherUserId) {
    try {
      const conv = await chatApi.openDM(otherUserId);
      await loadConversations();
      openConversation(conv.id);
    } catch (e) {
      toast.error("DM başlatılamadı");
    }
  }

  async function handleReaction(messageId, emoji) {
    try {
      await chatApi.toggleReaction(messageId, emoji);
    } catch (_) {}
  }

  // ─── Filtrelenmiş listeler ───
  const filteredConvs = useMemo(() => {
    let list = conversations;
    if (groupFilter !== "all") list = list.filter((c) => c.type === groupFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        (c.name || "").toLowerCase().includes(s) ||
        (c.last_message_preview || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [conversations, search, groupFilter]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const s = search.toLowerCase();
    return users.filter((u) =>
      (u.display_name || u.username || "").toLowerCase().includes(s)
    );
  }, [users, search]);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);
  const activeTyping = activeId && typingUsers[activeId] ? Object.values(typingUsers[activeId]).filter(Boolean) : [];

  if (!userId) return null;

  return (
    <>
      {/* Global Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 250 }}
        onClick={() => setOpen(true)}
        data-testid="messenger-fab"
        aria-label={`Mesajlaşma${unreadTotal ? ` — ${unreadTotal} okunmamış` : ""}`}
        className="fixed bottom-5 left-5 z-40 h-14 w-14 sm:w-auto sm:px-5 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 shadow-xl shadow-amber-500/40 flex items-center justify-center gap-2 text-zinc-900 font-bold text-sm hover:scale-105 active:scale-95 transition-transform border border-amber-300/60"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden sm:inline">Mesajlar</span>
        {unreadTotal > 0 && (
          <span
            data-testid="messenger-unread-badge"
            className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center shadow-lg"
          >
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "-100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-gradient-to-b from-[#1a1410] to-[#0c0904] border-r border-amber-500/20 shadow-2xl shadow-amber-500/10 flex flex-col"
              role="dialog"
              aria-label="Messenger paneli"
              data-testid="messenger-drawer"
            >
              {/* Header */}
              <div className="header-premium px-4 py-3 flex items-center justify-between gap-2 border-b border-amber-500/15">
                <div className="flex items-center gap-2.5">
                  {view !== "list" ? (
                    <button
                      onClick={() => { setView("list"); setActiveId(null); }}
                      className="p-2 rounded-lg hover:bg-white/10 text-amber-300"
                      aria-label="Konuşma listesine dön"
                      data-testid="messenger-back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="panel-logo-tile" style={{ "--tile-from": "#FFD24C", "--tile-to": "#B8860B", "--tile-rgb": "255,191,0" }} aria-hidden="true">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-amber-300/80 leading-none">Buse Kâğıt</p>
                    <h2 className="text-base font-heading font-black text-white leading-tight tracking-tight">
                      {view === "list" ? "Mesajlar" : view === "new-dm" ? "Yeni Konuşma" : (activeConv?.name || "—")}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {wsConnected ? (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1" title="Canlı bağlantı aktif">
                      <Wifi className="w-3 h-3" /> CANLI
                    </span>
                  ) : (
                    <span className="text-rose-400 text-[10px] flex items-center gap-1" title="Bağlantı yok">
                      <WifiOff className="w-3 h-3" /> KAPALI
                    </span>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400"
                    aria-label="Messenger paneli kapat"
                    data-testid="messenger-close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* LIST VIEW */}
              {view === "list" && (
                <ListView
                  search={search} setSearch={setSearch}
                  groupFilter={groupFilter} setGroupFilter={setGroupFilter}
                  filteredConvs={filteredConvs}
                  presence={presence}
                  openConversation={openConversation}
                  onNewDM={() => setView("new-dm")}
                  pushPermitted={pushPermitted}
                  suggested={suggested}
                  onStartDM={startDM}
                />
              )}

              {/* NEW DM VIEW */}
              {view === "new-dm" && (
                <NewDMView
                  search={search} setSearch={setSearch}
                  filteredUsers={filteredUsers}
                  presence={presence}
                  onStartDM={startDM}
                />
              )}

              {/* CONVERSATION VIEW */}
              {view === "conversation" && activeConv && (
                <ConversationView
                  conv={activeConv}
                  messages={messages}
                  userId={userId}
                  presence={presence}
                  activeTyping={activeTyping}
                  formatBoldText={formatBoldText}
                  onReaction={handleReaction}
                  messagesEndRef={messagesEndRef}
                />
              )}

              {/* INPUT (only in conversation view) */}
              {view === "conversation" && activeConv && (
                <InputBar
                  text={text} setText={setText}
                  onSend={() => sendMessage()}
                  onTyping={onTyping}
                  showEmojis={showEmojis} setShowEmojis={setShowEmojis}
                  showTemplates={showTemplates} setShowTemplates={setShowTemplates}
                  templates={templates}
                  emojis={EMOJIS}
                  inputRef={inputRef}
                  fileInputRef={fileInputRef}
                  onFile={handleFileUpload}
                  uploading={uploading}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function ListView({ search, setSearch, groupFilter, setGroupFilter, filteredConvs, presence, openConversation, onNewDM, pushPermitted, suggested, onStartDM }) {
  return (
    <>
      <div className="px-3 pt-3 pb-2 space-y-2">
        {/* Web Push reminder */}
        {!pushPermitted && "Notification" in window && Notification.permission === "default" && (
          <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Bildirim izni vererek mesajları arka planda al. Tarayıcı sorduğunda <strong>İzin Ver</strong>'e basın.</span>
          </div>
        )}
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Konuşma ara..."
            data-testid="messenger-search"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:border-amber-400 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/20 outline-none"
          />
        </div>
        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { k: "all", label: "Tümü", icon: Hash },
            { k: "dm", label: "Kişiler", icon: AtSign },
            { k: "group", label: "Kanallar", icon: Users },
            { k: "machine", label: "Makineler", icon: FileText },
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setGroupFilter(k)}
              data-testid={`filter-${k}`}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                groupFilter === k
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sık kullanılan kullanıcılar — yatay scroll */}
      {suggested && suggested.length > 0 && (
        <div className="px-3 pb-3 border-b border-white/5" data-testid="suggested-users">
          <p className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Hızlı Erişim
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3">
            {suggested.map((u) => {
              const primary = (u.roles && u.roles[0]) || "operator";
              const color = ROLE_COLORS[primary] || "#FFBF00";
              const online = presence[u.id] !== undefined ? presence[u.id] : u.is_online;
              return (
                <button
                  key={u.id}
                  onClick={() => onStartDM(u.id)}
                  data-testid={`suggested-${u.id}`}
                  aria-label={`${u.display_name || u.username} ile DM aç`}
                  className="shrink-0 flex flex-col items-center gap-1 group"
                >
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-zinc-900 transition-transform group-hover:scale-110 group-active:scale-95"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}80)`, boxShadow: `0 4px 14px ${color}40` }}
                    >
                      {(u.display_name || u.username || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1410] ${online ? "bg-emerald-500" : "bg-zinc-600"}`}
                      aria-hidden="true"
                    />
                    {u.is_recent && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-[#1a1410]" title="Son DM" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-300 max-w-[60px] truncate font-medium">
                    {u.display_name?.split(" ")[0] || u.username}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* New DM */}
      <button
        onClick={onNewDM}
        data-testid="messenger-new-dm"
        className="mx-3 mt-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-sm font-semibold transition-colors"
      >
        <PlusCircle className="w-4 h-4" /> Yeni konuşma başlat
      </button>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3" data-testid="messenger-conv-list">
        {filteredConvs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">Henüz konuşma yok</p>
          </div>
        ) : filteredConvs.map((c) => {
          const otherOnline = c.type === "dm" && c.other_user ? presence[c.other_user.id] : false;
          return (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              data-testid={`conv-${c.id}`}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors flex items-center gap-3 group"
            >
              <div className="relative shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{
                    background: c.color ? `linear-gradient(135deg, ${c.color}40, ${c.color}10)` : "rgba(255,191,0,0.15)",
                    border: `1px solid ${c.color || "rgba(255,191,0,0.3)"}50`,
                  }}
                >
                  {c.icon || (c.type === "dm" ? "👤" : c.type === "machine" ? "🏭" : "💬")}
                </div>
                {otherOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1a1410]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{c.name || "—"}</h3>
                  <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs truncate ${c.unread_count > 0 ? "text-amber-200 font-semibold" : "text-zinc-500"}`}>
                    {c.last_message_sender_name && <span className="opacity-70">{c.last_message_sender_name}: </span>}
                    {c.last_message_preview || "Henüz mesaj yok"}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="bg-amber-500 text-zinc-900 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function NewDMView({ search, setSearch, filteredUsers, presence, onStartDM }) {
  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kullanıcı ara..."
            data-testid="new-dm-search"
            autoFocus
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3" data-testid="messenger-user-list">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-6 text-zinc-500 text-sm">Kullanıcı bulunamadı</div>
        ) : filteredUsers.map((u) => {
          const primary = (u.roles && u.roles[0]) || u.role || "operator";
          const color = ROLE_COLORS[primary] || "#FFBF00";
          const online = presence[u.id];
          return (
            <button
              key={u.id}
              onClick={() => onStartDM(u.id)}
              data-testid={`new-dm-user-${u.id}`}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors flex items-center gap-3"
            >
              <div className="relative shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-zinc-900"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}80)` }}
                >
                  {(u.display_name || u.username || "U").slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1410] ${online ? "bg-emerald-500" : "bg-zinc-600"}`}
                  aria-label={online ? "Çevrimiçi" : "Çevrimdışı"}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{u.display_name || u.username}</h3>
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  {(u.roles || [u.role]).filter(Boolean).map((r) => ROLE_LABELS[r] || r).join(", ")}
                  {online && <span className="text-emerald-400 text-[10px]">• çevrimiçi</span>}
                </p>
              </div>
              <Send className="w-4 h-4 text-zinc-600" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function ConversationView({ conv, messages, userId, presence, activeTyping, formatBoldText, onReaction, messagesEndRef }) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" data-testid="messenger-messages">
      {/* Conversation header info */}
      <div className="text-center pb-3 border-b border-white/5">
        <p className="text-xs text-zinc-500">
          {conv.type === "group" ? `${conv.description || "Grup kanalı"} · ${conv.participants?.length || 0} üye` :
           conv.type === "machine" ? `${conv.description || "Makine kanalı"}` :
           conv.other_user ? (presence[conv.other_user.id] ? "🟢 Çevrimiçi" : "Çevrimdışı") : ""}
        </p>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
          İlk mesajı sen at!
        </div>
      ) : messages.map((m, i) => {
        const isMe = m.sender_id === userId;
        const isSystem = m.msg_type === "auto_event" || m.sender_id === "system";
        const prev = messages[i - 1];
        const showAvatar = !isMe && !isSystem && (!prev || prev.sender_id !== m.sender_id);

        if (isSystem) {
          return (
            <div key={m.id} className="my-3 flex justify-center" data-testid={`msg-${m.id}`}>
              <div className="max-w-[90%] bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-2xl px-4 py-2.5 text-sm text-amber-100 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-2 mb-1 text-[10px] text-amber-300/80 font-mono uppercase tracking-wider">
                  <CircleAlert className="w-3 h-3" /> {m.event_type || "Sistem"} · {timeShort(m.created_at)}
                </div>
                <div className="leading-relaxed">{formatBoldText(m.text || "")}</div>
              </div>
            </div>
          );
        }

        return (
          <div key={m.id} data-testid={`msg-${m.id}`} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
            {!isMe && (
              <div className="w-7 h-7 shrink-0">
                {showAvatar && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-900"
                    style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[m.sender_role] || "#FFBF00"}, ${ROLE_COLORS[m.sender_role] || "#FFBF00"}80)` }}
                    title={m.sender_name}
                  >
                    {(m.sender_name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col group`}>
              {showAvatar && !isMe && (
                <p className="text-[10px] text-zinc-500 px-2 mb-0.5 font-semibold">
                  {m.sender_name} · <span className="text-zinc-600">{ROLE_LABELS[m.sender_role] || m.sender_role}</span>
                </p>
              )}
              <div
                className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-900 rounded-br-md font-medium"
                    : "bg-white/[0.06] border border-white/10 text-white rounded-bl-md"
                }`}
              >
                {m.attachments && m.attachments.map((a, k) => (
                  <div key={k} className="mb-1.5">
                    {(a.mime || "").startsWith("image/") ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="block">
                        <img src={a.url} alt={a.name || "ek"} className="rounded-lg max-w-full max-h-48 object-cover" />
                      </a>
                    ) : (
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-1.5 bg-black/30 rounded-lg text-xs hover:bg-black/40">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="truncate">{a.name || "Dosya"}</span>
                      </a>
                    )}
                  </div>
                ))}
                {m.text && <div>{m.text}</div>}
                <span className={`text-[9px] mt-0.5 block opacity-60 ${isMe ? "text-zinc-800" : "text-zinc-400"}`}>
                  {timeShort(m.created_at)}
                  {isMe && <CheckCheck className="inline w-3 h-3 ml-1" />}
                </span>
              </div>
              {/* Reactions */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div className="flex gap-1 mt-1 px-2">
                  {Object.entries(m.reactions).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => onReaction(m.id, emoji)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${users.includes(userId) ? "bg-amber-500/20 border-amber-500/50" : "bg-white/5 border-white/10"} hover:scale-110 transition-transform`}
                    >
                      {emoji} {users.length}
                    </button>
                  ))}
                </div>
              )}
              {/* React button (opens on hover) */}
              <button
                onClick={() => onReaction(m.id, "👍")}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 hover:text-amber-300 mt-0.5 px-2 transition-opacity"
                aria-label="Reaksiyon ekle"
              >
                +👍
              </button>
            </div>
          </div>
        );
      })}
      {/* Typing indicator */}
      {activeTyping.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400" data-testid="typing-indicator">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span>{activeTyping.join(", ")} yazıyor...</span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function InputBar({ text, setText, onSend, onTyping, showEmojis, setShowEmojis, showTemplates, setShowTemplates, templates, emojis, inputRef, fileInputRef, onFile, uploading }) {
  return (
    <div className="border-t border-amber-500/15 bg-black/40 p-3 space-y-2">
      {/* Templates */}
      {showTemplates && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5" data-testid="quick-templates">
          {templates.map((t) => (
            <button
              key={t.key}
              onClick={() => { setText((p) => p ? `${p} ${t.emoji} ${t.text}` : `${t.emoji} ${t.text}`); setShowTemplates(false); inputRef.current?.focus(); }}
              data-testid={`template-${t.key}`}
              className="text-xs px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 transition-colors"
            >
              {t.emoji} {t.text}
            </button>
          ))}
        </motion.div>
      )}
      {/* Emojis */}
      {showEmojis && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-9 gap-1 bg-black/40 rounded-lg p-2" data-testid="emoji-picker">
          {emojis.map((e) => (
            <button
              key={e}
              onClick={() => { setText((p) => p + e); inputRef.current?.focus(); }}
              data-testid={`emoji-${e}`}
              className="text-xl hover:scale-125 transition-transform p-1 rounded"
            >
              {e}
            </button>
          ))}
        </motion.div>
      )}
      {/* Input row */}
      <div className="flex items-end gap-1.5">
        <button
          onClick={() => { setShowTemplates((v) => !v); setShowEmojis(false); }}
          className={`p-2 rounded-lg ${showTemplates ? "bg-amber-500/20 text-amber-300" : "text-zinc-400 hover:bg-white/5"}`}
          aria-label="Hızlı şablonlar"
          data-testid="toggle-templates"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setShowEmojis((v) => !v); setShowTemplates(false); }}
          className={`p-2 rounded-lg ${showEmojis ? "bg-amber-500/20 text-amber-300" : "text-zinc-400 hover:bg-white/5"}`}
          aria-label="Emoji seç"
          data-testid="toggle-emoji"
        >
          <Smile className="w-5 h-5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 disabled:opacity-50"
          aria-label="Dosya / fotoğraf ekle"
          disabled={uploading}
          data-testid="attach-file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => onFile(e.target.files[0])}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          data-testid="messenger-file-input"
        />
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); onTyping(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Mesaj yazın..."
            rows={1}
            data-testid="messenger-input"
            aria-label="Mesaj yazma alanı"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none resize-none max-h-32"
          />
        </div>
        <button
          onClick={onSend}
          disabled={!text.trim() || uploading}
          data-testid="messenger-send"
          aria-label="Mesajı gönder"
          className="p-2.5 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-transform"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default MessengerPanel;
