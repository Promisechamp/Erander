import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";
import BusinessWorkspaceNav from "@/components/layout/BusinessWorkspaceNav";
import { updateBusinessProfile } from "@/services/business/businessWorkspaceApi";

export default function BusinessSettingsPage() {
  const { business, refreshBusiness } = useBusinessAuth();
  const canEdit = ["owner", "admin"].includes(String(business?.membership_role || "").toLowerCase());
  const [form, setForm] = useState({ name: "", legal_name: "", description: "", logo_url: "", email: "", phone: "", website: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm({ name: business?.name || "", legal_name: business?.legal_name || "", description: business?.description || "", logo_url: business?.logo_url || "", email: business?.email || "", phone: business?.phone || "", website: business?.website || "" });
  }, [business]);
  function change(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateBusinessProfile(form);
      await refreshBusiness();
      toast.success("Business profile updated.");
    } catch (error) { toast.error(error?.message || "We couldn't update the business profile."); }
    finally { setSaving(false); }
  }
  const fields = [
    ["name", "Business display name", true], ["legal_name", "Registered legal name"],
    ["description", "Business description"], ["logo_url", "Logo image URL (HTTPS)"],
    ["email", "Business email"], ["phone", "Business phone"], ["website", "Website (HTTPS)"],
  ];
  return <><BusinessWorkspaceNav /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Business settings</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Business identity & branding</h1><p className="mt-2 text-sm leading-6 text-slate-500">These details represent the business on business errands. They do not change the personal identity of the member taking an action.</p>{!canEdit && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Only a business owner or administrator can edit business branding.</div>}<form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{fields.map(([name, label, required]) => <label key={name} className="block"><span className="text-sm font-bold text-slate-700">{label}</span>{name === "description" ? <textarea name={name} value={form[name]} onChange={change} rows={4} disabled={!canEdit} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" /> : <input name={name} value={form[name]} onChange={change} required={required} type={name === "email" ? "email" : "text"} disabled={!canEdit} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" />}</label>)}<button disabled={!canEdit || saving} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-50">{saving ? "Saving…" : "Save business profile"}</button></form></div></main></>;
}
