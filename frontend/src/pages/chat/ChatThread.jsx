import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, Ban, Check, ImagePlus, Info, Loader2,
  LockKeyhole, Maximize2, MessageCircle, MoreHorizontal, RefreshCw,
  Reply, RotateCcw, Send, ShieldAlert, X,
} from "lucide-react";
import { toast } from "sonner";

import Modal from "@/components/Modal";
import CreateSupportTicket from "@/pages/support/CreateSupportTicket";
import PrivateChatImage from "@/components/chat/PrivateChatImage";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptChatDisclosure,
  closeChat,
  getChatDetails,
  reopenChat,
  sendChatMessage,
} from "@/services/chat/chatApi";

/* -------------------------------------------------------------------------- */
/*                              DESIGN TOKENS                                 */
/* -------------------------------------------------------------------------- */

const EASE = [0.22, 1, 0.36, 1];

const BTN =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_GREEN = `${BTN} bg-brand-green text-brand shadow-sm hover:brightness-95 active:scale-[0.98]`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse shadow-sm hover:opacity-90 active:scale-[0.98]`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:border-line-strong hover:bg-surface-muted hover:text-content`;
const BTN_ICON = "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-white text-content-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

const CHIP_TONE = {
  success: "bg-brand-pale text-success-dark",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-surface-muted text-content-muted",
};

const INPUT =
  "w-full rounded-xl border border-line bg-surface-white px-3.5 py-2.5 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand/20";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const cn = (...classes) => classes.filter(Boolean).join(" ");

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(value));
}

function LinkifiedText({ text }) {
  const pattern = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;
  const parts = String(text || "").split(pattern);
  return parts.map((part, index) => {
    if (!part) return null;
    const isEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part);
    const isUrl = /^(https?:\/\/|www\.)/i.test(part) || /\b[a-z]{2,}$/i.test(part.split("/")[0].split(".").pop() || "");
    if (!isEmail && !isUrl) return <span key={index}>{part}</span>;
    const href = isEmail ? `mailto:${part}` : /^https?:\/\//i.test(part) ? part : `https://${part}`;
    return (
      <a
        key={index}
        href={href}
        target={isEmail ? undefined : "_blank"}
        rel={isEmail ? undefined : "noreferrer noopener"}
        className="break-all underline decoration-current/40 underline-offset-2 hover:decoration-current"
      >
        {part}
      </a>
    );
  });
}

function groupByDay(messages) {
  const groups = [];
  for (const message of messages) {
    const day = new Date(message.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, label: formatDay(message.created_at), messages: [message] });
    else last.messages.push(message);
  }
  return groups;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("We couldn't read that image."));
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/*                              SKELETON PIECES                               */
/* -------------------------------------------------------------------------- */

function SkeletonBlock({ className = "", rounded = "rounded-lg" }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative overflow-hidden bg-surface-muted ${rounded} ${className}`} aria-hidden="true">
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)" }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

function SkeletonCircle({ className = "" }) {
  return <SkeletonBlock className={className} rounded="rounded-full" />;
}

function ChatSkeleton({ className }) {
  return (
    <div className={cn("flex min-h-0 flex-col bg-surface-muted/40", className)} role="status" aria-label="Loading conversation">
      <span className="sr-only">Loading conversation…</span>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-white px-4 py-3 sm:px-5" aria-hidden="true">
        <div className="flex min-w-0 items-center gap-3">
          <SkeletonCircle className="h-10 w-10 shrink-0" />
          <div className="min-w-0 space-y-1.5">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SkeletonBlock className="h-9 w-9" rounded="rounded-xl" />
          <SkeletonBlock className="h-9 w-9" rounded="rounded-xl" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-5" aria-hidden="true">
        <SkeletonBlock className="h-4 w-4" rounded="rounded-md" />
        <SkeletonBlock className="h-3 flex-1 max-w-md" />
      </div>

      <div className="min-h-0 flex-1 space-y-5 px-3 py-5 sm:px-5" aria-hidden="true">
        <div className="flex justify-center">
          <SkeletonBlock className="h-5 w-32" rounded="rounded-full" />
        </div>
        <div className="flex justify-start">
          <div className="w-[70%] space-y-2 rounded-2xl border border-line bg-surface-white p-4">
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="w-[60%] space-y-2 rounded-2xl bg-brand/80 p-4">
            <SkeletonBlock className="h-3 w-2/3 bg-white/30" />
            <SkeletonBlock className="h-3 w-1/3 bg-white/30" />
          </div>
        </div>
        <div className="flex justify-start">
          <div className="w-[65%] space-y-2 rounded-2xl border border-line bg-surface-white p-4">
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-2/5" />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface-white p-3 sm:p-4" aria-hidden="true">
        <div className="flex items-end gap-2">
          <SkeletonBlock className="h-11 w-11 shrink-0" rounded="rounded-xl" />
          <SkeletonBlock className="h-11 flex-1" rounded="rounded-xl" />
          <SkeletonBlock className="h-11 w-11 shrink-0" rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function ChatThread({ chatId, mode = "page", onClose, onViewFull, onChanged }) {
  const { user } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessageId, setReportMessageId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const suppressAutoScrollRef = useRef(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const initialLoadRef = useRef(true);

  const heightClass = mode === "modal" ? "h-[min(78dvh,720px)]" : "h-[min(78vh,820px)]";

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!chatId) return;
    if (!silent) setLoading(true);
    try {
      const result = await getChatDetails(chatId, { limit: 100 });
      const nextChat = result?.data?.chat;
      const nextMessages = result?.data?.messages || [];
      if (!nextChat) throw new Error("This conversation could not be loaded.");
      setChat(nextChat);
      setMessages((current) => {
        if (!silent || current.length === 0) return nextMessages;
        const merged = new Map(current.map((message) => [message.id, message]));
        nextMessages.forEach((message) => merged.set(message.id, message));
        return [...merged.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      if (!silent) setHasEarlier(nextMessages.length === 100);
      else if (nextMessages.length === 100) setHasEarlier(true);
      setError("");
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }));
      }
    } catch (loadError) {
      if (!silent) setError(loadError?.message || "Unable to load this conversation.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    initialLoadRef.current = true;
    setChat(null);
    setMessages([]);
    setHasEarlier(false);
    setLoadingEarlier(false);
    setDraft("");
    setImage(null);
    setReplyTo(null);
    setReportOpen(false);
    setReportMessageId(null);
    shouldAutoScrollRef.current = true;
    suppressAutoScrollRef.current = false;
    load();
    const timer = window.setInterval(() => load({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!messages.length) return;
    if (suppressAutoScrollRef.current) {
      suppressAutoScrollRef.current = false;
      return;
    }
    if (shouldAutoScrollRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const canSend = Boolean(chat?.disclosure_accepted_at) && chat?.status === "open";
  const groupedMessages = useMemo(() => groupByDay(messages), [messages]);

  const loadEarlierMessages = async () => {
    if (loadingEarlier || !messages.length || !hasEarlier) return;
    setLoadingEarlier(true);
    try {
      const result = await getChatDetails(chatId, { before: messages[0].created_at, limit: 100 });
      const older = result?.data?.messages || [];
      const scrollNode = messagesContainerRef.current;
      const previousScrollHeight = scrollNode?.scrollHeight ?? null;
      const previousScrollTop = scrollNode?.scrollTop ?? 0;
      if (older.length) suppressAutoScrollRef.current = true;
      setMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        older.forEach((message) => merged.set(message.id, message));
        return [...merged.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      setHasEarlier(older.length === 100);
      if (older.length) requestAnimationFrame(() => {
        const node = messagesContainerRef.current;
        if (node && previousScrollHeight !== null) node.scrollTop = previousScrollTop + (node.scrollHeight - previousScrollHeight);
      });
    } catch (loadError) {
      toast.error(loadError?.message || "Unable to load earlier messages.");
    } finally {
      setLoadingEarlier(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptChatDisclosure(chatId);
      await load({ silent: true });
    } catch (acceptError) {
      toast.error(acceptError?.message || "Unable to accept the notice.");
    } finally {
      setAccepting(false);
    }
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    if (sending || !canSend || (!draft.trim() && !image)) return;
    setSending(true);
    shouldAutoScrollRef.current = true;
    try {
      const payload = {
        body: draft.trim(),
        replyToMessageId: replyTo?.message_type === "text" ? replyTo.id : null,
        image: image ? { filename: image.name, dataUrl: await readFileAsDataUrl(image) } : null,
      };
      const result = await sendChatMessage(chatId, payload);
      const sent = result?.data?.message;
      if (sent) {
        setMessages((current) => [...current, {
          ...sent,
          sender_name: user?.user_metadata?.first_name || user?.email || "You",
          attachment_id: null,
          attachment: sent.attachment,
        }]);
      }
      setDraft("");
      setImage(null);
      setReplyTo(null);
      if (fileRef.current) fileRef.current.value = "";
      await load({ silent: true });
      onChanged?.();
    } catch (sendError) {
      toast.error(sendError?.message || "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const chooseImage = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      toast.error("Choose a JPEG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Images must be 8 MB or smaller.");
      return;
    }
    setImage(file);
  };

  const handleClose = async () => {
    setMenuOpen(false);
    if (!window.confirm("Close this conversation? Neither party will be able to send messages until it is reopened.")) return;
    setClosing(true);
    try {
      await closeChat(chatId);
      await load({ silent: true });
      toast.success("Conversation closed.");
      onChanged?.();
    } catch (closeError) {
      toast.error(closeError?.message || "Unable to close this conversation.");
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    setMenuOpen(false);
    setReopening(true);
    try {
      await reopenChat(chatId);
      await load({ silent: true });
      toast.success("Conversation reopened.");
      onChanged?.();
    } catch (reopenError) {
      toast.error(reopenError?.message || "Unable to reopen this conversation.");
    } finally {
      setReopening(false);
    }
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportMessageId(null);
  };

  const handleReportCreated = () => {
    closeReport();
    onChanged?.();
  };

  /* ---------------------------------------------------------------------- */
  /*                                  LOADING                               */
  /* ---------------------------------------------------------------------- */

  if (loading && !chat) {
    return <ChatSkeleton className={heightClass} />;
  }

  /* ---------------------------------------------------------------------- */
  /*                                   ERROR                                */
  /* ---------------------------------------------------------------------- */

  if (error && !chat) {
    return (
      <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-rose-200 bg-rose-50", heightClass)} role="alert">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <p className="text-sm font-extrabold text-rose-950">We couldn't load this conversation</p>
          <p className="max-w-sm text-sm leading-6 text-rose-800">{error}</p>
          <button type="button" onClick={() => load()} className={`${BTN_GHOST} mt-2`}>
            <RefreshCw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!chat) return null;

  /* ---------------------------------------------------------------------- */
  /*                                  RENDER                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className={cn("flex min-h-0 flex-col bg-surface-muted/40", heightClass)}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {mode === "page" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className={BTN_ICON}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          ) : null}

          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand text-brand-mint text-sm font-extrabold">
            {chat.avatar_url ? (
              <img src={chat.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (chat.other_display_name || "U").slice(0, 1).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-content">{chat.other_display_name}</p>
            <p className="truncate text-xs text-content-muted">
              {chat.errand_title} · {chat.reference_code}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "hidden items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider sm:inline-flex",
              chat.status === "open" ? CHIP_TONE.success : CHIP_TONE.neutral
            )}
          >
            {chat.status === "open" ? "Open" : "Closed"}
          </span>

          {mode === "modal" && onViewFull ? (
            <button
              type="button"
              onClick={onViewFull}
              title="View full chat"
              aria-label="View full chat"
              className={BTN_ICON}
            >
              <Maximize2 size={15} aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => { setReportMessageId(null); setReportOpen(true); }}
            title="Report conversation"
            aria-label="Report conversation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-white text-content-muted transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <ShieldAlert size={16} aria-hidden="true" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={BTN_ICON}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14, ease: EASE }}
                  className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-line bg-surface-white p-1.5 shadow-erander-card"
                  role="menu"
                >
                  {chat.status === "open" ? (
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={closing}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {closing ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                      Close conversation
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleReopen}
                      disabled={reopening}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-success-dark transition hover:bg-brand-pale disabled:opacity-50"
                    >
                      {reopening ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      Reopen conversation
                    </button>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Privacy notice */}
      <div
        role="status"
        className="hidden flex shrink-0 items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] leading-5 text-amber-900 sm:px-5"
      >
        <LockKeyhole size={14} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>
          <strong className="font-extrabold">Privacy notice:</strong>{" "}
          This chat is not end-to-end encrypted. Authorized ERANDER administrators may review
          conversations when needed for safety, fraud prevention, support, or reports.
        </p>
      </div>

      {!chat.disclosure_accepted_at ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-pale text-success-dark">
            <ShieldAlert size={24} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-extrabold tracking-tight text-content">Before you start chatting</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-content-muted">
            Please acknowledge the privacy notice above. Messages are retained by ERANDER and may
            be reviewed by authorized administrators. Messages cannot be edited or deleted.
          </p>
          <button
            type="button"
            disabled={accepting}
            onClick={handleAccept}
            className={`${BTN_NAVY} mt-5`}
          >
            {accepting ? (
              <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Accepting…</>
            ) : (
              <><Check size={16} aria-hidden="true" /> I understand and agree</>
            )}
          </button>
        </div>
      ) : (
        <>
          <div
            ref={messagesContainerRef}
            onScroll={(event) => {
              const node = event.currentTarget;
              shouldAutoScrollRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 140;
            }}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-5"
          >
            {hasEarlier ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadEarlierMessages}
                  disabled={loadingEarlier}
                  className={`${BTN_GHOST} !min-h-9 !rounded-full !px-4 !py-1.5 !text-[11px]`}
                >
                  {loadingEarlier ? (
                    <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Loading earlier messages…</>
                  ) : (
                    "Load earlier messages"
                  )}
                </button>
              </div>
            ) : null}

            {groupedMessages.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-pale text-success-dark">
                  <MessageCircle size={20} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-extrabold text-content">Start the conversation</p>
                <p className="mt-1 text-xs text-content-muted">
                  Keep all errand-related communication here.
                </p>
              </div>
            ) : null}

            {groupedMessages.map((group) => (
              <section key={group.day} className="space-y-3">
                <div className="flex justify-center">
                  <span className="rounded-full bg-surface-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-content-subtle shadow-sm">
                    {group.label}
                  </span>
                </div>

                {group.messages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <article
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3.5 py-3 shadow-sm sm:max-w-[78%]",
                          mine
                            ? "rounded-br-md bg-brand text-content-inverse"
                            : "rounded-bl-md border border-line bg-surface-white text-content"
                        )}
                      >
                        {message.reply_body ? (
                          <div
                            className={cn(
                              "mb-2 rounded-lg border-l-2 px-2.5 py-1.5 text-[11px]",
                              mine
                                ? "border-brand-green bg-white/10 text-white/80"
                                : "border-brand-green bg-brand-pale text-content-muted"
                            )}
                          >
                            <span className="mb-0.5 block font-extrabold">
                              Replying to {message.reply_sender_name || "a message"}
                            </span>
                            <p className="line-clamp-2 whitespace-pre-wrap">{message.reply_body}</p>
                          </div>
                        ) : null}

                        {message.attachment_id ? (
                          <PrivateChatImage
                            src={`${import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "")}/chats/attachments/${message.attachment_id}`}
                            alt={message.original_filename || "Chat attachment"}
                            className="mb-2 max-h-64 max-w-full rounded-xl object-contain"
                          />
                        ) : null}

                        {message.body ? (
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            <LinkifiedText text={message.body} />
                          </p>
                        ) : null}

                        <div
                          className={cn(
                            "mt-1.5 flex items-center justify-end gap-1.5 text-[10px] tabular-nums",
                            mine ? "text-white/55" : "text-content-subtle"
                          )}
                        >
                          <span>{formatTime(message.created_at)}</span>
                          {mine ? <Check size={12} aria-hidden="true" /> : null}
                        </div>

                        {message.message_type === "text" ? (
                          <div className="mt-1 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => { setReplyTo(message); textareaRef.current?.focus(); }}
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-extrabold",
                                mine ? "text-brand-mint hover:text-white" : "text-success-dark hover:text-brand"
                              )}
                            >
                              <Reply size={11} aria-hidden="true" /> Reply
                            </button>
                            {!mine ? (
                              <button
                                type="button"
                                onClick={() => { setReportMessageId(message.id); setReportOpen(true); }}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-content-subtle hover:text-rose-600"
                              >
                                <ShieldAlert size={11} aria-hidden="true" /> Report
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    </div>
                  );
                })}
              </section>
            ))}
            <div ref={bottomRef} />
          </div>

          {chat.status === "closed" ? (
            <div className="shrink-0 border-t border-line bg-surface-white p-4 text-center">
              <p className="text-sm font-extrabold text-content">This conversation is closed.</p>
              <p className="mt-1 text-xs text-content-muted">Either party can reopen it to continue.</p>
              <button
                type="button"
                onClick={handleReopen}
                disabled={reopening}
                className={`${BTN_NAVY} mt-3`}
              >
                {reopening ? (
                  <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Reopening…</>
                ) : (
                  <><RotateCcw size={14} aria-hidden="true" /> Reopen conversation</>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="shrink-0 border-t border-line bg-surface-white p-3 sm:p-4">
              {replyTo ? (
                <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-line bg-brand-pale px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-success-dark">
                      Replying to text
                    </p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-content-muted">
                      {replyTo.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    aria-label="Cancel reply"
                    className="rounded-lg p-1 text-content-muted transition hover:bg-surface-white"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {image ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted/60 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <img src={imagePreviewUrl} alt="Image preview" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="min-w-0 truncate text-xs font-bold text-content-muted">
                      Image: {image.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }}
                    aria-label="Remove image"
                    className="rounded-lg p-1 text-content-muted transition hover:bg-surface-white"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => chooseImage(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Attach image"
                  aria-label="Attach image"
                  className={BTN_ICON}
                >
                  <ImagePlus size={17} aria-hidden="true" />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message…"
                  maxLength={5000}
                  className={`${INPUT} max-h-32 min-h-11 flex-1 resize-y leading-5`}
                />

                <button
                  type="submit"
                  disabled={sending || (!draft.trim() && !image)}
                  aria-label="Send message"
                  className={`${BTN_NAVY} !min-h-11 !w-11 !px-0`}
                >
                  {sending ? (
                    <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send size={17} aria-hidden="true" />
                  )}
                </button>
              </div>

              <p className="mt-2 px-1 text-[10px] leading-4 text-content-subtle">
                Messages cannot be edited or deleted. Keep payments and sensitive arrangements on ERANDER.
              </p>
            </form>
          )}
        </>
      )}

      {/* Chat report — dispatched through CreateSupportTicket */}
      <CreateSupportTicket
        open={reportOpen}
        onClose={closeReport}
        onCreated={handleReportCreated}
        chatReport={{
          chatId: chat.id,
          messageId: reportMessageId,
          otherDisplayName: chat.other_display_name,
          errand: {
            id: chat.erand_id || null,
            title: chat.errand_title,
            reference_code: chat.reference_code,
          },
        }}
      />
    </div>
  );
}