import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Info,
  LoaderCircle,
  MessageCircle,
  Package,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import Select from "@/components/Select";
import ActionMenu from "@/components/ActionMenu";

import { getErrandById } from "@/services/errands/errandsApi";
import {
  acceptErandOffer,
  getOffersForErrand,
} from "@/services/offers/offersApi";

import {
  PriceComparison,
  BudgetMonitor,
  DifferenceIndicator,
  buildProposalItems,
  formatMoney,
} from "../shared/ErrandTools";

const PAGE_SIZE = 8;
const MAX_COMPARE = 3;
const HIGH_FEE_SHARE = 0.4;

/* A card body taller than this collapses behind a "Show full offer" toggle. */
const COLLAPSED_HEIGHT = 230;

const SORT_OPTIONS = [
  { value: "price_low", label: "Lowest price" },
  { value: "price_high", label: "Highest price" },
  { value: "fees_low", label: "Lowest fees" },
  { value: "closest", label: "Closest to your estimate" },
  { value: "newest", label: "Newest first" },
];

const FEE_PARTS = [
  { key: "proposed_item_total", label: "Items", className: "bg-brand-navy" },
  {
    key: "proposed_service_fee",
    label: "Service fee",
    className: "bg-brand-green",
  },
  {
    key: "proposed_delivery_fee",
    label: "Delivery fee",
    className: "bg-brand-mint",
  },
  {
    key: "proposed_other_fees",
    label: "Other fees",
    className: "bg-line-strong",
  },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getName = (offer) => {
  const displayName =
    offer.erander_display_name || offer.display_name || offer.erander_name;

  if (displayName) return displayName;

  return (
    [
      offer.erander_first_name || offer.first_name,
      offer.erander_last_name || offer.last_name,
    ]
      .filter(Boolean)
      .join(" ") || "Erander"
  );
};

const getInitials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "E";

const getOfferItems = (offer) =>
  Array.isArray(offer.items) ? offer.items : [];

const getProposalTotal = (offer) => {
  const total = Number(offer.proposed_total);

  return Number.isFinite(total) ? total : null;
};

const getExpiry = (offer) =>
  offer.expires_at || offer.expiry_date || offer.expiresAt || null;

const getOfferStatus = (offer) => {
  const raw = String(offer.status || "pending").toLowerCase();

  if (raw === "expired") return "expired";
  if (raw === "withdrawn") return "withdrawn";
  if (raw !== "pending") return raw;

  const expiry = getExpiry(offer);

  if (expiry) {
    const expiresAt = new Date(expiry).getTime();

    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return "expired";
    }
  }

  return "pending";
};

const getOfferTime = (offer) =>
  new Date(offer.created_at || offer.createdAt || 0).getTime();

/** Service + delivery + other fees (everything except the items). */
const getExtraFees = (offer) =>
  ["proposed_service_fee", "proposed_delivery_fee", "proposed_other_fees"].reduce(
    (sum, key) => sum + Math.max(0, Number(offer[key]) || 0),
    0
  );

const getFeeShare = (offer) => {
  const total = getProposalTotal(offer);

  if (!total || total <= 0) return 0;

  return getExtraFees(offer) / total;
};

const getExpiryText = (offer) => {
  const expiry = getExpiry(offer);

  if (!expiry) return null;

  const remaining = new Date(expiry).getTime() - Date.now();

  if (!Number.isFinite(remaining) || remaining <= 0) return null;

  const hours = Math.floor(remaining / 3_600_000);

  if (hours < 1) return "Expires in under an hour";
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;

  const days = Math.floor(hours / 24);

  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
};

const unwrapErrand = (response) =>
  response?.data?.errand ??
  response?.errand ??
  response?.data?.erand ??
  response?.erand ??
  null;

function extractOffersFromResponse(response) {
  const firstLevel = response?.data ?? response;
  const secondLevel = firstLevel?.data ?? firstLevel;

  const possibleArrays = [
    secondLevel?.offers,
    secondLevel?.erandOffers,
    secondLevel?.erand_offers,
    secondLevel?.results,
    secondLevel?.data?.offers,
    firstLevel?.offers,
    firstLevel?.erandOffers,
    firstLevel?.erand_offers,
    response?.offers,
  ];

  if (Array.isArray(secondLevel)) return secondLevel;
  if (Array.isArray(firstLevel)) return firstLevel;

  return possibleArrays.find(Array.isArray) || [];
}

/* -------------------------------------------------------
   SHARED ACTIONS MENU
------------------------------------------------------- */

function ErrandActionsMenu({ ariaLabel = "Errand actions" }) {
  const items = useMemo(
    () => [
      {
        id: "assign-trusted",
        label: "Assign to a trusted erander",
        description: "Send this errand to an erander you already trust",
        icon: UserCheck,
        onClick: () => toast.info("Coming soon."),
      },
      {
        id: "chat-erander",
        label: "Chat any erander",
        description: "Message any erander about this errand",
        icon: MessageCircle,
        onClick: () => toast.info("Coming soon."),
      },
    ],
    []
  );

  return (
    <ActionMenu
      items={items}
      ariaLabel={ariaLabel}
      menuWidth={280}
      placement="auto"
      align="bottom-right"
    />
  );
}

/* -------------------------------------------------------
   SMALL UI PIECES
------------------------------------------------------- */

function OfferViewToggle({ value, onChange }) {
  return (
    <div
      className="inline-flex rounded-full bg-surface-muted p-1"
      role="group"
      aria-label="Offer display mode"
    >
      {[
        { value: "cards", label: "Cards" },
        { value: "table", label: "Table" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
            value === option.value
              ? "bg-surface-white text-content shadow-sm"
              : "text-content-muted hover:text-content"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OfferStatus({ status }) {
  const styles = {
    pending: "bg-amber-50 text-amber-800 border border-amber-100",
    expired: "bg-surface-muted text-content-muted border border-surface-100",
    withdrawn: "bg-surface-muted text-content-muted border border-surface-100",
  };

  const labels = {
    pending: "Awaiting your decision",
    expired: "Expired",
    withdrawn: "Withdrawn",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.pending
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />

      {labels[status] || status}
    </span>
  );
}

function Avatar({ offer, size = "md" }) {
  const name = getName(offer);
  const url = offer.erander_avatar_url || offer.avatar_url;

  const dimension =
    size === "lg" ? "h-14 w-14 text-base" : "h-12 w-12 text-sm";

  return url ? (
    <img
      src={url}
      alt=""
      className={`${dimension} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-brand-navy font-extrabold text-brand-mint`}
    >
      {getInitials(name)}
    </div>
  );
}

function Badge({ tone = "success", children }) {
  const tones = {
    success: "border-emerald-100 bg-success-soft text-success-dark",
    warning: "border-amber-100 bg-amber-50 text-amber-800",
    neutral: "border-line bg-surface-muted text-content-muted",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function OfferBadges({ offer, isLowest, isLatest }) {
  const feeShare = getFeeShare(offer);

  return (
    <>
      {isLowest && <Badge>Lowest price</Badge>}
      {isLatest && <Badge tone="neutral">Latest</Badge>}
      {feeShare > HIGH_FEE_SHARE && (
        <Badge tone="warning">Fees {Math.round(feeShare * 100)}% of total</Badge>
      )}
    </>
  );
}

function BackButton({ onClick, label = "Back" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-content-muted transition hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
    >
      <ArrowLeft size={17} aria-hidden="true" />
      {label}
    </button>
  );
}

const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface-white px-5 py-2.5 text-sm font-bold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy";

/* -------------------------------------------------------
   PAGE SHELL (back link + hero)
------------------------------------------------------- */

function PageShell({ stats, currency, count, onBack, actions, children }) {
  const cells = stats
    ? [
        ["Offers to review", count.toLocaleString(), ""],
        ["Lowest", formatMoney(stats.lowest, currency), "text-brand-mint"],
        ["Average", formatMoney(stats.average, currency), ""],
        ["Highest", formatMoney(stats.highest, currency), ""],
      ]
    : null;

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-[1440px] space-y-6 px-0 py-6 sm:px-2 lg:py-8">
        <BackButton onClick={onBack} label="Back to errand" />

        <header className="overflow-hidden rounded-3xl bg-brand-navy text-content-inverse shadow-erander-card">
          <div className="px-5 pb-8 pt-6 sm:px-8 sm:pb-9 sm:pt-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  Erander offers
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Nobody is assigned until you accept an offer. Open one to see
                  the full price comparison before you decide.
                </p>
              </div>

              {actions}
            </div>
          </div>

          {cells && (
            <dl className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
              {cells.map(([label, value, tone]) => (
                <div key={label} className="bg-brand-navy px-5 py-4 sm:px-8">
                  <dt className="text-sm text-white/70">{label}</dt>

                  <dd
                    className={`mt-1 break-words text-xl font-extrabold tabular-nums ${tone}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {children}
      </main>
    </DashboardLayout>
  );
}

/* -------------------------------------------------------
   COLLAPSIBLE BODY (collapses only when taller than the limit)
------------------------------------------------------- */

function CollapsibleBody({ children, maxHeight = COLLAPSED_HEIGHT }) {
  const innerRef = useRef(null);
  const regionId = useId();

  const [contentHeight, setContentHeight] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const element = innerRef.current;

    if (!element) return undefined;

    const measure = () => setContentHeight(element.offsetHeight);

    measure();

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const overflowing = contentHeight > maxHeight + 24;
  const collapsed = overflowing && !open;

  return (
    <div>
      <div
        id={regionId}
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: collapsed
            ? maxHeight
            : contentHeight > 0
              ? contentHeight
              : undefined,
        }}
      >
        <div ref={innerRef}>{children}</div>

        {collapsed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-white to-transparent"
          />
        )}
      </div>

      {overflowing && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={regionId}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-navy transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        >
          {open ? "Show less" : "Show full offer"}

          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   COMPARE CHECKBOX
------------------------------------------------------- */

function CompareCheck({ offer, selected, disabled, onToggle }) {
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs font-semibold ${
        disabled && !selected
          ? "cursor-not-allowed text-content-subtle"
          : "cursor-pointer text-content-muted"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled && !selected}
        onChange={() => onToggle(offer.id)}
        className="h-4 w-4 rounded border-line-strong accent-brand-navy"
      />
      Compare
    </label>
  );
}

/* -------------------------------------------------------
   OFFER CARD
------------------------------------------------------- */

function OfferCard({
  offer,
  currency,
  estimate,
  isLowest,
  isLatest,
  selected,
  compareFull,
  onToggleCompare,
  onReview,
}) {
  const name = getName(offer);
  const total = getProposalTotal(offer);
  const status = getOfferStatus(offer);
  const items = getOfferItems(offer);
  const expiryText = getExpiryText(offer);

  const parts = FEE_PARTS.map((part) => ({
    ...part,
    value: Math.max(0, Number(offer[part.key]) || 0),
  }));

  const partsTotal = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-3xl border bg-surface-white shadow-erander-card ${
        selected ? "border-brand-navy ring-2 ring-brand-pale" : "border-line"
      }`}
    >
      <header className="p-5 pb-4 sm:p-6 sm:pb-4">
        {/* Row 1: avatar, name and total */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar offer={offer} />

            <h3 className="min-w-0 truncate text-base font-extrabold tracking-tight text-content">
              {name}
            </h3>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-content-muted">Proposed total</p>

            <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums text-content">
              {formatMoney(total, currency)}
            </p>

            {estimate > 0 && total !== null && (
              <div className="mt-1.5 flex justify-end">
                <DifferenceIndicator
                  original={estimate}
                  proposed={total}
                  currency={currency}
                  showPercentage
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: full-width pills that wrap as whole units */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          <OfferBadges
            offer={offer}
            isLowest={isLowest}
            isLatest={isLatest}
          />

          <OfferStatus status={status} />

          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-content-muted">
            <Clock3 size={12} aria-hidden="true" />
            Sent {formatDate(offer.created_at || offer.createdAt)}
          </span>

          {expiryText && status === "pending" ? (
            <span className="whitespace-nowrap text-xs font-semibold text-amber-800">
              {expiryText}
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex-1 border-t border-line-soft px-5 py-5 sm:px-6">
        <CollapsibleBody>
          <div className="space-y-5">
            {offer.offer_message ? (
              <p className="whitespace-pre-wrap border-l-4 border-brand-green pl-4 text-sm leading-6 text-content">
                {offer.offer_message}
              </p>
            ) : (
              <p className="text-sm text-content-muted">
                This erander did not include a message.
              </p>
            )}

            {partsTotal > 0 && (
              <div>
                <div
                  className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label="Breakdown of the proposed total"
                >
                  {parts.map((part) =>
                    part.value > 0 ? (
                      <span
                        key={part.key}
                        className={`h-full ${part.className}`}
                        style={{ width: `${(part.value / partsTotal) * 100}%` }}
                      />
                    ) : null
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
                  {parts.map((part) => (
                    <div key={part.key}>
                      <dt className="flex items-center gap-1.5 text-xs text-content-muted">
                        <span
                          className={`h-2 w-2 rounded-full ${part.className}`}
                          aria-hidden="true"
                        />
                        {part.label}
                      </dt>

                      <dd className="mt-0.5 text-sm font-bold tabular-nums text-content">
                        {formatMoney(part.value, currency)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {items.length > 0 && (
              <div>
                <h4 className="flex items-baseline gap-2 text-sm font-bold text-content">
                  Proposed items
                  <span className="text-xs font-medium text-content-muted">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </h4>

                <ul className="mt-2 divide-y divide-line-soft border-y border-line-soft">
                  {items.map((item, index) => {
                    const quantity = Number(
                      item.proposed_quantity ?? item.quantity ?? 1
                    );

                    const unitPrice = item.proposed_unit_price;

                    const lineTotal =
                      unitPrice === null || unitPrice === undefined
                        ? null
                        : Number(unitPrice) * quantity;

                    return (
                      <li
                        key={item.erand_item_id || item.id || index}
                        className="flex items-start justify-between gap-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-content">
                            {item.item_name ||
                              item.name ||
                              item.description ||
                              "Errand item"}
                          </p>

                          <p className="mt-0.5 text-xs text-content-muted">
                            Quantity {quantity}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-bold tabular-nums text-content">
                          {formatMoney(lineTotal, currency)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleBody>
      </div>

      <footer className="flex flex-col gap-3 border-t border-line-soft bg-surface/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {status === "pending" ? (
          <CompareCheck
            offer={offer}
            selected={selected}
            disabled={compareFull}
            onToggle={onToggleCompare}
          />
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => onReview(offer)}
          disabled={status !== "pending"}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-navy px-6 py-2.5 text-sm font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review and decide
        </button>
      </footer>
    </article>
  );
}

/* -------------------------------------------------------
   DENSE TABLE
------------------------------------------------------- */

function OffersTable({
  offers,
  currency,
  estimate,
  lowestId,
  latestId,
  compareIds,
  onToggleCompare,
  onReview,
}) {
  const compareFull = compareIds.length >= MAX_COMPARE;

  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-surface-white px-5 py-3 shadow-erander-card sm:px-8">
      <table
        className="w-full min-w-[720px] text-left text-sm"
        aria-label="Erander offers"
      >
        <thead>
          <tr className="border-b border-line text-xs text-content-muted">
            <th className="py-3 pr-4 font-semibold">Erander</th>
            <th className="px-4 py-3 text-right font-semibold">Total</th>
            <th className="px-4 py-3 text-right font-semibold">Fees</th>

            {estimate > 0 && (
              <th className="px-4 py-3 text-right font-semibold">
                Against your estimate
              </th>
            )}

            <th className="px-4 py-3 font-semibold">Compare</th>

            <th className="py-3 pl-4 text-right font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line-soft">
          {offers.map((offer) => {
            const total = getProposalTotal(offer);
            const status = getOfferStatus(offer);

            return (
              <tr key={offer.id}>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-3">
                    <Avatar offer={offer} />

                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-content">
                        <span className="truncate">{getName(offer)}</span>

                        <OfferBadges
                          offer={offer}
                          isLowest={offer.id === lowestId}
                          isLatest={offer.id === latestId}
                        />
                      </p>

                      <p className="mt-0.5 text-xs text-content-muted">
                        {formatDate(offer.created_at || offer.createdAt)}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3.5 text-right font-extrabold tabular-nums text-content">
                  {formatMoney(total, currency)}
                </td>

                <td className="px-4 py-3.5 text-right tabular-nums text-content-muted">
                  {formatMoney(getExtraFees(offer), currency)}
                </td>

                {estimate > 0 && (
                  <td className="px-4 py-3.5 text-right">
                    {total !== null ? (
                      <DifferenceIndicator
                        original={estimate}
                        proposed={total}
                        currency={currency}
                      />
                    ) : (
                      <span className="text-xs text-content-subtle">—</span>
                    )}
                  </td>
                )}

                <td className="px-4 py-3.5">
                  <CompareCheck
                    offer={offer}
                    selected={compareIds.includes(offer.id)}
                    disabled={compareFull}
                    onToggle={onToggleCompare}
                  />
                </td>

                <td className="py-3.5 pl-4 text-right">
                  <button
                    type="button"
                    onClick={() => onReview(offer)}
                    disabled={status !== "pending"}
                    className="rounded-full bg-brand-navy px-4 py-2 text-xs font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Review
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------
   COMPARE BAR + MODAL
------------------------------------------------------- */

function CompareBar({ count, onOpen, onClear }) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-full border border-line bg-surface-white px-5 py-3 shadow-[0_16px_45px_rgba(9,20,38,0.18)]">
      <p className="text-sm text-content-muted">
        <span className="font-bold text-content">{count}</span> selected
        {count < 2 ? " · pick at least 2" : ""}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-3 py-2 text-sm font-semibold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onOpen}
          disabled={count < 2}
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Scale size={15} aria-hidden="true" />
          Compare
        </button>
      </div>
    </div>
  );
}

function CompareModal({
  offers,
  currency,
  originalItems,
  estimate,
  onClose,
  onReview,
}) {
  const itemRows = useMemo(() => {
    const rows = new Map();

    offers.forEach((offer) => {
      getOfferItems(offer).forEach((item) => {
        const key = String(item.erand_item_id || item.id || item.item_name);

        if (rows.has(key)) return;

        const original = originalItems.find(
          (candidate) => String(candidate.id) === String(item.erand_item_id)
        );

        rows.set(
          key,
          item.item_name ||
            original?.item_name ||
            original?.name ||
            "Errand item"
        );
      });
    });

    return [...rows.entries()];
  }, [offers, originalItems]);

  const lineTotal = (offer, key) => {
    const item = getOfferItems(offer).find(
      (candidate) =>
        String(candidate.erand_item_id || candidate.id || candidate.item_name) ===
        key
    );

    if (!item) return null;

    const price = Number(item.proposed_unit_price);
    const quantity = Number(item.proposed_quantity ?? item.quantity ?? 1);

    return Number.isFinite(price) ? price * quantity : null;
  };

  const renderRow = (label, values, { emphasize = true } = {}) => {
    const numeric = values.filter((value) => typeof value === "number");
    const best = numeric.length > 1 ? Math.min(...numeric) : null;

    return (
      <tr key={label}>
        <th
          scope="row"
          className="py-3 pr-4 text-left text-sm font-medium text-content-muted"
        >
          {label}
        </th>

        {values.map((value, index) => (
          <td
            key={`${label}-${index}`}
            className={`px-3 py-3 text-right text-sm tabular-nums ${
              emphasize && best !== null && value === best
                ? "font-extrabold text-success-dark"
                : "font-semibold text-content"
            }`}
          >
            {value === null ? "—" : formatMoney(value, currency)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Compare offers"
      description="The lowest figure in each row is highlighted."
      size="2xl"
    >
      <div className="max-h-[65dvh] overflow-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="py-3 pr-4" />

              {offers.map((offer) => (
                <th
                  key={offer.id}
                  className="px-3 py-3 text-right align-bottom text-sm font-extrabold text-content"
                >
                  {getName(offer)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line-soft">
            {renderRow(
              "Proposed total",
              offers.map((offer) => getProposalTotal(offer))
            )}

            {renderRow(
              "Items",
              offers.map((offer) => Number(offer.proposed_item_total) || 0)
            )}

            {renderRow(
              "Service fee",
              offers.map((offer) => Number(offer.proposed_service_fee) || 0)
            )}

            {renderRow(
              "Delivery fee",
              offers.map((offer) => Number(offer.proposed_delivery_fee) || 0)
            )}

            {renderRow(
              "Other fees",
              offers.map((offer) => Number(offer.proposed_other_fees) || 0)
            )}

            {renderRow(
              "All extra fees",
              offers.map((offer) => getExtraFees(offer))
            )}

            {estimate > 0 ? (
              <tr>
                <th
                  scope="row"
                  className="py-3 pr-4 text-left text-sm font-medium text-content-muted"
                >
                  Against your estimate
                </th>

                {offers.map((offer) => (
                  <td key={offer.id} className="px-3 py-3 text-right">
                    <DifferenceIndicator
                      original={estimate}
                      proposed={getProposalTotal(offer) ?? 0}
                      currency={currency}
                    />
                  </td>
                ))}
              </tr>
            ) : null}

            {itemRows.map(([key, label]) =>
              renderRow(
                label,
                offers.map((offer) => lineTotal(offer, key))
              )
            )}

            <tr>
              <th className="py-4 pr-4" />

              {offers.map((offer) => (
                <td key={offer.id} className="px-3 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onReview(offer)}
                    className="rounded-full bg-brand-navy px-4 py-2 text-xs font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
                  >
                    Review and decide
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------
   PLAIN BREAKDOWN (used when the customer set no estimate)
------------------------------------------------------- */

function ProposalBreakdown({ offer, proposedItems, currency }) {
  return (
    <section>
      <h3 className="text-sm font-extrabold tracking-tight text-content">
        What this offer is made of
      </h3>

      <p className="mt-1 text-sm leading-6 text-content-muted">
        You did not set an estimate for this errand, so there is nothing to
        compare against. Here is the full breakdown instead.
      </p>

      {proposedItems.length > 0 && (
        <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
          {proposedItems.map((item, index) => (
            <li
              key={item.erand_item_id || item.id || index}
              className="flex items-start justify-between gap-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-content">
                  {item.item_name}
                </p>
                <p className="mt-0.5 text-xs text-content-muted">
                  Quantity {item.proposed_quantity}
                </p>
              </div>

              <p className="shrink-0 text-sm font-bold tabular-nums text-content">
                {formatMoney(
                  item.proposed_unit_price * item.proposed_quantity,
                  currency
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 divide-y divide-dashed divide-line-strong border-y border-dashed border-line-strong">
        {FEE_PARTS.map((part) => (
          <div
            key={part.key}
            className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
          >
            <dt className="text-content-muted">{part.label}</dt>
            <dd className="font-semibold tabular-nums text-content">
              {formatMoney(Number(offer[part.key]) || 0, currency)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* -------------------------------------------------------
   REVIEW MODAL (uses shared <Modal>)
------------------------------------------------------- */

function ReviewModal({
  offer,
  currency,
  originalItems,
  estimate,
  proposedTotal,
  accepting,
  onClose,
  onAccept,
}) {
  const name = getName(offer);
  const status = getOfferStatus(offer);
  const canAccept = status === "pending" && !accepting;
  const hasEstimate = estimate > 0;

  const proposedItems = useMemo(
    () => buildProposalItems(offer, originalItems),
    [offer, originalItems]
  );

  const itemNotes = proposedItems.filter((item) => item.notes);

  const statusLabel =
    status === "pending"
      ? "Awaiting your decision"
      : status === "expired"
        ? "Expired"
        : status === "withdrawn"
          ? "Withdrawn"
          : status;

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!accepting) onClose();
      }}
      title={`Offer from ${name}`}
      description={`Submitted ${formatDate(
        offer.created_at || offer.createdAt
      )} · ${statusLabel}`}
      size="2xl"
      position="center"
      closeOnOverlayClick={!accepting}
      closeOnEscape={!accepting}
    >
      <div className="max-h-[60dvh] overflow-y-auto pr-1">
        {offer.offer_message ? (
          <section>
            <h3 className="text-sm font-extrabold tracking-tight text-content">
              Message from {name}
            </h3>

            <p className="mt-2 whitespace-pre-wrap border-l-4 border-brand-green pl-4 text-sm leading-6 text-content">
              {offer.offer_message}
            </p>
          </section>
        ) : null}

        <div className={offer.offer_message ? "mt-5" : ""}>
          {hasEstimate ? (
            <PriceComparison
              originalItems={originalItems}
              proposedItems={proposedItems}
              originalTotal={estimate}
              proposedTotal={proposedTotal}
              acceptedOffer={offer}
              currency={currency}
            />
          ) : (
            <ProposalBreakdown
              offer={offer}
              proposedItems={proposedItems}
              currency={currency}
            />
          )}
        </div>

        {itemNotes.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-extrabold tracking-tight text-content">
              Notes on individual items
            </h3>

            <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
              {itemNotes.map((item, index) => (
                <li
                  key={item.erand_item_id || item.id || index}
                  className="py-3"
                >
                  <p className="text-sm font-bold text-content">
                    {item.item_name}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-content-muted">
                    {item.notes}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasEstimate && proposedTotal !== null && (
          <div className="mt-5">
            <BudgetMonitor
              budget={estimate}
              proposedTotal={proposedTotal}
              approvedTotal={proposedTotal}
              currency={currency}
            />
          </div>
        )}

        <div className="mt-5 flex items-start gap-3 border-l-4 border-brand-green bg-brand-pale/60 py-3 pl-4 pr-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-success"
            aria-hidden="true"
          />

          <p className="text-sm leading-6 text-content">
            Accepting assigns {name} to your errand at{" "}
            <strong>{formatMoney(proposedTotal, currency)}</strong> and
            creates the agreement. You can then fund the errand.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-line-soft pt-4 sm:justify-end">
        <p className="text-right">
          <span className="block text-xs text-content-muted">
            Proposed total
          </span>

          <span className="text-lg font-extrabold tabular-nums text-content">
            {formatMoney(proposedTotal, currency)}
          </span>
        </p>

        <button
          type="button"
          onClick={() => onAccept(offer)}
          disabled={!canAccept}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={17} aria-hidden="true" />
          Accept offer
        </button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------
   SKELETON LOADING STATE
------------------------------------------------------- */

function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse overflow-hidden rounded-3xl border border-line bg-surface-white shadow-erander-card"
    >
      <div className="flex items-start gap-4 p-6 pb-4">
        <div className="h-12 w-12 shrink-0 rounded-full bg-surface-muted" />

        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-40 rounded bg-surface-muted" />
          <div className="h-3 w-32 rounded bg-surface-muted" />
          <div className="h-6 w-36 rounded-full bg-surface-muted" />
        </div>

        <div className="space-y-2.5">
          <div className="ml-auto h-3 w-20 rounded bg-surface-muted" />
          <div className="ml-auto h-6 w-28 rounded bg-surface-muted" />
          <div className="ml-auto h-6 w-24 rounded-full bg-surface-muted" />
        </div>
      </div>

      <div className="space-y-4 border-t border-line-soft px-6 py-5">
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-surface-muted" />
          <div className="h-3 w-4/5 rounded bg-surface-muted" />
        </div>

        <div className="h-2.5 w-full rounded-full bg-surface-muted" />

        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3 w-14 rounded bg-surface-muted" />
              <div className="h-4 w-20 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line-soft bg-surface/60 px-6 py-4">
        <div className="h-3 w-40 rounded bg-surface-muted" />
        <div className="h-11 w-40 rounded-full bg-surface-muted" />
      </div>
    </div>
  );
}

function OffersLoadingState({ onBack }) {
  return (
    <DashboardLayout>
      <main
        className="mx-auto w-full max-w-[1440px] space-y-6 px-0 py-6 sm:px-2 lg:py-8"
        role="status"
        aria-live="polite"
        aria-label="Loading erander offers"
      >
        <span className="sr-only">Loading erander offers</span>

        <BackButton onClick={onBack} label="Back to errand" />

        <div className="h-60 animate-pulse rounded-3xl bg-brand-navy/90" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-11 w-full animate-pulse rounded-full bg-surface-muted sm:w-80" />
          <div className="h-11 w-full animate-pulse rounded-full bg-surface-muted sm:w-72" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </main>
    </DashboardLayout>
  );
}

/* -------------------------------------------------------
   MESSAGE PANELS
------------------------------------------------------- */

function MessagePanel({ icon: Icon, title, body, tone = "dashed", children }) {
  return (
    <div
      className={`rounded-3xl p-8 text-center ${
        tone === "dashed"
          ? "border border-dashed border-line-strong bg-surface"
          : "border border-line bg-surface"
      }`}
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-pale text-brand-navy">
        <Icon size={26} aria-hidden="true" />
      </span>

      <h2 className="mt-4 text-lg font-extrabold tracking-tight text-content">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-content-muted">
        {body}
      </p>

      {children && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   MAIN PAGE
------------------------------------------------------- */

export default function EranderOffersSection({
  erandId: providedErandId,
  currency: currencyProp = "NGN",
  onAccepted,
  onGoBack,
  originalItems: providedItems = [],
  estimatedTotal,
}) {
  const navigate = useNavigate();

  const { errandId: routeErrandId } = useParams();

  const erandId = providedErandId || routeErrandId;

  const [offers, setOffers] = useState([]);
  const [errand, setErrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("cards");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("price_low");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [reviewOffer, setReviewOffer] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const requestSequenceRef = useRef(0);

  /* -----------------------------------------------------
     FETCH OFFERS + THE ERRAND (items, estimate, currency)
  ----------------------------------------------------- */

  const loadOffers = useCallback(
    async ({ showLoader = true } = {}) => {
      if (
        erandId === undefined ||
        erandId === null ||
        String(erandId).trim() === ""
      ) {
        setOffers([]);
        setLoading(false);
        setLoadError("An errand ID was not provided.");
        return false;
      }

      const requestSequence = ++requestSequenceRef.current;

      if (showLoader) setLoading(true);

      setLoadError("");

      try {
        const [offersResult, errandResult] = await Promise.allSettled([
          getOffersForErrand(erandId),
          getErrandById(erandId),
        ]);

        if (requestSequence !== requestSequenceRef.current) return false;

        if (offersResult.status === "rejected") {
          throw offersResult.reason;
        }

        setOffers(extractOffersFromResponse(offersResult.value));

        if (errandResult.status === "fulfilled") {
          setErrand(unwrapErrand(errandResult.value));
        } else {
          console.error("Unable to fetch the errand:", errandResult.reason);
        }

        setVisibleCount(PAGE_SIZE);

        return true;
      } catch (error) {
        if (requestSequence !== requestSequenceRef.current) return false;

        console.error("Unable to fetch offers for errand:", error);

        setLoadError(
          error?.response?.data?.message ||
            error?.message ||
            "We couldn't retrieve the offers for this errand."
        );

        return false;
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [erandId]
  );

  useEffect(() => {
    loadOffers();

    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadOffers]);

  /* -----------------------------------------------------
     DERIVED DATA
  ----------------------------------------------------- */

  const currency = errand?.currency_code || currencyProp;

  const originalItems = useMemo(() => {
    if (providedItems.length > 0) return providedItems;

    return Array.isArray(errand?.items) ? errand.items : [];
  }, [providedItems, errand?.items]);

  const estimate = useMemo(() => {
    const provided = Number(estimatedTotal);

    if (Number.isFinite(provided) && provided > 0) return provided;

    const budget = Number(errand?.estimated_total);

    if (Number.isFinite(budget) && budget > 0) return budget;

    return originalItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity ?? 1) * Number(item.estimated_unit_price ?? 0),
      0
    );
  }, [estimatedTotal, errand?.estimated_total, originalItems]);

  const hasEstimate = estimate > 0;

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.filter(
        (option) => option.value !== "closest" || hasEstimate
      ),
    [hasEstimate]
  );

  const activeSort = sort === "closest" && !hasEstimate ? "price_low" : sort;

  const availableOffers = useMemo(
    () => offers.filter((offer) => getOfferStatus(offer) === "pending"),
    [offers]
  );

  const lowestId = useMemo(() => {
    let lowest = null;

    availableOffers.forEach((offer) => {
      const total = getProposalTotal(offer);

      if (total === null) return;

      if (lowest === null || total < lowest.total) {
        lowest = { id: offer.id, total };
      }
    });

    return availableOffers.length > 1 ? (lowest?.id ?? null) : null;
  }, [availableOffers]);

  const latestId = useMemo(() => {
    if (availableOffers.length < 2) return null;

    return [...availableOffers].sort(
      (first, second) => getOfferTime(second) - getOfferTime(first)
    )[0]?.id;
  }, [availableOffers]);

  const stats = useMemo(() => {
    const totals = availableOffers
      .map(getProposalTotal)
      .filter((value) => value !== null);

    if (!totals.length) return null;

    return {
      lowest: Math.min(...totals),
      highest: Math.max(...totals),
      average: totals.reduce((sum, value) => sum + value, 0) / totals.length,
    };
  }, [availableOffers]);

  const visibleOffers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = term
      ? availableOffers.filter((offer) =>
          getName(offer).toLowerCase().includes(term)
        )
      : availableOffers;

    const priceOf = (offer) =>
      getProposalTotal(offer) ?? Number.POSITIVE_INFINITY;

    return [...filtered].sort((first, second) => {
      switch (activeSort) {
        case "price_high":
          return (
            (getProposalTotal(second) ?? -1) - (getProposalTotal(first) ?? -1)
          );

        case "fees_low":
          return getExtraFees(first) - getExtraFees(second);

        case "closest":
          return (
            Math.abs(priceOf(first) - estimate) -
            Math.abs(priceOf(second) - estimate)
          );

        case "newest":
          return getOfferTime(second) - getOfferTime(first);

        case "price_low":
        default:
          return priceOf(first) - priceOf(second);
      }
    });
  }, [availableOffers, search, activeSort, estimate]);

  const shownOffers = visibleOffers.slice(0, visibleCount);

  const remainingCount = visibleOffers.length - shownOffers.length;

  const compareOffers = useMemo(
    () =>
      compareIds
        .map((id) => availableOffers.find((offer) => offer.id === id))
        .filter(Boolean),
    [compareIds, availableOffers]
  );

  /* -----------------------------------------------------
     ACTIONS
  ----------------------------------------------------- */

  const handleGoBack = useCallback(() => {
    if (typeof onGoBack === "function") {
      onGoBack();
      return;
    }

    navigate(-1);
  }, [onGoBack, navigate]);

  const toggleCompare = useCallback((id) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_COMPARE) return current;

      return [...current, id];
    });
  }, []);

  const handleAccept = async () => {
    if (!selectedOffer?.id || accepting) return;

    setAccepting(true);

    try {
      const response = await acceptErandOffer(selectedOffer.id);

      toast.success("Erander accepted successfully.");

      setSelectedOffer(null);
      setReviewOffer(null);
      setCompareOpen(false);
      setCompareIds([]);

      if (typeof onAccepted === "function") {
        await onAccepted(response);
        await loadOffers({ showLoader: false });
      } else {
        /* Offers are no longer pending, so go to the errand to fund it. */
        navigate(`/dashboard/erands/${encodeURIComponent(erandId)}`);
      }
    } catch (error) {
      console.error("Unable to accept erander offer:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "We could not accept this offer. Please try again."
      );
    } finally {
      setAccepting(false);
    }
  };

  /* -----------------------------------------------------
     LOADING, ERROR AND EMPTY STATES
  ----------------------------------------------------- */

  if (loading) {
    return <OffersLoadingState onBack={handleGoBack} />;
  }

  if (loadError) {
    return (
      <PageShell
        stats={null}
        currency={currency}
        count={0}
        onBack={handleGoBack}
      >
        <MessagePanel
          icon={Info}
          tone="solid"
          title="Unable to load offers"
          body={
            loadError ||
            "We couldn't retrieve the offers for this errand. Please try again."
          }
        >
          <button
            type="button"
            onClick={() => loadOffers()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>

          <button
            type="button"
            onClick={handleGoBack}
            className={secondaryButtonClass}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Go back
          </button>
        </MessagePanel>
      </PageShell>
    );
  }

  if (!offers.length) {
    return (
      <PageShell
        stats={null}
        currency={currency}
        count={0}
        onBack={handleGoBack}
        actions={<ErrandActionsMenu ariaLabel="Errand actions" />}
      >
        <MessagePanel
          icon={Package}
          title="No offers yet"
          body="Eranders who are interested in your errand will send their offers here. You can compare their prices and fees before choosing one."
        />
      </PageShell>
    );
  }

  if (!availableOffers.length) {
    return (
      <PageShell
        stats={null}
        currency={currency}
        count={0}
        onBack={handleGoBack}
        actions={<ErrandActionsMenu ariaLabel="Errand actions" />}
      >
        <MessagePanel
          icon={Info}
          tone="solid"
          title="No offers available to accept"
          body="The offers currently associated with this errand are no longer pending."
        />
      </PageShell>
    );
  }

  /* -----------------------------------------------------
     MAIN CONTENT
  ----------------------------------------------------- */

  const reviewFromCompare = (offer) => {
    setCompareOpen(false);
    setReviewOffer(offer);
  };

  return (
    <>
      <PageShell
        stats={stats}
        currency={currency}
        count={availableOffers.length}
        onBack={handleGoBack}
      >
        <section aria-label="Offers">
          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface-white p-4 shadow-erander-card sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="relative sm:w-80">
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
                placeholder="Search by erander name"
                aria-label="Search offers by erander name"
                className="h-11 w-full rounded-full border border-line bg-surface-white pl-10 pr-9 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand-navy focus:ring-2 focus:ring-brand-pale"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-56">
                <Select
                  options={sortOptions}
                  value={activeSort}
                  onChange={(value) => {
                    setSort(
                      Array.isArray(value)
                        ? String(value[0] ?? "price_low")
                        : String(value ?? "price_low")
                    );

                    setVisibleCount(PAGE_SIZE);
                  }}
                  placeholder="Sort offers"
                  aria-label="Sort offers"
                />
              </div>

              <OfferViewToggle value={view} onChange={setView} />

              <ErrandActionsMenu ariaLabel="Errand actions" />
            </div>
          </div>

          <div className="mt-5" aria-live="polite">
            {visibleOffers.length === 0 ? (
              <MessagePanel
                icon={Search}
                title="No offers match that name"
                body="Try a different name or clear the search."
              >
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={secondaryButtonClass}
                >
                  Clear search
                </button>
              </MessagePanel>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                {shownOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    currency={currency}
                    estimate={estimate}
                    isLowest={offer.id === lowestId}
                    isLatest={offer.id === latestId}
                    selected={compareIds.includes(offer.id)}
                    compareFull={compareIds.length >= MAX_COMPARE}
                    onToggleCompare={toggleCompare}
                    onReview={setReviewOffer}
                  />
                ))}
              </div>
            ) : (
              <OffersTable
                offers={shownOffers}
                currency={currency}
                estimate={estimate}
                lowestId={lowestId}
                latestId={latestId}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                onReview={setReviewOffer}
              />
            )}
          </div>

          {visibleOffers.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-content-muted">
                Showing {shownOffers.length} of {visibleOffers.length}{" "}
                {visibleOffers.length === 1 ? "offer" : "offers"}
              </p>

              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((count) => count + PAGE_SIZE)
                  }
                  className="rounded-full bg-surface-muted px-5 py-2.5 text-sm font-semibold text-content transition hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                >
                  Show {Math.min(PAGE_SIZE, remainingCount)} more
                </button>
              )}
            </div>
          )}

          <p className="mt-6 flex items-start gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale/60 py-3 pl-4 pr-3 text-sm leading-6 text-content">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-success"
              aria-hidden="true"
            />
            Accepting an offer assigns that erander and creates the agreement.
            Review the full price breakdown first, then fund the errand to let
            them begin.
          </p>

          <CompareBar
            count={compareOffers.length}
            onOpen={() => setCompareOpen(true)}
            onClear={() => setCompareIds([])}
          />
        </section>
      </PageShell>

      {compareOpen && compareOffers.length >= 2 ? (
        <CompareModal
          offers={compareOffers}
          currency={currency}
          originalItems={originalItems}
          estimate={estimate}
          onClose={() => setCompareOpen(false)}
          onReview={reviewFromCompare}
        />
      ) : null}

      {reviewOffer && !selectedOffer ? (
        <ReviewModal
          offer={reviewOffer}
          currency={currency}
          originalItems={originalItems}
          estimate={estimate}
          proposedTotal={getProposalTotal(reviewOffer)}
          accepting={accepting}
          onClose={() => setReviewOffer(null)}
          onAccept={setSelectedOffer}
        />
      ) : null}

      <Modal
        isOpen={Boolean(selectedOffer)}
        onClose={() => {
          if (!accepting) setSelectedOffer(null);
        }}
        title="Accept this erander's offer?"
        description={
          selectedOffer
            ? `You are accepting ${getName(
                selectedOffer
              )}'s offer for ${formatMoney(
                getProposalTotal(selectedOffer),
                currency
              )}. This assigns the erander to your errand and creates the agreement.`
            : ""
        }
        size="md"
        closeOnOverlayClick={!accepting}
        closeOnEscape={!accepting}
      >
        <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale/60 p-4">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-success"
            aria-hidden="true"
          />

          <p className="text-sm leading-6 text-content">
            Once accepted, you'll fund{" "}
            {selectedOffer
              ? formatMoney(getProposalTotal(selectedOffer), currency)
              : "the agreed amount"}{" "}
            to let the erander begin. You can still cancel before funding
            according to our policy.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={accepting}
            onClick={() => setSelectedOffer(null)}
            className="rounded-full border border-line px-5 py-3 text-sm font-bold text-content-muted transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:opacity-50"
          >
            Review again
          </button>

          <button
            type="button"
            disabled={accepting}
            onClick={handleAccept}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? (
              <>
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                Accept offer
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
