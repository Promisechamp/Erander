import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileClock,
  History,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import {
  activatePlatformConfiguration,
  createPlatformConfigurationDraft,
  getPlatformConfiguration,
  getPlatformConfigurationHistory,
} from "@/services/admin/adminConfigurationApi";

const SECTIONS = [
  { key: "finance.commission_policy", label: "Commission policy", group: "Financial rules", description: "Controls commission on all compensation retained by an erander.", icon: Wallet },
  { key: "finance.compensation_limits", label: "Compensation limits", group: "Financial rules", description: "Controls additional labour, handling and other compensation proposals.", icon: SlidersHorizontal },
  { key: "finance.expense_policy", label: "Reimbursable expenses", group: "Financial rules", description: "Defines which genuine operating expenses may be excluded from commission.", icon: CheckCircle2 },
  { key: "funding.release_policy", label: "Funding & release", group: "Transaction lifecycle", description: "Controls customer funding and release of errand execution funds.", icon: ArrowRight },
  { key: "wallet.earnings_policy", label: "Wallet earnings", group: "Transaction lifecycle", description: "Controls when erander earnings become pending and available.", icon: Wallet },
  { key: "security_deposit.policy", label: "Security deposits", group: "Trust & safety", description: "Controls the reservation requirement and authorized waivers.", icon: ShieldCheck },
  { key: "platform.risk_policy", label: "Risk & chat safety", group: "Trust & safety", description: "Controls mandatory risk review and chat transparency safeguards.", icon: LockKeyhole },
];

const FINANCE_EDITABLE_ROOTS = new Set(["default_rate_percent", "category_overrides", "country_overrides", "business_plan_overrides"]);

function labelize(value) {
  return String(value).replaceAll("_", " ").replaceAll(".", " / ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusTone(status) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function updateAtPath(source, path, nextValue) {
  if (!path.length) return nextValue;
  const [head, ...tail] = path;
  const copy = Array.isArray(source) ? [...source] : { ...source };
  copy[head] = updateAtPath(source?.[head], tail, nextValue);
  return copy;
}

function isEditablePath(path, permissions, configKey) {
  if (permissions.canManageAll) return true;
  if (!permissions.canManageCommission || configKey !== "finance.commission_policy") return false;
  if (path.length === 1 && FINANCE_EDITABLE_ROOTS.has(path[0])) return true;
  return path.length === 2 && FINANCE_EDITABLE_ROOTS.has(path[0]) && path[0] !== "default_rate_percent";
}

function ConfigFields({ value, path = [], onChange, permissions, configKey }) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    return (
      <div className={path.length ? "mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4" : "space-y-4"}>
        {path.length > 0 ? <div className="text-[11px] font-extrabold uppercase tracking-[.13em] text-slate-500">{labelize(path[path.length - 1])}</div> : null}
        <div className={path.length === 0 ? "grid gap-3 xl:grid-cols-2" : "grid gap-3 lg:grid-cols-2"}>
          {entries.map(([key, child]) => (
            <div key={[...path, key].join(".")} className={child && typeof child === "object" ? "min-w-0 xl:col-span-2" : "min-w-0"}>
              <ConfigFields
                value={child}
                path={[...path, key]}
                onChange={(next) => onChange(updateAtPath(value, [key], next))}
                permissions={permissions}
                configKey={configKey}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const fieldKey = path[path.length - 1] || "value";
  const editable = isEditablePath(path, permissions, configKey);
  const commonLabel = <label className="mb-1.5 block text-xs font-bold text-slate-600">{labelize(fieldKey)}</label>;

  if (typeof value === "boolean") {
    return (
      <div className="flex min-h-[62px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700">{labelize(fieldKey)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{value ? "Enabled" : "Disabled"}</p>
        </div>
        <button
          type="button"
          disabled={!editable}
          onClick={() => onChange(!value)}
          aria-pressed={value}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-emerald-500" : "bg-slate-300"} ${!editable ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-6" : "left-1"}`} />
        </button>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {commonLabel}
        <textarea
          rows={Math.min(5, Math.max(2, value.length))}
          disabled={!editable}
          value={value.join(", ")}
          onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-1.5 text-[10px] text-slate-400">Separate entries with commas.</p>
      </div>
    );
  }

  if (typeof value === "number" || value === null) {
    const percent = fieldKey.includes("percent") || fieldKey.includes("rate");
    const money = fieldKey.includes("minor");
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {commonLabel}
        <div className="relative">
          <input
            type="number"
            min="0"
            max={percent ? "100" : undefined}
            step={percent ? "0.1" : "1"}
            disabled={!editable}
            value={value ?? ""}
            placeholder={value === null ? "Not configured — review required" : "0"}
            onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-14 text-sm font-semibold text-[#14213D] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400">{percent ? "%" : money ? "minor" : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {commonLabel}
      <input
        type="text"
        disabled={!editable}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

function Metric({ label, value, tone = "navy" }) {
  const tones = tone === "mint" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-[#14213D]";
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-sm font-extrabold ${tones}`}>{value}</p></div>;
}

export default function AdminSettingsPage() {
  const [groups, setGroups] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [permissions, setPermissions] = useState({ canRead: false, canManageAll: false, canManageCommission: false });
  const [selectedKey, setSelectedKey] = useState(SECTIONS[0].key);
  const [draftConfig, setDraftConfig] = useState(null);
  const [reason, setReason] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getPlatformConfiguration();
      if (!response?.success) throw new Error(response?.message || "System configuration could not be loaded.");
      setGroups(response.data?.groups || []);
      setPermissions(response.data?.permissions || {});
    } catch (requestError) {
      setError(requestError?.message || "Unable to load system configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    getPlatformConfigurationHistory(selectedKey)
      .then((response) => {
        if (!cancelled) setAuditRows(response?.data?.audit || []);
      })
      .catch(() => {
        if (!cancelled) setAuditRows([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedKey, groups]);

  const selectedSection = SECTIONS.find((section) => section.key === selectedKey) || SECTIONS[0];
  const selectedGroup = groups.find((group) => group.key === selectedKey);
  const activeVersion = selectedGroup?.active || null;
  const drafts = selectedGroup?.drafts || [];
  const scheduled = selectedGroup?.scheduled || null;
  const canEditSelected = permissions.canManageAll || (selectedKey === "finance.commission_policy" && permissions.canManageCommission);

  useEffect(() => {
    setDraftConfig(activeVersion?.config ? structuredClone(activeVersion.config) : null);
    setReason("");
    setNotice("");
    setError("");
  }, [selectedKey, activeVersion?.id]);

  const activeCount = useMemo(() => groups.filter((group) => group.active).length, [groups]);
  const draftCount = useMemo(() => groups.reduce((total, group) => total + (group.drafts?.length || 0), 0), [groups]);

  const saveDraft = async () => {
    if (!canEditSelected || !draftConfig) return;
    if (reason.trim().length < 10) { setError("Add a reason of at least 10 characters before saving this draft."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await createPlatformConfigurationDraft(selectedKey, { config: draftConfig, reason: reason.trim() });
      if (!response?.success) throw new Error(response?.message || "The configuration draft could not be saved.");
      setNotice("Draft saved. It is not live until it is activated.");
      setReason("");
      await load();
    } catch (requestError) { setError(requestError?.message || "Unable to save this configuration draft."); }
    finally { setSaving(false); }
  };

  const activateDraft = async (version) => {
    if (!canEditSelected || !version) return;
    if (reason.trim().length < 10) { setError("Add a reason of at least 10 characters before activation."); return; }
    setActivating(true); setError(""); setNotice("");
    try {
      const payload = { versionId: version.id, reason: reason.trim() };
      if (effectiveAt) payload.effectiveAt = new Date(effectiveAt).toISOString();
      const response = await activatePlatformConfiguration(selectedKey, payload);
      if (!response?.success) throw new Error(response?.message || "The configuration could not be activated.");
      setNotice(response.message || "Configuration updated.");
      setReason(""); setEffectiveAt("");
      await load();
    } catch (requestError) { setError(requestError?.message || "Unable to activate this configuration."); }
    finally { setActivating(false); }
  };

  const resetDraft = () => {
    setDraftConfig(activeVersion?.config ? structuredClone(activeVersion.config) : null);
    setReason(""); setError(""); setNotice("Editor reset to the currently active version.");
  };

  const renderSidebarGroup = (groupName) => (
    <div key={groupName} className="mb-5">
      <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{groupName}</p>
      <div className="space-y-1">
        {SECTIONS.filter((section) => section.group === groupName).map((section) => {
          const Icon = section.icon;
          const group = groups.find((item) => item.key === section.key);
          const selected = selectedKey === section.key;
          return (
            <button key={section.key} type="button" onClick={() => setSelectedKey(section.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-[#14213D] text-white shadow-lg shadow-slate-900/10" : "text-slate-600 hover:bg-slate-100"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-white/10 text-emerald-300" : "bg-slate-100 text-slate-500"}`}><Icon size={17}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{section.label}</span><span className={`mt-0.5 block text-[10px] ${selected ? "text-slate-300" : "text-slate-400"}`}>{group?.active ? `v${group.active.version_number} active` : "Not initialized"}</span></span>
              {selected ? <ChevronDown size={15} className="-rotate-90 text-emerald-300"/> : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500"><RefreshCw className="animate-spin" size={17}/> Loading system configuration…</div></div>;

  return (
    <div className="space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-[26px] bg-[#14213D] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[34px] border-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-300"><Settings2 size={13}/> Super Admin control centre</div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">System configuration</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Manage ERANDER's financial, funding, wallet and safety rules through versioned policies. Changes remain drafts until explicitly activated.</p>
          </div>
          <button type="button" onClick={load} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15 lg:self-auto"><RefreshCw size={15}/> Refresh configuration</button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Policy groups" value={String(SECTIONS.length)} />
        <Metric label="Active policies" value={`${activeCount} / ${SECTIONS.length}`} tone="mint" />
        <Metric label="Unactivated drafts" value={String(draftCount)} tone={draftCount ? "amber" : "navy"} />
      </div>

      {error ? <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 shrink-0" size={17}/><p>{error}</p><button type="button" onClick={() => setError("")} className="ml-auto"><X size={16}/></button></div> : null}
      {notice ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={17}/><p>{notice}</p><button type="button" onClick={() => setNotice("")} className="ml-auto"><X size={16}/></button></div> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-3 pt-2"><div><p className="text-sm font-extrabold text-[#14213D]">Policy library</p><p className="mt-0.5 text-[10px] text-slate-400">Select a configuration area</p></div><SlidersHorizontal size={17} className="text-slate-400"/></div>
          {renderSidebarGroup("Financial rules")}
          {renderSidebarGroup("Transaction lifecycle")}
          {renderSidebarGroup("Trust & safety")}
          <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-bold text-[#14213D]"><LockKeyhole size={14}/> Controlled access</div><p className="mt-1.5 text-[11px] leading-5 text-slate-500">Super Admin controls platform boundaries. Finance Admins may manage commission rates only within approved limits.</p></div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><selectedSection.icon size={20}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-700">{selectedSection.group}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#14213D]">{selectedSection.label}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{selectedSection.description}</p></div></div>
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${statusTone(activeVersion ? "active" : "draft")}`}>{activeVersion ? `Active · v${activeVersion.version_number}` : "No active version"}</span>{scheduled ? <span className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${statusTone("scheduled")}`}>Scheduled · v{scheduled.version_number}</span> : null}</div>
            </div>
            <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-3 sm:p-6">
              <Metric label="Current version" value={activeVersion ? `v${activeVersion.version_number}` : "—"} tone="mint"/>
              <Metric label="Pending drafts" value={String(drafts.length)} tone={drafts.length ? "amber" : "navy"}/>
              <Metric label="Last activated" value={formatDate(activeVersion?.effective_at)} />
            </div>
            {selectedKey === "finance.commission_policy" ? <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:mx-6"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={17}/><div><p className="text-xs font-extrabold text-emerald-900">Approved v1 commission model</p><p className="mt-1 text-xs leading-5 text-emerald-800">The initial rate is 10% of all erander-retained compensation. Approved, genuine reimbursable expenses and the customer's item budget are excluded. An unrestricted “Other fee” cannot be used to avoid commission.</p></div></div> : null}
            {selectedKey === "funding.release_policy" ? <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:mx-6"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={17}/><div><p className="text-xs font-extrabold text-amber-950">Full release only in v1</p><p className="mt-1 text-xs leading-5 text-amber-900">Partial releases are technically future scope and are rejected by the backend in this version. The release arrangement must be disclosed before the erander accepts the errand.</p></div></div> : null}
            {selectedKey === "security_deposit.policy" ? <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:mx-6"><ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={17}/><div><p className="text-xs font-extrabold text-amber-950">100% reservation requirement</p><p className="mt-1 text-xs leading-5 text-amber-900">Tiered reservation percentages are disabled for v1. Any waiver must be authorized by a Super Admin, justified and audited.</p></div></div> : null}
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#14213D]">Configuration editor</h3><p className="mt-1 text-[11px] text-slate-400">Editing creates a new immutable version. It does not change the live policy.</p></div><span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500"><LockKeyhole size={12}/>{canEditSelected ? (permissions.canManageAll ? "Super Admin access" : "Commission-limited access") : "Read only"}</span></div>
              {draftConfig ? <ConfigFields value={draftConfig} onChange={setDraftConfig} permissions={permissions} configKey={selectedKey}/> : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No active configuration is available. Apply the configuration migration first.</div>}
              {canEditSelected ? <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div><label className="mb-1.5 block text-xs font-extrabold text-slate-700">Reason for change</label><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this policy needs to change…" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"/></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={resetDraft} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-100"><RefreshCw size={14}/> Reset editor</button><button type="button" disabled={saving || !draftConfig} onClick={saveDraft} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#14213D] px-4 text-xs font-extrabold text-white transition hover:bg-[#1d3158] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} Save new draft</button></div></div> : <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">You can inspect this policy but do not have permission to change it.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2"><FileClock size={18} className="text-emerald-700"/><h3 className="text-sm font-extrabold text-[#14213D]">Drafts awaiting activation</h3></div>
            <p className="mt-1 text-xs text-slate-500">A draft is not live. Review the version and explicitly activate it when approved.</p>
            {drafts.length ? <div className="mt-4 space-y-3">{drafts.map((draft) => <div key={draft.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-extrabold text-[#14213D]">Version {draft.version_number}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusTone("draft")}`}>Draft</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{draft.change_reason}</p><p className="mt-1 text-[10px] text-slate-400">Created {formatDate(draft.created_at)}</p></div><button type="button" disabled={!canEditSelected || activating} onClick={() => activateDraft(draft)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{activating ? <RefreshCw size={14} className="animate-spin"/> : <Check size={14}/>} Activate version</button></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-xs text-slate-400">No pending drafts for this policy.</div>}
            {drafts.length && canEditSelected ? <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div><label className="mb-1.5 block text-xs font-bold text-slate-600">Optional effective date</label><input type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"/><p className="mt-1 text-[10px] text-slate-400">Leave empty to activate immediately. Scheduled changes take effect at this time.</p></div><span className="hidden text-[10px] text-slate-400 sm:block">Activation uses the reason above.</span></div> : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2"><History size={18} className="text-slate-500"/><h3 className="text-sm font-extrabold text-[#14213D]">Version history</h3></div>
            <div className="mt-4 space-y-3">{(selectedGroup?.history || []).map((version) => <div key={version.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold text-[#14213D]">v{version.version_number}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusTone(version.version_status)}`}>{version.version_status}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{version.change_reason}</p><p className="mt-1 text-[10px] text-slate-400">Created {formatDate(version.created_at)}{version.effective_at ? ` · Effective ${formatDate(version.effective_at)}` : ""}</p></div><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400"><Clock3 size={12}/>{formatDate(version.created_at)}</span></div>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2"><CalendarClock size={18} className="text-slate-500"/><h3 className="text-sm font-extrabold text-[#14213D]">Configuration audit trail</h3></div>
            <p className="mt-1 text-xs text-slate-500">Who created or activated each version, when it happened and the recorded reason.</p>
            {historyLoading ? <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><RefreshCw size={13} className="animate-spin"/> Loading audit history…</div> : auditRows.length ? <div className="mt-4 space-y-3">{auditRows.map((entry) => <div key={entry.id} className="flex gap-3 rounded-xl border border-slate-100 p-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{entry.action === "activated" ? <Check size={15}/> : entry.action === "scheduled" ? <CalendarClock size={15}/> : <Plus size={15}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold capitalize text-[#14213D]">{labelize(entry.action)}</span>{entry.metadata?.versionNumber ? <span className="text-[10px] font-bold text-slate-400">Version {entry.metadata.versionNumber}</span> : null}<span className="text-[10px] text-slate-400">{formatDate(entry.created_at)}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{entry.reason}</p><p className="mt-1 text-[10px] text-slate-400">{entry.display_name || [entry.first_name, entry.last_name].filter(Boolean).join(" ") || "Administrator account unavailable"}</p></div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">No configuration changes have been recorded for this section.</div>}
          </section>
        </main>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><AlertTriangle className="mt-0.5 shrink-0 text-slate-500" size={16}/><p className="text-[11px] leading-5 text-slate-500">Configuration changes do not rewrite accepted errand agreements. The transaction must retain the policy version and financial breakdown that applied when the agreement was accepted. The backend enforces v1's full-release and 100% security-deposit invariants even if an administrator attempts to submit an incompatible configuration.</p></div>
    </div>
  );
}
