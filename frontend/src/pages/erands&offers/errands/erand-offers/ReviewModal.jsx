import { useMemo } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import Modal from "@/components/Modal";

import {
  PriceComparison,
  BudgetMonitor,
  buildProposalItems,
  formatMoney,
} from "../../shared/ErrandTools";

import {
  FEE_PARTS,
  formatDate,
  getOfferStatus,
  getProposalTotal,
  getName,
} from "./offerUtils";

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
   REVIEW MODAL
------------------------------------------------------- */

export default function ReviewModal({
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
            <strong>{formatMoney(proposedTotal, currency)}</strong> and creates
            the agreement. You can then fund the errand.
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