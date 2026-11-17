import { useCallback, useEffect, useState } from "react";
import { Heart, RefreshCw, UserRound } from "lucide-react";
import { toast } from "sonner";
import BusinessWorkspaceNav from "@/components/layout/BusinessWorkspaceNav";
import { getBusinessFavoriteErranders, removeBusinessFavoriteErander } from "@/services/business/businessWorkspaceApi";

export default function BusinessFavoriteErrandersPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { const response = await getBusinessFavoriteErranders(); setFavorites(response?.data?.favorites || []); }
    catch (error) { toast.error(error?.message || "Unable to load business favourites."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function remove(id) {
    try { await removeBusinessFavoriteErander(id); setFavorites((items) => items.filter((item) => item.erander_id !== id)); toast.success("Erander removed from business favourites."); }
    catch (error) { toast.error(error?.message || "Unable to remove favourite."); }
  }
  return <><BusinessWorkspaceNav /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Business workspace</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Favourite eranders</h1><p className="mt-2 text-sm text-slate-500">Keep a business shortlist of eranders. A favourite does not guarantee availability or assign an errand.</p></div><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh</button></div>{loading ? <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading favourites…</div> : favorites.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Heart className="mx-auto text-rose-500" size={30} /><h2 className="mt-3 text-lg font-extrabold text-slate-900">No favourite eranders yet</h2><p className="mt-2 text-sm text-slate-500">You can add eranders to this business list as discovery and selection features are expanded.</p></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((favorite) => <article key={favorite.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3">{favorite.avatar_url ? <img src={favorite.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound /></span>}<div className="min-w-0"><h2 className="truncate font-extrabold text-slate-900">{favorite.name}</h2><p className="text-xs text-slate-500">{favorite.is_assignable ? "Active erander" : "Currently unavailable"}</p></div></div><button onClick={() => remove(favorite.erander_id)} className="mt-5 w-full rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">Remove favourite</button></article>)}</div>}</div></main></>;
}
