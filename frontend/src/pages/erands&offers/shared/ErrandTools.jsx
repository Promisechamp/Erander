import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  LayoutGrid,
  Package,
  Plus,
  Receipt,
  Scale,
  Table2,
  Wallet,
} from "lucide-react";

import PaymentStatus from "./PaymentStatus";

/* -------------------------------------------------------------------------- */
/*                                DATA HELPERS                                */
/* -------------------------------------------------------------------------- */

const HIGH_FEE_SHARE = 0.4;

const getValue = (object, keys, fallback = undefined) => {
  if (!object || typeof object !== "object") return fallback;

  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

const toNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/** A real, positive amount, or null. Zero means "not set" for estimates. */
const positiveOrNull = (value) => {
  const number = toNumber(value);
  return number !== null && number > 0 ? number : null;
};

const getItemName = (item) =>
  getValue(
    item,
    ["item_name", "name", "title", "product_name"],
    getValue(item, ["description"], "Unnamed item")
  );

const getItemQuantity = (item, proposed = false) => {
  const keys = proposed
    ? ["proposed_quantity", "quantity", "qty", "requested_quantity"]
    : ["quantity", "qty", "requested_quantity"];

  const raw = getValue(item, keys, null);
  if (raw === null) return null;

  const quantity = toNumber(raw);
  return quantity !== null && quantity >= 0 ? quantity : null;
};

/**
 * Proposed prices only ever come from proposed_* fields. They never fall back
 * to the original estimate, so a missing proposal is reported as missing.
 */
const getItemPrice = (item, proposed = false) => {
  const keys = proposed
    ? ["proposed_unit_price", "proposed_price"]
    : [
        "estimated_unit_price",
        "estimated_price",
        "unit_price",
        "price",
        "amount",
      ];

  return toNumber(getValue(item, keys, null));
};

const getItemTotal = (item, proposed = false) => {
  const explicitTotal = getValue(
    item,
    proposed
      ? ["proposed_total", "proposed_line_total"]
      : ["total_price", "line_total", "subtotal", "total_amount"],
    null
  );

  if (explicitTotal !== null) return toNumber(explicitTotal);

  const price = getItemPrice(item, proposed);
  const quantity = getItemQuantity(item, proposed);

  if (price === null || quantity === null) return null;
  return price * quantity;
};

const getOriginalItemId = (item) =>
  getValue(item, ["id", "erand_item_id"], null);

const getProposedOriginalItemId = (item) =>
  getValue(item, ["erand_item_id", "original_item_id"], null);

const sumKnownTotals = (items, proposed = false) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  let total = 0;
  for (const item of items) {
    const itemTotal = getItemTotal(item, proposed);
    if (itemTotal === null) return null;
    total += itemTotal;
  }
  return total;
};

const moneyFormatters = new Map();

const getMoneyFormatter = (currency) => {
  const key = currency || "NGN";

  if (!moneyFormatters.has(key)) {
    moneyFormatters.set(
      key,
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: key,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  return moneyFormatters.get(key);
};

const formatMoney = (amount, currency = "NGN") => {
  const value = toNumber(amount);
  if (value === null) return "—";

  try {
    return getMoneyFormatter(currency).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

/** "fund_release_requested" becomes "Fund release requested". */
const formatLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const normalised = /[_-]/.test(text) ? text.replace(/[_-]+/g, " ") : text;

  return normalised.charAt(0).toUpperCase() + normalised.slice(1);
};

const getDifference = (original, proposed) => {
  const first = toNumber(original);
  const second = toNumber(proposed);

  if (first === null || second === null) {
    return {
      difference: null,
      percentage: null,
      increased: false,
      decreased: false,
      unchanged: false,
      available: false,
    };
  }

  const difference = second - first;
  const percentage = first > 0 ? (difference / first) * 100 : null;

  return {
    difference,
    percentage,
    increased: difference > 0,
    decreased: difference < 0,
    unchanged: difference === 0,
    available: true,
  };
};

const signed = (value, currency) => {
  const amount = toNumber(value);
  if (amount === null) return "—";
  if (amount === 0) return formatMoney(0, currency);
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
};

/**
 * Joins an offer's items with the errand's original items. Prices that were
 * not supplied stay null instead of becoming 0.
 */
const buildProposalItems = (offer, originalItems = []) => {
  const source = Array.isArray(offer?.items) ? offer.items : [];

  const byId = new Map(
    (Array.isArray(originalItems) ? originalItems : []).map((item) => [
      String(item.id),
      item,
    ])
  );

  return source.map((proposal) => {
    const original = byId.get(String(proposal.erand_item_id));

    return {
      ...original,
      ...proposal,
      id: proposal.erand_item_id || original?.id || proposal.id,
      erand_item_id: proposal.erand_item_id,
      item_name:
        proposal.item_name || original?.item_name || original?.name || "Errand item",
      description: proposal.description ?? original?.description ?? null,
      quantity: proposal.quantity ?? original?.quantity ?? 1,
      unit: proposal.unit ?? original?.unit ?? "item",
      estimated_unit_price: toNumber(original?.estimated_unit_price),
      proposed_quantity: toNumber(
        proposal.proposed_quantity ?? original?.quantity,
        1
      ),
      proposed_unit_price: toNumber(proposal.proposed_unit_price),
      notes: proposal.notes ?? null,
    };
  });
};

/* -------------------------------------------------------------------------- */
/*                              FEE CALCULATIONS                              */
/* -------------------------------------------------------------------------- */

/**
 * Fee values remain null when the backend did not provide them.
 * A missing fee is not silently treated as a confirmed zero fee.
 */
const getOfferFeeBreakdown = (offer) => {
  if (!offer || typeof offer !== "object") return null;

  const itemTotal = toNumber(offer.proposed_item_total);
  const serviceFee = toNumber(offer.proposed_service_fee);
  const deliveryFee = toNumber(offer.proposed_delivery_fee);
  const otherFees = toNumber(offer.proposed_other_fees);
  const proposedTotal = toNumber(offer.proposed_total);

  const hasAnyData = [
    itemTotal,
    serviceFee,
    deliveryFee,
    otherFees,
    proposedTotal,
  ].some((value) => value !== null);

  if (!hasAnyData) return null;

  const knownFeeValues = [serviceFee, deliveryFee, otherFees].filter(
    (value) => value !== null
  );
  const additionalFees =
    knownFeeValues.length === 3
      ? serviceFee + deliveryFee + otherFees
      : null;

  const allComponentsKnown =
    itemTotal !== null &&
    serviceFee !== null &&
    deliveryFee !== null &&
    otherFees !== null;

  const calculatedTotal = allComponentsKnown
    ? itemTotal + serviceFee + deliveryFee + otherFees
    : null;

  return {
    itemTotal,
    serviceFee,
    deliveryFee,
    otherFees,
    proposedTotal,
    calculatedTotal,
    additionalFees,
    allComponentsKnown,
  };
};

/* -------------------------------------------------------------------------- */
/*                                 ROLE WORDING                               */
/* -------------------------------------------------------------------------- */

const LABELS = {
  customer: {
    estimate: "Your estimate",
    estimateNoun: "your estimate",
    description:
      "How the erander's proposal compares with what you expected to pay.",
    above: "Costs more than your estimate",
    below: "Comes in under your estimate",
    match: "Matches your estimate",
    aboveAdvice: (amount) =>
      `Review the item changes and fees below before agreeing to pay ${amount}.`,
    belowAdvice:
      "Check that every item and service you asked for is still included.",
    matchAdvice:
      "Look through the items and fees to confirm the agreement is complete.",
    noEstimateAdvice:
      "You did not set a price estimate, so there is nothing to compare this against. Review the items and fees below.",
    incompleteAdvice:
      "The original estimate or complete proposed amount is missing. Review the available item and fee details before making a decision.",
    itemsDescription: "Your estimate against the erander's price for each item.",
    note: "Erander's note:",
    added: "Added by the erander",
    proposalNoun: "the erander's",
  },
  erander: {
    estimate: "Customer's estimate",
    estimateNoun: "the customer's estimate",
    description:
      "How your offer compares with what the customer expected to pay.",
    above: "Above the customer's estimate",
    below: "Under the customer's estimate",
    match: "Matches the customer's estimate",
    aboveAdvice: () =>
      "Make sure the items and fees justify the difference. The customer will see this comparison.",
    belowAdvice:
      "Your offer is lower than the customer expected. Check that it covers every item.",
    matchAdvice: "Your offer is in line with what the customer expected.",
    noEstimateAdvice:
      "The customer did not set a price estimate, so there is nothing to compare your offer against.",
    incompleteAdvice:
      "The customer's estimate or your complete offer amount is missing.",
    itemsDescription: "The customer's estimate against your price for each item.",
    note: "Your note:",
    added: "Added by you",
    proposalNoun: "your",
  },
};

/* -------------------------------------------------------------------------- */
/*                              SHARED UI ELEMENTS                            */
/* -------------------------------------------------------------------------- */

function Block({
  title,
  description,
  icon: Icon,
  children,
  action,
  className = "",
}) {
  return (
    <section className={`py-7 first:pt-0 last:pb-0 ${className}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-content">
            {Icon && (
              <Icon
                size={18}
                strokeWidth={2}
                className="shrink-0 text-content-subtle"
                aria-hidden="true"
              />
            )}
            {title}
          </h3>
          {description && (
            <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SubHeading({ title, description, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h4 className="text-base font-bold text-content">{title}</h4>
        {description && (
          <p className="mt-0.5 text-sm text-content-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message, icon: Icon = Info }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center">
      <Icon
        size={22}
        className="mx-auto text-content-subtle"
        aria-hidden="true"
      />
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-content-muted">
        {message}
      </p>
    </div>
  );
}

function PriceValue({ amount, currency, className = "" }) {
  return (
    <span className={`font-bold tabular-nums text-content ${className}`}>
      {formatMoney(amount, currency)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "neutral",
}) {
  const tones = {
    neutral: { accent: "border-line-strong", value: "text-content" },
    brand: { accent: "border-brand-green", value: "text-brand-navy" },
    success: { accent: "border-success", value: "text-success-dark" },
    danger: { accent: "border-rose-400", value: "text-rose-700" },
  };
  const selected = tones[tone] || tones.neutral;

  return (
    <div className={`border-l-4 py-1 pl-4 ${selected.accent}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-content-muted">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {label}
      </p>
      <p
        className={`mt-1 break-words text-2xl font-extrabold tracking-tight tabular-nums ${selected.value}`}
      >
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs leading-5 text-content-muted">
          {description}
        </p>
      )}
    </div>
  );
}

function ViewToggle({ value, onChange, className = "" }) {
  const options = [
    { value: "card", label: "List", icon: LayoutGrid },
    { value: "table", label: "Table", icon: Table2 },
  ];

  return (
    <div
      className={`inline-flex rounded-full bg-surface-muted p-1 ${className}`}
      role="group"
      aria-label="Choose display layout"
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={active}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
              active
                ? "bg-surface-white text-content shadow-sm"
                : "text-content-muted hover:text-content"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DifferenceIndicator({
  original,
  proposed,
  currency,
  showPercentage = true,
}) {
  const result = getDifference(original, proposed);

  if (!result.available) {
    return (
      <span className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-content-muted">
        Comparison unavailable
      </span>
    );
  }

  if (result.unchanged) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-content-muted">
        <Check size={13} aria-hidden="true" />
        No change
      </span>
    );
  }

  const increased = result.increased;
  const Icon = increased ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        increased
          ? "bg-rose-50 text-rose-700"
          : "bg-success-soft text-success-dark"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="tabular-nums">
        {formatMoney(Math.abs(result.difference), currency)}
      </span>
      {showPercentage && result.percentage !== null && (
        <span className="tabular-nums">
          ({Math.abs(result.percentage).toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

function BarLine({ label, amount, max, currency, barClassName }) {
  const safeAmount = toNumber(amount, 0) ?? 0;
  const width =
    max > 0 ? Math.min(100, Math.max(0, (safeAmount / max) * 100)) : 0;

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 text-xs">
      <span className="font-medium text-content-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <span
          className={`block h-full rounded-full ${barClassName}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="min-w-[96px] text-right font-semibold tabular-nums text-content">
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            ITEM DISPLAY COMPONENTS                         */
/* -------------------------------------------------------------------------- */

function ItemListView({
  items,
  currency,
  proposed = false,
  view,
  getAmount,
}) {
  if (!items.length) {
    return <EmptyState message="There are no items to display." icon={Package} />;
  }

  const renderQuantityAndUnit = (item) => {
    const quantity = getItemQuantity(item, proposed);
    const unitPrice = getItemPrice(item, proposed);

    if (quantity === null && unitPrice === null)
      return "Quantity and price unavailable";
    if (unitPrice === null)
      return `Quantity ${quantity ?? "—"} · Unit price unavailable`;
    return `${quantity ?? "—"} at ${formatMoney(unitPrice, currency)} each`;
  };

  if (view === "card") {
    return (
      <ul className="divide-y divide-line-soft border-y border-line-soft">
        {items.map((item, index) => {
          const total = getAmount
            ? getAmount(item)
            : getItemTotal(item, proposed);

          return (
            <li
              key={getValue(item, ["id", "erand_item_id"], index)}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-content">
                  {getItemName(item)}
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  {renderQuantityAndUnit(item)}
                </p>
                {item.notes && (
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    {item.notes}
                  </p>
                )}
              </div>
              <PriceValue
                amount={total}
                currency={currency}
                className="shrink-0 text-sm"
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-content-muted">
            <th className="py-2.5 pr-4 font-semibold">Item</th>
            <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
            <th className="px-4 py-2.5 text-right font-semibold">Unit price</th>
            <th className="py-2.5 pl-4 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {items.map((item, index) => (
            <tr key={getValue(item, ["id", "erand_item_id"], index)}>
              <td className="py-3.5 pr-4 font-semibold text-content">
                {getItemName(item)}
                {item.notes && (
                  <p className="mt-1 text-xs font-normal text-content-muted">
                    {item.notes}
                  </p>
                )}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-content-muted">
                {getItemQuantity(item, proposed) ?? "—"}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-content-muted">
                {formatMoney(getItemPrice(item, proposed), currency)}
              </td>
              <td className="py-3.5 pl-4 text-right font-bold tabular-nums text-content">
                {formatMoney(
                  getAmount ? getAmount(item) : getItemTotal(item, proposed),
                  currency
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            PRICE COMPARISON                                */
/* -------------------------------------------------------------------------- */

export function PriceComparison({
  originalItems = [],
  proposedItems = [],
  originalTotal,
  proposedTotal,
  acceptedOffer,
  offer,
  currency = "NGN",
  errandId,
  viewerRole = "customer",
}) {
  const [view, setView] = useState("card");
  const selectedOffer = acceptedOffer || offer;
  const L = LABELS[viewerRole] || LABELS.customer;

  const comparison = useMemo(() => {
    const resolvedErrandId =
      errandId || getValue(selectedOffer, ["erand_id", "errand_id"], null);

    const safeOriginalItems = Array.isArray(originalItems)
      ? originalItems.filter(
          (item) =>
            !resolvedErrandId ||
            !item?.erand_id ||
            String(item.erand_id) === String(resolvedErrandId)
        )
      : [];

    const selectedOfferId = getValue(selectedOffer, ["id", "offer_id"], null);
    const safeProposedItems = Array.isArray(proposedItems)
      ? proposedItems.filter(
          (item) =>
            !selectedOfferId ||
            !item?.offer_id ||
            String(item.offer_id) === String(selectedOfferId)
        )
      : [];

    const originalItemSum = sumKnownTotals(safeOriginalItems, false);
    const calculatedProposedItemSum = sumKnownTotals(safeProposedItems, true);

    const originalById = new Map();
    safeOriginalItems.forEach((item) => {
      const id = getOriginalItemId(item);
      if (id !== null) originalById.set(String(id), item);
    });

    const proposedByOriginalId = new Map();
    const duplicateProposedIds = new Set();

    safeProposedItems.forEach((item) => {
      const originalId = getProposedOriginalItemId(item);
      if (originalId === null) return;

      const key = String(originalId);
      if (proposedByOriginalId.has(key)) duplicateProposedIds.add(key);
      else proposedByOriginalId.set(key, item);
    });

    const originalIds = new Set(originalById.keys());

    const rows = safeOriginalItems.map((originalItem) => {
      const originalId = getOriginalItemId(originalItem);
      const proposedItem =
        originalId !== null
          ? proposedByOriginalId.get(String(originalId)) || null
          : null;

      const enrichedProposedItem = proposedItem
        ? {
            ...originalItem,
            ...proposedItem,
            item_name: getItemName(originalItem),
            description: proposedItem.notes || originalItem.description || null,
          }
        : null;

      return {
        originalItem,
        proposedItem: enrichedProposedItem,
        originalPrice: getItemTotal(originalItem, false),
        proposedPrice: enrichedProposedItem
          ? getItemTotal(enrichedProposedItem, true)
          : null,
        duplicateProposal: originalId
          ? duplicateProposedIds.has(String(originalId))
          : false,
      };
    });

    const additionalItems = safeProposedItems
      .filter((item) => {
        const originalId = getProposedOriginalItemId(item);
        return originalId === null || !originalIds.has(String(originalId));
      })
      .map((item) => ({
        ...item,
        item_name: getValue(item, ["item_name", "name"], "Additional item"),
      }));

    /* The errand's original items did not load, so nothing can be matched. */
    const originalMissing =
      safeOriginalItems.length === 0 && safeProposedItems.length > 0;

    const feeBreakdown = getOfferFeeBreakdown(selectedOffer);

    /* A zero estimate means "not set", never a real baseline. */
    const original =
      positiveOrNull(originalTotal) ?? positiveOrNull(originalItemSum);

    const proposalItemTotal =
      feeBreakdown?.itemTotal !== null && feeBreakdown?.itemTotal !== undefined
        ? feeBreakdown.itemTotal
        : calculatedProposedItemSum;

    const suppliedProposalTotal =
      toNumber(proposedTotal) ?? feeBreakdown?.proposedTotal ?? null;

    const proposed =
      suppliedProposalTotal !== null
        ? suppliedProposalTotal
        : feeBreakdown?.allComponentsKnown
          ? feeBreakdown.calculatedTotal
          : proposalItemTotal !== null && feeBreakdown
            ? null
            : proposalItemTotal;

    const feeSum =
      feeBreakdown?.additionalFees !== null &&
      feeBreakdown?.additionalFees !== undefined
        ? feeBreakdown.additionalFees
        : null;

    const calculatedFromComponents =
      proposalItemTotal !== null && feeSum !== null
        ? proposalItemTotal + feeSum
        : (feeBreakdown?.calculatedTotal ?? null);

    const reconciliationDifference =
      proposed !== null && calculatedFromComponents !== null
        ? proposed - calculatedFromComponents
        : null;

    const reconciliationStatus =
      reconciliationDifference === null
        ? "unavailable"
        : Math.abs(reconciliationDifference) <= 0.01
          ? "matched"
          : "mismatch";

    const hasMissingEstimates = safeOriginalItems.some(
      (item) => getItemTotal(item, false) === null
    );
    const hasMissingProposedPrices = safeProposedItems.some(
      (item) => getItemTotal(item, true) === null
    );

    return {
      original,
      originalItemSum,
      proposalItemTotal,
      proposed,
      feeBreakdown,
      rows,
      additionalItems,
      originalMissing,
      originalItems: safeOriginalItems,
      proposedItems: safeProposedItems,
      reconciliationDifference,
      reconciliationStatus,
      hasMissingEstimates,
      hasMissingProposedPrices,
      hasOriginalTotal: original !== null,
      hasProposedTotal: proposed !== null,
    };
  }, [
    originalItems,
    proposedItems,
    originalTotal,
    proposedTotal,
    selectedOffer,
    errandId,
  ]);

  const difference = getDifference(comparison.original, comparison.proposed);

  const feeBreakdown = comparison.feeBreakdown;

  const feeShare =
    feeBreakdown?.additionalFees !== null &&
    feeBreakdown?.additionalFees !== undefined &&
    comparison.proposed > 0
      ? feeBreakdown.additionalFees / comparison.proposed
      : null;

  const comparableRows = comparison.rows.filter(
    (row) => row.proposedPrice !== null && row.originalPrice !== null
  );

  const totalChangedItems = comparableRows.filter(
    (row) => Math.abs(row.originalPrice - row.proposedPrice) > 0.000001
  ).length;

  const unproposedItems = comparison.rows.filter(
    (row) => row.proposedPrice === null
  ).length;

  const bridge = useMemo(() => {
    if (
      comparison.original === null ||
      comparison.proposed === null ||
      comparison.originalItemSum === null ||
      comparison.proposalItemTotal === null
    ) {
      return { steps: [], maxAbs: 1, available: false };
    }

    const steps = [
      {
        key: "items",
        label: "Change in item prices",
        value: comparison.proposalItemTotal - comparison.originalItemSum,
      },
    ];

    if (feeBreakdown) {
      if (feeBreakdown.serviceFee !== null) {
        steps.push({
          key: "service",
          label: "Service fee",
          value: feeBreakdown.serviceFee,
        });
      }
      if (feeBreakdown.deliveryFee !== null) {
        steps.push({
          key: "delivery",
          label: "Delivery fee",
          value: feeBreakdown.deliveryFee,
        });
      }
      if (feeBreakdown.otherFees !== null) {
        steps.push({
          key: "other",
          label: "Other fees",
          value: feeBreakdown.otherFees,
        });
      }
    }

    const explained = steps.reduce((sum, step) => sum + step.value, 0);
    const remainder = comparison.proposed - comparison.original - explained;

    if (Math.abs(remainder) > 0.01) {
      steps.push({
        key: "adjustments",
        label: "Unexplained difference",
        value: remainder,
      });
    }

    const maxAbs = Math.max(1, ...steps.map((step) => Math.abs(step.value)));
    return { steps, maxAbs, available: true };
  }, [comparison, feeBreakdown]);

  const noEstimate =
    comparison.original === null && comparison.proposed !== null;

  const verdict = noEstimate
    ? {
        wrapper: "bg-surface text-content",
        muted: "text-content-muted",
        title: "No estimate to compare against",
        icon: Info,
        advice: L.noEstimateAdvice,
      }
    : !difference.available
      ? {
          wrapper: "bg-surface text-content",
          muted: "text-content-muted",
          title: "Price comparison incomplete",
          icon: Info,
          advice: L.incompleteAdvice,
        }
      : difference.increased
        ? {
            wrapper: "bg-rose-50 text-rose-950",
            muted: "text-rose-800",
            title: L.above,
            icon: AlertTriangle,
            advice: L.aboveAdvice(formatMoney(comparison.proposed, currency)),
          }
        : difference.decreased
          ? {
              wrapper: "bg-success-soft text-success-dark",
              muted: "text-success-dark",
              title: L.below,
              icon: CheckCircle2,
              advice: L.belowAdvice,
            }
          : {
              wrapper: "bg-surface text-content",
              muted: "text-content-muted",
              title: L.match,
              icon: Info,
              advice: L.matchAdvice,
            };

  const VerdictIcon = verdict.icon;

  const composition = useMemo(() => {
    if (!feeBreakdown)
      return { parts: [], total: null, percentagesAvailable: false };

    const parts = [
      {
        key: "items",
        label: "Items",
        value: feeBreakdown.itemTotal ?? comparison.proposalItemTotal,
        className: "bg-brand-navy",
      },
      {
        key: "service",
        label: "Service fee",
        value: feeBreakdown.serviceFee,
        className: "bg-brand-green",
      },
      {
        key: "delivery",
        label: "Delivery fee",
        value: feeBreakdown.deliveryFee,
        className: "bg-brand-mint",
      },
      {
        key: "other",
        label: "Other fees",
        value: feeBreakdown.otherFees,
        className: "bg-line-strong",
      },
    ];

    const knownParts = parts.every((part) => part.value !== null);
    const total = knownParts
      ? parts.reduce((sum, part) => sum + part.value, 0)
      : null;

    const percentagesAvailable =
      total !== null &&
      total > 0 &&
      comparison.proposed !== null &&
      Math.abs(total - comparison.proposed) <= 0.01;

    return { parts, total, percentagesAvailable };
  }, [feeBreakdown, comparison.proposalItemTotal, comparison.proposed]);

  const addedLabel = comparison.originalMissing
    ? "Original item details unavailable"
    : L.added;

  return (
    <Block
      title="Price decision"
      description={L.description}
      icon={Scale}
    >
      {/* Verdict */}
      <div className={`rounded-2xl p-5 sm:p-6 ${verdict.wrapper}`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold">
              <VerdictIcon size={16} aria-hidden="true" />
              {verdict.title}
            </p>
            <p className="mt-2 break-words text-4xl font-extrabold tracking-tight tabular-nums">
              {noEstimate
                ? formatMoney(comparison.proposed, currency)
                : difference.available
                  ? signed(difference.difference, currency)
                  : "—"}
            </p>
            <p className={`mt-1 text-sm ${verdict.muted}`}>
              {noEstimate
                ? "Proposed total. No estimate was set, so there is no difference to show."
                : !difference.available || difference.percentage === null
                  ? "A reliable percentage comparison is not available."
                  : `${Math.abs(difference.percentage).toFixed(1)}% ${
                      difference.increased
                        ? "above"
                        : difference.decreased
                          ? "below"
                          : "different from"
                    } ${L.estimateNoun}`}
            </p>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className={`text-xs font-medium ${verdict.muted}`}>
                {L.estimate}
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums">
                {comparison.original === null
                  ? "Not set"
                  : formatMoney(comparison.original, currency)}
              </p>
            </div>
            <ArrowRight
              size={18}
              className={verdict.muted}
              aria-hidden="true"
            />
            <div>
              <p className={`text-xs font-medium ${verdict.muted}`}>
                Proposal
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums">
                {formatMoney(comparison.proposed, currency)}
              </p>
            </div>
          </div>
        </div>
        <p className={`mt-4 max-w-2xl text-sm leading-6 ${verdict.muted}`}>
          {verdict.advice}
        </p>
      </div>

      {/* High fee flag */}
      {feeShare !== null && feeShare > HIGH_FEE_SHARE && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm leading-6">
            Fees make up{" "}
            <strong>{Math.round(feeShare * 100)}%</strong> of this proposal (
            {formatMoney(feeBreakdown.additionalFees, currency)} on top of the
            items).
          </p>
        </div>
      )}

      {/* Reconciliation warning */}
      {comparison.reconciliationStatus === "mismatch" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-bold">
              The price breakdown does not add up
            </p>
            <p className="mt-1 text-sm leading-6">
              The proposal total differs from the item and fee components by{" "}
              <strong>
                {formatMoney(
                  Math.abs(comparison.reconciliationDifference),
                  currency
                )}
              </strong>
              . The proposal total is shown, but this breakdown should be
              checked before the offer is accepted.
            </p>
          </div>
        </div>
      )}

      {comparison.reconciliationStatus === "unavailable" &&
        comparison.proposed !== null &&
        feeBreakdown && (
          <div className="mt-5 flex gap-3 rounded-xl border border-line bg-surface p-4 text-content-muted">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm leading-6">
              Not all fee components were supplied, so the proposal total
              cannot be fully reconciled against the breakdown.
            </p>
          </div>
        )}

      {(comparison.hasMissingEstimates ||
        comparison.hasMissingProposedPrices) && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">
            Some item prices or quantities are missing or invalid. Those lines
            are displayed as unavailable and are not silently converted to
            zero.
          </p>
        </div>
      )}

      {/* Bridge */}
      <div className="mt-8">
        <SubHeading
          title="Where the difference comes from"
          description={`Each line shows how much it moved the total away from ${L.estimateNoun}.`}
        />
        {!bridge.available ? (
          <EmptyState
            message={
              comparison.original === null
                ? "There is no estimate to measure the proposal against."
                : "The price movement breakdown needs a reliable original item total and complete proposed amount."
            }
          />
        ) : (
          <dl className="divide-y divide-line-soft border-y border-line-soft">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-content">
                {L.estimate}
              </dt>
              <dd className="text-sm font-bold tabular-nums text-content">
                {formatMoney(comparison.original, currency)}
              </dd>
            </div>
            {bridge.steps.map((step) => {
              const width = Math.min(
                100,
                (Math.abs(step.value) / bridge.maxAbs) * 100
              );
              const up = step.value > 0;
              const flat = step.value === 0;

              return (
                <div
                  key={step.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)_120px]"
                >
                  <dt className="text-sm text-content-muted">{step.label}</dt>
                  <dd className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <span className="block h-2 overflow-hidden rounded-full bg-surface-muted">
                      <span
                        className={`block h-full rounded-full ${
                          flat
                            ? "bg-transparent"
                            : up
                              ? "bg-rose-400"
                              : "bg-success"
                        }`}
                        style={{ width: `${flat ? 0 : Math.max(width, 3)}%` }}
                      />
                    </span>
                  </dd>
                  <dd
                    className={`text-right text-sm font-bold tabular-nums ${
                      flat
                        ? "text-content-muted"
                        : up
                          ? "text-rose-700"
                          : "text-success-dark"
                    }`}
                  >
                    {signed(step.value, currency)}
                  </dd>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm font-extrabold text-content">
                Proposal total
              </dt>
              <dd className="text-base font-extrabold tabular-nums text-content">
                {formatMoney(comparison.proposed, currency)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Items */}
      <div className="mt-8">
        <SubHeading
          title="Item by item"
          description={L.itemsDescription}
          action={<ViewToggle value={view} onChange={setView} />}
        />

        {comparison.rows.length === 0 &&
        comparison.additionalItems.length === 0 ? (
          <EmptyState
            message="Item comparison will appear when item details are available."
            icon={Package}
          />
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-content-muted">
                  <th className="py-2.5 pr-4 font-semibold">Item</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    {L.estimate}
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Proposed
                  </th>
                  <th className="py-2.5 pl-4 text-right font-semibold">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {comparison.rows.map((row, index) => (
                  <tr key={getOriginalItemId(row.originalItem) || index}>
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-content">
                        {getItemName(row.originalItem)}
                      </p>
                      {row.proposedItem && (
                        <>
                          <p className="mt-0.5 text-xs text-content-muted">
                            Proposed quantity{" "}
                            {getItemQuantity(row.proposedItem, true) ?? "—"}
                          </p>
                          {row.proposedItem.notes && (
                            <p className="mt-1 text-xs text-content-muted">
                              {row.proposedItem.notes}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-content-muted">
                      {formatMoney(row.originalPrice, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-content-muted">
                      {row.proposedPrice === null
                        ? "Not proposed"
                        : formatMoney(row.proposedPrice, currency)}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {row.proposedPrice === null ? (
                        <span className="text-xs font-semibold text-amber-700">
                          Missing
                        </span>
                      ) : (
                        <DifferenceIndicator
                          original={row.originalPrice}
                          proposed={row.proposedPrice}
                          currency={currency}
                          showPercentage={false}
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {comparison.additionalItems.map((item, index) => (
                  <tr
                    key={getValue(item, ["id"], `additional-${index}`)}
                    className="bg-amber-50/50"
                  >
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-content">
                        {getItemName(item)}
                      </p>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        {!comparison.originalMissing && (
                          <Plus size={12} aria-hidden="true" />
                        )}
                        {addedLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-content-subtle">
                      —
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-content">
                      {getItemTotal(item, true) === null
                        ? "Not proposed"
                        : formatMoney(getItemTotal(item, true), currency)}
                    </td>
                    <td className="py-3.5 pl-4 text-right text-content-subtle">
                      —
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft border-y border-line-soft">
            {comparison.rows.map((row, index) => {
              const rowMax = Math.max(
                row.originalPrice ?? 0,
                row.proposedPrice ?? 0,
                1
              );
              const proposedBar =
                row.proposedPrice === null
                  ? ""
                  : row.originalPrice === null ||
                      row.proposedPrice > row.originalPrice
                    ? "bg-rose-400"
                    : row.proposedPrice < row.originalPrice
                      ? "bg-success"
                      : "bg-brand-navy";

              return (
                <li
                  key={getOriginalItemId(row.originalItem) || index}
                  className="py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-bold text-content">
                      {getItemName(row.originalItem)}
                    </p>
                    {row.proposedPrice === null ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Not proposed
                      </span>
                    ) : (
                      <DifferenceIndicator
                        original={row.originalPrice}
                        proposed={row.proposedPrice}
                        currency={currency}
                        showPercentage={false}
                      />
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <BarLine
                      label="Estimate"
                      amount={row.originalPrice}
                      max={rowMax}
                      currency={currency}
                      barClassName="bg-line-strong"
                    />
                    {row.proposedPrice !== null && (
                      <BarLine
                        label="Proposed"
                        amount={row.proposedPrice}
                        max={rowMax}
                        currency={currency}
                        barClassName={proposedBar}
                      />
                    )}
                  </div>
                  {row.proposedItem?.notes && (
                    <p className="mt-2 text-xs leading-5 text-content-muted">
                      {L.note} {row.proposedItem.notes}
                    </p>
                  )}
                </li>
              );
            })}
            {comparison.additionalItems.map((item, index) => (
              <li
                key={getValue(item, ["id"], `additional-${index}`)}
                className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/50 py-4"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-content">
                    {getItemName(item)}
                  </p>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    {!comparison.originalMissing && (
                      <Plus size={12} aria-hidden="true" />
                    )}
                    {addedLabel}
                  </span>
                </div>
                <PriceValue
                  amount={getItemTotal(item, true)}
                  currency={currency}
                />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-content-muted">
          {comparison.originalMissing ? (
            "The errand's original item details were not loaded, so these items could not be matched to your estimates."
          ) : (
            <>
              {comparison.rows.length} original{" "}
              {comparison.rows.length === 1 ? "item" : "items"},{" "}
              {totalChangedItems} with a changed price
              {unproposedItems > 0 && (
                <span className="font-semibold text-amber-700">
                  , {unproposedItems} not proposed
                </span>
              )}
              {comparison.additionalItems.length > 0 && (
                <span className="font-semibold text-amber-700">
                  , {comparison.additionalItems.length} added
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Composition */}
      <div className="mt-8">
        <SubHeading
          title="What the proposal is made of"
          description="Item prices and the extra charges added on top."
        />
        {!feeBreakdown ? (
          <EmptyState message="A detailed fee breakdown was not supplied. You can still review the proposed total, but individual charges cannot be verified here." />
        ) : (
          <>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-surface-muted"
              role="img"
              aria-label="Breakdown of the proposed total"
            >
              {composition.parts.map((part) => {
                const value = part.value ?? 0;
                const width =
                  composition.total > 0
                    ? (Math.max(value, 0) / composition.total) * 100
                    : 0;
                if (width <= 0) return null;
                return (
                  <span
                    key={part.key}
                    className={`h-full ${part.className}`}
                    style={{ width: `${width}%` }}
                  />
                );
              })}
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {composition.parts.map((part) => {
                const percent =
                  composition.percentagesAvailable && part.value !== null
                    ? (Math.max(part.value, 0) / composition.total) * 100
                    : null;
                return (
                  <div
                    key={part.key}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <dt className="flex items-center gap-2 text-content-muted">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${part.className}`}
                        aria-hidden="true"
                      />
                      {part.label}
                    </dt>
                    <dd className="text-right font-semibold tabular-nums text-content">
                      {formatMoney(part.value, currency)}
                      <span className="ml-2 text-xs font-medium text-content-subtle">
                        {percent === null ? "—" : `${percent.toFixed(0)}%`}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            {!composition.percentagesAvailable && (
              <p className="mt-2 text-xs text-content-muted">
                Percentages are withheld because the supplied components are
                incomplete or do not reconcile to the proposal total.
              </p>
            )}
          </>
        )}
      </div>

      {/* Final amount */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-brand-navy p-5 text-content-inverse sm:p-6">
        <div>
          <p className="text-sm font-semibold text-white/70">
            Complete proposed amount
          </p>
          <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums">
            {formatMoney(comparison.proposed, currency)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-6 text-right text-sm">
          <div>
            <dt className="text-xs font-medium text-white/70">Items</dt>
            <dd className="mt-0.5 font-bold tabular-nums">
              {formatMoney(comparison.proposalItemTotal, currency)}
            </dd>
          </div>
          {feeBreakdown && (
            <div>
              <dt className="text-xs font-medium text-white/70">Extra fees</dt>
              <dd className="mt-0.5 font-bold tabular-nums">
                {formatMoney(feeBreakdown.additionalFees, currency)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                         ORIGINAL ITEM PRICE LIST                           */
/* -------------------------------------------------------------------------- */

export function OriginalItemPriceList({ items = [], currency = "NGN" }) {
  const [view, setView] = useState("table");
  const total = sumKnownTotals(items, false);

  return (
    <Block
      title="Original item estimates"
      description="The prices you supplied with the errand."
      icon={Receipt}
      action={<ViewToggle value={view} onChange={setView} />}
    >
      {items.length === 0 ? (
        <EmptyState
          message="No original item estimates are available."
          icon={Receipt}
        />
      ) : (
        <>
          <ItemListView items={items} currency={currency} view={view} />
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <p className="text-sm font-semibold text-content-muted">
              Original item total
            </p>
            <PriceValue amount={total} currency={currency} className="text-xl" />
          </div>
        </>
      )}
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                          APPROVED ITEM PRICE LIST                          */
/* -------------------------------------------------------------------------- */

export function ApprovedItemsPriceList({
  items = [],
  approvedTotal,
  currency = "NGN",
}) {
  const [view, setView] = useState("table");
  const calculatedTotal = sumKnownTotals(items, true);
  const total = toNumber(approvedTotal) ?? calculatedTotal;

  return (
    <Block
      title="Approved item prices"
      description="The item prices included in the agreed errand."
      icon={CheckCircle2}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success-dark">
            <CheckCircle2 size={13} aria-hidden="true" />
            Approved
          </span>
          <ViewToggle value={view} onChange={setView} />
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          message="Approved item prices are not available."
          icon={CheckCircle2}
        />
      ) : (
        <>
          <ItemListView
            items={items}
            currency={currency}
            proposed
            view={view}
          />
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <p className="text-sm font-semibold text-content-muted">
              Approved item total
            </p>
            <PriceValue
              amount={total}
              currency={currency}
              className="text-xl text-success-dark"
            />
          </div>
        </>
      )}
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                             PRICE DIFFERENCE                                */
/* -------------------------------------------------------------------------- */

export function PriceDifference({
  originalTotal,
  proposedTotal,
  approvedTotal,
  currency = "NGN",
}) {
  const hasApprovedTotal =
    approvedTotal !== undefined && approvedTotal !== null;
  const baseline = positiveOrNull(originalTotal);
  const comparisonTotal = hasApprovedTotal
    ? toNumber(approvedTotal)
    : toNumber(proposedTotal);
  const difference = getDifference(baseline, comparisonTotal);

  const title = hasApprovedTotal
    ? "Agreed price difference"
    : "Proposed price difference";

  return (
    <Block
      title={title}
      description="How the current amount compares with your original estimate."
      icon={Scale}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <MetricCard
          label="Your estimate"
          value={baseline === null ? "Not set" : formatMoney(baseline, currency)}
          icon={Receipt}
        />
        <MetricCard
          label={hasApprovedTotal ? "Approved amount" : "Proposed amount"}
          value={formatMoney(comparisonTotal, currency)}
          icon={Wallet}
          tone="brand"
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-4">
        <div>
          <p className="text-sm font-bold text-content">
            {baseline === null
              ? "No estimate to compare against"
              : !difference.available
                ? "Comparison unavailable"
                : difference.increased
                  ? "Above your estimate"
                  : difference.decreased
                    ? "Below your estimate"
                    : "Matches your estimate"}
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            {!difference.available || difference.percentage === null
              ? "A percentage comparison is not available."
              : `${Math.abs(difference.percentage).toFixed(1)}% difference`}
          </p>
        </div>
        {baseline !== null && (
          <DifferenceIndicator
            original={baseline}
            proposed={comparisonTotal}
            currency={currency}
          />
        )}
      </div>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                               BUDGET MONITOR                                */
/* -------------------------------------------------------------------------- */

export function BudgetMonitor({ budget, approvedTotal, currency = "NGN" }) {
  const budgetAmount = positiveOrNull(budget);
  const approvedAmount = positiveOrNull(approvedTotal);

  if (budgetAmount === null || approvedAmount === null) {
    return (
      <Block
        title="Budget check"
        description="See how much of your budget the agreement uses."
        icon={Wallet}
      >
        <EmptyState
          message={
            budgetAmount === null
              ? "You did not set a budget for this errand, so there is nothing to check the agreement against."
              : "The budget check appears once an offer has been accepted."
          }
          icon={Wallet}
        />
      </Block>
    );
  }

  const remaining = budgetAmount - approvedAmount;
  const percentage = (approvedAmount / budgetAmount) * 100;
  const exceeded = remaining < 0;
  const nearLimit = !exceeded && percentage >= 85;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  const strokeClass = exceeded
    ? "stroke-rose-500"
    : nearLimit
      ? "stroke-brand-green"
      : "stroke-success";

  const statusLabel = exceeded
    ? "Over budget"
    : nearLimit
      ? "Close to your limit"
      : "Within budget";

  const statusClass = exceeded
    ? "bg-rose-50 text-rose-700"
    : nearLimit
      ? "bg-brand-pale text-brand-navy"
      : "bg-success-soft text-success-dark";

  return (
    <Block
      title="Budget check"
      description="What the agreement uses of the budget you set."
      icon={Wallet}
      action={
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}
        >
          {statusLabel}
        </span>
      }
    >
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
        <div
          className="relative h-40 w-40 shrink-0"
          role="img"
          aria-label={`Budget used: ${percentage.toFixed(0)} percent`}
        >
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="12"
              className="stroke-surface-muted"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className={`${strokeClass} transition-[stroke-dasharray] duration-700`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold tabular-nums text-content">
              {percentage.toFixed(0)}%
            </span>
            <span className="text-xs font-medium text-content-muted">
              of budget used
            </span>
          </div>
        </div>

        <dl className="w-full min-w-0 flex-1 divide-y divide-line-soft border-y border-line-soft">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-content-muted">Your budget</dt>
            <dd className="text-sm font-bold tabular-nums text-content">
              {formatMoney(budgetAmount, currency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-content-muted">Approved amount</dt>
            <dd className="text-sm font-bold tabular-nums text-content">
              {formatMoney(approvedAmount, currency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm font-semibold text-content">
              {exceeded ? "Over budget by" : "Left in budget"}
            </dt>
            <dd
              className={`text-lg font-extrabold tabular-nums ${
                exceeded ? "text-rose-700" : "text-success-dark"
              }`}
            >
              {formatMoney(Math.abs(remaining), currency)}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mt-5 text-sm leading-6 text-content-muted">
        {exceeded
          ? "The agreed amount is higher than the budget you set."
          : nearLimit
            ? "Most of your budget will be used by this agreement."
            : "You have room left after the approved amount."}
      </p>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                            PAYMENT SUMMARY                                 */
/* -------------------------------------------------------------------------- */

export function ErrandPaymentSummary({
  payment,
  funding,
  fundRelease,
  currency = "NGN",
}) {
  const fundingData = funding || payment;

  return (
    <Block
      title="Payment and fund status"
      description="The funding and release information recorded for this errand."
      icon={CreditCard}
    >
      {!fundingData && !fundRelease ? (
        <EmptyState
          message="Payment information is not available yet."
          icon={CreditCard}
        />
      ) : (
        <PaymentStatus
          payment={fundingData}
          fundRelease={fundRelease}
          currency={currency}
        />
      )}
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ERRAND ACTIVITY                               */
/* -------------------------------------------------------------------------- */

const getActivityTimestamp = (event) =>
  getValue(
    event,
    [
      "occurredAt",
      "occurred_at",
      "requestedAt",
      "requested_at",
      "reviewedAt",
      "reviewed_at",
      "releaseInitiatedAt",
      "release_initiated_at",
      "releasedAt",
      "released_at",
      "createdAt",
      "created_at",
      "timestamp",
      "date",
    ],
    null
  );

const formatDayLabel = (value) => {
  if (!value) return "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Undated";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "full" }).format(date);
};

const formatTimeOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", { timeStyle: "short" }).format(date);
};

export function ErrandActivity({ activity = [], title = "Errand activity" }) {
  const groups = useMemo(() => {
    const sorted = [...activity].sort((first, second) => {
      const firstDate = new Date(getActivityTimestamp(first) || 0).getTime();
      const secondDate = new Date(getActivityTimestamp(second) || 0).getTime();
      return secondDate - firstDate;
    });

    const map = new Map();
    sorted.forEach((event) => {
      const key = formatDayLabel(getActivityTimestamp(event));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });

    return [...map.entries()];
  }, [activity]);

  return (
    <Block
      title={title}
      description="Everything that has happened on this errand, newest first."
      icon={Clock3}
    >
      {groups.length === 0 ? (
        <EmptyState
          message="No activity has been recorded yet. Updates will appear here as the errand moves forward."
          icon={Clock3}
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([day, events]) => (
            <div key={day}>
              <h4 className="text-sm font-bold text-content">{day}</h4>
              <ol className="mt-3 space-y-5 border-l-2 border-line pl-5">
                {events.map((event, index) => {
                  const eventTitle = getValue(
                    event,
                    ["title", "event", "action", "type", "status"],
                    "Errand update"
                  );
                  const rawDescription = getValue(
                    event,
                    ["description", "message", "details"],
                    null
                  );
                  const description =
                    typeof rawDescription === "string"
                      ? rawDescription
                      : rawDescription && typeof rawDescription === "object"
                        ? getValue(
                            rawDescription,
                            ["message", "description", "reason"],
                            ""
                          )
                        : "";
                  const timestamp = getActivityTimestamp(event);

                  return (
                    <li
                      key={getValue(event, ["id"], `${day}-${index}`)}
                      className="relative"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface-white bg-brand-navy"
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                        <p className="text-sm font-bold text-content">
                          {formatLabel(eventTitle)}
                        </p>
                        <p className="text-xs font-medium text-content-subtle">
                          {formatTimeOnly(timestamp) ||
                            (timestamp ? formatDateTime(timestamp) : "")}
                        </p>
                      </div>
                      {description && (
                        <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
                          {description}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/*                              NAMED EXPORTS                                 */
/* -------------------------------------------------------------------------- */

export {
  ViewToggle,
  DifferenceIndicator,
  MetricCard,
  formatMoney,
  formatDateTime,
  getDifference,
  getItemName,
  getItemQuantity,
  getItemPrice,
  getItemTotal,
  getOfferFeeBreakdown,
  buildProposalItems,
};

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default {
  PriceComparison,
  OriginalItemPriceList,
  ApprovedItemsPriceList,
  PriceDifference,
  BudgetMonitor,
  ErrandPaymentSummary,
  ErrandActivity,
  ViewToggle,
  DifferenceIndicator,
  MetricCard,
};
