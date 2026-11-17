import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "@/components/Modal";
import Select from "@/components/Select";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Search,
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
import { Avatar } from "../shared/data-table/RecordsUI";

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
  open: "bg-sky-50 text-sky-700 border-sky-100",
  in_progress: "bg-amber-50 text-amber-700 border-amber-100",
  awaiting_user: "bg-violet-50 text-violet-700 border-violet-100",
  resolved: "bg-brand-pale text-success border-line",
  closed: "bg-surface-muted text-content-muted border-line",
};

const priorityStyles = {
  low: "bg-surface-muted text-content-muted",
  normal: "bg-sky-50 text-sky-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
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
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-content-muted">
        <Icon size={15} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-content-subtle">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-content">
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
              ? "bg-brand text-white"
              : "bg-brand-pale text-success-dark"
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
          <span className="text-sm font-extrabold text-brand">
            {senderLabel}
          </span>

          {isInternal && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
              Private
            </span>
          )}

          <span className="text-[11px] text-content-subtle">
            {formatDate(message.created_at, true)}
          </span>
        </div>

        <div
          className={`rounded-2xl border px-4 py-3.5 ${
            isInternal
              ? "border-amber-200 bg-amber-50"
              : isAdmin
                ? "border-line bg-brand-pale/70"
                : "border-line bg-surface-white"
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-content">
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-content-subtle">
        <MessageCircle size={24} />
      </div>

      <h3 className="mt-4 font-bold text-brand">
        No messages yet
      </h3>

      <p className="mt-1 text-sm text-content-muted">
        The conversation will appear here when a message is sent.
      </p>
    </div>
  );
}

export default function AdminSupportTicketDetails({ ticketId: providedTicketId, onClose, onOpenCustomer }) {
  const params = useParams();
  const navigate = useNavigate();
  const ticketId = providedTicketId ?? params.ticketId;
  const closeModal = useCallback(() => {
    if (onClose) onClose();
    else navigate("/admin/support", { replace: true });
  }, [onClose, navigate]);
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
  const [conversationSearch, setConversationSearch] = useState("");

  const quickReplies = [
    { label: "Acknowledgement", text: "Thanks for contacting ERANDER Support. We have received your request and are reviewing it. We’ll update you as soon as we have more information." },
    { label: "Need more details", text: "To help us investigate this properly, please share any additional details or supporting screenshots related to this issue." },
    { label: "Under review", text: "Your request is currently under review by our support team. We appreciate your patience and will keep you informed of the next steps." },
    { label: "Resolved", text: "We’ve addressed the issue raised in your ticket. Please let us know if you need any further assistance." },
  ];

  const visibleMessages = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      [message.message, message.sender_name, message.sender_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [messages, conversationSearch]);

  const copyText = async (value, successMessage = "Copied to clipboard.") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(successMessage);
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  };

  const copyTicketSummary = () => {
    const summary = [
      `Ticket: ${ticket.ticket_number ?? ticket.id}`,
      `Subject: ${ticket.subject ?? "—"}`,
      `Customer: ${customerName}`,
      `Email: ${customer?.email ?? "—"}`,
      `Phone: ${customer?.phone ?? "—"}`,
      `Status: ${getStatusLabel(ticket.status)}`,
      `Priority: ${getPriorityLabel(ticket.priority)}`,
      `Category: ${getCategoryLabel(ticket.category)}`,
      `Errand: ${ticket.errand_id ?? "Not linked"}`,
      `Created: ${formatDate(ticket.created_at, true)}`,
      `Description: ${ticket.description ?? "—"}`,
    ].join("\n");
    copyText(summary, "Ticket summary copied.");
  };

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
      <Modal
        isOpen
        onClose={closeModal}
        title="Ticket workspace"
        subtitle="ERANDER support"
        description="Loading ticket details"
        size="xl"
        position="center"
        height="auto"
        headerTone="navy"
        zIndex={100}
      >
        <div role="status" className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-line bg-surface-white">
          <LoaderCircle size={30} className="animate-spin text-success" />
          <p className="mt-3 text-sm font-medium text-content-muted">Loading ticket workspace...</p>
        </div>
      </Modal>
    );
  }

  if (pageError || !ticket) {
    return (
      <Modal
        isOpen
        onClose={closeModal}
        title="Unable to open ticket"
        subtitle="ERANDER support"
        description="Ticket details could not be loaded"
        size="md"
        position="center"
        height="auto"
        headerTone="navy"
        zIndex={100}
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-14 text-center">
          <AlertCircle size={30} className="mx-auto text-rose-600" />
          <h2 className="mt-4 text-lg font-extrabold text-rose-900">Unable to open ticket</h2>
          <p className="mt-2 text-sm text-rose-700">{pageError || "This support ticket could not be found."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={closeModal} className="rounded-full border border-rose-200 bg-surface-white px-5 py-2.5 text-sm font-bold text-rose-700">Back to queue</button>
            <button type="button" onClick={() => loadTicket()} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Try again</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={closeModal}
      title="Ticket workspace"
      subtitle="ERANDER support"
      description={ticket.ticket_number ?? ticket.id}
      size="xl"
      position="center"
      height="auto"
      headerTone="navy"
      zIndex={100}
      closeOnOutsideClick={!sending && !savingChanges}
      closeOnEscape={!sending && !savingChanges}
    >
      <div className="max-h-[82vh] overflow-y-auto p-1 sm:p-2">
      {/* Top navigation */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-content-muted">
          <Ticket size={15} />
          Support ticket workspace
        </div>

        <button
          type="button"
          onClick={() => loadTicket({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-line bg-surface-white px-4 py-2.5 text-sm font-bold text-content-muted transition hover:border-line-strong hover:text-success disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh ticket
        </button>
      </div>

      {/* Ticket heading */}
      <section className="rounded-2xl bg-brand px-5 py-5 text-content-inverse sm:px-7 sm:py-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-content-subtle">
              <Ticket size={14} />
              {ticket.ticket_number ?? "Support ticket"}

              <span className="h-1 w-1 rounded-full bg-white/40" />

              {ticket.ticket_type === "issue"
                ? "Errand issue"
                : "General support"}
            </div>

            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {ticket.subject}
            </h1>

            <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-white/75">
              {ticket.description}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:flex-col xl:items-end">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <button
              type="button"
              onClick={copyTicketSummary}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/15"
            >
              <Copy size={14} /> Copy ticket summary
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-4 text-xs font-medium text-white/70">
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
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-extrabold text-brand">
                Conversation
              </h2>
              <p className="mt-1 text-xs text-content-subtle">
                Customer communication and internal activity
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pale text-success">
              <MessageCircle size={19} />
            </div>
          </div>

          <div className="border-b border-line bg-surface-white px-4 py-3 sm:px-6">
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
              <input
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Find a message in this conversation..."
                className="h-10 w-full rounded-full border border-line bg-surface-muted pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:bg-surface-white focus:ring-2 focus:ring-brand-pale"
              />
            </label>
          </div>

          <div className="max-h-[700px] min-h-80 space-y-6 overflow-y-auto bg-surface-muted/60 px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <ConversationEmptyState />
            ) : (
              visibleMessages.length === 0 ? (
                <p className="py-10 text-center text-sm text-content-muted">No messages match your search.</p>
              ) : visibleMessages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))
            )}

            <div ref={conversationEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-surface-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerMode("reply")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  composerMode === "reply"
                    ? "bg-brand text-white"
                    : "border border-line bg-surface-white text-content-muted hover:bg-surface-muted"
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
                    : "border border-line bg-surface-white text-content-muted hover:bg-surface-muted"
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

            {composerMode === "reply" && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-content-subtle">Quick replies</span>
                {quickReplies.map((reply) => (
                  <button
                    key={reply.label}
                    type="button"
                    onClick={() => setMessageText((current) => current ? `${current}\n\n${reply.text}` : reply.text)}
                    className="rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-[11px] font-bold text-content-muted transition hover:border-line-strong hover:bg-brand-pale hover:text-success"
                  >
                    {reply.label}
                  </button>
                ))}
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
                className={`w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 text-content outline-none transition placeholder:text-content-subtle focus:ring-4 ${
                  composerMode === "internal"
                    ? "border-amber-200 focus:border-amber-400 focus:ring-amber-500/10"
                    : "border-line focus:border-brand focus:ring-brand-pale"
                }`}
              />

              <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-content-subtle">
                  {messageText.length}/5000 characters
                </p>

                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    composerMode === "internal"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-brand hover:opacity-90"
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
          <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-pale text-success">
                <Flag size={17} />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-brand">
                  Ticket controls
                </h2>
                <p className="text-[11px] text-content-subtle">
                  Manage ticket status and priority
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="admin-ticket-status"
                  className="mb-2 block text-xs font-bold text-content-muted"
                >
                  Ticket status
                </label>

                <Select
                  options={statusOptions}
                  value={draftStatus}
                  onChange={setDraftStatus}
                  searchable={false}
                  clearable={false}
                />
              </div>

              <div>
                <label
                  htmlFor="admin-ticket-priority"
                  className="mb-2 block text-xs font-bold text-content-muted"
                >
                  Priority
                </label>

                <Select
                  options={priorityOptions}
                  value={draftPriority}
                  onChange={setDraftPriority}
                  searchable={false}
                  clearable={false}
                />
              </div>

              <button
                type="button"
                onClick={saveTicketChanges}
                disabled={!hasChanges || savingChanges}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
          <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-brand">
                Submitted by
              </h2>

              <UserSquare2 size={17} className="text-content-subtle" />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Avatar profile={customer} size="lg" />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenCustomer?.(customer, customer?.id ?? ticket.user_id)}
                  className="max-w-full truncate text-left text-sm font-extrabold text-brand underline decoration-dotted underline-offset-4 hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {customerName}
                </button>
                <p className="mt-1 text-xs text-content-subtle">View customer profile</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <DetailItem icon={Mail} label="Email" value={customer?.email} />
              {customer?.email && (
                <button type="button" onClick={() => copyText(customer.email, "Customer email copied.")} className="ml-11 -mt-2 text-xs font-bold text-success hover:text-success-dark">Copy email</button>
              )}
              <DetailItem icon={Phone} label="Phone" value={customer?.phone} />
              {customer?.phone && (
                <button type="button" onClick={() => copyText(customer.phone, "Customer phone copied.")} className="ml-11 -mt-2 text-xs font-bold text-success hover:text-success-dark">Copy phone</button>
              )}

              <DetailItem
                icon={UserRound}
                label="Account ID"
                value={customer?.id ?? ticket.user_id}
              />
            </div>
          </section>

          {/* Errand information */}
          {ticket.errand_id && (
            <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FileText size={17} />
                </div>

                <div>
                  <h2 className="text-sm font-extrabold text-brand">
                    Related errand
                  </h2>
                  <p className="text-[11px] text-content-subtle">
                    Linked transaction
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-surface-muted p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-content-subtle">
                  Errand ID
                </p>
                <p className="mt-1 break-all text-xs font-semibold text-content">
                  {ticket.errand_id}
                </p>
              </div>
            </section>
          )}

          {/* Ticket metadata */}
          <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-brand">
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
    </Modal>
  );
}