import {
  Check,
  AlertTriangle,
  XCircle,
  Clock3,
  Wallet,
  UserRound,
  ChevronDown,
} from "lucide-react";

import {
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
} from "date-fns";

import StatusBadge from "./StatusBadge";

const MILESTONES = [
  {
    key: "created",
    label: "Errand created",
    short: "Created",
    description: "The customer created the errand.",
  },
  {
    key: "assigned",
    label: "Erander assigned",
    short: "Assigned",
    description: "An erander was selected for the errand.",
  },
  {
    key: "funded",
    label: "Errand funded",
    short: "Funded",
    description: "The customer successfully funded the errand.",
  },
  {
    key: "release_requested",
    label: "Funds requested",
    short: "Funds requested",
    description: "The erander requested the release of funds.",
  },
  {
    key: "release_processing",
    label: "Fund processing",
    short: "Processing",
    description: "The fund-release request is being processed.",
  },
  {
    key: "funds_released",
    label: "Funds released",
    short: "Funds released",
    description: "The funds have been released to the erander.",
  },
  {
    key: "in_progress",
    label: "Errand in progress",
    short: "In progress",
    description: "The erander is carrying out the errand.",
  },
  {
    key: "completed",
    label: "Errand completed",
    short: "Completed",
    description: "The errand has been completed.",
  },
];

const RELEASE_STAGE = {
  pending: "release_requested",
  approved: "release_processing",
  processing: "release_processing",
  released: "funds_released",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const getValue = (object, keys, fallback = null) => {
  if (!object || typeof object !== "object") {
    return fallback;
  }

  for (const key of keys) {
    const value = object[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
};

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const formatDateTime = (value) => {
  if (!value) return null;

  let date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = parseISO(value);
  } else {
    date = new Date(value);
  }

  if (!isValid(date)) {
    return null;
  }

  return {
    relativeTime: formatDistanceToNow(date, {
      addSuffix: true,
    }),
    exactTime: format(date, "dd MMM yyyy, hh:mm a"),
  };
};

const getReleaseRequest = (fundRelease) => {
  if (!fundRelease || typeof fundRelease !== "object") {
    return null;
  }

  return fundRelease.request || fundRelease;
};

const getPersonName = (person) => {
  if (!person) return null;

  if (typeof person === "string" && !/^\d+$/.test(person)) {
    return person;
  }

  if (typeof person !== "object") {
    return null;
  }

  const displayName = getValue(
    person,
    ["display_name", "displayName", "full_name", "fullName", "name"],
    null
  );

  if (displayName) return displayName;

  const firstName = getValue(person, ["first_name", "firstName"], "");
  const otherNames = getValue(person, ["other_names", "otherNames"], "");
  const lastName = getValue(person, ["last_name", "lastName"], "");

  const combined = [firstName, otherNames, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return combined || null;
};

const getAssignedEranderName = (errand, suppliedName) => {
  if (suppliedName) {
    return suppliedName;
  }

  const assignedErander = getValue(
    errand,
    [
      "assigned_erander",
      "assignedErander",
      "erander",
      "errander",
      "assignee",
    ],
    null
  );

  const acceptedOffer = getValue(
    errand,
    ["accepted_offer", "acceptedOffer"],
    null
  );

  return (
    getPersonName(assignedErander) ||
    getPersonName(acceptedOffer?.erander) ||
    getPersonName(getValue(errand, ["offer"], null)?.erander) ||
    getValue(
      errand,
      [
        "assigned_erander_name",
        "assignedEranderName",
        "erander_display_name",
        "erander_name",
        "assignee_name",
      ],
      null
    )
  );
};

const getCustomerName = (errand) =>
  getPersonName(
    getValue(errand, ["customer", "requested_by_profile", "requester"], null)
  );

const getReleaseStatus = (fundRelease) => {
  const releaseRequest = getReleaseRequest(fundRelease);

  return String(getValue(releaseRequest, ["status"], "")).toLowerCase();
};

const isErrandAssigned = (errand) => {
  const assignedEranderId = getValue(
    errand,
    ["assigned_erander_id", "assignedEranderId"],
    null
  );

  const acceptedOfferId = getValue(
    errand,
    ["accepted_offer_id", "acceptedOfferId"],
    null
  );

  const status = String(getValue(errand, ["status"], "")).toLowerCase();

  return (
    hasValue(assignedEranderId) ||
    hasValue(acceptedOfferId) ||
    [
      "offer_selected",
      "assigned",
      "awaiting_funding",
      "funded",
      "in_progress",
      "completed",
    ].includes(status)
  );
};

const isErrandFunded = (errand, payment) => {
  const errandStatus = String(getValue(errand, ["status"], "")).toLowerCase();

  const paymentStatus = String(
    getValue(payment, ["status", "paymentStatus", "fundingStatus"], "")
  ).toLowerCase();

  const amountFunded = Number(
    getValue(payment, ["amountFunded", "amount_funded"], 0)
  );

  return (
    ["funded", "in_progress", "completed"].includes(errandStatus) ||
    [
      "funded",
      "fully_funded",
      "successful",
      "confirmed",
      "succeeded",
    ].includes(paymentStatus) ||
    amountFunded > 0
  );
};

const indexOfKey = (key) => MILESTONES.findIndex((item) => item.key === key);

const getCompletedMilestoneIndex = (errand, payment, fundRelease) => {
  const errandStatus = String(getValue(errand, ["status"], "")).toLowerCase();

  const releaseStatus = getReleaseStatus(fundRelease);

  if (errandStatus === "completed") return indexOfKey("completed");

  if (errandStatus === "in_progress") return indexOfKey("in_progress");

  if (RELEASE_STAGE[releaseStatus]) {
    return indexOfKey(RELEASE_STAGE[releaseStatus]);
  }

  if (isErrandFunded(errand, payment)) return indexOfKey("funded");

  if (isErrandAssigned(errand)) return indexOfKey("assigned");

  return indexOfKey("created");
};

const getCurrentStage = (errand, payment, fundRelease) => {
  const errandStatus = String(getValue(errand, ["status"], "")).toLowerCase();

  if (errandStatus === "disputed") return "disputed";

  if (["cancelled", "canceled"].includes(errandStatus)) {
    return "cancelled";
  }

  if (errandStatus === "expired") return "expired";

  return (
    MILESTONES[getCompletedMilestoneIndex(errand, payment, fundRelease)]
      ?.key || "created"
  );
};

const getReleaseEventTimestamp = (fundRelease, eventTypes) => {
  const events = Array.isArray(fundRelease?.events) ? fundRelease.events : [];

  const matchingEvent = events.find((event) =>
    eventTypes.includes(
      String(getValue(event, ["type", "event", "action"], "")).toLowerCase()
    )
  );

  return getValue(
    matchingEvent,
    ["occurredAt", "occurred_at", "createdAt", "created_at"],
    null
  );
};

const getMilestoneTimestamp = (key, timestamps, errand, fundRelease) => {
  const explicitTimestamp = getValue(timestamps, [key], null);

  if (explicitTimestamp) {
    return explicitTimestamp;
  }

  const releaseRequest = getReleaseRequest(fundRelease);

  switch (key) {
    case "created":
      return getValue(errand, ["created_at", "createdAt"], null);

    case "assigned":
      return getValue(
        errand,
        ["agreement_accepted_at", "agreementAcceptedAt"],
        null
      );

    case "funded":
      return getValue(
        errand,
        ["agreement_locked_at", "agreementLockedAt"],
        null
      );

    case "release_requested":
      return (
        getValue(releaseRequest, ["requestedAt", "requested_at"], null) ||
        getReleaseEventTimestamp(fundRelease, ["fund_release_requested"])
      );

    case "release_processing":
      return (
        getValue(
          releaseRequest,
          [
            "releaseInitiatedAt",
            "release_initiated_at",
            "reviewedAt",
            "reviewed_at",
          ],
          null
        ) ||
        getReleaseEventTimestamp(fundRelease, [
          "fund_release_approved",
          "fund_release_processing",
          "release_processing",
        ])
      );

    case "funds_released":
      return (
        getValue(releaseRequest, ["releasedAt", "released_at"], null) ||
        getReleaseEventTimestamp(fundRelease, [
          "fund_release_released",
          "funds_released",
        ])
      );

    default:
      return null;
  }
};

const getMilestoneState = (index, completedIndex, currentStage) => {
  if (currentStage === "disputed") return "disputed";
  if (currentStage === "cancelled") return "cancelled";
  if (currentStage === "expired") return "expired";

  if (index < completedIndex) return "done";
  if (index === completedIndex) return "current";

  return "upcoming";
};

const getMilestoneDescription = ({
  milestone,
  currentStage,
  assignedEranderName,
  customerName,
  viewerRole,
}) => {
  if (currentStage === "disputed") {
    return "This errand is currently under dispute review.";
  }

  if (currentStage === "cancelled") {
    return "This errand has been cancelled.";
  }

  if (currentStage === "expired") {
    return "This errand has expired.";
  }

  if (milestone.key === "created") {
    return viewerRole === "customer"
      ? "You created this errand."
      : customerName
        ? `${customerName} created this errand.`
        : "The customer created this errand.";
  }

  if (milestone.key === "assigned") {
    return viewerRole === "customer"
      ? assignedEranderName
        ? `${assignedEranderName} was assigned to this errand.`
        : "An erander was assigned to this errand."
      : "You have been selected for this errand.";
  }

  return milestone.description;
};

/* -------------------------------------------------------------------------- */
/*                                  RAIL NODE                                 */
/* -------------------------------------------------------------------------- */

function RailNode({ state }) {
  if (state === "done") {
    return (
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-brand-mint">
        <Check size={15} strokeWidth={3} />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-brand-green text-brand-navy ring-4 ring-brand-pale">
        <Check size={15} strokeWidth={3} />
      </span>
    );
  }

  if (state === "disputed") {
    return (
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
        <AlertTriangle size={15} />
      </span>
    );
  }

  if (state === "cancelled" || state === "expired") {
    return (
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-content-muted">
        <XCircle size={15} />
      </span>
    );
  }

  return (
    <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-surface-white" />
  );
}

function RailStep({ milestone, state, index, total, completedIndex }) {
  const leftFilled = index > 0 && index <= completedIndex && state !== "upcoming";
  const rightFilled = index < completedIndex && ["done", "current"].includes(state);

  const muted = state === "upcoming";

  return (
    <li
      className="mt-2 relative flex min-w-[96px] flex-1 snap-start flex-col items-center px-1 text-center"
      aria-current={state === "current" ? "step" : undefined}
    >
      {index > 0 && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-[15px] h-0.5 w-1/2 ${
            leftFilled ? "bg-brand-navy" : "bg-line"
          }`}
        />
      )}

      {index < total - 1 && (
        <span
          aria-hidden="true"
          className={`absolute right-0 top-[15px] h-0.5 w-1/2 ${
            rightFilled ? "bg-brand-navy" : "bg-line"
          }`}
        />
      )}

      <RailNode state={state} />

      <span
        className={`mt-2.5 text-xs text-nowrap leading-4 ${
          state === "current"
            ? "font-extrabold text-content"
            : muted
              ? "font-medium text-content-subtle"
              : "font-semibold text-content-muted"
        }`}
      >
        {milestone.short}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                               FOCUS + HISTORY                              */
/* -------------------------------------------------------------------------- */

function ExceptionalStatus({ status }) {
  if (!["disputed", "cancelled", "expired"].includes(status)) {
    return null;
  }

  const config = {
    disputed: {
      title: "Errand under review",
      description:
        "Progress is paused while the dispute is reviewed. Updates will appear here as the review progresses.",
      className: "border-rose-400 bg-rose-50",
      titleClassName: "text-rose-900",
      descriptionClassName: "text-rose-800",
      icon: AlertTriangle,
    },
    cancelled: {
      title: "Errand cancelled",
      description:
        "This errand has been cancelled. Refer to the errand record for further details.",
      className: "border-line-strong bg-surface",
      titleClassName: "text-content",
      descriptionClassName: "text-content-muted",
      icon: XCircle,
    },
    expired: {
      title: "Errand expired",
      description: "This errand has expired and is no longer progressing.",
      className: "border-amber-400 bg-amber-50",
      titleClassName: "text-amber-900",
      descriptionClassName: "text-amber-800",
      icon: AlertTriangle,
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <div
      role="status"
      className={`mt-5 flex items-start gap-3 rounded-r-2xl border-l-4 p-4 ${item.className}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />

      <div className="min-w-0">
        <p className={`text-sm font-bold ${item.titleClassName}`}>
          {item.title}
        </p>

        <p
          className={`mt-1 text-sm leading-6 ${item.descriptionClassName}`}
        >
          {item.description}
        </p>
      </div>
    </div>
  );
}

function FocusPanel({
  milestone,
  description,
  timestamp,
  assignedEranderName,
  showAssignedErander,
  viewerRole,
  fundCta,
}) {
  const formatted = formatDateTime(timestamp);

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-content-muted">
          Current stage
        </p>

        <p className="mt-1 text-lg font-extrabold tracking-tight text-content">
          {milestone.label}
        </p>

        <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
          {description}
        </p>

        {formatted && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-content-muted">
            <Clock3 size={13} aria-hidden="true" />
            <span className="font-bold text-content">
              {formatted.relativeTime}
            </span>
            on {formatted.exactTime}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
        {showAssignedErander &&
          viewerRole !== "erander" &&
          assignedEranderName && (
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-white px-3 py-1.5 text-xs font-semibold text-content shadow-sm ring-1 ring-line-soft">
              <UserRound size={14} aria-hidden="true" />
              {assignedEranderName}
            </span>
          )}

        {fundCta}
      </div>
    </div>
  );
}

function HistoryList({ items }) {
  return (
    <ol className="divide-y divide-line-soft">
      {items.map(({ milestone, state, timestamp, description }) => {
        const formatted = formatDateTime(timestamp);
        const reached = state === "done" || state === "current";

        return (
          <li
            key={milestone.key}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3"
          >
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  reached ? "text-content" : "text-content-subtle"
                }`}
              >
                {milestone.label}
              </p>

              <p
                className={`mt-0.5 text-xs leading-5 ${
                  reached ? "text-content-muted" : "text-content-subtle"
                }`}
              >
                {description}
              </p>
            </div>

            <p className="shrink-0 text-xs font-medium text-content-muted sm:text-right">
              {formatted
                ? formatted.exactTime
                : reached
                  ? "Date and time not available"
                  : "Not reached yet"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAIN EXPORT                                 */
/* -------------------------------------------------------------------------- */

export default function ProgressTracker({
  errand,
  payment,
  fundRelease,
  timestamps = {},
  assignedEranderName: suppliedEranderName,
  onFundNow,
  canFund = false,
  showAssignedErander = true,
  viewerRole = "customer",
  compact = false,
}) {
  const completedIndex = getCompletedMilestoneIndex(
    errand,
    payment,
    fundRelease
  );

  const currentStage = getCurrentStage(errand, payment, fundRelease);

  const assignedEranderName = getAssignedEranderName(
    errand,
    suppliedEranderName
  );

  const customerName = getCustomerName(errand);

  const exceptional = ["disputed", "cancelled", "expired"].includes(
    currentStage
  );

  const visibleMilestones = compact
    ? MILESTONES.filter((milestone) =>
        [
          "created",
          "assigned",
          "funded",
          "funds_released",
          "in_progress",
          "completed",
        ].includes(milestone.key)
      )
    : MILESTONES;

  const rows = visibleMilestones.map((milestone) => {
    const index = indexOfKey(milestone.key);

    return {
      milestone,
      index,
      state: getMilestoneState(index, completedIndex, currentStage),
      timestamp: getMilestoneTimestamp(
        milestone.key,
        timestamps,
        errand,
        fundRelease
      ),
      description: getMilestoneDescription({
        milestone,
        currentStage,
        assignedEranderName,
        customerName,
        viewerRole,
      }),
    };
  });

  const focusMilestone =
    MILESTONES[completedIndex] || MILESTONES[0];

  const focusRow =
    rows.find((row) => row.milestone.key === focusMilestone.key) ||
    rows[rows.length - 1];

  const fundCta =
    canFund && currentStage === "assigned" && onFundNow ? (
      <button
        type="button"
        onClick={onFundNow}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-bold text-content-inverse shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2"
      >
        <Wallet size={16} aria-hidden="true" />
        Fund this errand
      </button>
    ) : null;

  return (
    <section
      aria-label="Errand progress"
      className="rounded-3xl border border-line bg-surface-white p-5 shadow-erander-card sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-tight text-content">
          Errand progress
        </h3>

        <StatusBadge status={getValue(errand, ["status"], "unknown")} />
      </div>

      <div className="-mx-1 overflow-x-auto pb-2">
        <ol className="flex min-w-max snap-x sm:min-w-0">
          {rows.map((row, position) => (
            <RailStep
              key={row.milestone.key}
              milestone={row.milestone}
              state={row.state}
              index={position}
              total={rows.length}
              completedIndex={
                rows.findIndex((item) => item.state === "current") >= 0
                  ? rows.findIndex((item) => item.state === "current")
                  : exceptional
                    ? rows.findIndex(
                        (item) => item.index === completedIndex
                      )
                    : completedIndex
              }
            />
          ))}
        </ol>
      </div>

      {exceptional ? (
        <ExceptionalStatus status={currentStage} />
      ) : (
        <FocusPanel
          milestone={focusRow.milestone}
          description={focusRow.description}
          timestamp={focusRow.timestamp}
          assignedEranderName={assignedEranderName}
          showAssignedErander={showAssignedErander}
          viewerRole={viewerRole}
          fundCta={fundCta}
        />
      )}

      <details className="group mt-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-content-muted transition hover:text-content [&::-webkit-details-marker]:hidden">
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="transition-transform group-open:rotate-180"
          />
          Show full history
        </summary>

        <div className="mt-3">
          <HistoryList items={rows} />
        </div>
      </details>
    </section>
  );
}
