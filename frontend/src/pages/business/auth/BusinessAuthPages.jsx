import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";
import { registerBusiness } from "@/services/business/businessAuthApi";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

function BusinessAuthLayout({ title, description, children }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Back to ERANDER
        </Link>
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Building2 size={24} />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">ERANDER Business</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

function Field({ label, name, value, onChange, type = "text", required = true, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input className={inputClass} name={name} type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} />
    </label>
  );
}

export function BusinessLoginPage() {
  const { signIn, businesses } = useBusinessAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "", remember: true, business_id: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn({
        email: form.email.trim(),
        password: form.password,
        remember: form.remember,
        ...(form.business_id ? { business_id: form.business_id } : {}),
      });
      toast.success("Business sign-in successful.");
      navigate(location.state?.from?.pathname || "/business", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in to the business portal.");
      toast.error(err.message || "Business sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BusinessAuthLayout title="Business sign in" description="Access your organisation's ERANDER workspace.">
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="mt-7 space-y-5">
        <Field label="Business account email" name="email" type="email" value={form.email} onChange={update} placeholder="name@business.com" />
        <Field label="Password" name="password" type="password" value={form.password} onChange={update} />
        {businesses.length > 1 && (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Choose business account</span>
            <select className={inputClass} name="business_id" value={form.business_id} onChange={update} required>
              <option value="">Select a business</option>
              {businesses.map((item) => <option key={item.business_id} value={item.business_id}>{item.name} — {item.membership_role}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="remember" checked={form.remember} onChange={update} className="h-4 w-4 accent-emerald-600" /> Remember this device
        </label>
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-extrabold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in to business"} {!loading && <ArrowRight size={17} />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Need a business account? <Link to="/business/register" className="font-bold text-emerald-700 hover:underline">Register your business</Link></p>
      <p className="mt-3 text-center text-sm text-slate-500">Personal account? <Link to="/login" className="font-bold text-slate-700 hover:underline">Personal sign in</Link></p>
    </BusinessAuthLayout>
  );
}

export function BusinessRegisterPage() {
  const navigate = useNavigate();
  const { refreshBusiness } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "", legal_name: "", email: "", phone: "", website: "", country_code: "NG",
    first_name: "", last_name: "", owner_email: "", owner_phone: "", password: "",
  });

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await registerBusiness({
        business: {
          name: form.name.trim(),
          legal_name: form.legal_name.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
          country_code: form.country_code.trim().toUpperCase(),
        },
        owner: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.owner_email.trim(),
          phone: form.owner_phone.trim(),
          password: form.password,
        },
      });
      const successMessage = result.message || "Business registration received.";
      setMessage(successMessage);
      toast.success(successMessage);
      if (result?.data?.confirmationRequired) {
        navigate("/business/login", { replace: true, state: { registrationMessage: successMessage } });
      } else {
        await refreshBusiness();
        navigate("/business", { replace: true });
      }
    } catch (err) {
      setMessage(err.message || "Business registration failed.");
      toast.error(err.message || "Business registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BusinessAuthLayout title="Register your business" description="Create a business profile and assign its owner. Business verification will be required before creating Business Errands.">
      {message && <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      <form onSubmit={submit} className="mt-7 space-y-5">
        <div className="border-b border-slate-100 pb-2"><h2 className="font-extrabold text-slate-900">Business information</h2></div>
        <Field label="Business name" name="name" value={form.name} onChange={update} placeholder="Your registered or trading name" />
        <Field label="Legal name" name="legal_name" value={form.legal_name} onChange={update} required={false} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business email" name="email" type="email" value={form.email} onChange={update} required={false} />
          <Field label="Business phone" name="phone" type="tel" value={form.phone} onChange={update} required={false} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" name="website" type="url" value={form.website} onChange={update} required={false} placeholder="https://" />
          <Field label="Country code" name="country_code" value={form.country_code} onChange={update} placeholder="NG" />
        </div>
        <div className="border-b border-slate-100 pb-2 pt-2"><h2 className="font-extrabold text-slate-900">Business owner</h2><p className="mt-1 text-xs leading-5 text-slate-500">If you already have a personal ERANDER session, this account will be associated with it.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="first_name" value={form.first_name} onChange={update} required={false} />
          <Field label="Last name" name="last_name" value={form.last_name} onChange={update} required={false} />
        </div>
        <Field label="Owner's personal email" name="owner_email" type="email" value={form.owner_email} onChange={update} required={false} />
        <Field label="Owner's phone" name="owner_phone" type="tel" value={form.owner_phone} onChange={update} required={false} />
        <Field label="Create password" name="password" type="password" value={form.password} onChange={update} required={false} />
        <p className="text-xs leading-5 text-slate-500">If you are already signed in to your personal account, the server uses that verified identity and ignores these owner sign-up fields.</p>
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-extrabold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60">
          {loading ? "Submitting registration…" : "Register business"} {!loading && <ArrowRight size={17} />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/business/login" className="font-bold text-emerald-700 hover:underline">Business sign in</Link></p>
    </BusinessAuthLayout>
  );
}
