import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  CheckCircle2,
  CreditCard,
  FileText,
  Flag,
  Inbox,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Package,
  Shield,
  ShieldCheck,
  User,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import Select from "@/components/Select";
import { createSupportTicket } from "@/services/support/supportApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  { value: "account", label: "Account", description: "Login, email, or profile issues", icon: User },
  { value: "verification", label: "Verification", description: "ID or account verification", icon: ShieldCheck },
  { value: "payment", label: "Payment", description: "Funding or payment problems", icon: CreditCard },
  { value: "wallet", label: "Wallet", description: "Balance or transaction issues", icon: Wallet },
  { value: "withdrawal", label: "Withdrawal", description: "Withdrawal problems", icon: Banknote },
  { value: "errand", label: "Errand", description: "Errand-specific problems", icon: FileText },
  { value: "erander", label: "Erander", description: "Issues with an erander", icon: Briefcase },
  { value: "customer", label: "Customer", description: "Issues with a customer", icon: Users },
  { value: "missing_item", label: "Missing item", description: "An item was not delivered", icon: Inbox },
  { value: "damaged_item", label: "Damaged item", description: "An item arrived damaged", icon: Package },
  { value: "technical", label: "Technical issue", description: "App or site bugs", icon: Wrench },
  { value: "safety", label: "Safety", description: "Safety or security concern", icon: Shield },
  { value: "fraud", label: "Fraud or suspicious activity", description: "Suspected fraud", icon: AlertTriangle },
  { value: "chat", label: "Chat or message", description: "Report a conversation or message", icon: MessageSquare },
  { value: "other", label: "Other", description: "Something else", icon: LifeBuoy },
];

const PRIORITIES = [
  { value: "low", label: "Low", description: "Non-urgent, can wait" },
  { value: "normal", label: "Normal", description: "Standard response time" },
  { value: "high", label: "High", description: "Needs attention soon" },
  { value: "urgent", label: "Urgent", description: "Requires immediate action" },
];

/* Chat-report reasons. `category` / `priority` map to ticket fields. */
const CHAT_REPORT_REASONS = [
  { value: "fraud_scam", label: "Fraud or scam attempt", category: "fraud", priority: "high" },
  { value: "off_platform_contact", label: "Attempt to move payment or communication off-platform", category: "chat" },
  { value: "harassment", label: "Harassment or unwanted contact", category: "safety", priority: "high" },
  { value: "abuse", label: "Abusive or threatening language", category: "safety", priority: "high" },
  { value: "unsafe_request", label: "Unsafe or prohibited request", category: "safety", priority: "high" },
  { value: "spam", label: "Spam or repeated unwanted messages", category: "chat" },
  { value: "other", label: "Something else", category: "chat" },
];

const PRIORITY_DOT = {
  low: "bg-slate-400",
  normal: "bg-emerald-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const INPUT =
  "w-full rounded-2xl border border-line bg-surface-white px-4 py-3 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 aria-[invalid=true]:border-rose-400";

const LABEL = "mb-2 flex items-center gap-1.5 text-sm font-extrabold text-content";

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_PRIMARY = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;

const FORM_ID = "create-support-ticket-form";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function getTicketFromResponse(response) {
  return response?.ticket || response?.data?.ticket || response?.data || response;
}

function getApiErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    "We couldn't submit your support request. Please try again."
  );
}

function getErrandId(errand) {
  return errand?.id || errand?.erand_id || errand?.errand_id || null;
}

function getErrandTitle(errand) {
  return errand?.title || errand?.errand_title || errand?.name || "Errand details unavailable";
}

function getReference(errand) {
  return errand?.reference_code || errand?.reference || getErrandId(errand) || "";
}

function getTransactionDescription(reportingAbout) {
  if (!reportingAbout) return "";
  return reportingAbout.description || [
    "WALLET TRANSACTION REPORT",
    "",
    `Transaction type: ${reportingAbout.title || "Transaction"}`,
    `Amount: ${reportingAbout.amount || "Not available"}`,
    `Status: ${reportingAbout.status || "Not available"}`,
    `Reference: ${reportingAbout.reference || "Not available"}`,
    `Transaction ID: ${reportingAbout.transactionId || "Not available"}`,
    `Date: ${reportingAbout.date || "Not available"}`,
    reportingAbout.withdrawalRequestId ? `Withdrawal request ID: ${reportingAbout.withdrawalRequestId}` : "",
    reportingAbout.bankName ? `Destination bank: ${reportingAbout.bankName}` : "",
    reportingAbout.accountLast4 ? `Destination account ending: ${reportingAbout.accountLast4}` : "",
    reportingAbout.reason ? `Recorded reason: ${reportingAbout.reason}` : "",
  ].filter(Boolean).join("\n");
}

/** NEW — resolves a chat reason safely (falls back to "other"). */
function getChatReason(reasonCode) {
  return (
    CHAT_REPORT_REASONS.find((reason) => reason.value === reasonCode) ||
    CHAT_REPORT_REASONS[CHAT_REPORT_REASONS.length - 1]
  );
}

/** NEW — default subject for a chat report. */
function getChatSubject(chatReport) {
  if (!chatReport) return "";
  const target = chatReport.otherDisplayName || "conversation";
  return `Chat report: ${target}`;
}

/* -------------------------------------------------------------------------- */
/*                              SHARED SUB-UI                                 */
/* -------------------------------------------------------------------------- */

function FieldLabel({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} className={LABEL}>
      <span>{children}</span>
      {required ? <span className="text-rose-500" aria-hidden="true">*</span> : null}
    </label>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-rose-600">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function RequestTypeTile({ active, onClick, icon: Icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        active
          ? "border-brand bg-brand-pale/60 ring-2 ring-brand/10"
          : "border-line bg-surface-white hover:border-line-strong hover:bg-surface-muted/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          active ? "bg-brand text-brand-mint" : "bg-surface-muted text-content-muted group-hover:text-content"
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-content">{title}</span>
          {active ? <CheckCircle2 size={16} className="shrink-0 text-brand" aria-hidden="true" /> : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-content-muted">{description}</span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                            REPORTING CONTEXT                               */
/* -------------------------------------------------------------------------- */

function ReportingAboutCard({ reportingAbout, errand, chatReport }) {
  /* ── Wallet transaction ─────────────────────────────────── */
  if (reportingAbout) {
    return (
      <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-pale/70 to-surface-white">
        <div className="flex items-start gap-3.5 p-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-mint shadow-sm">
            <Wallet size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-content-muted">Reporting about</p>
            <h3 className="mt-1 text-sm font-extrabold text-content">Wallet transaction</h3>
            <p className="mt-0.5 break-words text-sm leading-5 text-content-muted">
              {reportingAbout.title || "Transaction"}
            </p>
          </div>
          {reportingAbout.amount ? (
            <p className="shrink-0 text-base font-extrabold tabular-nums text-content">{reportingAbout.amount}</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-brand/10 bg-surface-white/60 p-4 sm:p-5">
          {[
            ["Status", reportingAbout.status],
            ["Reference", reportingAbout.reference],
            ["Transaction ID", reportingAbout.transactionId],
            ["Date", reportingAbout.date],
            ["Withdrawal request", reportingAbout.withdrawalRequestId],
            ["Bank", reportingAbout.bankName],
          ].filter(([, value]) => value).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{label}</dt>
              <dd className="mt-1 break-all text-xs font-bold text-content">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-brand/10 bg-surface-white/40 px-4 py-3 text-[11px] leading-5 text-content-muted sm:px-5">
          These transaction details will be included with your request so the support team can investigate the correct record.
        </p>
      </div>
    );
  }

  /* ── Chat conversation ──────────────────────────────────── */
  if (chatReport) {
    const reason = getChatReason(chatReport.reasonCode);
    const chatIdShort = chatReport.chatId ? `${String(chatReport.chatId).slice(0, 8)}…` : null;
    const messageMeta = chatReport.messageId ? "Specific message reported" : "Whole conversation";

    return (
      <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-pale/70 to-surface-white">
        <div className="flex items-start gap-3.5 p-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-mint shadow-sm">
            <MessageSquare size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-content-muted">Reporting about</p>
            <h3 className="mt-1 text-sm font-extrabold text-content">Chat conversation</h3>
            <p className="mt-0.5 break-words text-sm leading-5 text-content-muted">
              with {chatReport.otherDisplayName || "another party"}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-brand/10 bg-surface-white/60 p-4 sm:p-5">
          {chatReport.errand?.title ? (
            <div className="col-span-2 min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-content-muted">Errand</dt>
              <dd className="mt-1 break-words text-xs font-bold text-content">{chatReport.errand.title}</dd>
            </div>
          ) : null}
          {[
            ["Errand reference", chatReport.errand?.reference_code],
            ["Chat", chatIdShort],
            ["Scope", messageMeta],
            ["Reason", reason?.label],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{label}</dt>
                <dd className="mt-1 break-all text-xs font-bold text-content">{value}</dd>
              </div>
            ))}
        </dl>

        <p className="border-t border-brand/10 bg-surface-white/40 px-4 py-3 text-[11px] leading-5 text-content-muted sm:px-5">
          This conversation is retained by ERANDER and may be reviewed by our trust &amp; safety team.
        </p>
      </div>
    );
  }

  /* ── Errand ─────────────────────────────────────────────── */
  if (!errand) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-pale/70 to-surface-white">
      <div className="flex items-start gap-3.5 p-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-mint shadow-sm">
          <FileText size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-content-muted">Reporting about</p>
          <h3 className="mt-1 break-words text-sm font-extrabold text-content">{getErrandTitle(errand)}</h3>
          <p className="mt-0.5 break-all text-xs font-medium text-content-muted">
            Reference: {getReference(errand) || "Not available"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-brand/10 bg-surface-white/60 px-4 py-3 sm:px-5">
        <span className="text-xs font-semibold text-content-muted">Errand status</span>
        <span className="rounded-full bg-brand-pale px-3 py-1 text-[11px] font-extrabold capitalize text-content">
          {String(errand.status || "Not available").replaceAll("_", " ")}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PAGE HEADER (STANDALONE)                      */
/* -------------------------------------------------------------------------- */

function PageHeader({ icon: Icon, title, description, onBack }) {
  return (
    <div className="mb-7">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-content-muted transition hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-mint shadow-lg shadow-brand/15">
          <Icon size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

/**
 * CreateSupportTicket
 *
 * Mode A — controlled modal: pass `open`, `onClose`, `onCreated`.
 * Mode B — standalone page: omit `open` and mount as a route.
 *
 * Contextual props (mutually exclusive, priority top → bottom):
 *   - `chatReport` — { chatId, messageId?, otherDisplayName?, errand?: { id, title, reference_code }, reasonCode? }
 *                    Opens the "Report a chat or message" flow. Adds a
 *                    reason selector, pre-fills category/priority, and
 *                    dispatches `chat_id` / `message_id` / `reason_code`.
 *   - `reportingAbout` — wallet transaction context (existing).
 *   - `errand` / `errandId` — errand context (existing).
 */
export default function CreateSupportTicket({
  open,
  onClose,
  onCreated,
  errandId,
  errand,
  reportingAbout,
  chatReport, // NEW
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isControlledModal = typeof open === "boolean";
  const queryErrandId = searchParams.get("errandId");

  const isChatReport = Boolean(chatReport); // NEW
  const isWalletReport = Boolean(reportingAbout);

  const initialErrand = useMemo(() => {
    if (reportingAbout) return null;
    if (chatReport) return null; // chat report never needs an errand link
    if (errand) return errand;
    const id = errandId || queryErrandId;
    if (!id) return null;
    return { id, reference_code: id, title: "Errand details unavailable", status: null };
  }, [reportingAbout, chatReport, errand, errandId, queryErrandId]);

  const isErrandReport = Boolean(initialErrand) && !isWalletReport && !isChatReport;
  const linkedErrandId = isErrandReport ? getErrandId(initialErrand) : null;

  /* ------------------------------ Form state ------------------------------ */

  const defaultChatReason = getChatReason(chatReport?.reasonCode);

  const [ticketType, setTicketType] = useState(
    isErrandReport || isChatReport ? "issue" : "support"
  );

  const [category, setCategory] = useState(
    isWalletReport
      ? reportingAbout.category || "wallet"
      : isErrandReport
        ? "errand"
        : isChatReport
          ? defaultChatReason.category
          : "other"
  );

  const [priority, setPriority] = useState(
    isChatReport ? defaultChatReason.priority || "normal" : "normal"
  );

  const [subject, setSubject] = useState(
    isWalletReport
      ? reportingAbout.subject || "Wallet transaction: Transaction"
      : isErrandReport
        ? `Issue with ${getErrandTitle(initialErrand)}`
        : isChatReport
          ? getChatSubject(chatReport)
          : ""
  );

  const [description, setDescription] = useState(
    isWalletReport ? getTransactionDescription(reportingAbout) : ""
  );

  // NEW: chat reason code (may arrive pre-set via `chatReport.reasonCode`)
  const [chatReasonCode, setChatReasonCode] = useState(
    chatReport?.reasonCode || "other"
  );

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isWalletReport) {
      setTicketType("support");
      setCategory(reportingAbout.category || "wallet");
      setSubject(reportingAbout.subject || "Wallet transaction: Transaction");
      setDescription(getTransactionDescription(reportingAbout));
    }
  }, [isWalletReport, reportingAbout]);

  // NEW: re-sync category & priority whenever the chat reason changes.
  // Skipped on non-chat reports.
  useEffect(() => {
    if (!isChatReport) return;
    const reason = getChatReason(chatReasonCode);
    if (reason?.category) setCategory(reason.category);
    if (reason?.priority) setPriority(reason.priority);
  }, [isChatReport, chatReasonCode]);

  const availableCategories = useMemo(() => {
    if (isWalletReport) {
      return CATEGORIES.filter((item) =>
        ["wallet", "payment", "withdrawal", "other"].includes(item.value)
      );
    }
    if (isChatReport) {
      return CATEGORIES.filter((item) =>
        ["chat", "safety", "fraud", "other"].includes(item.value)
      );
    }
    return CATEGORIES;
  }, [isWalletReport, isChatReport]);

  /* ------------------------------- Metadata ------------------------------- */

  const pageIcon = isWalletReport
    ? Wallet
    : isErrandReport
      ? Flag
      : isChatReport
        ? MessageSquare
        : LifeBuoy;

  const pageTitle = isWalletReport
    ? "Report a wallet transaction"
    : isErrandReport
      ? "Report an errand issue"
      : isChatReport
        ? "Report a chat or message"
        : "Contact support";

  const pageDescription = isWalletReport
    ? "Tell us what went wrong with this wallet transaction."
    : isErrandReport
      ? "Describe the problem with this errand so our team can investigate."
      : isChatReport
        ? "Tell us what happened in this conversation so our team can review it."
        : "Send a message to the ERANDER support team.";

  const pageSubtitle = isWalletReport
    ? "Wallet transaction"
    : isErrandReport
      ? `Errand ${getReference(initialErrand) || ""}`.trim()
      : isChatReport
        ? "Chat report"
        : "Support";

  /* ------------------------------ Validation ------------------------------ */

  const validate = () => {
    const nextErrors = {};

    if (!subject.trim()) {
      nextErrors.subject = "Enter a subject for your request.";
    } else if (subject.trim().length < 4) {
      nextErrors.subject = "The subject must be at least 4 characters.";
    }

    if (!description.trim()) {
      nextErrors.description = isChatReport
        ? "Tell us what happened in the conversation."
        : "Describe the issue you need help with.";
    } else if (description.trim().length < 10) {
      nextErrors.description = "Please provide a little more detail (at least 10 characters).";
    }

    // Errand issue must be linked to an errand — chat and wallet reports are exempt.
    if (ticketType === "issue" && !linkedErrandId && !isChatReport && !isWalletReport) {
      nextErrors.errand = "An errand must be linked to report an errand issue.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /* -------------------------------- Submit -------------------------------- */

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);

    try {
      const payload = {
        ticket_type: isWalletReport ? "support" : isChatReport ? "issue" : ticketType,
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
      };

      if (!isWalletReport && !isChatReport && ticketType === "issue" && linkedErrandId) {
        payload.errand_id = linkedErrandId;
      }

      // NEW: chat report metadata
      if (isChatReport) {
        payload.chat_id = chatReport.chatId;
        if (chatReport.messageId) payload.message_id = chatReport.messageId;
        if (chatReasonCode) payload.reason_code = chatReasonCode;
        if (chatReport.errand?.id) payload.errand_id = chatReport.errand.id;
      }

      const response = await createSupportTicket(payload);
      const ticket = getTicketFromResponse(response);

      toast.success(
        isChatReport
          ? "Your report has been sent to ERANDER for review."
          : "Your support request has been submitted."
      );

      onCreated?.(ticket);

      if (!isControlledModal) {
        const ticketId = ticket?.id || ticket?.ticket?.id || ticket?.ticket_id;
        if (ticketId) navigate(`/dashboard/support/${ticketId}`);
        else navigate("/dashboard/support");
      } else {
        onClose?.();
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------- Footer -------------------------------- */

  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={isControlledModal ? onClose : () => navigate(-1)}
        disabled={submitting}
        className={BTN_GHOST}
      >
        Cancel
      </button>
      <button type="submit" form={FORM_ID} disabled={submitting} className={BTN_PRIMARY}>
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Submitting…
          </>
        ) : isChatReport ? (
          <>
            <AlertTriangle size={16} aria-hidden="true" />
            Submit report
          </>
        ) : (
          <>
            <MessageSquare size={16} aria-hidden="true" />
            Submit request
          </>
        )}
      </button>
    </div>
  );

  /* -------------------------------- Fields -------------------------------- */

  const fields = (
    <div className="space-y-5">
      <ReportingAboutCard
        reportingAbout={reportingAbout}
        errand={initialErrand}
        chatReport={chatReport}   // NEW
      />

      {/* Request type tile only when there's no context */}
      {!isWalletReport && !isErrandReport && !isChatReport ? (
        <div>
          <p className="mb-2 text-sm font-extrabold text-content">Request type</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RequestTypeTile
              active={ticketType === "support"}
              onClick={() => setTicketType("support")}
              icon={MessageSquare}
              title="General support"
              description="Ask a question or request assistance."
            />
            <RequestTypeTile
              active={ticketType === "issue"}
              onClick={() => setTicketType("issue")}
              icon={Flag}
              title="Report an issue"
              description="Report a problem with an errand."
            />
          </div>
        </div>
      ) : null}

      {/* NEW: Chat-report reason selector */}
      {isChatReport ? (
        <div>
          <p className={LABEL}>Reason for report</p>
          <Select
            options={CHAT_REPORT_REASONS}
            value={chatReasonCode}
            onChange={(value) => setChatReasonCode(value)}
            placeholder="Choose a reason"
            searchable={false}
            showIcon={false}
            labelKey="label"
            valueKey="value"
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            Pick the option that best matches what happened. Every report is reviewed by our team.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className={LABEL}>Category</p>
          <Select
            options={availableCategories}
            value={category}
            onChange={(value) => setCategory(value)}
            placeholder="Choose a category"
            searchPlaceholder="Search categories"
            searchable
            labelKey="label"
            valueKey="value"
            descriptionKey="description"
            showIcon
          />
        </div>

        <div>
          <p className={LABEL}>Priority</p>
          <Select
            options={PRIORITIES}
            value={priority}
            onChange={(value) => setPriority(value)}
            placeholder="Choose priority"
            searchable={false}
            showIcon={false}
            renderValue={(option) =>
              option ? (
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[option.value]}`} aria-hidden="true" />
                  <span>{option.label}</span>
                </span>
              ) : null
            }
            renderOption={({ option }) => (
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[option.value]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-content">{option.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-content-muted">{option.description}</p>
                </div>
              </div>
            )}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            Use urgent only for safety concerns or suspected fraud.
          </p>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="support-subject" required>Subject</FieldLabel>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setErrors((previous) => ({ ...previous, subject: "" }));
          }}
          maxLength={160}
          placeholder="Briefly describe what you need help with"
          className={INPUT}
          aria-invalid={Boolean(errors.subject)}
        />
        <FieldError>{errors.subject}</FieldError>
      </div>

      <div>
        <FieldLabel htmlFor="support-description" required>
          {isChatReport ? "What happened?" : "Description"}
        </FieldLabel>
        <textarea
          id="support-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setErrors((previous) => ({ ...previous, description: "" }));
          }}
          rows={isWalletReport ? 9 : 7}
          maxLength={10000}
          placeholder={
            isChatReport
              ? "Describe what was said or done that made you report this conversation…"
              : "Explain what happened and what you need help with…"
          }
          className={`${INPUT} min-h-[160px] resize-y leading-6`}
          aria-invalid={Boolean(errors.description)}
        />
        <FieldError>{errors.description}</FieldError>
        <p className="mt-1.5 text-right text-xs tabular-nums text-content-subtle">
          {description.length.toLocaleString()}/10,000
        </p>
      </div>

      {errors.errand ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{errors.errand}</span>
        </div>
      ) : null}

      {isWalletReport ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-brand/15 bg-brand-pale/50 p-3.5 text-xs leading-5 text-content-muted">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Transaction details are included above. Add your explanation after the transaction info so the support team understands exactly what happened.
          </span>
        </div>
      ) : null}

      {isChatReport ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-brand/15 bg-brand-pale/50 p-3.5 text-xs leading-5 text-content-muted">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Submitting this report will not close the conversation. Our trust &amp; safety team will review it and may contact you for more details.
          </span>
        </div>
      ) : null}
    </div>
  );

  /* -------------------------------- Modal -------------------------------- */

  if (isControlledModal) {
    return (
      <Modal
        isOpen={open}
        onClose={onClose}
        icon={pageIcon}
        tone={isChatReport ? "danger" : "success"}
        title={pageTitle}
        subtitle={pageSubtitle}
        description={pageDescription}
        size="lg"
        position="center"
        dismissible={!submitting}
        loading={submitting}
        footer={footer}
      >
        <form id={FORM_ID} onSubmit={handleSubmit} className="pb-1">
          {fields}
        </form>
      </Modal>
    );
  }

  /* ------------------------------ Standalone ------------------------------ */

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-2xl sm:px-6 lg:py-10">
        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-line bg-surface-white shadow-sm"
        >
          <div className="p-5 sm:p-8">
            <PageHeader
              icon={pageIcon}
              title={pageTitle}
              description={pageDescription}
              onBack={() => navigate(-1)}
            />
            {fields}
          </div>
          <div className="border-t border-line-soft bg-surface-muted/30 px-5 py-4 sm:px-8">
            {footer}
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}