import {
  CheckCircle2,
  Clock3,
  AlertCircle,
  XCircle,
  Wallet,
  RefreshCw,
  ShieldCheck,
  Ban,
  Info,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               STATUS CONFIGS                               */
/* -------------------------------------------------------------------------- */

const PAYMENT_CONFIG = {
  pending: {
    label: "Payment pending",
    description: "Waiting for payment confirmation.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  processing: {
    label: "Processing",
    description: "Your payment is being processed.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: RefreshCw,
  },
  confirmed: {
    label: "Payment confirmed",
    description: "Payment has been successfully confirmed.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  successful: {
    label: "Payment successful",
    description: "Payment has been successfully confirmed.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "Payment failed",
    description: "The payment could not be completed.",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  cancelled: {
    label: "Payment cancelled",
    description: "The payment was cancelled.",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Ban,
  },
  reversed: {
    label: "Payment reversed",
    description: "The payment was reversed.",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    icon: RefreshCw,
  },
};

const RELEASE_CONFIG = {
  pending: {
    label: "Release requested",
    description: "The fund release request is awaiting processing.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  approved: {
    label: "Release approved",
    description: "The fund release request has been approved.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: ShieldCheck,
  },
  processing: {
    label: "Release processing",
    description: "The release of funds is being processed.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: RefreshCw,
  },
  released: {
    label: "Funds released",
    description: "The funds have been released.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "Release failed",
    description: "The fund release could not be completed.",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  rejected: {
    label: "Release rejected",
    description: "The fund release request was rejected.",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  },
};

const FUNDING_CONFIG = {
  funded: {
    label: "Fully funded",
    description: "The agreed errand amount has been funded.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  fully_funded: {
    label: "Fully funded",
    description: "The agreed errand amount has been funded.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  complete: {
    label: "Fully funded",
    description: "The agreed errand amount has been funded.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  completed: {
    label: "Fully funded",
    description: "The agreed errand amount has been funded.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  partially_funded: {
    label: "Partially funded",
    description: "Some of the agreed errand amount has been funded.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  partial: {
    label: "Partially funded",
    description: "Some of the agreed errand amount has been funded.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  unfunded: {
    label: "Not funded",
    description: "The errand has not yet been fully funded.",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Wallet,
  },
  pending: {
    label: "Funding pending",
    description: "The funding process is awaiting confirmation.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function formatAmount(amount, currency = "NGN") {
  if (amount === undefined || amount === null || amount === "") {
    return "Amount unavailable";
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "Amount unavailable";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${currency} ${numericAmount.toLocaleString("en-NG")}`;
  }
}

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function resolveConfig(config, status, fallbackIcon = Info) {
  const normalized = String(status || "").toLowerCase();

  return (
    config[normalized] || {
      label: normalized
        ? normalized.replaceAll("_", " ")
        : "Status unavailable",
      description: "No additional status information is available.",
      color: "bg-slate-100 text-slate-600 border-slate-200",
      icon: fallbackIcon,
    }
  );
}

/* -------------------------------------------------------------------------- */
/*                                 UI PIECES                                  */
/* -------------------------------------------------------------------------- */

function StatusPill({ config }) {
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${config.color}`}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function DataRow({ label, value, strong = false, tone = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-content-muted">{label}</dt>

      <dd
        className={`min-w-0 break-words text-right tabular-nums ${
          strong ? "font-bold" : "font-semibold"
        } ${tone || "text-content"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                FUNDING BLOCK                               */
/* -------------------------------------------------------------------------- */

function FundingBlock({ funding, currency, compact }) {
  const status = String(
    funding?.fundingStatus || funding?.funding_status || ""
  ).toLowerCase();

  const amountFunded = Number(funding?.amountFunded ?? 0);
  const agreedTotal = Number(funding?.agreedTotal ?? 0);
  const amountDue = Number(funding?.amountDue ?? 0);

  const inferredStatus =
    status ||
    (amountDue <= 0 && agreedTotal > 0
      ? "funded"
      : amountFunded > 0
        ? "partially_funded"
        : "unfunded");

  const config = resolveConfig(FUNDING_CONFIG, inferredStatus, Wallet);

  const percent =
    agreedTotal > 0
      ? Math.min(100, Math.max(0, (amountFunded / agreedTotal) * 100))
      : 0;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-content-muted">
            Held in escrow for this errand
          </p>

          <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content">
            {formatAmount(amountFunded, currency)}
          </p>

          <p className="mt-1 text-xs text-content-muted">
            of {formatAmount(agreedTotal, currency)} agreed
          </p>
        </div>

        <StatusPill config={config} />
      </div>

      <div
        className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label="Funding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className="h-full rounded-full bg-brand-green transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!compact && (
        <>
          <p className="mt-3 text-xs leading-5 text-content-muted">
            {config.description}
          </p>

          <dl className="mt-4 divide-y divide-line-soft border-t border-line-soft">
            <DataRow
              label="Agreed amount"
              value={formatAmount(agreedTotal, currency)}
            />
            <DataRow
              label="Funded so far"
              value={formatAmount(amountFunded, currency)}
              tone="text-success-dark"
            />
            <DataRow
              label="Still to fund"
              value={formatAmount(amountDue, currency)}
              strong
            />
          </dl>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             INDIVIDUAL PAYMENT                             */
/* -------------------------------------------------------------------------- */

function PaymentBlock({ payment, currency, compact }) {
  const config = resolveConfig(PAYMENT_CONFIG, payment.status, Wallet);

  const reference = payment.reference || payment.transaction_reference;

  const date =
    payment.confirmed_at || payment.created_at || payment.initiatedAt;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-content">Payment made</p>
        <StatusPill config={config} />
      </div>

      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums text-content">
        {formatAmount(payment.amount, currency)}
      </p>

      {!compact && (
        <>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            {config.description}
          </p>

          {(reference || date) && (
            <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {reference && (
                <DataRow label="Reference" value={reference} />
              )}
              {date && <DataRow label="Date" value={formatDate(date)} />}
            </dl>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                FUND RELEASE                                */
/* -------------------------------------------------------------------------- */

function ReleaseBlock({ fundRelease, compact }) {
  const config = resolveConfig(RELEASE_CONFIG, fundRelease.status, Wallet);

  const reference = fundRelease.providerReference || fundRelease.reference;

  const dates = [
    ["Requested", fundRelease.requestedAt],
    ["Reviewed", fundRelease.reviewedAt],
    ["Processing started", fundRelease.releaseInitiatedAt],
    ["Released", fundRelease.releasedAt],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-content">
          Release of funds to the erander
        </p>
        <StatusPill config={config} />
      </div>

      {!compact && (
        <>
          <p className="mt-2 text-xs leading-5 text-content-muted">
            {config.description}
          </p>

          {(dates.length > 0 || reference) && (
            <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft">
              {dates.map(([label, value]) => (
                <DataRow
                  key={label}
                  label={label}
                  value={formatDate(value)}
                />
              ))}

              {reference && (
                <DataRow label="Reference" value={reference} />
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAIN EXPORT                                 */
/* -------------------------------------------------------------------------- */

export default function PaymentStatus({
  payment,
  funding,
  fundRelease,
  currency = "NGN",
  compact = false,
}) {
  const fundingData =
    funding ||
    (payment &&
    (payment.agreedTotal !== undefined ||
      payment.amountFunded !== undefined ||
      payment.fundingStatus !== undefined)
      ? payment
      : null);

  const paymentData = fundingData ? null : payment;

  if (!fundingData && !paymentData && !fundRelease) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-content-muted">
        <Wallet size={18} className="shrink-0" />

        <p className="text-sm">No payment information is available yet.</p>
      </div>
    );
  }

  return (
    <section
      aria-label="Payment information"
      className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-surface-white"
    >
      {fundingData && (
        <FundingBlock
          funding={fundingData}
          currency={fundingData.currency || currency}
          compact={compact}
        />
      )}

      {paymentData && (
        <PaymentBlock
          payment={paymentData}
          currency={
            paymentData.currency_code || paymentData.currency || currency
          }
          compact={compact}
        />
      )}

      {fundRelease && (
        <ReleaseBlock fundRelease={fundRelease} compact={compact} />
      )}
    </section>
  );
}
