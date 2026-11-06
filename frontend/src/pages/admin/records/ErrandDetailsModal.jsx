import { LoaderCircle } from "lucide-react";

import Modal from "@/components/Modal";

import {
  Banner,
  CopyButton,
  DetailField,
  PersonButton,
  StatusPill,
  StructuredValue,
} from "./RecordsUI";
import { BTN_GHOST, BTN_NAVY } from "./recordsStyles";
import { currencyValue, humanize, shortId } from "./recordsUtils";

const SUMMARY_FIELDS = [
  "category",
  "currency_code",
  "estimated_total",
  "scheduled_for",
  "expires_at",
  "offers_enabled",
  "max_erander_offers",
  "current_version",
  "agreement_accepted_at",
  "agreement_locked_at",
  "created_at",
  "updated_at",
  "customer_notes",
  "location_snapshot",
];

const SNAPSHOT_KEYS = [
  "version",
  "reference_code",
  "title",
  "status",
  "category",
  "currency_code",
  "estimated_total",
  "scheduled_for",
  "expires_at",
  "customer_notes",
];

function Block({ title, count, children }) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-extrabold text-content">
        {title}
        {count !== undefined ? (
          <span className="ml-2 text-xs font-semibold text-content-muted">
            {count}
          </span>
        ) : null}
      </h4>
      {children}
    </section>
  );
}

function Meta({ label, children, wide = false, danger = false }) {
  if (children === null || children === undefined || children === "") return null;

  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
        {label}
      </dt>
      <dd
        className={`break-words text-xs ${
          danger ? "text-rose-700" : "text-content"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function SubList({ title, children }) {
  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="mb-1.5 text-[11px] font-bold text-content-muted">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EntryCard({ entry, errand, openProfile }) {
  const title = humanize(
    entry.payment_type ||
      entry.settlement_type ||
      entry.transaction_type ||
      entry.status ||
      entry.change_type ||
      "Record"
  );

  const amount =
    entry.amount_minor != null
      ? currencyValue(entry.amount_minor, entry.currency_code, true)
      : entry.amount != null
        ? currencyValue(entry.amount, entry.currency_code)
        : entry.version_number
          ? `Version ${entry.version_number}`
          : "";

  return (
    <div className="rounded-2xl border border-line p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-bold text-content">{title}</p>
        <span className="text-sm font-extrabold tabular-nums text-content">
          {amount}
        </span>
      </div>

      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        <Meta label="Status">{entry.status ? humanize(entry.status) : ""}</Meta>
        <Meta label="Created">
          {entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}
        </Meta>
        <Meta label="ID" wide>
          <span className="inline-flex items-center gap-1">
            <code className="break-all">{entry.id}</code>
            <CopyButton value={entry.id} />
          </span>
        </Meta>
        <Meta label="Provider reference" wide>
          {entry.provider_reference}
        </Meta>
        <Meta label="Reason" wide>
          {entry.reason}
        </Meta>
        <Meta label="Failure" wide danger>
          {entry.failure_reason}
        </Meta>
        <Meta label="Claim" wide>
          {entry.claim_reason}
        </Meta>
        <Meta label="Description" wide>
          {entry.description}
        </Meta>
      </dl>

      {entry.payer_profile ? (
        <div className="mt-2">
          <span className="mr-2 text-[10px] text-content-muted">Payer</span>
          <PersonButton
            profile={entry.payer_profile}
            fallbackId={entry.payer_id}
            onClick={openProfile}
          />
        </div>
      ) : null}

      {entry.recipient_profile ? (
        <div className="mt-2">
          <span className="mr-2 text-[10px] text-content-muted">Recipient</span>
          <PersonButton
            profile={entry.recipient_profile}
            fallbackId={entry.recipient_id}
            onClick={openProfile}
          />
        </div>
      ) : null}

      {entry.changed_by_profile ? (
        <div className="mt-2">
          <span className="mr-2 text-[10px] text-content-muted">Changed by</span>
          <PersonButton
            profile={entry.changed_by_profile}
            fallbackId={entry.changed_by}
            onClick={openProfile}
          />
        </div>
      ) : null}

      {entry.refunds?.length > 0 ? (
        <SubList title="Refunds">
          {entry.refunds.map((refund) => (
            <p key={refund.id} className="text-[11px] text-content-muted">
              {humanize(refund.status)} ·{" "}
              {currencyValue(refund.amount, refund.currency_code)} ·{" "}
              {refund.reason || "No reason"}
              {refund.provider_refund_reference
                ? ` · Provider ref ${refund.provider_refund_reference}`
                : ""}
              <CopyButton value={refund.id} />
            </p>
          ))}
        </SubList>
      ) : null}

      {entry.confirmations?.length > 0 ? (
        <SubList title="Provider confirmations">
          {entry.confirmations.map((confirmation) => (
            <p key={confirmation.id} className="text-[11px] text-content-muted">
              {currencyValue(
                confirmation.verified_amount,
                confirmation.verified_currency_code
              )}{" "}
              · {humanize(confirmation.confirmation_source)} ·{" "}
              {confirmation.verification_reference || "No verification reference"}
              <CopyButton value={confirmation.id} />
            </p>
          ))}
        </SubList>
      ) : null}

      {entry.events?.length > 0 ? (
        <SubList title="Payment provider events">
          {entry.events.map((providerEvent) => (
            <p key={providerEvent.id} className="text-[11px] text-content-muted">
              {providerEvent.payment_provider} · {providerEvent.event_type} ·{" "}
              {humanize(providerEvent.processing_status)}
              {providerEvent.failure_reason
                ? ` · ${providerEvent.failure_reason}`
                : ""}
              <CopyButton value={providerEvent.id} />
            </p>
          ))}
        </SubList>
      ) : null}

      {entry.snapshot ? (
        <SubList title="Version snapshot">
          <div className="grid gap-1 rounded-xl bg-surface-muted/60 p-2.5 sm:grid-cols-2">
            {entry.snapshot.id ? (
              <p className="flex items-center gap-1 text-[11px] text-content-muted">
                Errand ID: <code className="break-all">{entry.snapshot.id}</code>
                <CopyButton value={entry.snapshot.id} />
              </p>
            ) : null}

            {entry.snapshot.requested_by ? (
              <div className="text-[11px] text-content-muted">
                Customer:{" "}
                <PersonButton
                  profile={errand.customer}
                  fallbackId={entry.snapshot.requested_by}
                  onClick={openProfile}
                />
              </div>
            ) : null}

            {entry.snapshot.assigned_erander_id ? (
              <div className="text-[11px] text-content-muted">
                Assigned erander:{" "}
                <PersonButton
                  profile={errand.assigned_erander}
                  fallbackId={entry.snapshot.assigned_erander_id}
                  onClick={openProfile}
                />
              </div>
            ) : null}

            {SNAPSHOT_KEYS.filter(
              (key) =>
                entry.snapshot[key] !== undefined && entry.snapshot[key] !== null
            ).map((key) => (
              <p key={key} className="break-words text-[11px] text-content">
                <b>{humanize(key)}:</b> {String(entry.snapshot[key])}
              </p>
            ))}
          </div>
        </SubList>
      ) : null}

      {entry.entries?.length > 0 ? (
        <SubList title="Journal entries">
          {entry.entries.map((ledgerEntry) => (
            <div
              key={ledgerEntry.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-muted"
            >
              <span>
                {ledgerEntry.account_code} · {ledgerEntry.entry_type} · Debit{" "}
                {currencyValue(ledgerEntry.debit_amount, ledgerEntry.currency_code)}{" "}
                · Credit{" "}
                {currencyValue(ledgerEntry.credit_amount, ledgerEntry.currency_code)}
              </span>
              <span className="inline-flex items-center gap-1">
                <code>{shortId(ledgerEntry.id)}</code>
                <CopyButton value={ledgerEntry.id} />
              </span>
            </div>
          ))}
        </SubList>
      ) : null}

      {entry.evidence ? (
        <SubList title="Claim evidence">
          <StructuredValue value={entry.evidence} />
        </SubList>
      ) : null}
    </div>
  );
}

export default function ErrandDetailsModal({
  loading,
  errand,
  error,
  canManage,
  onToggleOffers,
  onClose,
  openProfile,
}) {
  const lists = errand
    ? [
        ["Payments", errand.payments],
        ["Settlements", errand.settlements],
        ["Financial ledger journals", errand.ledger_journals],
        ["Security-deposit reservations", errand.security_deposit_reservations],
        ["Security-deposit claims", errand.security_deposit_claims],
        ["Security-deposit transactions", errand.security_deposit_transactions],
        ["Errand version history", errand.versions],
      ]
    : [];

  return (
    <Modal
      isOpen={loading || !!errand || !!error}
      onClose={() => {
        if (!loading) onClose();
      }}
      title="Complete errand details"
      subtitle="Customer and erander view"
      description={errand?.reference_code || "Loading errand"}
      size="xl"
      position="bottom"
      height="auto"
      headerTone="navy"
      zIndex={70}
    >
      {loading && !errand ? (
        <div role="status" className="flex items-center gap-2 py-8 text-sm text-content-muted">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Loading complete errand
        </div>
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : errand ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-2xl bg-brand p-5 text-content-inverse">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-white/70">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider">
                    {errand.reference_code}
                  </p>
                  <CopyButton
                    value={errand.reference_code}
                    label="Errand reference copied"
                    className="!text-white/70 hover:!bg-white/10 hover:!text-white"
                  />
                </div>

                <h3 className="mt-1 break-words text-xl font-extrabold">
                  {errand.title}
                </h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/80">
                  {errand.description || "No description"}
                </p>
              </div>

              <span className="rounded-full bg-white p-0.5">
                <StatusPill value={errand.status} />
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span className="font-bold">Errand ID</span>
              <code className="break-all">{errand.id}</code>
              <CopyButton
                value={errand.id}
                className="!text-white/70 hover:!bg-white/10 hover:!text-white"
              />
            </div>
          </div>

          {canManage ? (
            <div>
              <button
                type="button"
                onClick={() => onToggleOffers(errand)}
                disabled={
                  !(
                    ["draft", "open"].includes(errand.status) &&
                    !errand.agreement_locked_at
                  )
                }
                className={BTN_NAVY}
              >
                {errand.offers_enabled ? "Pause new offers" : "Enable new offers"}
              </button>
            </div>
          ) : null}

          {/* People */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                Customer
              </p>
              {errand.customer ? (
                <PersonButton
                  profile={errand.customer}
                  fallbackId={errand.requested_by}
                  onClick={openProfile}
                />
              ) : (
                <span className="text-xs text-content-muted">—</span>
              )}
            </div>

            <div className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                Assigned erander
              </p>
              {errand.assigned_erander ? (
                <PersonButton
                  profile={errand.assigned_erander}
                  fallbackId={errand.assigned_erander_id}
                  onClick={openProfile}
                />
              ) : (
                <span className="text-xs text-content-muted">Not assigned</span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SUMMARY_FIELDS.map((key) => (
              <DetailField
                key={key}
                label={humanize(key)}
                value={errand[key]}
                row={errand}
                field={key}
              />
            ))}
          </div>

          {errand.business ? (
            <Block title="Business">
              <dl className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
                <Meta label="Business name">{errand.business.name}</Meta>
                <Meta label="Legal name">{errand.business.legal_name || "—"}</Meta>
                <Meta label="Verification">
                  {humanize(errand.business.verification_status)}
                </Meta>
                <Meta label="Account status">
                  {humanize(errand.business.account_status)}
                </Meta>
                <Meta label="Email / phone">
                  {errand.business.email || "—"} · {errand.business.phone || "—"}
                </Meta>
                <Meta label="Business ID">
                  <span className="inline-flex items-center gap-1">
                    <code className="break-all">{errand.business.id}</code>
                    <CopyButton value={errand.business.id} />
                  </span>
                </Meta>
                {errand.business.website ? (
                  <Meta label="Website" wide>
                    <a
                      href={errand.business.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-success-dark underline"
                    >
                      {errand.business.website}
                    </a>
                  </Meta>
                ) : null}
              </dl>
            </Block>
          ) : null}

          <Block title="Required items" count={errand.items?.length || 0}>
            {errand.items?.length ? (
              <div className="space-y-2">
                {errand.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-line p-3.5">
                    <div className="flex justify-between gap-3">
                      <b className="text-sm text-content">{item.item_name}</b>
                      <span className="shrink-0 text-xs text-content-muted">
                        {item.quantity} {item.unit}
                      </span>
                    </div>

                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-content-muted">
                      {item.description ||
                        item.customer_notes ||
                        "No additional instructions"}
                    </p>

                    {item.estimated_unit_price != null ? (
                      <p className="mt-1 text-xs text-content-muted">
                        Estimated unit price:{" "}
                        {currencyValue(item.estimated_unit_price, errand.currency_code)}
                      </p>
                    ) : null}

                    {item.item_url ? (
                      <a
                        href={item.item_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-xs text-success-dark underline"
                      >
                        {item.item_url}
                      </a>
                    ) : null}

                    <div className="mt-1 flex items-center gap-1">
                      <code className="break-all text-[11px] text-content-subtle">
                        {item.id}
                      </code>
                      <CopyButton value={item.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted">No itemized requirements.</p>
            )}
          </Block>

          <Block title="Pickup and delivery stops">
            {errand.stops?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {errand.stops.map((stop) => (
                  <div key={stop.id} className="rounded-2xl border border-line p-3.5">
                    <b className="text-xs text-content">
                      {humanize(stop.stop_type)} · {stop.sequence_number}
                    </b>
                    <p className="mt-1 break-words text-xs text-content-muted">
                      {[
                        stop.location_name,
                        stop.address_line_1,
                        stop.address_line_2,
                        stop.landmark,
                        stop.city,
                        stop.region,
                        stop.country_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No address"}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {stop.contact_name || ""} {stop.contact_phone || ""}
                    </p>
                    {stop.instructions ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-content-muted">
                        {stop.instructions}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted">
                No separate stop records. Check the location snapshot above.
              </p>
            )}
          </Block>

          <Block title="Offers" count={errand.offers?.length || 0}>
            {errand.offers?.length ? (
              <div className="space-y-2">
                {errand.offers.map((offer) => (
                  <div key={offer.id} className="rounded-2xl border border-line p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <PersonButton
                        profile={offer.offered_by_profile}
                        fallbackId={offer.offered_by}
                        onClick={openProfile}
                      />
                      <StatusPill value={offer.status} />
                    </div>

                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-content-muted">
                      {offer.offer_message || "No offer message"}
                    </p>

                    <p className="mt-2 text-sm font-extrabold tabular-nums text-content">
                      Total: {currencyValue(offer.proposed_total, offer.currency_code)}
                    </p>
                    <p className="mt-1 text-[11px] text-content-muted">
                      Items {currencyValue(offer.proposed_item_total, offer.currency_code)}{" "}
                      · Service{" "}
                      {currencyValue(offer.proposed_service_fee, offer.currency_code)} ·
                      Delivery{" "}
                      {currencyValue(offer.proposed_delivery_fee, offer.currency_code)} ·
                      Other {currencyValue(offer.proposed_other_fees, offer.currency_code)}
                    </p>

                    {offer.items?.length > 0 ? (
                      <SubList title="Offered items">
                        {offer.items.map((item) => (
                          <p key={item.id} className="text-xs text-content-muted">
                            {item.item?.item_name || item.erand_item_id}:{" "}
                            {item.proposed_quantity} ×{" "}
                            {currencyValue(item.proposed_unit_price, offer.currency_code)}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </p>
                        ))}
                      </SubList>
                    ) : null}

                    <div className="mt-2 flex items-center gap-1">
                      <code className="break-all text-[11px] text-content-subtle">
                        Offer ID: {offer.id}
                      </code>
                      <CopyButton value={offer.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted">No offers submitted.</p>
            )}
          </Block>

          {lists.map(([heading, list]) => (
            <Block key={heading} title={heading} count={list?.length || 0}>
              {list?.length ? (
                <div className="space-y-2">
                  {list.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      errand={errand}
                      openProfile={openProfile}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted">
                  No {heading.toLowerCase()} recorded.
                </p>
              )}
            </Block>
          ))}

          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}