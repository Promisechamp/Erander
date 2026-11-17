import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Flag,
  Landmark,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  Package,
  Receipt,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";

import Modal from "@/components/Modal";
import CreateSupportTicket from "@/pages/support/CreateSupportTicket";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const TYPE_ICONS = {
  deposit: ArrowDownLeft,
  errand_payment: Package,
  errand_earning: Banknote,
  withdrawal: ArrowUpRight,
  refund: RotateCcw,
  reservation: LockKeyhole,
};

const TYPE_LABELS = {
  deposit: "Deposit",
  errand_payment: "Errand payment",
  errand_earning: "Errand earning",
  withdrawal: "Withdrawal",
  refund: "Refund",
  reservation: "Security deposit",
};

const SUCCESS = [
  "successful",
  "completed",
  "paid",
  "released",
  "settled",
  "confirmed",
  "active",
];

const ATTENTION = [
  "pending",
  "approved",
  "processing",
  "submitted",
  "under_review",
  "reserved",
];

const DANGER = ["failed", "rejected", "reversed"];

const PILL = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  attention: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-surface-muted text-content-muted ring-line",
};

const BAR = {
  success: "border-l-success",
  attention: "border-l-amber-400",
  danger: "border-l-rose-500",
  neutral: "border-l-line-strong",
};

const MODAL_TONE = {
  success: "success",
  attention: "warning",
  danger: "danger",
  neutral: "info",
};

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_PRIMARY = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;
const BTN_DANGER_SOFT = `${BTN} border border-rose-200 bg-surface-white text-rose-700 hover:bg-rose-50`;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const lower = (value) => String(value || "").toLowerCase();

function group(status) {
  const value = lower(status);

  if (SUCCESS.includes(value)) return "success";
  if (ATTENTION.includes(value)) return "attention";
  if (DANGER.includes(value)) return "danger";

  return "neutral";
}

const humanize = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function formatMoney(value, currency) {
  const cur = currency || "NGN";

  try {
    return new Intl.NumberFormat(cur === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${cur} ${Number(value || 0).toFixed(2)}`;
  }
}

const formatMinor = (value, currency) =>
  formatMoney(Number(value || 0) / 100, currency);

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function copy(text, label, onToast) {
  try {
    await navigator.clipboard.writeText(String(text));
    onToast?.success(label);
  } catch {
    onToast?.error("Couldn't copy to the clipboard");
  }
}

function explain({ isWithdrawal, type, status }) {
  const value = lower(status);

  if (isWithdrawal) {
    if (value === "pending") {
      return "Your request is waiting for ERANDER Finance to review it. The amount is held until then. You can cancel while it is pending.";
    }

    if (value === "approved") {
      return "Your request was approved. The bank transfer will start soon.";
    }

    if (value === "processing") {
      return "The transfer to your bank is in progress. Your bank may take a little time to show it.";
    }

    if (SUCCESS.includes(value)) {
      return "The money was sent to your bank account.";
    }

    if (value === "rejected") {
      return "This request was rejected, so no transfer was made. The reserved amount returned to your available balance.";
    }

    if (value === "failed") {
      return "The transfer to your bank did not go through. The reserved amount returned to your available balance.";
    }

    if (value === "cancelled") {
      return "You cancelled this request. The reserved amount returned to your available balance.";
    }
  }

  if (type === "deposit") {
    if (value === "pending") {
      return "We are waiting for Paystack to confirm this payment. If you already paid, tap Verify to check it now.";
    }

    if (SUCCESS.includes(value)) {
      return "This deposit was confirmed and added to your wallet.";
    }

    if (value === "failed") {
      return "This payment did not go through, so nothing was added to your wallet.";
    }
  }

  if (type === "refund") {
    if (SUCCESS.includes(value)) {
      return "This refund was credited to your wallet.";
    }

    if (value === "pending" || value === "processing") {
      return "Your refund is being processed.";
    }
  }

  if (type === "reservation") {
    return "This amount is held as a security deposit for an errand and is not part of your available balance.";
  }

  if (type === "errand_payment") {
    return "This is a payment made for an errand.";
  }

  if (type === "errand_earning") {
    return "This is money you earned from an errand.";
  }

  if (value === "pending" || value === "processing") {
    return "This transaction is still being processed.";
  }

  if (SUCCESS.includes(value)) {
    return "This transaction is complete.";
  }

  if (value === "failed" || value === "rejected") {
    return "This transaction did not complete.";
  }

  return "";
}

function buildSteps(request) {
  const status = lower(request.status);

  const steps = [
    {
      label: "Submitted",
      at: request.created_at,
      state: "done",
    },
  ];

  if (status === "rejected") {
    steps.push({
      label: "Rejected",
      at: request.reviewed_at || request.updated_at,
      state: "failed",
    });

    return steps;
  }

  if (status === "cancelled") {
    steps.push({
      label: "Cancelled",
      at: request.updated_at,
      state: "failed",
    });

    return steps;
  }

  const ranks = {
    pending: 0,
    approved: 1,
    processing: 2,
    completed: 3,
    paid: 3,
    successful: 3,
  };

  const failed = status === "failed";

  const rank = failed
    ? request.processed_at
      ? 2
      : request.reviewed_at
        ? 1
        : 0
    : ranks[status] ?? 0;

  const labels = [
    ["Reviewed", request.reviewed_at],
    ["Transfer started", request.processed_at],
    ["Completed", request.completed_at],
  ];

  labels.forEach(([label, at], index) => {
    const position = index + 1;

    if (failed && position === rank + 1) {
      steps.push({
        label: "Transfer failed",
        at: request.updated_at,
        state: "failed",
      });

      return;
    }

    if (failed && position > rank + 1) return;

    steps.push({
      label,
      at,
      state:
        position <= rank
          ? "done"
          : position === rank + 1
            ? "current"
            : "upcoming",
    });
  });

  return steps;
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Pill({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        PILL[group(status)]
      }`}
    >
      {humanize(status) || "Pending"}
    </span>
  );
}

function Notice({
  tone = "danger",
  icon: Icon = AlertTriangle,
  title,
  children,
}) {
  const styles =
    tone === "danger"
      ? "border-rose-500 bg-rose-50 text-rose-950"
      : tone === "warning"
        ? "border-amber-400 bg-amber-50 text-amber-950"
        : "border-brand-green bg-brand-pale text-brand";

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-r-2xl border-l-4 p-4 ${styles}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />

      <div className="min-w-0">
        <p className="text-sm font-extrabold">{title}</p>

        <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 opacity-90">
          {children}
        </div>
      </div>
    </div>
  );
}

function Line({ label, children }) {
  if (children === null || children === undefined || children === "") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-sm text-content-muted">{label}</dt>

      <dd className="min-w-0 max-w-[65%] break-words text-right text-sm font-semibold text-content">
        {children}
      </dd>
    </div>
  );
}

function CopyValue({ value, label, toast }) {
  return (
    <span className="inline-flex max-w-full items-center justify-end gap-1.5">
      <span className="min-w-0 break-all">{value}</span>

      <button
        type="button"
        onClick={() => copy(value, label, toast)}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 rounded-full p-1.5 text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Copy size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-extrabold text-content">{title}</h3>
      {children}
    </section>
  );
}

function Stepper({ steps }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;

        const dot =
          step.state === "done"
            ? "bg-brand-green text-brand"
            : step.state === "failed"
              ? "bg-rose-500 text-white"
              : step.state === "current"
                ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
                : "bg-surface-muted text-content-subtle";

        return (
          <li
            key={`${step.label}-${index}`}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${
                  step.state === "done" ? "bg-brand-green" : "bg-line"
                }`}
              />
            ) : null}

            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot}`}
            >
              {step.state === "done" ? (
                <Check size={14} strokeWidth={3} aria-hidden="true" />
              ) : step.state === "failed" ? (
                <X size={14} strokeWidth={3} aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-current" />
              )}
            </span>

            <div className="min-w-0 pt-0.5">
              <p
                className={`text-sm font-bold ${
                  step.state === "upcoming"
                    ? "text-content-subtle"
                    : "text-content"
                }`}
              >
                {step.label}
              </p>

              <p className="text-xs text-content-muted">
                {step.at
                  ? formatDate(step.at)
                  : step.state === "current"
                    ? "Waiting"
                    : step.state === "upcoming"
                      ? "Not yet"
                      : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RelatedItem({ item, currency }) {
  const cur = item.currency_code || currency;

  const amount =
    item.amount_minor != null
      ? formatMinor(item.amount_minor, cur)
      : item.requested_amount_minor != null
        ? formatMinor(item.requested_amount_minor, cur)
        : item.amount != null
          ? formatMoney(item.amount, cur)
          : null;

  const title =
    item.reference ||
    item.reference_code ||
    item.transaction_type ||
    item.payment_type ||
    item.type ||
    item.event_type ||
    "Record";

  const reason =
    item.rejection_reason ||
    item.failure_reason ||
    item.claim_reason ||
    item.reason ||
    item.description;

  const status = item.status || item.processing_status;
  const fundingMetadata = item.metadata || {};
  const hasFundingBreakdown =
    fundingMetadata.wallet_contribution_minor != null ||
    fundingMetadata.paystack_contribution_minor != null;

  return (
    <div className="rounded-2xl border border-line bg-surface-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all text-sm font-bold text-content">
          {/^[a-z_]+$/.test(String(title)) ? humanize(title) : title}
        </p>

        {status ? <Pill status={status} /> : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
        <span>{formatDate(item.created_at)}</span>

        {amount ? (
          <span className="text-sm font-extrabold tabular-nums text-content">
            {amount}
          </span>
        ) : null}
      </div>

      {reason ? (
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-surface-muted/70 p-2.5 text-xs leading-5 text-content-muted">
          {reason}
        </p>
      ) : null}

      {hasFundingBreakdown ? (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-surface-muted/60 p-2.5 text-xs">
          <div>
            <p className="text-content-subtle">Wallet contribution</p>
            <p className="mt-0.5 font-extrabold tabular-nums text-content">
              {formatMinor(fundingMetadata.wallet_contribution_minor || 0, cur)}
            </p>
          </div>
          <div>
            <p className="text-content-subtle">Paystack contribution</p>
            <p className="mt-0.5 font-extrabold tabular-nums text-content">
              {formatMinor(fundingMetadata.paystack_contribution_minor || 0, cur)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RelatedGroup({ title, rows, currency }) {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(rows) || !rows.length) return null;

  return (
    <div className="rounded-2xl border border-line">
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="text-sm font-bold text-content">
          {title}

          <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-content-muted">
            {rows.length}
          </span>
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-content-subtle transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-line-soft p-3">
          {rows.map((item, index) => (
            <RelatedItem
              key={item.id || `${title}-${index}`}
              item={item}
              currency={currency}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MODAL                                   */
/* -------------------------------------------------------------------------- */

export default function WalletTransactionModal({
  open,
  transaction,
  details,
  fallbackRequest,
  loading,
  error,
  currency,
  verifying,
  cancelling,
  toast,
  onClose,
  onRetry,
  onVerify,
  onViewErrand,
  onCancelWithdrawal,
}) {
  const [supportOpen, setSupportOpen] = useState(false);

  const tx = transaction;

  const requests = useMemo(() => {
    if (details?.withdrawalRequests?.length) {
      return details.withdrawalRequests;
    }

    return fallbackRequest ? [fallbackRequest] : [];
  }, [details, fallbackRequest]);

  const request = requests[0] || null;
  const isWithdrawal = tx?.type === "withdrawal" || Boolean(request);

  const status = isWithdrawal && request ? request.status : tx?.status;
  const statusGroup = group(status);
  const type = isWithdrawal ? "withdrawal" : tx?.type;

  const incoming = tx?.direction === "credit";
  const reserved = tx?.direction === "reserved";
  const cur = tx?.currency || request?.currency_code || currency;

  const reason =
    request?.rejection_reason ||
    request?.failure_reason ||
    tx?.rejectionReason ||
    tx?.failureReason ||
    tx?.failure_reason ||
    "";

  const lowerStatus = lower(status);
  const needsReason =
    ["rejected", "failed"].includes(lowerStatus) || Boolean(reason);

  const returnsFunds = ["rejected", "failed", "cancelled"].includes(
    lowerStatus
  );

  const steps = useMemo(
    () => (request ? buildSteps(request) : []),
    [request]
  );

  const canVerify =
    tx?.type === "deposit" &&
    lower(tx?.status) === "pending" &&
    tx?.providerReference;

  const canCancel =
    request && lower(request.status) === "pending" && request.id;

  const Icon = TYPE_ICONS[type] || Receipt;

  const summary = explain({
    isWithdrawal,
    type,
    status,
  });

  const errand = details?.errand;
  const errandId = tx?.relatedErandId || errand?.id;

  const transactionDate =
    tx?.createdAt || tx?.created_at || request?.created_at;

  const transactionReference =
    tx?.reference || request?.reference || tx?.providerReference;

  const transactionId = tx?.id || tx?.transactionId || tx?.transaction_id;

  const transactionLabel = TYPE_LABELS[type] || humanize(type) || "Transaction";

  const supportCategory =
    type === "withdrawal"
      ? "withdrawal"
      : ["deposit", "refund", "errand_payment"].includes(type)
        ? "payment"
        : "wallet";

  const reportingAbout = useMemo(() => {
    if (!tx) return null;

    const detailsText = [
      "WALLET TRANSACTION REPORT",
      "",
      `Transaction type: ${transactionLabel}`,
      `Amount: ${formatMoney(tx.amount, cur)}`,
      `Status: ${humanize(status) || "Unknown"}`,
      `Reference: ${transactionReference || "Not available"}`,
      `Transaction ID: ${transactionId || "Not available"}`,
      `Date: ${formatDate(transactionDate) || "Not available"}`,
      request?.id ? `Withdrawal request ID: ${request.id}` : "",
      request?.bank_name_snapshot
        ? `Destination bank: ${request.bank_name_snapshot}`
        : "",
      request?.account_number_last4_snapshot
        ? `Destination account ending: ${request.account_number_last4_snapshot}`
        : "",
      reason ? `Recorded reason: ${reason}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      type: "wallet_transaction",
      title: transactionLabel,
      subject: `Wallet transaction: ${transactionLabel}`,
      category: supportCategory,
      amount: formatMoney(tx.amount, cur),
      currency: cur,
      status: humanize(status) || "Unknown",
      reference: transactionReference || "",
      transactionId: transactionId || "",
      date: formatDate(transactionDate),
      withdrawalRequestId: request?.id || "",
      bankName: request?.bank_name_snapshot || "",
      accountLast4: request?.account_number_last4_snapshot || "",
      reason,
      description: detailsText,
    };
  }, [
    tx,
    transactionLabel,
    cur,
    status,
    transactionReference,
    transactionId,
    transactionDate,
    request,
    reason,
    supportCategory,
  ]);

  const related = [
    ["Refunds", details?.refunds],
    ["Errand payments", details?.payments],
    ["Security deposits held", details?.reservations],
    ["Security deposit claims", details?.claims],
    ["Security deposit activity", details?.securityDepositTransactions],
    ["Related transactions", details?.relatedTransactions],
    ["Settlements", details?.settlements],
  ].filter(([, rows]) => Array.isArray(rows) && rows.length);

  const technical = [
    ["Payment provider events", details?.paymentEvents],
    ["Ledger movements", details?.ledgerEntries],
  ].filter(([, rows]) => Array.isArray(rows) && rows.length);

  const handleReportProblem = () => {
    if (!reportingAbout) {
      toast?.error("Transaction details are not available yet.");
      return;
    }

    setSupportOpen(true);
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={TYPE_LABELS[type] || "Transaction details"}
        subtitle="Transaction details"
        description={tx?.description || ""}
        icon={Icon}
        tone={MODAL_TONE[statusGroup]}
        badge={tx ? <Pill status={status} /> : null}
        loading={loading}
        size="md"
        position="center"
        sizeStorageKey="wallet.transaction"
        footer={
          tx ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  copy(
                    reportingAbout?.description || "",
                    "Details copied for support",
                    toast
                  )
                }
                className={BTN_GHOST}
              >
                <LifeBuoy size={15} aria-hidden="true" />
                Copy for support
              </button>

              <button
                type="button"
                onClick={handleReportProblem}
                className={BTN_NAVY}
              >
                <Flag size={15} aria-hidden="true" />
                Report a problem
              </button>
            </div>
          ) : null
        }
      >
        {tx ? (
          <div className="space-y-6 pb-1">
            <div
              className={`rounded-3xl border border-l-4 border-line bg-surface-white p-5 ${BAR[statusGroup]}`}
            >
              <p className="text-xs font-semibold text-content-muted">
                {incoming
                  ? "Money in"
                  : reserved
                    ? "Held in reserve"
                    : "Money out"}
              </p>

              <p
                className={`mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
                  incoming ? "text-success-dark" : "text-content"
                }`}
              >
                {incoming ? "+" : reserved ? "" : "−"}
                {formatMoney(tx.amount, cur)}
              </p>

              {summary ? (
                <p className="mt-3 text-sm leading-6 text-content-muted">
                  {summary}
                </p>
              ) : null}
            </div>

            {error ? (
              <Notice title="We couldn't load every detail">
                <p>{error}</p>

                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-2"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  Try again
                </button>
              </Notice>
            ) : null}

            {needsReason ? (
              <Notice
                title={
                  lowerStatus === "rejected"
                    ? "Why this was rejected"
                    : lowerStatus === "failed"
                      ? "Why this failed"
                      : "Note from ERANDER"
                }
              >
                <p>
                  {reason ||
                    "No reason was recorded for this outcome. Please contact ERANDER support and share the reference below."}
                </p>

                {returnsFunds ? (
                  <p className="mt-2 font-semibold">
                    The reserved amount returned to your available balance.
                  </p>
                ) : null}
              </Notice>
            ) : null}

            {canVerify || canCancel || errandId ? (
              <div className="space-y-3">
                {canVerify ? (
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => onVerify?.(tx.providerReference)}
                    className={`${BTN_PRIMARY} w-full`}
                  >
                    {verifying ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <RefreshCw size={16} aria-hidden="true" />
                    )}
                    Verify with Paystack
                  </button>
                ) : null}

                {canCancel ? (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => onCancelWithdrawal?.(request.id)}
                    className={`${BTN_DANGER_SOFT} w-full`}
                  >
                    {cancelling ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <X size={16} aria-hidden="true" />
                    )}
                    Cancel this withdrawal
                  </button>
                ) : null}

                {errandId ? (
                  <button
                    type="button"
                    onClick={() => onViewErrand?.(errandId)}
                    className={`${BTN_GHOST} w-full`}
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    View errand
                    {errand?.reference_code
                      ? ` ${errand.reference_code}`
                      : ""}
                  </button>
                ) : null}
              </div>
            ) : null}

            {isWithdrawal && steps.length > 1 ? (
              <Section title="Progress">
                <div className="rounded-2xl bg-surface-muted/50 p-4">
                  <Stepper steps={steps} />
                </div>
              </Section>
            ) : null}

            {request ? (
              <Section title="What you receive">
                <dl className="divide-y divide-line-soft rounded-2xl bg-surface-muted/50 px-4">
                  <Line label="You requested">
                    <span className="tabular-nums">
                      {formatMinor(
                        request.amount_minor,
                        request.currency_code || cur
                      )}
                    </span>
                  </Line>

                  <Line label="Fee">
                    <span className="tabular-nums">
                      {formatMinor(
                        request.fee_minor,
                        request.currency_code || cur
                      )}
                    </span>
                  </Line>

                  <Line label="Sent to your bank">
                    <span className="font-extrabold tabular-nums text-content">
                      {formatMinor(
                        request.net_amount_minor,
                        request.currency_code || cur
                      )}
                    </span>
                  </Line>
                </dl>
              </Section>
            ) : null}

            {request?.bank_name_snapshot ? (
              <Section title="Destination account">
                <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-mint">
                    <Landmark size={18} aria-hidden="true" />
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-content">
                      {request.bank_name_snapshot}
                    </p>

                    <p className="truncate text-xs text-content-muted">
                      {request.account_name_snapshot || "Account"} · ••••{" "}
                      {request.account_number_last4_snapshot || "—"}
                    </p>
                  </div>
                </div>
              </Section>
            ) : null}

            <Section title="Details">
              <dl className="divide-y divide-line-soft border-y border-line-soft">
                <Line label="Date">{formatDate(transactionDate)}</Line>

                <Line label="Completed">
                  {formatDate(tx.completedAt || tx.completed_at)}
                </Line>

                <Line label="Provider">
                  {tx.paymentProvider || request?.payment_provider ? (
                    <span className="capitalize">
                      {tx.paymentProvider || request?.payment_provider}
                    </span>
                  ) : null}
                </Line>

                <Line label="Reference">
                  {transactionReference ? (
                    <CopyValue
                      value={transactionReference}
                      label="Reference"
                      toast={toast}
                    />
                  ) : null}
                </Line>

                <Line label="Transfer reference">
                  {request?.provider_transfer_reference ? (
                    <CopyValue
                      value={request.provider_transfer_reference}
                      label="Transfer reference"
                      toast={toast}
                    />
                  ) : null}
                </Line>

                <Line label="Last updated">
                  {formatDate(request?.updated_at || tx.updatedAt)}
                </Line>
              </dl>
            </Section>

            {errand ? (
              <Section title="Linked errand">
                <div className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-content">
                      {errand.reference_code || "Errand"}
                    </p>

                    {errand.status ? (
                      <Pill status={errand.status} />
                    ) : null}
                  </div>

                  {errand.title ? (
                    <p className="mt-1 break-words text-sm text-content-muted">
                      {errand.title}
                    </p>
                  ) : null}
                </div>
              </Section>
            ) : null}

            {related.length ? (
              <Section title="Related activity">
                <div className="space-y-2">
                  {related.map(([title, rows]) => (
                    <RelatedGroup
                      key={title}
                      title={title}
                      rows={rows}
                      currency={cur}
                    />
                  ))}
                </div>
              </Section>
            ) : null}

            {technical.length ? (
              <Section title="Technical history">
                <div className="space-y-2">
                  {technical.map(([title, rows]) => (
                    <RelatedGroup
                      key={title}
                      title={title}
                      rows={rows}
                      currency={cur}
                    />
                  ))}
                </div>
              </Section>
            ) : null}

            <p className="rounded-2xl bg-surface-muted/50 p-4 text-xs leading-5 text-content-muted">
              Something doesn't look right? Use{" "}
              <b>Report a problem</b> to create a support ticket specifically
              about this wallet transaction.
            </p>
          </div>
        ) : null}
      </Modal>

      <CreateSupportTicket
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        reportingAbout={reportingAbout}
        onCreated={() => setSupportOpen(false)}
      />
    </>
  );
}