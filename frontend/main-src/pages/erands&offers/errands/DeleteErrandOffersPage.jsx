import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Handshake,
  Info,
  LoaderCircle,
  MessageSquareText,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import {
  acceptErandOffer,
  getOffersForErrand,
  rejectErandOffer,
} from "@/services/offers/offersApi";

import { getErrandById } from "@/services/errands/errandsApi";

/* -------------------------------------------------------------------------- */
/*                                   CONFIG                                   */
/* -------------------------------------------------------------------------- */

const STATUS_OPTIONS = [
  { value: "all", label: "All offers" },
  { value: "pending", label: "Awaiting your decision" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_STYLES = {
  pending: {
    label: "Awaiting decision",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  accepted: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Clock3,
  },
  superseded: {
    label: "Superseded",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: Info,
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

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value, currency = "USD") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not specified";

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

function normalizeStatus(value) {
  return String(value || "pending").toLowerCase();
}

function getStatusConfig(status) {
  const normalized = normalizeStatus(status);

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

function getOfferId(offer) {
  return offer?.id || offer?.offer_id || "";
}

function getCurrency(offer, errand) {
  return offer?.currency_code || errand?.currency_code || "USD";
}

function getAmount(offer, field) {
  const amount = Number(offer?.[field]);
  return Number.isFinite(amount) ? amount : 0;
}

function getProposedTotal(offer) {
  const total = Number(offer?.proposed_total);

  if (Number.isFinite(total)) return total;

  return (
    getAmount(offer, "proposed_item_total") +
    getAmount(offer, "proposed_service_fee") +
    getAmount(offer, "proposed_delivery_fee") +
    getAmount(offer, "proposed_other_fees")
  );
}

function getOfferItems(offer) {
  const items =
    offer?.items ||
    offer?.offer_items ||
    offer?.erand_offer_items ||
    [];

  return Array.isArray(items) ? items : [];
}

function getOfferMessage(offer) {
  return offer?.offer_message || offer?.message || "";
}

function getErander(offer) {
  return (
    offer?.erander ||
    offer?.profile ||
    offer?.offered_by_profile ||
    offer?.offeredByProfile ||
    offer?.user ||
    {}
  );
}

function resolveErander(offer, errand) {
  const direct = getErander(offer);

  if (direct && Object.keys(direct).length > 0) return direct;

  const assigned = errand?.assigned_erander;

  if (
    assigned &&
    offer?.offered_by &&
    String(assigned.id) === String(offer.offered_by)
  ) {
    return assigned;
  }

  // The offers endpoint returns flattened profile fields.
  if (
    offer?.erander_display_name ||
    offer?.erander_first_name ||
    offer?.erander_last_name ||
    offer?.erander_avatar_url
  ) {
    return {
      display_name: offer.erander_display_name,
      first_name: offer.erander_first_name,
      last_name: offer.erander_last_name,
      avatar_url: offer.erander_avatar_url,
    };
  }

  return {};
}

function getEranderName(offer, errand) {
  const erander = resolveErander(offer, errand);

  const fullName = [erander?.first_name, erander?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    erander?.display_name ||
    erander?.full_name ||
    fullName ||
    offer?.erander_name ||
    offer?.display_name ||
    "ERANDER service provider"
  );
}

function getEranderInitials(offer, errand) {
  const name = getEranderName(offer, errand);

  if (name === "ERANDER service provider") return "E";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getCreatedAt(offer) {
  return offer?.created_at || offer?.submitted_at || null;
}

function getOfferUpdatedAt(offer) {
  return (
    offer?.updated_at ||
    offer?.responded_at ||
    offer?.created_at ||
    offer?.submitted_at ||
    null
  );
}

function toTimestamp(value) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

/**
 * The actual offers endpoint returns:
 *
 * {
 *   success: true,
 *   data: {
 *     errand: {...},
 *     offers: [...]
 *   }
 * }
 *
 * Only explicitly named offer arrays are accepted.
 * Errand shopping items must never be mistaken for offers.
 */
function normalizeOffersResponse(result) {
  if (!result) return [];

  if (Array.isArray(result)) return result;

  const data = result?.data ?? result;

  const candidates = [
    data?.offers,
    data?.erand_offers,
    data?.errand_offers,
    data?.received_offers,
    data?.receivedOffers,
    data?.results,
    data?.rows,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  console.error(
    "[ErrandOffersPage] Unexpected offers API response:",
    result
  );

  return [];
}

function normalizeErrandResponse(result) {
  const data = result?.data ?? result ?? {};

  return data.errand || data.erand || data.request || data;
}

/**
 * Merge offers by their IDs.
 * The most recently updated version wins.
 */
function mergeOffers(...sources) {
  const map = new Map();

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    for (const offer of source) {
      if (!offer) continue;

      const id = getOfferId(offer);

      const key =
        id ||
        `${offer?.offered_by || ""}|${offer?.proposed_total || ""}|${
          getCreatedAt(offer) || ""
        }`;

      const existing = map.get(key);

      if (!existing) {
        map.set(key, offer);
        continue;
      }

      if (
        toTimestamp(getOfferUpdatedAt(offer)) >=
        toTimestamp(getOfferUpdatedAt(existing))
      ) {
        map.set(key, offer);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Embedded offers are only a fallback.
 * The offers endpoint remains the authoritative source.
 */
function getEmbeddedOffers(errand) {
  if (!errand) return [];

  const result = [];

  const candidates = [
    errand.offers,
    errand.erand_offers,
    errand.errand_offers,
    errand.errandOffers,
    errand.received_offers,
    errand.receivedOffers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      result.push(...candidate);
    }
  }

  if (
    errand.accepted_offer &&
    typeof errand.accepted_offer === "object" &&
    !Array.isArray(errand.accepted_offer)
  ) {
    result.push(errand.accepted_offer);
  }

  return result;
}

function canRespondToOffers(errand) {
  if (!errand) return false;

  return (
    normalizeStatus(errand.status) === "open" &&
    errand.offers_enabled !== false &&
    !errand.accepted_offer_id &&
    !errand.agreement_locked_at
  );
}

/* -------------------------------------------------------------------------- */
/*                              SHIMMER SYSTEM                                */
/* -------------------------------------------------------------------------- */

function Shimmer({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-lg bg-slate-100",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[erander-shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent",
        "before:via-white/80 before:to-transparent",
        className
      )}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.025)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <Shimmer className="h-14 w-14 shrink-0 rounded-2xl" />

          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <Shimmer className="h-4 w-40 max-w-full" />
            <Shimmer className="h-3 w-52 max-w-full" />
          </div>
        </div>

        <Shimmer className="h-8 w-28 rounded-full" />
      </div>

      <div className="mt-6">
        <Shimmer className="mb-3 h-3 w-28" />

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-100 bg-[#fafbfd] p-3.5"
            >
              <Shimmer className="h-3 w-16" />
              <Shimmer className="mt-3 h-4 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#e5f5eb] bg-[#f7fcf9] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <Shimmer className="h-10 w-10 shrink-0 rounded-xl" />

          <div className="space-y-2">
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-6 w-36" />
          </div>
        </div>

        <Shimmer className="h-10 w-28" />
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Shimmer className="h-3 w-36" />

        <div className="flex gap-2">
          <Shimmer className="h-10 w-24 rounded-xl" />
          <Shimmer className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <>
      <style>
        {`
          @keyframes erander-shimmer {
            100% {
              transform: translateX(100%);
            }
          }
        `}
      </style>

      <div
        className="space-y-7"
        aria-label="Loading received offers"
        aria-busy="true"
      >
        {/* Errand overview skeleton */}

        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_16px_rgba(20,33,61,0.025)] sm:p-7">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#35d07f]" />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex gap-2">
                <Shimmer className="h-7 w-32 rounded-md" />
                <Shimmer className="h-7 w-24 rounded-md" />
              </div>

              <Shimmer className="h-3 w-32" />
              <Shimmer className="mt-3 h-7 w-2/3 max-w-md" />

              <div className="mt-5 flex flex-wrap gap-4">
                <Shimmer className="h-3 w-36" />
                <Shimmer className="h-3 w-36" />
                <Shimmer className="h-3 w-28" />
              </div>
            </div>

            <Shimmer className="h-9 w-28 rounded-full" />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <Shimmer className="h-3 w-full max-w-2xl" />
            <Shimmer className="mt-3 h-3 w-4/5 max-w-xl" />
          </div>
        </section>

        {/* Summary cards skeleton */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.025)] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Shimmer className="h-3 w-24" />
                  <Shimmer className="mt-4 h-9 w-14" />
                  <Shimmer className="mt-2 h-3 w-28" />
                </div>

                <Shimmer className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </section>

        {/* Search skeleton */}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.025)] sm:p-5">
          <div className="flex items-center gap-3">
            <Shimmer className="h-8 w-8 rounded-lg" />

            <div className="space-y-2">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-3 w-40" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <Shimmer className="h-12 rounded-xl" />
            <Shimmer className="h-12 rounded-xl" />
          </div>
        </section>

        {/* Offer list heading */}

        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Shimmer className="h-6 w-36" />
            <Shimmer className="h-3 w-48" />
          </div>

          <Shimmer className="h-10 w-32 rounded-xl" />
        </div>

        {/* Offer cards */}

        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                SMALL UI                                    */
/* -------------------------------------------------------------------------- */

function SectionEyebrow({ children }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </p>
  );
}

function StatusBadge({ status }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold",
        config.className
      )}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, description }) {
  const tones = {
    navy: {
      icon: "bg-[#14213d] text-white",
      accent: "bg-[#14213d]",
    },
    green: {
      icon: "bg-[#e8fbf0] text-[#15803d]",
      accent: "bg-[#35d07f]",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700",
      accent: "bg-amber-400",
    },
    slate: {
      icon: "bg-slate-100 text-slate-600",
      accent: "bg-slate-300",
    },
  };

  const style = tones[tone] || tones.slate;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.025)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,33,61,0.06)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>

          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#14213d]">
            {value}
          </p>

          {description && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              {description}
            </p>
          )}
        </div>

        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            style.icon
          )}
        >
          <Icon size={19} strokeWidth={2.1} />
        </span>
      </div>

      <span
        className={cn(
          "absolute bottom-0 left-0 h-[3px] w-0 transition-all duration-300 group-hover:w-full",
          style.accent
        )}
      />
    </div>
  );
}

function AmountTile({ label, value, currency }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>

      <p className="mt-1.5 break-words text-sm font-extrabold tracking-tight text-[#14213d]">
        {formatMoney(value, currency)}
      </p>
    </div>
  );
}

function Avatar({ offer, errand, size = "large" }) {
  const erander = resolveErander(offer, errand);
  const avatar = erander?.avatar_url || erander?.avatar;

  const dimensions =
    size === "small" ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={cn(
          dimensions,
          "shrink-0 border border-slate-200 object-cover"
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        dimensions,
        "flex shrink-0 items-center justify-center border border-[#d8f5e4] bg-[#e8fbf0] font-extrabold text-[#15803d]",
        size === "small" ? "text-xs" : "text-base"
      )}
    >
      {getEranderInitials(offer, errand)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                               EMPTY STATES                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({
  filtered,
  hasOffers,
  onReset,
  onBack,
}) {
  const title = filtered
    ? "No matching offers"
    : hasOffers
      ? "No offers awaiting a decision"
      : "No offers received yet";

  const description = filtered
    ? "We couldn't find any offers matching your search or selected status. Try adjusting your filters."
    : hasOffers
      ? "All submitted offers are accounted for. You can review their statuses using the status filter above."
      : "When eranders submit offers for this errand, they will appear here. You can compare their proposed prices and messages before making a decision.";

  return (
    <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center sm:px-10">
      <span className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-2xl border border-[#d8f5e4] bg-[#e8fbf0] text-[#15803d]">
        <MessageSquareText size={29} strokeWidth={1.8} />
      </span>

      <h3 className="mt-5 text-xl font-extrabold tracking-tight text-[#14213d]">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#14213d] transition hover:border-slate-300 hover:bg-slate-50"
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
        >
          <ArrowLeft size={16} />
          Back to errand
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              DECISION MODAL                                */
/* -------------------------------------------------------------------------- */

function DecisionModal({
  action,
  offer,
  errand,
  busy,
  onClose,
  onConfirm,
}) {
  if (!action || !offer) return null;

  const accepting = action === "accept";
  const eranderName = getEranderName(offer, errand);
  const total = getProposedTotal(offer);
  const currency = getCurrency(offer, errand);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#091426]/65 p-4 backdrop-blur-[5px]"
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
        aria-labelledby="offer-decision-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                accepting
                  ? "bg-[#e8fbf0] text-[#15803d]"
                  : "bg-rose-50 text-rose-600"
              )}
            >
              {accepting ? (
                <Handshake size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </span>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close confirmation"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <h2
            id="offer-decision-title"
            className="mt-5 text-xl font-extrabold tracking-tight text-[#14213d]"
          >
            {accepting ? "Accept this offer?" : "Reject this offer?"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {accepting
              ? `You are choosing ${eranderName} for this errand. Review the proposed total and make sure you are comfortable with the price before continuing.`
              : `You are about to reject the offer from ${eranderName}. Make sure this is the offer you want to decline.`}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Proposed total
            </p>

            <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#14213d]">
              {formatMoney(total, currency)}
            </p>

            {accepting && (
              <div className="mt-4 flex items-start gap-2.5 border-t border-slate-200 pt-3">
                <Info
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-600"
                />

                <p className="text-xs leading-5 text-slate-600">
                  Accepting an offer is not the same as funding the errand.
                  Follow the next steps shown after acceptance. Work should
                  not begin before the required agreement and funding steps
                  are complete.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Go back
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              accepting
                ? "bg-[#15803d] hover:bg-[#166534]"
                : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {busy ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Processing...
              </>
            ) : accepting ? (
              <>
                <Check size={17} />
                Confirm acceptance
              </>
            ) : (
              <>
                <XCircle size={17} />
                Confirm rejection
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               ERRAND HEADER                                */
/* -------------------------------------------------------------------------- */

function ErrandOverview({ errand, category, respondingAllowed }) {
  return (
    <section className="relative mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_3px_16px_rgba(20,33,61,0.035)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#35d07f]" />

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {errand?.reference_code && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f1f5f9] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <FileText size={12} />
                  {errand.reference_code}
                </span>
              )}

              {category && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#d8f5e4] bg-[#f0fbf4] px-2.5 py-1.5 text-[10px] font-bold text-[#15803d]">
                  <Tag size={12} />
                  {category}
                </span>
              )}
            </div>

            <SectionEyebrow>Errand receiving offers</SectionEyebrow>

            <h2 className="mt-2 break-words text-xl font-extrabold leading-tight tracking-tight text-[#14213d] sm:text-2xl">
              {errand?.title || "Your errand"}
            </h2>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} className="text-slate-400" />
                Created {formatDate(errand?.created_at)}
              </span>

              {errand?.scheduled_for && (
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={15} className="text-slate-400" />
                  Scheduled {formatDate(errand.scheduled_for, true)}
                </span>
              )}

              {errand?.estimated_total !== undefined &&
                errand?.estimated_total !== null && (
                  <span className="inline-flex items-center gap-2">
                    <Wallet size={15} className="text-slate-400" />
                    Budget{" "}
                    <strong className="font-bold text-[#14213d]">
                      {formatMoney(
                        errand.estimated_total,
                        errand.currency_code || "USD"
                      )}
                    </strong>
                  </span>
                )}
            </div>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-2 text-[11px] font-extrabold capitalize",
              respondingAllowed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-600"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                respondingAllowed ? "bg-emerald-500" : "bg-slate-400"
              )}
            />
            {String(errand?.status || "unknown").replaceAll("_", " ")}
          </span>
        </div>

        {errand?.description && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              {errand.description}
            </p>
          </div>
        )}

        {!respondingAllowed && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <Info
              size={18}
              className="mt-0.5 shrink-0 text-amber-700"
            />

            <div>
              <p className="text-xs font-extrabold text-amber-800">
                Offer selection is unavailable
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800/90">
                This errand is not currently open for offer selection.
                You can still review the complete offer history, but you
                cannot accept or reject another offer from this page.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                OFFER CARD                                  */
/* -------------------------------------------------------------------------- */

function OfferCard({
  offer,
  errand,
  respondingAllowed,
  onAccept,
  onReject,
}) {
  const offerId = getOfferId(offer);
  const status = normalizeStatus(offer.status);
  const currency = getCurrency(offer, errand);
  const eranderName = getEranderName(offer, errand);
  const erander = resolveErander(offer, errand);
  const message = getOfferMessage(offer);
  const createdAt = getCreatedAt(offer);
  const items = getOfferItems(offer);
  const total = getProposedTotal(offer);

  const canDecide =
    status === "pending" &&
    respondingAllowed &&
    Boolean(offerId);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(20,33,61,0.025)] transition duration-200 hover:border-slate-300 hover:shadow-[0_10px_30px_rgba(20,33,61,0.055)]">
      <div className="p-4 sm:p-6">
        {/* Provider identity */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Avatar offer={offer} errand={errand} />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-base font-extrabold tracking-tight text-[#14213d] sm:text-lg">
                  {eranderName}
                </h3>

                {erander?.verification_status === "verified" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-[#e8fbf0] px-2 py-1 text-[10px] font-bold text-[#15803d]"
                    title="Verified erander"
                  >
                    <ShieldCheck size={12} />
                    Verified
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
                {createdAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    {formatDate(createdAt, true)}
                  </span>
                )}

                {items.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Package size={13} />
                    {items.length} priced{" "}
                    {items.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <StatusBadge status={status} />
        </div>

        {/* Cost breakdown */}

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <SectionEyebrow>Offer breakdown</SectionEyebrow>

            <span className="text-[10px] font-medium text-slate-400">
              {currency}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <AmountTile
              label="Items"
              value={getAmount(offer, "proposed_item_total")}
              currency={currency}
            />

            <AmountTile
              label="Service fee"
              value={getAmount(offer, "proposed_service_fee")}
              currency={currency}
            />

            <AmountTile
              label="Delivery fee"
              value={getAmount(offer, "proposed_delivery_fee")}
              currency={currency}
            />

            <AmountTile
              label="Other fees"
              value={getAmount(offer, "proposed_other_fees")}
              currency={currency}
            />
          </div>
        </div>

        {/* Proposed total */}

        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#d8f5e4] bg-[#f3fcf6] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d8f5e4] bg-white text-[#15803d]">
              <Wallet size={19} />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total proposed price
              </p>

              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[#15803d] sm:text-2xl">
                {formatMoney(total, currency)}
              </p>
            </div>
          </div>

          {errand?.estimated_total !== undefined &&
            errand?.estimated_total !== null && (
              <div className="border-t border-[#d8f5e4] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Your estimated budget
                </p>

                <p className="mt-1 text-sm font-extrabold text-[#14213d]">
                  {formatMoney(errand.estimated_total, currency)}
                </p>
              </div>
            )}
        </div>

        {/* Provider message */}

        {message && (
          <div className="mt-4 rounded-xl border border-slate-200/80 bg-[#fafbfd] p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                <MessageSquareText size={14} />
              </span>

              <p className="text-xs font-extrabold text-[#14213d]">
                Message from erander
              </p>
            </div>

            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              {message}
            </p>
          </div>
        )}

        {/* Accepted notice */}

        {status === "accepted" && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-emerald-700"
            />

            <div>
              <p className="text-sm font-extrabold text-emerald-800">
                This offer has been accepted
              </p>

              <p className="mt-1 text-xs leading-5 text-emerald-700">
                Continue to the errand details to review the next steps
                for agreement and funding.
              </p>
            </div>
          </div>
        )}

        {/* Superseded notice */}

        {status === "superseded" && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/80 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-violet-700"
            />

            <div>
              <p className="text-sm font-extrabold text-violet-800">
                This offer was superseded
              </p>

              <p className="mt-1 text-xs leading-5 text-violet-700">
                Another offer was selected for this errand. This offer
                remains in your history for reference.
              </p>
            </div>
          </div>
        )}

        {/* Card footer */}

        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              {erander?.business_name ? (
                <BriefcaseBusiness size={15} />
              ) : (
                <UserRound size={15} />
              )}
            </span>

            <span className="truncate">
              {erander?.business_name || "Independent erander"}
            </span>
          </div>

          {canDecide ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                onClick={() => onReject(offer)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
              >
                <X size={15} />
                Reject
              </button>

              <button
                type="button"
                onClick={() => onAccept(offer)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#15803d] px-5 text-sm font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-[#166534]"
              >
                <Check size={16} />
                Accept offer
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">
              {status === "pending" && !respondingAllowed
                ? "Decision unavailable"
                : status === "pending"
                  ? "Offer cannot be actioned"
                  : "No action available"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PAGE COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function ErrandOffersPage() {
  const { errandId } = useParams();
  const navigate = useNavigate();

  const [errand, setErrand] = useState(null);
  const [offers, setOffers] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [decision, setDecision] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(false);

  /* -------------------------------- Loading ------------------------------- */

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!errandId) {
        setError("The errand ID is missing from the page address.");
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [errandSettled, offersSettled] = await Promise.allSettled([
        getErrandById(errandId),
        getOffersForErrand(errandId),
      ]);

      if (errandSettled.status === "rejected") {
        setError(
          errandSettled.reason?.message ||
            "We could not load this errand. Please try again."
        );

        setLoading(false);
        setRefreshing(false);
        return;
      }

      const nextErrand = normalizeErrandResponse(errandSettled.value);

      setErrand(nextErrand);

      const embeddedOffers = getEmbeddedOffers(nextErrand);

      if (offersSettled.status === "fulfilled") {
        const fetchedOffers = normalizeOffersResponse(
          offersSettled.value
        );

        // The endpoint provides the complete offer history.
        // Embedded offers supplement it if necessary.
        const combinedOffers = mergeOffers(
          fetchedOffers,
          embeddedOffers
        );

        setOffers(combinedOffers);
      } else {
        console.error(
          "[ErrandOffersPage] Offers request failed:",
          offersSettled.reason
        );

        // Preserve an accepted offer if the offers request fails.
        // Do not discard existing data during a silent refresh.
        setOffers((previous) =>
          mergeOffers(previous, embeddedOffers)
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [errandId]
  );

  useEffect(() => {
    setErrand(null);
    setOffers([]);
    setError("");
    setDecision(null);
    setSearchInput("");
    setStatusFilter("all");
  }, [errandId]);

  useEffect(() => {
    let active = true;

    const execute = async () => {
      await loadData();
    };

    if (active) execute();

    return () => {
      active = false;
    };
  }, [loadData]);

  /* -------------------------------- Filters ------------------------------- */

  const filteredOffers = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return offers.filter((offer) => {
      const status = normalizeStatus(offer.status);

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const searchableText = [
        getEranderName(offer, errand),
        getOfferMessage(offer),
        offer?.offer_message,
        offer?.reference_code,
        offer?.offered_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [offers, searchInput, statusFilter, errand]);

  /* -------------------------------- Summary ------------------------------- */

  const summary = useMemo(
    () => ({
      total: offers.length,

      pending: offers.filter(
        (offer) => normalizeStatus(offer.status) === "pending"
      ).length,

      accepted: offers.filter(
        (offer) => normalizeStatus(offer.status) === "accepted"
      ).length,

      closed: offers.filter((offer) =>
        ["rejected", "withdrawn", "expired", "superseded"].includes(
          normalizeStatus(offer.status)
        )
      ).length,
    }),
    [offers]
  );

  const respondingAllowed = canRespondToOffers(errand);

  /* ------------------------------ Decisions ------------------------------- */

  const handleDecision = async () => {
    if (!decision?.offer || decisionBusy) return;

    const offerId = getOfferId(decision.offer);

    if (!offerId) {
      toast.error("We could not identify this offer.");
      return;
    }

    if (!canRespondToOffers(errand)) {
      toast.error(
        "This errand is no longer open for offer decisions. Refresh the page to see its current status."
      );

      setDecision(null);
      await loadData({ silent: true });
      return;
    }

    if (normalizeStatus(decision.offer.status) !== "pending") {
      toast.error("This offer is no longer awaiting a decision.");
      setDecision(null);
      await loadData({ silent: true });
      return;
    }

    setDecisionBusy(true);

    try {
      if (decision.action === "accept") {
        await acceptErandOffer(offerId);
        toast.success("Offer accepted successfully.");
      } else {
        await rejectErandOffer(offerId);
        toast.success("Offer rejected successfully.");
      }

      setDecision(null);

      await loadData({ silent: true });
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          `We could not ${
            decision.action === "accept" ? "accept" : "reject"
          } this offer. Please try again.`
      );

      await loadData({ silent: true });
    } finally {
      setDecisionBusy(false);
    }
  };

  /* -------------------------------- Actions -------------------------------- */

  const handleResetFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
  };

  const goBackToErrand = () => {
    if (errandId) {
      navigate(`/dashboard/erands/${encodeURIComponent(errandId)}`);
    } else {
      navigate("/dashboard/erands");
    }
  };

  const category = errand?.category
    ? CATEGORY_LABELS[errand.category] ||
      errand.category.replaceAll("_", " ")
    : "";

  const hasActiveFilters =
    Boolean(searchInput.trim()) || statusFilter !== "all";

  /* --------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-full bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        {/* Page heading */}

        <div className="mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={goBackToErrand}
                className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-[#14213d]"
              >
                <ArrowLeft size={15} />
                Back to errand
              </button>

              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-white shadow-lg shadow-[#14213d]/10">
                  <Handshake size={23} strokeWidth={1.8} />
                </span>

                <div>
                  <SectionEyebrow>Customer workspace</SectionEyebrow>

                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#14213d] sm:text-3xl">
                    Received offers
                  </h1>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Compare eranders, review their proposed costs, and
                    choose the right person for your errand.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadData({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#14213d] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Initial loading */}

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Info size={25} />
            </span>

            <h2 className="mt-4 text-lg font-extrabold text-[#14213d]">
              We couldn't load the offers
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() => loadData()}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Errand overview */}

            <ErrandOverview
              errand={errand}
              category={category}
              respondingAllowed={respondingAllowed}
            />

            {/* Summary cards */}

            <section
              aria-label="Offer summary"
              className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <SummaryCard
                label="Total received"
                value={summary.total}
                icon={FileText}
                tone="navy"
                description="All submitted offers"
              />

              <SummaryCard
                label="Awaiting decision"
                value={summary.pending}
                icon={Clock3}
                tone="amber"
                description="Require your attention"
              />

              <SummaryCard
                label="Accepted"
                value={summary.accepted}
                icon={CheckCircle2}
                tone="green"
                description="Offers you selected"
              />

              <SummaryCard
                label="Closed offers"
                value={summary.closed}
                icon={XCircle}
                tone="slate"
                description="No longer active"
              />
            </section>

            {/* Search and filters */}

            <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.025)] sm:p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8fbf0] text-[#15803d]">
                    <Search size={16} />
                  </span>

                  <div>
                    <h2 className="text-sm font-extrabold text-[#14213d]">
                      Find an offer
                    </h2>

                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Search by erander or message
                    </p>
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="self-start text-xs font-bold text-[#15803d] transition hover:text-[#166534] sm:self-auto"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                <label className="relative block">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    placeholder="Search erander name or offer message..."
                    aria-label="Search received offers"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-[#fafbfd] pl-11 pr-4 text-sm text-[#14213d] outline-none transition placeholder:text-slate-400 focus:border-[#35d07f] focus:bg-white focus:ring-4 focus:ring-[#35d07f]/10"
                  />
                </label>

                <label className="relative block">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    aria-label="Filter offers by status"
                    className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-[#fafbfd] px-4 pr-10 text-sm font-semibold text-[#14213d] outline-none transition focus:border-[#35d07f] focus:bg-white focus:ring-4 focus:ring-[#35d07f]/10"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
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
            </section>

            {/* Offers section heading */}

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-[#14213d] sm:text-xl">
                    Erander offers
                  </h2>

                  <span className="rounded-md bg-[#e8fbf0] px-2 py-1 text-[10px] font-extrabold text-[#15803d]">
                    {filteredOffers.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredOffers.length} of {offers.length}{" "}
                  {offers.length === 1 ? "offer" : "offers"}
                </p>
              </div>

              <button
                type="button"
                onClick={goBackToErrand}
                className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-[#d8f5e4] bg-[#f0fbf4] px-3.5 text-xs font-extrabold text-[#15803d] transition hover:bg-[#e3f8eb] sm:self-auto"
              >
                Errand details
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Offers list */}

            {filteredOffers.length === 0 ? (
              <EmptyState
                filtered={hasActiveFilters}
                hasOffers={offers.length > 0}
                onReset={handleResetFilters}
                onBack={goBackToErrand}
              />
            ) : (
              <div className="space-y-4">
                {filteredOffers.map((offer) => {
                  const offerId = getOfferId(offer);

                  return (
                    <OfferCard
                      key={
                        offerId ||
                        `${offer?.offered_by}-${getCreatedAt(offer)}`
                      }
                      offer={offer}
                      errand={errand}
                      respondingAllowed={respondingAllowed}
                      onAccept={(selectedOffer) =>
                        setDecision({
                          action: "accept",
                          offer: selectedOffer,
                        })
                      }
                      onReject={(selectedOffer) =>
                        setDecision({
                          action: "reject",
                          offer: selectedOffer,
                        })
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Trust and safety information */}

            <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-start gap-3.5 p-4 sm:p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8fbf0] text-[#15803d]">
                  <ShieldCheck size={20} />
                </span>

                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#14213d]">
                    Review before accepting
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                    Compare the complete proposed price, the erander's
                    message, and the errand requirements. Acceptance does
                    not itself confirm that payment has been received or
                    authorize work to begin before the required agreement
                    and funding steps are complete.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-[#fafbfd] px-4 py-3 sm:px-5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <ShieldCheck size={13} />
                  Review offers carefully
                </span>

                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <Wallet size={13} />
                  Check the full proposed price
                </span>

                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <Handshake size={13} />
                  Complete agreement and funding
                </span>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Decision confirmation */}

      <DecisionModal
        action={decision?.action}
        offer={decision?.offer}
        errand={errand}
        busy={decisionBusy}
        onClose={() => {
          if (!decisionBusy) setDecision(null);
        }}
        onConfirm={handleDecision}
      />
    </div>
  );
}