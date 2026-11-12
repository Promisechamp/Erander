import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  FileText,
  Hash,
  History,
  Info,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  MapPinned,
  Package,
  RefreshCw,
  Search,
  Send,
  Table2,
  Tag,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";

import StatusBadge from "./StatusBadge";
import { ErrandActivity, buildProposalItems, formatMoney } from "./ErrandTools";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

export const CURRENCY_FALLBACK = "USD";

const TAB_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };
const TAB_EXIT_TRANSITION = { duration: 0.1, ease: "easeIn" };
const INDICATOR_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.6,
};
const BAR_TRANSITION = { duration: 0.7, ease: [0.22, 1, 0.36, 1] };

const LOCATION_TYPE_LABELS = {
  residential: "Home / Residential",
  business: "Business / Office",
  public: "Public location",
  other: "Other",
};

const FUNDED_EVENTS = [
  "errand_funded",
  "funding_completed",
  "payment_confirmed",
  "funded",
];

/**
 * Every piece of role-specific wording lives here, so both pages share the
 * exact same components and only the words change.
 */
export const COPY = {
  customer: {
    personLabel: "Your erander",
    overviewDescription:
      "Where it happens, when it is due, and any instructions you left.",
    notesTitle: "Your instructions to the erander",
    locationModalDescription: "The full address you provided for this errand.",
    startingEstimate: "Your starting estimate",
    itemsTitle: "Items you requested",
    itemsDescription: "The items and estimated prices you provided.",
    estimateLabel: "Your estimate",
    estimateTotalLabel: "Total of your item estimates",
    itemNoteLabel: "Your note:",
    proposalTitle: "Accepted offer",
    proposalDescription:
      "The prices your erander proposed, which you accepted.",
    proposalTotalLabel: "Accepted offer total",
    proposalTotalDetail: "Total proposed by your erander",
    proposalNoteLabel: "Erander's note:",
    proposalMessageLabel: "Message from your erander",
    proposalMissingTitle: "No offer accepted yet",
    proposalMissingText:
      "Once you accept an offer, its prices and breakdown appear here.",
    priceTitle: "Agreed price",
    priceDescription: "The breakdown from the offer you accepted.",
    priceEmpty:
      "No erander has been accepted yet. Once you accept an offer, its price breakdown will appear here.",
    fundingDescription: "What you have paid in and what is still due.",
    fundedHeadline: "Funded by you",
    releaseDescription:
      "Once your erander finishes, they request the money. Follow that request here.",
    releaseEmptyTitle: "No release request yet",
    releaseEmptyText:
      "Your erander can request the release of funds once the errand is funded.",
    createdActivity: "You created this errand.",
    activityDescription: "Everything that has happened on this errand.",
    personEmptyTitle: "No erander assigned yet",
    personEmptyText: "Details appear here once you accept an offer.",
    personMissingTitle: "Erander details unavailable",
    personMissingText: "The accepted offer could not be matched to this errand.",
    supportDescription:
      "Contact support with a question about this errand or its payment.",
    releaseNotices: {
      pending: {
        className: "border-amber-400 bg-amber-50 text-amber-900",
        text: "Your erander has asked for the funds. The request is awaiting admin review and no transfer has been made yet.",
      },
      approved: {
        className: "border-blue-400 bg-blue-50 text-blue-900",
        text: "The request has been approved. Funds only count as released once the payment provider confirms the transfer.",
      },
      processing: {
        className: "border-indigo-400 bg-indigo-50 text-indigo-900",
        text: "The transfer is being processed. It will be marked as released after the provider confirms it.",
      },
      released: {
        className: "border-success bg-brand-pale text-success-dark",
        text: "The payment provider has confirmed the fund release.",
      },
    },
  },
  erander: {
    personLabel: "Customer",
    overviewDescription:
      "Where it happens, when it is due, and any instructions from the customer.",
    notesTitle: "Instructions from the customer",
    locationModalDescription:
      "The full address the customer provided for this errand.",
    startingEstimate: "Customer's starting estimate",
    itemsTitle: "Items requested",
    itemsDescription: "The items and estimated prices the customer provided.",
    estimateLabel: "Customer estimate",
    estimateTotalLabel: "Total of the customer's item estimates",
    itemNoteLabel: "Customer note:",
    proposalTitle: "Your offer",
    proposalDescription: "The offer you submitted for this errand.",
    proposalTotalLabel: "Your offer total",
    proposalTotalDetail: "Total you proposed",
    proposalNoteLabel: "Your note:",
    proposalMessageLabel: "Your message to the customer",
    proposalMissingTitle: "Your offer was not found",
    proposalMissingText:
      "This errand was retrieved, but no matching offer was found in your submitted offers.",
    priceTitle: "Your price",
    priceDescription: "The breakdown from the offer you submitted.",
    priceEmpty: "Your offer price breakdown is not available.",
    fundingDescription: "What the customer has paid in and what is still due.",
    fundedHeadline: "Funded by the customer",
    releaseDescription:
      "Ask for your money once the errand is done, then follow the request here.",
    releaseEmptyTitle: "Fund release is not available yet",
    releaseEmptyText:
      "You can request a fund release once the errand's status becomes funded.",
    createdActivity: "The customer created this errand.",
    activityDescription: "Everything that has happened on this errand.",
    personEmptyTitle: "Customer details unavailable",
    personEmptyText: "The customer's details were not returned for this errand.",
    personMissingTitle: "Customer details unavailable",
    personMissingText: "The customer's details were not returned for this errand.",
    supportDescription:
      "Contact support with a question about this errand or its payment.",
    releaseNotices: {
      pending: {
        className: "border-amber-400 bg-amber-50 text-amber-900",
        text: "Your request has been submitted and is awaiting admin review. No transfer has been confirmed yet.",
      },
      approved: {
        className: "border-blue-400 bg-blue-50 text-blue-900",
        text: "Your request has been approved. Funds only count as released once the payment provider confirms a successful transfer.",
      },
      processing: {
        className: "border-indigo-400 bg-indigo-50 text-indigo-900",
        text: "The transfer is being processed. Funds will be marked as released after the provider confirms it.",
      },
      released: {
        className: "border-success bg-brand-pale text-success-dark",
        text: "The payment provider has confirmed the fund release.",
      },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function unwrapErrandResponse(response) {
  return (
    response?.data?.errand ??
    response?.errand ??
    response?.data?.erand ??
    response?.erand ??
    null
  );
}

export function unwrapOffersResponse(response) {
  if (Array.isArray(response?.data?.offers)) return response.data.offers;
  if (Array.isArray(response?.offers)) return response.offers;
  return [];
}

export function unwrapFundingResponse(response) {
  if (!response || typeof response !== "object") return null;

  if ("agreedTotal" in response || "fundingStatus" in response) {
    return response;
  }

  return response?.data?.funding ?? null;
}

export const EMPTY_RELEASE = { request: null, events: [] };

export function unwrapReleaseResponse(response) {
  if (!response || typeof response !== "object") return EMPTY_RELEASE;

  return {
    request: response.request ?? response.data?.request ?? null,
    events: Array.isArray(response.events)
      ? response.events
      : Array.isArray(response.data?.events)
        ? response.data.events
        : [],
  };
}

/** Single money formatter shared with ErrandTools (cached, "—" when invalid). */
export const formatCurrency = formatMoney;

export function formatDateTime(value, fallback = "Not available") {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatLabel(value) {
  if (!value) return "Not specified";

  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getFullName(profile) {
  if (!profile) return "";

  const displayName =
    profile.erander_display_name ||
    profile.display_name ||
    profile.full_name ||
    profile.name;

  if (displayName && String(displayName).trim()) {
    return String(displayName).trim();
  }

  const firstName = profile.erander_first_name || profile.first_name || "";
  const lastName = profile.erander_last_name || profile.last_name || "";

  return `${firstName} ${lastName}`.trim();
}

export function getFundedPercent(funded, total) {
  const totalValue = Number(total);

  if (!(totalValue > 0)) return 0;

  return Math.min(100, Math.max(0, (Number(funded || 0) / totalValue) * 100));
}

export function getEventTimestamp(events, acceptedTypes) {
  const event = (events || []).find((item) =>
    acceptedTypes.includes(String(item.type || "").toLowerCase())
  );

  return event?.occurredAt ?? event?.occurred_at ?? null;
}

export function getProgressTimestamps(errand, release) {
  const request = release?.request ?? null;
  const events = release?.events ?? [];

  return {
    created: errand?.created_at ?? null,
    assigned: errand?.agreement_accepted_at ?? null,
    funded: getEventTimestamp(events, FUNDED_EVENTS),
    release_requested: request?.requestedAt ?? null,
    release_processing:
      request?.releaseInitiatedAt ??
      (request?.status === "processing" ? request?.updatedAt : null),
    funds_released: request?.releasedAt ?? null,
  };
}

/* ----------------------------- Location helpers ---------------------------- */

/** One source of truth for where an errand's location lives. */
export function getErrandLocation(errand) {
  return errand?.location_snapshot || errand?.location || null;
}

export function getLocationAddress(location) {
  if (typeof location === "string") return location.trim() || null;
  if (!location || typeof location !== "object") return null;

  const parts = [
    location.home_address ||
      location.street ||
      location.address ||
      location.formatted_address,
    location.city,
    location.state,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildLocationQuery(location) {
  if (!location) return "";
  if (typeof location === "string") return location;

  return [
    location.home_address ||
      location.street ||
      location.address ||
      location.formatted_address,
    location.city,
    location.state,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/* ------------------------------ Misc utilities ----------------------------- */

export async function copyToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    return true;
  } catch {
    return false;
  }
}

export async function copyErrandId(errand) {
  if (!errand?.id) return;

  const ok = await copyToClipboard(String(errand.id));

  if (ok) toast.success("Errand ID copied");
  else toast.error("Couldn't copy errand ID");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { buildProposalItems };

export function getActivityItems(errand, offer, release, role = "customer") {
  const copy = COPY[role];
  const activities = [];

  if (errand?.created_at) {
    activities.push({
      id: "errand-created",
      type: "created",
      title: "Errand created",
      description: copy.createdActivity,
      occurredAt: errand.created_at,
    });
  }

  if (role === "erander" && offer?.created_at) {
    activities.push({
      id: "offer-submitted",
      type: "offer_submitted",
      title: "Offer submitted",
      description: "You submitted an offer for this errand.",
      occurredAt: offer.created_at,
    });
  }

  if (errand?.agreement_accepted_at) {
    activities.push({
      id: "erander-assigned",
      type: "assigned",
      title: role === "erander" ? "Offer accepted" : "Erander assigned",
      description:
        role === "erander"
          ? "The customer accepted your offer."
          : offer
            ? `${getFullName(offer) || "An erander"} was selected for this errand.`
            : "An erander was assigned to this errand.",
      occurredAt: errand.agreement_accepted_at,
    });
  }

  const events = Array.isArray(release?.events) ? release.events : [];

  events.forEach((event) => {
    const occurredAt = event.occurredAt ?? event.occurred_at;

    if (!occurredAt) return;

    activities.push({
      id: event.id || `${event.type}-${occurredAt}`,
      type: event.type,
      title: formatLabel(event.type || "Errand update"),
      description: event.details?.message || event.details?.description || "",
      occurredAt,
    });
  });

  const request = release?.request;

  if (
    request?.requestedAt &&
    !activities.some(
      (activity) =>
        activity.type === "fund_release_requested" &&
        activity.occurredAt === request.requestedAt
    )
  ) {
    activities.push({
      id: "fund-release-requested",
      type: "fund_release_requested",
      title: "Fund release requested",
      description:
        role === "erander"
          ? "You requested the release of errand funds."
          : "The erander requested the release of errand funds.",
      occurredAt: request.requestedAt,
    });
  }

  if (request?.reviewedAt) {
    activities.push({
      id: "fund-release-reviewed",
      type: "fund_release_reviewed",
      title: "Fund release reviewed",
      description: "The fund-release request was reviewed.",
      occurredAt: request.reviewedAt,
    });
  }

  if (request?.releaseInitiatedAt) {
    activities.push({
      id: "fund-release-processing",
      type: "fund_release_processing",
      title: "Fund release processing",
      description: "The fund release was initiated.",
      occurredAt: request.releaseInitiatedAt,
    });
  }

  if (request?.releasedAt) {
    activities.push({
      id: "funds-released",
      type: "funds_released",
      title: "Funds released",
      description: "The errand funds were released.",
      occurredAt: request.releasedAt,
    });
  }

  const fundedAt = getEventTimestamp(events, FUNDED_EVENTS);

  if (fundedAt) {
    activities.push({
      id: "errand-funded",
      type: "funded",
      title: "Errand funded",
      description: "The errand funding was confirmed.",
      occurredAt: fundedAt,
    });
  }

  if (offer?.responded_at && !errand?.agreement_accepted_at) {
    activities.push({
      id: "offer-accepted",
      type: "offer_accepted",
      title: "Offer accepted",
      description:
        role === "erander"
          ? "The customer accepted your offer."
          : "You accepted an erander's offer.",
      occurredAt: offer.responded_at,
    });
  }

  return activities.sort(
    (first, second) =>
      new Date(first.occurredAt).getTime() -
      new Date(second.occurredAt).getTime()
  );
}

/* -------------------------------------------------------------------------- */
/*                               PAGE PRIMITIVES                              */
/* -------------------------------------------------------------------------- */

export function ErrandPage({ children }) {
  return (
    <DashboardLayout title="Errand">
      <main className="mx-auto w-full max-w-[1440px] space-y-6 px-0 py-0 sm:px-2 lg:py-8">
        {children}
      </main>
    </DashboardLayout>
  );
}



export function Section({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`py-7 first:pt-0 last:pb-0 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-extrabold tracking-tight text-content">
                {title}
              </h2>
            )}

            {description ? (
              <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
                {description}
              </p>
            ) : null}
          </div>

          {action}
        </div>
      )}

      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, className = "" }) {
  return (
    <div className={`rounded-2xl bg-surface px-4 py-3.5 ${className}`}>
      <p className="text-sm font-medium text-content-muted">{label}</p>

      <p className="mt-1 break-words text-xl font-extrabold tracking-tight tabular-nums text-content">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 text-xs leading-5 text-content-muted">{detail}</p>
      ) : null}
    </div>
  );
}

/** Right-aligned label/value row, used in sidebars and detail lists. */
export function DetailRow({ label, value, valueClassName = "" }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-sm text-content-muted">{label}</dt>

      <dd
        className={`min-w-0 max-w-[65%] break-words text-right text-sm font-semibold text-content ${valueClassName}`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** Icon + label with a left-aligned value, used in the errand details list. */
function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
      <dt className="flex items-center gap-2 text-sm font-medium text-content-muted">
        <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        {label}
      </dt>

      <dd className="min-w-0 text-sm font-semibold leading-6 text-content">
        {children}
      </dd>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-9 text-center">
      <Icon
        size={22}
        className="mx-auto text-content-subtle"
        aria-hidden="true"
      />

      <h3 className="mt-3 text-sm font-bold text-content">{title}</h3>

      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-content-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function ErrandLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading errand details</span>

      <div className="h-56 animate-pulse rounded-3xl bg-brand-navy/90" />
      <div className="h-44 animate-pulse rounded-3xl bg-surface-muted" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="hidden h-96 animate-pulse rounded-3xl bg-surface-muted xl:block" />
      </div>

      <p className="flex items-center justify-center gap-2 text-sm font-medium text-content-muted">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your errand
      </p>
    </div>
  );
}

export function ErrandError({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TAB_TRANSITION}
      role="alert"
      className="rounded-r-3xl border-l-4 border-red-500 bg-red-50 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-red-950">
            This errand could not be loaded
          </h2>

          <p className="mt-1 text-sm leading-6 text-red-800">
            {message || "Something went wrong while retrieving the errand."}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function PartialErrorNotice({ message }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="errand-error"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TAB_TRANSITION}
          role="alert"
          className="flex items-start gap-3 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />

          <p className="leading-6">
            {message} Some of the latest errand information may not be
            available.
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ViewModeToggle({ value, onChange }) {
  const options = [
    { value: "cards", label: "List", icon: LayoutGrid },
    { value: "table", label: "Table", icon: Table2 },
  ];

  return (
    <div
      className="inline-flex rounded-full border border-gray bg-surface-muted p-1"
      role="group"
      aria-label="Choose item display"
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
            value === optionValue
              ? "bg-surface-white text-content shadow-sm"
              : "text-content-muted hover:text-content"
          }`}
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Green call-to-action banner (fund the errand / request fund release). */
export function ActionBanner({
  icon: Icon = Clock3,
  title,
  description,
  actionLabel,
  busyLabel = "Submitting",
  busy = false,
  onAction,
  actionIcon: ActionIcon,
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={TAB_TRANSITION}
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl bg-brand-green px-5 py-4 text-brand-navy sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />

        <div className="min-w-0">
          <h2 className="font-extrabold">{title}</h2>
          <p className="mt-0.5 text-sm leading-6">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={busy}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-bold text-content-inverse shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-brand-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            {busyLabel}
          </>
        ) : (
          <>
            {ActionIcon ? (
              <ActionIcon className="h-4 w-4" aria-hidden="true" />
            ) : null}
            {actionLabel}
          </>
        )}
      </button>
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   HEADER                                   */
/* -------------------------------------------------------------------------- */

const HEADER_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:opacity-60";

/**
 * stats: [{ label, value (node), tone: "mint", progress: 0-100 }]
 * actions: extra header buttons (e.g. "Edit errand")
 */
export function ErrandHeader({
  errand,
  subtitle,
  stats = [],
  actions = null,
  onCopyId,
  onRefresh,
  refreshing = false,
  onRaiseTicket,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopyId?.();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <header className="overflow-hidden rounded-3xl bg-brand-navy text-content-inverse shadow-erander-card">
      <div className="px-5 pb-7 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
            {errand.reference_code ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white">
                Ref {errand.reference_code}

                {errand.id ? (
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy errand ID"
                    title="Copy errand ID"
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-white/70 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={copied ? "check" : "copy"}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.15 }}
                        className={`inline-flex ${
                          copied ? "text-brand-mint" : ""
                        }`}
                      >
                        {copied ? (
                          <Check size={10} aria-hidden="true" />
                        ) : (
                          <Copy size={10} aria-hidden="true" />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                ) : null}
              </span>
            ) : null}

            {errand.created_at ? (
              <span>Created {formatDateTime(errand.created_at)}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions}

            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className={HEADER_BUTTON}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
            ) : null}

            <button
              type="button"
              onClick={onRaiseTicket}
              className={HEADER_BUTTON}
            >
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Get help
            </button>
          </div>
        </div>

        <div className="mt-8 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {errand.title || "Errand details"}
            </h1>

            <span className="inline-flex rounded-full bg-white p-0.5">
              <StatusBadge status={errand.status} />
            </span>
          </div>

          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {stats.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 bg-brand-navy px-5 py-4 sm:px-8"
            >
              <dt className="text-sm text-white/70">{stat.label}</dt>

              <dd
                className={`mt-1 flex min-w-0 flex-wrap items-center gap-2 break-words text-base font-extrabold tabular-nums ${
                  stat.tone === "mint" ? "text-brand-mint" : ""
                }`}
              >
                {stat.value}
              </dd>

              {typeof stat.progress === "number" ? (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
                  aria-hidden="true"
                >
                  <motion.div
                    className="h-full rounded-full bg-brand-mint"
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.progress}%` }}
                    transition={BAR_TRANSITION}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*                                TABS + LAYOUT                               */
/* -------------------------------------------------------------------------- */

export function ErrandTabs({ tabs, value, onChange }) {
  const tablistRef = useRef(null);
  const tabBtnRefs = useRef({});

  useEffect(() => {
    const container = tablistRef.current;
    const activeBtn = tabBtnRefs.current[value];

    if (!container || !activeBtn) return;

    const targetLeft =
      activeBtn.offsetLeft -
      container.offsetWidth / 2 +
      activeBtn.offsetWidth / 2;

    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [value]);

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="Errand sections"
      className="relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            ref={(element) => {
              tabBtnRefs.current[tab.value] = element;
            }}
            type="button"
            role="tab"
            id={`errand-tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`errand-panel-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
              active ? "text-content" : "text-content-muted hover:text-content"
            }`}
          >
            {tab.label}

            {tab.count ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-colors ${
                  active
                    ? "bg-brand-navy text-content-inverse"
                    : "bg-surface-muted text-content-muted"
                }`}
              >
                {tab.count}
              </span>
            ) : null}

            {active ? (
              <motion.span
                layoutId="active-errand-detail-tab-underline"
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-navy"
                transition={INDICATOR_SPRING}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ErrandLayout({ tabs, tab, onTab, sidebar, children }) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="border-b border-line">
          <ErrandTabs tabs={tabs} value={tab} onChange={onTab} />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface-white shadow-erander-card">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              role="tabpanel"
              id={`errand-panel-${tab}`}
              aria-labelledby={`errand-tab-${tab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: TAB_EXIT_TRANSITION }}
              transition={TAB_TRANSITION}
              className="divide-y divide-line-soft px-5 py-7 sm:px-8 sm:py-9"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-6">{sidebar}</aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  LOCATION                                  */
/* -------------------------------------------------------------------------- */

function LocationDetailsModal({ open, onClose, location, role }) {
  if (!location) return null;

  const isObject = typeof location === "object";
  const fullQuery = buildLocationQuery(location);

  const mapsUrl = fullQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        fullQuery
      )}`
    : null;

  const rows = isObject
    ? [
        ["Label", location.label || "—"],
        [
          "Location type",
          LOCATION_TYPE_LABELS[location.location_type] ||
            (location.location_type
              ? formatLabel(location.location_type)
              : "—"),
        ],
        ["House address", location.home_address || "—"],
        ["Street", location.street || "—"],
        ["Landmark", location.landmark || "—"],
        ["City", location.city || "—"],
        ["State", location.state || "—"],
        ["Country", location.country || "—"],
      ]
    : [];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Errand location"
      description={COPY[role].locationModalDescription}
      size="md"
    >
      {isObject ? (
        <dl className="divide-y divide-line-soft border-y border-line-soft">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <dt className="text-sm text-content-muted">{label}</dt>

              <dd className="min-w-0 max-w-[70%] break-words text-right text-sm font-semibold text-content">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="whitespace-pre-line break-words text-sm leading-6 text-content">
          {location}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-5 py-3 text-sm font-bold text-content-muted transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        >
          Close
        </button>

        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Trace on Google Maps
          </a>
        ) : null}
      </div>
    </Modal>
  );
}

/** The one place the errand address is shown: text + "Full location" modal. */
export function LocationValue({ location, role }) {
  const [open, setOpen] = useState(false);

  const address = getLocationAddress(location);

  const hasLocation =
    Boolean(address) ||
    (location && typeof location === "object" && Object.keys(location).length > 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words">
          {address || "No location provided"}
        </span>

        {hasLocation ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-white px-2.5 py-1 text-xs font-bold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            <MapPinned size={12} aria-hidden="true" />
            Full location
          </button>
        ) : null}
      </div>

      <LocationDetailsModal
        open={open}
        onClose={() => setOpen(false)}
        location={location}
        role={role}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  OVERVIEW                                  */
/* -------------------------------------------------------------------------- */

export function OverviewSection({ errand, currency, role }) {
  const copy = COPY[role];

  const reference = errand.reference_code || errand.reference || errand.id;

  const hasEstimate =
    errand.estimated_total !== undefined &&
    errand.estimated_total !== null &&
    errand.estimated_total !== "";

  const details = [
    { icon: Hash, label: "Reference", value: reference || "Not available" },
    {
      icon: CalendarDays,
      label: "Scheduled for",
      value: formatDateTime(errand.scheduled_for, "Not scheduled"),
    },
    {
      icon: Clock3,
      label: "Created",
      value: formatDateTime(errand.created_at),
    },
  ];

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
        <div className="min-w-0">
          {errand.category ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-pale px-3 py-1 text-xs font-semibold text-brand-navy">
              <Tag size={12} aria-hidden="true" />
              {formatLabel(errand.category)}
            </span>
          ) : null}

          <h2 className="mt-3 break-words text-2xl font-extrabold leading-tight tracking-tight text-content sm:text-3xl">
            {errand.title || "Untitled errand"}
          </h2>

          <p className="mt-4 max-w-2xl whitespace-pre-line text-base leading-7 text-content-muted">
            {errand.description || "No description was added to this errand."}
          </p>
        </div>

        {hasEstimate ? (
          <div className="lg:text-right">
            <p className="text-sm font-semibold text-content-muted">
              {copy.startingEstimate}
            </p>

            <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content">
              {formatCurrency(errand.estimated_total, currency)}
            </p>
          </div>
        ) : null}
      </div>

      <dl className="mt-8 grid grid-cols-1 divide-y divide-line-soft border-y border-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {details.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="min-w-0 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0"
          >
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-content-muted">
              <Icon size={13} aria-hidden="true" />
              {label}
            </dt>

            <dd className="mt-1.5 break-words text-sm font-bold text-content">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function InformationSection({ errand, role }) {
  const copy = COPY[role];
  const location = getErrandLocation(errand);

  return (
    <Section title="Errand details" description={copy.overviewDescription}>
      <dl className="divide-y divide-line-soft border-y border-line-soft">
        <InfoRow icon={Tag} label="Category">
          {formatLabel(errand.category)}
        </InfoRow>

        <InfoRow icon={CalendarDays} label="Scheduled date">
          {formatDateTime(errand.scheduled_for, "Not scheduled")}
        </InfoRow>

        <InfoRow icon={MapPin} label="Errand location">
          <LocationValue location={location} role={role} />
        </InfoRow>

        <InfoRow icon={Clock3} label="Expires">
          {formatDateTime(errand.expires_at, "No expiry date")}
        </InfoRow>
      </dl>

      {errand.customer_notes ? (
        <figure className="mt-6 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50/70 py-4 pl-5 pr-4">
          <figcaption className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <FileText size={15} aria-hidden="true" />
            {copy.notesTitle}
          </figcaption>

          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900">
            {errand.customer_notes}
          </p>
        </figure>
      ) : null}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    ITEMS                                   */
/* -------------------------------------------------------------------------- */

function getItemRows(items = [], offerItems = []) {
  const offerById = new Map(
    offerItems.map((offerItem) => [String(offerItem.erand_item_id), offerItem])
  );

  return items.map((item, index) => {
    const offerItem = offerById.get(String(item.id));

    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.estimated_unit_price ?? 0);

    return {
      id: item.id ?? index,
      name: item.item_name || item.name || item.title || `Item ${index + 1}`,
      description: item.description || "",
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit: item.unit || "item",
      pricingType: item.pricing_type ? formatLabel(item.pricing_type) : "—",
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      total:
        (Number.isFinite(quantity) ? quantity : 1) *
        (Number.isFinite(unitPrice) ? unitPrice : 0),
      customerNotes: item.customer_notes || "",
      proposedQuantity: offerItem?.proposed_quantity ?? "",
      proposedUnitPrice: offerItem?.proposed_unit_price ?? "",
      offerNotes: offerItem?.notes || "",
    };
  });
}

export function ItemsSection({
  items = [],
  offerItems = [],
  currency,
  errand,
  role,
  estimatedTotal,
}) {
  const copy = COPY[role];

  const [viewMode, setViewMode] = useState("cards");
  const [exportOpen, setExportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const exportRef = useRef(null);

  const rows = useMemo(
    () => getItemRows(items, offerItems),
    [items, offerItems]
  );

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) =>
      [row.name, row.description, row.pricingType, row.customerNotes]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [rows, searchTerm]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setExportOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const fileBaseName = (
    errand?.reference_code ||
    errand?.title ||
    "errand-items"
  )
    .toString()
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const exportExcel = () => {
    const headers = [
      "Item",
      "Description",
      "Quantity",
      "Unit",
      "Pricing type",
      "Estimated unit price",
      "Estimated total",
      "Proposed quantity",
      "Proposed unit price",
      "Customer notes",
      "Erander notes",
    ];

    const dataRows = rows.map((row) => [
      row.name,
      row.description,
      row.quantity,
      row.unit,
      row.pricingType,
      row.unitPrice,
      row.total,
      row.proposedQuantity,
      row.proposedUnitPrice,
      row.customerNotes,
      row.offerNotes,
    ]);

    const xmlCell = (value) =>
      typeof value === "number" && Number.isFinite(value)
        ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${escapeHtml(value)}</Data></Cell>`;

    const worksheetRows = [
      `<Row>${headers
        .map(
          (header) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeHtml(
              header
            )}</Data></Cell>`
        )
        .join("")}</Row>`,
      ...dataRows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`),
    ].join("");

    const spreadsheet = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#14213D" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Errand Items">
  <Table>
   ${worksheetRows}
  </Table>
 </Worksheet>
</Workbook>`;

    downloadBlob(
      spreadsheet,
      "application/vnd.ms-excel;charset=utf-8",
      `${fileBaseName}-items.xls`
    );

    setExportOpen(false);
    toast.success("Your Excel spreadsheet has been exported.");
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      toast.error(
        "Your browser blocked the export window. Please allow pop-ups and try again."
      );
      setExportOpen(false);
      return;
    }

    const tableRows = rows
      .map(
        (row) => `
      <tr>
        <td>
          <strong>${escapeHtml(row.name)}</strong>
          ${
            row.description
              ? `<div class="muted">${escapeHtml(row.description)}</div>`
              : ""
          }
        </td>
        <td>${escapeHtml(row.quantity)} ${escapeHtml(row.unit)}</td>
        <td>${escapeHtml(row.pricingType)}</td>
        <td>${escapeHtml(formatCurrency(row.unitPrice, currency))}</td>
        <td class="amount">${escapeHtml(formatCurrency(row.total, currency))}</td>
      </tr>`
      )
      .join("");

    const printDocument = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Errand Items - ${escapeHtml(errand?.reference_code || "ERANDER")}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 40px; color: #14213d; background: #fff; font-family: Arial, sans-serif; font-size: 12px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 24px; border-bottom: 2px solid #14213d; }
      .brand { font-size: 23px; font-weight: 800; letter-spacing: -1px; }
      .brand span { color: #20cc88; }
      .eyebrow { margin-top: 8px; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
      h1 { margin: 28px 0 8px; font-size: 22px; letter-spacing: -0.5px; }
      .meta { color: #64748b; line-height: 1.8; }
      table { width: 100%; margin-top: 28px; border-collapse: collapse; }
      th { padding: 12px 10px; background: #14213d; color: #fff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
      td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; }
      tr:nth-child(even) td { background: #f8fafc; }
      .muted { margin-top: 4px; color: #64748b; font-size: 10px; }
      .amount { font-weight: 700; white-space: nowrap; }
      .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; }
      @media print { body { padding: 0; } tr { page-break-inside: avoid; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">ERAND<span>ER</span></div>
        <div class="eyebrow">Errand item statement</div>
      </div>
      <div class="meta" style="text-align:right">
        <strong>${escapeHtml(errand?.reference_code || "Errand")}</strong><br />
        Generated ${escapeHtml(formatDateTime(new Date()))}
      </div>
    </div>
    <h1>${escapeHtml(errand?.title || "Requested items")}</h1>
    <div class="meta">Currency: ${escapeHtml(currency)}<br />Total items: ${rows.length}</div>
    <table>
      <thead>
        <tr><th>Item</th><th>Quantity</th><th>Pricing</th><th>Unit price</th><th>Total</th></tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">ERANDER · Get things done.</div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(printDocument);
    printWindow.document.close();

    setExportOpen(false);
  };

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const itemsTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Section title={copy.itemsTitle} description={copy.itemsDescription}>
      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items listed"
          description="There are no individual items listed for this errand."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-content-muted">
              <span className="font-bold text-content">{rows.length}</span>{" "}
              {rows.length === 1 ? "item" : "items"},{" "}
              <span className="font-bold text-content">
                {totalQuantity.toLocaleString()}
              </span>{" "}
              in total quantity, priced in {currency}
            </p>
												
												
												 <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search items"
                  aria-label="Search items"
                  className="h-10 w-full rounded-full border border-line bg-surface-white pl-10 pr-9 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand-navy focus:ring-2 focus:ring-brand-pale sm:w-52"
                />

                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>


            <div className="flex flex-wrap items-center gap-2">
             
              <ViewModeToggle value={viewMode} onChange={setViewMode} />

              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen((previous) => !previous)}
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-navy px-4 text-xs font-semibold text-content-inverse shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2"
                >
                  <Download size={16} aria-hidden="true" />
                  Export
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`transition-transform ${
                      exportOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {exportOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface-white p-1.5 shadow-[0_16px_45px_rgba(9,20,38,0.14)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={exportExcel}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-brand-pale"
                    >
                      <FileSpreadsheet
                        size={18}
                        className="shrink-0 text-success"
                        aria-hidden="true"
                      />

                      <span>
                        <span className="block text-sm font-semibold text-content">
                          Excel spreadsheet
                        </span>
                        <span className="mt-0.5 block text-xs text-content-muted">
                          Item details as .xls
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={exportPdf}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-brand-pale"
                    >
                      <FileDown
                        size={18}
                        className="shrink-0 text-red-600"
                        aria-hidden="true"
                      />

                      <span>
                        <span className="block text-sm font-semibold text-content">
                          Save as PDF
                        </span>
                        <span className="mt-0.5 block text-xs text-content-muted">
                          Print-ready item statement
                        </span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching items"
              description="Try another search term."
            />
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-xs text-content-muted">
                    <th className="py-3 pr-4 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Quantity</th>
                    <th className="px-4 py-3 font-semibold">Pricing</th>
                    <th className="px-4 py-3 font-semibold">Unit price</th>
                    <th className="py-3 pl-4 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line-soft">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="max-w-[320px] py-4 pr-4">
                        <p className="text-sm font-semibold text-content">
                          {row.name}
                        </p>

                        {row.description ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-content-muted">
                            {row.description}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-content">
                        {row.quantity} {row.unit}
                      </td>

                      <td className="px-4 py-4 text-sm text-content-muted">
                        {row.pricingType}
                      </td>

                      <td className="px-4 py-4 text-sm font-medium tabular-nums text-content">
                        {formatCurrency(row.unitPrice, currency)}
                      </td>

                      <td className="py-4 pl-4 text-right text-sm font-bold tabular-nums text-content">
                        {formatCurrency(row.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft border-y border-line-soft">
              {filteredRows.map((row) => (
                <li key={row.id} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-content">
                        {row.name}
                      </h3>

                      {row.description ? (
                        <p className="mt-1 text-sm leading-6 text-content-muted">
                          {row.description}
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-base font-extrabold tabular-nums text-content">
                      {formatCurrency(row.total, currency)}
                    </p>
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-content-muted">Quantity</dt>
                      <dd className="font-semibold text-content">
                        {row.quantity} {row.unit}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-content-muted">Unit price</dt>
                      <dd className="font-semibold tabular-nums text-content">
                        {formatCurrency(row.unitPrice, currency)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-content-muted">Pricing</dt>
                      <dd className="font-semibold text-content">
                        {row.pricingType}
                      </dd>
                    </div>
                  </dl>

                  {row.customerNotes ? (
                    <p className="mt-3 border-l-2 border-line-strong pl-3 text-sm leading-6 text-content-muted">
                      <span className="font-semibold text-content">
                        {role === "customer" ? "Your note:" : "Customer note:"}
                      </span>{" "}
                      {row.customerNotes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <dl className="space-y-2 border-t border-line pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-sm text-content-muted">
                {copy.estimateTotalLabel}
              </dt>
              <dd className="text-lg font-extrabold tabular-nums text-content">
                {formatCurrency(itemsTotal, currency)}
              </dd>
            </div>

            {Number(estimatedTotal) > 0 ? (
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <dt className="text-sm text-content-muted">
                  Overall estimated budget
                </dt>
                <dd className="text-sm font-bold tabular-nums text-content">
                  {formatCurrency(estimatedTotal, currency)}
                </dd>
              </div>
            ) : null}

            <p className="pt-1 text-xs text-content-muted">
              Showing {filteredRows.length} of {rows.length}
            </p>
          </dl>
        </div>
      )}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  PROPOSAL                                  */
/* -------------------------------------------------------------------------- */

function DifferenceText({ difference, currency }) {
  if (difference === null || difference === undefined) {
    return <span className="text-xs font-semibold text-amber-700">Missing</span>;
  }

  return (
    <span
      className={`font-bold tabular-nums ${
        difference > 0
          ? "text-amber-700"
          : difference < 0
            ? "text-success"
            : "text-content-muted"
      }`}
    >
      {difference > 0 ? "+" : ""}
      {formatCurrency(difference, currency)}
    </span>
  );
}

function getProposalFigures(item) {
  const hasEstimate =
    item.estimated_unit_price !== null &&
    item.estimated_unit_price !== undefined;

  const estimated = hasEstimate
    ? Number(item.estimated_unit_price) * Number(item.quantity || 1)
    : null;

  const proposed =
    item.proposed_unit_price === null || item.proposed_unit_price === undefined
      ? null
      : Number(item.proposed_unit_price) * Number(item.proposed_quantity || 1);

  return {
    estimated,
    proposed,
    difference:
      estimated !== null && proposed !== null ? proposed - estimated : null,
  };
}

function ProposalItemsCards({ items, currency, role }) {
  const copy = COPY[role];

  return (
    <ul className="divide-y divide-line-soft border-y border-line-soft">
      {items.map((item, index) => {
        const { estimated, proposed, difference } = getProposalFigures(item);

        return (
          <li key={item.erand_item_id || item.id || index} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-content">
                  {item.item_name}
                </h3>

                {item.description ? (
                  <p className="mt-1 text-sm leading-6 text-content-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>

              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-content-muted">
                Quantity {item.proposed_quantity}
              </span>
            </div>

            {item.notes ? (
              <p className="mt-2 border-l-2 border-line-strong pl-3 text-sm leading-6 text-content-muted">
                <span className="font-semibold text-content">
                  {copy.proposalNoteLabel}
                </span>{" "}
                {item.notes}
              </p>
            ) : null}

            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-content-muted">
                  {copy.estimateLabel}
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-content-muted">
                  {formatCurrency(estimated, currency)}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-content-muted">Proposed</dt>
                <dd className="mt-0.5 font-bold tabular-nums text-content">
                  {formatCurrency(proposed, currency)}
                </dd>
              </div>

              <div className="text-right">
                <dt className="text-xs text-content-muted">Difference</dt>
                <dd className="mt-0.5">
                  <DifferenceText difference={difference} currency={currency} />
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function ProposalItemsTable({ items, currency, role }) {
  const copy = COPY[role];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-content-muted">
            <th className="py-2.5 pr-4 font-semibold">Item</th>
            <th className="px-3 py-2.5 text-right font-semibold">
              {copy.estimateLabel}
            </th>
            <th className="px-3 py-2.5 text-right font-semibold">Proposed</th>
            <th className="py-2.5 pl-4 text-right font-semibold">Difference</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line-soft">
          {items.map((item, index) => {
            const { estimated, proposed, difference } =
              getProposalFigures(item);

            return (
              <tr
                key={item.erand_item_id || item.id || index}
                className="align-top"
              >
                <td className="py-3.5 pr-4">
                  <p className="font-semibold text-content">{item.item_name}</p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    Quantity {item.proposed_quantity}
                  </p>

                  {item.description ? (
                    <p className="mt-1 max-w-xs text-xs leading-5 text-content-muted">
                      {item.description}
                    </p>
                  ) : null}

                  {item.notes ? (
                    <p className="mt-1 max-w-xs text-xs leading-5 text-content-muted">
                      {copy.proposalNoteLabel} {item.notes}
                    </p>
                  ) : null}
                </td>

                <td className="px-3 py-3.5 text-right tabular-nums text-content-muted">
                  {formatCurrency(estimated, currency)}
                </td>

                <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-content">
                  {formatCurrency(proposed, currency)}
                </td>

                <td className="py-3.5 pl-4 text-right">
                  <DifferenceText difference={difference} currency={currency} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The accepted offer (customer) or your submitted offer (erander). */
export function ProposalSection({
  offer,
  originalItems = [],
  originalItemEstimate = 0,
  currency,
  role,
}) {
  const copy = COPY[role];
  const [view, setView] = useState("cards");

  const proposedItems = useMemo(
    () => buildProposalItems(offer, originalItems),
    [offer, originalItems]
  );

  if (!offer) {
    return (
      <Section
        title={copy.proposalTitle}
        description={copy.proposalDescription}
      >
        <EmptyState
          icon={Info}
          title={copy.proposalMissingTitle}
          description={copy.proposalMissingText}
        />
      </Section>
    );
  }

  const isAccepted = String(offer.status || "").toLowerCase() === "accepted";

  return (
    <Section title={copy.proposalTitle} description={copy.proposalDescription}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-content-muted">Offer status</p>
            <div className="mt-1.5">
              <StatusBadge status={offer.status} />
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-content-muted">Submitted</p>
            <p className="mt-1 text-sm font-semibold text-content">
              {formatDateTime(offer.created_at)}
            </p>
          </div>
        </div>

        {role === "erander" && isAccepted ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-r-2xl border-l-4 border-success bg-brand-pale p-4"
          >
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0 text-success"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-bold text-brand-navy">
                The customer accepted your offer
              </h3>
              <p className="mt-1 text-sm leading-6 text-success-dark">
                You were selected for this errand.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label={copy.proposalTotalLabel}
            value={formatCurrency(offer.proposed_total, currency)}
            detail={copy.proposalTotalDetail}
          />

          <MetricCard
            label={copy.estimateTotalLabel}
            value={formatCurrency(originalItemEstimate, currency)}
            detail="Based on the items on the errand"
          />
        </div>

        {offer.offer_message ? (
          <figure className="border-l-4 border-brand-green bg-brand-pale/60 py-3 pl-5 pr-4">
            <figcaption className="text-sm font-bold text-brand-navy">
              {copy.proposalMessageLabel}
            </figcaption>

            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-content">
              {offer.offer_message}
            </p>
          </figure>
        ) : null}

        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold text-content">Proposed item prices</h3>
              <p className="mt-0.5 text-sm text-content-muted">
                {role === "customer"
                  ? "Your estimates next to the erander's offer."
                  : "The customer's estimates next to your offer."}
              </p>
            </div>

            <ViewModeToggle value={view} onChange={setView} />
          </div>

          {proposedItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No item breakdown"
              description="This offer did not include individual item prices."
            />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: TAB_EXIT_TRANSITION }}
                transition={{ duration: 0.15 }}
              >
                {view === "cards" ? (
                  <ProposalItemsCards
                    items={proposedItems}
                    currency={currency}
                    role={role}
                  />
                ) : (
                  <ProposalItemsTable
                    items={proposedItems}
                    currency={currency}
                    role={role}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {offer.expires_at ? (
          <dl className="border-y border-line-soft">
            <DetailRow
              label="Offer expires"
              value={formatDateTime(offer.expires_at)}
            />
          </dl>
        ) : null}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              FUNDING + RELEASE                             */
/* -------------------------------------------------------------------------- */

export function FundingSection({ funding, currency, role }) {
  const copy = COPY[role];

  return (
    <Section title="Funding" description={copy.fundingDescription}>
      {!funding ? (
        <EmptyState
          icon={Wallet}
          title="Funding information unavailable"
          description="The funding summary could not be retrieved."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Agreed amount"
              value={formatCurrency(funding.agreedTotal, currency)}
            />
            <MetricCard
              label="Amount funded"
              value={formatCurrency(funding.amountFunded, currency)}
            />
            <MetricCard
              label="Amount remaining"
              value={formatCurrency(funding.amountDue, currency)}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-content">
                {copy.fundedHeadline}
              </span>
              <span className="tabular-nums text-content-muted">
                {Math.round(
                  getFundedPercent(funding.amountFunded, funding.agreedTotal)
                )}
                %
              </span>
            </div>

            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-label="Funding progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                getFundedPercent(funding.amountFunded, funding.agreedTotal)
              )}
            >
              <motion.div
                className="h-full rounded-full bg-brand-green"
                initial={{ width: 0 }}
                animate={{
                  width: `${getFundedPercent(
                    funding.amountFunded,
                    funding.agreedTotal
                  )}%`,
                }}
                transition={BAR_TRANSITION}
              />
            </div>
          </div>

          <dl className="divide-y divide-line-soft border-y border-line-soft">
            <DetailRow
              label="Funding status"
              value={formatLabel(funding.fundingStatus)}
            />
          </dl>

          {funding.pendingPayment ? (
            <div className="rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <Clock3 size={16} aria-hidden="true" />
                A payment is waiting for confirmation
              </p>

              <dl className="mt-2 divide-y divide-amber-200/70">
                <DetailRow
                  label="Payment amount"
                  value={formatCurrency(
                    funding.pendingPayment.amount,
                    funding.pendingPayment.currency || currency
                  )}
                />
                <DetailRow
                  label="Payment reference"
                  value={funding.pendingPayment.reference}
                />
                <DetailRow
                  label="Payment status"
                  value={formatLabel(funding.pendingPayment.status)}
                />
                <DetailRow
                  label="Initiated"
                  value={formatDateTime(funding.pendingPayment.initiatedAt)}
                />
              </dl>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

export function FundReleaseSection({
  role,
  request,
  events = [],
  canRequest = false,
  submitting = false,
  loading = false,
  onRequest,
  onRefresh,
}) {
  const copy = COPY[role];
  const status = String(request?.status || "").toLowerCase();
  const notice = copy.releaseNotices[status];

  const steps = [
    { label: "Requested", date: request?.requestedAt },
    { label: "Reviewed", date: request?.reviewedAt },
    { label: "Processing started", date: request?.releaseInitiatedAt },
    { label: "Funds released", date: request?.releasedAt },
  ];

  return (
    <Section
      title="Release of funds"
      description={copy.releaseDescription}
      action={
        onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
            />
            Refresh status
          </button>
        ) : null
      }
    >
      {loading && !request ? (
        <div className="animate-pulse space-y-3">
          <div className="h-12 rounded-2xl bg-surface-muted" />
          <div className="h-20 rounded-2xl bg-surface-muted" />
        </div>
      ) : (
        <div className="space-y-6">
          {!request ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-surface p-4">
                <Info
                  size={19}
                  className="mt-0.5 shrink-0 text-content-muted"
                  aria-hidden="true"
                />

                <div>
                  <h3 className="text-sm font-bold text-content">
                    {role === "erander" && canRequest
                      ? "This errand is funded"
                      : copy.releaseEmptyTitle}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-content-muted">
                    {role === "erander" && canRequest
                      ? "You can now request the release of funds. The request is reviewed before any transfer starts."
                      : copy.releaseEmptyText}
                  </p>
                </div>
              </div>

              {role === "erander" && canRequest ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onRequest}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <RefreshCw
                        className="animate-spin"
                        size={17}
                        aria-hidden="true"
                      />
                      Submitting request
                    </>
                  ) : (
                    <>
                      <Send size={17} aria-hidden="true" />
                      Request fund release
                    </>
                  )}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-content-muted">
                  Request status
                </span>
                <StatusBadge status={request.status} />
              </div>

              <ol className="grid gap-4 sm:grid-cols-4">
                {steps.map((step) => {
                  const completed = Boolean(step.date);

                  return (
                    <li
                      key={step.label}
                      className={`border-t-4 pt-3 ${
                        completed ? "border-brand-green" : "border-line"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${
                          completed ? "text-content" : "text-content-muted"
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-content-muted">
                        {completed ? formatDateTime(step.date) : "Waiting"}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {request.providerReference && role === "erander" ? (
                <dl className="divide-y divide-line-soft border-y border-line-soft">
                  <DetailRow
                    label="Provider reference"
                    value={request.providerReference}
                  />
                </dl>
              ) : null}

              {request.decisionReason ? (
                <figure className="border-l-4 border-line-strong bg-surface py-3 pl-4 pr-3">
                  <figcaption className="text-sm font-bold text-content">
                    Review decision
                  </figcaption>
                  <p className="mt-1 text-sm leading-6 text-content">
                    {request.decisionReason}
                  </p>
                </figure>
              ) : null}

              {request.failureReason ? (
                <div
                  role="alert"
                  className="border-l-4 border-red-500 bg-red-50 py-3 pl-4 pr-3"
                >
                  <p className="text-sm font-bold text-red-800">
                    Release issue
                  </p>
                  <p className="mt-1 text-sm leading-6 text-red-800">
                    {request.failureReason}
                  </p>
                </div>
              ) : null}

              {notice ? (
                <p
                  role="status"
                  className={`rounded-r-2xl border-l-4 p-4 text-sm leading-6 ${notice.className}`}
                >
                  {notice.text}
                </p>
              ) : null}
            </>
          )}

          {events.length > 0 ? (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-content">
                <History
                  size={16}
                  className="text-content-muted"
                  aria-hidden="true"
                />
                Request activity
              </h3>

              <ol className="space-y-4 border-l-2 border-line pl-5">
                {events.map((event, index) => (
                  <li key={event.id || index} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface-white bg-brand-navy"
                    />

                    <p className="text-sm font-bold text-content">
                      {formatLabel(event.type)}
                    </p>

                    <p className="mt-0.5 text-xs text-content-muted">
                      {formatDateTime(event.occurredAt ?? event.occurred_at)}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

export function ActivitySection({ activity }) {
  if (activity.length > 0) {
    return <ErrandActivity activity={activity} />;
  }

  return (
    <Section
      title="Errand activity"
      description="Everything that has happened on this errand."
    >
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
        <CalendarClock
          className="h-5 w-5 shrink-0 text-content-subtle"
          aria-hidden="true"
        />

        <p className="text-sm leading-6 text-content-muted">
          No activity yet. Updates will appear here as the errand moves forward.
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   SIDEBAR                                  */
/* -------------------------------------------------------------------------- */

/**
 * person: { name, username, avatar, reference, profileTo } or null.
 * The same card shows "Your erander" (customer) or "Customer" (erander).
 */
export function PersonCard({ role, person, footer, missing = false }) {
  const copy = COPY[role];

  const initials = (person?.name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TAB_TRANSITION}
      className="rounded-3xl border border-line bg-surface-white p-5 shadow-erander-card sm:p-6"
    >
      {person?.name ? (
        <div className="flex items-center gap-4">
          {person.avatar ? (
            <img
              src={person.avatar}
              alt={person.name}
              className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-navy text-base font-extrabold text-brand-mint">
              {initials || <UserRound size={20} aria-hidden="true" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success-dark">
              <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden="true" />
              {copy.personLabel}
            </p>

            <h2 className="mt-0.5 break-words text-base font-extrabold tracking-tight text-content">
              {person.profileTo ? (
                <Link
                  to={person.profileTo}
                  className="underline decoration-line-strong underline-offset-4 transition hover:decoration-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                >
                  {person.name}
                </Link>
              ) : (
                person.name
              )}
            </h2>

            {person.username ? (
              <p className="text-xs font-medium text-content-muted">
                @{person.username}
              </p>
            ) : null}

            {person.reference ? (
              <p className="mt-0.5 text-xs text-content-subtle">
                Reference {person.reference}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted">
            <UserRound
              className="h-5 w-5 text-content-muted"
              aria-hidden="true"
            />
          </span>

          <div>
            <p className="text-sm font-semibold text-content">
              {missing ? copy.personMissingTitle : copy.personEmptyTitle}
            </p>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              {missing ? copy.personMissingText : copy.personEmptyText}
            </p>
          </div>
        </div>
      )}

      {footer ? (
        <p className="mt-4 border-t border-line-soft pt-3 text-xs text-content-muted">
          {footer}
        </p>
      ) : null}
    </motion.div>
  );
}

export function PriceCard({ role, offer, total, currency, funded, due }) {
  const copy = COPY[role];

  const rows = [
    { label: "Items", value: offer?.proposed_item_total },
    { label: "Service fee", value: offer?.proposed_service_fee },
    { label: "Delivery fee", value: offer?.proposed_delivery_fee },
    { label: "Other fees", value: offer?.proposed_other_fees },
  ];

  const showFunding = funded !== undefined || due !== undefined;
  const fundedPercent = getFundedPercent(
    funded,
    Number(funded || 0) + Number(due || 0)
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TAB_TRANSITION, delay: 0.04 }}
      aria-label={copy.priceTitle}
      className="rounded-3xl bg-surface p-5 sm:p-6"
    >
      <h2 className="text-lg font-extrabold tracking-tight text-content">
        {copy.priceTitle}
      </h2>
      <p className="mt-1 text-sm leading-6 text-content-muted">
        {copy.priceDescription}
      </p>

      {offer ? (
        <>
          <dl className="mt-4 divide-y divide-dashed divide-line-strong border-y border-dashed border-line-strong">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
              >
                <dt className="text-content-muted">{row.label}</dt>
                <dd className="font-semibold tabular-nums text-content">
                  {formatCurrency(row.value ?? 0, currency)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="font-bold text-content">Total</p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums text-content">
              {formatCurrency(total, currency)}
            </p>
          </div>

          {showFunding ? (
            <div className="mt-5 rounded-2xl bg-surface-white p-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-content">Paid so far</span>
                <span className="font-bold tabular-nums text-success-dark">
                  {formatCurrency(funded ?? 0, currency)}
                </span>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full rounded-full bg-brand-green"
                  initial={{ width: 0 }}
                  animate={{ width: `${fundedPercent}%` }}
                  transition={BAR_TRANSITION}
                />
              </div>

              <p className="mt-2 text-xs text-content-muted">
                {formatCurrency(due ?? 0, currency)} still to fund
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-content-muted">
          {copy.priceEmpty}
        </p>
      )}
    </motion.section>
  );
}

export function SupportCard({ role, onRaiseTicket }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TAB_TRANSITION, delay: 0.08 }}
      aria-label="Support"
      className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
    >
      <h2 className="font-extrabold text-content">Something not right?</h2>

      <p className="mt-1 text-sm leading-6 text-content-muted">
        {COPY[role].supportDescription}
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={onRaiseTicket}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-extrabold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          <LifeBuoy size={16} aria-hidden="true" />
          Raise a ticket
        </button>
      </div>
    </motion.section>
  );
}

export function InfoCard({ title, children }) {
  return (
    <section
      aria-label={title}
      className="rounded-3xl border-l-4 border-brand-green bg-brand-pale p-5 sm:p-6"
    >
      <h2 className="font-extrabold text-brand-navy">{title}</h2>

      <div className="mt-2 space-y-2 text-sm leading-6 text-success-dark">
        {children}
      </div>
    </section>
  );
}
