import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Hourglass,
  Inbox,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { listSupportTickets } from "@/services/support/supportApi";

import SupportStatusBadge from "./SupportStatusBadge";
import {
  formatSupportDate,
  getApiErrorMessage,
  getCategoryLabel,
  getPriorityLabel,
  getTicketsFromResponse,
} from "./supportUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Awaiting reply", value: "awaiting_user" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_STYLES = {
  low: "bg-surface-muted text-content-muted ring-line",
  normal: "bg-sky-50 text-sky-700 ring-sky-100",
  high: "bg-amber-50 text-amber-700 ring-amber-100",
  urgent: "bg-rose-50 text-rose-700 ring-rose-100",
};

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GREEN = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.normal
      }`}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, loading }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-content-muted">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-pale text-success-dark">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-12 animate-pulse rounded-lg bg-line" />
      ) : (
        <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-content">
          {value}
        </p>
      )}
    </div>
  );
}

function TicketRow({ ticket, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-surface-muted/50 focus:outline-none focus-visible:bg-surface-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
      >
        <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-brand sm:flex">
          <Ticket size={17} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-content-muted">
            <span className="font-extrabold uppercase tracking-wide">
              {ticket.ticket_number ?? "Support ticket"}
            </span>
            <span>{getCategoryLabel(ticket.category)}</span>
            {ticket.ticket_type === "issue" ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertCircle size={11} aria-hidden="true" />
                Errand issue
              </span>
            ) : null}
          </span>

          <span className="mt-1 block truncate text-sm font-extrabold text-content sm:text-base">
            {ticket.subject}
          </span>

          <span className="mt-0.5 line-clamp-2 text-sm leading-6 text-content-muted">
            {ticket.description}
          </span>

          <span className="mt-2 flex flex-wrap items-center gap-2">
            <SupportStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="inline-flex items-center gap-1 text-[11px] text-content-subtle">
              <Clock3 size={11} aria-hidden="true" />
              Updated {formatSupportDate(ticket.updated_at ?? ticket.created_at)}
            </span>
          </span>
        </span>

        <span className="mt-2 inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand transition group-hover:text-success-dark">
          <span className="hidden sm:inline">Open</span>
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="transition group-hover:translate-x-0.5"
          />
        </span>
      </button>
    </li>
  );
}

function Bone({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-full bg-line ${className}`} />;
}

function ListSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your support tickets</span>
      <ul className="divide-y divide-line-soft">
        {[0, 1, 2, 3].map((item) => (
          <li key={item} className="flex items-start gap-4 px-5 py-4 sm:px-6">
            <Bone className="hidden h-10 w-10 shrink-0 sm:block" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Bone className="h-3 w-40" />
              <Bone className="h-4 w-2/3" />
              <Bone className="h-3 w-full" />
              <div className="flex gap-2 pt-1">
                <Bone className="h-6 w-20" />
                <Bone className="h-6 w-16" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ hasFilter, onCreate, onClear }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
        <MessageCircle size={26} aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-base font-extrabold text-content">
        {hasFilter ? "No tickets found" : "You haven't contacted support yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
        {hasFilter
          ? "No support tickets match this filter. Try another status or search."
          : "Whenever you need help with your account, payments or errands, we're here."}
      </p>

      {hasFilter ? (
        <button type="button" onClick={onClear} className={`${BTN_GHOST} mt-5`}>
          Clear filters
        </button>
      ) : (
        <button type="button" onClick={onCreate} className={`${BTN_NAVY} mt-5`}>
          <Plus size={16} aria-hidden="true" />
          Create a ticket
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function SupportCenter() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const response = await listSupportTickets({ status, page: 1, limit: 50 });
        setTickets(getTicketsFromResponse(response));
      } catch (requestError) {
        const message = getApiErrorMessage(
          requestError,
          "We couldn't load your support tickets."
        );

        setError(message);
        if (silent) toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [status]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;

    return tickets.filter((ticket) =>
      [
        ticket.ticket_number,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [tickets, search]);

  const counts = useMemo(() => {
    const count = (list) =>
      tickets.filter((ticket) => list.includes(ticket.status)).length;

    return {
      total: tickets.length,
      open: count(["open", "in_progress"]),
      waiting: count(["awaiting_user"]),
      done: count(["resolved", "closed"]),
    };
  }, [tickets]);

  const hasFilter = Boolean(search || status);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  const openTicket = (ticketId) => navigate(`/dashboard/support/${ticketId}`);
  const createTicket = () => navigate("/dashboard/support/new");

  return (
    <DashboardLayout title="Support center">
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
              ERANDER support
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
              How can we help you?
            </h1>
            <p className="mt-1 max-w-xl text-sm text-content-muted">
              Get help with your account, payments and errands, and follow every
              conversation with our team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadTickets({ silent: true })}
              disabled={refreshing || loading}
              aria-label="Refresh tickets"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-white px-4 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button type="button" onClick={createTicket} className={`${BTN_GREEN} !h-10 !py-0`}>
              <Plus size={16} aria-hidden="true" />
              Create a ticket
            </button>
          </div>
        </header>

        {/* Stats */}
        <section
          aria-label="Ticket summary"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <StatCard label="All tickets" value={counts.total} icon={Inbox} loading={loading} />
          <StatCard label="Open" value={counts.open} icon={MessageCircle} loading={loading} />
          <StatCard label="Awaiting your reply" value={counts.waiting} icon={Hourglass} loading={loading} />
          <StatCard label="Resolved or closed" value={counts.done} icon={CheckCircle2} loading={loading} />
        </section>

        {/* Tickets */}
        <section
          aria-label="My support tickets"
          className="overflow-hidden rounded-3xl border border-line bg-surface-white"
        >
          <div className="space-y-4 border-b border-line-soft p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-content">
                My support tickets
              </h2>
              <p className="mt-0.5 text-sm text-content-muted">
                View and manage your conversations with ERANDER support.
              </p>
            </div>

            <div className="relative">
              <label htmlFor="ticket-search" className="sr-only">
                Search tickets
              </label>

              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-subtle"
              />

              <input
                id="ticket-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets"
                className="h-11 w-full rounded-full border border-line bg-surface-white pl-11 pr-10 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div
              role="group"
              aria-label="Filter by status"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {STATUS_FILTERS.map((filter) => {
                const active = status === filter.value;

                return (
                  <button
                    key={filter.value || "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatus(filter.value)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-brand text-content-inverse"
                        : "bg-surface-muted text-content-muted hover:text-content"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <AlertCircle size={26} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-content">
                Unable to load support tickets
              </h3>
              <p className="mt-1 max-w-md break-words text-sm leading-6 text-content-muted">
                {error}
              </p>
              <button type="button" onClick={() => loadTickets()} className={`${BTN_NAVY} mt-5`}>
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState hasFilter={hasFilter} onCreate={createTicket} onClear={clearFilters} />
          ) : (
            <>
              <ul className="divide-y divide-line-soft">
                {filteredTickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => openTicket(ticket.id)}
                  />
                ))}
              </ul>

              <p className="border-t border-line-soft px-5 py-3.5 text-xs font-semibold tabular-nums text-content-muted sm:px-6">
                Showing {filteredTickets.length}{" "}
                {filteredTickets.length === 1 ? "ticket" : "tickets"}
              </p>
            </>
          )}
        </section>

        {/* Tip */}
        <section
          aria-label="Report an errand issue"
          className="flex items-start gap-4 rounded-3xl bg-brand-pale p-5 sm:p-6"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-white text-success-dark">
            <FileText size={19} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h3 className="font-extrabold text-brand">
              Need to report an issue with an errand?
            </h3>
            <p className="mt-1 text-sm leading-6 text-success-dark">
              Open the errand and use its report-issue option, so your request is
              linked to the right errand.
            </p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}