import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  ClipboardList,
} from "lucide-react";
import { getAdminDashboardOverview } from "@/services/admin/adminDashboardApi";

const numberFormat = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
});

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function StatusBadge({ value }) {
  const status = String(value || "unknown").toLowerCase();
  const tone = ["confirmed", "successful", "completed", "active", "resolved"].includes(status)
    ? "bg-emerald-50 text-emerald-700"
    : ["pending", "submitted", "approved", "investigating", "processing"].includes(status)
      ? "bg-amber-50 text-amber-700"
      : ["failed", "reversed", "disputed", "critical", "rejected"].includes(status)
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tone}`}>
      {String(value || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone = "mint" }) {
  const iconTone = tone === "amber"
    ? "bg-amber-50 text-amber-700"
    : tone === "rose"
      ? "bg-rose-50 text-rose-700"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#14213D]">{value}</p>
          {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function SectionCard({ title, description, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
      <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-extrabold text-[#14213D]">{title}</h3>
          {action}
        </div>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function EmptyState({ children = "No records are available for this view." }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

function Table({ columns, rows, rowKey }) {
  if (!rows?.length) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            {columns.map((column) => <th key={column.key} className="px-3 pb-3 font-bold">{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row) : row.id || index}>
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-3.5 text-slate-600">
                  {column.render ? column.render(row) : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  const metrics = useMemo(() => {
    const cards = [];
    if (overview?.users) {
      cards.push({ label: "Registered users", value: formatNumber(overview.users.total), detail: `${formatNumber(overview.users.createdLast7Days)} joined in the last 7 days`, icon: Users });
    }
    if (overview?.errands) {
      cards.push({ label: "Active errands", value: formatNumber(overview.errands.active), detail: `${formatNumber(overview.errands.open)} currently open`, icon: ClipboardList, tone: "blue" });
      cards.push({ label: "Completed errands", value: formatNumber(overview.errands.completed), detail: `${formatNumber(overview.errands.disputed)} disputed`, icon: CheckCircle2 });
    }
    if (overview?.wallets) {
      const pending = overview.wallets.withdrawalsByCurrencyAndStatus
        .filter((item) => ["pending", "approved", "processing"].includes(item.status))
        .reduce((sum, item) => sum + item.requestCount, 0);
      cards.push({ label: "Withdrawal queue", value: formatNumber(pending), detail: "Pending, approved or processing", icon: ArrowDownToLine, tone: pending ? "amber" : "mint" });
    }
    if (overview?.securityDeposits) {
      cards.push({ label: "Claims awaiting review", value: formatNumber(overview.securityDeposits.submittedClaims), detail: "Submitted security-deposit claims", icon: ShieldCheck, tone: overview.securityDeposits.submittedClaims ? "amber" : "mint" });
    }
    if (overview?.reconciliation) {
      cards.push({ label: "Open reconciliation issues", value: formatNumber(overview.reconciliation.openIssues), detail: `${formatNumber(overview.reconciliation.criticalOpenIssues)} critical`, icon: ShieldAlert, tone: overview.reconciliation.criticalOpenIssues ? "rose" : "mint" });
    }
    return cards;
  }, [overview]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-rose-700" size={20} />
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-rose-900">Dashboard unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800">{error}</p>
            <button onClick={() => loadOverview()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#20365f]">
              <RefreshCw size={15} /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-[#14213D] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#35D07F]">ERANDER administration</p>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Operations overview</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Live operational summaries from the ERANDER production database. Financial amounts remain separated by currency.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <p className="text-[11px] text-slate-300">Database snapshot</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(overview?.databaseTime || overview?.generatedAt)}</p>
            </div>
            <button onClick={() => loadOverview({ background: true })} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#35D07F] px-4 py-3 text-sm font-extrabold text-[#10243A] transition hover:bg-[#54df95] disabled:cursor-wait disabled:opacity-70">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Refresh failed: {error}. Showing the last successfully loaded snapshot.</div> : null}

      {overview?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-900">Some dashboard data could not be loaded</p><p className="mt-1 text-xs leading-5 text-amber-800">Affected data groups: {overview.warnings.join(", ")}. Other available figures are still live. Check the backend log for the affected query.</p></div></div>
        </div>
      ) : null}

      {metrics.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </section>
      ) : (
        <EmptyState>You are signed in, but your administrator role does not currently grant access to dashboard metric groups.</EmptyState>
      )}

      {overview?.users ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Active accounts" value={formatNumber(overview.users.active)} detail="Profiles with active account status" icon={Users} />
          <MetricCard label="Suspended accounts" value={formatNumber(overview.users.suspended)} detail="Profiles currently suspended" icon={ShieldAlert} tone="amber" />
          <MetricCard label="New accounts" value={formatNumber(overview.users.createdLast7Days)} detail="Created during the last 7 days" icon={ArrowUpRight} tone="blue" />
        </section>
      ) : null}

      {overview?.errands ? (
        <SectionCard title="Errand lifecycle" description="Current errand counts by operational stage.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["All errands", overview.errands.total],
              ["Open", overview.errands.open],
              ["In progress / awaiting", overview.errands.active],
              ["Completed", overview.errands.completed],
              ["Disputed", overview.errands.disputed],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold text-[#14213D]">{formatNumber(value)}</p></div>)}
          </div>
        </SectionCard>
      ) : null}

      {overview?.payments ? (
        <SectionCard title="Payment performance" description="Confirmed payment totals are grouped by their transaction currency. No currency conversion is applied.">
          <Table
            columns={[
              { key: "currencyCode", label: "Currency" },
              { key: "confirmedAmount", label: "Confirmed amount", render: (row) => <span className="font-bold text-[#14213D]">{formatMoney(row.confirmedAmount, row.currencyCode)}</span> },
              { key: "confirmedCount", label: "Confirmed" },
              { key: "pendingCount", label: "Pending" },
              { key: "failedCount", label: "Failed" },
              { key: "reversedCount", label: "Reversed" },
            ]}
            rows={overview.payments.byCurrency}
          />
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="mb-3 text-sm font-bold text-[#14213D]">Recent payments</h4>
            <Table columns={[
              { key: "errandReference", label: "Errand" },
              { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount, row.currencyCode) },
              { key: "provider", label: "Provider" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
            ]} rows={overview.payments.recent} />
          </div>
        </SectionCard>
      ) : null}

      {overview?.wallets ? (
        <SectionCard title="Wallet balances" description="Balances are displayed independently for each currency and balance type.">
          <Table columns={[
            { key: "currencyCode", label: "Currency" },
            { key: "walletCount", label: "Wallets" },
            { key: "availableBalance", label: "Available", render: (row) => <span className="font-semibold text-[#14213D]">{formatMoney(row.availableBalance, row.currencyCode)}</span> },
            { key: "pendingBalance", label: "Pending", render: (row) => formatMoney(row.pendingBalance, row.currencyCode) },
            { key: "reservedBalance", label: "Reserved", render: (row) => formatMoney(row.reservedBalance, row.currencyCode) },
          ]} rows={overview.wallets.byCurrency} />
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="mb-3 text-sm font-bold text-[#14213D]">Withdrawal queue by currency and status</h4>
            <Table columns={[
              { key: "currencyCode", label: "Currency" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "requestCount", label: "Requests" },
              { key: "amountMinor", label: "Gross amount", render: (row) => formatMoney(row.amountMinor, row.currencyCode, true) },
            ]} rows={overview.wallets.withdrawalsByCurrencyAndStatus} />
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="mb-3 text-sm font-bold text-[#14213D]">Recent withdrawals</h4>
            <Table columns={[
              { key: "reference", label: "Reference" },
              { key: "amountMinor", label: "Gross amount", render: (row) => formatMoney(row.amountMinor, row.currencyCode, true) },
              { key: "netAmountMinor", label: "Net amount", render: (row) => formatMoney(row.netAmountMinor, row.currencyCode, true) },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
            ]} rows={overview.wallets.recentWithdrawals} />
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {overview?.securityDeposits ? (
          <SectionCard title="Security-deposit claims" description="Submitted claims awaiting Trust & Safety review, with requested amounts grouped by currency.">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 p-4"><ShieldCheck size={20} className="text-amber-700" /><div><p className="text-2xl font-extrabold text-amber-900">{formatNumber(overview.securityDeposits.submittedClaims)}</p><p className="text-xs text-amber-800">Claims awaiting review</p></div></div>
            <Table columns={[
              { key: "currencyCode", label: "Currency" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "claimCount", label: "Claims" },
              { key: "requestedAmountMinor", label: "Requested", render: (row) => formatMoney(row.requestedAmountMinor, row.currencyCode, true) },
            ]} rows={overview.securityDeposits.claimsByCurrencyAndStatus} />
          </SectionCard>
        ) : null}

        {overview?.reconciliation ? (
          <SectionCard title="Financial reconciliation" description="Outstanding issues requiring investigation. This dashboard does not resolve or modify issues.">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-rose-50 p-4"><AlertTriangle size={20} className="text-rose-700" /><div><p className="text-2xl font-extrabold text-rose-900">{formatNumber(overview.reconciliation.openIssues)}</p><p className="text-xs text-rose-800">Open or investigating issues · {formatNumber(overview.reconciliation.criticalOpenIssues)} critical</p></div></div>
            <Table columns={[
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "severity", label: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
              { key: "count", label: "Issues" },
            ]} rows={overview.reconciliation.byStatusAndSeverity} />
          </SectionCard>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2"><Activity size={14} /> Read-only operational snapshot</span>
        <span>Updated {formatDate(overview?.generatedAt)}</span>
      </div>
    </div>
  );
}
