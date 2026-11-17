import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  getAdminFundReleaseRequest,
  listAdminFundReleaseRequests,
  rejectAdminFundReleaseRequest,
  releaseAdminFundReleaseRequest,
  verifyAdminFundReleaseTransfer,
} from "@/services/admin/fundReleasesApi";

const FILTERS = [
  { value: "", label: "All requests" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "released", label: "Released" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

const STATUS_STYLES = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  released: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
};

function statusLabel(value) {
  return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value, currency = "NGN") {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${currency} ${number.toFixed(2)}`;
  }
}

function formatMinor(value, currency = "NGN") {
  if (value === null || value === undefined) return "—";
  return formatMoney(Number(value) / 100, currency);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function displayName(person) {
  return person?.name || person?.displayName || person?.email || "Unknown";
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} /></div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-slate-900 sm:text-right">{value || "—"}</dd>
    </div>
  );
}

export default function FundReleaseManagementPage() {
  const { admin } = useAdminAuth();
  const permissions = admin?.permissions || [];
  const canManage = permissions.includes("*") || permissions.includes("finance:manage");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadList = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await listAdminFundReleaseRequests({ status: filter, search });
      setItems(response?.data?.items || []);
      setCounts(response?.data?.counts || {});
    } catch (error) {
      toast.error(error?.message || "Unable to load fund-release requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search]);

  const loadDetail = useCallback(async (requestId) => {
    if (!requestId) return;
    setDetailLoading(true);
    try {
      const response = await getAdminFundReleaseRequest(requestId);
      setDetail(response?.data || null);
    } catch (error) {
      toast.error(error?.message || "Unable to load request details.");
      setDetail(null);
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const pendingCount = Number(counts.pending || 0);
  const processingCount = Number(counts.processing || 0);
  const releasedCount = Number(counts.released || 0);
  const failedCount = Number(counts.failed || 0);

  const detailCanRelease = ["pending", "approved"].includes(detail?.request?.status);
  const detailCanVerify = detail?.request?.status === "processing";
  const detailCanReject = ["pending", "approved"].includes(detail?.request?.status);
  const detailCurrency = detail?.calculation?.currencyCode || detail?.offer?.currencyCode || "NGN";

  const reviewChecks = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "Errand is funded", ok: detail.errand?.status === "funded", value: statusLabel(detail.errand?.status) },
      { label: "Accepted agreement is locked", ok: Boolean(detail.errand?.agreementLockedAt), value: detail.errand?.agreementLockedAt ? "Locked" : "Not locked" },
      { label: "Customer funding reconciles", ok: detail.funding?.funding_status === "fully_funded" && Number(detail.funding?.overpayment_amount || 0) === 0, value: statusLabel(detail.funding?.funding_status) },
      { label: "Security deposit reserved", ok: detail.securityDeposit?.secured === true, value: statusLabel(detail.securityDeposit?.status) },
      { label: "Verified payout account", ok: Boolean(detail.payoutAccount?.hasProviderRecipient && detail.payoutAccount?.status === "active" && detail.payoutAccount?.isDefault), value: detail.payoutAccount ? `${detail.payoutAccount.bankName} •••• ${detail.payoutAccount.accountNumberLast4}` : "Not available" },
      { label: "Full-release currency supported", ok: detailCurrency === "NGN", value: detailCurrency },
      { label: "Offer breakdown reconciles", ok: detail.calculation?.breakdownMatches === true, value: detail.calculation?.breakdownMatches ? "Matches" : "Needs review" },
      { label: "Full-release policy active", ok: detail.policies?.releaseReady === true, value: detail.policies?.releaseReady ? "Active" : "Unavailable" },
      { label: "Pending-earnings policy active", ok: detail.policies?.earningsReady === true, value: detail.policies?.earningsReady ? "Active" : "Unavailable" },
      { label: "Commission calculation available", ok: detail.calculation?.netEarningsMinor !== null && detail.calculation?.netEarningsMinor !== undefined, value: detail.calculation?.commissionRatePercent == null ? "Not configured" : `${detail.calculation.commissionRatePercent}%` },
    ];
  }, [detail, detailCurrency]);

  async function runAction() {
    if (!selectedId || !action) return;
    if (action !== "verify" && reason.trim().length < 10) {
      setActionError("Enter a reason of at least 10 characters.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      let response;
      if (action === "release") response = await releaseAdminFundReleaseRequest(selectedId, reason.trim());
      else if (action === "reject") response = await rejectAdminFundReleaseRequest(selectedId, reason.trim());
      else response = await verifyAdminFundReleaseTransfer(selectedId);
      toast.success(response?.message || (action === "verify" ? "Transfer verification completed." : "Fund-release action completed."));
      setAction(null);
      setReason("");
      await Promise.all([loadList(true), loadDetail(selectedId)]);
    } catch (error) {
      const message = error?.message || "The action could not be completed.";
      setActionError(message);
      toast.error(message);
    } finally {
      setActionBusy(false);
    }
  }

  const actionCopy = {
    release: {
      title: "Release full execution funds?",
      description: "ERANDER will recheck funding, the accepted agreement, the 100% security-deposit reservation and the erander's verified NGN payout account. The full amount will be sent through Paystack. No partial release is possible.",
      button: "Initiate full release",
      tone: "bg-emerald-600 hover:bg-emerald-700",
    },
    reject: {
      title: "Reject fund-release request?",
      description: "The request will be rejected and no transfer will be initiated. The reason will be visible in the request history.",
      button: "Reject request",
      tone: "bg-rose-600 hover:bg-rose-700",
    },
    verify: {
      title: "Verify Paystack transfer",
      description: "ERANDER will check the existing provider reference. Do not initiate another transfer while the outcome is uncertain.",
      button: "Verify transfer",
      tone: "bg-blue-600 hover:bg-blue-700",
    },
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
            <Banknote size={13} /> Financial operations
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Errand fund releases</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review erander requests, verify customer funding and security, then initiate the full execution-fund transfer. Security-deposit releases are managed separately.</p>
        </div>
        <button type="button" onClick={() => loadList(true)} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard icon={Clock3} label="Awaiting review" value={pendingCount} tone="amber" />
        <SummaryCard icon={ArrowUpRight} label="Transfer processing" value={processingCount} tone="blue" />
        <SummaryCard icon={CheckCircle2} label="Released" value={releasedCount} tone="green" />
        <SummaryCard icon={AlertCircle} label="Failed transfers" value={failedCount} tone="slate" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full px-3.5 py-2 text-xs font-extrabold transition ${filter === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {item.label}{item.value ? <span className="ml-1.5 opacity-70">{counts[item.value] || 0}</span> : null}
                </button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }} className="flex w-full gap-2 lg:max-w-sm">
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search errand, erander or request ID" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800">Search</button>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-sm font-semibold text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading fund-release requests…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FileCheck2 size={22} /></div>
            <h2 className="text-base font-extrabold text-slate-900">No fund-release requests found</h2>
            <p className="mt-1 text-sm text-slate-500">Requests submitted by assigned eranders will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                <tr><th className="px-5 py-3">Errand</th><th className="px-5 py-3">Erander</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Execution funds</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4"><p className="max-w-[260px] truncate text-sm font-extrabold text-slate-900">{item.errand?.title || "Untitled errand"}</p><p className="mt-1 text-xs text-slate-500">{item.errand?.referenceCode || item.erandId}</p></td>
                    <td className="px-5 py-4"><p className="text-sm font-semibold text-slate-800">{item.erander?.name || "Unknown"}</p><p className="mt-1 text-xs text-slate-500">{item.erander?.email || ""}</p></td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">{item.customer?.name || "Unknown"}</td>
                    <td className="px-5 py-4 text-sm font-extrabold text-slate-900">{formatMoney(item.errand?.total, item.errand?.currencyCode)}</td>
                    <td className="px-5 py-4 text-xs font-medium text-slate-500">{formatDate(item.requestedAt)}</td>
                    <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelectedId(item.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:border-slate-300 hover:bg-slate-50"><Eye size={14} /> Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={Boolean(selectedId)} onClose={() => { if (!actionBusy) { setSelectedId(null); setDetail(null); } }} title="Fund-release review" subtitle="Financial operations" description={detail?.errand?.referenceCode || "Inspect request and verification evidence"} size="xl" position="right" height="full" closeOnOutsideClick={!actionBusy} closeOnEscape={!actionBusy}>
        {detailLoading || !detail ? (
          <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-semibold text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading request details…</div>
        ) : (
          <div className="space-y-6 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status={detail.request.status} /><span className="text-xs text-slate-500">Requested {formatDate(detail.request.requestedAt)}</span></div>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-500">Execution funds · full release only</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{formatMinor(detail.calculation?.executionFundsMinor, detailCurrency)}</p>
              <p className="mt-1 text-xs text-slate-500">Full execution-fund amount: accepted item budget plus delivery funds. Service compensation is handled separately as pending wallet earnings.</p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Errand and participants</h3>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                <DetailRow label="Errand" value={detail.errand?.title} />
                <DetailRow label="Reference" value={detail.errand?.referenceCode} />
                <DetailRow label="Errand status" value={statusLabel(detail.errand?.status)} />
                <DetailRow label="Customer" value={`${displayName(detail.customer)}${detail.customer?.email ? ` · ${detail.customer.email}` : ""}`} />
                <DetailRow label="Assigned erander" value={`${displayName(detail.erander)}${detail.erander?.email ? ` · ${detail.erander.email}` : ""}`} />
                <DetailRow label="Agreement locked" value={formatDate(detail.errand?.agreementLockedAt)} />
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Accepted offer breakdown</h3>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                <DetailRow label="Item budget" value={formatMoney(detail.offer?.itemTotal, detailCurrency)} />
                <DetailRow label="Service fee" value={formatMoney(detail.offer?.serviceFee, detailCurrency)} />
                <DetailRow label="Delivery fee" value={formatMoney(detail.offer?.deliveryFee, detailCurrency)} />
                <DetailRow label="Additional fees" value={formatMoney(detail.offer?.otherFees, detailCurrency)} />
                <DetailRow label="Accepted offer total" value={formatMoney(detail.offer?.total, detailCurrency)} />
                <DetailRow label="Execution funds to release" value={formatMinor(detail.calculation?.executionFundsMinor, detailCurrency)} />
              </dl>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-slate-900">Pre-release checks</h3><span className="text-[10px] font-bold text-slate-500">Backend rechecks these before transfer</span></div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {reviewChecks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{check.label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-right text-xs font-extrabold ${check.ok ? "text-emerald-700" : "text-rose-700"}`}>{check.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{check.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Funding reconciliation</h3>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                <DetailRow label="Required funding" value={formatMoney(detail.funding?.required_amount, detailCurrency)} />
                <DetailRow label="Eligible confirmed funding" value={formatMoney(detail.funding?.eligible_funding_amount, detailCurrency)} />
                <DetailRow label="Funding status" value={statusLabel(detail.funding?.funding_status)} />
                <DetailRow label="Overpayment" value={formatMoney(detail.funding?.overpayment_amount, detailCurrency)} />
              </dl>
              <div className="mt-3 space-y-2">
                {(detail.payments || []).map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">Payment · {statusLabel(payment.status)}</span><span className="font-bold text-slate-900">{formatMoney(payment.amount, payment.currency_code)}</span></div>)}
                {(detail.refunds || []).map((refund) => <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs"><span className="font-semibold text-rose-700">Refund · {statusLabel(refund.status)}</span><span className="font-bold text-rose-900">{formatMoney(refund.amount, refund.currency_code)}</span></div>)}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Security deposit and payout destination</h3>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                <DetailRow label="Security deposit" value={detail.securityDeposit?.secured ? "Verified · 100% reserved" : statusLabel(detail.securityDeposit?.status)} />
                <DetailRow label="Payout bank" value={detail.payoutAccount?.bankName} />
                <DetailRow label="Account name" value={detail.payoutAccount?.accountName} />
                <DetailRow label="Account number" value={detail.payoutAccount?.accountNumberLast4 ? `•••• ${detail.payoutAccount.accountNumberLast4}` : "—"} />
                <DetailRow label="Provider recipient" value={detail.payoutAccount?.hasProviderRecipient ? "Verified Paystack recipient saved" : "Missing"} />
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Pending earnings calculation</h3>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                <DetailRow label="Commission rate" value={detail.calculation?.commissionRatePercent == null ? "Not configured" : `${detail.calculation.commissionRatePercent}%`} />
                <DetailRow label="Gross erander compensation" value={formatMinor(detail.calculation?.grossCompensationMinor, detailCurrency)} />
                <DetailRow label="Platform commission" value={formatMinor(detail.calculation?.platformCommissionMinor, detailCurrency)} />
                <DetailRow label="Net pending earnings" value={formatMinor(detail.calculation?.netEarningsMinor, detailCurrency)} />
              </dl>
              <p className="mt-2 text-xs leading-5 text-slate-500">Net earnings are recorded as pending wallet funds only after Paystack confirms the execution-fund transfer. They are not made available by this action.</p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-extrabold text-slate-900">Request history</h3>
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                {(detail.events || []).length ? detail.events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0"><p className="text-xs font-extrabold text-slate-800">{statusLabel(event.event_type)}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(event.occurred_at)}</p>{event.details?.reason ? <p className="mt-1 text-xs text-slate-600">{event.details.reason}</p> : null}</div>
                  </div>
                )) : <p className="text-xs text-slate-500">No request events recorded.</p>}
              </div>
            </section>

            {detail.request.providerReference ? <div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-700">Paystack reference</p><p className="mt-1 break-all font-mono text-slate-600">{detail.request.providerReference}</p></div> : null}
            {detail.request.failureReason ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><b>Provider note:</b> {detail.request.failureReason}</div> : null}

            {canManage && (detailCanRelease || detailCanVerify || detailCanReject) ? (
              <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white py-4 sm:flex-row">
                {detailCanRelease ? <button type="button" disabled={!reviewChecks.every((check) => check.ok)} onClick={() => { setAction("release"); setReason(""); setActionError(""); }} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowDownToLine size={16} /> Release full funds</button> : null}
                {detailCanVerify ? <button type="button" onClick={() => { setAction("verify"); setReason(""); setActionError(""); }} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white hover:bg-blue-700"><RefreshCw size={16} /> Verify transfer</button> : null}
                {detailCanReject ? <button type="button" onClick={() => { setAction("reject"); setReason(""); setActionError(""); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-extrabold text-rose-700 hover:bg-rose-50"><XCircle size={16} /> Reject</button> : null}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(action)} onClose={() => { if (!actionBusy) { setAction(null); setActionError(""); } }} title={actionCopy[action]?.title || "Confirm action"} subtitle="Errand fund release" description={detail?.errand?.referenceCode || ""} size="md" position="center" height="auto" closeOnOutsideClick={!actionBusy} closeOnEscape={!actionBusy}>
        {action ? <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{actionCopy[action].description}</div>
          {action !== "verify" ? <div><label htmlFor="fund-release-reason" className="mb-2 block text-xs font-extrabold text-slate-700">{action === "reject" ? "Rejection reason" : "Admin review reason"}</label><textarea id="fund-release-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={action === "reject" ? "Explain why the request is being rejected." : "Record the review basis for releasing the full funds."} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /><p className="mt-1 text-right text-[11px] text-slate-400">{reason.trim().length}/10 minimum</p></div> : null}
          {actionError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{actionError}</div> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setAction(null)} disabled={actionBusy} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">Cancel</button><button type="button" onClick={runAction} disabled={actionBusy || (action !== "verify" && reason.trim().length < 10)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60 ${actionCopy[action].tone}`}>{actionBusy ? <LoaderCircle size={15} className="animate-spin" /> : null}{actionBusy ? "Working…" : actionCopy[action].button}</button></div>
        </div> : null}
      </Modal>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>Every release is full-only. A transfer remains processing until Paystack confirms its exact reference, currency and amount. If a provider response is uncertain, verify the existing transfer; do not submit a second transfer.</p></div>
    </div>
  );
}
