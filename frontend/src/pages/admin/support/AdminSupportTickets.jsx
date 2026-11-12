import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Headphones,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { listAdminSupportTickets } from "@/services/support/supportApi";

import {
  extractPagination,
  extractTickets,
  formatDate,
  getCategoryLabel,
  getErrorMessage,
  getPriorityLabel,
  getStatusLabel,
  getUserName,
} from "./adminSupportUtils";

const PAGE_SIZE = 15;

const statusOptions = [
  { label: "All statuses", value: "" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Awaiting user", value: "awaiting_user" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const priorityOptions = [
  { label: "All priorities", value: "" },
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const typeOptions = [
  { label: "All ticket types", value: "" },
  { label: "General support", value: "support" },
  { label: "Errand issue", value: "issue" },
];

const statusStyles = {
  open: "bg-blue-50 text-blue-700 border-blue-100",
  in_progress: "bg-amber-50 text-amber-700 border-amber-100",
  awaiting_user: "bg-violet-50 text-violet-700 border-violet-100",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const priorityStyles = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        statusStyles[status] ?? statusStyles.open
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        priorityStyles[priority] ?? priorityStyles.normal
      }`}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#14213D]">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TicketTableRow({ ticket, onClick }) {
  const user = ticket.user ?? ticket.profile ?? ticket.customer ?? null;
  const userName = getUserName(user);

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80"
    >
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-extrabold tracking-wide text-[#14213D]">
            {ticket.ticket_number ?? "—"}
          </p>
          <p className="mt-1 max-w-[280px] truncate text-sm font-semibold text-slate-700">
            {ticket.subject}
          </p>
          <p className="mt-1 max-w-[280px] truncate text-xs text-slate-400">
            {ticket.description}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8FBF0] text-xs font-extrabold text-emerald-800">
            {userName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("") || "U"}
          </div>

          <div className="min-w-0">
            <p className="max-w-[150px] truncate text-sm font-bold text-slate-700">
              {userName}
            </p>
            <p className="text-xs text-slate-400">
              {user?.email ?? user?.phone ?? "User"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">
            {getCategoryLabel(ticket.category)}
          </p>
          <span className="text-[11px] text-slate-400">
            {ticket.ticket_type === "issue"
              ? "Errand issue"
              : "General support"}
          </span>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="space-y-2">
          <StatusBadge status={ticket.status} />
          <div>
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="whitespace-nowrap text-xs font-semibold text-slate-600">
          {formatDate(ticket.updated_at ?? ticket.created_at)}
        </p>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition group-hover:bg-[#E8FBF0] group-hover:text-emerald-700">
          <ArrowRight size={17} />
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ onClear }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Ticket size={27} />
      </div>

      <h3 className="mt-5 text-base font-bold text-[#14213D]">
        No support tickets found
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        There are no tickets matching your current search and filters.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-5 text-sm font-bold text-emerald-700 hover:text-emerald-800"
      >
        Clear filters
      </button>
    </div>
  );
}

export default function AdminSupportTickets() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadTickets = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await listAdminSupportTickets({
          search,
          status,
          priority,
          ticket_type: ticketType,
          page,
          limit: PAGE_SIZE,
        });

        setTickets(extractTickets(response));
        setPagination(extractPagination(response));
      } catch (requestError) {
        const message = getErrorMessage(
          requestError,
          "Unable to load support tickets."
        );

        setError(message);

        if (silent) toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, status, priority, ticketType, page]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setPriority("");
    setTicketType("");
    setPage(1);
  };

  const hasFilters = Boolean(
    searchInput || search || status || priority || ticketType
  );

  const currentCounts = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === "open").length,
      inProgress: tickets.filter(
        (ticket) => ticket.status === "in_progress"
      ).length,
      awaiting: tickets.filter(
        (ticket) => ticket.status === "awaiting_user"
      ).length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
    }),
    [tickets]
  );

  const totalPages =
    pagination.totalPages ??
    pagination.total_pages ??
    (pagination.total
      ? Math.ceil(pagination.total / PAGE_SIZE)
      : null);

  const currentPage =
    pagination.page ??
    pagination.currentPage ??
    pagination.current_page ??
    page;

  const totalRecords =
    pagination.total ??
    pagination.totalRecords ??
    pagination.total_records ??
    null;

  const goToTicket = (ticketId) => {
    navigate(`/admin/support/${ticketId}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <Headphones size={15} />
            Customer operations
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-[#14213D] sm:text-3xl">
            Support management
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Review customer requests, manage issues and monitor support
            conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadTickets({ silent: true })}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50 xl:self-auto"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh queue
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Open tickets"
          value={currentCounts.open}
          description="Open tickets in this result page"
          icon={Ticket}
          iconClass="bg-blue-50 text-blue-700"
        />

        <SummaryCard
          label="In progress"
          value={currentCounts.inProgress}
          description="Currently being handled"
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-700"
        />

        <SummaryCard
          label="Awaiting user"
          value={currentCounts.awaiting}
          description="Waiting for customer response"
          icon={MessageCircle}
          iconClass="bg-violet-50 text-violet-700"
        />

        <SummaryCard
          label="Urgent tickets"
          value={currentCounts.urgent}
          description="Urgent priority in this result page"
          icon={ShieldAlert}
          iconClass="bg-red-50 text-red-700"
        />
      </div>

      {/* Queue panel */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-[#14213D]">
              Support ticket queue
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search, review and manage incoming support requests.
            </p>
          </div>

          {totalRecords !== null && (
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
              {totalRecords.toLocaleString()} total tickets
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-4 border-b border-slate-100 bg-slate-50/60 p-5 sm:p-6">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search ticket number, subject or description..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            />

            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <FilterSelect
              label="Status"
              value={status}
              options={statusOptions}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />

            <FilterSelect
              label="Priority"
              value={priority}
              options={priorityOptions}
              onChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
            />

            <FilterSelect
              label="Ticket type"
              value={ticketType}
              options={typeOptions}
              onChange={(value) => {
                setTicketType(value);
                setPage(1);
              }}
            />

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Filter size={15} />
              Clear filters
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex min-h-80 flex-col items-center justify-center">
            <LoaderCircle
              size={28}
              className="animate-spin text-emerald-600"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Loading support queue...
            </p>
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <AlertCircle
              size={30}
              className="mx-auto text-red-500"
            />
            <h3 className="mt-4 font-bold text-[#14213D]">
              Unable to load support queue
            </h3>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => loadTickets()}
              className="mt-5 rounded-xl bg-[#14213D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1d3157]"
            >
              Try again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Ticket
                    </th>
                    <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Submitted by
                    </th>
                    <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Category
                    </th>
                    <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Status / Priority
                    </th>
                    <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Last updated
                    </th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => (
                    <TicketTableRow
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => goToTicket(ticket.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <p className="text-xs font-medium text-slate-500">
                Page {currentPage}
                {totalPages ? ` of ${totalPages}` : ""}
                {totalRecords !== null
                  ? ` · ${totalRecords} tickets`
                  : ""}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={
                    loading ||
                    (totalPages !== null && page >= totalPages) ||
                    (!totalPages && tickets.length < PAGE_SIZE)
                  }
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}