import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Modal from "@/components/Modal";

import { formatMoney, DifferenceIndicator } from "../../shared/ErrandTools";

import {
  getExtraFees,
  getOfferItems,
  getProposalTotal,
  getName,
} from "./offerUtils";

const LABEL_W = 96;
const COL_W = 150;

const itemKeyOf = (item) =>
  String(item.erand_item_id || item.id || item.item_name);

export default function CompareModal({
  offers,
  currency,
  originalItems,
  estimate,
  onClose,
  onReview,
}) {
  const scrollRef = useRef(null);
  const tableRef = useRef(null);

  const [scrollState, setScrollState] = useState({
    canScroll: false,
    atStart: true,
    atEnd: true,
  });

  const itemRows = useMemo(() => {
    const rows = new Map();

    offers.forEach((offer) => {
      getOfferItems(offer).forEach((item) => {
        const key = itemKeyOf(item);

        if (rows.has(key)) return;

        const original = originalItems.find(
          (candidate) => String(candidate.id) === String(item.erand_item_id)
        );

        rows.set(
          key,
          item.item_name || original?.item_name || original?.name || "Errand item"
        );
      });
    });

    return [...rows.entries()];
  }, [offers, originalItems]);

  const tableWidth = LABEL_W + offers.length * COL_W;

  /* ---------- horizontal scroll tracking ---------- */

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;

    if (!element) return;

    const maxScroll = element.scrollWidth - element.clientWidth;
    const canScroll = maxScroll > 1;
    const left = Math.max(0, element.scrollLeft);

    setScrollState({
      canScroll,
      atStart: left <= 2,
      atEnd: !canScroll || maxScroll - left <= 2,
    });
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    const table = tableRef.current;

    if (!element || !table) return undefined;

    let frame;

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScrollState);
    };

    scheduleUpdate();

    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    let observer;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(element);
      observer.observe(table);
    }

    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      observer?.disconnect();
    };
  }, [updateScrollState, offers.length, itemRows.length, tableWidth]);

  /* ---------- helpers ---------- */

  const lineTotal = (offer, key) => {
    const item = getOfferItems(offer).find(
      (candidate) => itemKeyOf(candidate) === key
    );

    if (!item) return null;

    const price = Number(item.proposed_unit_price);
    const quantity = Number(item.proposed_quantity ?? item.quantity ?? 1);

    return Number.isFinite(price) ? price * quantity : null;
  };

  const labelCellClass =
    "sticky left-0 z-10 bg-surface-white border-b border-line-soft py-3 pr-2 text-left text-xs font-medium text-content-muted break-words";

  const renderRow = (rowKey, label, values, { emphasize = true } = {}) => {
    const numeric = values.filter((value) => typeof value === "number");

    const best = numeric.length > 1 ? Math.min(...numeric) : null;
    const hasSpread = numeric.length > 1 && Math.max(...numeric) !== best;

    return (
      <tr key={rowKey}>
        <th
          scope="row"
          className={labelCellClass}
          style={{ width: LABEL_W, minWidth: LABEL_W }}
        >
          {label}
        </th>

        {values.map((value, index) => (
          <td
            key={`${rowKey}-${index}`}
            style={{ width: COL_W, minWidth: COL_W }}
            className={`snap-start whitespace-nowrap border-b border-line-soft px-3 py-3 text-right text-sm tabular-nums ${
              emphasize && hasSpread && value === best
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

  const { canScroll, atStart, atEnd } = scrollState;

  const scrollMessage = !canScroll
    ? "All offers are visible"
    : atEnd
      ? "You've reached the last offer"
      : atStart
        ? "Swipe left to see more offers"
        : "Keep swiping to compare all offers";

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Compare offers"
      description="The lowest figure in each row is highlighted."
      size="sm"
    >
      <div className="w-full min-w-0 max-w-full space-y-3">
        <p
          id="compare-scroll-instruction"
          className="text-xs font-semibold text-content-muted"
          aria-live="polite"
        >
          {scrollMessage}
        </p>

        <div className="relative w-full min-w-0 max-w-full">
          <div
            ref={scrollRef}
            role="region"
            aria-label="Horizontally scrollable offer comparison"
            aria-describedby="compare-scroll-instruction"
            tabIndex={0}
            className="max-h-[60vh] w-full min-w-0 max-w-full snap-x snap-proximity overflow-auto overscroll-x-contain rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollPaddingLeft: LABEL_W,
              direction: "ltr",
            }}
          >
            <table
              ref={tableRef}
              className="table-fixed border-separate border-spacing-0 text-sm"
              style={{
                width: `${tableWidth}px`,
                minWidth: `${tableWidth}px`,
                maxWidth: "none",
              }}
              aria-label="Compare erander offers"
            >
              <thead>
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 border-b border-line bg-surface-white"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                  />

                  {offers.map((offer) => (
                    <th
                      key={offer.id}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className="sticky top-0 z-20 snap-start border-b border-line bg-surface-white px-3 py-3 text-right align-bottom"
                    >
                      <span className="block truncate text-sm font-extrabold text-content">
                        {getName(offer)}
                      </span>

                      <button
                        type="button"
                        onClick={() => onReview(offer)}
                        className="mt-2 whitespace-nowrap rounded-full bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
                      >
                        Review and decide
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {renderRow(
                  "total",
                  "Proposed total",
                  offers.map((offer) => getProposalTotal(offer))
                )}

                {renderRow(
                  "items",
                  "Items",
                  offers.map((offer) => Number(offer.proposed_item_total) || 0)
                )}

                {renderRow(
                  "service",
                  "Service fee",
                  offers.map((offer) => Number(offer.proposed_service_fee) || 0)
                )}

                {renderRow(
                  "delivery",
                  "Delivery fee",
                  offers.map((offer) => Number(offer.proposed_delivery_fee) || 0)
                )}

                {renderRow(
                  "other",
                  "Other fees",
                  offers.map((offer) => Number(offer.proposed_other_fees) || 0)
                )}

                {renderRow(
                  "extra",
                  "All extra fees",
                  offers.map((offer) => getExtraFees(offer))
                )}

                {estimate > 0 && (
                  <tr>
                    <th
                      scope="row"
                      className={labelCellClass}
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      Against your estimate
                    </th>

                    {offers.map((offer) => (
                      <td
                        key={offer.id}
                        style={{ width: COL_W, minWidth: COL_W }}
                        className="snap-start whitespace-nowrap border-b border-line-soft px-3 py-3 text-right"
                      >
                        <DifferenceIndicator
                          original={estimate}
                          proposed={getProposalTotal(offer) ?? 0}
                          currency={currency}
                        />
                      </td>
                    ))}
                  </tr>
                )}

                {itemRows.map(([key, label]) =>
                  renderRow(
                    `item-${key}`,
                    label,
                    offers.map((offer) => lineTotal(offer, key))
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* LEFT FADE (sits just right of the sticky label column) */}
          {canScroll && !atStart && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-20 w-6 bg-gradient-to-r from-surface-white/90 to-transparent"
              style={{ left: LABEL_W }}
            />
          )}

          {/* RIGHT FADE */}
          {canScroll && !atEnd && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-surface-white via-surface-white/80 to-transparent"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}