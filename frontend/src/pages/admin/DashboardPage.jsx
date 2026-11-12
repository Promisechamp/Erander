import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { getAdminDashboardOverview } from "@/services/admin/adminDashboardApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const QUEUE_STATUSES = ["pending", "approved", "processing"];

const WITHDRAWAL_ORDER = [
  "pending",
  "approved",
  "processing",
  "completed",
  "paid",
  "successful",
  "rejected",
  "failed",
  "cancelled",
];

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

const TONE_SOFT = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  attention: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-surface-muted text-content-muted ring-line",
};

const TONE_BAR = {
  success: "bg-emerald-500",
  attention: "bg-amber-400",
  danger: "bg-rose-500",
  neutral: "bg-content-subtle",
};

const TONE_ICON = {
  success: "bg-emerald-50 text-emerald-700",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const numberFormat = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

const formatNumber = (value) => numberFormat.format(Number(value || 0));

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAgo(value) {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);

  if (!Number.isFinite(seconds) || seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function formatMoney(value, currencyCode, minor = false) {
  const numeric = Number(value || 0) / (minor ? 100 : 1);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currencyCode || ""} ${numeric.toFixed(2)}`.trim();
  }
}

function formatCompactMoney(value, currencyCode, minor = false) {
  const numeric = Number(value || 0) / (minor ? 100 : 1);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "NGN",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(numeric);
  } catch {
    return formatMoney(value, currencyCode, minor);
  }
}

const humanize = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (
    [
      "confirmed",
      "successful",
      "completed",
      "active",
      "resolved",
      "paid",
      "released",
      "settled",
      "verified",
    ].includes(status)
  )
    return "success";

  if (["pending", "submitted", "approved", "investigating", "processing", "open", "medium"].includes(status))
    return "attention";

  if (["failed", "reversed", "disputed", "critical", "high", "rejected", "cancelled"].includes(status))
    return "danger";

  return "neutral";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const sortByOrder = (items, order, key) =>
  [...items].sort((a, b) => {
    const first = order.indexOf(String(a[key]).toLowerCase());
    const second = order.indexOf(String(b[key]).toLowerCase());
    return (first === -1 ? 99 : first) - (second === -1 ? 99 : second);
  });

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function StatusBadge({ value }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        TONE_SOFT[statusTone(value)]
      }`}
    >
      {humanize(value) || "Unknown"}
    </span>
  );
}

function Panel({ title, description, action, children, className = "" }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-3xl border border-line bg-surface-white ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-tight text-content">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-content-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>

      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function EmptyState({ children = "No records are available for this view." }) {
  return (
    <p className="rounded-2xl border border-dashed border-line-strong bg-surface-muted/50 px-4 py-6 text-center text-sm text-content-muted">
      {children}
    </p>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone = "success", to, progress }) {
  const className =
    "group block min-w-0 rounded-2xl border border-line bg-surface-white p-5 transition hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content-muted">{label}</p>
          <p className="mt-2 truncate text-2xl font-extrabold tracking-tight tabular-nums text-content">
            {value}
          </p>
          {detail ? <p className="mt-1.5 text-xs text-content-muted">{detail}</p> : null}
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON[tone]}`}
        >
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>

      {typeof progress === "number" ? (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={label}
        >
          <div
            className="h-full rounded-full bg-brand-green transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </>
  );

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}

function QueueCard({ item }) {
  const Icon = item.icon;
  const active = item.count > 0;
  const tone = active ? item.tone : "success";

  return (
    <Link
      to={item.to}
      className={`group flex min-w-0 items-center gap-4 rounded-2xl border p-4 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        active
          ? item.tone === "danger"
            ? "border-rose-200 bg-rose-50/60"
            : "border-amber-200 bg-amber-50/60"
          : "border-line bg-surface-white"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON[tone]}`}
      >
        <Icon size={19} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-extrabold leading-none tabular-nums text-content">
          {formatNumber(item.count)}
        </span>
        <span className="mt-1 block truncate text-xs font-bold text-content">{item.label}</span>
        {item.detail ? (
          <span className="block truncate text-[11px] text-content-muted">{item.detail}</span>
        ) : null}
      </span>

      <ChevronRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-content"
      />
    </Link>
  );
}

function Donut({ segments, size = 148, stroke = 18, children }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={segments.map((item) => `${item.label} ${item.value}`).join(", ")}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-muted"
        />

        {total > 0
          ? segments
              .filter((item) => item.value > 0)
              .map((item) => {
                const length = (item.value / total) * circumference;
                const circle = (
                  <circle
                    key={item.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                    className={item.stroke}
                  />
                );

                offset += length;
                return circle;
              })
          : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

function StackedBar({ segments }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className="flex h-3 overflow-hidden rounded-full bg-surface-muted"
      role="img"
      aria-label={segments.map((item) => `${item.label} ${item.value}`).join(", ")}
    >
      {total > 0
        ? segments
            .filter((item) => item.value > 0)
            .map((item) => (
              <span
                key={item.label}
                title={`${item.label}: ${item.display ?? item.value}`}
                style={{ width: `${(item.value / total) * 100}%` }}
                className={`${item.bar} h-full transition-[width] duration-700`}
              />
            ))
        : null}
    </div>
  );
}

function Legend({ segments }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {segments.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex min-w-0 items-center gap-2 text-content-muted">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.bar}`} />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="font-bold tabular-nums text-content">{item.display ?? item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DataList({ columns, rows, rowKey, empty }) {
  if (!rows?.length) return <EmptyState>{empty}</EmptyState>;

  const [first, ...rest] = columns;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-soft">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-3 pb-3 text-[11px] font-extrabold uppercase tracking-wider text-content-muted ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line-soft">
            {rows.map((row, index) => (
              <tr key={rowKey ? rowKey(row) : row.id || index} className="transition hover:bg-surface-muted/50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`max-w-[220px] truncate px-3 py-3.5 text-content-muted ${
                      column.align === "right" ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line-soft md:hidden">
        {rows.map((row, index) => (
          <li key={rowKey ? rowKey(row) : row.id || index} className="py-3.5 first:pt-0 last:pb-0">
            <p className="truncate text-sm font-bold text-content">
              {first.render ? first.render(row) : row[first.key] ?? "—"}
            </p>

            <dl className="mt-2 space-y-1.5">
              {rest.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-3 text-xs">
                  <dt className="text-content-muted">{column.label}</dt>
                  <dd className="min-w-0 text-right font-semibold text-content">
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function CurrencyTabs({ currencies, value, onChange }) {
  if (currencies.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Currency"
      className="inline-flex rounded-full bg-surface-muted p-1"
    >
      {currencies.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={value === code}
          onClick={() => onChange(code)}
          className={`h-8 rounded-full px-3.5 text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            value === code
              ? "bg-brand text-content-inverse shadow-sm"
              : "text-content-muted hover:text-content"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

function ViewAll({ to, children = "View all" }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-xs font-bold text-brand underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {children}
      <ArrowUpRight size={13} aria-hidden="true" />
    </Link>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading dashboard</span>
      <div className="h-48 animate-pulse rounded-3xl bg-brand/90" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="h-72 animate-pulse rounded-3xl bg-surface-muted" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function AdminDashboardPage() {
  const { admin } = useAdminAuth();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [currency, setCurrency] = useState("");
  const [, setTick] = useState(0);

  const loadOverview = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await getAdminDashboardOverview();

      if (!response?.success || !response?.data) {
        throw new Error(response?.message || "The dashboard data could not be loaded.");
      }

      setOverview(response.data);
    } catch (requestError) {
      setError(requestError?.message || "Unable to load the live admin dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Live mode: quiet refresh every minute while the tab is visible.
  useEffect(() => {
    if (!live) return undefined;

    const timer = window.setInterval(() => {
      if (!document.hidden) loadOverview({ background: true });
    }, 60000);

    return () => window.clearInterval(timer);
  }, [live, loadOverview]);

  // Keeps "Updated 2m ago" fresh.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const mask = (text) => (hidden ? "••••••" : text);

  /* ------------------------------ Currencies ------------------------------ */
  const currencies = useMemo(() => {
    const set = new Set();

    overview?.payments?.byCurrency?.forEach((item) => set.add(item.currencyCode));
    overview?.wallets?.byCurrency?.forEach((item) => set.add(item.currencyCode));
    overview?.wallets?.withdrawalsByCurrencyAndStatus?.forEach((item) => set.add(item.currencyCode));
    overview?.securityDeposits?.claimsByCurrencyAndStatus?.forEach((item) => set.add(item.currencyCode));

    return [...set].filter(Boolean);
  }, [overview]);

  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] || "";

  const finance = useMemo(() => {
    if (!overview || !activeCurrency) return null;

    const payments = overview.payments?.byCurrency?.find(
      (item) => item.currencyCode === activeCurrency
    );
    const wallet = overview.wallets?.byCurrency?.find(
      (item) => item.currencyCode === activeCurrency
    );

    const withdrawals = sortByOrder(
      (overview.wallets?.withdrawalsByCurrencyAndStatus || []).filter(
        (item) => item.currencyCode === activeCurrency
      ),
      WITHDRAWAL_ORDER,
      "status"
    );

    const claims = (overview.securityDeposits?.claimsByCurrencyAndStatus || []).filter(
      (item) => item.currencyCode === activeCurrency
    );

    const queueAmount = withdrawals
      .filter((item) => QUEUE_STATUSES.includes(String(item.status).toLowerCase()))
      .reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);

    const queueCount = withdrawals
      .filter((item) => QUEUE_STATUSES.includes(String(item.status).toLowerCase()))
      .reduce((sum, item) => sum + Number(item.requestCount || 0), 0);

    const paymentTotal = payments
      ? Number(payments.confirmedCount || 0) +
        Number(payments.pendingCount || 0) +
        Number(payments.failedCount || 0) +
        Number(payments.reversedCount || 0)
      : 0;

    return {
      payments,
      wallet,
      withdrawals,
      claims,
      queueAmount,
      queueCount,
      paymentTotal,
      successRate: paymentTotal
        ? (Number(payments.confirmedCount || 0) / paymentTotal) * 100
        : null,
    };
  }, [overview, activeCurrency]);

  /* ----------------------------- Attention queue --------------------------- */
  const queue = useMemo(() => {
    if (!overview) return [];

    const items = [];

    if (overview.wallets) {
      const waiting = (overview.wallets.withdrawalsByCurrencyAndStatus || [])
        .filter((item) => QUEUE_STATUSES.includes(String(item.status).toLowerCase()))
        .reduce((sum, item) => sum + Number(item.requestCount || 0), 0);

      items.push({
        key: "withdrawals",
        label: "Withdrawals in the queue",
        detail: "Pending, approved or processing",
        count: waiting,
        tone: "attention",
        icon: ArrowDownToLine,
        to: "/admin/withdrawals",
      });
    }

    if (overview.securityDeposits) {
      items.push({
        key: "claims",
        label: "Claims awaiting review",
        detail: "Security-deposit claims",
        count: Number(overview.securityDeposits.submittedClaims || 0),
        tone: "attention",
        icon: ShieldCheck,
        to: "/admin/security-deposits",
      });
    }

    if (overview.reconciliation) {
      const critical = Number(overview.reconciliation.criticalOpenIssues || 0);

      items.push({
        key: "reconciliation",
        label: "Open reconciliation issues",
        detail: `${formatNumber(critical)} critical`,
        count: Number(overview.reconciliation.openIssues || 0),
        tone: critical ? "danger" : "attention",
        icon: ShieldAlert,
        to: "/admin/reconciliation",
      });
    }

    if (overview.errands) {
      items.push({
        key: "disputes",
        label: "Disputed errands",
        detail: "Need Trust & Safety attention",
        count: Number(overview.errands.disputed || 0),
        tone: "danger",
        icon: AlertTriangle,
        to: "/admin/disputes",
      });
    }

    if (overview.payments) {
      const failed = (overview.payments.byCurrency || []).reduce(
        (sum, item) => sum + Number(item.failedCount || 0),
        0
      );

      items.push({
        key: "failed-payments",
        label: "Failed payments",
        detail: "Across all currencies",
        count: failed,
        tone: "danger",
        icon: CreditCard,
        to: "/admin/finance",
      });
    }

    return items;
  }, [overview]);

  const needsAction = queue.filter((item) => item.count > 0).length;

  /* -------------------------------- Errands -------------------------------- */
  const errandSegments = useMemo(() => {
    if (!overview?.errands) return [];

    const { total, open, active, completed, disputed } = overview.errands;
    const other = Math.max(
      0,
      Number(total || 0) -
        Number(open || 0) -
        Number(active || 0) -
        Number(completed || 0) -
        Number(disputed || 0)
    );

    return [
      { label: "Completed", value: Number(completed || 0), stroke: "stroke-emerald-500", bar: "bg-emerald-500" },
      { label: "In progress", value: Number(active || 0), stroke: "stroke-sky-500", bar: "bg-sky-500" },
      { label: "Open", value: Number(open || 0), stroke: "stroke-amber-400", bar: "bg-amber-400" },
      { label: "Disputed", value: Number(disputed || 0), stroke: "stroke-rose-500", bar: "bg-rose-500" },
      { label: "Other", value: other, stroke: "stroke-slate-400", bar: "bg-slate-400" },
    ];
  }, [overview]);

  const completionRate = overview?.errands?.total
    ? (Number(overview.errands.completed || 0) / Number(overview.errands.total)) * 100
    : 0;

  /* ----------------------------- Reconciliation ---------------------------- */
  const heatmap = useMemo(() => {
    const rows = overview?.reconciliation?.byStatusAndSeverity || [];
    if (!rows.length) return null;

    const statuses = [...new Set(rows.map((item) => String(item.status).toLowerCase()))];
    const extra = [...new Set(rows.map((item) => String(item.severity).toLowerCase()))].filter(
      (item) => !SEVERITY_ORDER.includes(item)
    );
    const severities = [...SEVERITY_ORDER, ...extra].filter((severity) =>
      rows.some((item) => String(item.severity).toLowerCase() === severity)
    );

    const count = (status, severity) =>
      rows
        .filter(
          (item) =>
            String(item.status).toLowerCase() === status &&
            String(item.severity).toLowerCase() === severity
        )
        .reduce((sum, item) => sum + Number(item.count || 0), 0);

    return { statuses, severities, count };
  }, [overview]);

  /* --------------------------------- States -------------------------------- */
  if (loading) return <Skeleton />;

  if (error && !overview) {
    return (
      <div role="alert" className="rounded-r-3xl border-l-4 border-rose-500 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-rose-600" size={20} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-rose-950">Dashboard unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => loadOverview()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-content-inverse transition hover:opacity-90"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const adminName =
    admin?.profile?.first_name || admin?.profile?.display_name || "";

  const hasMetrics =
    overview?.users || overview?.errands || overview?.wallets || overview?.payments;

  return (
    <div className="space-y-6">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden rounded-[2rem] bg-brand p-6 text-content-inverse sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-mint/20 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-mint">
              Operations overview
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">
              {greeting()}
              {adminName ? `, ${adminName}` : ""}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              {needsAction > 0
                ? `${needsAction} ${needsAction === 1 ? "area needs" : "areas need"} your attention right now.`
                : queue.length
                  ? "Everything in your queue is clear."
                  : "Live operational summaries from the ERANDER database."}{" "}
              Money is always shown per currency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-white/[0.07] px-4 py-2.5 ring-1 ring-inset ring-white/10">
              <p className="text-[11px] text-white/60">Database snapshot</p>
              <p className="mt-0.5 text-sm font-bold">
                {formatDate(overview?.databaseTime || overview?.generatedAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setHidden((value) => !value)}
              aria-pressed={hidden}
              aria-label={hidden ? "Show figures" : "Hide figures"}
              title={hidden ? "Show figures" : "Hide figures"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
            >
              {hidden ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>

            <button
              type="button"
              onClick={() => setLive((value) => !value)}
              aria-pressed={live}
              title="Refresh every minute"
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint ${
                live
                  ? "bg-brand-mint/20 text-brand-mint ring-1 ring-inset ring-brand-mint/40"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  live ? "animate-pulse bg-brand-mint" : "bg-white/50"
                }`}
              />
              Live
            </button>

            <button
              type="button"
              onClick={() => loadOverview({ background: true })}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-mint px-5 text-sm font-extrabold text-brand transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
            >
              <RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Refresh failed: {error} Showing the last loaded snapshot.
        </div>
      ) : null}

      {overview?.warnings?.length ? (
        <div role="status" className="flex items-start gap-3 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-amber-950">Some dashboard data could not be loaded</p>
            <p className="mt-1 text-xs leading-5 text-amber-900">
              Affected groups: {overview.warnings.join(", ")}. Other figures are still live. Check the
              backend log for the affected query.
            </p>
          </div>
        </div>
      ) : null}

      {/* --------------------------- ACTION QUEUE --------------------------- */}
      {queue.length ? (
        <section aria-label="Action queue">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold tracking-tight text-content">Action queue</h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                needsAction ? "bg-amber-50 text-amber-800" : "bg-brand-pale text-success-dark"
              }`}
            >
              {needsAction ? `${needsAction} need attention` : "All clear"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {queue.map((item) => (
              <QueueCard key={item.key} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------ KPIs ------------------------------ */}
      {hasMetrics ? (
        <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overview?.users ? (
            <KpiCard
              label="Registered users"
              value={formatNumber(overview.users.total)}
              detail={`${formatNumber(overview.users.createdLast7Days)} joined in the last 7 days`}
              icon={Users}
              to="/admin/users"
            />
          ) : null}

          {overview?.errands ? (
            <KpiCard
              label="Active errands"
              value={formatNumber(overview.errands.active)}
              detail={`${formatNumber(overview.errands.open)} currently open`}
              icon={ClipboardList}
              tone="info"
              to="/admin/errands"
            />
          ) : null}

          {overview?.errands ? (
            <KpiCard
              label="Completed errands"
              value={formatNumber(overview.errands.completed)}
              detail={`${Math.round(completionRate)}% of all errands`}
              icon={CheckCircle2}
              progress={completionRate}
              to="/admin/errands"
            />
          ) : null}

          {overview?.wallets ? (
            <KpiCard
              label="Withdrawal queue"
              value={formatNumber(queue.find((item) => item.key === "withdrawals")?.count)}
              detail="Pending, approved or processing"
              icon={ArrowDownToLine}
              tone={queue.find((item) => item.key === "withdrawals")?.count ? "attention" : "success"}
              to="/admin/withdrawals"
            />
          ) : null}
        </section>
      ) : null}

      {/* ----------------------- ERRANDS + ACCOUNTS ----------------------- */}
      {overview?.errands || overview?.users ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {overview?.errands ? (
            <Panel
              title="Errand lifecycle"
              description="Where every errand currently sits."
              action={<ViewAll to="/admin/errands" />}
            >
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <Donut segments={errandSegments}>
                  <span className="text-2xl font-extrabold tabular-nums text-content">
                    {formatNumber(overview.errands.total)}
                  </span>
                  <span className="text-[11px] font-semibold text-content-muted">errands</span>
                </Donut>

                <div className="w-full min-w-0 flex-1">
                  <Legend
                    segments={errandSegments.map((item) => ({
                      ...item,
                      display: formatNumber(item.value),
                    }))}
                  />
                </div>
              </div>
            </Panel>
          ) : null}

          {overview?.users ? (
            <Panel
              title="Accounts"
              description="Account health across all registered profiles."
              action={<ViewAll to="/admin/users" />}
            >
              {(() => {
                const total = Number(overview.users.total || 0);
                const active = Number(overview.users.active || 0);
                const suspended = Number(overview.users.suspended || 0);
                const other = Math.max(0, total - active - suspended);

                const segments = [
                  { label: "Active", value: active, bar: "bg-emerald-500", display: formatNumber(active) },
                  { label: "Suspended", value: suspended, bar: "bg-amber-400", display: formatNumber(suspended) },
                  { label: "Other", value: other, bar: "bg-slate-400", display: formatNumber(other) },
                ];

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["Total", total],
                        ["Active", active],
                        ["New (7 days)", overview.users.createdLast7Days],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-surface-muted/60 p-4">
                          <p className="text-xs text-content-muted">{label}</p>
                          <p className="mt-1.5 text-xl font-extrabold tabular-nums text-content">
                            {formatNumber(value)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <StackedBar segments={segments} />
                      <Legend segments={segments} />
                    </div>
                  </>
                );
              })()}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* ----------------------------- FINANCE ----------------------------- */}
      {finance ? (
        <section aria-label="Financial overview" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-content">
                Financial overview
              </h3>
              <p className="mt-0.5 text-xs text-content-muted">
                Amounts are grouped by currency. No conversion is applied.
              </p>
            </div>

            <CurrencyTabs
              currencies={currencies}
              value={activeCurrency}
              onChange={setCurrency}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Confirmed payments",
                value: finance.payments
                  ? formatCompactMoney(finance.payments.confirmedAmount, activeCurrency)
                  : "—",
                detail: finance.payments
                  ? `${formatNumber(finance.payments.confirmedCount)} confirmed`
                  : "No payments",
                icon: CreditCard,
              },
              {
                label: "Wallet available",
                value: finance.wallet
                  ? formatCompactMoney(finance.wallet.availableBalance, activeCurrency)
                  : "—",
                detail: finance.wallet
                  ? `${formatNumber(finance.wallet.walletCount)} wallets`
                  : "No wallets",
                icon: Wallet,
              },
              {
                label: "Reserved in wallets",
                value: finance.wallet
                  ? formatCompactMoney(finance.wallet.reservedBalance, activeCurrency)
                  : "—",
                detail: "Held for errands and withdrawals",
                icon: ShieldCheck,
              },
              {
                label: "Withdrawals in queue",
                value: formatCompactMoney(finance.queueAmount, activeCurrency, true),
                detail: `${formatNumber(finance.queueCount)} requests`,
                icon: ArrowDownToLine,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="min-w-0 rounded-2xl bg-brand p-5 text-content-inverse"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm text-white/70">{tile.label}</p>
                  <tile.icon size={16} className="shrink-0 text-brand-mint" aria-hidden="true" />
                </div>
                <p className="mt-2 truncate text-2xl font-extrabold tracking-tight tabular-nums text-brand-mint">
                  {mask(tile.value)}
                </p>
                <p className="mt-1 text-xs text-white/60">{tile.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="Payment outcomes"
              description={`How ${activeCurrency} payments are resolving.`}
              action={<ViewAll to="/admin/finance" />}
            >
              {finance.payments ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-content-muted">Success rate</p>
                      <p className="mt-1 text-3xl font-extrabold tabular-nums text-content">
                        {finance.successRate === null ? "—" : `${Math.round(finance.successRate)}%`}
                      </p>
                    </div>
                    <p className="text-xs text-content-muted">
                      {formatNumber(finance.paymentTotal)} payments in total
                    </p>
                  </div>

                  {(() => {
                    const segments = [
                      { label: "Confirmed", value: Number(finance.payments.confirmedCount || 0), bar: "bg-emerald-500" },
                      { label: "Pending", value: Number(finance.payments.pendingCount || 0), bar: "bg-amber-400" },
                      { label: "Failed", value: Number(finance.payments.failedCount || 0), bar: "bg-rose-500" },
                      { label: "Reversed", value: Number(finance.payments.reversedCount || 0), bar: "bg-slate-400" },
                    ].map((item) => ({ ...item, display: formatNumber(item.value) }));

                    return (
                      <div className="mt-5">
                        <StackedBar segments={segments} />
                        <Legend segments={segments} />
                      </div>
                    );
                  })()}
                </>
              ) : (
                <EmptyState>No {activeCurrency} payments yet.</EmptyState>
              )}
            </Panel>

            <Panel
              title="Withdrawal pipeline"
              description={`${activeCurrency} requests by status.`}
              action={<ViewAll to="/admin/withdrawals" />}
            >
              {finance.withdrawals.length ? (
                (() => {
                  const max = Math.max(...finance.withdrawals.map((item) => Number(item.requestCount || 0)), 1);

                  return (
                    <ul className="space-y-4">
                      {finance.withdrawals.map((item) => {
                        const tone = statusTone(item.status);

                        return (
                          <li key={item.status}>
                            <div className="flex items-center justify-between gap-3">
                              <StatusBadge value={item.status} />
                              <span className="text-xs font-bold tabular-nums text-content">
                                {formatNumber(item.requestCount)}{" "}
                                <span className="font-medium text-content-muted">
                                  · {mask(formatCompactMoney(item.amountMinor, activeCurrency, true))}
                                </span>
                              </span>
                            </div>

                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className={`h-full rounded-full transition-[width] duration-700 ${TONE_BAR[tone]}`}
                                style={{ width: `${(Number(item.requestCount || 0) / max) * 100}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()
              ) : (
                <EmptyState>No {activeCurrency} withdrawals yet.</EmptyState>
              )}
            </Panel>
          </div>

          {finance.wallet ? (
            <Panel
              title="Wallet balance composition"
              description={`Every ${activeCurrency} wallet, split by balance type.`}
              action={<ViewAll to="/admin/wallets" />}
            >
              {(() => {
                const segments = [
                  {
                    label: "Available",
                    value: Number(finance.wallet.availableBalance || 0),
                    bar: "bg-emerald-500",
                    display: mask(formatMoney(finance.wallet.availableBalance, activeCurrency)),
                  },
                  {
                    label: "Pending",
                    value: Number(finance.wallet.pendingBalance || 0),
                    bar: "bg-amber-400",
                    display: mask(formatMoney(finance.wallet.pendingBalance, activeCurrency)),
                  },
                  {
                    label: "Reserved",
                    value: Number(finance.wallet.reservedBalance || 0),
                    bar: "bg-sky-500",
                    display: mask(formatMoney(finance.wallet.reservedBalance, activeCurrency)),
                  },
                ];

                return (
                  <>
                    <StackedBar segments={segments} />
                    <Legend segments={segments} />
                  </>
                );
              })()}
            </Panel>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------ RECENT ------------------------------ */}
      {overview?.payments || overview?.wallets ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {overview?.payments ? (
            <Panel
              title="Recent payments"
              description="Latest payments across all currencies."
              action={<ViewAll to="/admin/finance" />}
            >
              <DataList
                rows={overview.payments.recent}
                empty="No recent payments."
                columns={[
                  {
                    key: "errandReference",
                    label: "Errand",
                    render: (row) => (
                      <span className="font-bold text-content">{row.errandReference || "—"}</span>
                    ),
                  },
                  {
                    key: "amount",
                    label: "Amount",
                    align: "right",
                    render: (row) => (
                      <span className="font-semibold text-content">
                        {mask(formatMoney(row.amount, row.currencyCode))}
                      </span>
                    ),
                  },
                  { key: "provider", label: "Provider", render: (row) => humanize(row.provider) },
                  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
                  { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
                ]}
              />
            </Panel>
          ) : null}

          {overview?.wallets ? (
            <Panel
              title="Recent withdrawals"
              description="Latest withdrawal requests, gross and net."
              action={<ViewAll to="/admin/withdrawals" />}
            >
              <DataList
                rows={overview.wallets.recentWithdrawals}
                empty="No recent withdrawals."
                columns={[
                  {
                    key: "reference",
                    label: "Reference",
                    render: (row) => <span className="font-bold text-content">{row.reference || "—"}</span>,
                  },
                  {
                    key: "amountMinor",
                    label: "Gross",
                    align: "right",
                    render: (row) => (
                      <span className="font-semibold text-content">
                        {mask(formatMoney(row.amountMinor, row.currencyCode, true))}
                      </span>
                    ),
                  },
                  {
                    key: "netAmountMinor",
                    label: "Net",
                    align: "right",
                    render: (row) => mask(formatMoney(row.netAmountMinor, row.currencyCode, true)),
                  },
                  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
                  { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
                ]}
              />
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* ----------------------- DEPOSITS + RECONCILIATION ----------------------- */}
      {overview?.securityDeposits || overview?.reconciliation ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {overview?.securityDeposits ? (
            <Panel
              title="Security-deposit claims"
              description="Submitted claims awaiting Trust & Safety review."
              action={<ViewAll to="/admin/security-deposits" />}
            >
              <div className="mb-5 flex items-center gap-4 rounded-2xl bg-amber-50 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <ShieldCheck size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-2xl font-extrabold tabular-nums text-amber-950">
                    {formatNumber(overview.securityDeposits.submittedClaims)}
                  </p>
                  <p className="text-xs text-amber-900">Claims awaiting review</p>
                </div>
              </div>

              <DataList
                rows={finance?.claims || overview.securityDeposits.claimsByCurrencyAndStatus}
                empty={`No ${activeCurrency || ""} claims.`}
                rowKey={(row) => `${row.currencyCode}-${row.status}`}
                columns={[
                  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
                  { key: "claimCount", label: "Claims", align: "right" },
                  {
                    key: "requestedAmountMinor",
                    label: "Requested",
                    align: "right",
                    render: (row) => mask(formatMoney(row.requestedAmountMinor, row.currencyCode, true)),
                  },
                ]}
              />
            </Panel>
          ) : null}

          {overview?.reconciliation ? (
            <Panel
              title="Financial reconciliation"
              description="Open issues by status and severity. This page never changes them."
              action={<ViewAll to="/admin/reconciliation" />}
            >
              <div
                className={`mb-5 flex items-center gap-4 rounded-2xl p-4 ${
                  Number(overview.reconciliation.criticalOpenIssues)
                    ? "bg-rose-50"
                    : "bg-brand-pale"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    Number(overview.reconciliation.criticalOpenIssues)
                      ? "bg-rose-100 text-rose-700"
                      : "bg-white text-success-dark"
                  }`}
                >
                  <ShieldAlert size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-2xl font-extrabold tabular-nums text-content">
                    {formatNumber(overview.reconciliation.openIssues)}
                  </p>
                  <p className="text-xs text-content-muted">
                    Open or investigating · {formatNumber(overview.reconciliation.criticalOpenIssues)} critical
                  </p>
                </div>
              </div>

              {heatmap ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] border-separate border-spacing-1.5 text-center">
                    <thead>
                      <tr>
                        <th className="w-28" />
                        {heatmap.severities.map((severity) => (
                          <th
                            key={severity}
                            className="text-[11px] font-extrabold uppercase tracking-wider text-content-muted"
                          >
                            {severity}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.statuses.map((status) => (
                        <tr key={status}>
                          <th className="pr-2 text-left text-xs font-bold text-content">
                            {humanize(status)}
                          </th>
                          {heatmap.severities.map((severity) => {
                            const count = heatmap.count(status, severity);
                            const tone = statusTone(severity);

                            return (
                              <td
                                key={severity}
                                className={`rounded-xl py-3 text-sm font-extrabold tabular-nums ${
                                  count
                                    ? tone === "danger"
                                      ? "bg-rose-100 text-rose-800"
                                      : tone === "attention"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-surface-muted text-content"
                                    : "bg-surface-muted/50 text-content-subtle"
                                }`}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState>No reconciliation issues recorded.</EmptyState>
              )}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {!hasMetrics && !queue.length ? (
        <EmptyState>
          You are signed in, but your administrator role does not currently grant access to
          dashboard metric groups.
        </EmptyState>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface-white px-4 py-3 text-xs text-content-muted">
        <span className="inline-flex items-center gap-2">
          <Activity size={14} aria-hidden="true" />
          Read-only operational snapshot
        </span>
        <span>
          Updated {formatAgo(overview?.generatedAt)}
          {overview?.generatedAt ? ` · ${formatDate(overview.generatedAt)}` : ""}
        </span>
      </div>
    </div>
  );
}