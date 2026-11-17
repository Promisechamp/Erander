import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import Modal from "@/components/Modal";
import {
  getAdminFundReleaseRequest,
  rejectAdminFundReleaseRequest,
  releaseAdminFundReleaseRequest,
  verifyAdminFundReleaseTransfer,
} from "@/services/admin/fundReleasesApi";

import {
  displayName,
  formatDate,
  formatMinor,
  formatMoney,
  getFundReleaseStatusLabel,
} from "./fundReleaseUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const STATUS_TONE = {
  pending: "attention",
  approved: "info",
  processing: "info",
  released: "success",
  rejected: "danger",
  failed: "danger",
};

const PILL = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  attention: "bg-amber-50 text-amber-700 ring-amber-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-surface-muted text-content-muted ring-line",
};

const MODAL_TONE = {
  success: "success",
  attention: "warning",
  info: "info",
  danger: "danger",
  neutral: "info",
};

const ACTION_COPY = {
  release: {
    title: "Release full execution funds?",
    description:
      "ERANDER will recheck funding, the accepted agreement, the 100% security-deposit reservation and the erander's verified NGN payout account. The full amount is sent through Paystack. No partial release is possible.",
    button: "Initiate full release",
    busy: "Starting transfer",
    tone: "success",
    icon: ArrowDownToLine,
    label: "Admin review reason",
    placeholder: "Record the review basis for releasing the full funds.",
  },
  reject: {
    title: "Reject fund-release request?",
    description:
      "The request is rejected and no transfer is started. The reason is visible in the request history.",
    button: "Reject request",
    busy: "Rejecting",
    tone: "danger",
    icon: XCircle,
    label: "Rejection reason",
    placeholder: "Explain why the request is being rejected.",
  },
  verify: {
    title: "Verify Paystack transfer",
    description:
      "ERANDER checks the existing provider reference. Don't start another transfer while the outcome is uncertain.",
    button: "Verify transfer",
    busy: "Verifying",
    tone: "info",
    icon: RefreshCw,
  },
};

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GREEN = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;
const BTN_DANGER = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;
const BTN_DANGER_SOFT = `${BTN} border border-rose-200 bg-surface-white text-rose-700 hover:bg-rose-50`;

const ACTION_BUTTON = {
  success: BTN_GREEN,
  danger: BTN_DANGER,
  info: BTN_NAVY,
};

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        PILL[STATUS_TONE[status] || "neutral"]
      }`}
    >
      {getFundReleaseStatusLabel(status)}
    </span>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold text-content">{title}</h3>
        {hint ? <p className="text-[11px] text-content-subtle">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Rows({ children }) {
  return (
    <dl className="divide-y divide-line-soft rounded-2xl bg-surface-muted/50 px-4">
      {children}
    </dl>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm text-content-muted">{label}</dt>
      <dd
        className={`min-w-0 break-words text-sm text-content sm:text-right ${
          strong ? "font-extrabold tabular-nums" : "font-semibold"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function Notice({ tone = "danger", icon: Icon = AlertTriangle, title, children }) {
  const styles =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-line bg-surface-muted/60 text-content";

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border p-4 ${styles}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{title}</p>
        <div className="mt-0.5 break-words text-sm leading-6 opacity-90">{children}</div>
      </div>
    </div>
  );
}

function Bone({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-full bg-line ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
      <span className="sr-only">Loading request details</span>

      <div className="space-y-3 rounded-3xl border border-line p-5">
        <Bone className="h-3 w-40" />
        <Bone className="h-9 w-56" />
        <Bone className="h-3 w-2/3" />
      </div>

      <div className="flex gap-3 border-b border-line pb-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <Bone key={item} className="h-5 w-20" />
        ))}
      </div>

      {[0, 1].map((item) => (
        <div key={item} className="space-y-3 rounded-2xl border border-line p-4">
          <Bone className="h-4 w-36" />
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-5/6" />
          <Bone className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function CheckItem({ check }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          check.ok ? "bg-brand-pale text-success-dark" : "bg-rose-50 text-rose-600"
        }`}
      >
        {check.ok ? (
          <Check size={13} strokeWidth={3} aria-hidden="true" />
        ) : (
          <XCircle size={14} aria-hidden="true" />
        )}
        <span className="sr-only">{check.ok ? "Passed" : "Failed"}</span>
      </span>

      <span className="min-w-0 flex-1 text-sm text-content">{check.label}</span>

      <span
        className={`max-w-[45%] truncate text-right text-xs font-bold ${
          check.ok ? "text-success-dark" : "text-rose-700"
        }`}
        title={check.value}
      >
        {check.value}
      </span>
    </li>
  );
}

function MoneyLine({ label, amount, currency, tone = "default" }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm ${
        tone === "danger" ? "bg-rose-50 text-rose-800" : "bg-surface-muted/60 text-content"
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span className="font-extrabold tabular-nums">{formatMoney(amount, currency)}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MODAL                                   */
/* -------------------------------------------------------------------------- */

export default function FundReleaseDetails({
  requestId,
  canManage,
  onClose,
  onChanged,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // Keep the latest callbacks without re-running the loader when they change.
  const onCloseRef = useRef(onClose);
  const onChangedRef = useRef(onChanged);
  onCloseRef.current = onClose;
  onChangedRef.current = onChanged;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!requestId) return;

      if (!quiet) setLoading(true);

      try {
        const response = await getAdminFundReleaseRequest(requestId);
        setDetail(response?.data ?? null);
      } catch (error) {
        toast.error(error?.message || "Unable to load request details.");
        setDetail(null);
        onCloseRef.current?.();
      } finally {
        setLoading(false);
      }
    },
    [requestId]
  );

  // A different request starts clean.
  useEffect(() => {
    setDetail(null);
    setTab("overview");
    setAction(null);
    setReason("");
    setActionError("");
    load();
  }, [load]);

  const currency =
    detail?.calculation?.currencyCode || detail?.offer?.currencyCode || "NGN";

  /* ------------------------------- Pre-release checks ------------------------------- */
  const checkGroups = useMemo(() => {
    if (!detail) return [];

    const funding = detail.funding;
    const payout = detail.payoutAccount;
    const calc = detail.calculation;

    return [
      {
        title: "Errand and funding",
        checks: [
          {
            label: "Errand is funded",
            ok: detail.errand?.status === "funded",
            value: getFundReleaseStatusLabel(detail.errand?.status),
          },
          {
            label: "Accepted agreement is locked",
            ok: Boolean(detail.errand?.agreementLockedAt),
            value: detail.errand?.agreementLockedAt ? "Locked" : "Not locked",
          },
          {
            label: "Customer funding reconciles",
            ok:
              funding?.funding_status === "fully_funded" &&
              Number(funding?.overpayment_amount || 0) === 0,
            value: getFundReleaseStatusLabel(funding?.funding_status),
          },
        ],
      },
      {
        title: "Security and payout",
        checks: [
          {
            label: "Security deposit reserved",
            ok: detail.securityDeposit?.secured === true,
            value: getFundReleaseStatusLabel(detail.securityDeposit?.status),
          },
          {
            label: "Verified payout account",
            ok: Boolean(
              payout?.hasProviderRecipient &&
                payout?.status === "active" &&
                payout?.isDefault
            ),
            value: payout
              ? `${payout.bankName} •••• ${payout.accountNumberLast4}`
              : "Not available",
          },
          {
            label: "Full-release currency supported",
            ok: currency === "NGN",
            value: currency,
          },
        ],
      },
      {
        title: "Calculation and policy",
        checks: [
          {
            label: "Offer breakdown reconciles",
            ok: calc?.breakdownMatches === true,
            value: calc?.breakdownMatches ? "Matches" : "Needs review",
          },
          {
            label: "Full-release policy active",
            ok: detail.policies?.releaseReady === true,
            value: detail.policies?.releaseReady ? "Active" : "Unavailable",
          },
          {
            label: "Pending-earnings policy active",
            ok: detail.policies?.earningsReady === true,
            value: detail.policies?.earningsReady ? "Active" : "Unavailable",
          },
          {
            label: "Commission calculation available",
            ok:
              calc?.netEarningsMinor !== null &&
              calc?.netEarningsMinor !== undefined,
            value:
              calc?.commissionRatePercent == null
                ? "Not configured"
                : `${calc.commissionRatePercent}%`,
          },
        ],
      },
    ];
  }, [detail, currency]);

  const allChecks = checkGroups.flatMap((group) => group.checks);
  const failedChecks = allChecks.filter((check) => !check.ok);
  const allChecksPass = failedChecks.length === 0;

  const status = detail?.request?.status;
  const canRelease = ["pending", "approved"].includes(status);
  const canReject = ["pending", "approved"].includes(status);
  const canVerify = status === "processing";
  const hasActions = canManage && (canRelease || canReject || canVerify);

  const events = detail?.events || [];
  const payments = detail?.payments || [];
  const refunds = detail?.refunds || [];

  const tabs = [
    { value: "overview", label: "Overview" },
    {
      value: "checks",
      label: "Checks",
      count: failedChecks.length ? `${failedChecks.length} failing` : "All pass",
      bad: failedChecks.length > 0,
    },
    { value: "funding", label: "Funding", count: payments.length + refunds.length },
    { value: "payout", label: "Payout and earnings" },
    { value: "history", label: "History", count: events.length },
  ];

  /* -------------------------------- Actions -------------------------------- */
  function openAction(type) {
    setAction(type);
    setReason("");
    setActionError("");
  }

  function closeAction() {
    if (busy) return;
    setAction(null);
    setActionError("");
  }

  async function runAction() {
    if (!action) return;

    if (action !== "verify" && reason.trim().length < 10) {
      setActionError("Enter a reason of at least 10 characters.");
      return;
    }

    setBusy(true);
    setActionError("");

    try {
      let response;

      if (action === "release")
        response = await releaseAdminFundReleaseRequest(requestId, reason.trim());
      else if (action === "reject")
        response = await rejectAdminFundReleaseRequest(requestId, reason.trim());
      else response = await verifyAdminFundReleaseTransfer(requestId);

      toast.success(
        response?.message ||
          (action === "verify"
            ? "Transfer verification completed."
            : "Fund-release action completed.")
      );

      setAction(null);
      setReason("");
      await load({ quiet: true });
      onChangedRef.current?.();
    } catch (error) {
      const message = error?.message || "The action could not be completed.";
      setActionError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    if (busy) return;
    setDetail(null);
    onClose?.();
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(String(text));
      toast.success(label);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  }

  const copy_ = ACTION_COPY[action];
  const ActionIcon = copy_?.icon;
  const reasonLength = reason.trim().length;

  /* -------------------------------- Render -------------------------------- */
  return (
    <>
      <Modal
        isOpen={Boolean(requestId)}
        onClose={closeDetail}
        dismissible={!busy}
        loading={loading && !detail}
        icon={Banknote}
        tone={MODAL_TONE[STATUS_TONE[status] || "neutral"]}
        title="Fund-release review"
        subtitle="Financial operations"
        description={
          detail?.errand?.referenceCode || "Inspect the request and its evidence"
        }
        badge={detail ? <StatusPill status={status} /> : null}
        size="xl"
        position="center"
        height="full"
        sizeStorageKey="admin.fundRelease"
        zIndex={80}
        footer={
          detail ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={closeDetail} disabled={busy} className={BTN_GHOST}>
                Close
              </button>

              {hasActions ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {canReject ? (
                    <button
                      type="button"
                      onClick={() => openAction("reject")}
                      className={BTN_DANGER_SOFT}
                    >
                      <XCircle size={15} aria-hidden="true" />
                      Reject
                    </button>
                  ) : null}

                  {canVerify ? (
                    <button
                      type="button"
                      onClick={() => openAction("verify")}
                      className={BTN_NAVY}
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      Verify transfer
                    </button>
                  ) : null}

                  {canRelease ? (
                    <button
                      type="button"
                      disabled={!allChecksPass}
                      onClick={() => openAction("release")}
                      title={
                        allChecksPass
                          ? undefined
                          : `${failedChecks.length} pre-release ${
                              failedChecks.length === 1 ? "check is" : "checks are"
                            } failing`
                      }
                      className={BTN_GREEN}
                    >
                      <ArrowDownToLine size={15} aria-hidden="true" />
                      Release full funds
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null
        }
      >
        {loading || !detail ? (
          <DetailSkeleton />
        ) : (
          <div className="space-y-5 pb-1">
            {/* Summary */}
            <div className="rounded-3xl border border-line bg-surface-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-content-muted">
                    Execution funds · full release only
                  </p>
                  <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content sm:text-4xl">
                    {formatMinor(detail.calculation?.executionFundsMinor, currency)}
                  </p>
                </div>

                <dl className="text-right text-xs text-content-muted">
                  <dt className="font-semibold">Requested</dt>
                  <dd className="mt-0.5 font-bold text-content">
                    {formatDate(detail.request?.requestedAt)}
                  </dd>
                </dl>
              </div>

              <p className="mt-3 max-w-2xl text-xs leading-5 text-content-muted">
                The accepted item budget plus delivery funds. Service compensation
                is handled separately as pending wallet earnings.
              </p>
            </div>

            {/* Readiness */}
            {canRelease && canManage ? (
              allChecksPass ? (
                <Notice tone="neutral" icon={ShieldCheck} title="Ready to release">
                  All {allChecks.length} pre-release checks pass. The backend
                  rechecks them again before any transfer.
                </Notice>
              ) : (
                <Notice
                  tone="warning"
                  title={`${failedChecks.length} of ${allChecks.length} checks are failing`}
                >
                  Release is blocked until they pass.{" "}
                  <button
                    type="button"
                    onClick={() => setTab("checks")}
                    className="font-bold underline underline-offset-2"
                  >
                    See which ones
                  </button>
                </Notice>
              )
            ) : null}

            {detail.request?.failureReason ? (
              <Notice title="Provider note">{detail.request.failureReason}</Notice>
            ) : null}

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Request sections"
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

                    {item.count !== undefined && item.count !== 0 ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          item.bad
                            ? "bg-rose-50 text-rose-700"
                            : active
                              ? "bg-brand text-content-inverse"
                              : "bg-surface-muted text-content-muted"
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}

                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Overview */}
            {tab === "overview" ? (
              <div className="space-y-6" role="tabpanel">
                <Section title="Errand and participants">
                  <Rows>
                    <Row label="Errand" value={detail.errand?.title} />
                    <Row label="Reference" value={detail.errand?.referenceCode} />
                    <Row
                      label="Errand status"
                      value={getFundReleaseStatusLabel(detail.errand?.status)}
                    />
                    <Row
                      label="Customer"
                      value={`${displayName(detail.customer)}${
                        detail.customer?.email ? ` · ${detail.customer.email}` : ""
                      }`}
                    />
                    <Row
                      label="Assigned erander"
                      value={`${displayName(detail.erander)}${
                        detail.erander?.email ? ` · ${detail.erander.email}` : ""
                      }`}
                    />
                    <Row
                      label="Agreement locked"
                      value={formatDate(detail.errand?.agreementLockedAt)}
                    />
                  </Rows>
                </Section>

                <Section title="Accepted offer breakdown">
                  <Rows>
                    <Row label="Item budget" value={formatMoney(detail.offer?.itemTotal, currency)} />
                    <Row label="Service fee" value={formatMoney(detail.offer?.serviceFee, currency)} />
                    <Row label="Delivery fee" value={formatMoney(detail.offer?.deliveryFee, currency)} />
                    <Row label="Additional fees" value={formatMoney(detail.offer?.otherFees, currency)} />
                    <Row
                      label="Accepted offer total"
                      value={formatMoney(detail.offer?.total, currency)}
                      strong
                    />
                    <Row
                      label="Execution funds to release"
                      value={formatMinor(detail.calculation?.executionFundsMinor, currency)}
                      strong
                    />
                  </Rows>
                </Section>
              </div>
            ) : null}

            {/* Checks */}
            {tab === "checks" ? (
              <div className="space-y-6" role="tabpanel">
                <p className="text-xs text-content-muted">
                  The backend rechecks every one of these before a transfer starts.
                </p>

                {checkGroups.map((group) => (
                  <Section
                    key={group.title}
                    title={group.title}
                    hint={`${group.checks.filter((check) => check.ok).length} of ${
                      group.checks.length
                    } pass`}
                  >
                    <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line">
                      {group.checks.map((check) => (
                        <CheckItem key={check.label} check={check} />
                      ))}
                    </ul>
                  </Section>
                ))}
              </div>
            ) : null}

            {/* Funding */}
            {tab === "funding" ? (
              <div className="space-y-6" role="tabpanel">
                <Section title="Funding reconciliation">
                  <Rows>
                    <Row
                      label="Required funding"
                      value={formatMoney(detail.funding?.required_amount, currency)}
                    />
                    <Row
                      label="Eligible confirmed funding"
                      value={formatMoney(detail.funding?.eligible_funding_amount, currency)}
                    />
                    <Row
                      label="Funding status"
                      value={getFundReleaseStatusLabel(detail.funding?.funding_status)}
                    />
                    <Row
                      label="Overpayment"
                      value={formatMoney(detail.funding?.overpayment_amount, currency)}
                    />
                  </Rows>
                </Section>

                <Section title="Payments" hint={`${payments.length}`}>
                  {payments.length ? (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <MoneyLine
                          key={payment.id}
                          label={`Payment · ${getFundReleaseStatusLabel(payment.status)}`}
                          amount={payment.amount}
                          currency={payment.currency_code}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-surface-muted/60 p-4 text-center text-sm text-content-muted">
                      No payments recorded.
                    </p>
                  )}
                </Section>

                {refunds.length ? (
                  <Section title="Refunds" hint={`${refunds.length}`}>
                    <div className="space-y-2">
                      {refunds.map((refund) => (
                        <MoneyLine
                          key={refund.id}
                          tone="danger"
                          label={`Refund · ${getFundReleaseStatusLabel(refund.status)}`}
                          amount={refund.amount}
                          currency={refund.currency_code}
                        />
                      ))}
                    </div>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {/* Payout and earnings */}
            {tab === "payout" ? (
              <div className="space-y-6" role="tabpanel">
                <Section title="Security deposit">
                  <Rows>
                    <Row
                      label="Security deposit"
                      value={
                        detail.securityDeposit?.secured
                          ? "Verified · 100% reserved"
                          : getFundReleaseStatusLabel(detail.securityDeposit?.status)
                      }
                    />
                  </Rows>
                </Section>

                <Section title="Payout destination">
                  <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-mint">
                      <Landmark size={18} aria-hidden="true" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-content">
                        {detail.payoutAccount?.bankName || "No payout account"}
                      </p>
                      <p className="truncate text-xs text-content-muted">
                        {detail.payoutAccount?.accountName || "—"}
                        {detail.payoutAccount?.accountNumberLast4
                          ? ` · •••• ${detail.payoutAccount.accountNumberLast4}`
                          : ""}
                      </p>
                    </div>

                    <span
                      className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                        detail.payoutAccount?.hasProviderRecipient
                          ? PILL.success
                          : PILL.danger
                      }`}
                    >
                      {detail.payoutAccount?.hasProviderRecipient
                        ? "Paystack recipient saved"
                        : "Recipient missing"}
                    </span>
                  </div>
                </Section>

                <Section title="Pending earnings calculation">
                  <Rows>
                    <Row
                      label="Commission rate"
                      value={
                        detail.calculation?.commissionRatePercent == null
                          ? "Not configured"
                          : `${detail.calculation.commissionRatePercent}%`
                      }
                    />
                    <Row
                      label="Gross erander compensation"
                      value={formatMinor(detail.calculation?.grossCompensationMinor, currency)}
                    />
                    <Row
                      label="Platform commission"
                      value={formatMinor(detail.calculation?.platformCommissionMinor, currency)}
                    />
                    <Row
                      label="Net pending earnings"
                      value={formatMinor(detail.calculation?.netEarningsMinor, currency)}
                      strong
                    />
                  </Rows>

                  <p className="text-xs leading-5 text-content-muted">
                    Net earnings are recorded as pending wallet funds only after
                    Paystack confirms the execution-fund transfer. This action
                    doesn't make them available.
                  </p>
                </Section>
              </div>
            ) : null}

            {/* History */}
            {tab === "history" ? (
              <div className="space-y-6" role="tabpanel">
                {detail.request?.providerReference ? (
                  <Section title="Paystack reference">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted/60 p-4">
                      <code className="min-w-0 break-all font-mono text-xs text-content">
                        {detail.request.providerReference}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          copy(detail.request.providerReference, "Reference copied")
                        }
                        aria-label="Copy Paystack reference"
                        className="shrink-0 rounded-full p-2 text-content-muted transition hover:bg-surface-white hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <Copy size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </Section>
                ) : null}

                <Section title="Request history" hint={`${events.length}`}>
                  {events.length ? (
                    <ol className="space-y-0">
                      {events.map((event, index) => {
                        const last = index === events.length - 1;

                        return (
                          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                            {!last ? (
                              <span
                                aria-hidden="true"
                                className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 bg-line"
                              />
                            ) : null}

                            <span
                              aria-hidden="true"
                              className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-brand"
                            >
                              <CheckCircle2 size={13} />
                            </span>

                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-content">
                                {getFundReleaseStatusLabel(event.event_type)}
                              </p>
                              <p className="text-xs text-content-muted">
                                {formatDate(event.occurred_at)}
                              </p>
                              {event.details?.reason ? (
                                <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-surface-muted/60 p-3 text-xs leading-5 text-content-muted">
                                  {event.details.reason}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="rounded-2xl bg-surface-muted/60 p-4 text-center text-sm text-content-muted">
                      No request events recorded.
                    </p>
                  )}
                </Section>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Confirm an action */}
      <Modal
        isOpen={Boolean(action)}
        onClose={closeAction}
        dismissible={!busy}
        loading={busy}
        icon={ActionIcon}
        tone={copy_ ? MODAL_TONE[copy_.tone] : "info"}
        title={copy_?.title || "Confirm action"}
        subtitle="Errand fund release"
        description={detail?.errand?.referenceCode || ""}
        size="md"
        position="center"
        resizable={false}
        zIndex={90}
        footer={
          copy_ ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeAction} disabled={busy} className={BTN_GHOST}>
                Cancel
              </button>

              <button
                type="button"
                onClick={runAction}
                disabled={busy || (action !== "verify" && reasonLength < 10)}
                className={ACTION_BUTTON[copy_.tone]}
              >
                {busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    {copy_.busy}
                  </>
                ) : (
                  copy_.button
                )}
              </button>
            </div>
          ) : null
        }
      >
        {copy_ ? (
          <div className="space-y-5 pb-1">
            {detail ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-muted/60 px-4 py-3">
                <span className="text-sm text-content-muted">Execution funds</span>
                <span className="text-lg font-extrabold tabular-nums text-content">
                  {formatMinor(detail.calculation?.executionFundsMinor, currency)}
                </span>
              </div>
            ) : null}

            <p className="text-sm leading-6 text-content-muted">{copy_.description}</p>

            {action !== "verify" ? (
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="fund-release-reason"
                    className="text-sm font-bold text-content"
                  >
                    {copy_.label}
                  </label>
                  <span
                    className={`text-xs tabular-nums ${
                      reasonLength >= 10 ? "text-success-dark" : "text-content-subtle"
                    }`}
                  >
                    {reasonLength}/10 min
                  </span>
                </div>

                <textarea
                  id="fund-release-reason"
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={copy_.placeholder}
                  disabled={busy}
                  className="w-full resize-none rounded-2xl border border-line bg-surface-white px-4 py-3 text-sm leading-6 text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale disabled:opacity-60"
                />
              </div>
            ) : null}

            {actionError ? (
              <Notice title="The action didn't complete">{actionError}</Notice>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}