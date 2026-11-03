import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Wallet,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { getMyErandOffers } from "@/services/offers/offersApi";
import {
  getErrandFundingSummary,
  getFundReleaseRequest,
  requestFundRelease,
} from "@/services/payments/paymentsApi";
import { getErrandById } from "@/services/errands/errandsApi";

/* =========================================================
   STATUS META
========================================================= */

const STATUS_META = {
  draft: {
    label: "Draft",
    description: "This errand has not been opened for offers yet.",
    className: "bg-slate-100 text-slate-700",
    icon: FileText,
  },
  open: {
    label: "Open for offers",
    description: "The request is open and can receive offers from eranders.",
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
    description: "Work on this errand is under way.",
    className: "bg-violet-50 text-violet-700",
    icon: Activity,
  },
  completion_submitted: {
    label: "Awaiting review",
    description: "Completion has been submitted and may require review.",
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

const OFFER_STATUS_META = {
  pending: {
    label: "Offer pending",
    description: "Your offer is waiting for the customer to review it.",
    className: "bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  accepted: {
    label: "Offer accepted",
    description: "The customer has accepted your offer.",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Offer rejected",
    description: "The customer did not select your offer.",
    className: "bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  withdrawn: {
    label: "Offer withdrawn",
    description: "This offer was withdrawn.",
    className: "bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  expired: {
    label: "Offer expired",
    description: "This offer has expired.",
    className: "bg-slate-100 text-slate-600",
    icon: Clock3,
  },
  superseded: {
    label: "Offer superseded",
    description: "A newer offer replaced this one.",
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

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

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

function getOfferStatusMeta(status) {
  const normalized = String(status || "pending").toLowerCase();

  return (
    OFFER_STATUS_META[normalized] || {
      label: normalized
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: "The current state of your offer.",
      className: "bg-slate-100 text-slate-600",
      icon: FileText,
    }
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

function getItems(errand, offer) {
  const possibleItems = [
    errand?.items,
    errand?.erand_items,
    offer?.items,
    errand?.data?.items,
  ];

  return possibleItems.find(Array.isArray) || [];
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
   OFFER HELPERS
------------------------------------------------------- */

function getOfferId(offer) {
  return String(firstDefined(offer?.id, offer?.offer_id, offer?.offerId, ""));
}

function getErrandFromOffer(offer) {
  return (
    offer?.erand ??
    offer?.errand ??
    offer?.erand_details ??
    offer?.errand_details ??
    offer?.request ??
    null
  );
}

function getErrandId(offer) {
  const errand = getErrandFromOffer(offer);

  return String(
    firstDefined(
      offer?.erand_id,
      offer?.errand_id,
      offer?.erandId,
      offer?.errandId,
      errand?.id,
      "",
    ),
  );
}

function getOfferStatus(offer) {
  return String(
    firstDefined(offer?.status, offer?.offer_status, "pending"),
  ).toLowerCase();
}

function getFundingStatus(funding, errandStatus) {
  const explicitStatus = String(
    firstDefined(
      funding?.fundingStatus,
      funding?.funding_status,
      funding?.status,
      "",
    ),
  ).toLowerCase();

  if (
    ["funded", "paid", "successful", "succeeded", "completed"].includes(
      explicitStatus,
    )
  ) {
    return "funded";
  }

  if (
    ["awaiting_funding", "unfunded", "not_funded", "pending", "unpaid"].includes(
      explicitStatus,
    )
  ) {
    return "awaiting_funding";
  }

  if (
    ["funded", "in_progress", "completion_submitted", "completed"].includes(
      errandStatus,
    )
  ) {
    return "funded";
  }

  if (errandStatus === "awaiting_funding") {
    return "awaiting_funding";
  }

  return "unknown";
}

function getOfferAmount(offer) {
  return firstDefined(
    offer?.proposed_total,
    offer?.proposed_item_total,
    offer?.proposed_amount,
    offer?.offer_amount,
    offer?.amount,
    offer?.proposedAmount,
  );
}

function getCurrency(offer, errand, funding) {
  return firstDefined(
    funding?.currency,
    offer?.currency_code,
    offer?.currency,
    errand?.currency_code,
    "NGN",
  );
}

/* -------------------------------------------------------
   LIFECYCLE TIMESTAMPS
------------------------------------------------------- */

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

function getLifecycleTimestamp(errand, offer, releaseRequest, events, key) {
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
    funded: ["agreement_locked_at", "agreementLockedAt"],
    in_progress: ["in_progress_at", "inProgressAt"],
    completion_submitted: [
      "completion_submitted_at",
      "completionSubmittedAt",
    ],
    completed: ["completed_at", "completedAt"],
  };

  const primary =
    getTimestamp(errand, aliases[key] || []) ||
    getTimestamp(offer, aliases[key] || []);

  if (primary) return primary;

  if (key === "offer_selected" || key === "awaiting_funding") {
    return (
      getTimestamp(offer, [
        "responded_at",
        "respondedAt",
        "accepted_at",
        "acceptedAt",
      ]) ||
      getTimestamp(errand, [
        "agreement_accepted_at",
        "agreementAcceptedAt",
      ])
    );
  }

  return null;
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

function FundingBadge({ status }) {
  if (status === "funded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
        <CheckCircle2 size={14} />
        Funded
      </span>
    );
  }

  if (status === "awaiting_funding") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800">
        <Clock3 size={14} />
        Awaiting funding
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">
      <Clock3 size={14} />
      Not confirmed
    </span>
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
      aria-label="Loading offer details"
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
        Please wait while we retrieve this offer.
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
        Unable to load this offer
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
          Back to My Offers
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
   ERRAND PROGRESS
========================================================= */

function ErrandProgress({
  errand,
  offer,
  status,
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
            offer,
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
                  <p className="mt-1 text-xs text-slate-500">{timestamp}</p>
                )}

                {step.key === "open" && !timestamp && (
                  <p className="mt-1 text-xs text-slate-400">
                    Opening timestamp unavailable.
                  </p>
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
            <p className="text-xs leading-5 text-amber-900">{releaseError}</p>
          </div>
        )}

        {!releaseLoading && !releaseError && !releaseRequest && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-bold text-[#14213d]">
              No release request recorded
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              The backend has not returned a fund-release request for this
              errand. This does not mean funds have been released.
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

              {releaseRequest.providerReference && (
                <DetailRow
                  label="Provider reference"
                  value={releaseRequest.providerReference}
                  icon={FileText}
                />
              )}

              {releaseRequest.decisionReason && (
                <DetailRow
                  label="Decision reason"
                  value={releaseRequest.decisionReason}
                  icon={AlertCircle}
                />
              )}

              {releaseRequest.failureReason && (
                <DetailRow
                  label="Failure reason"
                  value={releaseRequest.failureReason}
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

export default function OfferDetailsPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const [offer, setOffer] = useState(null);
  const [funding, setFunding] = useState(null);
  const [releaseRequest, setReleaseRequest] = useState(null);
  const [releaseEvents, setReleaseEvents] = useState([]);
  const [releaseStatusLoaded, setReleaseStatusLoaded] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [error, setError] = useState("");

  /* ---------------------- loaders ---------------------- */

  const loadReleaseRequest = useCallback(
    async (errandId, { quiet = false } = {}) => {
      if (!errandId) {
        setReleaseError("");
        setReleaseStatusLoaded(true);
        return { request: null, events: [] };
      }

      if (!quiet) setReleaseLoading(true);
      setReleaseError("");

      try {
        const response = await getFundReleaseRequest(errandId);
        const result = getReleaseData(response);

        setReleaseRequest(result.request);
        setReleaseEvents(result.events);
        setReleaseStatusLoaded(true);

        return result;
      } catch (requestError) {
        const httpStatus =
          requestError?.response?.status ??
          requestError?.status ??
          requestError?.statusCode ??
          null;

        const rawCode =
          requestError?.response?.data?.code ??
          requestError?.code ??
          null;

        const treatAsEmpty =
          httpStatus === 404 ||
          (typeof rawCode === "string" &&
            rawCode.startsWith("FUND_RELEASE_REQUEST_LOOKUP"));

        if (treatAsEmpty) {
          setReleaseStatusLoaded(true);
          setReleaseError("");
          return { request: null, events: [] };
        }

        setReleaseError(
          requestError?.message ||
            "Unable to load the fund-release request.",
        );
        setReleaseStatusLoaded(false);
        throw requestError;
      } finally {
        setReleaseLoading(false);
      }
    },
    [],
  );

  const fetchFullErrand = useCallback(async (errandId) => {
    if (!errandId) return null;

    try {
      const errandResponse = await getErrandById(errandId);

      const candidates = [
        errandResponse?.data?.errand,
        errandResponse?.data?.erand,
        errandResponse?.data?.request,
        errandResponse?.errand,
        errandResponse?.erand,
        errandResponse?.data,
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
    } catch {
      return null;
    }
  }, []);

  const loadOffer = useCallback(async () => {
    if (!offerId) {
      setError("The offer ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setFunding(null);
    setReleaseRequest(null);
    setReleaseEvents([]);
    setReleaseError("");
    setReleaseStatusLoaded(false);

    try {
      const response = await getMyErandOffers({ page: 1, limit: 100 });

      const offers =
        response?.data?.offers ??
        response?.data?.items ??
        response?.offers ??
        response?.items ??
        (Array.isArray(response?.data) ? response.data : null) ??
        (Array.isArray(response) ? response : []);

      const matchingOffer = offers.find(
        (item) => getOfferId(item) === String(offerId),
      );

      if (!matchingOffer) {
        throw new Error(
          "We could not find this offer in your offers. It may have been removed or may not belong to your account.",
        );
      }

      const errandId = getErrandId(matchingOffer);

      if (!errandId) {
        throw new Error(
          "The offer is missing an errand ID, so the errand details cannot be loaded.",
        );
      }

      const fullErrand = await fetchFullErrand(errandId);

      const mergedOffer = {
        ...matchingOffer,
        errand:
          fullErrand ?? matchingOffer.errand ?? matchingOffer.erand ?? null,
      };

      setOffer(mergedOffer);

      setFundingLoading(true);

      try {
        const fundingResponse = await getErrandFundingSummary(errandId);
        setFunding(fundingResponse);
      } catch {
        setFunding(null);
      } finally {
        setFundingLoading(false);
      }

      try {
        await loadReleaseRequest(errandId);
      } catch {
        /* surfaced in the release panel */
      }
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Unable to load offer details. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [offerId, loadReleaseRequest, fetchFullErrand]);

  useEffect(() => {
    loadOffer();
  }, [loadOffer]);

  /* ---------------------- derived state ---------------------- */

  const errand = useMemo(() => getErrandFromOffer(offer), [offer]);

  const offerStatus = useMemo(() => getOfferStatus(offer), [offer]);

  const errandStatus = useMemo(
    () =>
      String(
        firstDefined(
          funding?.errandStatus,
          funding?.errand_status,
          errand?.status,
          offer?.errand_status,
          offer?.erand_status,
          "",
        ),
      ).toLowerCase(),
    [funding, errand, offer],
  );

  const fundingStatus = useMemo(
    () => getFundingStatus(funding, errandStatus),
    [funding, errandStatus],
  );

  const currency = useMemo(
    () => getCurrency(offer, errand, funding),
    [offer, errand, funding],
  );

  const offerAmount = useMemo(() => getOfferAmount(offer), [offer]);

  const items = useMemo(() => getItems(errand, offer), [errand, offer]);

  const errandAddress = useMemo(() => {
    const fromErrand = getErrandAddress(errand);

    if (fromErrand.text) return fromErrand;

    return getErrandAddress(offer);
  }, [errand, offer]);

  const statusMeta = getStatusMeta(errandStatus);
  const StatusIcon = statusMeta.icon;

  const offerStatusMeta = getOfferStatusMeta(offerStatus);
  const OfferStatusIcon = offerStatusMeta.icon;

  const releaseStatus = String(
    firstDefined(
      releaseRequest?.status,
      releaseRequest?.request_status,
      "unknown",
    ),
  ).toLowerCase();

  const hasActiveOrCompletedReleaseRequest =
    Boolean(releaseRequest) &&
    ACTIVE_RELEASE_STATUSES.has(releaseStatus);

  const isAccepted = offerStatus === "accepted";
  const isFunded = fundingStatus === "funded";

  const canRequestFunds =
    Boolean(getErrandId(offer)) &&
    isAccepted &&
    isFunded &&
    errandStatus === "funded" &&
    !hasActiveOrCompletedReleaseRequest &&
    !releaseSubmitting &&
    !releaseLoading;

  const releaseStatusUnknown =
    !releaseStatusLoaded || Boolean(releaseError);

  /* ---------------------- presentation ---------------------- */

  const title = firstDefined(
    errand?.title,
    errand?.name,
    offer?.errand_title,
    offer?.erand_title,
    "Errand details",
  );

  const category = firstDefined(
    errand?.category,
    offer?.category,
    offer?.errand_category,
  );

  const description = firstDefined(
    errand?.description,
    offer?.errand_description,
    offer?.description,
  );

  const scheduledFor = firstDefined(
    errand?.scheduled_for,
    errand?.scheduledFor,
    offer?.scheduled_for,
  );

  const customerNotes = firstDefined(
    errand?.customer_notes,
    errand?.customerNotes,
    offer?.customer_notes,
  );

  const pickupLocation = firstDefined(
    errand?.pickup_location,
    errand?.pickup_address,
    errand?.pickup_area,
    offer?.pickup_location,
  );

  const deliveryLocation = firstDefined(
    errand?.delivery_location,
    errand?.delivery_address,
    errand?.delivery_area,
    offer?.delivery_location,
  );

  const offerCreatedAt = firstDefined(
    offer?.created_at,
    offer?.createdAt,
    offer?.submitted_at,
  );

  const offerReference = firstDefined(
    offer?.reference,
    offer?.offer_reference,
    offer?.id,
  );

  const requestButtonLabel = releaseSubmitting
    ? "Submitting..."
    : "Request Funds";

  /* ---------------------- actions ---------------------- */

  const handleRefreshRelease = async () => {
    const errandId = getErrandId(offer);

    if (!errandId) {
      toast.error("The errand ID is unavailable.");
      return;
    }

    try {
      await loadReleaseRequest(errandId, { quiet: true });
      toast.success("Fund-release status refreshed.");
    } catch (refreshError) {
      toast.error(
        refreshError?.message ||
          "Unable to refresh fund-release status.",
      );
    }
  };

  const handleRequestFunds = async () => {
    const errandId = getErrandId(offer);

    if (!errandId) {
      toast.error("The errand ID is unavailable.");
      return;
    }

    if (releaseSubmitting) return;

    if (!isAccepted) {
      toast.error("Your offer must be accepted before requesting funds.");
      return;
    }

    if (!isFunded || errandStatus !== "funded") {
      toast.error(
        "The errand must be confirmed as funded and eligible before you can request funds.",
      );
      return;
    }

    if (hasActiveOrCompletedReleaseRequest) {
      toast.info(
        "A fund-release request already exists for this errand.",
      );
      return;
    }

    setReleaseSubmitting(true);

    try {
      const result = await requestFundRelease(errandId);

      setReleaseRequest(result.request);
      setReleaseStatusLoaded(true);
      setReleaseError("");

      if (result.existing) {
        toast.info(
          result.message ||
            "A fund-release request already exists for this errand.",
        );
      } else {
        toast.success(
          result.message ||
            "Your fund-release request has been submitted.",
        );
      }
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          "Unable to submit your fund-release request.",
      );

      try {
        await loadReleaseRequest(errandId, { quiet: true });
      } catch {
        /* surfaced in the release panel */
      }
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const handleRefreshAll = () => {
    void loadOffer();
  };

  /* ---------------------- loading / error ---------------------- */

  if (loading) {
    return (
      <DashboardLayout>
        <main className="min-h-screen py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <LoadingState />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (error || !offer) {
    return (
      <DashboardLayout>
        <main className="min-h-screen bg-[#f7f8f6] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <button
              type="button"
              onClick={() => navigate("/dashboard/my-offers")}
              className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#14213d]"
            >
              <ArrowLeft size={17} />
              My Offers
            </button>

            <ErrorState
              message={error || "We could not find this offer."}
              onRetry={handleRefreshAll}
              onBack={() => navigate("/dashboard/my-offers")}
            />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  /* ---------------------- render ---------------------- */

  return (
    <DashboardLayout>
      <main className="min-h-screen py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => navigate("/dashboard/my-offers")}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#14213d]"
          >
            <ArrowLeft size={17} />
            Back to My Offers
          </button>

          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(20,33,61,0.04)] sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${offerStatusMeta.className}`}
                  >
                    <OfferStatusIcon size={14} />
                    {offerStatusMeta.label}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${statusMeta.className}`}
                  >
                    <StatusIcon size={14} />
                    {statusMeta.label}
                  </span>

                  {category && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                      <Tag size={13} />
                      {formatCategory(category)}
                    </span>
                  )}

                </div>

                <h1 className="mt-4 break-words text-2xl font-extrabold tracking-tight text-[#14213d] sm:text-3xl">
                  {title}
                </h1>

                <p className="mt-2 break-words text-sm font-semibold text-slate-400">
                  Offer reference:{" "}
                  {offerReference
                    ? String(offerReference).slice(0, 18)
                    : "Not available"}
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
                  {description ||
                    "No description was provided for this errand."}
                </p>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                  {offerCreatedAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={15} />
                      Offer submitted{" "}
                      {formatDate(offerCreatedAt) || "Not recorded"}
                    </span>
                  )}

                  {scheduledFor && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={15} />
                      Scheduled{" "}
                      {formatDate(scheduledFor, true) || "Not recorded"}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-[#14213d] p-5 text-white lg:min-w-[230px]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                  <Wallet size={17} />
                  Your proposed amount
                </div>

                <p className="mt-3 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {formatCurrency(offerAmount, currency)}
                </p>

                <div className="mt-3 border-t border-white/15 pt-3">
                  {fundingLoading ? (
                    <span className="inline-flex items-center gap-2 text-xs text-white/60">
                      <LoaderCircle size={13} className="animate-spin" />
                      Checking funding...
                    </span>
                  ) : (
                    <FundingBadge status={fundingStatus} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              {canRequestFunds && (
                <button
                  type="button"
                  onClick={handleRequestFunds}
                  disabled={releaseSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#35d07f] px-5 py-3 text-sm font-extrabold text-[#14213d] transition hover:bg-[#27bd6f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {releaseSubmitting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                  {requestButtonLabel}
                </button>
              )}

              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={loading || fundingLoading || releaseLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                Refresh details
              </button>
            </div>
          </header>

          {isAccepted && !isFunded && (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                  <Wallet size={20} color="#B45309" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-amber-950">
                    {fundingStatus === "unknown"
                      ? "Funding status needs confirmation"
                      : "Your offer has been accepted"}
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    {fundingStatus === "unknown"
                      ? "We could not confirm the current funding status. Refresh this page to check again. Do not begin work until the platform confirms that the errand is funded."
                      : "The customer selected your offer. The errand is not yet confirmed as funded, so wait for the platform to confirm funding before beginning work."}
                  </p>
                </div>

                <Clock3
                  size={20}
                  className="hidden shrink-0 text-amber-700 sm:block"
                />
              </div>
            </section>
          )}

          {errandStatus === "cancelled" && (
            <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-3">
                <XCircle
                  size={21}
                  className="mt-0.5 shrink-0 text-rose-600"
                />
                <div>
                  <h2 className="text-sm font-bold text-rose-900">
                    This errand has been cancelled
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-rose-800">
                    Check the platform's cancellation information before
                    taking any further action.
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={FileText}
                  title="Errand information"
                  description="The details recorded for this request."
                />

                <div className="mt-4 divide-y divide-slate-100">
                  <DetailRow
                    label="Errand reference"
                    value={
                      firstDefined(
                        errand?.reference_code,
                        errand?.reference,
                      ) || "Not specified"
                    }
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
                    value={formatCategory(category)}
                    icon={Tag}
                  />

                  <DetailRow
                    label="Offer reference"
                    value={
                      offerReference
                        ? String(offerReference).slice(0, 18)
                        : "Not specified"
                    }
                    icon={FileText}
                  />

                  <DetailRow
                    label="Scheduled for"
                    value={
                      scheduledFor
                        ? formatDate(scheduledFor, true) || "Not specified"
                        : "Not scheduled"
                    }
                    icon={CalendarDays}
                  />

                  {pickupLocation && (
                    <DetailRow
                      label="Pickup location"
                      value={pickupLocation}
                      icon={MapPin}
                    />
                  )}

                  {deliveryLocation && (
                    <DetailRow
                      label="Delivery location"
                      value={deliveryLocation}
                      icon={MapPin}
                    />
                  )}
                </div>
              </section>

              {items.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <SectionHeading
                    icon={ShoppingBag}
                    title="Requested items"
                    description={`${items.length} ${
                      items.length === 1 ? "item" : "items"
                    } included in this request.`}
                  />

                  <div className="mt-5 space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={
                          item.id ??
                          `${item.item_name ?? item.name ?? "item"}-${index}`
                        }
                        className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="flex min-w-0 gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-extrabold text-[#14213d]">
                              {item.item_name ??
                                item.name ??
                                `Item ${index + 1}`}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Quantity: {item.quantity ?? 1}{" "}
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
                          </div>
                        </div>

                        <div className="shrink-0 sm:text-right">
                          {item.estimated_unit_price != null && (
                            <>
                              <p className="text-xs font-semibold text-slate-500">
                                Est. per unit
                              </p>
                              <p className="mt-1 text-sm font-extrabold text-[#14213d]">
                                {formatCurrency(
                                  item.estimated_unit_price,
                                  currency,
                                )}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {offer?.proposed_total != null && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                      {offer.proposed_item_total != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Items</span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              offer.proposed_item_total,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {offer.proposed_service_fee != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Service fee</span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              offer.proposed_service_fee,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {offer.proposed_delivery_fee != null && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Delivery fee
                          </span>
                          <span className="font-semibold text-[#14213d]">
                            {formatCurrency(
                              offer.proposed_delivery_fee,
                              currency,
                            )}
                          </span>
                        </div>
                      )}

                      {offer.proposed_other_fees != null &&
                        Number(offer.proposed_other_fees) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Other fees</span>
                            <span className="font-semibold text-[#14213d]">
                              {formatCurrency(
                                offer.proposed_other_fees,
                                currency,
                              )}
                            </span>
                          </div>
                        )}

                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
                        <span className="font-bold text-[#14213d]">Total</span>
                        <span className="font-extrabold text-[#14213d]">
                          {formatCurrency(
                            offer.proposed_total,
                            currency,
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={Activity}
                  title="Errand progress"
                  description="Follow the lifecycle and track the fund-release milestones."
                />

                <ErrandProgress
                  errand={errand}
                  offer={offer}
                  status={errandStatus}
                  releaseRequest={releaseRequest}
                  releaseEvents={releaseEvents}
                  releaseLoading={releaseLoading}
                  releaseError={releaseError}
                  onRefreshRelease={handleRefreshRelease}
                />
              </section>

              {customerNotes && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <SectionHeading
                    icon={FileText}
                    title="Customer instructions"
                    description="Instructions and context supplied with the request."
                  />

                  <p className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                    {customerNotes}
                  </p>
                </section>
              )}
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={CheckCircle2}
                  title="Current status"
                  description="The latest offer and errand state."
                />

                <div className="mt-5 rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold ${offerStatusMeta.className}`}
                    >
                      <OfferStatusIcon size={15} />
                      {offerStatusMeta.label}
                    </span>

                    {fundingLoading ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <LoaderCircle
                          size={13}
                          className="animate-spin"
                        />
                        Checking funding...
                      </span>
                    ) : (
                      <FundingBadge status={fundingStatus} />
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {isFunded
                      ? "The backend reports that the errand is funded. Follow the agreed process before starting work."
                      : "Do not purchase items or begin work based solely on offer acceptance. Wait for funding confirmation."}
                  </p>

                  {canRequestFunds && (
                    <>
                      {releaseStatusUnknown && (
                        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                          Release status couldn&apos;t be verified. You can
                          still submit — the backend will confirm any
                          existing request and prevent duplicates.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleRequestFunds}
                        disabled={releaseSubmitting}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#35d07f] px-4 py-3 text-sm font-extrabold text-[#14213d] transition hover:bg-[#27bd6f] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {releaseSubmitting ? (
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <Send size={17} />
                        )}
                        {requestButtonLabel}
                      </button>
                    </>
                  )}

                  {hasActiveOrCompletedReleaseRequest && (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      A fund-release request already exists for this errand.
                      Check the progress section for the latest status.
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
                      Keep changes to your agreed scope and budget explicit.
                      Review any proposed changes before approving them.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <SectionHeading
                  icon={Wallet}
                  title="Offer summary"
                  description="Your proposed amount and terms."
                />

                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Proposed amount
                    </span>

                    <span className="text-sm font-extrabold text-[#14213d]">
                      {formatCurrency(offerAmount, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Transaction currency
                    </span>

                    <span className="text-sm font-bold text-[#14213d]">
                      {currency}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Offer status
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${offerStatusMeta.className}`}
                    >
                      {offerStatusMeta.label}
                    </span>
                  </div>

                  {offerCreatedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Submitted
                      </span>

                      <span className="text-sm font-bold text-[#14213d]">
                        {formatDate(offerCreatedAt) || "Not recorded"}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs leading-5 text-slate-500">
                      Final charges, platform fees, and fund-release terms
                      depend on the agreed errand scope and enabled payment
                      features.
                    </p>
                  </div>
                </div>
              </section>

              {(offer?.offer_message || offer?.message || offer?.notes) && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <SectionHeading
                    icon={FileText}
                    title="Your offer notes"
                    description="Information you submitted with this offer."
                  />

                  {(offer?.offer_message || offer?.message) && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Message
                      </p>
                      <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        {offer.offer_message || offer.message}
                      </p>
                    </div>
                  )}

                  {offer?.notes && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Additional notes
                      </p>
                      <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        {offer.notes}
                      </p>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl bg-[#14213d] p-5 text-white sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <ShieldCheck size={22} className="text-[#35d07f]" />
                </div>

                <h2 className="mt-4 text-lg font-extrabold">
                  Need assistance?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  If the offer details, funding status, or progress look
                  incorrect, keep your reference number available when
                  contacting support.
                </p>

                {offerReference && (
                  <p className="mt-4 break-words rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/90">
                    Offer reference:{" "}
                    {String(offerReference).slice(0, 18)}
                  </p>
                )}
              </section>

              <button
                type="button"
                onClick={() => navigate("/dashboard/my-offers")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#14213d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Return to My Offers
              </button>
            </aside>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}