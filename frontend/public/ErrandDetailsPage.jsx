import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import FundErrandModal from "./FundErrandModal";

import {
  getErrandById,
  closeErrand,
} from "@/services/errands/errandsApi";

import {
  getErrandFundingSummary,
  initializePayment,
  verifyPayment,
  getFundReleaseRequest,
} from "@/services/payments/paymentsApi";

/* Optional — if this import fails, comment it out and the page
   will simply hide the offer breakdown instead of crashing. */
import { getOffersForErrand } from "@/services/offers/offersApi";

const PENDING_PAYMENT_KEY = "erander.pendingPayment";

const STATUS_META = {
  draft: {
    label: "Draft",
    description: "This errand has not been opened for offers yet.",
    className: "bg-slate-100 text-slate-700",
    icon: FileText,
  },
  open: {
    label: "Open for offers",
    description: "Your request is open and can receive offers from eranders.",
    className: "bg-emerald-50 text-emerald-700",
    icon: Activity,
  },
  offer_selected: {
    label: "Offer selected",
    description: "An offer has been selected. Follow the next steps to proceed.",
    className: "bg-sky-50 text-sky-700",
    icon: CheckCircle2,
  },
  awaiting_funding: {
    label: "Awaiting funding",
    description: "The request is waiting for its required funding.",
    className: "bg-amber-50 text-amber-800",
    icon: Wallet,
  },
  funded: {
    label: "Funded",
    description: "The required funding has been recorded for this errand.",
    className: "bg-blue-50 text-blue-700",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In progress",
    description: "Your erander is working on this request.",
    className: "bg-violet-50 text-violet-700",
    icon: Activity,
  },
  completion_submitted: {
    label: "Awaiting review",
    description: "Completion has been submitted and may require your review.",
    className: "bg-orange-50 text-orange-700",
    icon: Clock3,
  },
  completed: {
    label: "Completed",
    description: "This errand has been marked as completed.",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    description: "This errand request has been cancelled.",
    className: "bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  disputed: {
    label: "Under dispute",
    description: "This errand requires dispute resolution.",
    className: "bg-rose-50 text-rose-700",
    icon: AlertCircle,
  },
  expired: {
    label: "Expired",
    description: "This request has expired.",
    className: "bg-slate-100 text-slate-600",
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
};

const LIFECYCLE = [
  { key: "open", label: "Request opened" },
  { key: "offer_selected", label: "Offer selected" },
  { key: "awaiting_funding", label: "Awaiting funding" },
  { key: "funded", label: "Funded" },
  { key: "fund_release_requested", label: "Funds release requested" },
  { key: "fund_release_processing", label: "Funds release processing" },
  { key: "funds_released_to_erander", label: "Funds released to erander" },
  { key: "in_progress", label: "In progress" },
  { key: "completion_submitted", label: "Completion review" },
  { key: "completed", label: "Completed" },
];

const TERMINAL_STATUSES = ["cancelled", "expired", "disputed"];

const RELEASE_STATUSES = {
  pending: {
    label: "Release requested",
    description:
      "The erander has requested release. The request is awaiting processing or review.",
    className: "bg-amber-50 text-amber-800",
  },
  approved: {
    label: "Release approved",
    description:
      "The release request has been approved. This does not by itself confirm that funds have been transferred.",
    className: "bg-sky-50 text-sky-700",
  },
  processing: {
    label: "Release processing",
    description:
      "The release is being processed. Funds are not confirmed as released yet.",
    className: "bg-violet-50 text-violet-700",
  },
  released: {
    label: "Funds released to erander",
    description:
      "The backend has recorded the funds as released to the erander.",
    className: "bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Release rejected",
    description:
      "The release request was rejected. Review the recorded reason or contact support.",
    className: "bg-rose-50 text-rose-700",
  },
  failed: {
    label: "Release failed",
    description:
      "The release failed. Check the recorded failure reason or contact support.",
    className: "bg-rose-50 text-rose-700",
  },
  cancelled: {
    label: "Release cancelled",
    description: "The release request has been cancelled.",
    className: "bg-slate-100 text-slate-600",
  },
};

const ACTIVE_RELEASE_STATUSES = new Set([
  "pending",
  "approved",
  "processing",
  "released",
]);

/* =========================================================
   HELPERS
========================================================= */

function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label: String(status || "Unknown")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: "Check the current status of this errand.",
      className: "bg-slate-100 text-slate-600",
      icon: FileText,
    }
  );
}

function getErrandFromResponse(response) {
  const candidates = [
    response?.data?.errand,
    response?.data?.erand,
    response?.data?.request,
    response?.errand,
    response?.erand,
    response?.data,
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate) &&
        (candidate.id || candidate.erand_id || candidate.title),
    ) || null
  );
}

function unwrapResponse(response) {
  let result = response;

  for (let index = 0; index < 3; index += 1) {
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      Object.prototype.hasOwnProperty.call(result, "data")
    ) {
      result = result.data;
    } else {
      break;
    }
  }

  return result;
}

function getReleaseData(response) {
  const result = unwrapResponse(response);

  if (!result || typeof result !== "object") {
    return { request: null, events: [] };
  }

  if (Array.isArray(result)) {
    return { request: result[0] ?? null, events: [] };
  }

  const request =
    result.request ||
    result.fundReleaseRequest ||
    result.releaseRequest ||
    null;

  return {
    request: request && typeof request === "object" ? request : null,
    events: Array.isArray(result.events) ? result.events : [],
  };
}

function formatCurrency(value, currency = "NGN") {
  if (value === null || value === undefined || value === "") {
    return "Not specified";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not specified";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: String(currency).trim() || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    includeTime
      ? {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      : {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
  ).format(date);
}

function formatCategory(category) {
  return (
    CATEGORY_LABELS[category] ||
    category
      ?.replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    "General errand"
  );
}

function getReference(errand) {
  return errand?.reference_code || errand?.reference || "Pending";
}

function getOffersCount(errand) {
  const possibleCounts = [
    errand?.offers_count,
    errand?.offer_count,
    errand?.offersCount,
    errand?._count?.offers,
  ];

  const count = possibleCounts.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(Number(value)),
  );

  return count === undefined ? null : Math.max(0, Number(count));
}

function getItems(errand) {
  const possibleItems = [
    errand?.items,
    errand?.erand_items,
    errand?.data?.items,
  ];

  return possibleItems.find(Array.isArray) || [];
}

/* -------------------------------------------------------
   ACCEPTED OFFER DERIVATION
   The errand response may nest the accepted offer under
   different names depending on the backend. Try them all.
------------------------------------------------------- */

function getAcceptedOffer(errand) {
  if (!errand || typeof errand !== "object") return null;

  const candidates = [
    errand.accepted_offer,
    errand.acceptedOffer,
    errand.accepted_offer_details,
    errand.acceptedOfferDetails,
    errand.accepted_offer_object,
    errand.selected_offer,
    errand.selectedOffer,
    errand.offer,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }

  /* Some backends return an array of offers with the accepted flag. */
  if (Array.isArray(errand.offers)) {
    const acceptedOffer = errand.offers.find(
      (entry) =>
        entry &&
        (entry.status === "accepted" ||
          entry.id === errand.accepted_offer_id),
    );

    if (acceptedOffer) return acceptedOffer;
  }

  return null;
}

/* -------------------------------------------------------
   ADDRESS HELPERS
------------------------------------------------------- */

function parseMaybeJSON(value) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatAddressObject(address) {
  if (!address || typeof address !== "object") return "";

  return [
    address.home_address,
    address.street,
    address.city,
    address.state,
    address.country,
  ]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(", ");
}

function getErrandAddress(errand) {
  if (!errand || typeof errand !== "object") {
    return { label: "", text: "" };
  }

  const candidates = [
    errand.location_snapshot,
    errand.locationSnapshot,
    errand.destination,
    errand.address,
    errand.location,
    errand.errand_address,
    errand.pickup_address,
    errand.delivery_address,
    errand.delivery_location,
    errand.address_details,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const parsed = parseMaybeJSON(candidate);

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;

        const text = formatAddressObject(entry);

        if (text) {
          return {
            label: entry.label ? String(entry.label) : "",
            text,
          };
        }
      }

      continue;
    }

    if (parsed && typeof parsed === "object") {
      const nestedAddress =
        parsed.address ||
        parsed.location_snapshot ||
        parsed.locationSnapshot ||
        parsed.destination;

      if (nestedAddress && nestedAddress !== parsed) {
        const nestedResult = getErrandAddress({
          location_snapshot: nestedAddress,
        });

        if (nestedResult.text) {
          return {
            label: parsed.label || nestedResult.label || "",
            text: nestedResult.text,
          };
        }
      }

      const text = formatAddressObject(parsed);

      if (text) {
        return {
          label: parsed.label ? String(parsed.label) : "",
          text,
        };
      }
    }

    if (typeof parsed === "string" && parsed.trim()) {
      return { label: "", text: parsed.trim() };
    }
  }

  const flatText = [
    errand.home_address,
    errand.street,
    errand.city,
    errand.state,
    errand.country,
  ]
    .filter(
      (part) =>
        part !== null && part !== undefined && String(part).trim() !== "",
    )
    .map((part) => String(part).trim())
    .join(", ");

  return {
    label: errand.address_label ? String(errand.address_label) : "",
    text: flatText,
  };
}

/* -------------------------------------------------------
   ITEM HELPERS
------------------------------------------------------- */

function getItemQuantity(item) {
  const quantity = Number(item?.quantity);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function getItemSubtotal(item) {
  if (
    item?.estimated_unit_price === null ||
    item?.estimated_unit_price === undefined ||
    item?.estimated_unit_price === ""
  ) {
    return null;
  }

  const quantity = getItemQuantity(item);
  const price = Number(item.estimated_unit_price);

  return Number.isFinite(price) && price >= 0
    ? quantity * price
    : null;
}

/* -------------------------------------------------------
   PENDING PAYMENT HELPERS
------------------------------------------------------- */

function readPendingPayment() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_KEY);

    if (!raw) return null;

    const payment = JSON.parse(raw);

    if (
      !payment ||
      typeof payment.paymentId !== "string" ||
      !payment.paymentId.trim() ||
      typeof payment.reference !== "string" ||
      !payment.reference.trim()
    ) {
      return null;
    }

    return payment;
  } catch {
    return null;
  }
}

function savePendingPayment(payment) {
  try {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify(payment),
    );
  } catch {
    /* noop */
  }
}

function clearPendingPayment() {
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    /* noop */
  }
}

/* =========================================================
   SHARED UI PRIMITIVES
========================================================= */

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf3] text-[#15803d]">
        <Icon size={19} />
      </div>

      <div>
        <h2 className="font-extrabold text-[#14213d]">{title}</h2>

        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 py-3">
      {Icon && (
        <Icon size={17} className="mt-0.5 shrink-0 text-slate-400" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>

        <p className="mt-1 break-words text-sm font-bold text-[#14213d]">
          {value || "Not specified"}
        </p>
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`}
    />
  );
}

function SectionSkeleton({ rows = 3 }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />

        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-40 max-w-full" />
          <SkeletonBlock className="h-3 w-64 max-w-full" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
          >
            <SkeletonBlock className="h-3 w-28 max-w-[45%]" />
            <SkeletonBlock className="h-4 w-32 max-w-[45%]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading errand details"
      aria-live="polite"
      className="space-y-6"
    >
      <SkeletonBlock className="h-4 w-36" />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-32 rounded-full" />
              <SkeletonBlock className="h-7 w-28 rounded-full" />
            </div>

            <SkeletonBlock className="h-8 w-3/4 max-w-lg" />
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="h-4 w-2/3 max-w-md" />

            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-11/12" />
              <SkeletonBlock className="h-3 w-2/3" />
            </div>
          </div>

          <div className="w-full rounded-2xl bg-[#14213d] p-5 lg:w-60">
            <SkeletonBlock className="h-4 w-32 bg-white/20" />
            <SkeletonBlock className="mt-4 h-8 w-40 max-w-full bg-white/20" />
            <SkeletonBlock className="mt-3 h-3 w-full bg-white/20" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={4} />
        </div>

        <aside className="space-y-6">
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={3} />
        </aside>
      </div>

      <span className="sr-only">
        Please wait while we retrieve your request.
      </span>
    </div>
  );
}

function ErrorState({ message, onRetry, onBack }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertCircle size={27} />
      </div>

      <h2 className="mt-5 text-xl font-extrabold text-[#14213d]">
        Unable to load this errand
      </h2>

      <p className="mt-2 break-words text-sm leading-6 text-slate-500">
        {message}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-[#14213d] hover:bg-slate-50"
        >
          Back to My Errands
        </button>

        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 py-3 text-sm font-bold text-white hover:bg-[#20365b]"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   LIFECYCLE TIMESTAMPS
========================================================= */

function getTimestamp(object, keys) {
  for (const key of keys) {
    const value = object?.[key];

    if (value) {
      const formatted = formatDate(value, true);

      if (formatted) return formatted;
    }
  }

  return null;
}

function getLifecycleTimestamp(errand, releaseRequest, events, key) {
  const eventTypes = {
    fund_release_requested: ["fund_release_requested"],
    fund_release_processing: ["fund_release_processing"],
    funds_released_to_erander: ["funds_released_to_erander"],
  };

  const matchingTypes = eventTypes[key] || [];

  const event = events.find((entry) =>
    matchingTypes.includes(entry?.type),
  );

  if (event) {
    return getTimestamp(event, ["occurredAt", "occurred_at", "createdAt"]);
  }

  if (key === "fund_release_requested") {
    return getTimestamp(releaseRequest, ["requestedAt", "requested_at"]);
  }

  if (key === "fund_release_processing") {
    return getTimestamp(releaseRequest, [
      "releaseInitiatedAt",
      "release_initiated_at",
    ]);
  }

  if (key === "funds_released_to_erander") {
    return getTimestamp(releaseRequest, ["releasedAt", "released_at"]);
  }

  const aliases = {
    open: ["opened_at", "openedAt", "created_at", "createdAt"],
    offer_selected: [
      "offer_selected_at",
      "offerSelectedAt",
      "agreement_accepted_at",
      "agreementAcceptedAt",
    ],
    awaiting_funding: [
      "awaiting_funding_at",
      "awaitingFundingAt",
      "agreement_accepted_at",
      "agreementAcceptedAt",
    ],
    funded: [
      "funded_at",
      "fundedAt",
      "agreement_locked_at",
      "agreementLockedAt",
    ],
    in_progress: ["in_progress_at", "inProgressAt"],
    completion_submitted: [
      "completion_submitted_at",
      "completionSubmittedAt",
    ],
    completed: ["completed_at", "completedAt"],
  };

  return getTimestamp(errand, aliases[key] || []);
}

function getLifecycleState(step, status, releaseRequest) {
  const releaseStatus = releaseRequest?.status;
  const hasReleaseProgress =
    Boolean(releaseRequest?.requestedAt || releaseRequest?.requested_at) ||
    Boolean(releaseStatus);
  const released =
    releaseStatus === "released" ||
    Boolean(releaseRequest?.releasedAt || releaseRequest?.released_at);

  const index = LIFECYCLE.findIndex((item) => item.key === step.key);
  const currentIndex = LIFECYCLE.findIndex((item) => item.key === status);

  let currentKey = null;

  if (
    releaseStatus &&
    ["pending", "approved", "rejected", "failed", "cancelled"].includes(
      releaseStatus,
    )
  ) {
    currentKey = "fund_release_requested";
  } else if (releaseStatus === "processing") {
    currentKey = "fund_release_processing";
  } else if (releaseStatus === "released" && status === "funded") {
    currentKey = "funds_released_to_erander";
  } else if (status === "in_progress") {
    currentKey = "in_progress";
  } else if (status === "completion_submitted") {
    currentKey = "completion_submitted";
  } else if (status === "funded") {
    currentKey = "funded";
  } else if (status === "awaiting_funding") {
    currentKey = "awaiting_funding";
  } else if (status === "offer_selected") {
    currentKey = "offer_selected";
  } else if (status === "open") {
    currentKey = "open";
  }

  const isCurrent = step.key === currentKey;

  switch (step.key) {
    case "fund_release_requested":
      return { reached: hasReleaseProgress, current: isCurrent };

    case "fund_release_processing":
      return {
        reached:
          releaseStatus === "processing" ||
          releaseStatus === "released" ||
          Boolean(
            releaseRequest?.releaseInitiatedAt ||
              releaseRequest?.release_initiated_at,
          ),
        current: isCurrent,
      };

    case "funds_released_to_erander":
      return { reached: released, current: isCurrent };

    case "in_progress": {
      const inProgress =
        status === "in_progress" ||
        status === "completion_submitted" ||
        status === "completed";
      return {
        reached: inProgress,
        current: isCurrent,
        blockedByRelease: inProgress && !released,
      };
    }

    case "completion_submitted":
      return {
        reached:
          status === "completion_submitted" || status === "completed",
        current: isCurrent,
      };

    case "completed":
      return { reached: status === "completed", current: isCurrent };

    case "funded":
      return {
        reached:
          status === "funded" ||
          ["in_progress", "completion_submitted", "completed"].includes(
            status,
          ) ||
          released,
        current: isCurrent,
      };

    default:
      if (currentIndex < 0) {
        return { reached: false, current: false };
      }
      return {
        reached: index <= currentIndex,
        current: isCurrent,
      };
  }
}

/* =========================================================
   ERRAND PROGRESS PANEL
========================================================= */

function ErrandProgress({
  errand,
  status,
  pendingPayment,
  verifyingPayment,
  onVerifyPayment,
  releaseRequest,
  releaseEvents,
  releaseLoading,
  releaseError,
  onRefreshRelease,
}) {
  if (TERMINAL_STATUSES.includes(status)) {
    const meta = getStatusMeta(status);
    const Icon = meta.icon;

    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Icon size={19} className="mt-0.5 text-slate-500" />

        <div>
          <p className="text-sm font-bold text-[#14213d]">{meta.label}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {meta.description}
          </p>
        </div>
      </div>
    );
  }

  const releaseStatus = releaseRequest?.status;
  const releaseMeta = releaseStatus
    ? RELEASE_STATUSES[releaseStatus] || {
        label: String(releaseStatus)
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: "The server has returned a release status.",
        className: "bg-slate-100 text-slate-700",
      }
    : null;

  const releaseRequestedAt = releaseRequest
    ? getTimestamp(releaseRequest, ["requestedAt", "requested_at"])
    : null;
  const releaseInitiatedAt = releaseRequest
    ? getTimestamp(releaseRequest, [
        "releaseInitiatedAt",
        "release_initiated_at",
      ])
    : null;
  const releaseReleasedAt = releaseRequest
    ? getTimestamp(releaseRequest, ["releasedAt", "released_at"])
    : null;

  return (
    <div className="mt-6">
      <div className="space-y-0">
        {LIFECYCLE.map((step, index) => {
          const state = getLifecycleState(step, status, releaseRequest);
          const timestamp = getLifecycleTimestamp(
            errand,
            releaseRequest,
            releaseEvents,
            step.key,
          );

          return (
            <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {index < LIFECYCLE.length - 1 && (
                <div
                  className={`absolute left-[13px] top-7 h-[calc(100%-8px)] w-px ${
                    state.reached ? "bg-[#20cc88]" : "bg-slate-200"
                  }`}
                />
              )}

              <div
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  state.reached
                    ? "border-[#20cc88] bg-[#20cc88] text-[#091426]"
                    : state.current
                      ? "border-[#20cc88] bg-[#e9fbf3] text-[#15803d]"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {state.reached ? (
                  <Check size={14} />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <p
                  className={`text-sm font-bold ${
                    state.reached || state.current
                      ? "text-[#14213d]"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}

                  {state.current && (
                    <span className="ml-2 rounded-full bg-[#e9fbf3] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#15803d]">
                      Current
                    </span>
                  )}
                </p>

                {timestamp && (
                  <p className="mt-1 text-xs text-slate-500">
                    {timestamp}
                  </p>
                )}

                {step.key === "open" && !timestamp && (
                  <p className="mt-1 text-xs text-slate-400">
                    Opening timestamp unavailable.
                  </p>
                )}

                {step.key === "awaiting_funding" &&
                  state.current &&
                  pendingPayment && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs leading-5 text-amber-900">
                        An existing payment of{" "}
                        <strong>
                          {formatCurrency(
                            pendingPayment.amount,
                            pendingPayment.currency || "NGN",
                          )}
                        </strong>{" "}
                        is awaiting confirmation. Verify it without creating
                        another payment.
                      </p>

                      <button
                        type="button"
                        onClick={onVerifyPayment}
                        disabled={verifyingPayment}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[#14213d] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#20365b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {verifyingPayment ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <RefreshCw size={15} />
                        )}

                        {verifyingPayment
                          ? "Verifying payment..."
                          : "Verify existing payment"}
                      </button>
                    </div>
                  )}

                {step.key === "in_progress" && state.blockedByRelease && (
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    The errand status indicates work has started, but the
                    release endpoint has not confirmed a successful release.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#15803d]">
              <Wallet size={18} />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-[#14213d]">
                Fund release status
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                This information comes from the fund-release endpoint.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefreshRelease}
            disabled={releaseLoading}
            aria-label="Refresh fund release status"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#14213d] hover:bg-slate-100 disabled:opacity-60"
          >
            {releaseLoading ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
        </div>

        {releaseLoading && !releaseRequest && (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <LoaderCircle size={14} className="animate-spin" />
            Loading release status...
          </p>
        )}

        {releaseError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs leading-5 text-amber-900">
              {releaseError}
            </p>
          </div>
        )}

        {!releaseLoading && !releaseError && !releaseRequest && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-bold text-[#14213d]">
              No release request recorded
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              The erander has not requested the release of funds for this
              errand yet.
            </p>
          </div>
        )}

        {releaseRequest && releaseMeta && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${releaseMeta.className}`}
            >
              {releaseMeta.label}
            </span>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {releaseMeta.description}
            </p>

            <div className="mt-3 divide-y divide-slate-100">
              {releaseRequestedAt && (
                <DetailRow
                  label="Requested at"
                  value={releaseRequestedAt}
                  icon={Clock3}
                />
              )}

              {releaseInitiatedAt && (
                <DetailRow
                  label="Release initiated at"
                  value={releaseInitiatedAt}
                  icon={Activity}
                />
              )}

              {releaseReleasedAt && (
                <DetailRow
                  label="Funds released at"
                  value={releaseReleasedAt}
                  icon={CheckCircle2}
                />
              )}

              {(releaseRequest.providerReference ||
                releaseRequest.provider_reference) && (
                <DetailRow
                  label="Provider reference"
                  value={
                    releaseRequest.providerReference ||
                    releaseRequest.provider_reference
                  }
                  icon={FileText}
                />
              )}

              {(releaseRequest.decisionReason ||
                releaseRequest.decision_reason) && (
                <DetailRow
                  label="Decision reason"
                  value={
                    releaseRequest.decisionReason ||
                    releaseRequest.decision_reason
                  }
                  icon={AlertCircle}
                />
              )}

              {(releaseRequest.failureReason ||
                releaseRequest.failure_reason) && (
                <DetailRow
                  label="Failure reason"
                  value={
                    releaseRequest.failureReason ||
                    releaseRequest.failure_reason
                  }
                  icon={AlertCircle}
                />
              )}
            </div>
          </div>
        )}
      </section>

      <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        Milestone timestamps are shown only when returned by the backend. A
        release request, approval, or processing state is not the same as a
        confirmed release of funds.
      </p>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ErrandDetailsPage() {
  const { errandId } = useParams();
  const navigate = useNavigate();

  const [errand, setErrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);

  const [pendingPayment, setPendingPayment] = useState(() =>
    readPendingPayment(),
  );
  const [loadingFunding, setLoadingFunding] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [releaseRequest, setReleaseRequest] = useState(null);
  const [releaseEvents, setReleaseEvents] = useState([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState("");

  /* NEW: extra offer data fetched from offers API if needed */
  const [fetchedOffer, setFetchedOffer] = useState(null);

  const actualErrandId = errand?.id || errand?.erand_id || errandId;

  /* ---------------------- loaders ---------------------- */

  const fetchErrand = useCallback(async () => {
    if (!errandId) {
      setErrand(null);
      setError("The errand ID is missing from the page address.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await getErrandById(errandId);
      const result = getErrandFromResponse(response);

      if (!result) {
        throw new Error(
          "The server did not return the expected errand details.",
        );
      }

      setErrand(result);
    } catch (err) {
      setErrand(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "We couldn't retrieve this errand. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [errandId]);

  const refreshFundingSummary = useCallback(
    async (id = actualErrandId) => {
      if (!id) return null;

      setLoadingFunding(true);

      try {
        const summary = await getErrandFundingSummary(id);
        const recoveredPayment = summary?.pendingPayment || null;

        setPendingPayment(recoveredPayment);

        if (
          recoveredPayment?.paymentId &&
          recoveredPayment?.reference
        ) {
          savePendingPayment({
            ...recoveredPayment,
            errandId: summary.errandId || id,
          });
        }

        return summary;
      } catch (err) {
        console.error(
          "Unable to refresh errand funding summary:",
          err,
        );
        return null;
      } finally {
        setLoadingFunding(false);
      }
    },
    [actualErrandId],
  );

  const refreshReleaseRequest = useCallback(
    async (id = actualErrandId, { quiet = false } = {}) => {
      if (!id) {
        setReleaseRequest(null);
        setReleaseEvents([]);
        setReleaseError("");
        return { request: null, events: [] };
      }

      if (!quiet) setReleaseLoading(true);
      setReleaseError("");

      try {
        const response = await getFundReleaseRequest(id);
        const result = getReleaseData(response);

        setReleaseRequest(result.request);
        setReleaseEvents(result.events);

        return result;
      } catch (err) {
        const httpStatus =
          err?.response?.status ?? err?.status ?? null;
        const rawCode =
          err?.response?.data?.code ?? err?.code ?? null;

        const treatAsEmpty =
          httpStatus === 404 ||
          (typeof rawCode === "string" &&
            rawCode.startsWith("FUND_RELEASE_REQUEST_LOOKUP"));

        if (treatAsEmpty) {
          setReleaseError("");
          return { request: null, events: [] };
        }

        setReleaseError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to retrieve the fund-release status.",
        );
        return null;
      } finally {
        setReleaseLoading(false);
      }
    },
    [actualErrandId],
  );

  /* NEW: try to fetch the accepted offer from the offers API
     (only runs if errand response didn't already include it). */
  const fetchAcceptedOffer = useCallback(
    async (errandIdToUse, acceptedOfferId) => {
      if (!errandIdToUse || !acceptedOfferId) return null;
      if (typeof getOffersForErrand !== "function") return null;

      try {
        const result = await getOffersForErrand(errandIdToUse);
        const offers =
          result?.data?.offers ??
          result?.offers ??
          result?.data ??
          [];
										
										console.log("offers:", offers)

        if (!Array.isArray(offers)) return null;

        return (
          offers.find((entry) => entry?.id === acceptedOfferId) ?? null
        );
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    void fetchErrand();
  }, [fetchErrand]);

  const status = errand?.status;

  useEffect(() => {
    if (!actualErrandId) return;

    void refreshReleaseRequest(actualErrandId);
  }, [actualErrandId, refreshReleaseRequest]);

  useEffect(() => {
    if (!actualErrandId || status !== "awaiting_funding") {
      setPendingPayment(null);
      return;
    }

    void refreshFundingSummary(actualErrandId);
  }, [actualErrandId, status, refreshFundingSummary]);

  /* NEW: try to fetch the accepted offer once we know the errand,
     but only if it's not already present on the errand object. */
  useEffect(() => {
    if (!errand?.accepted_offer_id) {
      setFetchedOffer(null);
      return;
    }

    const derived = getAcceptedOffer(errand);

    if (derived) {
      setFetchedOffer(null);
      return;
    }

    let cancelled = false;

    fetchAcceptedOffer(errand.id, errand.accepted_offer_id).then(
      (result) => {
        if (!cancelled && result) {
          setFetchedOffer(result);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [errand, fetchAcceptedOffer]);

  const items = useMemo(() => getItems(errand), [errand]);

  const errandAddress = useMemo(
    () => getErrandAddress(errand),
    [errand],
  );

  /* NEW: accepted offer (from errand response or fetched) */
  const acceptedOffer = useMemo(() => {
    const derived = getAcceptedOffer(errand);

    if (derived) return derived;

    return fetchedOffer ?? null;
  }, [errand, fetchedOffer]);

  const statusMeta = getStatusMeta(status);
  const StatusIcon = statusMeta.icon;

  const currency = errand?.currency_code || "NGN";
  const offersCount = getOffersCount(errand);

  const canClose =
    status === "open" && Boolean(errand?.id || errand?.erand_id);

  const canFund =
    status === "awaiting_funding" && Boolean(actualErrandId);

  const releaseStatus = String(
    releaseRequest?.status ?? releaseRequest?.request_status ?? "unknown",
  ).toLowerCase();

  const hasActiveReleaseRequest =
    Boolean(releaseRequest) && ACTIVE_RELEASE_STATUSES.has(releaseStatus);

  /* ---------------------- funding handlers ---------------------- */

  const handleGetFundingSummary = useCallback(
    async (id) => {
      const response = await getErrandFundingSummary(id);

      const funding =
        response?.data?.funding ||
        response?.funding ||
        response?.data?.data?.funding ||
        response?.data?.data ||
        response?.data ||
        response;

      const agreedTotal = Number(
        funding?.agreedTotal ?? funding?.requiredAmount,
      );

      const amountFunded = Number(
        funding?.amountFunded ?? funding?.eligibleFundingAmount ?? 0,
      );

      const amountDue =
        funding?.amountDue !== undefined && funding?.amountDue !== null
          ? Number(funding.amountDue)
          : Math.max(agreedTotal - amountFunded, 0);

      if (
        !Number.isFinite(agreedTotal) ||
        !Number.isFinite(amountFunded) ||
        !Number.isFinite(amountDue)
      ) {
        throw new Error(
          "The server returned an invalid funding summary. Please refresh the errand and try again.",
        );
      }

      const recoveredPayment = response?.pendingPayment || null;

      if (recoveredPayment) {
        setPendingPayment(recoveredPayment);

        if (
          recoveredPayment.paymentId &&
          recoveredPayment.reference
        ) {
          savePendingPayment({
            ...recoveredPayment,
            errandId: funding?.errandId || id,
          });
        }
      }

      return {
        ...funding,
        errandId: funding?.errandId || id,
        currency: String(
          funding?.currency || funding?.currencyCode || currency || "NGN",
        ).trim(),
        agreedTotal,
        amountFunded,
        amountDue,
      };
    },
    [currency],
  );

  const handleInitializePayment = useCallback(async (id) => {
    return initializePayment(id);
  }, []);

  const handleVerifyExistingPayment = useCallback(async () => {
    if (verifyingPayment || !actualErrandId) return;

    setVerifyingPayment(true);

    try {
      const summary = await getErrandFundingSummary(actualErrandId);

      const payment = summary?.pendingPayment;

      if (!payment?.paymentId || !payment?.reference) {
        setPendingPayment(null);

        throw new Error(
          "No pending payment was found for this errand. Refresh the funding status before attempting another payment.",
        );
      }

      setPendingPayment(payment);

      savePendingPayment({
        ...payment,
        errandId: summary.errandId || actualErrandId,
      });

      await verifyPayment(payment.paymentId);

      clearPendingPayment();
      setPendingPayment(null);

      toast.success("Payment verification completed successfully.");

      await fetchErrand();
      await refreshFundingSummary(actualErrandId);
      await refreshReleaseRequest(actualErrandId);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Payment verification failed. Please try again.";

      toast.error(message);

      await refreshFundingSummary(actualErrandId);
    } finally {
      setVerifyingPayment(false);
    }
  }, [
    actualErrandId,
    verifyingPayment,
    fetchErrand,
    refreshFundingSummary,
    refreshReleaseRequest,
  ]);

  const handleClose = async () => {
    if (!errandId || closing) return;

    setClosing(true);

    try {
      await closeErrand(errandId);
      toast.success("Your errand request has been closed.");
      setShowCloseDialog(false);
      await fetchErrand();
      await refreshReleaseRequest(actualErrandId);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to close this request. Please try again.",
      );
    } finally {
      setClosing(false);
    }
  };

  const handleRefreshAll = useCallback(() => {
    void fetchErrand();
    void refreshFundingSummary(actualErrandId);
    void refreshReleaseRequest(actualErrandId);
  }, [
    fetchErrand,
    refreshFundingSummary,
    refreshReleaseRequest,
    actualErrandId,
  ]);

  /* ---------------------- loading / error ---------------------- */

  if (loading) {
    return (
      <DashboardLayout>
        <main className="min-h-screen bg-[#f7f8f6] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <LoadingState />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (error || !errand) {
    return (
      <DashboardLayout>
        <main className="min-h-screen bg-[#f7f8f6] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <button
              type="button"
              onClick={() => navigate("/dashboard/erands")}
              className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#14213d]"
            >
              <ArrowLeft size={17} />
              My Errands
            </button>

            <ErrorState
              message={error || "This errand could not be found."}
              onRetry={fetchErrand}
              onBack={() => navigate("/dashboard/erands")}
            />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  /* ---------------------- render ---------------------- */

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#f7f8f6] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => navigate("/dashboard/erands")}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#14213d]"
          >
            <ArrowLeft size={17} />
            Back to My Errands
          </button>

          {/* ============================================
              HEADER
          ============================================ */}
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(20,33,61,0.04)] sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${statusMeta.className}`}
                  >
                    <StatusIcon size={14} />
                    {statusMeta.label}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                    <Tag size={13} />
                    {formatCategory(errand.category)}
                  </span>
                </div>

                {status === "open" && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/dashboard/erands/${errandId}/offers`)
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#20cc88]/40 bg-[#e9fbf3] px-3 py-2 text-xs font-extrabold text-[#15803d] transition hover:border-[#20cc88] hover:bg-[#d8f8e8]"
                  >
                    <ShoppingBag size={14} />
                    {offersCount === null
                      ? "View offers"
                      : `View ${offersCount} ${
                          offersCount === 1 ? "offer" : "offers"
                        }`}
                    <ArrowRight size={14} />
                  </button>
                )}

                <h1 className="mt-4 break-words text-2xl font-extrabold tracking-tight text-[#14213d] sm:text-3xl">
                  {errand.title || "Untitled errand"}
                </h1>

                <p className="mt-2 break-words text-sm font-semibold text-slate-400">
                  Reference: {getReference(errand)}
                </p>

                {errandAddress.text && (
                  <p className="mt-2 flex items-start gap-1.5 break-words text-sm font-semibold text-slate-600">
                    <MapPin
                      size={15}
                      className="mt-0.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      {errandAddress.label && (
                        <span className="mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          {errandAddress.label}
                        </span>
                      )}
                      {errandAddress.text}
                    </span>
                  </p>
                )}

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  {errand.description ||
                    "No description was provided for this errand."}
                </p>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} />
                    Created{" "}
                    {formatDate(errand.created_at || errand.createdAt) ||
                      "Not recorded"}
                  </span>

                  {errand.scheduled_for && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={15} />
                      Scheduled{" "}
                      {formatDate(errand.scheduled_for, true) ||
                        "Not recorded"}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-[#14213d] p-5 text-white lg:min-w-[230px]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                  <Wallet size={17} />
                  Estimated budget
                </div>

                <p className="mt-3 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {formatCurrency(errand.estimated_total, currency)}
                </p>

                <p className="mt-2 text-xs leading-5 text-white/60">
                  This is the estimate submitted with your request, not
                  necessarily the final transaction amount.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              {status === "open" && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/dashboard/erands/${errandId}/edit`)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-[#14213d] transition hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit request
                </button>
              )}

              {canFund && (
                <button
                  type="button"
                  onClick={() => setShowFundingModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#35d07f] px-5 py-3 text-sm font-extrabold text-[#14213d] transition hover:bg-[#27bd6f]"
                >
                  <Wallet size={17} />
                  Fund Errand
                  <ArrowRight size={16} />
                </button>
              )}

              {canFund && pendingPayment && (
                <button
                  type="button"
                  onClick={handleVerifyExistingPayment}
                  disabled={verifyingPayment || loadingFunding}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#35d07f] bg-[#e9fbf3] px-4 py-3 text-sm font-extrabold text-[#14213d] transition hover:bg-[#d8f8e8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifyingPayment ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <RefreshCw size={17} />
                  )}

                  {verifyingPayment
                    ? "Verifying payment..."
                    : "Verify Existing Payment"}
                </button>
              )}

              {canClose && (
                <button
                  type="button"
                  onClick={() => setShowCloseDialog(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  <XCircle size={16} />
                  Close request
                </button>
              )}

              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={loading || loadingFunding || releaseLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                Refresh details
              </button>
            </div>
          </header>

          {/* ============================================
              CONTENT
          ============================================ */}
          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Request information */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={FileText}
                  title="Request information"
                  description="The details recorded when you submitted this errand."
                />

                <div className="mt-4 divide-y divide-slate-100">
                  <DetailRow
                    label="Errand reference"
                    value={getReference(errand)}
                    icon={FileText}
                  />

                  <DetailRow
                    label={
                      errandAddress.label
                        ? `Errand address (${errandAddress.label})`
                        : "Errand address"
                    }
                    value={errandAddress.text || "Not specified"}
                    icon={MapPin}
                  />

                  <DetailRow
                    label="Category"
                    value={formatCategory(errand.category)}
                    icon={Tag}
                  />

                  <DetailRow
                    label="Maximum offers"
                    value={
                      errand.max_erander_offers != null
                        ? `${errand.max_erander_offers} offers`
                        : "Not specified"
                    }
                    icon={Activity}
                  />

                  <DetailRow
                    label="Offer receiving"
                    value={
                      errand.offers_enabled === false
                        ? "Disabled"
                        : errand.status === "open"
                          ? "Open for offers"
                          : "Depends on request status"
                    }
                    icon={CheckCircle2}
                  />

                  <DetailRow
                    label="Expires"
                    value={
                      formatDate(errand.expires_at, true) || "Not specified"
                    }
                    icon={Clock3}
                  />

                  {errand.scheduled_for && (
                    <DetailRow
                      label="Scheduled for"
                      value={
                        formatDate(errand.scheduled_for, true) ||
                        "Not specified"
                      }
                      icon={CalendarDays}
                    />
                  )}
                </div>
              </section>

              {/* Items */}
              {items.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <SectionHeading
                    icon={ShoppingBag}
                    title="Shopping and requested items"
                    description={`${items.length} ${
                      items.length === 1 ? "item" : "items"
                    } included in this request.`}
                  />

                  <div className="mt-5 space-y-3">
                    {items.map((item, index) => {
                      const subtotal = getItemSubtotal(item);

                      return (
                        <div
                          key={
                            item.id ||
                            `${item.item_name || "item"}-${index}`
                          }
                          className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="flex min-w-0 gap-3">
                            <div className="min-w-0">
                              <h3 className="break-words text-sm font-extrabold text-[#14213d]">
                                {item.item_name || `Item ${index + 1}`}
                              </h3>

                              <p className="mt-1 text-xs text-slate-500">
                                Quantity: {getItemQuantity(item)}{" "}
                                {item.unit || "item"}
                              </p>

                              {item.description && (
                                <p className="mt-2 text-sm leading-5 text-slate-500">
                                  {item.description}
                                </p>
                              )}

                              {item.customer_notes && (
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  Note: {item.customer_notes}
                                </p>
                              )}

                              {item.item_url && (
                                <a
                                  href={item.item_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                                >
                                  View item link
                                  <ArrowRight size={13} />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-xs font-semibold text-slate-500">
                              Estimated amount
                            </p>

                            <p className="mt-1 text-sm font-extrabold text-[#14213d]">
                              {subtotal == null
                                ? "Not specified"
                                : formatCurrency(subtotal, currency)}
                            </p>

                            {item.estimated_unit_price != null && (
                              <p className="mt-1 text-xs text-slate-400">
                                {formatCurrency(
                                  item.estimated_unit_price,
                                  currency,
                                )}{" "}
                                per unit
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Accepted offer fee breakdown OR
                      fallback to errand item estimate */}
                  {acceptedOffer?.proposed_total != null ? (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                      {acceptedOffer.proposed_item_total != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Items</span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              acceptedOffer.proposed_item_total,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {acceptedOffer.proposed_service_fee != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Service fee</span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              acceptedOffer.proposed_service_fee,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {acceptedOffer.proposed_delivery_fee != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Delivery fee
                          </span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              acceptedOffer.proposed_delivery_fee,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {acceptedOffer.proposed_other_fees != null &&
                        Number(acceptedOffer.proposed_other_fees) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              Other fees
                            </span>
                            <span className="font-semibold text-[#14213d]">
                              {formatCurrency(
                                acceptedOffer.proposed_other_fees,
                                currency,
                              )}
                            </span>
                          </div>
                        )}

                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
                        <span className="font-bold text-[#14213d]">
                          Total
                        </span>
                        <span className="font-extrabold text-[#14213d]">
                          {formatCurrency(
                            acceptedOffer.proposed_total,
                            currency,
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#e9fbf3] p-4">
                      <span className="text-sm font-bold text-[#14213d]">
                        Estimated listed-item total
                      </span>

                      <span className="text-base font-extrabold text-[#15803d]">
                        {formatCurrency(
                          items.reduce((total, item) => {
                            const subtotal = getItemSubtotal(item);
                            return total + (subtotal == null ? 0 : subtotal);
                          }, 0),
                          currency,
                        )}
                      </span>
                    </div>
                  )}
                </section>
              )}

              {/* Progress + release */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={Activity}
                  title="Errand progress"
                  description="Follow the lifecycle and track the fund-release milestones."
                />

                <ErrandProgress
                  errand={errand}
                  status={status}
                  pendingPayment={pendingPayment}
                  verifyingPayment={verifyingPayment}
                  onVerifyPayment={handleVerifyExistingPayment}
                  releaseRequest={releaseRequest}
                  releaseEvents={releaseEvents}
                  releaseLoading={releaseLoading}
                  releaseError={releaseError}
                  onRefreshRelease={() =>
                    refreshReleaseRequest(actualErrandId, { quiet: true })
                  }
                />
              </section>

              {/* Customer notes */}
              {errand.customer_notes && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <SectionHeading
                    icon={FileText}
                    title="Your additional notes"
                    description="Instructions and context supplied with the request."
                  />

                  <p className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                    {errand.customer_notes}
                  </p>
                </section>
              )}
            </div>

            {/* ============================================
                SIDEBAR
            ============================================ */}
            <aside className="space-y-6">
              {/* Current status */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={CheckCircle2}
                  title="Current status"
                  description="The latest status returned by the server."
                />

                <div className="mt-5 rounded-xl border border-slate-100 p-4">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold ${statusMeta.className}`}
                  >
                    <StatusIcon size={15} />
                    {statusMeta.label}
                  </span>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {statusMeta.description}
                  </p>

                  {canFund && loadingFunding && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <LoaderCircle size={14} className="animate-spin" />
                      Checking for an existing payment...
                    </p>
                  )}

                  {canFund && !loadingFunding && pendingPayment && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs leading-5 text-amber-900">
                        Existing payment detected. Verify it before
                        attempting to fund this errand again.
                      </p>

                      <button
                        type="button"
                        onClick={handleVerifyExistingPayment}
                        disabled={verifyingPayment}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14213d] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#20365b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {verifyingPayment ? (
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <RefreshCw size={17} />
                        )}

                        {verifyingPayment
                          ? "Verifying..."
                          : "Verify Existing Payment"}
                      </button>
                    </div>
                  )}

                  {canFund && !loadingFunding && !pendingPayment && (
                    <button
                      type="button"
                      onClick={() => setShowFundingModal(true)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#35d07f] px-4 py-3 text-sm font-extrabold text-[#14213d] transition hover:bg-[#27bd6f]"
                    >
                      <Wallet size={17} />
                      Review funding
                    </button>
                  )}

                  {hasActiveReleaseRequest && (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      The erander has requested a fund release. Check the
                      progress section for the latest status.
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-[#15803d]"
                    />

                    <p className="text-xs leading-5 text-slate-500">
                      Keep changes to your agreed budget and scope explicit.
                      Review any proposed changes before approving them.
                    </p>
                  </div>
                </div>
              </section>

              {/* Budget summary */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={Wallet}
                  title="Budget summary"
                  description="Your submitted budget details."
                />

                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Estimated total
                    </span>

                    <span className="text-sm font-extrabold text-[#14213d]">
                      {formatCurrency(errand.estimated_total, currency)}
                    </span>
                  </div>

                  {acceptedOffer?.proposed_total != null && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Agreed total
                      </span>

                      <span className="text-sm font-extrabold text-[#15803d]">
                        {formatCurrency(
                          acceptedOffer.proposed_total,
                          currency,
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Transaction currency
                    </span>

                    <span className="text-sm font-bold text-[#14213d]">
                      {currency}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs leading-5 text-slate-500">
                      Final charges, platform fees, and funding requirements
                      depend on the agreed errand terms and enabled payment
                      features.
                    </p>
                  </div>
                </div>
              </section>

              {/* Navy help card */}
              <section className="rounded-2xl bg-[#14213d] p-5 text-white sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <ShieldCheck size={22} className="text-[#35d07f]" />
                </div>

                <h2 className="mt-4 text-lg font-extrabold">
                  Need assistance?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  If the request details look incorrect or you encounter a
                  problem, keep your reference number available when
                  contacting support.
                </p>

                <p className="mt-4 break-words rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/90">
                  Reference: {getReference(errand)}
                </p>
              </section>

              <button
                type="button"
                onClick={() => navigate("/dashboard/erands")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#14213d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Return to My Errands
              </button>
            </aside>
          </div>
        </div>
      </main>

      {/* ============================================
          FUNDING MODAL
      ============================================ */}
      <FundErrandModal
        open={showFundingModal}
        errand={errand}
        onClose={() => setShowFundingModal(false)}
        onGetFundingSummary={handleGetFundingSummary}
        onInitializePayment={handleInitializePayment}
      />

      {/* ============================================
          CLOSE CONFIRMATION DIALOG
      ============================================ */}
      {showCloseDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091426]/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !closing) {
              setShowCloseDialog(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-errand-title"
            aria-describedby="close-errand-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <XCircle size={25} />
              </div>

              <button
                type="button"
                disabled={closing}
                onClick={() => setShowCloseDialog(false)}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <h2
              id="close-errand-title"
              className="mt-5 text-xl font-extrabold text-[#14213d]"
            >
              Close this errand?
            </h2>

            <p
              id="close-errand-description"
              className="mt-2 text-sm leading-6 text-slate-500"
            >
              You are about to close{" "}
              <span className="font-bold text-[#14213d]">
                {errand.title || "this request"}
              </span>
              . This action is subject to the server&apos;s cancellation
              rules.
            </p>

            {errandAddress.text && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                <MapPin
                  size={15}
                  className="mt-0.5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <p className="break-words text-xs leading-5 text-slate-600">
                  {errandAddress.text}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={closing}
                onClick={() => setShowCloseDialog(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep request
              </button>

              <button
                type="button"
                disabled={closing}
                onClick={handleClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {closing ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Closing…
                  </>
                ) : (
                  "Confirm closure"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}