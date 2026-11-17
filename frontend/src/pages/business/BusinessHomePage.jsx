import BusinessWorkspaceNav from "@/components/layout/BusinessWorkspaceNav";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";

export default function BusinessHomePage() {
  const { business, signOut } = useBusinessAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/business/login", { replace: true });
  }

  return (
    <>
    <BusinessWorkspaceNav />
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">ERANDER Business Workspace</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900">{business?.name || "Business account"}</h1>
        <p className="mt-2 text-sm text-slate-500">Your business identity and membership are connected successfully.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase text-slate-500">Verification</p><p className="mt-2 text-lg font-extrabold capitalize text-slate-900">{String(business?.verification_status || "pending").replaceAll("_", " ")}</p></div>
          <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase text-slate-500">Membership role</p><p className="mt-2 text-lg font-extrabold capitalize text-slate-900">{business?.membership_role || "member"}</p></div>
        </div>
        {business?.verification_status !== "verified" && business?.verification_status !== "approved" && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Your business account is awaiting verification. Business Errands will remain unavailable until the required verification is approved.</div>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button onClick={() => navigate("/business/errands")} className="flex items-center justify-between rounded-2xl bg-emerald-500 p-5 text-left text-sm font-extrabold text-slate-950 hover:bg-emerald-400">
            <span className="flex items-center gap-3"><BriefcaseBusiness size={20} /> Manage Business Errands</span><ArrowRight size={17} />
          </button>
          <button onClick={handleSignOut} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Sign out of business portal</button>
        </div>
      </section>
    </main>
    </> 
  );
}
