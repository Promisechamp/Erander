import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, FileText, Flag, HandCoins, Info, Loader2, MessageSquare,
  Package, RefreshCw, Search, Send, ShieldCheck, Tag, Truck, Wallet, X, XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import ActionMenu from "@/components/ActionMenu";
import CreateSupportTicket from "@/pages/support/CreateSupportTicket";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";

import { getMyErandOffers, withdrawErandOffer } from "@/services/offers/offersApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 10;
const FALLBACK_CURRENCY = "USD";
const EASE = [0.22, 1, 0.36, 1];

const STATUS_OPTIONS = [
  { value: "all", label: "All offers" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Not selected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_STYLES = {
  pending: { label: "Awaiting response", tone: "attention", icon: Clock3 },
  accepted: { label: "Accepted", tone: "success", icon: CheckCircle2 },
  rejected: { label: "Not selected", tone: "danger", icon: XCircle },
  withdrawn: { label: "Withdrawn", tone: "neutral", icon: ArrowDownRight },
  expired: { label: "Expired", tone: "neutral", icon: Clock3 },
  superseded: { label: "Superseded", tone: "info", icon: ArrowUpRight },
};

const ERRAND_STATUS_STYLES = {
  awaiting_funding: { label: "Awaiting funding", tone: "attention", icon: Clock3 },
  funded: { label: "Funded", tone: "success", icon: Wallet },
  in_progress: { label: "In progress", tone: "info", icon: Truck },
  completion_submitted: { label: "Completion review", tone: "attention", icon: FileText },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  disputed: { label: "Disputed", tone: "danger", icon: ShieldCheck },
  cancelled: { label: "Cancelled", tone: "neutral", icon: XCircle },
  expired: { label: "Expired", tone: "neutral", icon: Clock3 },
};

const CATEGORY_LABELS = {
  shopping: "Shopping", delivery: "Delivery", confidential: "Confidential documents", pickup: "Legacy pickup",
  home_help: "Home help", personal_assistance: "Personal assistance",
  business_support: "Business support", other: "Other errands",
  groceries: "Shopping & groceries", documents: "Documents & office",
  gifts: "Gifts & special requests",
};

const FUNDED_OR_LATER = ["funded", "in_progress", "completion_submitted", "completed"];
const COMPLETABLE_ERRAND_STATUSES = ["funded", "in_progress"];

/* -------------------------------------------------------------------------- */
/*                              DESIGN TOKENS                                 */
/* -------------------------------------------------------------------------- */

const CARD = "rounded-2xl border border-line bg-surface-white shadow-erander-card";

const BTN =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_GREEN = `${BTN} bg-brand-green text-brand shadow-sm hover:brightness-95 active:scale-[0.98]`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse shadow-sm hover:opacity-90 active:scale-[0.98]`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:border-line-strong hover:bg-surface-muted hover:text-content`;
const BTN_DANGER = `${BTN} bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.98]`;
const BTN_DANGER_SOFT = `${BTN} border border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100`;

const EYEBROW = "text-[11px] font-extrabold uppercase tracking-[0.14em] text-content-subtle";

const CHIP_TONE = {
  success: "bg-brand-pale text-success-dark",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-surface-muted text-content-muted",
};

const sectionReveal = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, delay: 0.035 + i * 0.045, ease: EASE },
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const cn = (...classes) => classes.filter(Boolean).join(" ");

function formatMoney(value, currency = FALLBACK_CURRENCY) {
  const resolvedCurrency = currency || FALLBACK_CURRENCY;
  const amount = Number(value);
  if (value === null || value === undefined || value === "") return "—";
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency", currency: resolvedCurrency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${resolvedCurrency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

const normalizeStatus = (status) => String(status || "").toLowerCase().trim();

function getOfferStatus(status) {
  const normalized = normalizeStatus(status) || "pending";
  return STATUS_STYLES[normalized] || {
    label: normalized.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "neutral", icon: Info,
  };
}

function getErrandFromOffer(offer) {
  return offer?.errand || offer?.erand || offer?.errands || offer?.erands
    || offer?.request || offer?.errand_request || offer?.erand_request || {};
}

function firstString(candidates) {
  return candidates.find((v) => typeof v === "string" && v.trim().length > 0) || "";
}

const getOfferId = (offer) => firstString([offer?.id, offer?.offer_id, offer?.offerId]);

function getErrandId(offer) {
  const errand = getErrandFromOffer(offer);
  return firstString([
    offer?.erand_id, offer?.errand_id, offer?.request_id, offer?.errandId, offer?.erandId,
    errand?.id, errand?.erand_id, errand?.errand_id, errand?.request_id, errand?.errandId, errand?.erandId,
  ]);
}

const getErrandTitle = (offer) => {
  const errand = getErrandFromOffer(offer);
  return errand?.title || offer?.errand_title || offer?.erand_title || offer?.request_title || "Untitled errand";
};

const getErrandReference = (offer) => {
  const errand = getErrandFromOffer(offer);
  return errand?.reference_code || offer?.reference_code || offer?.errand_reference || offer?.erand_reference || "";
};

function getCurrency(offer, fallback = FALLBACK_CURRENCY) {
  const errand = getErrandFromOffer(offer);
  return (
    offer?.currency_code ||
    offer?.currency ||
    errand?.currency_code ||
    errand?.currency ||
    fallback ||
    FALLBACK_CURRENCY
  );
}

function getAmount(offer, field) {
  const value = offer?.[field];
  if (value === undefined || value === null || value === "") return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getItemCount(offer) {
  const items = offer?.items || offer?.offer_items || offer?.erand_offer_items || [];
  return Array.isArray(items) ? items.length : 0;
}

const getCreatedAt = (offer) => offer?.created_at || offer?.submitted_at || null;
const getOfferMessage = (offer) => offer?.offer_message || offer?.message || "";

function isErrandDeleted(offer) {
  const errand = getErrandFromOffer(offer);
  return Boolean(
    errand?.deleted_at || errand?.deletedAt || errand?.is_deleted === true || errand?.isDeleted === true
    || offer?.errand_deleted_at || offer?.erand_deleted_at
    || offer?.is_errand_deleted === true || offer?.is_erand_deleted === true
  );
}

function getErrandLifecycleStatus(offer) {
  const errand = getErrandFromOffer(offer);
  const status = normalizeStatus(errand?.status || offer?.errand_status || offer?.erand_status || offer?.request_status);
  if (ERRAND_STATUS_STYLES[status]) return status;
  const fundingStatus = normalizeStatus(errand?.funding_status || errand?.fundingStatus || offer?.funding_status || offer?.fundingStatus);
  if (["funded", "fully_funded"].includes(fundingStatus)) return "funded";
  if (["awaiting_funding", "unfunded", "not_funded"].includes(fundingStatus)) return "awaiting_funding";
  return "";
}

function normalizeOffersResponse(result) {
  const data = result?.data ?? result ?? {};
  let offers = [];
  if (Array.isArray(data)) offers = data;
  else if (Array.isArray(data.offers)) offers = data.offers;
  else if (Array.isArray(data.myOffers)) offers = data.myOffers;
  else if (Array.isArray(data.results)) offers = data.results;
  else if (Array.isArray(data.items)) offers = data.items;
  const pagination = data.pagination || {};
  const total = Number(pagination.total);
  const totalPages = Number(pagination.totalPages);
  return {
    offers,
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || PAGE_SIZE,
      total: Number.isFinite(total) && total >= 0 ? total : offers.length,
      totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 1,
      hasNextPage: typeof pagination.hasNextPage === "boolean" ? pagination.hasNextPage : false,
      hasPreviousPage: typeof pagination.hasPreviousPage === "boolean" ? pagination.hasPreviousPage : false,
    },
  };
}

const canWithdraw = (offer) => normalizeStatus(offer?.status) === "pending";

function acceptedMessage(lifecycle) {
  if (FUNDED_OR_LATER.includes(lifecycle)) return "The errand is funded or further along. Open the offer details to see the current stage and next steps.";
  if (lifecycle === "awaiting_funding") return "The errand is awaiting funding. Don't start work until the required funding and next steps are confirmed.";
  if (lifecycle) return "Review the current errand status and next steps in the offer details.";
  return "Open the offer details to check the errand's funding status and next steps.";
}

/* -------------------------------------------------------------------------- */
/*                              SKELETON PIECES                               */
/* -------------------------------------------------------------------------- */

function SkeletonBlock({ className = "", rounded = "rounded-lg" }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative overflow-hidden bg-surface-muted ${rounded} ${className}`} aria-hidden="true">
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)" }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

function SkeletonCircle({ className = "" }) {
  return <SkeletonBlock className={className} rounded="rounded-full" />;
}

function OfferSkeleton() {
  return (
    <div className={`${CARD} overflow-hidden`} aria-hidden="true">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <SkeletonCircle className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-5 w-24" rounded="rounded-lg" />
              </div>
              <SkeletonBlock className="h-5 w-3/4 max-w-sm" rounded="rounded-md" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
          </div>
          <SkeletonBlock className="h-9 w-9 shrink-0" rounded="rounded-xl" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SkeletonBlock className="h-6 w-32" rounded="rounded-lg" />
          <SkeletonBlock className="h-6 w-24" rounded="rounded-lg" />
        </div>
      </div>
      <div className="border-t border-line-soft px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-8 w-44" rounded="rounded-md" />
          </div>
          <SkeletonBlock className="h-7 w-28" rounded="rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-soft sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 bg-surface px-4 py-3">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line-soft bg-surface/60 px-5 py-4 sm:px-6">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-9 w-32" rounded="rounded-xl" />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading your offers">
      <span className="sr-only">Loading your offers…</span>

      <section className={`${CARD} p-5 sm:p-6`} aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock className="h-3 w-32" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-24" rounded="rounded-xl" />
            <SkeletonBlock className="h-10 w-32" rounded="rounded-xl" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <SkeletonBlock className="h-8 w-48 max-w-lg" rounded="rounded-lg" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
        </div>
        <div className="mt-6 grid grid-cols-2 border-t border-line pt-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "min-w-0 py-3 pr-3",
                i % 2 === 0 ? "pl-0" : "pl-3",
                i % 2 === 1 && "border-l border-line",
                i >= 2 && "border-t border-line",
                i > 0 && "sm:border-l sm:border-line sm:pl-5",
                i >= 2 && "sm:border-t-0"
              )}
            >
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-hidden="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBlock className="h-11 w-full sm:w-96" rounded="rounded-xl" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
        <div className="flex gap-2 border-b border-line pb-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="mb-3 h-4 w-20" />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-hidden="true">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40" rounded="rounded-md" />
            <SkeletonBlock className="h-3 w-64" />
          </div>
          <SkeletonBlock className="h-4 w-24" />
        </div>
        <OfferSkeleton />
        <OfferSkeleton />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                SMALL PIECES                                */
/* -------------------------------------------------------------------------- */

function Chip({ config, title }) {
  const Icon = config.icon;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-extrabold",
        CHIP_TONE[config.tone] || CHIP_TONE.neutral
      )}
    >
      <Icon size={12} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{config.label}</span>
    </span>
  );
}

function Notice({ tone = "danger", icon: Icon = Info, title, children }) {
  const styles = {
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-line bg-brand-pale text-brand",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    attention: "border-amber-200 bg-amber-50 text-amber-900",
  };
  const iconStyles = {
    danger: "text-rose-600",
    success: "text-success-dark",
    info: "text-blue-700",
    attention: "text-amber-700",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border p-4", styles[tone] || styles.info)}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", iconStyles[tone] || iconStyles.info)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-extrabold">{title}</p> : null}
        <div className={cn("text-sm leading-6 opacity-90", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, index = 0 }) {
  return (
    <div
      className={cn(
        "min-w-0 py-3 pr-3",
        index % 2 === 0 ? "pl-0" : "pl-3",
        index % 2 === 1 && "border-l border-line",
        index >= 2 && "border-t border-line",
        index > 0 && "sm:border-l sm:border-line sm:pl-5",
        index >= 2 && "sm:border-t-0"
      )}
    >
      <dt className="truncate text-xs font-semibold text-content-muted">{label}</dt>
      <dd className="mt-1 truncate text-base font-extrabold tabular-nums text-content">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                EMPTY STATE                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({ search, status, onReset, onBrowse }) {
  const filtered = Boolean(search || status !== "all");
  return (
    <div className={`${CARD} border-dashed border-line-strong px-6 py-14 text-center`}>
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-pale text-success-dark">
        <Send size={20} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-extrabold tracking-tight text-content">
        {filtered ? "No matching offers" : "Your offers will appear here"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-content-muted">
        {filtered
          ? "We couldn't find any offers matching your current filters. Try adjusting your search or status."
          : "When you submit an offer on an available errand, you can track its status, pricing and customer response here."}
      </p>
      {filtered ? (
        <button type="button" onClick={onReset} className={`${BTN_GHOST} mt-6`}>
          <X size={15} /> Clear filters
        </button>
      ) : (
        <button type="button" onClick={onBrowse} className={`${BTN_GREEN} mt-6`}>
          <Search size={15} /> Browse available errands
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                STATUS TABS                                 */
/* -------------------------------------------------------------------------- */

function StatusTabs({ value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Filter offers by status"
      className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {STATUS_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-4 py-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              active ? "text-content" : "text-content-muted hover:text-content"
            )}
          >
            {option.label}
            {active ? (
              <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                OFFER CARD                                  */
/* -------------------------------------------------------------------------- */

function OfferCard({
  offer, onOpen, onWithdraw, onReportIssue, onChatCustomer,
  onMarkCompleted, markCompletedEnabled, openingChat,
  fallbackCurrency = FALLBACK_CURRENCY,
}) {
  const offerId = getOfferId(offer);
  const errandId = getErrandId(offer);
  const title = getErrandTitle(offer);
  const reference = getErrandReference(offer);
  const currency = getCurrency(offer, fallbackCurrency);
  const status = normalizeStatus(offer.status);
  const itemTotal = getAmount(offer, "proposed_item_total");
  const serviceFee = getAmount(offer, "proposed_service_fee");
  const deliveryFee = getAmount(offer, "proposed_delivery_fee");
  const otherFees = getAmount(offer, "proposed_other_fees");
  const proposedTotal = offer?.proposed_total;
  const total =
    proposedTotal !== undefined && proposedTotal !== null && proposedTotal !== ""
      && Number.isFinite(Number(proposedTotal))
      ? Number(proposedTotal)
      : itemTotal + serviceFee + deliveryFee + otherFees;
  const category = getErrandFromOffer(offer)?.category || offer?.category || "";
  const itemCount = getItemCount(offer);
  const submittedAt = getCreatedAt(offer);
  const message = getOfferMessage(offer);
  const lifecycle = getErrandLifecycleStatus(offer);
  const deleted = isErrandDeleted(offer);
  const config = getOfferStatus(status);
  const CategoryIcon =
    category === "delivery" || category === "confidential" || category === "pickup"
      ? Truck
      : category === "business_support"
        ? BriefcaseBusiness
        : Package;
  const categoryLabel = CATEGORY_LABELS[category] || category.replaceAll("_", " ");

  // ── Controlled menu state ──────────────────────────────────
  // The menu is kept open during "Chat with customer" so the spinner is
  // visible; the wrapper closes it once `openChat` resolves.
  const [menuOpen, setMenuOpen] = useState(false);

  const handleChatSelect = useCallback(async () => {
    try {
      await onChatCustomer(offer);
    } finally {
      setMenuOpen(false);
    }
  }, [offer, onChatCustomer]);

  const menuItems = useMemo(() => {
    const items = [{ label: "View offer details", icon: FileText, onClick: () => onOpen(offer), disabled: !offerId }];
    if (!deleted) items.push({ label: "Report an issue", icon: Flag, onClick: () => onReportIssue(offer), disabled: !errandId });
    if (status === "accepted" && !deleted) {
      items.push({
        label: openingChat ? "Opening chat…" : "Chat with customer",
        icon: MessageSquare,
        onClick: handleChatSelect,
        loading: openingChat,
        disabled: openingChat || !errandId,
        closeOnSelect: false,  // keep menu open while the chat modal opens
      });
    }
    if (status === "accepted" && !deleted && COMPLETABLE_ERRAND_STATUSES.includes(lifecycle)) {
      items.push({
        label: "Mark as completed",
        icon: CheckCircle2,
        onClick: () => onMarkCompleted(offer),
        disabled: markCompletedEnabled === false || openingChat,
      });
    }
    return items;
  }, [
    deleted, status, lifecycle, offer, offerId, errandId, openingChat,
    onOpen, onReportIssue, handleChatSelect, onMarkCompleted, markCompletedEnabled,
  ]);

  const breakdown = [
    ["Items", itemTotal], ["Service fee", serviceFee],
    ["Delivery fee", deliveryFee], ["Other fees", otherFees],
  ];
  const hasNotices = deleted || status === "accepted" || Boolean(message) || (status === "pending" && !deleted);

  return (
    <li className="min-w-0">
      <article className={`${CARD} group overflow-hidden`}>
        <header className="p-5 pb-4 sm:p-6 sm:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-content-inverse">
                <CategoryIcon size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {reference ? (
                    <span className="whitespace-nowrap rounded-lg bg-brand-pale px-2 py-1 text-xs font-extrabold text-success-dark">
                      {reference}
                    </span>
                  ) : null}
                  {category ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-muted px-2 py-1 text-xs font-semibold capitalize text-content-muted">
                      <Tag size={10} aria-hidden="true" /> {categoryLabel}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1.5 break-words text-base font-extrabold leading-6 tracking-tight text-content sm:text-lg">
                  {title}
                </h3>
                {submittedAt ? (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-content-muted">
                    <CalendarDays size={13} className="shrink-0" aria-hidden="true" />
                    Submitted {formatDate(submittedAt, true)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="shrink-0">
              <ActionMenu
                open={menuOpen}
                onOpenChange={setMenuOpen}
                items={menuItems}
                align="top-right"
                placement="top"
                menuWidth={250}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip config={config} />
            {deleted ? (
              <Chip config={{ label: "Errand removed", tone: "danger", icon: XCircle }} />
            ) : status === "accepted" && lifecycle ? (
              <Chip config={ERRAND_STATUS_STYLES[lifecycle]} title="Current errand status" />
            ) : null}
          </div>
        </header>

        <div className="border-t border-line-soft px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-content-muted">
                <Wallet size={14} aria-hidden="true" /> Your proposed total
              </p>
              <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content">
                {formatMoney(total, currency)}
              </p>
            </div>
            {itemCount > 0 ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-semibold text-content-muted">
                <Package size={13} aria-hidden="true" />
                {itemCount} priced {itemCount === 1 ? "item" : "items"}
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-soft sm:grid-cols-4">
            {breakdown.map(([label, value]) => (
              <div key={label} className="min-w-0 bg-surface px-4 py-3">
                <dt className="truncate text-xs font-medium text-content-muted">{label}</dt>
                <dd className="mt-1 truncate text-sm font-extrabold tabular-nums text-content">
                  {formatMoney(value, currency)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {hasNotices ? (
          <div className="space-y-3 border-t border-line-soft px-5 py-5 sm:px-6">
            {deleted ? (
              <Notice tone="info" icon={Info} title="The customer removed this errand">
                {status === "pending"
                  ? "Your offer stays in your history, but the customer can no longer accept it. You can withdraw it if you don't want it listed."
                  : "This errand was removed from the customer's active errands. Your offer record and its history are preserved."}
              </Notice>
            ) : null}
            {status === "accepted" ? (
              <Notice tone="success" icon={ShieldCheck} title="Your offer was accepted">
                {acceptedMessage(lifecycle)}
              </Notice>
            ) : null}
            {status === "pending" && !deleted ? (
              <Notice tone="attention" icon={Clock3} title="Waiting for the customer">
                Keep your prices and availability in mind while you wait.
              </Notice>
            ) : null}
            {message ? (
              <figure className="rounded-xl border border-line bg-surface-muted/60 p-4">
                <figcaption className="text-sm font-extrabold text-content">
                  Your message to the customer
                </figcaption>
                <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-content-muted">
                  {message}
                </p>
              </figure>
            ) : null}
          </div>
        ) : null}

        <footer className="flex flex-col gap-3 border-t border-line-soft bg-surface/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => onOpen(offer)}
            disabled={!offerId}
            title={offerId ? "Open offer details and errand history" : "The API response does not contain an offer ID."}
            className="inline-flex items-center gap-2 self-start rounded-lg text-sm font-extrabold text-brand transition hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            View offer details
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          {canWithdraw(offer) ? (
            <button type="button" onClick={() => onWithdraw(offer)} className={BTN_DANGER_SOFT}>
              <X size={15} aria-hidden="true" /> Withdraw offer
            </button>
          ) : null}
        </footer>
      </article>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                               WITHDRAW MODAL                               */
/* -------------------------------------------------------------------------- */

function WithdrawModal({ offer, busy, onClose, onConfirm }) {
  const deleted = offer ? isErrandDeleted(offer) : false;
  return (
    <Modal
      isOpen={Boolean(offer)}
      onClose={onClose}
      dismissible={!busy}
      loading={busy}
      icon={XCircle}
      tone="danger"
      title="Withdraw this offer?"
      subtitle="Offer"
      size="sm"
      position="center"
      resizable={false}
      footer={
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={BTN_GHOST}>
            Keep offer
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={BTN_DANGER}>
            {busy ? (
              <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Withdrawing</>
            ) : (
              <><XCircle size={16} aria-hidden="true" /> Withdraw offer</>
            )}
          </button>
        </div>
      }
    >
      {offer ? (
        <div className="space-y-4 pb-1">
          <p className="text-sm leading-6 text-content-muted">
            You're about to withdraw your offer for{" "}
            <strong className="font-extrabold text-content">{getErrandTitle(offer)}</strong>. It
            will remain in your history, marked as withdrawn.
          </p>
          {deleted ? (
            <Notice tone="info" icon={Info} title="The customer already removed this errand">
              Your pending offer can no longer be accepted.
            </Notice>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function MyOffersPage({ onMarkCompleted }) {
  const navigate = useNavigate();
  const { openChat } = useChat();
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false,
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
  const [supportContext, setSupportContext] = useState(null);
  const [openingChatOfferId, setOpeningChatOfferId] = useState(null);

  /* Default currency comes from the authenticated user. Fallback to USD. */
  const defaultCurrency = user?.preferred_currency || FALLBACK_CURRENCY;

  useEffect(() => {
    const timeout = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadOffers = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    if (!silent) setError("");
    try {
      const filters = { page, limit: PAGE_SIZE };
      if (search) filters.search = search;
      if (statusFilter !== "all") filters.status = statusFilter;
      const result = await getMyErandOffers(filters);
      const normalized = normalizeOffersResponse(result);
      setOffers(normalized.offers);
      setPagination(normalized.pagination);
      setError("");
    } catch (requestError) {
      const message = requestError?.message || "We could not load your offers. Please try again.";
      setError(message);
      if (silent) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const multiplePages = pagination.totalPages > 1;

  const metrics = useMemo(() => {
    const count = (list) => offers.filter((o) => list.includes(normalizeStatus(o.status))).length;
    return {
      total: pagination.total,
      pending: count(["pending"]),
      accepted: count(["accepted"]),
      closed: count(["rejected", "withdrawn", "expired", "superseded"]),
    };
  }, [offers, pagination.total]);

  const handleWithdraw = async () => {
    if (!withdrawTarget || withdrawing) return;
    const offerId = getOfferId(withdrawTarget);
    if (!offerId) { toast.error("We could not identify this offer."); return; }
    setWithdrawing(true);
    try {
      await withdrawErandOffer(offerId);
      toast.success("Your offer has been withdrawn.");
      setWithdrawTarget(null);
      await loadOffers({ silent: true });
    } catch (requestError) {
      toast.error(requestError?.message || "We could not withdraw this offer. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleReportIssue = (offer) => {
    const errand = getErrandFromOffer(offer);
    const errandId = getErrandId(offer);
    setSupportContext({
      errandId,
      errand: Object.keys(errand).length
        ? errand
        : {
            id: errandId,
            title: getErrandTitle(offer),
            reference_code: getErrandReference(offer),
            status: getErrandLifecycleStatus(offer) || "unknown",
          },
    });
  };

  const handleChatCustomer = async (offer) => {
    const errandId = getErrandId(offer);
    const offerId = getOfferId(offer);
    if (!errandId) { toast.error("We couldn't identify the errand for this offer."); return; }
    const eranderId = user?.id;
    if (!eranderId) { toast.error("We couldn't identify your account. Please sign in again."); return; }
    if (typeof openChat !== "function") { toast.error("Chat is not available right now."); return; }
    if (openingChatOfferId === offerId) return;
    setOpeningChatOfferId(offerId);
    try { await openChat({ errandId, eranderId }); } finally { setOpeningChatOfferId(null); }
  };

  const handleMarkCompleted = async (offer) => {
    if (typeof onMarkCompleted === "function") {
      try {
        await onMarkCompleted(offer);
        toast.success("Your completion has been submitted for customer review.");
        await loadOffers({ silent: true });
      } catch (requestError) {
        toast.error(requestError?.message || "We could not submit completion. Please try again.");
      }
      return;
    }
    const offerId = getOfferId(offer);
    if (offerId) {
      toast.info("Open the offer details page to submit your completion for review.");
      navigate(`/dashboard/my-offers/${encodeURIComponent(offerId)}`);
    } else {
      toast.info("Completion submission is not connected on this page yet.");
    }
  };

  const handleResetFilters = () => {
    setSearchInput(""); setSearch(""); setStatusFilter("all"); setPage(1);
  };

  const goToOfferDetails = (offer) => {
    const offerId = getOfferId(offer);
    if (!offerId) {
      toast.error("We could not identify this offer. Please refresh your offers and try again.");
      return;
    }
    navigate(`/dashboard/my-offers/${encodeURIComponent(offerId)}`);
  };

  const goToAvailableErrands = () => navigate("/dashboard/available-errands");

  const hasFilters = Boolean(search || statusFilter !== "all");
  const showEmptyState = !loading && !error && offers.length === 0;
  const suffix = multiplePages ? " (this page)" : "";
  const stats = [
    { label: "Total offers", value: metrics.total },
    { label: `Awaiting response${suffix}`, value: metrics.pending },
    { label: `Accepted${suffix}`, value: metrics.accepted },
    { label: `Closed${suffix}`, value: metrics.closed },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <main className="mx-auto w-full max-w-[1440px] sm:px-6 lg:px-8 lg:py-8">
          <PageSkeleton />
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-[1440px] space-y-5 sm:px-6 lg:px-8 lg:py-8">
        <motion.header {...sectionReveal(0)} className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={EYEBROW}>Erander workspace</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadOffers({ silent: true })}
                disabled={refreshing}
                aria-busy={refreshing}
                aria-label="Refresh offers"
                className={BTN_GHOST}
              >
                {refreshing
                  ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  : <RefreshCw size={16} aria-hidden="true" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button type="button" onClick={goToAvailableErrands} className={BTN_GREEN}>
                <Search size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Find errands</span>
                <span className="sm:hidden">Browse</span>
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-brand sm:text-3xl">
              My offers 
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-content-muted">
              Keep track of the errands you've made offers on, monitor customer responses and manage your submissions.
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 border-t border-line pt-3 sm:grid-cols-4">
            {stats.map((stat, i) => (
              <Stat key={stat.label} {...stat} index={i} />
            ))}
          </dl>
        </motion.header>

        <motion.section {...sectionReveal(1)} aria-label="Search and filters">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-96">
              <label htmlFor="offer-search" className="sr-only">Search offers</label>
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-subtle"
                aria-hidden="true"
              />
              <input
                id="offer-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by errand title or reference…"
                className="min-h-11 w-full rounded-xl border border-line bg-surface-white pl-11 pr-11 text-sm text-content placeholder:text-content-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-content-subtle transition hover:bg-surface-muted hover:text-content"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-content-muted" aria-live="polite" aria-busy={refreshing}>
                {refreshing
                  ? "Updating your offers…"
                  : `${pagination.total} ${pagination.total === 1 ? "offer" : "offers"} found`}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-brand underline-offset-4 transition hover:text-success hover:underline"
                >
                  <X size={13} aria-hidden="true" /> Reset filters
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 border-b border-line">
            <StatusTabs
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
            />
          </div>
        </motion.section>

        <motion.section {...sectionReveal(2)} aria-label="Submitted offers">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-content">Your submissions</h2>
              <p className="mt-1 text-sm leading-6 text-content-muted">
                Review your proposed prices and each offer's progress.
              </p>
            </div>
            {!error && !showEmptyState && offers.length > 0 ? (
              <span className="text-sm text-content-muted">
                Showing {offers.length} of {pagination.total}
              </span>
            ) : null}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {error ? (
              <motion.div
                key="error"
                {...sectionReveal(0)}
                className="rounded-2xl border border-rose-200 bg-rose-50 p-6"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <Info size={18} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-rose-950">We couldn't load your offers</p>
                    <p className="mt-1 break-words text-sm leading-6 text-rose-800">{error}</p>
                    <button type="button" onClick={() => loadOffers()} className={`${BTN_GHOST} mt-4`}>
                      <RefreshCw size={15} aria-hidden="true" /> Try again
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : showEmptyState ? (
              <motion.div key="empty" {...sectionReveal(0)}>
                <EmptyState
                  search={search}
                  status={statusFilter}
                  onReset={handleResetFilters}
                  onBrowse={goToAvailableErrands}
                />
              </motion.div>
            ) : (
              <motion.div key="list" {...sectionReveal(0)}>
                <ul className="space-y-4">
                  {offers.map((offer, index) => {
                    const offerId = getOfferId(offer);
                    return (
                      <OfferCard
                        key={offerId || `${getErrandId(offer) || "errand"}-${getCreatedAt(offer) || index}`}
                        offer={offer}
                        onOpen={goToOfferDetails}
                        onWithdraw={setWithdrawTarget}
                        onReportIssue={handleReportIssue}
                        onChatCustomer={handleChatCustomer}
                        onMarkCompleted={handleMarkCompleted}
                        markCompletedEnabled={Boolean(onMarkCompleted)}
                        openingChat={Boolean(offerId) && openingChatOfferId === offerId}
                        fallbackCurrency={defaultCurrency}
                      />
                    );
                  })}
                </ul>
                {multiplePages ? (
                  <nav
                    aria-label="Offers pagination"
                    className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm text-content-muted">
                      Page <span className="font-bold text-content">{page}</span> of{" "}
                      <span className="font-bold text-content">{pagination.totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((c) => Math.max(1, c - 1))}
                        disabled={page <= 1}
                        className={BTN_GHOST}
                      >
                        <ArrowLeft size={14} aria-hidden="true" /> Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((c) => Math.min(pagination.totalPages, c + 1))}
                        disabled={page >= pagination.totalPages}
                        className={BTN_NAVY}
                      >
                        Next <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </nav>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.div {...sectionReveal(3)}>
          <Notice tone="success" icon={HandCoins} title="Keep your offers transparent">
            Make sure your item prices and fees reflect what you intend to charge. Changes to an
            errand's scope or cost should go through ERANDER's agreed workflow. Offers stay in your
            history even when a customer removes an errand.
          </Notice>
        </motion.div>
      </main>

      <WithdrawModal
        offer={withdrawTarget}
        busy={withdrawing}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={handleWithdraw}
      />
      <CreateSupportTicket
        open={Boolean(supportContext)}
        onClose={() => setSupportContext(null)}
        errand={supportContext?.errand}
        errandId={supportContext?.errandId}
      />
    </DashboardLayout>
  );
}