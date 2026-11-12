import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Tag,
  Ticket,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  getSupportTicketDetails,
  sendSupportTicketMessage,
} from "@/services/support/supportApi";

import SupportStatusBadge from "./SupportStatusBadge";
import {
  formatSupportDate,
  getApiErrorMessage,
  getCategoryLabel,
  getMessagesFromResponse,
  getPriorityLabel,
  getTicketFromResponse,
} from "./supportUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const PRIORITY_STYLES = {
  low: "bg-surface-muted text-content-muted ring-line",
  normal: "bg-sky-50 text-sky-700 ring-sky-100",
  high: "bg-amber-50 text-amber-700 ring-amber-100",
  urgent: "bg-rose-50 text-rose-700 ring-rose-100",
};

const MAX_LENGTH = 5000;

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GREEN = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.normal
      }`}
    >
      {getPriorityLabel(priority)} priority
    </span>
  );
}

function Bone({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-full bg-line ${className}`}
    />
  );
}

function PageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-5xl space-y-6 pb-10"
    >
      <span className="sr-only">Loading support conversation</span>

      <Bone className="h-5 w-40" />

      <div className="space-y-4 rounded-3xl border border-line bg-surface-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-6 w-44" />
          <Bone className="h-7 w-24" />
        </div>
        <Bone className="h-7 w-2/3" />
        <div className="space-y-2.5">
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-5/6" />
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2.5 rounded-2xl border border-line p-4">
              <Bone className="h-3 w-16" />
              <Bone className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-line bg-surface-white p-5 sm:p-7">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`flex gap-3 ${item % 2 ? "justify-end" : "justify-start"}`}
          >
            <Bone className="h-9 w-9 shrink-0" />
            <div className="w-3/5 space-y-2">
              <Bone className="h-3 w-28" />
              <Bone className="h-16 w-full !rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-muted/60 px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-content-muted">
        <Icon size={12} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold text-content">{children}</dd>
    </div>
  );
}

function MessageBubble({ message, isOwnMessage }) {
  const isAdmin = message.sender_type === "admin";

  const sender = isOwnMessage
    ? "You"
    : isAdmin
      ? "ERANDER Support"
      : message.sender_name || "Support participant";

  return (
    <li
      className={`flex items-end gap-2.5 ${
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isAdmin
            ? "bg-brand text-brand-mint"
            : isOwnMessage
              ? "bg-brand-pale text-success-dark"
              : "bg-surface-muted text-content-muted"
        }`}
      >
        {isAdmin ? <ShieldCheck size={16} /> : <UserRound size={16} />}
      </span>

      <div
        className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%] ${
          isOwnMessage ? "items-end" : "items-start"
        }`}
      >
        <div className="mb-1 flex items-center gap-2 px-1">
          <span className="text-xs font-extrabold text-content">{sender}</span>
          <span className="text-[11px] text-content-subtle">
            {formatSupportDate(message.created_at, true)}
          </span>
        </div>

        <div
          className={`rounded-3xl px-4 py-3 text-sm leading-6 ${
            isOwnMessage
              ? "rounded-br-lg bg-brand text-content-inverse"
              : isAdmin
                ? "rounded-bl-lg border border-line bg-brand-pale text-brand"
                : "rounded-bl-lg border border-line bg-surface-white text-content"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.message}</p>
        </div>
      </div>
    </li>
  );
}

function ConversationEmptyState() {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
        <MessageCircle size={24} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-extrabold text-content">
        Start the conversation
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
        Send a message to add more information or ask a question about this
        ticket.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function SupportTicketDetails({ activeRole = "customer" }) {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const conversationEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isClosed = ["resolved", "closed"].includes(ticket?.status);

  const loadTicket = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const response = await getSupportTicketDetails(ticketId);
        const ticketData = getTicketFromResponse(response);

        setTicket(ticketData);
        setMessages(getMessagesFromResponse(response, ticketData));
      } catch (requestError) {
        const text = getApiErrorMessage(
          requestError,
          "We couldn't load this support ticket."
        );

        if (silent) toast.error(text);
        else setError(text);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // Keep the newest message in view.
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = message.trim();

    if (!trimmed || sending) return;

    setSending(true);

    try {
      const response = await sendSupportTicketMessage(ticketId, {
        message: trimmed,
        sender_type: activeRole === "erander" ? "erander" : "customer",
      });

      const result = response?.data ?? response;
      const newMessage = result?.message ?? result?.data?.message ?? result?.data;

      if (newMessage && typeof newMessage === "object" && newMessage.id) {
        setMessages((current) => [...current, newMessage]);
      } else {
        await loadTicket({ silent: true });
      }

      setMessage("");
      toast.success("Message sent.");
      textareaRef.current?.focus();
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(
          requestError,
          "Your message couldn't be sent. Please try again."
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  // Ctrl or Cmd + Enter sends. Plain Enter keeps writing a new line.
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Support center">
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout title="Support center">
        <div
          role="alert"
          className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-line bg-surface-white px-6 py-12 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle size={26} aria-hidden="true" />
          </span>

          <h2 className="mt-4 text-lg font-extrabold text-content">
            Unable to open this ticket
          </h2>

          <p className="mt-1 max-w-md break-words text-sm leading-6 text-content-muted">
            {error || "This support ticket could not be found."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => loadTicket()} className={BTN_GHOST}>
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard/support")}
              className={BTN_NAVY}
            >
              Back to support centre
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Support center">
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <button
          type="button"
          onClick={() => navigate("/dashboard/support")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to support centre
        </button>

        {/* Ticket summary */}
        <header className="rounded-3xl border border-line bg-surface-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-pale px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-success-dark">
              <Ticket size={13} aria-hidden="true" />
              {ticket.ticket_number ?? "Support ticket"}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <SupportStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />

              <button
                type="button"
                onClick={() => loadTicket({ silent: true })}
                disabled={refreshing}
                aria-label="Refresh conversation"
                title="Refresh"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-white text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          <h1 className="mt-4 break-words text-xl font-extrabold leading-tight tracking-tight text-brand sm:text-3xl">
            {ticket.subject}
          </h1>

          <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-content-muted">
            {ticket.description}
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact icon={Tag} label="Category">
              {getCategoryLabel(ticket.category)}
            </Fact>
            <Fact icon={CalendarDays} label="Created">
              {formatSupportDate(ticket.created_at, true)}
            </Fact>
            <Fact icon={Clock3} label="Last updated">
              {formatSupportDate(ticket.updated_at, true)}
            </Fact>
            <Fact icon={ShieldCheck} label="Request type">
              {ticket.ticket_type === "issue" ? "Errand issue" : "General support"}
            </Fact>
          </dl>
        </header>

        {/* Conversation */}
        <section
          aria-label="Support conversation"
          className="overflow-hidden rounded-3xl border border-line bg-surface-white"
        >
          <div className="flex items-center gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-pale text-success-dark">
              <MessageCircle size={18} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold tracking-tight text-content">
                Support conversation
              </h2>
              <p className="text-xs text-content-muted">
                Your messages with the ERANDER support team
              </p>
            </div>

            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold tabular-nums text-content-muted">
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </span>
          </div>

          <div
            aria-live="polite"
            className="max-h-[560px] min-h-72 overflow-y-auto bg-surface-muted/40 px-4 py-6 sm:px-6"
          >
            {messages.length === 0 ? (
              <ConversationEmptyState />
            ) : (
              <ul className="space-y-6">
                {messages.map((item) => (
                  <MessageBubble
                    key={item.id}
                    message={item}
                    isOwnMessage={item.sender_type !== "admin"}
                  />
                ))}
              </ul>
            )}

            <div ref={conversationEndRef} />
          </div>

          {isClosed ? (
            <div className="border-t border-line-soft p-4 sm:p-5">
              <div className="flex flex-col gap-4 rounded-2xl bg-surface-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    size={19}
                    className="mt-0.5 shrink-0 text-success-dark"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-content">
                      This ticket has been {ticket.status}.
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-content-muted">
                      This conversation no longer accepts messages. If you need
                      more help, create a new ticket.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/dashboard/support/new")}
                  className={`${BTN_GREEN} shrink-0`}
                >
                  Create a new ticket
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="border-t border-line-soft p-4 sm:p-5"
            >
              <label htmlFor="support-message" className="sr-only">
                Your message
              </label>

              <div className="rounded-3xl border border-line bg-surface-white p-2 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-pale">
                <textarea
                  id="support-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  maxLength={MAX_LENGTH}
                  disabled={sending}
                  placeholder="Write your message"
                  className="min-h-20 w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-content outline-none placeholder:text-content-subtle disabled:opacity-60"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
                  <p className="text-[11px] tabular-nums text-content-subtle">
                    <span className="hidden sm:inline">Ctrl + Enter to send · </span>
                    {message.length}/{MAX_LENGTH}
                  </p>

                  <button
                    type="submit"
                    disabled={!message.trim() || sending}
                    className={BTN_GREEN}
                  >
                    {sending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={15} aria-hidden="true" />
                    )}
                    {sending ? "Sending" : "Send message"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}