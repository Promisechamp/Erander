import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  HandCoins,
  Info,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Truck,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";

import {
  getMyErandOffers,
  withdrawErandOffer,
} from "@/services/offers/offersApi";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "all", label: "All offers" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_STYLES = {
  pending: {
    label: "Awaiting response",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  accepted: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Not selected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: ArrowDownRight,
  },
  expired: {
    label: "Expired",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Clock3,
  },
  superseded: {
    label: "Superseded",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: ArrowUpRight,
  },
};

const ERRAND_STATUS_STYLES = {
  awaiting_funding: {
    label: "Awaiting funding",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  funded: {
    label: "Funded",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Wallet,
  },
  in_progress: {
    label: "In progress",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Truck,
  },
  completion_submitted: {
    label: "Completion review",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: FileText,
  },
  completed: {
    label: "Completed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  disputed: {
    label: "Disputed",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: ShieldCheck,
  },
  cancelled: {
    label: "Cancelled",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Clock3,
  },
};

const CATEGORY_LABELS = {
  shopping: "Shopping",
  delivery: "Delivery",
  pickup: "Pickup",
  home_help: "Home help",
  personal_assistance: "Personal assistance",
  business_support: "Business support",
  other: "Other errands",
  groceries: "Shopping & groceries",
  documents: "Documents & office",
  gifts: "Gifts & special requests",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value, currency = "NGN") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function normalizeStatus(status) {
  return String(status || "").toLowerCase().trim();
}

function getOfferStatus(status) {
  const normalized = normalizeStatus(status) || "pending";

  return (
    STATUS_STYLES[normalized] || {
      label: normalized
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      className: "border-slate-200 bg-slate-100 text-slate-600",
      icon: Info,
    }
  );
}

function getErrandFromOffer(offer) {
  return (
    offer?.errand ||
    offer?.erand ||
    offer?.errands ||
    offer?.erands ||
    offer?.request ||
    offer?.errand_request ||
    offer?.erand_request ||
    {}
  );
}

function getOfferId(offer) {
  const candidates = [
    offer?.id,
    offer?.offer_id,
    offer?.offerId,
  ];

  return (
    candidates.find(
      (value) =>
        typeof value === "string" && value.trim().length > 0
    ) || ""
  );
}

function getErrandId(offer) {
  const errand = getErrandFromOffer(offer);

  const candidates = [
    offer?.erand_id,
    offer?.errand_id,
    offer?.request_id,
    offer?.errandId,
    offer?.erandId,
    errand?.id,
    errand?.erand_id,
    errand?.errand_id,
    errand?.request_id,
    errand?.errandId,
    errand?.erandId,
  ];

  return (
    candidates.find(
      (value) =>
        typeof value === "string" && value.trim().length > 0
    ) || ""
  );
}

function getErrandTitle(offer) {
  const errand = getErrandFromOffer(offer);

  return (
    errand?.title ||
    offer?.errand_title ||
    offer?.erand_title ||
    offer?.request_title ||
    "Untitled errand"
  );
}

function getErrandReference(offer) {
  const errand = getErrandFromOffer(offer);

  return (
    errand?.reference_code ||
    offer?.reference_code ||
    offer?.errand_reference ||
    offer?.erand_reference ||
    ""
  );
}

function getCurrency(offer) {
  const errand = getErrandFromOffer(offer);

  return (
    offer?.currency_code ||
    offer?.currency ||
    errand?.currency_code ||
    errand?.currency ||
    "NGN"
  );
}

function getAmount(offer, field) {
  const value = offer?.[field];

  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function getItemCount(offer) {
  const items =
    offer?.items ||
    offer?.offer_items ||
    offer?.erand_offer_items ||
    [];

  return Array.isArray(items) ? items.length : 0;
}

function getCreatedAt(offer) {
  return offer?.created_at || offer?.submitted_at || null;
}

function getOfferMessage(offer) {
  return offer?.offer_message || offer?.message || "";
}

/**
 * Determines whether the customer has soft-deleted the errand.
 *
 * Deletion is independent of the offer's lifecycle status.
 * A pending offer remains pending in history, but it can no
 * longer be accepted after the customer removes the errand.
 */
function isErrandDeleted(offer) {
  const errand = getErrandFromOffer(offer);

  return Boolean(
    errand?.deleted_at ||
      errand?.deletedAt ||
      errand?.is_deleted === true ||
      errand?.isDeleted === true ||
      offer?.errand_deleted_at ||
      offer?.erand_deleted_at ||
      offer?.is_errand_deleted === true ||
      offer?.is_erand_deleted === true
  );
}

/**
 * Reads the actual lifecycle status supplied by the API.
 * An accepted offer alone does not establish that the errand is funded.
 */
function getErrandLifecycleStatus(offer) {
  const errand = getErrandFromOffer(offer);

  const status = normalizeStatus(
    errand?.status ||
      offer?.errand_status ||
      offer?.erand_status ||
      offer?.request_status
  );

  if (ERRAND_STATUS_STYLES[status]) {
    return status;
  }

  const fundingStatus = normalizeStatus(
    errand?.funding_status ||
      errand?.fundingStatus ||
      offer?.funding_status ||
      offer?.fundingStatus
  );

  if (["funded", "fully_funded"].includes(fundingStatus)) {
    return "funded";
  }

  if (
    ["awaiting_funding", "unfunded", "not_funded"].includes(
      fundingStatus
    )
  ) {
    return "awaiting_funding";
  }

  return "";
}

function normalizeOffersResponse(result) {
  const data = result?.data ?? result ?? {};

  let offers = [];

  if (Array.isArray(data)) {
    offers = data;
  } else if (Array.isArray(data.offers)) {
    offers = data.offers;
  } else if (Array.isArray(data.myOffers)) {
    offers = data.myOffers;
  } else if (Array.isArray(data.results)) {
    offers = data.results;
  } else if (Array.isArray(data.items)) {
    offers = data.items;
  }

  const pagination = data.pagination || {};
  const total = Number(pagination.total);
  const totalPages = Number(pagination.totalPages);

  return {
    offers,
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || PAGE_SIZE,
      total:
        Number.isFinite(total) && total >= 0
          ? total
          : offers.length,
      totalPages:
        Number.isFinite(totalPages) && totalPages >= 0
          ? totalPages
          : 1,
      hasNextPage:
        typeof pagination.hasNextPage === "boolean"
          ? pagination.hasNextPage
          : false,
      hasPreviousPage:
        typeof pagination.hasPreviousPage === "boolean"
          ? pagination.hasPreviousPage
          : false,
    },
  };
}

function canWithdraw(offer) {
  return normalizeStatus(offer?.status) === "pending";
}

function OfferSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-5 w-3/4 max-w-sm rounded bg-slate-200" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>

        <div className="h-7 w-28 shrink-0 rounded-full bg-slate-100" />
      </div>

      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-xl bg-slate-50 p-3"
          >
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="h-4 w-24 max-w-full rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-3 w-36 rounded bg-slate-100" />
        <div className="h-10 w-full rounded-xl bg-slate-100 sm:w-36" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }) {
  const tones = {
    navy: "bg-[#14213d] text-white",
    green: "bg-[#e9fbf3] text-[#15803d]",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,33,61,0.04)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        <span
          className={cn(
            "rounded-xl p-2.5",
            tones[tone] || tones.slate
          )}
        >
          <Icon size={19} />
        </span>
      </div>

      <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#14213d]">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = getOfferStatus(status);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        config.className
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

function ErrandStatusBadge({ status }) {
  const config = ERRAND_STATUS_STYLES[status];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        config.className
      )}
      title="Current errand status"
    >
      <Icon size={14} className="shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

function RemovedErrandBadge() {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
      <XCircle size={14} className="shrink-0" />
      <span>Errand removed</span>
    </span>
  );
}

function RemovedErrandNotice({ offerStatus }) {
  const pending = normalizeStatus(offerStatus) === "pending";

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
      <Info size={19} className="mt-0.5 shrink-0 text-rose-700" />

      <div>
        <p className="text-sm font-extrabold text-rose-800">
          The customer removed this errand
        </p>

        <p className="mt-1 text-xs leading-5 text-rose-700">
          {pending
            ? "This offer has been preserved in your history, but the customer can no longer accept it. You may withdraw your pending offer if you no longer want it listed."
            : "This errand has been removed from the customer's active errands. Your offer record and its history have been preserved."}
        </p>
      </div>
    </div>
  );
}

function OfferAmount({
  label,
  value,
  currency,
  emphasis = false,
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl p-3",
        emphasis ? "bg-[#e9fbf3]" : "bg-slate-50"
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p
        className={cn(
          "mt-1 break-words text-sm font-extrabold",
          emphasis ? "text-[#15803d]" : "text-[#14213d]"
        )}
      >
        {formatMoney(value, currency)}
      </p>
    </div>
  );
}

function ConfirmationModal({
  open,
  offer,
  busy,
  onClose,
  onConfirm,
}) {
  if (!open || !offer) return null;

  const title = getErrandTitle(offer);
  const errandDeleted = isErrandDeleted(offer);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#091426]/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-offer-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <span className="inline-flex rounded-xl bg-rose-50 p-3 text-rose-600">
              <XCircle size={22} />
            </span>

            <h2
              id="withdraw-offer-title"
              className="mt-4 text-xl font-extrabold text-[#14213d]"
            >
              Withdraw this offer?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              You are about to withdraw your offer for{" "}
              <span className="font-bold text-[#14213d]">
                {title}
              </span>
              . The offer will remain in your history with its status
              marked as withdrawn.
            </p>

            {errandDeleted && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                The customer has already removed this errand. Your
                pending offer can no longer be accepted.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close confirmation"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-3 bg-slate-50 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Keep offer
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Withdrawing...
              </>
            ) : (
              <>
                <XCircle size={17} />
                Withdraw offer
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  search,
  status,
  onReset,
  onBrowse,
}) {
  const filtered = Boolean(search || status !== "all");

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:px-10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9fbf3] text-[#15803d]">
        <Send size={28} />
      </span>

      <h3 className="mt-5 text-xl font-extrabold text-[#14213d]">
        {filtered
          ? "No matching offers"
          : "Your offers will appear here"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {filtered
          ? "Try a different search term or status filter to find the offer you are looking for."
          : "When you submit an offer for an available errand, you will be able to review its price, status, and details here."}
      </p>

      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-[#14213d] transition hover:bg-slate-50"
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onBrowse}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
        >
          <Search size={17} />
          Browse available errands
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export default function MyOffersPage() {
  const navigate = useNavigate();

  const [offers, setOffers] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadOffers = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const filters = {
          page,
          limit: PAGE_SIZE,
        };

        if (search) {
          filters.search = search;
        }

        if (statusFilter !== "all") {
          filters.status = statusFilter;
        }

        const result = await getMyErandOffers(filters);
        const normalized = normalizeOffersResponse(result);

        setOffers(normalized.offers);
        setPagination(normalized.pagination);
      } catch (requestError) {
        const message =
          requestError?.message ||
          "We could not load your offers. Please try again.";

        setError(message);

        if (silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, statusFilter]
  );

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const metrics = useMemo(() => {
    const pending = offers.filter(
      (offer) => normalizeStatus(offer.status) === "pending"
    ).length;

    const accepted = offers.filter(
      (offer) => normalizeStatus(offer.status) === "accepted"
    ).length;

    const closed = offers.filter((offer) =>
      ["rejected", "withdrawn", "expired", "superseded"].includes(
        normalizeStatus(offer.status)
      )
    ).length;

    return {
      total: pagination.total,
      pending,
      accepted,
      closed,
    };
  }, [offers, pagination.total]);

  const handleWithdraw = async () => {
    if (!withdrawTarget || withdrawing) return;

    const offerId = getOfferId(withdrawTarget);

    if (!offerId) {
      toast.error("We could not identify this offer.");
      return;
    }

    setWithdrawing(true);

    try {
      await withdrawErandOffer(offerId);

      toast.success("Your offer has been withdrawn.");
      setWithdrawTarget(null);

      await loadOffers({ silent: true });
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          "We could not withdraw this offer. Please try again."
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  /**
   * Open the dedicated accepted-offer details page.
   * That route expects an OFFER ID, not an errand ID.
   */
  const goToOfferDetails = (offer) => {
    const offerId = getOfferId(offer);

    if (!offerId) {
      toast.error(
        "We could not identify this offer. Please refresh your offers and try again."
      );
      return;
    }

    navigate(`/dashboard/my-offers/${encodeURIComponent(offerId)}`);
  };

  const goToAvailableErrands = () => {
    navigate("/dashboard/available-errands");
  };

  const showEmptyState =
    !loading && !error && offers.length === 0;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-[#f8fafc]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#14213d]"
              >
                <ArrowLeft size={16} />
                Dashboard
              </button>

              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-white shadow-sm">
                  <Send size={23} />
                </span>

                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-[#14213d] sm:text-3xl">
                    My Offers
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Track your submitted offers, review your proposed
                    prices, and see when customers respond.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadOffers({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#14213d] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <section
            aria-label="Offer summary"
            className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <MetricCard
              label="Total offers"
              value={loading ? "—" : metrics.total}
              icon={FileText}
              tone="navy"
            />

            <MetricCard
              label="Awaiting response"
              value={loading ? "—" : metrics.pending}
              icon={Clock3}
              tone="amber"
            />

            <MetricCard
              label="Accepted"
              value={loading ? "—" : metrics.accepted}
              icon={CheckCircle2}
              tone="green"
            />

            <MetricCard
              label="Closed offers"
              value={loading ? "—" : metrics.closed}
              icon={XCircle}
              tone="slate"
            />
          </section>

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,33,61,0.03)] sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={18} className="text-[#15803d]" />

              <h2 className="text-sm font-extrabold text-[#14213d]">
                Find an offer
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(event.target.value)
                  }
                  placeholder="Search by errand title or reference..."
                  aria-label="Search offers"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#14213d] outline-none transition placeholder:text-slate-400 focus:border-[#20cc88] focus:ring-4 focus:ring-[#20cc88]/10"
                />
              </label>

              <label className="relative block">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter offers by status"
                  className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-[#14213d] outline-none transition focus:border-[#20cc88] focus:ring-4 focus:ring-[#20cc88]/10"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </label>
            </div>

            {(search || statusFilter !== "all") && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Showing filtered results
                </p>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-[#15803d] transition hover:text-[#166534]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#14213d]">
                Submitted offers
              </h2>

              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                {loading
                  ? "Loading your offers..."
                  : `${pagination.total} ${
                      pagination.total === 1 ? "offer" : "offers"
                    } found`}
              </p>
            </div>

            <button
              type="button"
              onClick={goToAvailableErrands}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e9fbf3] px-3.5 text-xs font-extrabold text-[#15803d] transition hover:bg-[#d9f7e9] sm:text-sm"
            >
              <Search size={15} />
              <span className="hidden sm:inline">
                Find errands
              </span>
              <span className="sm:hidden">Browse</span>
            </button>
          </div>

          {loading ? (
            <div className="space-y-4" aria-label="Loading offers">
              {Array.from({ length: 3 }).map((_, index) => (
                <OfferSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center sm:p-10">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Info size={25} />
              </span>

              <h3 className="mt-4 text-lg font-extrabold text-[#14213d]">
                We couldn't load your offers
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {error}
              </p>

              <button
                type="button"
                onClick={() => loadOffers()}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </div>
          ) : showEmptyState ? (
            <EmptyState
              search={search}
              status={statusFilter}
              onReset={handleResetFilters}
              onBrowse={goToAvailableErrands}
            />
          ) : (
            <>
              <div className="space-y-4">
                {offers.map((offer, index) => {
                  const offerId = getOfferId(offer);
                  const errandId = getErrandId(offer);
                  const title = getErrandTitle(offer);
                  const reference = getErrandReference(offer);
                  const currency = getCurrency(offer);
                  const status = normalizeStatus(offer.status);

                  const itemTotal = getAmount(
                    offer,
                    "proposed_item_total"
                  );

                  const serviceFee = getAmount(
                    offer,
                    "proposed_service_fee"
                  );

                  const deliveryFee = getAmount(
                    offer,
                    "proposed_delivery_fee"
                  );

                  const otherFees = getAmount(
                    offer,
                    "proposed_other_fees"
                  );

                  const proposedTotal = offer?.proposed_total;

                  const total =
                    proposedTotal !== undefined &&
                    proposedTotal !== null &&
                    proposedTotal !== "" &&
                    Number.isFinite(Number(proposedTotal))
                      ? Number(proposedTotal)
                      : itemTotal +
                        serviceFee +
                        deliveryFee +
                        otherFees;

                  const category =
                    getErrandFromOffer(offer)?.category ||
                    offer?.category ||
                    "";

                  const itemCount = getItemCount(offer);
                  const submittedAt = getCreatedAt(offer);
                  const message = getOfferMessage(offer);

                  const errandLifecycleStatus =
                    getErrandLifecycleStatus(offer);

                  const errandDeleted = isErrandDeleted(offer);

                  return (
                    <article
                      key={
                        offerId ||
                        `${errandId || "errand"}-${
                          submittedAt || index
                        }`
                      }
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(20,33,61,0.035)] transition hover:border-slate-300",
                        errandDeleted
                          ? "border-rose-200"
                          : "border-slate-200"
                      )}
                    >
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#14213d]">
                              {category === "delivery" ||
                              category === "pickup" ? (
                                <Truck size={21} />
                              ) : category === "business_support" ? (
                                <BriefcaseBusiness size={21} />
                              ) : (
                                <Package size={21} />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                {reference && (
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                                    {reference}
                                  </span>
                                )}

                                {category && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                    <Tag size={11} />
                                    {CATEGORY_LABELS[category] ||
                                      category.replaceAll("_", " ")}
                                  </span>
                                )}
                              </div>

                              <h3 className="break-words text-base font-extrabold leading-6 text-[#14213d] sm:text-lg">
                                {title}
                              </h3>

                              {submittedAt && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                                  <CalendarDays size={14} />
                                  Submitted{" "}
                                  {formatDate(submittedAt, true)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <StatusBadge status={status} />

                            {errandDeleted ? (
                              <RemovedErrandBadge />
                            ) : (
                              status === "accepted" &&
                              errandLifecycleStatus && (
                                <ErrandStatusBadge
                                  status={errandLifecycleStatus}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {errandDeleted && (
                          <RemovedErrandNotice
                            offerStatus={status}
                          />
                        )}

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <OfferAmount
                            label="Item budget"
                            value={itemTotal}
                            currency={currency}
                          />

                          <OfferAmount
                            label="Service fee"
                            value={serviceFee}
                            currency={currency}
                          />

                          <OfferAmount
                            label="Delivery fee"
                            value={deliveryFee}
                            currency={currency}
                          />

                          <OfferAmount
                            label="Other fees"
                            value={otherFees}
                            currency={currency}
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d9f7e9] bg-[#f5fdf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#15803d] shadow-sm">
                              <Wallet size={19} />
                            </span>

                            <div>
                              <p className="text-xs font-semibold text-slate-500">
                                Your proposed total
                              </p>

                              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[#15803d]">
                                {formatMoney(total, currency)}
                              </p>
                            </div>
                          </div>

                          {itemCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <Package size={14} />
                              {itemCount}{" "}
                              {itemCount === 1
                                ? "priced item"
                                : "priced items"}
                            </span>
                          )}
                        </div>

                        {message && (
                          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-xs font-extrabold text-slate-500">
                              Your message to the customer
                            </p>

                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                              {message}
                            </p>
                          </div>
                        )}

                        {status === "accepted" && (
                          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <ShieldCheck
                              size={20}
                              className="mt-0.5 shrink-0 text-emerald-700"
                            />

                            <div>
                              <p className="text-sm font-extrabold text-emerald-800">
                                Your offer was accepted
                              </p>

                              <p className="mt-1 text-xs leading-5 text-emerald-700">
                                {[
                                  "funded",
                                  "in_progress",
                                  "completion_submitted",
                                  "completed",
                                ].includes(errandLifecycleStatus)
                                  ? "The errand has reached the funded stage or beyond. Open the offer details to review the current stage and next steps."
                                  : errandLifecycleStatus ===
                                      "awaiting_funding"
                                    ? "The errand is awaiting funding. Do not begin work until the required funding and next steps are confirmed."
                                    : errandLifecycleStatus
                                      ? "Review the current errand status and next steps in the offer details."
                                      : "Your offer was accepted. Open the offer details to check the errand's funding status and next steps."}
                              </p>
                            </div>
                          </div>
                        )}

                        {status === "pending" && !errandDeleted && (
                          <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                            <Clock3
                              size={15}
                              className="mt-0.5 shrink-0"
                            />

                            <p>
                              Your offer is awaiting the customer's
                              response. Keep your proposed prices and
                              availability in mind while you wait.
                            </p>
                          </div>
                        )}

                        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            type="button"
                            onClick={() => goToOfferDetails(offer)}
                            disabled={!offerId}
                            title={
                              !offerId
                                ? "The API response does not contain an offer ID."
                                : "Open offer details and errand history"
                            }
                            className="inline-flex min-h-10 items-center justify-center gap-2 self-start text-sm font-bold text-[#14213d] transition hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View offer details
                            <ArrowRight size={16} />
                          </button>

                          {canWithdraw(offer) && (
                            <button
                              type="button"
                              onClick={() =>
                                setWithdrawTarget(offer)
                              }
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                            >
                              <X size={16} />
                              Withdraw offer
                            </button>
                          )}

                          {status === "accepted" && (
                            <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
                              <Check size={16} />
                              Offer accepted
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Page{" "}
                    <span className="font-bold text-[#14213d]">
                      {page}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-[#14213d]">
                      {pagination.totalPages}
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) =>
                          Math.max(1, current - 1)
                        )
                      }
                      disabled={page <= 1}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#14213d] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                    >
                      <ArrowLeft size={15} />
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) =>
                          Math.min(
                            pagination.totalPages,
                            current + 1
                          )
                        )
                      }
                      disabled={page >= pagination.totalPages}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#14213d] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                    >
                      Next
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf3] text-[#15803d]">
              <HandCoins size={19} />
            </span>

            <div>
              <h3 className="text-sm font-extrabold text-[#14213d]">
                Keep your offers transparent
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                Make sure your item prices and fees reflect what you
                intend to charge. Any agreed changes to the errand's
                scope or cost should be approved through ERANDER's
                agreed workflow. Offers remain part of your history
                even when a customer removes an errand.
              </p>
            </div>
          </div>
        </div>

        <ConfirmationModal
          open={Boolean(withdrawTarget)}
          offer={withdrawTarget}
          busy={withdrawing}
          onClose={() => {
            if (!withdrawing) {
              setWithdrawTarget(null);
            }
          }}
          onConfirm={handleWithdraw}
        />
      </div>
    </DashboardLayout>
  );
}