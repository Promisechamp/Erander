import { ExternalLink } from "lucide-react";

import {
  Avatar,
  CopyButton,
  PersonButton,
  StatusPill,
  TruncatedText,
} from "./RecordsUI";

import {
  COPYABLE_REFERENCE_KEYS,
  ID_KEYS,
  PERSON_ID_KEYS,
  STATUS_COLUMNS,
  formatValue,
  humanize,
  shortId,
} from "./recordsUtils";

const PRIORITY_TONE = {
  low: "bg-surface-muted text-content-muted",
  normal: "bg-sky-50 text-sky-800",
  high: "bg-amber-50 text-amber-800",
  urgent: "bg-rose-50 text-rose-800",
};

function getSupportCustomer(row) {
  return row.user ?? row.profile ?? row.customer ?? null;
}

function getSupportCustomerName(customer) {
  if (!customer) return "Customer";

  const fullName = [
    customer.first_name,
    customer.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    customer.full_name ||
    customer.display_name ||
    customer.name ||
    fullName ||
    customer.email ||
    "Customer"
  );
}

function SupportCustomerCell({ row, openProfile, expandText }) {
  const customer = getSupportCustomer(row);

  const fallbackId = customer?.id ?? row.user_id;

  const name = getSupportCustomerName(customer);
  const contact =
    customer?.email ||
    customer?.phone ||
    "Customer contact unavailable";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar profile={customer} size="sm" />

      <div className="min-w-0 flex-1 text-left">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openProfile?.(customer, fallbackId);
          }}
          title="Open customer profile"
          className="block max-w-full truncate text-left text-xs font-bold text-content underline decoration-dotted decoration-line-strong underline-offset-4 hover:text-brand"
        >
          {name}
        </button>

        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <TruncatedText
            text={contact}
            title="Customer contact"
            limit={24}
            className="text-[11px] text-content-subtle"
            onExpand={expandText}
          />

          {customer?.email || customer?.phone ? (
            <CopyButton
              value={customer.email || customer.phone}
              label="Customer contact copied"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SupportPriorityCell({ value }) {
  const priority = String(value || "normal").toLowerCase();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
        PRIORITY_TONE[priority] || PRIORITY_TONE.normal
      }`}
    >
      {priority} priority
    </span>
  );
}

/**
 * One cell renderer shared by the table and cards.
 * ctx = { openProfile, openErrand, expandText }
 */
export default function RecordCell({
  row,
  column,
  section,
  ctx = {},
}) {
  const value = row[column];
  const label = humanize(column);

  const {
    openProfile,
    openErrand,
    expandText,
  } = ctx;

  /* Support ticket customer */

  if (section === "support" && column === "customer") {
    return (
      <SupportCustomerCell
        row={row}
        openProfile={openProfile}
        expandText={expandText}
      />
    );
  }

  /* Support ticket priority */

  if (section === "support" && column === "priority") {
    return <SupportPriorityCell value={value} />;
  }

  if (["wallet_owner", "erander_owner"].includes(column) && value) {
    return (
      <PersonButton
        profile={value}
        fallbackId={value.id}
        onClick={openProfile}
      />
    );
  }

  if (section === "users" && column === "first_name") {
    return (
      <PersonButton
        profile={row}
        fallbackId={row.id}
        onClick={openProfile}
      />
    );
  }

  if (
    ["errands", "disputes"].includes(section) &&
    ["reference_code", "title"].includes(column)
  ) {
    return (
      <span className="inline-flex max-w-full items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openErrand?.(row.id);
          }}
          title="Open errand"
          className="block max-w-[220px] truncate text-left text-xs font-bold text-success-dark hover:underline"
        >
          {String(value ?? "—")}
        </button>

        {column === "reference_code" ? (
          <CopyButton value={value} label="Errand reference copied" />
        ) : null}
      </span>
    );
  }

  if (COPYABLE_REFERENCE_KEYS.has(column)) {
    return (
      <span className="inline-flex max-w-full items-center gap-1">
        <TruncatedText
          text={value ?? ""}
          title={label}
          limit={22}
          mono
          onExpand={expandText}
        />
        <CopyButton value={value} />
      </span>
    );
  }

  if (ID_KEYS.has(column) || column.endsWith("_id")) {
    if (!value) {
      return (
        <span className="text-xs text-content-subtle">—</span>
      );
    }

    if (
      ["erand_id", "related_erand_id"].includes(column) &&
      row.related_erand
    ) {
      return (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openErrand?.(value);
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-success-dark hover:underline"
          >
            {row.related_erand.reference_code || shortId(value)}
            <ExternalLink size={12} aria-hidden="true" />
          </button>

          <CopyButton value={value} />
        </span>
      );
    }

    if (column !== "id") {
      const profile =
        row[`${column}_profile`] ||
        (column === "profile_id" && row.wallet_profile) ||
        (column === "erander_id" && row.erander_profile) ||
        null;

      if (profile || PERSON_ID_KEYS.has(column)) {
        return (
          <PersonButton
            profile={profile}
            fallbackId={value}
            onClick={openProfile}
          />
        );
      }
    }

    return (
      <span className="inline-flex max-w-full items-center gap-1">
        <TruncatedText
          text={value}
          display={shortId(value)}
          title={label}
          limit={22}
          mono
          onExpand={expandText}
        />
        <CopyButton value={value} />
      </span>
    );
  }

  if (STATUS_COLUMNS.includes(column) && value) {
    return <StatusPill value={value} />;
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-xs text-content-muted">
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (
    value &&
    typeof value === "object" &&
    column !== "reserved_by_currency"
  ) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          expandText?.({
            title: label,
            text: JSON.stringify(value, null, 2),
          });
        }}
        className="text-xs font-bold text-success-dark hover:underline"
      >
        View data
      </button>
    );
  }

  return (
    <TruncatedText
      text={formatValue(column, value, row)}
      title={label}
      onExpand={expandText}
    />
  );
}