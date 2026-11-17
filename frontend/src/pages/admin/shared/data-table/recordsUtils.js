import { toast } from "sonner";

/* ------------------------------- Constants ------------------------------- */

export const PAGE_SIZES = [10, 20, 50, 100];
export const MAX_CARD_FIELDS = 6;
export const DEFAULT_CARD_FIELDS = 4;

export const ROLE_LABELS = {
  super_admin: "Super administrator",
  finance_admin: "Finance administrator",
  support_admin: "Support administrator",
  trust_safety_admin: "Trust & Safety administrator",
  verification_admin: "Verification administrator",
  operations_admin: "Operations administrator",
  read_only_auditor: "Read-only auditor",
};

export const STATUS_COLUMNS = ["status", "account_status", "verification_status"];

export const COPYABLE_REFERENCE_KEYS = new Set([
  "reference",
  "reference_code",
  "issue_reference",
  "provider_reference",
  "provider_transfer_reference",
  "provider_refund_reference",
]);

export const PERSON_ID_KEYS = new Set([
  "profile_id",
  "user_id",
  "customer_id",
  "erander_id",
  "requested_by",
  "assigned_erander_id",
  "payer_id",
  "recipient_id",
  "offered_by",
  "actor_id",
  "performed_by",
  "created_by",
  "changed_by",
  "reviewed_by",
  "resolved_by",
  "waived_by",
  "trust_safety_decided_by",
  "finance_authorized_by",
  "target_profile_id",
]);

export const ID_KEYS = new Set([
  ...PERSON_ID_KEYS,
  "id",
  "related_erand_id",
  "erand_id",
  "wallet_id",
  "payment_id",
  "reservation_id",
  "security_account_id",
  "withdrawal_account_id",
  "wallet_transaction_id",
  "accepted_offer_id",
  "business_id",
  "assignment_id",
  "related_payment_id",
  "related_withdrawal_request_id",
  "related_wallet_transaction_id",
  "related_wallet_id",
]);

export const MONEY_MINOR_KEYS = [
  "amount_minor",
  "fee_minor",
  "net_amount_minor",
  "requested_amount_minor",
  "approved_amount_minor",
  "expected_amount_minor",
  "actual_amount_minor",
  "difference_amount_minor",
  "available_balance",
  "pending_balance",
  "reserved_balance",
];

export const MONEY_MAJOR_KEYS = ["amount", "estimated_total"];

export const isMoneyColumn = (column) =>
  MONEY_MINOR_KEYS.includes(column) || MONEY_MAJOR_KEYS.includes(column);

const MONEY_PRIORITY = [
  "amount_minor",
  "requested_amount_minor",
  "net_amount_minor",
  "approved_amount_minor",
  "amount",
  "estimated_total",
  "available_balance",
];

export const EXCLUDED_USER_COLUMNS = [
  "id",
  "last_name",
  "other_names",
  "avatar_url",
  "display_name",
];

const TITLE_KEYS = [
  "reference_code",
  "reference",
  "issue_reference",
  "title",
  "name",
  "display_name",
];

export const WITHDRAWAL_ACTIONS = {
  approve: {
    title: "Approve withdrawal",
    body: "Approval does not send the transfer. You can start the transfer as a separate step.",
    label: "Approve withdrawal",
    tone: "green",
  },
  reject: {
    title: "Reject withdrawal",
    body: "The reserved funds return to the user's available balance. The user sees your reason.",
    label: "Reject withdrawal",
    tone: "danger",
    needsReason: true,
  },
  process: {
    title: "Initiate Paystack transfer",
    body: "This may move real money if live Paystack credentials are configured.",
    label: "Initiate transfer",
    tone: "navy",
    warn: true,
  },
  verify: {
    title: "Verify transfer status",
    body: "This asks Paystack for the latest status of the transfer.",
    label: "Verify transfer",
    tone: "navy",
  },
};

/* ------------------------------ Status tones ----------------------------- */

const SUCCESS = [
  "active",
  "successful",
  "succeeded",
  "completed",
  "confirmed",
  "verified",
  "released",
  "settled",
  "resolved",
  "approved",
];

const ATTENTION = [
  "pending",
  "submitted",
  "under_review",
  "investigating",
  "processing",
  "awaiting_funding",
  "open",
  "reserved",
];

const DANGER = [
  "failed",
  "rejected",
  "suspended",
  "cancelled",
  "disputed",
  "ignored",
  "deactivated",
];

export function statusGroup(value) {
  const status = String(value || "").toLowerCase();
  if (SUCCESS.includes(status)) return "success";
  if (ATTENTION.includes(status)) return "attention";
  if (DANGER.includes(status)) return "danger";
  return "neutral";
}

export const GROUP_TONE = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  attention: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-surface-muted text-content-muted ring-line",
};

export const GROUP_BAR = {
  success: "bg-emerald-500",
  attention: "bg-amber-400",
  danger: "bg-rose-500",
  neutral: "bg-content-subtle",
};

/* -------------------------------- Helpers -------------------------------- */

export function humanize(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function can(permissions, permission) {
  return permissions.includes("*") || permissions.includes(permission);
}

export function fullName(profile) {
  if (!profile) return "Unknown user";
  const name = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || profile.display_name || profile.other_names || "Unnamed user";
}

export function shortId(value) {
  return typeof value === "string" && value.length > 22
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : String(value ?? "—");
}

export function currencyValue(value, currencyCode, minor = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);

  const amount = minor ? number / 100 : number;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode || ""} ${amount.toFixed(2)}`.trim();
  }
}

export function formatValue(key, value, row = {}) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (key.endsWith("_at")) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  if (MONEY_MINOR_KEYS.includes(key))
    return currencyValue(value, row.currency_code, true);

  if (MONEY_MAJOR_KEYS.includes(key))
    return currencyValue(value, row.currency_code, false);

  if (key === "reserved_by_currency" && Array.isArray(value))
    return (
      value
        .map(
          (item) =>
            `${item.currency_code}: ${currencyValue(
              item.amount_minor,
              item.currency_code,
              true
            )}`
        )
        .join(" · ") || "—"
    );

  if (typeof value === "object") return JSON.stringify(value, null, 2);

  return String(value);
}

export function formatRelative(date) {
  if (!date) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function getRowStatus(row) {
  return String(
    row?.status || row?.account_status || row?.verification_status || ""
  ).toLowerCase();
}

export function getTitleKey(row, section) {
  if (section === "users") return "first_name";
  return TITLE_KEYS.find((key) => row?.[key]) || null;
}

export function getRowTitle(row, section) {
  if (!row) return "Record";
  if (section === "users") return fullName(row);

  const key = TITLE_KEYS.find((item) => row[item]);
  if (key) return String(row[key]);

  const owner = row.wallet_owner || row.erander_owner;
  if (owner) return fullName(owner);

  return shortId(row.id);
}

export function getDefaultCardColumns(columns, section, sampleRow) {
  const skip = new Set([
    "id",
    "avatar_url",
    "last_name",
    "other_names",
    "display_name",
    ...STATUS_COLUMNS,
  ]);

  const titleKey = getTitleKey(sampleRow, section);
  if (titleKey) skip.add(titleKey);

  return columns
    .filter((column) => !skip.has(column))
    .slice(0, DEFAULT_CARD_FIELDS);
}

export function getPageTotals(rows, columns) {
  const key = MONEY_PRIORITY.find((item) => columns.includes(item));
  if (!key) return null;

  const minor = MONEY_MINOR_KEYS.includes(key);
  const map = new Map();

  rows.forEach((row) => {
    const number = Number(row[key]);
    if (!Number.isFinite(number)) return;

    const currency = row.currency_code || "NGN";
    map.set(currency, (map.get(currency) || 0) + (minor ? number / 100 : number));
  });

  if (!map.size) return null;

  return {
    key,
    totals: [...map.entries()].map(([currency, amount]) => ({
      currency,
      amount,
    })),
  };
}

export function compareValues(key, first, second) {
  const firstEmpty = first === null || first === undefined || first === "";
  const secondEmpty = second === null || second === undefined || second === "";

  if (firstEmpty && secondEmpty) return 0;
  if (firstEmpty) return 1;
  if (secondEmpty) return -1;

  const firstNumber = Number(first);
  const secondNumber = Number(second);

  if (
    typeof first !== "boolean" &&
    Number.isFinite(firstNumber) &&
    Number.isFinite(secondNumber)
  )
    return firstNumber - secondNumber;

  if (key.endsWith("_at")) {
    const firstDate = Date.parse(first);
    const secondDate = Date.parse(second);
    if (Number.isFinite(firstDate) && Number.isFinite(secondDate))
      return firstDate - secondDate;
  }

  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/* ------------------------------ Clipboard/Export ------------------------- */

export async function copyText(value, label = "Copied") {
  if (value === null || value === undefined || value === "") return;

  const text =
    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      toast.success(label);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  }
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportRows(format, { section, dataset, columns, rows, scope }) {
  if (!rows.length || !columns.length) return;

  const safeRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
  );

  const base = `erander-${section}-${dataset}-${scope}`;

  const plain = (value) =>
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  if (format === "json") {
    downloadFile(
      `${base}.json`,
      JSON.stringify(safeRows, null, 2),
      "application/json;charset=utf-8"
    );
    return;
  }

  if (format === "tsv") {
    const clean = (value) =>
      plain(value).replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");

    downloadFile(
      `${base}.tsv`,
      [
        columns.join("\t"),
        ...safeRows.map((row) => columns.map((c) => clean(row[c])).join("\t")),
      ].join("\r\n"),
      "text/tab-separated-values;charset=utf-8"
    );
    return;
  }

  const quote = (value) => `"${plain(value).replaceAll('"', '""')}"`;

  const content = [
    columns.map(quote).join(","),
    ...safeRows.map((row) => columns.map((c) => quote(row[c])).join(",")),
  ].join("\r\n");

  downloadFile(`${base}.csv`, `\uFEFF${content}`, "text/csv;charset=utf-8");
}