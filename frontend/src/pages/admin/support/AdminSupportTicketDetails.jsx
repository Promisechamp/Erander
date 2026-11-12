import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Ticket,
  UserRound,
  UserSquare2,
} from "lucide-react";
import { toast } from "sonner";

import {
  addAdminSupportInternalNote,
  getAdminSupportTicketDetails,
  replyToAdminSupportTicket,
  updateAdminSupportTicket,
} from "@/services/support/supportApi";

import {
  extractMessages,
  extractTicket,
  formatDate,
  getCategoryLabel,
  getErrorMessage,
  getInitials,
  getPriorityLabel,
  getStatusLabel,
  getUserName,
} from "./adminSupportUtils";

const statusOptions = [
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Awaiting user", value: "awaiting_user" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const statusStyles = {
  open: "bg-blue-50 text-blue-700 border-blue-100",
  in_progress: "bg-amber-50 text-amber-700 border-amber-100",
  awaiting_user: "bg-violet-50 text-violet-700 border-violet-100",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const priorityStyles = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
        statusStyles[status] ?? statusStyles.open
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
        priorityStyles[priority] ?? priorityStyles.normal
      }`}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-700">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function MessageCard({ message }) {
  const isInternal = Boolean(message.is_internal);
  const isAdmin = message.sender_type === "admin";

  const senderLabel = isInternal
    ? "Internal note"
    : isAdmin
      ? "ERANDER Support"
      : message.sender_name || "Customer";

  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          isInternal
            ? "bg-amber-100 text-amber-800"
            : isAdmin
              ? "bg-[#14213D] text-white"
              : "bg-[#E8FBF0] text-emerald-800"
        }`}
      >
        {isInternal ? (
          <LockKeyhole size={17} />
        ) : isAdmin ? (
          <ShieldCheck size={18} />
        ) : (
          <UserRound size={17} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-extrabold text-[#14213D]">
            {senderLabel}
          </span>

          {isInternal && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
              Private
            </span>
          )}

          <span className="text-[11px] text-slate-400">
            {formatDate(message.created_at, true)}
          </span>
        </div>

        <div
          className={`rounded-2xl border px-4 py-3.5 ${
            isInternal
              ? "border-amber-200 bg-amber-50"
              : isAdmin
                ? "border-emerald-100 bg-[#E8FBF0]/70"
                : "border-slate-200 bg-white"
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {message.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <MessageCircle size={24} />
      </div>

      <h3 className="mt-4 font-bold text-[#14213D]">
        No messages yet
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        The conversation will appear here when a message is sent.
      </p>
    </div>
  );
}

export default function AdminSupportTicketDetails() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const conversationEndRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");

  const [draftStatus, setDraftStatus] = useState("");
  const [draftPriority, setDraftPriority] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);

  const [composerMode, setComposerMode] = useState("reply");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const customer = useMemo(
    () => ticket?.user ?? ticket?.profile ?? ticket?.customer ?? null,
    [ticket]
  );

  const customerName = getUserName(customer);

  const loadTicket = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageError("");

      try {
        const response = await getAdminSupportTicketDetails(ticketId);
        const ticketData = extractTicket(response);
        const messageData = extractMessages(response, ticketData);

        setTicket(ticketData);
        setMessages(messageData);

        setDraftStatus(ticketData?.status ?? "open");
        setDraftPriority(ticketData?.priority ?? "normal");
      } catch (requestError) {
        const message = getErrorMessage(
          requestError,
          "Unable to load this support ticket."
        );

        setPageError(message);

        if (silent) toast.error(message);
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

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  const hasChanges =
    ticket &&
    (draftStatus !== ticket.status ||
      draftPriority !== ticket.priority);

  const saveTicketChanges = async () => {
    if (!ticket || !hasChanges || savingChanges) return;

    setSavingChanges(true);

    try {
      await updateAdminSupportTicket(ticketId, {
        status: draftStatus,
        priority: draftPriority,
      });

      toast.success("Ticket settings updated.");
      await loadTicket({ silent: true });
    } catch (requestError) {
      toast.error(
        getErrorMessage(
          requestError,
          "Unable to update this ticket."
        )
      );
    } finally {
      setSavingChanges(false);
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();

    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || sending) return;

    setSending(true);

    try {
      if (composerMode === "internal") {
        await addAdminSupportInternalNote(ticketId, {
          message: trimmedMessage,
        });

        toast.success("Internal note added.");
      } else {
        await replyToAdminSupportTicket(ticketId, {
          message: trimmedMessage,
        });

        toast.success("Reply sent to the user.");
      }

      setMessageText("");
      await loadTicket({ silent: true });
    } catch (requestError) {
      toast.error(
        getErrorMessage(
          requestError,
          "Your message couldn't be sent."
        )
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <LoaderCircle
          size={30}
          className="animate-spin text-emerald-600"
        />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Loading ticket workspace...
        </p>
      </div>
    );
  }

  if (pageError || !ticket) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-red-50 px-6 py-14 text-center">
        <AlertCircle size={30} className="mx-auto text-red-500" />

        <h2 className="mt-4 text-lg font-extrabold text-red-900">
          Unable to open ticket
        </h2>

        <p className="mt-2 text-sm text-red-700">
          {pageError || "This support ticket could not be found."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/support")}
            className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700"
          >
            Back to queue
          </button>

          <button
            type="button"
            onClick={() => loadTicket()}
            className="rounded-xl bg-[#14213D] px-5 py-2.5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      {/* Top navigation */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => navigate("/admin/support")}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft size={17} />
          Back to support queue
        </button>

        <button
          type="button"
          onClick={() => loadTicket({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh ticket
        </button>
      </div>

      {/* Ticket heading */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Ticket size={14} />
              {ticket.ticket_number ?? "Support ticket"}

              <span className="h-1 w-1 rounded-full bg-slate-300" />

              {ticket.ticket_type === "issue"
                ? "Errand issue"
                : "General support"}
            </div>

            <h1 className="text-xl font-extrabold tracking-tight text-[#14213D] sm:text-2xl">
              {ticket.subject}
            </h1>

            <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {ticket.description}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 xl:flex-col xl:items-end">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-100 pt-5 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={14} />
            Created {formatDate(ticket.created_at, true)}
          </span>

          <span className="inline-flex items-center gap-2">
            <Clock3 size={14} />
            Updated {formatDate(ticket.updated_at, true)}
          </span>

          <span className="inline-flex items-center gap-2">
            <FileText size={14} />
            {getCategoryLabel(ticket.category)}
          </span>
        </div>
      </section>

      {/* Main workspace */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Conversation */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-extrabold text-[#14213D]">
                Conversation
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Customer communication and internal activity
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FBF0] text-emerald-700">
              <MessageCircle size={19} />
            </div>
          </div>

          <div className="max-h-[700px] min-h-80 space-y-6 overflow-y-auto bg-slate-50/70 px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <ConversationEmptyState />
            ) : (
              messages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                />
              ))
            )}

            <div ref={conversationEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerMode("reply")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  composerMode === "reply"
                    ? "bg-[#14213D] text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Send size={14} />
                Reply to user
              </button>

              <button
                type="button"
                onClick={() => setComposerMode("internal")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  composerMode === "internal"
                    ? "bg-amber-500 text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <LockKeyhole size={14} />
                Internal note
              </button>
            </div>

            {composerMode === "internal" && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <LockKeyhole
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-700"
                />
                <p className="text-xs leading-5 text-amber-800">
                  Internal notes are private. They are visible to
                  administrators and must never be used for messages
                  intended for the customer.
                </p>
              </div>
            )}

            <form onSubmit={submitMessage}>
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                rows={4}
                maxLength={5000}
                placeholder={
                  composerMode === "internal"
                    ? "Write a private note for the support team..."
                    : "Write your response to the customer..."
                }
                className={`w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                  composerMode === "internal"
                    ? "border-amber-200 focus:border-amber-400 focus:ring-amber-500/10"
                    : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-500/10"
                }`}
              />

              <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-400">
                  {messageText.length}/5000 characters
                </p>

                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    composerMode === "internal"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-[#14213D] hover:bg-[#1d3157]"
                  }`}
                >
                  {sending ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : composerMode === "internal" ? (
                    <LockKeyhole size={15} />
                  ) : (
                    <Send size={15} />
                  )}

                  {sending
                    ? "Sending..."
                    : composerMode === "internal"
                      ? "Add internal note"
                      : "Send reply"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="space-y-5">
          {/* Ticket controls */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FBF0] text-emerald-700">
                <Flag size={17} />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-[#14213D]">
                  Ticket controls
                </h2>
                <p className="text-[11px] text-slate-400">
                  Manage ticket status and priority
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="admin-ticket-status"
                  className="mb-2 block text-xs font-bold text-slate-600"
                >
                  Ticket status
                </label>

                <select
                  id="admin-ticket-status"
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="admin-ticket-priority"
                  className="mb-2 block text-xs font-bold text-slate-600"
                >
                  Priority
                </label>

                <select
                  id="admin-ticket-priority"
                  value={draftPriority}
                  onChange={(event) => setDraftPriority(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={saveTicketChanges}
                disabled={!hasChanges || savingChanges}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] px-4 text-sm font-bold text-white transition hover:bg-[#1d3157] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingChanges ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Save changes
              </button>

              {hasChanges && (
                <p className="text-center text-[11px] font-medium text-amber-600">
                  You have unsaved ticket changes.
                </p>
              )}
            </div>
          </section>

          {/* Customer information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#14213D]">
                Submitted by
              </h2>

              <UserSquare2 size={17} className="text-slate-400" />
            </div>

            <div className="mt-5 flex items-center gap-3">
              {customer?.avatar_url ? (
                <img
                  src={customer.avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FBF0] text-sm font-extrabold text-emerald-800">
                  {getInitials(customerName)}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#14213D]">
                  {customerName}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Support ticket owner
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              <DetailItem
                icon={Mail}
                label="Email"
                value={customer?.email}
              />

              <DetailItem
                icon={Phone}
                label="Phone"
                value={customer?.phone}
              />

              <DetailItem
                icon={UserRound}
                label="Account ID"
                value={customer?.id ?? ticket.user_id}
              />
            </div>
          </section>

          {/* Errand information */}
          {ticket.errand_id && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FileText size={17} />
                </div>

                <div>
                  <h2 className="text-sm font-extrabold text-[#14213D]">
                    Related errand
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Linked transaction
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Errand ID
                </p>
                <p className="mt-1 break-all text-xs font-semibold text-slate-700">
                  {ticket.errand_id}
                </p>
              </div>
            </section>
          )}

          {/* Ticket metadata */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-[#14213D]">
              Ticket information
            </h2>

            <div className="mt-4 space-y-4">
              <DetailItem
                icon={Ticket}
                label="Ticket number"
                value={ticket.ticket_number}
              />

              <DetailItem
                icon={CalendarDays}
                label="Created"
                value={formatDate(ticket.created_at, true)}
              />

              <DetailItem
                icon={Clock3}
                label="Last updated"
                value={formatDate(ticket.updated_at, true)}
              />

              <DetailItem
                icon={CheckCircle2}
                label="Resolved"
                value={formatDate(ticket.resolved_at, true)}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}