import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Compass,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import Select from "@/components/Select";
import { apiRequest } from "@/services/api";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "shopping", label: "Shopping" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
  { value: "home_help", label: "Home help" },
  { value: "personal_assistance", label: "Personal assistance" },
  { value: "business_support", label: "Business support" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "budget_high", label: "Highest budget" },
  { value: "budget_low", label: "Lowest budget" },
  { value: "schedule", label: "Scheduled soonest" },
];

const PAGE_SIZE = 12;

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const NAVY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const GHOST_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface-white px-5 py-3 text-sm font-bold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function formatMoney(amount, currency = "NGN") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Not specified";

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-NG")}`;
  }
}

function formatDate(value, options = {}) {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

function formatRelative(value) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value, { year: undefined });
}

const formatCategory = (category) =>
  CATEGORIES.find((item) => item.value === category)?.label || "Other";

const getErrorMessage = (error) =>
  error?.message || "We couldn't load available errands. Please try again.";

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="space-y-4 rounded-3xl border border-line bg-surface-white p-5"
    >
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-4 w-14 animate-pulse rounded-full bg-surface-muted" />
      </div>
      <div className="h-5 w-4/5 animate-pulse rounded-full bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-surface-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-muted" />
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-10 animate-pulse rounded-full bg-surface-muted" />
    </div>
  );
}

function Notice({ tone = "danger", icon: Icon = AlertCircle, children }) {
  const styles =
    tone === "danger"
      ? "border-rose-500 bg-rose-50 text-rose-900"
      : "border-brand-green bg-brand-pale text-success-dark";

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-r-2xl border-l-4 p-4 text-sm leading-6 ${styles}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function EmptyState({ onReset, hasFilters }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface-white px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
        <ClipboardList size={26} aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-base font-extrabold text-content">
        {hasFilters ? "No matching errands" : "No errands available yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
        {hasFilters
          ? "Try a different search, category or sort order to see more opportunities."
          : "New customer requests will appear here as soon as they're posted. Check back soon."}
      </p>

      {hasFilters ? (
        <button type="button" onClick={onReset} className={`${NAVY_BUTTON} mt-5`}>
          Clear filters
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function ErrandCard({ errand, onView }) {
  const itemCount = Array.isArray(errand.items) ? errand.items.length : 0;
  const offerCount = Number(errand.offer_count || 0);

  return (
    <li className="min-w-0">
      <article className="group flex h-full flex-col rounded-3xl border border-line bg-surface-white p-5 transition hover:border-line-strong hover:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-brand-pale px-3 py-1 text-[11px] font-bold text-success-dark">
            <Tag size={11} aria-hidden="true" />
            <span className="truncate">{formatCategory(errand.category)}</span>
          </span>

          <span className="shrink-0 text-[11px] font-semibold text-content-subtle">
            {formatRelative(errand.created_at)}
          </span>
        </div>

        <h2 className="mt-3 line-clamp-2 break-words text-base font-extrabold leading-6 tracking-tight text-content">
          {errand.title || "Untitled errand"}
        </h2>

        <p className="mt-0.5 truncate text-[11px] font-semibold tracking-wide text-content-subtle">
          {errand.reference_code || "Errand request"}
        </p>

        <p className="mt-3 line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-content-muted">
          {errand.description || "No additional description provided."}
        </p>

        <div className="mt-4 rounded-2xl bg-surface-muted/60 px-4 py-3">
          <p className="text-[11px] font-semibold text-content-muted">
            Customer's estimated budget
          </p>
          <p className="mt-0.5 break-words text-xl font-extrabold tracking-tight tabular-nums text-content">
            {formatMoney(errand.estimated_total, errand.currency_code)}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-content-subtle">
              <CalendarClock size={12} aria-hidden="true" />
              Schedule
            </dt>
            <dd className="mt-0.5 truncate font-bold text-content">
              {errand.scheduled_for
                ? formatDate(errand.scheduled_for, { year: undefined })
                : "Flexible"}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-content-subtle">
              <Package size={12} aria-hidden="true" />
              Items
            </dt>
            <dd className="mt-0.5 truncate font-bold text-content">{itemCount}</dd>
          </div>

          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-content-subtle">
              <Users size={12} aria-hidden="true" />
              Offers
            </dt>
            <dd className="mt-0.5 truncate font-bold text-content">{offerCount}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onView(errand)}
          className={`${NAVY_BUTTON} mt-5 w-full`}
        >
          View errand
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </article>
    </li>
  );
}

function InfoTile({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-muted/60 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-content-muted">
        <Icon size={13} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm font-bold text-content">{children}</p>
    </div>
  );
}

function ErrandDetailsModal({ errand, onClose, onPrepareOffer }) {
  const items = Array.isArray(errand?.items) ? errand.items : [];
  const offerCount = Number(errand?.offer_count || 0);

  return (
    <Modal
      isOpen={Boolean(errand)}
      onClose={onClose}
      icon={ClipboardList}
      title={errand?.title || "Untitled errand"}
      subtitle={errand ? formatCategory(errand.category) : ""}
      description={errand?.reference_code || ""}
      size="lg"
      position="bottom"
      sizeStorageKey="user.availableErrand"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={GHOST_BUTTON}>
            Close
          </button>
          <button
            type="button"
            onClick={() => errand && onPrepareOffer(errand)}
            className={PRIMARY_BUTTON}
          >
            Prepare an offer
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      }
    >
      {errand ? (
        <div className="space-y-6 pb-1">
          <div className="rounded-3xl border border-l-4 border-line border-l-success bg-surface-white p-5">
            <p className="text-xs font-semibold text-content-muted">
              Customer's estimated budget
            </p>
            <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content sm:text-4xl">
              {formatMoney(errand.estimated_total, errand.currency_code)}
            </p>
            <p className="mt-2 text-xs leading-5 text-content-muted">
              This is an estimate, not a confirmed offer. Your fees and the final
              agreed amount may differ.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile icon={CalendarClock} label="Schedule">
              {errand.scheduled_for
                ? formatDate(errand.scheduled_for, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Flexible"}
            </InfoTile>

            <InfoTile icon={Clock3} label="Offer deadline">
              {errand.expires_at
                ? formatDate(errand.expires_at, { hour: "numeric", minute: "2-digit" })
                : "Not specified"}
            </InfoTile>

            <InfoTile icon={Users} label="Offers so far">
              {offerCount} {offerCount === 1 ? "offer" : "offers"}
            </InfoTile>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-content">Description</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-content-muted">
              {errand.description || "The customer did not provide a description."}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-content">
              Requested items
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-content-muted">
                {items.length}
              </span>
            </h3>

            {items.length === 0 ? (
              <p className="rounded-2xl bg-surface-muted/60 p-4 text-sm leading-6 text-content-muted">
                No itemized list was provided. Read the description carefully
                before preparing an offer.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li
                    key={item.id || `${item.item_name}-${index}`}
                    className="rounded-2xl border border-line p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-content">
                          {item.item_name || `Item ${index + 1}`}
                        </p>

                        {item.description ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-content-muted">
                            {item.description}
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs text-content-muted">
                          Quantity{" "}
                          <b className="text-content">
                            {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </b>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-content-subtle">Est. unit price</p>
                        <p className="mt-0.5 text-sm font-extrabold tabular-nums text-content">
                          {formatMoney(item.estimated_unit_price, errand.currency_code)}
                        </p>
                        {item.pricing_type ? (
                          <p className="mt-0.5 text-[11px] capitalize text-content-subtle">
                            {String(item.pricing_type).replaceAll("_", " ")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {item.customer_notes ? (
                      <div className="mt-3 rounded-xl bg-surface-muted/60 p-3">
                        <p className="text-[11px] font-bold text-content-muted">
                          Customer's notes
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-content">
                          {item.customer_notes}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Notice tone="success" icon={CheckCircle2}>
            <p className="text-sm font-extrabold text-brand">Before you submit an offer</p>
            <p className="mt-1 text-xs leading-5">
              Review the scope, item prices and schedule, and include every fee in
              your proposal. The customer's estimate isn't permission to spend more
              than they approve.
            </p>
          </Notice>
        </div>
      ) : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function AvailableErrandsPage() {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [errands, setErrands] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedErrand, setSelectedErrand] = useState(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadErrands = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
        });

        if (search) params.set("search", search);
        if (category) params.set("category", category);

        const response = await apiRequest(`/erands/available?${params.toString()}`);
        const data = response?.data;

        if (!data || !Array.isArray(data.errands)) {
          throw new Error("The server returned an unexpected available-errands response.");
        }

        setErrands(data.errands);
        setPagination(
          data.pagination || {
            page,
            limit: PAGE_SIZE,
            total: data.errands.length,
            totalPages: data.errands.length ? 1 : 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        );
      } catch (loadError) {
        const message = getErrorMessage(loadError);
        setError(message);
        if (silent) toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, sort, search, category]
  );

  useEffect(() => {
    loadErrands();
  }, [loadErrands]);

  const hasFilters = Boolean(search || category || sort !== "newest");

  const totalLabel = useMemo(() => {
    const total = Number(pagination.total || 0);
    return `${total.toLocaleString("en-NG")} ${total === 1 ? "errand" : "errands"} found`;
  }, [pagination.total]);

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setSort("newest");
    setPage(1);
  }

  function handlePrepareOffer(errand) {
    setSelectedErrand(null);
    navigate(`/dashboard/available-errands/${errand.id}/offer`, {
      state: { errand },
    });
  }

  return (
    <DashboardLayout
      title="Available errands"
      description="Discover customer requests that match your skills and availability."
    >
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
              Opportunities for eranders
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
              Find your next errand
            </h1>
            <p className="mt-1 max-w-xl text-sm text-content-muted">
              Explore requests, understand what's needed and send a clear offer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadErrands({ silent: true })}
            disabled={loading || refreshing}
            aria-label="Refresh errands"
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-line bg-surface-white px-4 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 sm:self-auto"
          >
            {refreshing ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {/* Search + filters */}
        <section
          aria-label="Search and filters"
          className="space-y-4 rounded-3xl border border-line bg-surface-white p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
                setPage(1);
              }}
              className="relative min-w-0 flex-1"
            >
              <label htmlFor="errand-search" className="sr-only">
                Search available errands
              </label>

              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-subtle"
              />

              <input
                id="errand-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search errands or reference codes"
                className="h-12 w-full rounded-full border border-line bg-surface-white pl-11 pr-10 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
              />

              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </form>

            <div className="w-full lg:w-60">
              <Select
                value={sort}
                onChange={(value) => {
                  setSort(value || "newest");
                  setPage(1);
                }}
                options={SORT_OPTIONS}
                ariaLabel="Sort available errands"
                searchable={false}
                clearable={false}
              />
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter by category"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CATEGORIES.map((item) => {
              const active = item.value === category;

              return (
                <button
                  key={item.value || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCategory(item.value);
                    setPage(1);
                  }}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active
                      ? "bg-brand text-content-inverse"
                      : "bg-surface-muted text-content-muted hover:text-content"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
            <p className="text-xs font-semibold text-content-muted" aria-live="polite">
              {loading ? "Finding available errands…" : totalLabel}
            </p>

            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand underline underline-offset-2"
              >
                Clear filters
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>

        {/* Results */}
        <section aria-label="Available errands">
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <span className="sr-only">Loading errands</span>
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center rounded-3xl border border-line bg-surface-white px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <AlertCircle size={26} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-content">
                We couldn't load errands
              </h3>
              <p className="mt-1 max-w-md break-words text-sm leading-6 text-content-muted">
                {error}
              </p>
              <button
                type="button"
                onClick={() => loadErrands()}
                className={`${NAVY_BUTTON} mt-5`}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : errands.length === 0 ? (
            <EmptyState onReset={resetFilters} hasFilters={hasFilters} />
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {errands.map((errand) => (
                  <ErrandCard
                    key={errand.id}
                    errand={errand}
                    onView={setSelectedErrand}
                  />
                ))}
              </ul>

              {pagination.totalPages > 1 ? (
                <nav
                  aria-label="Available errands pagination"
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface-white p-4"
                >
                  <p className="text-xs font-semibold tabular-nums text-content-muted">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={!pagination.hasPreviousPage || loading}
                      className={`${GHOST_BUTTON} !px-4 !py-2.5`}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={!pagination.hasNextPage || loading}
                      className={`${NAVY_BUTTON} !px-4 !py-2.5`}
                    >
                      Next
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </nav>
              ) : null}
            </>
          )}
        </section>

        {/* Tip */}
        <Notice tone="success" icon={Wallet}>
          <p className="text-sm font-extrabold text-brand">Make every offer clear</p>
          <p className="mt-0.5 text-xs leading-5">
            Consider the task, item costs, transport and service fees before
            proposing a price. A transparent total helps the customer decide.
          </p>
        </Notice>
      </div>

      <ErrandDetailsModal
        errand={selectedErrand}
        onClose={() => setSelectedErrand(null)}
        onPrepareOffer={handlePrepareOffer}
      />
    </DashboardLayout>
  );
}