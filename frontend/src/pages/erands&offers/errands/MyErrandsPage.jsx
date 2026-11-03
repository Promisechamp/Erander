import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Eye,
  Flag,
  Inbox,
  Info,
  Lock,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Activity,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import ActionMenu from "@/components/ActionMenu";
import Select from "@/components/Select";
import Modal from "@/components/Modal";

import * as errandsApi from "@/services/errands/errandsApi";

/* -------------------------------------------------------
   ROUTES
------------------------------------------------------- */

const ROUTES = {
  create: "/dashboard/erands/new",
  details: (id) => `/dashboard/erands/${encodeURIComponent(id)}`,
  offers: (id) => `/dashboard/erands/${encodeURIComponent(id)}/offers`,
  edit: (id) => `/dashboard/erands/${encodeURIComponent(id)}/edit`,
  report: (id) =>
    `/dashboard/support/new?errandId=${encodeURIComponent(id)}`,
};

const PAGE_SIZE = 12;

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Awaiting funding", value: "awaiting_funding" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Disputed", value: "disputed" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "budget_high", label: "Highest budget" },
  { value: "budget_low", label: "Lowest budget" },
];

/* Tab content animation timings */
const TAB_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };
const TAB_EXIT_TRANSITION = { duration: 0.1, ease: "easeIn" };

const INDICATOR_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.6,
};

/* -------------------------------------------------------
   STATUS DATA
------------------------------------------------------- */

const FUNDED_OR_LATER = [
  "funded",
  "in_progress",
  "completion_submitted",
  "completed",
  "disputed",
];

const ENDED = ["cancelled", "canceled", "expired"];

const STATUS_META = {
  draft: { label: "Draft", icon: ClipboardList, className: "bg-slate-100 text-slate-600" },
  open: { label: "Open", icon: CircleDot, className: "bg-emerald-50 text-emerald-700" },
  offer_selected: { label: "Offer selected", icon: CheckCircle2, className: "bg-sky-50 text-sky-700" },
  assigned: { label: "Erander assigned", icon: CheckCircle2, className: "bg-sky-50 text-sky-700" },
  awaiting_funding: { label: "Awaiting funding", icon: Clock3, className: "bg-amber-50 text-amber-700" },
  funded: { label: "Funded", icon: CheckCircle2, className: "bg-blue-50 text-blue-700" },
  in_progress: { label: "In progress", icon: Activity, className: "bg-violet-50 text-violet-700" },
  completion_submitted: { label: "Awaiting review", icon: Clock3, className: "bg-orange-50 text-orange-700" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-slate-100 text-slate-600" },
  disputed: { label: "Disputed", icon: ShieldAlert, className: "bg-rose-50 text-rose-700" },
  expired: { label: "Expired", icon: Clock3, className: "bg-slate-100 text-slate-600" },
};

const CATEGORY_LABELS = {
  shopping: "Shopping",
  delivery: "Delivery",
  pickup: "Pickup",
  home_help: "Home help",
  personal_assistance: "Personal assistance",
  business_support: "Business support",
  other: "Other errands",
};

const STAGES = ["Posted", "Erander chosen", "Funded", "Underway", "Done"];

function getStageIndex(status) {
  switch (status) {
    case "completed":
      return 4;
    case "in_progress":
    case "completion_submitted":
      return 3;
    case "funded":
    case "disputed":
      return 2;
    case "offer_selected":
    case "assigned":
    case "awaiting_funding":
      return 1;
    default:
      return 0;
  }
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function formatCurrency(amount, currency = "NGN") {
  const value = Number(amount);
  if (amount === null || amount === undefined || !Number.isFinite(value)) {
    return "Not set";
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

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label: String(status || "Unknown")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      icon: CircleDot,
      className: "bg-slate-100 text-slate-600",
    }
  );
}

const getStatus = (errand) =>
  String(errand?.status || "").toLowerCase().trim();

function getErrandId(errand) {
  return errand?.id || errand?.erand_id || null;
}

function getErrandTitle(errand) {
  return errand?.title || "Untitled errand";
}

function getErrandReference(errand) {
  return errand?.reference_code || errand?.reference || "Reference pending";
}

function getErrandDate(errand) {
  return errand?.created_at || errand?.createdAt || errand?.scheduled_for || null;
}

function getErrandBudget(errand) {
  const raw = errand?.estimated_total;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getCategoryLabel(errand) {
  return (
    CATEGORY_LABELS[errand?.category] ||
    errand?.category?.replaceAll("_", " ") ||
    "General errand"
  );
}

function getOfferCount(errand) {
  if (!errand) return 0;

  const candidates = [
    errand.offers_count,
    errand.offersCount,
    errand.offer_count,
    errand.offerCount,
    errand.total_offers,
    errand.totalOffers,
    errand.proposals_count,
    errand.proposalsCount,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  if (Array.isArray(errand.offers)) return errand.offers.length;
  if (Array.isArray(errand.proposals)) return errand.proposals.length;

  return 0;
}

function shouldShowOffers(errand, offerCount) {
  if (offerCount > 0) return true;
  return getStatus(errand) === "open";
}

function hasAcceptedAgreement(errand) {
  return Boolean(
    errand?.accepted_offer_id ||
      errand?.acceptedOfferId ||
      errand?.agreement_accepted_at ||
      errand?.agreementAcceptedAt ||
      errand?.agreement_locked_at ||
      errand?.agreementLockedAt
  );
}

function isFundedErrand(errand) {
  if (!errand) return false;
  if (FUNDED_OR_LATER.includes(getStatus(errand))) return true;
  if (errand.is_funded === true || errand.isFunded === true) return true;

  const fundingStatus = String(
    errand.funding_status || errand.fundingStatus || ""
  ).toLowerCase();

  if (
    ["funded", "fully_funded", "partially_funded", "partial"].includes(
      fundingStatus
    )
  ) {
    return true;
  }

  const funded = Number(
    errand.amount_funded ?? errand.amountFunded ?? errand.funded_amount ?? 0
  );

  return Number.isFinite(funded) && funded > 0;
}

function getLockReason(errand) {
  if (!errand) return "Errand information is unavailable";
  if (ENDED.includes(getStatus(errand))) {
    return "Not available for a cancelled or expired errand";
  }
  if (hasAcceptedAgreement(errand)) {
    return "Locked after an offer is accepted";
  }
  if (isFundedErrand(errand)) {
    return "Locked once an errand is funded";
  }
  return null;
}

function normalizeErrandsResponse(response) {
  const candidates = [
    response?.data,
    response?.data?.errands,
    response?.data?.erands,
    response?.errands,
    response?.erands,
  ];
  return candidates.find(Array.isArray) || [];
}

function findApi(...names) {
  for (const name of names) {
    if (typeof errandsApi[name] === "function") {
      return errandsApi[name];
    }
  }
  return null;
}

/* -------------------------------------------------------
   SMALL UI PIECES
------------------------------------------------------- */

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function OffersChip({ count, onClick, title }) {
  const hasOffers = count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        hasOffers
          ? `View ${count} offer${count === 1 ? "" : "s"} for ${title}`
          : `View offers for ${title}`
      }
      className={`group inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
        hasOffers
          ? "bg-sky-50 text-sky-700 hover:bg-sky-100"
          : "bg-surface text-content-muted hover:bg-surface-muted hover:text-content"
      }`}
    >
      <Inbox size={13} aria-hidden="true" />
      <span>
        {hasOffers
          ? `${count} ${count === 1 ? "offer" : "offers"}`
          : "No offers yet"}
      </span>
      <ChevronRight
        size={12}
        aria-hidden="true"
        className="opacity-60 transition group-hover:opacity-100"
      />
    </button>
  );
}

function StageMeter({ status }) {
  const ended = ENDED.includes(status);
  const disputed = status === "disputed";
  const index = getStageIndex(status);

  const filledClass = ended
    ? "bg-line-strong"
    : disputed
      ? "bg-rose-400"
      : "bg-brand-green";

  const label = ended
    ? "This errand ended before completion"
    : `Stage ${index + 1} of ${STAGES.length}: ${STAGES[index]}`;

  return (
    <div role="img" aria-label={label} className="w-full max-w-[220px]">
      <div className="flex gap-1">
        {STAGES.map((stage, position) => (
          <span
            key={stage}
            className={`h-1.5 flex-1 rounded-full ${
              !ended && position <= index ? filledClass : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-medium text-content-muted">
        {ended ? "Ended" : STAGES[index]}
      </p>
    </div>
  );
}

function RowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="flex animate-pulse items-center gap-4 px-5 py-5 sm:px-8"
    >
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 w-2/3 max-w-sm rounded bg-surface-muted" />
        <div className="h-3 w-44 rounded bg-surface-muted" />
      </div>
      <div className="hidden h-6 w-40 rounded-full bg-surface-muted md:block" />
      <div className="hidden h-5 w-28 rounded bg-surface-muted md:block" />
      <div className="h-[38px] w-[38px] rounded-xl bg-surface-muted" />
    </li>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading your errands">
      <span className="sr-only">Loading your errands</span>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface-white shadow-erander-card">
        <div className="border-b border-line px-5 py-4 sm:px-8">
          <div className="h-10 w-2/3 animate-pulse rounded-full bg-surface-muted" />
        </div>
        <ul className="divide-y divide-line-soft">
          {Array.from({ length: 5 }, (_, index) => (
            <RowSkeleton key={index} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear, onCreate }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-pale text-brand-navy">
        <Package size={28} aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-extrabold tracking-tight text-content">
        {hasFilters ? "No matching errands" : "Your errands start here"}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-content-muted">
        {hasFilters
          ? "Nothing matches your current search or filter. Try changing them."
          : "Post an errand and connect with an erander who can help you get it done."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 rounded-full border border-line px-6 py-3 text-sm font-bold text-content transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Post an errand
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   NEEDS YOUR ATTENTION
------------------------------------------------------- */

function getAttention(errand) {
  switch (getStatus(errand)) {
    case "awaiting_funding":
      return { message: "Fund this errand so your erander can get started.", action: "Fund errand" };
    case "completion_submitted":
      return { message: "Your erander says the work is done. Review it.", action: "Review work" };
    case "disputed":
      return { message: "A dispute is open on this errand.", action: "View dispute" };
    default:
      return null;
  }
}

function AttentionPanel({ errands, onView }) {
  const items = errands
    .map((errand) => ({ errand, attention: getAttention(errand) }))
    .filter((entry) => entry.attention);

  if (!items.length) return null;

  return (
    <section
      aria-label="Errands that need your attention"
      className="overflow-hidden rounded-3xl bg-brand-green text-brand-navy"
    >
      <div className="flex items-center gap-3 px-5 pb-2 pt-5 sm:px-8">
        <Clock3 size={20} aria-hidden="true" className="shrink-0" />
        <h2 className="text-lg font-extrabold tracking-tight">
          {items.length === 1
            ? "1 errand is waiting on you"
            : `${items.length} errands are waiting on you`}
        </h2>
      </div>
      <ul className="divide-y divide-brand-navy/15 px-5 pb-2 sm:px-8">
        {items.slice(0, 4).map(({ errand, attention }) => (
          <li
            key={getErrandId(errand) || errand.reference_code}
            className="flex flex-wrap items-center justify-between gap-3 py-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">
                {getErrandTitle(errand)}
              </p>
              <p className="mt-0.5 text-sm">{attention.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onView(getErrandId(errand))}
              className="shrink-0 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-bold text-content-inverse shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-brand-green"
            >
              {attention.action}
            </button>
          </li>
        ))}
      </ul>
      {items.length > 4 && (
        <p className="px-5 pb-4 text-xs sm:px-8">
          And {items.length - 4} more in the list below.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------
   ERRAND ROW
------------------------------------------------------- */

function ErrandRow({
  errand,
  busyId,
  onView,
  onViewOffers,
  onEdit,
  onReport,
  onClose,
  onDelete,
}) {
  const id = getErrandId(errand);
  const status = getStatus(errand);
  const busy = Boolean(id) && busyId === id;
  const lockReason = getLockReason(errand);
  const locked = Boolean(lockReason);
  const canClose = status === "open" && Boolean(id);

  const offerCount = getOfferCount(errand);
  const showOffers = shouldShowOffers(errand, offerCount);
  const offerLabel = offerCount > 0
    ? `View ${offerCount} ${offerCount === 1 ? "offer" : "offers"}`
    : "View offers";

  const menuItems = [
    {
      id: "view",
      label: "View details",
      icon: Eye,
      disabled: !id,
      onClick: () => onView(id),
    },
    {
      id: "offers",
      label: offerLabel,
      description: offerCount > 0
        ? `${offerCount} erander proposal${offerCount === 1 ? "" : "s"} received`
        : "",
      icon: Inbox,
      disabled: !id,
      hidden: !showOffers || !id,
      onClick: () => onViewOffers(errand),
    },
    {
      id: "edit",
      label: "Edit errand",
      icon: Pencil,
      disabled: locked || !id,
      hidden: locked || !id,
      onClick: () => onEdit(errand),
    },
    {
      id: "report",
      label: "Report an issue",
      icon: Flag,
      disabled: !id,
      onClick: () => onReport(id),
    },
    { id: "divider", divider: true },
    ...(canClose
      ? [
          {
            id: "close",
            label: "Close request",
            icon: XCircle,
            danger: true,
            loading: busy,
            onClick: () => onClose(errand),
          },
        ]
      : []),
    {
      id: "delete",
      label: "Remove errand",
      icon: Trash2,
      danger: true,
      disabled: locked || !id,
      hidden: locked || !id,
      loading: busy,
      onClick: () => onDelete(errand),
    },
  ];

  return (
    <li className="px-5 py-5 transition-colors hover:bg-surface/70 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_150px_auto] md:items-center md:gap-x-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />

            {locked && !ENDED.includes(status) && (
              <span
                title={lockReason}
                className="inline-flex items-center gap-1 text-xs font-medium text-content-muted"
              >
                <Lock size={12} aria-hidden="true" />
                Locked
              </span>
            )}

            {showOffers && id && (
              <OffersChip
                count={offerCount}
                title={getErrandTitle(errand)}
                onClick={() => onViewOffers(errand)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => onView(id)}
            className="mt-2.5 block max-w-full truncate rounded text-left text-lg font-extrabold tracking-tight text-content transition hover:text-success-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            {getErrandTitle(errand)}
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
            <span className="font-semibold">{getErrandReference(errand)}</span>
            <span>{getCategoryLabel(errand)}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} aria-hidden="true" />
              {formatDate(getErrandDate(errand))}
            </span>
          </p>
        </div>

        <div className="order-last col-span-2 md:order-none md:col-span-1">
          <StageMeter status={status} />
        </div>

        <div className="text-right md:text-left">
          <p className="text-xs text-content-muted">Estimated budget</p>
          <p className="mt-0.5 break-words text-lg font-extrabold tracking-tight tabular-nums text-content">
            {formatCurrency(getErrandBudget(errand), errand?.currency_code || "NGN")}
          </p>
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-start-auto md:row-start-auto">
          <ActionMenu
            items={menuItems}
            ariaLabel={`Actions for ${getErrandTitle(errand)}`}
            menuWidth={272}
            placement="left"
            align="left"
          />
          <button
            type="button"
            onClick={() => onView(id)}
            aria-label={`Open ${getErrandTitle(errand)}`}
            className="hidden h-[38px] w-[38px] items-center justify-center rounded-xl text-content-subtle transition hover:bg-surface-white hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy md:inline-flex"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------
   PAGE
------------------------------------------------------- */

export default function MyErrandsPage() {
  const navigate = useNavigate();

  const [errands, setErrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  /* Refs for horizontally centring the active tab */
  const tablistRef = useRef(null);
  const tabBtnRefs = useRef({});

  const fetchErrands = useCallback(async () => {
    const getMyErrands = findApi("getMyErrands");
    if (!getMyErrands) {
      setError("getMyErrands is not exported from errandsApi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await getMyErrands();
      setErrands(normalizeErrandsResponse(response));
    } catch (err) {
      setError(
        err?.message || "We couldn't load your errands. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrands();
  }, [fetchErrands]);

  /* Slide the active tab to the horizontal centre of the tablist */
  useEffect(() => {
    const container = tablistRef.current;
    const activeBtn = tabBtnRefs.current[activeFilter];

    if (!container || !activeBtn) return;

    const targetLeft =
      activeBtn.offsetLeft -
      container.offsetWidth / 2 +
      activeBtn.offsetWidth / 2;

    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeFilter]);

  const counts = useMemo(() => {
    const byStatus = errands.reduce((accumulator, errand) => {
      const status = getStatus(errand);
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    }, {});
    return {
      byStatus,
      total: errands.length,
      active: errands.filter((errand) =>
        ["funded", "in_progress", "completion_submitted"].includes(
          getStatus(errand)
        )
      ).length,
    };
  }, [errands]);

  const filteredErrands = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const filtered = errands.filter((errand) => {
      const matchesStatus =
        activeFilter === "all" || getStatus(errand) === activeFilter;
      const searchableText = [
        errand.title,
        errand.reference_code,
        errand.reference,
        errand.description,
        errand.category,
        errand.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!searchTerm || searchableText.includes(searchTerm));
    });

    return filtered.sort((first, second) => {
      switch (sortOrder) {
        case "oldest":
          return (
            new Date(getErrandDate(first) || 0).getTime() -
            new Date(getErrandDate(second) || 0).getTime()
          );
        case "budget_high":
          return (getErrandBudget(second) ?? -1) - (getErrandBudget(first) ?? -1);
        case "budget_low":
          return (
            (getErrandBudget(first) ?? Number.POSITIVE_INFINITY) -
            (getErrandBudget(second) ?? Number.POSITIVE_INFINITY)
          );
        case "newest":
        default:
          return (
            new Date(getErrandDate(second) || 0).getTime() -
            new Date(getErrandDate(first) || 0).getTime()
          );
      }
    });
  }, [errands, activeFilter, search, sortOrder]);

  const shownErrands = filteredErrands.slice(0, visibleCount);
  const remaining = filteredErrands.length - shownErrands.length;

  const handleView = useCallback(
    (id) => {
      if (!id) {
        toast.error("This errand doesn't have a valid ID yet.");
        return;
      }
      navigate(ROUTES.details(id));
    },
    [navigate]
  );

  const handleViewOffers = useCallback(
    (errand) => {
      const id = getErrandId(errand);
      if (!id) {
        toast.error("This errand doesn't have a valid ID yet.");
        return;
      }
      navigate(ROUTES.offers(id));
    },
    [navigate]
  );

  const handleEdit = useCallback(
    (errand) => {
      const id = getErrandId(errand);
      if (!id) {
        toast.error("This errand doesn't have a valid ID yet.");
        return;
      }
      const lockReason = getLockReason(errand);
      if (lockReason) {
        toast.error(lockReason);
        return;
      }
      navigate(ROUTES.edit(id));
    },
    [navigate]
  );

  const handleReport = useCallback(
    (id) => {
      if (!id) {
        toast.error("This errand doesn't have a valid ID yet.");
        return;
      }
      navigate(ROUTES.report(id));
    },
    [navigate]
  );

  const requestClose = useCallback(
    (errand) => setDialog({ type: "close", errand }),
    []
  );

  const requestDelete = useCallback((errand) => {
    const lockReason = getLockReason(errand);
    if (lockReason) {
      toast.error(lockReason);
      return;
    }
    setDialog({ type: "delete", errand });
  }, []);

  const cancelDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const confirmDialog = async () => {
    if (!dialog || busyId) return;
    const id = getErrandId(dialog.errand);
    if (!id) {
      toast.error("We couldn't identify this errand.");
      return;
    }

    const action =
      dialog.type === "delete"
        ? findApi("deleteErrand", "deleteErand", "removeErrand")
        : findApi("closeErrand", "closeErand");

    if (!action) {
      toast.error(
        dialog.type === "delete"
          ? "Removal isn't connected yet. Export deleteErrand from errandsApi."
          : "Closing isn't connected yet. Export closeErrand from errandsApi."
      );
      return;
    }

    setBusyId(id);
    try {
      await action(id);
      toast.success(
        dialog.type === "delete"
          ? "Your errand has been removed from your active errands."
          : "Your errand request has been closed."
      );
      setDialog(null);
      await fetchErrands();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          (dialog.type === "delete"
            ? "Unable to remove this errand. Please try again."
            : "Unable to close this errand. Please try again.")
      );
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setActiveFilter("all");
    setVisibleCount(PAGE_SIZE);
  };

  const hasFilters = Boolean(search) || activeFilter !== "all";

  const tabs = FILTERS.map((filter) => ({
    ...filter,
    count:
      filter.value === "all"
        ? counts.total
        : counts.byStatus[filter.value] || 0,
  }));

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-[1440px] space-y-6 px-0 py-6 sm:px-2 lg:py-8">
        <header className="overflow-hidden rounded-3xl bg-brand-navy text-content-inverse shadow-erander-card">
          <div className="px-5 pb-8 pt-6 sm:px-8 sm:pb-9 sm:pt-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  My errands
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                  Follow every request from the first offer to the final
                  payment.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchErrands}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    aria-hidden="true"
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.create)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand-navy shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                >
                  <Plus size={18} aria-hidden="true" />
                  Post an errand
                </button>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
            {[
              ["Total errands", counts.total, ""],
              ["Open for offers", counts.byStatus.open || 0, ""],
              ["Being handled", counts.active, "text-brand-mint"],
              ["Completed", counts.byStatus.completed || 0, ""],
            ].map(([label, value, tone]) => (
              <div key={label} className="bg-brand-navy px-5 py-4 sm:px-8">
                <dt className="text-sm text-white/70">{label}</dt>
                <dd className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>
                  {loading ? "—" : value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <div
            role="alert"
            className="rounded-r-3xl border-l-4 border-rose-500 bg-rose-50 p-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={22}
                className="mt-0.5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-extrabold text-rose-950">
                  We couldn't load your errands
                </h2>
                <p className="mt-1 break-words text-sm leading-6 text-rose-800">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={fetchErrands}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <AttentionPanel errands={errands} onView={handleView} />

            <section
              aria-label="Your errands"
              className="overflow-hidden rounded-3xl border border-line bg-surface-white shadow-erander-card"
            >
              <div className="border-b border-line px-3 sm:px-6">
                <div
                  ref={tablistRef}
                  role="tablist"
                  aria-label="Filter errands by status"
                  className="relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {tabs.map((tab) => {
                    const active = activeFilter === tab.value;
                    return (
                      <button
                        key={tab.value}
                        ref={(el) => {
                          tabBtnRefs.current[tab.value] = el;
                        }}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setActiveFilter(tab.value);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
                          active
                            ? "text-content"
                            : "text-content-muted hover:text-content"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-colors ${
                            active
                              ? "bg-brand-navy text-content-inverse"
                              : "bg-surface-muted text-content-muted"
                          }`}
                        >
                          {tab.count}
                        </span>
                        {active && (
                          <motion.span
                            layoutId="active-errand-tab-underline"
                            aria-hidden="true"
                            className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-navy"
                            transition={INDICATOR_SPRING}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-line-soft bg-surface/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <label className="relative block sm:w-80">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    placeholder="Search by title or reference"
                    aria-label="Search errands"
                    className="h-11 w-full rounded-full border border-line bg-surface-white pl-10 pr-4 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand-navy focus:ring-2 focus:ring-brand-pale"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <Select
                      options={SORT_OPTIONS}
                      value={sortOrder}
                      onChange={(value) => {
                        setSortOrder(
                          Array.isArray(value)
                            ? String(value[0] ?? "newest")
                            : String(value ?? "newest")
                        );
                        setVisibleCount(PAGE_SIZE);
                      }}
                      aria-label="Sort errands"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    aria-label="Learn about editing and removing errands"
                    title="Editing and removing errands"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-white text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <Info size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeFilter}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: TAB_EXIT_TRANSITION }}
                    transition={TAB_TRANSITION}
                  >
                    {filteredErrands.length === 0 ? (
                      <EmptyState
                        hasFilters={hasFilters}
                        onClear={clearFilters}
                        onCreate={() => navigate(ROUTES.create)}
                      />
                    ) : (
                      <>
                        <ul className="divide-y divide-line-soft">
                          {shownErrands.map((errand, index) => (
                            <ErrandRow
                              key={
                                getErrandId(errand) ||
                                errand.reference_code ||
                                index
                              }
                              errand={errand}
                              busyId={busyId}
                              onView={handleView}
                              onViewOffers={handleViewOffers}
                              onEdit={handleEdit}
                              onReport={handleReport}
                              onClose={requestClose}
                              onDelete={requestDelete}
                            />
                          ))}
                        </ul>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-4 sm:px-8">
                          <p className="text-xs text-content-muted">
                            Showing {shownErrands.length} of{" "}
                            {filteredErrands.length}{" "}
                            {filteredErrands.length === 1 ? "errand" : "errands"}
                          </p>
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleCount((count) => count + PAGE_SIZE)
                              }
                              className="rounded-full bg-surface-muted px-5 py-2.5 text-sm font-semibold text-content transition hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                            >
                              Show {Math.min(PAGE_SIZE, remaining)} more
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>
          </>
        )}
      </main>

      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Editing and removing errands"
        description="A quick guide to what you can change, and when."
        size="lg"
      >
        <div className="space-y-4 text-sm leading-6 text-content-muted">
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <Pencil
              size={18}
              className="mt-0.5 shrink-0 text-brand-navy"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-extrabold text-content">
                Before an offer is accepted
              </h3>
              <p className="mt-1">
                You can edit or remove an errand freely. Submitted pending
                offers do not block removal — they are preserved in history
                and eranders can withdraw their own pending proposals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <Lock
              size={18}
              className="mt-0.5 shrink-0 text-brand-navy"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-extrabold text-content">
                Once an agreement is accepted or funding begins
              </h3>
              <p className="mt-1">
                The errand becomes protected. You can no longer edit or remove
                it while the agreement is active or funding is underway.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <XCircle
              size={18}
              className="mt-0.5 shrink-0 text-brand-navy"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-extrabold text-content">
                Close instead of remove
              </h3>
              <p className="mt-1">
                Close a request when you want to stop accepting new offers
                without removing it from your active errands.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            className="rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(dialog)}
        onClose={() => {
          if (!busyId) setDialog(null);
        }}
        title={
          dialog?.type === "delete"
            ? "Remove this errand?"
            : "Close this errand request?"
        }
        description={
          dialog?.type === "delete"
            ? "This removes it from your active errands. Submitted offers are preserved."
            : "This stops new offers. It cannot be easily undone."
        }
        size="md"
        closeOnOverlayClick={!busyId}
        closeOnEscape={!busyId}
      >
        <div className="flex items-start gap-3 rounded-2xl border-l-4 border-rose-500 bg-rose-50 p-4">
          {dialog?.type === "delete" ? (
            <Trash2
              size={20}
              className="mt-0.5 shrink-0 text-rose-600"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              size={20}
              className="mt-0.5 shrink-0 text-rose-600"
              aria-hidden="true"
            />
          )}
          <p className="text-sm leading-6 text-rose-900">
            <span className="font-extrabold">
              {getErrandTitle(dialog?.errand)}
            </span>{" "}
            {dialog?.type === "delete"
              ? "will be removed from your active errands. Any offers already submitted will be preserved, and eranders can withdraw their own pending proposals. This removal cannot be undone from the app."
              : "will stop accepting offers. You may not be able to reopen it, and any cancellation rules will be enforced by the server."}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={Boolean(busyId)}
            onClick={cancelDialog}
            className="rounded-full border border-line px-5 py-3 text-sm font-bold text-content-muted transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:opacity-50"
          >
            Keep errand
          </button>
          <button
            type="button"
            disabled={Boolean(busyId)}
            onClick={confirmDialog}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyId ? (
              <>
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
                {dialog?.type === "delete" ? "Removing..." : "Closing..."}
              </>
            ) : dialog?.type === "delete" ? (
              "Remove errand"
            ) : (
              "Yes, close request"
            )}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}