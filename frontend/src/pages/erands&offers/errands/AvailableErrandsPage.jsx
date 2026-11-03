import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
ArrowDownWideNarrow,
ArrowLeft,
ArrowRight,
CalendarClock,
CheckCircle2,
Clock3,
Eye,
Filter,
Package,
RefreshCw,
Search,
Tag,
X,
MapPin,
ClipboardList,
Wallet,
AlertCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest } from "@/services/api";

const CATEGORIES = [
{ value: "", label: "All categories" },
{ value: "shopping", label: "Shopping" },
{ value: "delivery", label: "Delivery" },
{ value: "pickup", label: "Pickup" },
{ value: "home_help", label: "Home help" },
{ value: "personal_assistance", label: "Personal assistance" },
{ value: "business_support", label: "Business support" },
{ value: "other", label: "Other errands" },
];

const SORT_OPTIONS = [
{ value: "newest", label: "Newest first" },
{ value: "oldest", label: "Oldest first" },
{ value: "budget_high", label: "Highest budget" },
{ value: "budget_low", label: "Lowest budget" },
{ value: "schedule", label: "Scheduled soonest" },
];

const PAGE_SIZE = 12;

function formatMoney(amount, currency = "NGN") {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "Budget not specified";
  }

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

if (Number.isNaN(date.getTime())) {
return "Not specified";
}

return new Intl.DateTimeFormat("en-NG", {
day: "numeric",
month: "short",
year: "numeric",
...options,
}).format(date);
}

function formatCategory(category) {
return (
CATEGORIES.find((item) => item.value === category)?.label ||
"Other errands"
);
}

function getErrorMessage(error) {
return (
error?.message ||
"We couldn't load available errands. Please try again."
);
}

function SkeletonCard() {
return (
<article
aria-hidden="true"
className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
>
<div className="flex items-start justify-between gap-4">
<div className="flex-1 space-y-3">
<div className="h-3 w-24 rounded bg-slate-200" />
<div className="h-5 w-4/5 rounded bg-slate-200" />
<div className="h-3 w-2/3 rounded bg-slate-100" />
</div>

    <div className="h-11 w-11 rounded-xl bg-slate-100" />
  </div>

  <div className="mt-5 space-y-2">
    <div className="h-3 w-full rounded bg-slate-100" />
    <div className="h-3 w-5/6 rounded bg-slate-100" />
  </div>

  <div className="mt-6 flex items-center justify-between gap-3">
    <div className="h-6 w-28 rounded bg-slate-200" />
    <div className="h-9 w-24 rounded-lg bg-slate-100" />
  </div>

  <div className="mt-5 border-t border-slate-100 pt-4">
    <div className="h-3 w-40 rounded bg-slate-100" />
  </div>
</article>

);
}

function EmptyState({ onReset, hasFilters }) {
return (
<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center sm:px-10">
<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E9FBF3] text-[#16864B]">
<ClipboardList size={29} />
</div>

  <h3 className="mt-5 text-lg font-extrabold text-[#14213D]">
    {hasFilters ? "No matching errands" : "No errands available yet"}
  </h3>

  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
    {hasFilters
      ? "Try changing your search, category or sorting options to find more opportunities."
      : "New customer requests will appear here when they become available. Check back soon."}
  </p>

  {hasFilters && (
    <button
      type="button"
      onClick={onReset}
      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#203658]"
    >
      Clear filters
      <X size={16} />
    </button>
  )}
</div>

);
}

function ErrandCard({ errand, onView }) {
const itemCount = Array.isArray(errand.items) ? errand.items.length : 0;
const offerCount = Number(errand.offer_count || 0);

return (
<article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70 transition duration-200 hover:-translate-y-0.5 hover:border-[#B7E8CE] hover:shadow-md sm:p-6">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0 flex-1">
<span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1.5 text-xs font-bold text-[#16864B]">
<Tag size={13} />
<span className="truncate">
{formatCategory(errand.category)}
</span>
</span>

      <h2 className="mt-4 break-words text-lg font-extrabold leading-7 text-[#14213D] transition group-hover:text-[#16864B]">
        {errand.title || "Untitled errand"}
      </h2>

      <p className="mt-1 text-xs font-semibold tracking-wide text-slate-400">
        {errand.reference_code || "Errand request"}
      </p>
    </div>

    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#14213D] ring-1 ring-slate-100">
      <Package size={21} />
    </div>
  </div>

  <p className="mt-4 line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-slate-500">
    {errand.description || "No additional description provided."}
  </p>

  <div className="mt-5 rounded-xl bg-slate-50 p-4">
    <p className="text-xs font-semibold text-slate-500">
      Customer's estimated budget
    </p>

    <p className="mt-1 break-words text-xl font-extrabold text-[#14213D]">
      {formatMoney(errand.estimated_total, errand.currency_code)}
    </p>

    <p className="mt-1 text-xs leading-5 text-slate-400">
      This is the customer's estimate, not a confirmed offer amount.
    </p>
  </div>

  <div className="mt-5 grid grid-cols-2 gap-3">
    <div className="flex min-w-0 items-start gap-2">
      <CalendarClock
        size={16}
        className="mt-0.5 shrink-0 text-slate-400"
      />

      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">
          Schedule
        </p>
        <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">
          {errand.scheduled_for
            ? formatDate(errand.scheduled_for, {
                hour: "numeric",
                minute: "2-digit",
              })
            : "Flexible"}
        </p>
      </div>
    </div>

    <div className="flex min-w-0 items-start gap-2">
      <ClipboardList
        size={16}
        className="mt-0.5 shrink-0 text-slate-400"
      />

      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">
          Requested items
        </p>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </div>
    </div>
  </div>

  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
      <Clock3 size={14} />
      Posted {formatDate(errand.created_at)}
    </span>

    <span className="text-xs font-semibold text-slate-500">
      {offerCount} {offerCount === 1 ? "offer" : "offers"}
    </span>
  </div>

  <button
    type="button"
    onClick={() => onView(errand)}
    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#203658] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35D07F]"
  >
    View errand
    <ArrowRight size={16} />
  </button>
</article>

);
}

function ErrandDetailsModal({ errand, onClose, onPrepareOffer }) {
useEffect(() => {
if (!errand) return undefined;

function handleKeyDown(event) {
  if (event.key === "Escape") {
    onClose();
  }
}

document.addEventListener("keydown", handleKeyDown);
document.body.style.overflow = "hidden";

return () => {
  document.removeEventListener("keydown", handleKeyDown);
  document.body.style.overflow = "";
};

}, [errand, onClose]);

if (!errand) return null;

const items = Array.isArray(errand.items) ? errand.items : [];

return (
<div
className="fixed inset-0 z-[100] flex items-end justify-center bg-[#091426]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
role="presentation"
onMouseDown={(event) => {
if (event.target === event.currentTarget) onClose();
}}
>
<section
role="dialog"
aria-modal="true"
aria-labelledby="available-errand-modal-title"
className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
>
<header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
<div className="min-w-0">
<span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1.5 text-xs font-bold text-[#16864B]">
<Tag size={13} />
{formatCategory(errand.category)}
</span>

        <h2
          id="available-errand-modal-title"
          className="mt-3 break-words text-xl font-extrabold text-[#14213D] sm:text-2xl"
        >
          {errand.title || "Untitled errand"}
        </h2>

        <p className="mt-1 text-xs font-semibold text-slate-400">
          {errand.reference_code}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close errand details"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#14213D]"
      >
        <X size={19} />
      </button>
    </header>

    <div className="space-y-6 px-5 py-6 sm:px-7">
      <div className="rounded-2xl bg-[#14213D] p-5 text-white">
        <p className="text-xs font-semibold text-slate-300">
          Customer's estimated budget
        </p>

        <p className="mt-2 break-words text-2xl font-extrabold sm:text-3xl">
          {formatMoney(errand.estimated_total, errand.currency_code)}
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-300">
          Your proposed fees and the final agreed amount may differ.
          Review the requirements before preparing an offer.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-extrabold text-[#14213D]">
          Errand description
        </h3>

        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
          {errand.description || "The customer did not provide a description."}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <CalendarClock size={16} />
            <span className="text-xs font-semibold">Schedule</span>
          </div>

          <p className="mt-2 text-sm font-bold text-[#14213D]">
            {errand.scheduled_for
              ? formatDate(errand.scheduled_for, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Flexible schedule"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock3 size={16} />
            <span className="text-xs font-semibold">Offer deadline</span>
          </div>

          <p className="mt-2 text-sm font-bold text-[#14213D]">
            {errand.expires_at
              ? formatDate(errand.expires_at, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Not specified"}
          </p>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#14213D]">
            Requested items
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-500">
            No itemized shopping list was provided for this errand.
            Review the description carefully before preparing an offer.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {items.map((item, index) => (
              <article
                key={item.id || `${item.item_name}-${index}`}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-[#14213D]">
                      {item.item_name || `Item ${index + 1}`}
                    </p>

                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                        {item.description}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Quantity: {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-slate-400">
                      Estimated unit price
                    </p>

                    <p className="mt-1 text-sm font-extrabold text-[#14213D]">
                      {formatMoney(
                        item.estimated_unit_price,
                        errand.currency_code
                      )}
                    </p>

                    {item.pricing_type && (
                      <p className="mt-1 text-xs capitalize text-slate-400">
                        {item.pricing_type}
                      </p>
                    )}
                  </div>
                </div>

                {item.customer_notes && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      Customer's notes
                    </p>

                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                      {item.customer_notes}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#B7E8CE] bg-[#F3FCF7] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0 text-[#16864B]"
          />

          <div>
            <h3 className="text-sm font-extrabold text-[#14213D]">
              Before submitting an offer
            </h3>

            <p className="mt-1 text-xs leading-6 text-slate-600">
              Review the scope, item prices and schedule. Include all
              applicable fees in your proposal. Do not assume the
              customer's estimated budget is permission to spend more
              than the amount they approve.
            </p>
          </div>
        </div>
      </section>
    </div>

    <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
      >
        Close
      </button>

      <button
        type="button"
        onClick={() => onPrepareOffer(errand)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#35D07F] px-5 py-3 text-sm font-extrabold text-[#14213D] transition hover:bg-[#63E69D]"
      >
        Prepare an offer
        <ArrowRight size={16} />
      </button>
    </footer>
  </section>
</div>

);
}

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
if (silent) {
setRefreshing(true);
} else {
setLoading(true);
}

  setError("");

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort,
    });

    if (search) params.set("search", search);
    if (category) params.set("category", category);

    const response = await apiRequest(
      `/erands/available?${params.toString()}`
    );

    const data = response?.data;

    if (!data || !Array.isArray(data.errands)) {
      throw new Error(
        "The server returned an unexpected available-errands response."
      );
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

    if (silent) {
      toast.error(message);
    }
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

return `${total.toLocaleString("en-NG")} ${
  total === 1 ? "errand" : "errands"
} found`;

}, [pagination.total]);

function resetFilters() {
setSearchInput("");
setSearch("");
setCategory("");
setSort("newest");
setPage(1);
}

function handleCategoryChange(event) {
setCategory(event.target.value);
setPage(1);
}

function handleSortChange(event) {
setSort(event.target.value);
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
<section className="relative overflow-hidden rounded-3xl bg-[#14213D] p-6 text-white sm:p-9 lg:p-10">
<div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/[0.04]" />
<div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-[#20CC88]/10 blur-2xl" />

    <div className="relative z-10 max-w-2xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#8CF0B5]">
        <CheckCircle2 size={14} />
        Opportunities for eranders
      </span>

      <h2 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
        Find your next errand.
      </h2>

      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
        Explore customer requests, understand what's needed and
        prepare a clear offer that reflects the work involved.
      </p>
    </div>
  </section>

  <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-extrabold text-[#14213D]">
          Discover errands
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Search requests and find work that suits you.
        </p>
      </div>

      <button
        type="button"
        onClick={() => loadErrands({ silent: true })}
        disabled={loading || refreshing}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:border-[#B7E8CE] hover:bg-[#F3FCF7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          size={15}
          className={refreshing ? "animate-spin" : ""}
        />
        Refresh
      </button>
    </div>

    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
          setPage(1);
        }}
        className="relative"
      >
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search errands or reference codes"
          aria-label="Search available errands"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-[#14213D] outline-none transition placeholder:text-slate-400 focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10"
        />
      </form>

      <div className="relative">
        <Filter
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <select
          value={category}
          onChange={handleCategoryChange}
          aria-label="Filter by category"
          className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-600 outline-none transition focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10"
        >
          {CATEGORIES.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <ArrowDownWideNarrow
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <select
          value={sort}
          onChange={handleSortChange}
          aria-label="Sort available errands"
          className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-600 outline-none transition focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10"
        >
          {SORT_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-500">
        {loading ? "Finding available errands…" : totalLabel}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16864B] transition hover:text-[#14213D]"
        >
          Clear filters
          <X size={14} />
        </button>
      )}
    </div>
  </section>

  <section className="mt-8">
    {loading ? (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    ) : error ? (
      <div className="rounded-2xl border border-red-200 bg-white px-5 py-12 text-center sm:px-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle size={25} />
        </div>

        <h3 className="mt-4 text-lg font-extrabold text-[#14213D]">
          We couldn't load errands
        </h3>

        <p className="mx-auto mt-2 max-w-md break-words text-sm leading-6 text-slate-500">
          {error}
        </p>

        <button
          type="button"
          onClick={() => loadErrands()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#203658]"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    ) : errands.length === 0 ? (
      <EmptyState
        onReset={resetFilters}
        hasFilters={hasFilters}
      />
    ) : (
      <>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {errands.map((errand) => (
            <ErrandCard
              key={errand.id}
              errand={errand}
              onView={setSelectedErrand}
            />
          ))}
        </div>

        {pagination.totalPages > 1 && (
          <nav
            aria-label="Available errands pagination"
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-semibold text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                disabled={!pagination.hasPreviousPage || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={15} />
                Previous
              </button>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => current + 1)
                }
                disabled={!pagination.hasNextPage || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#203658] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight size={15} />
              </button>
            </div>
          </nav>
        )}
      </>
    )}
  </section>

  <section className="mt-8 rounded-2xl border border-[#B7E8CE] bg-[#F3FCF7] p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#16864B] shadow-sm">
        <Wallet size={20} />
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-[#14213D]">
          Make every offer clear
        </h2>

        <p className="mt-1 text-xs leading-6 text-slate-600 sm:text-sm">
          Consider the task, item costs, transportation and service
          fees before proposing a price. Keep the total transparent
          so the customer can make an informed decision.
        </p>
      </div>
    </div>
  </section>

  <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
    ERANDER · Get things done.
  </footer>

  <ErrandDetailsModal
    errand={selectedErrand}
    onClose={() => setSelectedErrand(null)}
    onPrepareOffer={handlePrepareOffer}
  />
</DashboardLayout>

);
}