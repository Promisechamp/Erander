import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  MessageCircle,
  Scale,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import ActionMenu from "@/components/ActionMenu";

import { formatMoney, DifferenceIndicator } from "../../shared/ErrandTools";

import {
  COLLAPSED_HEIGHT,
  FEE_PARTS,
  formatDate,
  getName,
  getInitials,
  getOfferItems,
  getProposalTotal,
  getOfferStatus,
  getExtraFees,
  getExpiryText,
  getFeeShare,
  HIGH_FEE_SHARE,
  MAX_COMPARE,
} from "./offerUtils";

/* -------------------------------------------------------
   SHARED ACTIONS MENU
------------------------------------------------------- */

export function ErrandActionsMenu({ ariaLabel = "Errand actions" }) {
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

export function OfferViewToggle({ value, onChange }) {
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

/* -------------------------------------------------------
   PAGE SHELL (back link + hero)
------------------------------------------------------- */

export function PageShell({ stats, currency, count, onBack, actions, children }) {
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
   COLLAPSIBLE BODY
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

export function OfferCard({
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

export function OffersTable({
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
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
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
   COMPARE BAR
------------------------------------------------------- */

export function CompareBar({ count, onOpen, onClear }) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-full border border-line bg-surface-white px-5 py-1.5 shadow-[0_16px_45px_rgba(9,20,38,0.18)]">
      <p className="text-[12px] text-content-muted">
        <span className="font-bold text-content">{count} </span>
        selected <br /> {count < 2 ? " pick at least 2" : ""}
      </p>

      <p className="text-sm text-content-muted"></p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-3 py-2 text-[12px] underline font-semibold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
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

/* -------------------------------------------------------
   SKELETON / LOADING
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

export function OffersLoadingState({ onBack }) {
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
   MESSAGE PANEL
------------------------------------------------------- */

export function MessagePanel({
  icon: Icon,
  title,
  body,
  tone = "dashed",
  children,
}) {
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