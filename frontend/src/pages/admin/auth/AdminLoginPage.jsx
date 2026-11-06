import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function AdminLoginPage() {
  const { signIn, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password, remember });
      toast.success("Welcome to the ERANDER admin workspace.");
      navigate(location.state?.from?.pathname || "/admin", { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl md:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-[#14213D] p-10 text-white md:flex">
          <div>
            <img src="/images/erander-logo.png" alt="ERANDER" className="mb-16 h-10 max-w-[170px] object-contain" />
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-200">Administration portal</span>
            <h1 className="mt-7 max-w-sm text-4xl font-semibold leading-tight">Operations, oversight and trust in one place.</h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">A secure workspace for authorized ERANDER administrators.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Protected administrator access</div>
        </aside>
        <div className="p-7 sm:p-10 lg:p-14">
          <div className="mb-9 flex items-center gap-3 md:hidden">
            <img src="/images/erander-logo.png" alt="ERANDER" className="h-9 max-w-[150px] object-contain" />
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Admin</span>
          </div>
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-6 w-6" /></div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Administrator sign in</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#14213D]">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use the account assigned to your administrator role.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-slate-700">Work email</label>
              <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@erander.com" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Keep me signed in on this device
            </label>
            <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] text-sm font-semibold text-white transition hover:bg-[#1c3157] disabled:opacity-60">
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? "Signing in…" : "Sign in to admin"}
            </button>
          </form>
          <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            <strong className="block">Authorized administrators only</strong>
            Access requires an active ERANDER administrator assignment. Public admin registration is not available.
          </div>
          <p className="mt-7 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">Not an administrator? <Link to="/login" className="font-semibold text-emerald-700">Go to user sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
