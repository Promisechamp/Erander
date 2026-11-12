import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  FileJson,
  Landmark,
  LoaderCircle,
  Lock,
  Receipt,
  Search,
  ShieldCheck,
} from "lucide-react";

import Modal from "@/components/Modal";

import { CopyButton, StatusPill } from "./RecordsUI";
import { BTN_GHOST, BTN_NAVY } from "./recordsStyles";
import {
  GROUP_TONE,
  copyText,
  currencyValue,
  humanize,
  shortId,
  statusGroup,
} from "./recordsUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const TIMELINE_KEYS = [
  "created_at",
  "initiated_at",
  "requested_at",
  "reviewed_at",
  "processed_at",
  "provider_confirmed_at",
  "platform_confirmed_at",
  "completed_at",
  "settled_at",
  "released_at",
  "updated_at",
];

const HIDDEN_KEYS = ["metadata", "evidence", "before_data", "after_data", "payload_hash"];

const MONEY_MINOR = [
  "amount_minor",
  "fee_minor",
  "net_amount_minor",
  "requested_amount_minor",
  "approved_amount_minor",
];

const MONEY_MAJOR = ["amount", "verified_amount", "debit_amount", "credit_amount"];

const KEY_FACTS = [
  ["type", "Type"],
  ["transaction_type", "Type"],
  ["payment_type", "Type"],
  ["direction", "Direction"],
  ["payment_provider", "Provider"],
  ["provider", "Provider"],
  ["reference", "Reference"],
  ["provider_reference", "Provider reference"],
  ["provider_transfer_reference", "Transfer reference"],
  ["created_at", "Created"],
  ["completed_at", "Completed"],
  ["profile_id", "User"],
  ["wallet_id", "Wallet"],
  ["erand_id", "Errand"],
  ["related_erand_id", "Errand"],
];

const KIND_ICON = {
  withdrawal: ArrowUpRight,
  deposit: ArrowDownLeft,
  wallet: Receipt,
};

const GROUP_ICON_TONE = {
  success: "success",
  attention: "warning",
  danger: "danger",
  neutral: "info",
};

const GROUP_DOT = {
  success: "bg-emerald-500",
  attention: "bg-amber-400",
  danger: "bg-rose-500",
  neutral: "bg-content-subtle",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const isIdKey = (key) =>
  key === "id" ||
  key.endsWith("_id") ||
  key.includes("reference") ||
  key.endsWith("_code") ||
  key.endsWith("_by");

const isDateKey = (key) => key.endsWith("_at");
const isStatusKey = (key) => key === "status" || key.endsWith("_status");

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelative(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";

  const abs = Math.abs(seconds);
  const unit =
    abs < 60
      ? `${abs}s`
      : abs < 3600
        ? `${Math.round(abs / 60)}m`
        : abs < 86400
          ? `${Math.round(abs / 3600)}h`
          : `${Math.round(abs / 86400)}d`;

  return abs < 10 ? "just now" : seconds >= 0 ? `${unit} ago` : `in ${unit}`;
}

function formatMoneyField(key, value, currency) {
  if (value === null || value === undefined || value === "") return null;
  if (MONEY_MINOR.includes(key)) return currencyValue(value, currency, true);
  if (MONEY_MAJOR.includes(key)) return currencyValue(value, currency, false);
  return null;
}

function getAmount(transaction) {
  if (!transaction) return null;

  if (transaction.amount_minor !== undefined && transaction.amount_minor !== null)
    return currencyValue(transaction.amount_minor, transaction.currency_code, true);

  if (transaction.amount !== undefined && transaction.amount !== null)
    return currencyValue(transaction.amount, transaction.currency_code, false);

  return null;
}

function directionOf(transaction) {
  const value = String(transaction?.direction || "").toLowerCase();
  if (value === "credit") return { label: "Money in", sign: "+", tone: "text-success-dark" };
  if (value === "debit") return { label: "Money out", sign: "−", tone: "text-content" };
  if (value === "reserved") return { label: "Held in reserve", sign: "", tone: "text-amber-700" };
  return null;
}

/** A plain-language sentence so the admin understands the record at a glance. */
function buildSummary(kind, transaction, details) {
  if (!transaction) return "";

  const amount = getAmount(transaction);
  const status = humanize(transaction.status || transaction.processing_status || "unknown").toLowerCase();
  const when = transaction.created_at ? ` on ${formatDate(transaction.created_at)}` : "";
  const errand = details?.errand?.reference_code
    ? ` It is linked to errand ${details.errand.reference_code}.`
    : "";

  if (kind === "withdrawal") {
    const bank = transaction.bank_name_snapshot
      ? ` to ${transaction.bank_name_snapshot}${
          transaction.account_number_last4_snapshot
            ? ` (•••• ${transaction.account_number_last4_snapshot})`
            : ""
        }`
      : "";
    return `A withdrawal${amount ? ` of ${amount}` : ""} was requested${bank}${when}. It is currently ${status}.`;
  }

  const direction = directionOf(transaction);
  const flow = direction ? `${direction.label.toLowerCase()} ` : "";
  const type = humanize(
    transaction.type || transaction.transaction_type || transaction.payment_type || kind
  ).toLowerCase();

  return `A ${flow}${type} transaction${amount ? ` of ${amount}` : ""} was recorded${when}. It is ${status}.${errand}`;
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Value({ field, value, currency }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-content-subtle">—</span>;

  const money = formatMoneyField(field, value, currency);
  if (money) return <span className="font-bold tabular-nums">{money}</span>;

  if (isStatusKey(field)) return <StatusPill value={value} />;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (isDateKey(field)) return <span>{formatDate(value)}</span>;

  if (typeof value === "object")
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-white p-3 font-mono text-[11px] leading-5 text-content">
        {JSON.stringify(value, null, 2)}
      </pre>
    );

  if (isIdKey(field))
    return (
      <span className="inline-flex max-w-full items-center gap-1">
        <code className="min-w-0 break-all font-mono text-xs">{String(value)}</code>
        <CopyButton value={value} />
      </span>
    );

  return <span className="break-words">{humanize(String(value)).length < 40 && /^[a-z_]+$/.test(String(value)) ? humanize(String(value)) : String(value)}</span>;
}

function Fact({ label, field, value, currency, wide = false }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className={`min-w-0 rounded-2xl bg-surface-muted/60 p-3.5 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-content-muted">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-content">
        <Value field={field} value={value} currency={currency} />
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, count, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-content">
          {Icon ? <Icon size={16} className="text-content-muted" aria-hidden="true" /> : null}
          {title}
          {count !== undefined ? (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-content-muted">
              {count}
            </span>
          ) : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Banner({ tone = "danger", icon: Icon = AlertTriangle, title, children }) {
  const styles =
    tone === "danger"
      ? "border-rose-500 bg-rose-50 text-rose-900"
      : tone === "warning"
        ? "border-amber-400 bg-amber-50 text-amber-900"
        : "border-brand-green bg-brand-pale text-success-dark";

  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-r-2xl border-l-4 p-4 ${styles}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="text-sm font-extrabold">{title}</p> : null}
        <div className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6">{children}</div>
      </div>
    </div>
  );
}

/** One related record: a short header, then its fields on demand. */
function RecordCard({ row, index, title }) {
  const [open, setOpen] = useState(false);

  const heading =
    row.reference ||
    row.reference_code ||
    row.transaction_type ||
    row.type ||
    row.event_type ||
    row.entry_type ||
    row.id ||
    `${title} ${index + 1}`;

  const amount =
    getAmount(row) ||
    (row.debit_amount != null || row.credit_amount != null
      ? `Dr ${currencyValue(row.debit_amount || 0, row.currency_code)} · Cr ${currencyValue(row.credit_amount || 0, row.currency_code)}`
      : null);

  const status = row.status || row.processing_status;

  const fields = Object.entries(row).filter(
    ([key, value]) =>
      !HIDDEN_KEYS.includes(key) && value !== null && value !== undefined && value !== ""
  );

  return (
    <div className="rounded-2xl border border-line bg-surface-white">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-content">
            {humanize(String(heading)).length < 36 && /^[a-z_]+$/.test(String(heading))
              ? humanize(String(heading))
              : String(heading)}
          </span>
          <span className="mt-0.5 block text-[11px] text-content-muted">
            {row.created_at ? formatDate(row.created_at) : row.id ? shortId(row.id) : ""}
          </span>
        </span>

        {amount ? (
          <span className="hidden shrink-0 text-sm font-extrabold tabular-nums text-content sm:block">
            {amount}
          </span>
        ) : null}

        {status ? <StatusPill value={status} /> : null}

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-content-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-line-soft p-3.5">
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map(([key, value]) => (
              <Fact
                key={key}
                label={humanize(key)}
                field={key}
                value={value}
                currency={row.currency_code}
                wide={typeof value === "object"}
              />
            ))}
          </div>

          {row.metadata && Object.keys(row.metadata).length ? (
            <details className="rounded-2xl border border-line">
              <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-content-muted hover:text-content">
                Metadata
              </summary>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words border-t border-line-soft p-3.5 font-mono text-[11px] leading-5">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            </details>
          ) : null}

          {row.id ? (
            <button
              type="button"
              onClick={() => copyText(row.id, "Record ID copied")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-content-muted transition hover:text-content"
            >
              <Copy size={12} aria-hidden="true" />
              Copy record ID
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MoneyFlow({ transaction }) {
  const currency = transaction.currency_code;
  const gross = Number(transaction.amount_minor);
  const fee = Number(transaction.fee_minor || 0);
  const net = Number(transaction.net_amount_minor);

  if (!Number.isFinite(gross) || !Number.isFinite(net) || gross <= 0) return null;

  const feePercent = Math.min(100, Math.max(0, (fee / gross) * 100));

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-xs font-bold text-content-muted">Where the money goes</p>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-muted">
        <span className="h-full bg-emerald-500" style={{ width: `${100 - feePercent}%` }} />
        {fee > 0 ? <span className="h-full bg-amber-400" style={{ width: `${feePercent}%` }} /> : null}
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["Requested", gross, "bg-content-subtle"],
          ["Fee", fee, "bg-amber-400"],
          ["Sent to bank", net, "bg-emerald-500"],
        ].map(([label, value, dot]) => (
          <div key={label} className="flex items-center justify-between gap-3 sm:block">
            <dt className="inline-flex items-center gap-1.5 text-xs text-content-muted">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </dt>
            <dd className="text-sm font-extrabold tabular-nums text-content sm:mt-0.5">
              {currencyValue(value, currency, true)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MODAL                                   */
/* -------------------------------------------------------------------------- */

export default function TransactionDetailsModal({
  open,
  loading,
  error,
  result,
  onClose,
  onOpenAdminControls,
}) {
  const transaction = result?.transaction || null;
  const details = useMemo(() => result?.details || {}, [result]);
  const kind = result?.kind || "wallet";
  const currency = transaction?.currency_code;

  const [tab, setTab] = useState("overview");
  const [fieldSearch, setFieldSearch] = useState("");

  useEffect(() => {
    if (open) {
      setTab("overview");
      setFieldSearch("");
    }
  }, [open, transaction?.id]);

  const group = statusGroup(transaction?.status || transaction?.processing_status);
  const direction = directionOf(transaction);
  const amount = getAmount(transaction);
  const summary = buildSummary(kind, transaction, details);

  /* ------------------------------- Timeline ------------------------------- */
  const timeline = useMemo(() => {
    if (!transaction) return [];

    return TIMELINE_KEYS.filter((key) => transaction[key])
      .map((key) => ({ key, at: transaction[key] }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [transaction]);

  /* ----------------------------- Related records ---------------------------- */
  const related = useMemo(() => {
    const list = [
      ["Linked wallet transaction", details.walletTransaction ? [details.walletTransaction] : []],
      ["Linked security-deposit reservation", details.reservation ? [details.reservation] : []],
      ["Ledger movements (double entry)", details.ledgerEntries],
      ["Security-deposit transactions", details.securityDepositTransactions],
      ["Security-deposit reservations", details.reservations],
      ["Security-deposit claims", details.claims],
      ["Related wallet transactions", details.relatedTransactions],
      ["Errand payments", details.payments],
      ["Refunds", details.refunds],
      ["Other refunds on this payment", details.relatedRefunds],
      ["Settlements", details.settlements],
      ["Payment provider events", details.paymentEvents],
      ["Payment confirmations", details.paymentConfirmations],
    ];

    if (kind !== "withdrawal" && Array.isArray(details.withdrawalRequests))
      list.push(["Withdrawal requests", details.withdrawalRequests]);

    return list.filter(([, rows]) => Array.isArray(rows) && rows.length);
  }, [details, kind]);

  const relatedCount = related.reduce((sum, [, rows]) => sum + rows.length, 0);
  const audit = Array.isArray(details.adminAudit) ? details.adminAudit : [];

  /* ------------------------------- All fields ------------------------------- */
  const allFields = useMemo(() => {
    if (!transaction) return [];
    const query = fieldSearch.trim().toLowerCase();

    return Object.entries(transaction)
      .filter(([key, value]) => !HIDDEN_KEYS.includes(key) && value !== null && value !== undefined && value !== "")
      .filter(
        ([key, value]) =>
          !query ||
          humanize(key).toLowerCase().includes(query) ||
          String(typeof value === "object" ? JSON.stringify(value) : value)
            .toLowerCase()
            .includes(query)
      );
  }, [transaction, fieldSearch]);

  const keyFacts = useMemo(() => {
    if (!transaction) return [];
    const used = new Set();

    return KEY_FACTS.filter(([key, label]) => {
      if (transaction[key] === null || transaction[key] === undefined || transaction[key] === "") return false;
      if (used.has(label)) return false;
      used.add(label);
      return true;
    });
  }, [transaction]);

  const failure =
    transaction?.rejection_reason ||
    transaction?.failure_reason ||
    (["failed", "rejected"].includes(String(transaction?.status).toLowerCase())
      ? "No reason was recorded. Review the provider and audit details before taking action."
      : "");

  const tabs = [
    { value: "overview", label: "Overview" },
    ...(timeline.length ? [{ value: "timeline", label: "Timeline", count: timeline.length }] : []),
    ...(relatedCount ? [{ value: "related", label: "Related", count: relatedCount }] : []),
    ...(audit.length ? [{ value: "audit", label: "Audit", count: audit.length }] : []),
    { value: "data", label: "All data" },
  ];

  const hasActions = typeof onOpenAdminControls === "function";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Transaction investigation"
      subtitle={transaction ? `${humanize(kind)} transaction` : "Admin review"}
      description={
        transaction
          ? transaction.reference || shortId(transaction.id)
          : "Complete transaction record"
      }
      icon={KIND_ICON[kind] || Receipt}
      tone={GROUP_ICON_TONE[group]}
      badge={
        transaction ? (
          <StatusPill value={transaction.status || transaction.processing_status} />
        ) : null
      }
      loading={loading}
      size="xl"
      position="center"
      height="auto"
      sizeStorageKey="admin.transaction"
      zIndex={90}
      footer={
        transaction ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              Close
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  copyText({ kind, transaction, details }, "Transaction copied as JSON")
                }
                className={BTN_GHOST}
              >
                <FileJson size={14} aria-hidden="true" />
                Copy JSON
              </button>

              {hasActions ? (
                <button type="button" onClick={onOpenAdminControls} className={BTN_NAVY}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  Open admin actions
                </button>
              ) : null}
            </div>
          </div>
        ) : null
      }
    >
      <div className="space-y-5 pb-1">
        {loading && !transaction ? (
          <div role="status" className="flex items-center justify-center gap-3 rounded-3xl bg-surface-muted/60 px-6 py-14 text-sm font-semibold text-content-muted">
            <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
            Loading the complete transaction history
          </div>
        ) : null}

        {error ? <Banner title="Couldn't load this transaction">{error}</Banner> : null}

        {transaction ? (
          <>
            {/* Summary */}
            <div className={`rounded-3xl border border-l-4 border-line bg-surface-white p-5 ${
              group === "success"
                ? "border-l-success"
                : group === "attention"
                  ? "border-l-amber-400"
                  : group === "danger"
                    ? "border-l-rose-500"
                    : "border-l-line-strong"
            }`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-content-muted">
                    {direction?.label || humanize(kind)}
                  </p>

                  {amount ? (
                    <p className={`mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${direction?.tone || "text-content"}`}>
                      {direction?.sign}
                      {amount}
                    </p>
                  ) : (
                    <p className="mt-1 text-xl font-extrabold text-content">
                      {transaction.description || transaction.reason || "Transaction"}
                    </p>
                  )}
                </div>

                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${GROUP_TONE[group]}`}>
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${GROUP_DOT[group]}`} />
                  {humanize(transaction.status || transaction.processing_status || "unknown")}
                </span>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-content-muted">
                {summary}
              </p>

              {transaction.description && amount ? (
                <p className="mt-2 text-xs text-content-subtle">
                  {transaction.description}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft pt-3 text-xs text-content-muted">
                <span className="inline-flex items-center gap-1">
                  ID
                  <code className="font-mono text-[11px] text-content">{shortId(transaction.id)}</code>
                  <CopyButton value={transaction.id} label="Transaction ID copied" />
                </span>

                {transaction.reference ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    Ref
                    <code className="min-w-0 break-all font-mono text-[11px] text-content">{transaction.reference}</code>
                    <CopyButton value={transaction.reference} label="Reference copied" />
                  </span>
                ) : null}

                {transaction.created_at ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={12} aria-hidden="true" />
                    {formatRelative(transaction.created_at)}
                  </span>
                ) : null}
              </div>
            </div>

            {failure ? (
              <Banner
                title={
                  String(transaction.status).toLowerCase() === "rejected"
                    ? "Rejection reason"
                    : "Failure reason"
                }
              >
                {failure}
              </Banner>
            ) : null}

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Transaction sections"
              className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((item) => {
                const active = item.value === tab;

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.value)}
                    className={`relative inline-flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active ? "text-content" : "text-content-muted hover:text-content"
                    }`}
                  >
                    {item.label}
                    {item.count ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-brand text-content-inverse" : "bg-surface-muted text-content-muted"}`}>
                        {item.count}
                      </span>
                    ) : null}
                    {active ? (
                      <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Overview */}
            {tab === "overview" ? (
              <div className="space-y-6" role="tabpanel">
                {kind === "withdrawal" ? <MoneyFlow transaction={transaction} /> : null}

                {keyFacts.length ? (
                  <Section title="Key details">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {keyFacts.map(([key, label]) => (
                        <Fact key={key} label={label} field={key} value={transaction[key]} currency={currency} />
                      ))}
                    </div>
                  </Section>
                ) : null}

                {kind === "withdrawal" ? (
                  <Section icon={Landmark} title="Bank and provider">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        ["Bank", "bank_name_snapshot"],
                        ["Account name", "account_name_snapshot"],
                        ["Account number", "account_number_last4_snapshot"],
                        ["Payment provider", "payment_provider"],
                        ["Transfer reference", "provider_transfer_reference"],
                        ["Transfer code", "provider_transfer_code"],
                        ["Recipient code", "provider_recipient_code_snapshot"],
                        ["Reviewed by", "reviewed_by"],
                        ["Wallet transaction", "wallet_transaction_id"],
                        ["Withdrawal account", "withdrawal_account_id"],
                      ].map(([label, key]) => (
                        <Fact
                          key={key}
                          label={label}
                          field={key}
                          value={
                            key === "account_number_last4_snapshot" && transaction[key]
                              ? `•••• ${transaction[key]}`
                              : transaction[key]
                          }
                          currency={currency}
                        />
                      ))}
                    </div>
                  </Section>
                ) : null}

                {Array.isArray(details.withdrawalRequests) && kind !== "withdrawal" && details.withdrawalRequests.length ? (
                  <Banner tone="warning" icon={Landmark} title="Linked withdrawal request">
                    This transaction is tied to {details.withdrawalRequests.length} withdrawal request
                    {details.withdrawalRequests.length === 1 ? "" : "s"}. See the Related tab.
                  </Banner>
                ) : null}

                {details.errand ? (
                  <Section icon={ExternalLink} title="Related errand">
                    <div className="rounded-2xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-content">
                          {details.errand.reference_code || shortId(details.errand.id)}
                        </p>
                        {details.errand.status ? <StatusPill value={details.errand.status} /> : null}
                      </div>
                      <p className="mt-1 break-words text-sm text-content-muted">
                        {details.errand.title || "Errand"}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-content-subtle">
                        <code className="break-all font-mono">{details.errand.id}</code>
                        <CopyButton value={details.errand.id} label="Errand ID copied" />
                      </p>
                    </div>
                  </Section>
                ) : null}

                {details.communications || result?.communications ? (
                  <Banner tone="warning" icon={Lock} title="Messages and communications">
                    {details.communications?.message ||
                      result?.communications?.message ||
                      "No transaction-linked messages were returned."}
                  </Banner>
                ) : null}

                {transaction.metadata && Object.keys(transaction.metadata).length ? (
                  <details className="rounded-2xl border border-line">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-content-muted hover:text-content">
                      Transaction metadata
                    </summary>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-line-soft p-4 font-mono text-[11px] leading-5">
                      {JSON.stringify(transaction.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}

            {/* Timeline */}
            {tab === "timeline" ? (
              <div role="tabpanel">
                <Section icon={Clock3} title="Status timeline" count={timeline.length}>
                  <ol className="space-y-5 border-l-2 border-line pl-6">
                    {timeline.map((item, index) => {
                      const last = index === timeline.length - 1;

                      return (
                        <li key={item.key} className="relative">
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-surface-white ${
                              last ? GROUP_DOT[group] : "bg-brand-green"
                            }`}
                          >
                            <Check size={9} className="text-white" strokeWidth={4} />
                          </span>

                          <p className="text-sm font-bold text-content">
                            {humanize(item.key.replace(/_at$/, ""))}
                          </p>
                          <p className="mt-0.5 text-xs text-content-muted">
                            {formatDate(item.at)}
                            <span className="text-content-subtle"> · {formatRelative(item.at)}</span>
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              </div>
            ) : null}

            {/* Related */}
            {tab === "related" ? (
              <div className="space-y-6" role="tabpanel">
                {related.map(([title, rows]) => (
                  <Section key={title} title={title} count={rows.length}>
                    <div className="space-y-2">
                      {rows.map((row, index) => (
                        <RecordCard
                          key={row.id || row.reference || `${title}-${index}`}
                          row={row}
                          index={index}
                          title={title}
                        />
                      ))}
                    </div>
                  </Section>
                ))}
              </div>
            ) : null}

            {/* Audit */}
            {tab === "audit" ? (
              <div role="tabpanel">
                <Section icon={ShieldCheck} title="Administrator audit history" count={audit.length}>
                  <div className="space-y-2">
                    {audit.map((row, index) => (
                      <RecordCard
                        key={row.id || `audit-${index}`}
                        row={row}
                        index={index}
                        title="Audit entry"
                      />
                    ))}
                  </div>
                </Section>
              </div>
            ) : null}

            {/* All data */}
            {tab === "data" ? (
              <div className="space-y-3" role="tabpanel">
                <label className="relative block">
                  <span className="sr-only">Find a field</span>
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle"
                  />
                  <input
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                    placeholder="Find a field"
                    className="h-10 w-full rounded-full border border-line bg-surface-white pl-10 pr-4 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
                  />
                </label>

                {allFields.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {allFields.map(([key, value]) => (
                      <Fact
                        key={key}
                        label={humanize(key)}
                        field={key}
                        value={value}
                        currency={currency}
                        wide={typeof value === "object"}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-surface-muted/60 p-4 text-center text-sm text-content-muted">
                    No fields match “{fieldSearch}”.
                  </p>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}