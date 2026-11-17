import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Eye, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import PrivateChatImage from "@/components/chat/PrivateChatImage";
import { getAdminChatDetails, listAdminChatReports, listAdminChats, updateAdminChatReport } from "@/services/chat/chatApi";

const ACCESS_REASONS = [
  ["reported_conversation", "Reviewing a reported conversation"],
  ["fraud_prevention", "Fraud prevention / off-platform activity"],
  ["safety_review", "Trust and safety review"],
  ["customer_support", "Customer support case"],
  ["legal_compliance", "Legal or compliance request"],
  ["quality_review", "Authorized quality review"],
];
const REPORT_LABELS = {
  fraud_scam: "Fraud or scam", harassment: "Harassment", abuse: "Abuse",
  unsafe_request: "Unsafe request", off_platform_contact: "Off-platform contact",
  spam: "Spam", other: "Other",
};

function HighlightedMessage({ text, flags = [] }) {
  if (!text) return null;
  const terms = [...new Set(flags.flatMap((flag) => flag.matches || []).filter(Boolean))];
  const ranges = [];
  for (const term of terms) {
    let start = 0;
    while (start < text.length) {
      const index = text.toLowerCase().indexOf(term.toLowerCase(), start);
      if (index < 0) break;
      ranges.push([index, index + term.length]);
      start = index + Math.max(term.length, 1);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const nodes = [];
  let cursor = 0;
  merged.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(<span key={`plain-${index}`}>{text.slice(cursor, start)}</span>);
    nodes.push(<mark key={`flag-${index}`} className="rounded bg-amber-200 px-0.5 text-amber-950 ring-1 ring-amber-300">{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) nodes.push(<span key="plain-tail">{text.slice(cursor)}</span>);
  return nodes;
}

export default function AdminChatsPage() {
  const { admin } = useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const errandIdFilter = searchParams.get("errandId") || "";
  const canManage = admin?.permissions?.includes("*") || admin?.permissions?.includes("chats:manage");
  const [tab, setTab] = useState("conversations");
  const [chats, setChats] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [accessReason, setAccessReason] = useState("reported_conversation");
  const [accessPromptOpen, setAccessPromptOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [resolution, setResolution] = useState("");
  const [reportStatus, setReportStatus] = useState("under_review");
  const [updatingReport, setUpdatingReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chatResult, reportResult] = await Promise.all([
        listAdminChats({ search, flagged, status, errandId: errandIdFilter, page }),
        listAdminChatReports("active"),
      ]);
      setChats(chatResult?.data?.chats || []);
      setPagination(chatResult?.data?.pagination || { page, pageSize: 50, total: 0, totalPages: 1 });
      setReports(reportResult?.data?.reports || []);
    } catch (error) {
      toast.error(error?.message || "Unable to load chat monitoring records.");
    } finally { setLoading(false); }
  }, [search, flagged, status, errandIdFilter, page]);

  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { setPage(1); }, [search, flagged, status, errandIdFilter]);

  const openDetail = async (chat, reason = null) => {
    setSelected(chat);
    setDetail(null);
    setReportStatus("under_review");
    setResolution("");
    if (!reason) {
      setAccessPromptOpen(true);
      return;
    }
    setAccessReason(reason);
    setAccessPromptOpen(false);
    setDetailLoading(true);
    try {
      const result = await getAdminChatDetails(chat.id || chat.chat_id, reason, { limit: 100 });
      setDetail(result?.data || null);
      setHasOlderMessages((result?.data?.messages || []).length === 100);
    } catch (error) {
      toast.error(error?.message || "Unable to open this conversation.");
      setSelected(null);
    } finally { setDetailLoading(false); }
  };

  const confirmPrivateAccess = async () => {
    if (!selected) return;
    await openDetail(selected, accessReason);
  };

  const loadEarlierAdminMessages = async () => {
    if (!selected || !detail?.messages?.length || loadingOlderMessages || !hasOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const result = await getAdminChatDetails(selected.id || selected.chat_id, accessReason, {
        before: detail.messages[0].created_at,
        limit: 100,
      });
      const older = result?.data?.messages || [];
      setDetail((current) => {
        const merged = new Map((current?.messages || []).map((message) => [message.id, message]));
        older.forEach((message) => merged.set(message.id, message));
        return { ...current, ...result.data, messages: [...merged.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) };
      });
      setHasOlderMessages(older.length === 100);
    } catch (error) {
      toast.error(error?.message || "Unable to load earlier messages.");
    } finally { setLoadingOlderMessages(false); }
  };

  const updateReport = async (report) => {
    if (!canManage) return;
    if (["resolved", "dismissed"].includes(reportStatus) && !resolution.trim()) {
      toast.error("Add a resolution note before closing this report.");
      return;
    }
    setUpdatingReport(true);
    try {
      await updateAdminChatReport(report.id, { status: reportStatus, resolutionNote: resolution });
      toast.success("Report updated.");
      setResolution("");
      await load();
      if (selected) await openDetail(selected, accessReason);
    } catch (error) { toast.error(error?.message || "Unable to update the report."); }
    finally { setUpdatingReport(false); }
  };

  const currentReport = detail?.reports?.find((report) => report.status === "open" || report.status === "under_review");

  return (
    <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600">Trust & safety</p><h1 className="mt-1 text-2xl font-extrabold text-[#14213D] sm:text-3xl">Chat monitoring</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Review errand conversations, reported content, and messages flagged for possible off-platform contact. Every private chat access is audited.</p></div><div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800"><ShieldCheck size={15} /> Authorized access only</div></header>

        {errandIdFilter ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"><span>Showing conversations linked to errand <strong className="break-all">{errandIdFilter}</strong></span><button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete("errandId"); setSearchParams(next); }} className="font-bold underline underline-offset-2">Clear errand filter</button></div> : null}

        <div className="flex gap-2 border-b border-slate-200"><button onClick={() => setTab("conversations")} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "conversations" ? "border-[#35D07F] text-[#14213D]" : "border-transparent text-slate-500"}`}>All conversations</button><button onClick={() => setTab("reports")} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab === "reports" ? "border-[#35D07F] text-[#14213D]" : "border-transparent text-slate-500"}`}>Reports <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">{reports.length}</span></button></div>

        {tab === "conversations" ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search errand, reference, customer, erander" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#35D07F]" /></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={flagged} onChange={(event) => setFlagged(event.target.checked)} className="accent-emerald-600" /> Flagged only</label><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option></select></div>
          {loading ? <div className="p-10 text-center text-sm text-slate-400">Loading conversations…</div> : chats.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No conversations match these filters.</div> : <div className="divide-y divide-slate-100">{chats.map((chat) => <div key={chat.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold text-[#14213D]">{chat.errand_title}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{chat.reference_code}</span>{chat.risk_review_required ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"><AlertTriangle size={11} /> Review flagged</span> : null}</div><p className="mt-1 text-xs text-slate-500">Customer: {chat.customer_name} · Erander: {chat.erander_name}</p><p className="mt-1 text-[10px] text-slate-400">{chat.status} · {chat.flagged_messages} flagged message(s) · {chat.open_reports} open report(s)</p></div><button onClick={() => openDetail(chat)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#14213D] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#20375f]"><Eye size={14} /> Review conversation</button></div>)}</div>}
          {pagination.totalPages > 1 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><p className="text-xs text-slate-500">Showing {Math.min((page - 1) * pagination.pageSize + 1, pagination.total)}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total} conversations</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Previous</button><span className="text-xs font-semibold text-slate-500">Page {page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Next</button></div></div> : null}
        </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="font-extrabold text-[#14213D]">Open chat reports</h2><p className="mt-1 text-xs text-slate-500">Reports remain available even if a participant hides or deletes the conversation from their own list.</p></div>{reports.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">There are no open reports.</div> : <div className="divide-y divide-slate-100">{reports.map((report) => <div key={report.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-rose-700">{REPORT_LABELS[report.reason_code] || report.reason_code}</span><span className="text-[10px] text-slate-400">{new Date(report.created_at).toLocaleString()}</span></div><p className="mt-2 text-sm font-bold text-[#14213D]">{report.errand_title} · {report.reference_code}</p><p className="mt-1 text-xs text-slate-500">Reported by {report.reporter_name}{report.description ? ` — ${report.description}` : ""}</p></div><button onClick={() => { setTab("conversations"); openDetail({ id: report.chat_id }, "reported_conversation"); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#14213D] hover:bg-slate-50">Open reported chat</button></div>)}</div>}</section>}

      {selected ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"><section className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">Private conversation review</p><h2 className="mt-1 text-lg font-extrabold text-[#14213D]">{detail?.chat?.errand_title || "Conversation details"}</h2><p className="mt-1 text-xs text-slate-500">{detail?.chat?.reference_code || ""} · Access reason: {ACCESS_REASONS.find(([v]) => v === accessReason)?.[1]}</p></div><button onClick={() => { setSelected(null); setDetail(null); setAccessPromptOpen(false); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button></header>
        {accessPromptOpen ? <div className="mx-auto w-full max-w-lg p-6 sm:p-10"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><ShieldCheck size={25} /></div><h3 className="mt-4 text-center text-lg font-extrabold text-[#14213D]">Why do you need to view this chat?</h3><p className="mt-2 text-center text-sm leading-6 text-slate-500">Private conversations are only opened for an authorized purpose. Your reason and access time will be recorded in the audit history.</p><label className="mt-5 block text-xs font-bold text-slate-700">Access reason<select value={accessReason} onChange={(event) => setAccessReason(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{ACCESS_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={confirmPrivateAccess} className="mt-4 w-full rounded-xl bg-[#14213D] px-4 py-3 text-sm font-bold text-white">Continue to conversation</button></div> : detailLoading ? <div className="p-12 text-center text-sm text-slate-500">Loading conversation and recording access…</div> : detail ? <div className="min-h-0 flex-1 overflow-y-auto"><div className="grid gap-4 border-b border-slate-100 p-4 sm:grid-cols-2 sm:p-5"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Customer</p><p className="mt-1 text-sm font-bold text-[#14213D]">{detail.chat.customer_name}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Erander</p><p className="mt-1 text-sm font-bold text-[#14213D]">{detail.chat.erander_name}</p></div></div>
          <div className="grid min-h-[400px] lg:grid-cols-[minmax(0,1fr)_320px]"><section className="space-y-3 border-b border-slate-100 p-4 lg:border-b-0 lg:border-r sm:p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-[#14213D]">Messages ({detail.messages?.length || 0})</h3><span className="text-[10px] text-slate-400">Read-only · immutable history</span></div>{hasOlderMessages ? <div className="flex justify-center"><button onClick={loadEarlierAdminMessages} disabled={loadingOlderMessages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-50">{loadingOlderMessages ? "Loading…" : "Load earlier messages"}</button></div> : null}{(detail.messages || []).map((message) => <article key={message.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-extrabold text-[#14213D]">{message.sender_name} <span className="font-medium text-slate-400">· {message.sender_id === detail.chat.customer_id ? "Customer" : "Erander"}</span></p><time className="text-[10px] text-slate-400">{new Date(message.created_at).toLocaleString()}</time></div>{detail.reports?.some((report) => report.message_id === message.id) ? <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-700">Reported message</span> : null}{message.body ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><HighlightedMessage text={message.body} flags={message.risk_flags || []} /></p> : null}{message.attachment_id ? <PrivateChatImage src={`${import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "")}/admin/chats/attachments/${message.attachment_id}?reason=${accessReason}`} alt={message.original_filename || "Chat attachment"} className="mt-2 max-h-64 rounded-xl object-contain" /> : null}{message.risk_review_required ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2"><p className="text-[10px] font-extrabold uppercase text-amber-800">Content flagged for review</p>{(message.risk_flags || []).map((flag) => <div key={flag.type} className="mt-1 text-xs text-amber-900"><strong>{flag.type.replaceAll("_", " ")}:</strong> {(flag.matches || []).join(" · ")}</div>)}</div> : null}</article>)}</section>
            <aside className="space-y-5 bg-slate-50 p-4 sm:p-5"><div><h3 className="text-sm font-extrabold text-[#14213D]">Reports</h3>{detail.reports?.length ? detail.reports.map((report) => <div key={report.id} className="mt-2 rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-rose-700">{REPORT_LABELS[report.reason_code] || report.reason_code}</p><p className="mt-1 text-xs text-slate-600">{report.description || "No additional details."}</p><p className="mt-1 text-[10px] text-slate-400">{report.status} · {report.reporter_name}</p>{report.resolution_note ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">Resolution: {report.resolution_note}</p> : null}</div>) : <p className="mt-2 text-xs text-slate-500">No reports submitted.</p>}</div>
              {currentReport && canManage ? <div className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="text-sm font-extrabold text-[#14213D]">Resolve report</h3><select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} placeholder="Resolution note" className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /><button disabled={updatingReport} onClick={() => updateReport(currentReport)} className="mt-2 w-full rounded-lg bg-[#14213D] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{updatingReport ? "Saving…" : "Update report"}</button></div> : null}
              <div><h3 className="text-sm font-extrabold text-[#14213D]">Conversation events</h3>{(detail.events || []).map((event) => <p key={event.id} className="mt-2 text-[11px] text-slate-500">{event.event_type.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}</p>)}</div>
              <div><h3 className="text-sm font-extrabold text-[#14213D]">Admin access history</h3>{(detail.accessLogs || []).map((log) => <p key={log.id} className="mt-2 text-[10px] text-slate-500">{log.admin_name} · {log.access_reason.replaceAll("_", " ")} · {new Date(log.accessed_at).toLocaleString()}</p>)}</div>
            </aside></div></div> : <div className="p-8 text-center text-sm text-slate-500">Conversation could not be loaded.</div>}
      </section></div> : null}
    </div>
  );
}
