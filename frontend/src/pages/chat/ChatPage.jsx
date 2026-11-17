import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, MessageCircle, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ChatThread from "./ChatThread";
import { archiveChat, hideChat, listChats, unarchiveChat } from "@/services/chat/chatApi";

function timeLabel(value) {
  if (!value) return "New conversation";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadChats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await listChats({ archived, search, page });
      setChats(result?.data?.chats || []);
      const nextPagination = result?.data?.pagination || { page, pageSize: 30, total: 0, totalPages: 1 };
      setPagination(nextPagination);
      if (page > nextPagination.totalPages) setPage(nextPagination.totalPages);
      setError("");
    } catch (loadError) {
      setError(loadError?.message || "Unable to load your conversations.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [archived, search, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadChats(), 180);
    return () => window.clearTimeout(timer);
  }, [loadChats]);

  useEffect(() => { setPage(1); }, [archived, search]);

  useEffect(() => {
    const timer = window.setInterval(() => loadChats({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadChats]);

  const handleArchive = async (event, id) => {
    event.stopPropagation();
    try {
      await archiveChat(id);
      toast.success("Conversation archived.");
      await loadChats({ silent: true });
      if (chatId === id) navigate("/chat");
    } catch (actionError) {
      toast.error(actionError?.message || "Unable to archive conversation.");
    }
  };

  const handleUnarchive = async (event, id) => {
    event.stopPropagation();
    try {
      await unarchiveChat(id);
      toast.success("Conversation restored to your inbox.");
      await loadChats({ silent: true });
    } catch (actionError) {
      toast.error(actionError?.message || "Unable to restore conversation.");
    }
  };

  const handleHide = async (event, id) => {
    event.stopPropagation();
    const confirmed = window.confirm("Delete this conversation from your chat list? This affects only your copy. The other participant keeps their conversation. Text messages and audit records remain; eligible images are automatically removed 30 days after successful settlement, unless a dispute, refund, claim, or support review is unresolved.");
    if (!confirmed) return;
    try {
      await hideChat(id);
      toast.success("Conversation deleted from your list. The other participant keeps their copy.");
      await loadChats({ silent: true });
      if (chatId === id) navigate("/chat");
    } catch (actionError) {
      toast.error(actionError?.message || "Unable to remove conversation from your list.");
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[min(78vh,850px)] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={`flex min-h-[600px] flex-col border-r border-slate-200 ${chatId ? "hidden lg:flex" : ""}`}>
            <header className="border-b border-slate-100 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#16864B]">ERANDER</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#14213D]">Messages</h1></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8FBF0] text-[#16864B]"><MessageCircle size={21} /></div></div><div className="relative mt-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats or errands" className="h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pl-9 pr-9 text-sm outline-none focus:border-[#35D07F]" />{search ? <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={15} /></button> : null}</div><div className="mt-3 flex rounded-xl bg-slate-100 p-1"><button onClick={() => setArchived(false)} className={`flex-1 rounded-lg py-2 text-xs font-bold ${!archived ? "bg-white text-[#14213D] shadow-sm" : "text-slate-500"}`}>Inbox</button><button onClick={() => setArchived(true)} className={`flex-1 rounded-lg py-2 text-xs font-bold ${archived ? "bg-white text-[#14213D] shadow-sm" : "text-slate-500"}`}>Archived</button></div></header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Loading conversations…</div>
              ) : error ? (
                <div className="p-6 text-center text-sm text-rose-600">
                  {error}
                  <button onClick={() => loadChats()} className="mt-3 block w-full font-bold text-[#16864B]">Try again</button>
                </div>
              ) : chats.length === 0 ? (
                <div className="px-7 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8FBF0] text-[#16864B]"><MessageCircle size={24} /></div>
                  <h2 className="mt-4 text-sm font-extrabold text-[#14213D]">{archived ? "No archived conversations" : "Your inbox is quiet"}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Conversations begin from an errand when a customer and an erander have an offer relationship.</p>
                </div>
              ) : chats.map((chat) => (
                <div key={chat.id} className={`group flex items-center gap-1 border-b border-slate-100 px-2 py-2 transition hover:bg-[#F8FAFC] ${chatId === chat.id ? "bg-[#F1FBF5]" : "bg-white"}`}>
                  <button type="button" onClick={() => navigate(`/chat/${chat.id}`)} className="flex min-w-0 flex-1 items-start gap-3 px-2 py-2 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8FBF0] text-sm font-extrabold text-[#16864B]">
                      {chat.avatar_url ? <img src={chat.avatar_url} alt="" className="h-full w-full object-cover" /> : (chat.other_display_name || "U").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-extrabold text-[#14213D]">{chat.other_display_name}</p><span className="shrink-0 text-[10px] text-slate-400">{timeLabel(chat.last_message_at || chat.created_at)}</span></div>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{chat.errand_title}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{chat.last_message_type === "image" && !chat.last_message_body ? "📷 Image" : chat.last_message_body || "Conversation created"}</p>
                      <div className="mt-2 flex items-center justify-between gap-2"><span className={`truncate text-[10px] font-bold ${chat.status === "open" ? "text-emerald-700" : "text-slate-400"}`}>{chat.status === "open" ? "Open" : "Closed"} · {chat.reference_code}</span>{Number(chat.unread_count) > 0 ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#35D07F] px-1.5 text-[10px] font-extrabold text-[#14213D]">{chat.unread_count}</span> : null}</div>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <button type="button" onClick={(event) => archived ? handleUnarchive(event, chat.id) : handleArchive(event, chat.id)} title={archived ? "Restore to inbox" : "Archive"} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-[#16864B]"><span className="sr-only">{archived ? "Restore to inbox" : "Archive conversation"}</span>{archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
                    <button type="button" onClick={(event) => handleHide(event, chat.id)} title="Delete from your list" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><span className="sr-only">Delete conversation from your list</span><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {pagination.totalPages > 1 ? <div className="flex flex-col gap-2 border-t border-slate-100 p-3"><p className="text-center text-[10px] text-slate-400">{pagination.total} conversations · Page {page} of {pagination.totalPages}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Next</button></div></div> : null}
            </div>
          </aside>
          <section className={`min-w-0 ${chatId ? "block" : "hidden lg:flex lg:items-center lg:justify-center"}`}>
            {chatId ? <ChatThread chatId={chatId} mode="page" onClose={() => navigate("/chat")} onChanged={() => loadChats({ silent: true })} /> : <div className="max-w-sm px-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#E8FBF0] text-[#16864B]"><MessageCircle size={28} /></div><h2 className="mt-5 text-xl font-extrabold text-[#14213D]">Your errand conversations, together.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Choose a conversation to continue. Each errand and erander pairing has its own separate chat.</p></div>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
