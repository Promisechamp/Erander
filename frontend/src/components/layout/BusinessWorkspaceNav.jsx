import { NavLink, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, ClipboardList, Heart, Home, LogOut, Settings, Plus } from "lucide-react";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";

const LINKS = [
  { to: "/business", label: "Overview", icon: Home, end: true },
  { to: "/business/errands", label: "Errands", icon: ClipboardList },
  { to: "/business/errands/new", label: "Create errand", icon: Plus },
  { to: "/business/favorites", label: "Favourite eranders", icon: Heart },
  { to: "/business/settings", label: "Business settings", icon: Settings },
];

export default function BusinessWorkspaceNav() {
  const { business, signOut } = useBusinessAuth();
  const navigate = useNavigate();
  async function logout() {
    await signOut();
    navigate("/business/login", { replace: true });
  }
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {business?.logo_url ? <img src={business.logo_url} alt="" className="h-10 w-10 rounded-xl border border-slate-200 object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><BriefcaseBusiness size={20} /></span>}
          <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{business?.name || "Business workspace"}</p><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">ERANDER Business</p></div>
        </div>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Business workspace">
          {LINKS.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={15} /><span className="hidden sm:inline">{label}</span></NavLink>)}
          <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-700"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button>
        </nav>
      </div>
    </header>
  );
}
