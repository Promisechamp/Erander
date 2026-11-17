import BusinessWorkspaceNav from "@/components/layout/BusinessWorkspaceNav";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";
import { getBusinessErrands } from "@/services/business/businessErrandsApi";
import CategoryWorkspacePanel from "@/features/errands/shared/category-workspaces/CategoryWorkspacePanel";

const STATUS_LABELS = {
  draft: "Draft", open: "Open for offers", offer_selected: "Offer selected",
  awaiting_funding: "Awaiting funding", funded: "Funded", in_progress: "In progress",
  completion_submitted: "Awaiting review", completed: "Completed", cancelled: "Cancelled",
  disputed: "Disputed", expired: "Expired",
};

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-NG", { dateStyle: "medium" });
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 2 }).format(Number(value || 0));
  } catch {
    return `${currency || ""} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function BusinessErrandsPage() {
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const [errands, setErrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const verified = business?.verification_status === "verified";
  const canCreate = verified && ["owner", "admin", "manager"].includes(String(business?.membership_role || "").toLowerCase());

  const loadErrands = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await getBusinessErrands({ page: 1, limit: 50 });
      const rows = response?.data?.errands ?? response?.data?.data?.errands ?? [];
      setErrands(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setError(loadError?.message || "We couldn't load your business errands.");
      if (!quiet) toast.error(loadError?.message || "Unable to load business errands.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadErrands(); }, [loadErrands]);

  return (
    <>
    <BusinessWorkspaceNav />
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Business workspace</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Business Errands</h1>
            <p className="mt-2 text-sm text-slate-500">Create and monitor errands submitted under {business?.name || "your business"}.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => loadErrands(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh</button>
            <button type="button" onClick={() => navigate("/business/errands/new")} disabled={!canCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} /> Create Business Errand</button>
          </div>
        </div>

        {!verified && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Your business verification is currently <strong>{business?.verification_status || "pending"}</strong>. You can view this workspace, but creating Business Errands is unavailable until verification is approved.</div>
        )}
        {verified && !canCreate && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Your current membership role does not have permission to create Business Errands. Contact your business owner or administrator.</div>
        )}

        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <section className="mt-7">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading business errands…</div>
          ) : errands.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><BriefcaseBusiness size={25} /></span>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">No business errands yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Business errands created by authorised members will appear here.</p>
              {canCreate && <button type="button" onClick={() => navigate("/business/errands/new")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400">Create your first errand <ArrowRight size={16} /></button>}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {errands.map((errand) => (
                <article key={errand.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{errand.reference_code || "Business Errand"}</p>
                      <h2 className="mt-2 break-words text-lg font-extrabold text-slate-900">{errand.title}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{STATUS_LABELS[errand.status] || errand.status}</span>
                  </div>
                  {errand.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{errand.description}</p>}
                  <div className="mt-4">
                    <CategoryWorkspacePanel errand={errand} role="customer" />
                  </div>
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <div><p className="text-xs text-slate-400">Estimated budget</p><p className="mt-1 font-extrabold text-slate-900">{errand.estimated_total == null ? "Not specified" : formatMoney(errand.estimated_total, errand.currency_code)}</p></div>
                    <p className="text-xs font-medium text-slate-400">Created {formatDate(errand.created_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
    </> 
  );
}
