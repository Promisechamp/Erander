import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileJson,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Package,
  Pause,
  Play,
  StickyNote,
} from "lucide-react";

import Modal from "@/components/Modal";
import { listAdminChats } from "@/services/chat/chatApi";

import {
  Banner,
  CopyButton,
  DetailField,
  PersonButton,
  StatusPill,
  StructuredValue,
} from "../shared/data-table/RecordsUI";
import { BTN_GHOST, BTN_NAVY } from "../shared/data-table/recordsStyles";
import {
  GROUP_TONE,
  copyText,
  currencyValue,
  humanize,
  shortId,
  statusGroup,
} from "../shared/data-table/recordsUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DETAIL_FIELDS = [
  "category",
  "currency_code",
  "scheduled_for",
  "expires_at",
  "offers_enabled",
  "max_erander_offers",
  "current_version",
  "agreement_accepted_at",
  "agreement_locked_at",
  "created_at",
  "updated_at",
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

const BAR = {
  success: "border-l-success",
  attention: "border-l-amber-400",
  danger: "border-l-rose-500",
  neutral: "border-l-line-strong",
};

const MODAL_TONE = {
  success: "success",
  attention: "warning",
  danger: "danger",
  neutral: "info",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const count = (list) => (Array.isArray(list) ? list.length : 0);

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Section({ icon: Icon, title, count: total, children }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-content">
        {Icon ? <Icon size={16} className="text-content-muted" aria-hidden="true" /> : null}
        {title}
        {total !== undefined ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-content-muted">
            {total}
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return (
    <p className="rounded-2xl bg-surface-muted/60 p-4 text-center text-sm text-content-muted">
      {children}
    </p>
  );
}

function Meta({ label, children, wide = false, danger = false }) {
  if (children === null || children === undefined || children === "") return null;

  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
        {label}
      </dt>
      <dd className={`break-words text-xs ${danger ? "text-rose-700" : "text-content"}`}>
        {children}
      </dd>
    </div>
  );
}

function SubList({ title, total, children }) {
  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="mb-1.5 text-[11px] font-bold text-content-muted">
        {title}
        {total !== undefined ? <span className="ml-1.5 opacity-70">({total})</span> : null}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-muted/60 p-3.5">
      <p className="truncate text-[11px] font-semibold text-content-muted">{label}</p>
      <p className="mt-1 truncate text-base font-extrabold tabular-nums text-content">
        {value}
      </p>
      {hint ? <p className="truncate text-[11px] text-content-subtle">{hint}</p> : null}
    </div>
  );
}

/** A card that shows a short header and opens to show everything else. */
function Expandable({ title, subtitle, right, status, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-line bg-surface-white">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-content">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] text-content-muted">
              {subtitle}
            </span>
          ) : null}
        </span>

        {right ? (
          <span className="hidden shrink-0 text-sm font-extrabold tabular-nums text-content sm:block">
            {right}
          </span>
        ) : null}

        {status ? <StatusPill value={status} /> : null}

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-content-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? <div className="border-t border-line-soft p-3.5">{children}</div> : null}
    </div>
  );
}

function EntryCard({ entry, errand, openProfile }) {
  const title = humanize(
    entry.payment_type ||
      entry.settlement_type ||
      entry.transaction_type ||
      entry.change_type ||
      entry.status ||
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
    <Expandable
      title={title}
      subtitle={formatDate(entry.created_at) || shortId(entry.id)}
      right={amount}
      status={entry.status}
    >
      <dl className="grid gap-2.5 sm:grid-cols-2">
        <Meta label="ID" wide>
          <span className="inline-flex items-center gap-1">
            <code className="break-all">{entry.id}</code>
            <CopyButton value={entry.id} />
          </span>
        </Meta>
        <Meta label="Provider reference" wide>{entry.provider_reference}</Meta>
        <Meta label="Reason" wide>{entry.reason}</Meta>
        <Meta label="Failure" wide danger>{entry.failure_reason}</Meta>
        <Meta label="Claim" wide>{entry.claim_reason}</Meta>
        <Meta label="Description" wide>{entry.description}</Meta>
      </dl>

      {[
        ["Payer", entry.payer_profile, entry.payer_id],
        ["Recipient", entry.recipient_profile, entry.recipient_id],
        ["Changed by", entry.changed_by_profile, entry.changed_by],
      ].map(([label, profile, id]) =>
        profile ? (
          <div key={label} className="mt-2.5 flex items-center gap-2">
            <span className="text-[11px] text-content-muted">{label}</span>
            <PersonButton profile={profile} fallbackId={id} onClick={openProfile} />
          </div>
        ) : null
      )}

      {entry.refunds?.length > 0 ? (
        <SubList title="Refunds" total={entry.refunds.length}>
          {entry.refunds.map((refund) => (
            <p key={refund.id} className="text-[11px] text-content-muted">
              {humanize(refund.status)} · {currencyValue(refund.amount, refund.currency_code)} ·{" "}
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
        <SubList title="Provider confirmations" total={entry.confirmations.length}>
          {entry.confirmations.map((confirmation) => (
            <p key={confirmation.id} className="text-[11px] text-content-muted">
              {currencyValue(confirmation.verified_amount, confirmation.verified_currency_code)} ·{" "}
              {humanize(confirmation.confirmation_source)} ·{" "}
              {confirmation.verification_reference || "No verification reference"}
              <CopyButton value={confirmation.id} />
            </p>
          ))}
        </SubList>
      ) : null}

      {entry.events?.length > 0 ? (
        <SubList title="Payment provider events" total={entry.events.length}>
          {entry.events.map((event) => (
            <p key={event.id} className="text-[11px] text-content-muted">
              {event.payment_provider} · {event.event_type} · {humanize(event.processing_status)}
              {event.failure_reason ? ` · ${event.failure_reason}` : ""}
              <CopyButton value={event.id} />
            </p>
          ))}
        </SubList>
      ) : null}

      {entry.snapshot ? (
        <SubList title="Version snapshot">
          <div className="grid gap-1.5 rounded-xl bg-surface-muted/60 p-3 sm:grid-cols-2">
            {entry.snapshot.id ? (
              <p className="flex items-center gap-1 text-[11px] text-content-muted">
                Errand ID: <code className="break-all">{entry.snapshot.id}</code>
                <CopyButton value={entry.snapshot.id} />
              </p>
            ) : null}

            {entry.snapshot.requested_by ? (
              <div className="flex items-center gap-2 text-[11px] text-content-muted">
                Customer
                <PersonButton
                  profile={errand.customer}
                  fallbackId={entry.snapshot.requested_by}
                  onClick={openProfile}
                />
              </div>
            ) : null}

            {entry.snapshot.assigned_erander_id ? (
              <div className="flex items-center gap-2 text-[11px] text-content-muted">
                Erander
                <PersonButton
                  profile={errand.assigned_erander}
                  fallbackId={entry.snapshot.assigned_erander_id}
                  onClick={openProfile}
                />
              </div>
            ) : null}

            {SNAPSHOT_KEYS.filter(
              (key) => entry.snapshot[key] !== undefined && entry.snapshot[key] !== null
            ).map((key) => (
              <p key={key} className="break-words text-[11px] text-content">
                <b>{humanize(key)}:</b> {String(entry.snapshot[key])}
              </p>
            ))}
          </div>
        </SubList>
      ) : null}

      {entry.entries?.length > 0 ? (
        <SubList title="Journal entries" total={entry.entries.length}>
          {entry.entries.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-muted"
            >
              <span>
                {line.account_code} · {line.entry_type} · Dr{" "}
                {currencyValue(line.debit_amount, line.currency_code)} · Cr{" "}
                {currencyValue(line.credit_amount, line.currency_code)}
              </span>
              <span className="inline-flex items-center gap-1">
                <code>{shortId(line.id)}</code>
                <CopyButton value={line.id} />
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
    </Expandable>
  );
}

function OfferCard({ offer, accepted, openProfile }) {
  return (
    <div
      className={`rounded-2xl border border-l-4 bg-surface-white p-4 ${
        accepted ? "border-line border-l-success" : "border-line border-l-line-strong"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PersonButton
          profile={offer.offered_by_profile}
          fallbackId={offer.offered_by}
          onClick={openProfile}
        />

        <div className="flex items-center gap-2">
          {accepted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-pale px-2.5 py-1 text-[11px] font-bold text-success-dark">
              <Check size={11} strokeWidth={3} aria-hidden="true" />
              Accepted
            </span>
          ) : null}
          <StatusPill value={offer.status} />
        </div>
      </div>

      <p className="mt-3 text-2xl font-extrabold tabular-nums text-content">
        {currencyValue(offer.proposed_total, offer.currency_code)}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Items", offer.proposed_item_total],
          ["Service", offer.proposed_service_fee],
          ["Delivery", offer.proposed_delivery_fee],
          ["Other", offer.proposed_other_fees],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-muted/60 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase text-content-muted">{label}</dt>
            <dd className="text-xs font-bold tabular-nums text-content">
              {currencyValue(value || 0, offer.currency_code)}
            </dd>
          </div>
        ))}
      </dl>

      {offer.offer_message ? (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface-muted/60 p-3 text-xs leading-5 text-content-muted">
          {offer.offer_message}
        </p>
      ) : null}

      {offer.items?.length > 0 ? (
        <SubList title="Offered items" total={offer.items.length}>
          {offer.items.map((item) => (
            <p key={item.id} className="text-xs text-content-muted">
              {item.item?.item_name || item.erand_item_id}: {item.proposed_quantity} ×{" "}
              {currencyValue(item.proposed_unit_price, offer.currency_code)}
              {item.notes ? ` · ${item.notes}` : ""}
            </p>
          ))}
        </SubList>
      ) : null}

      <div className="mt-3 flex items-center gap-1 text-[11px] text-content-subtle">
        Offer
        <code className="break-all">{shortId(offer.id)}</code>
        <CopyButton value={offer.id} label="Offer ID copied" />
      </div>
    </div>
  );
}

function EntryList({ title, rows, errand, openProfile }) {
  if (!rows?.length) return null;

  return (
    <Section title={title} count={rows.length}>
      <div className="space-y-2">
        {rows.map((entry, index) => (
          <EntryCard
            key={entry.id || `${title}-${index}`}
            entry={entry}
            errand={errand}
            openProfile={openProfile}
          />
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MODAL                                   */
/* -------------------------------------------------------------------------- */

export default function ErrandDetailsModal({
  loading,
  errand,
  error,
  canManage,
  onToggleOffers,
  onClose,
  openProfile,
}) {
  const [tab, setTab] = useState("overview");
  const [expandText, setExpandText] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    setTab("overview");
    setExpandText(false);
  }, [errand?.id]);

  // A chat-read permission may not be assigned to every admin role.
  // If the lookup fails, the chat link stays hidden instead of dead.
  useEffect(() => {
    if (!errand?.id) {
      setChatCount(0);
      setChatLoading(false);
      return undefined;
    }

    let active = true;
    setChatCount(0);
    setChatLoading(true);

    listAdminChats({ errandId: errand.id, page: 1, status: "all" })
      .then((result) => {
        if (!active) return;
        const total = Number(result?.data?.pagination?.total);
        const chats = result?.data?.chats || [];
        setChatCount(Number.isFinite(total) ? total : chats.length);
      })
      .catch(() => {
        if (active) setChatCount(0);
      })
      .finally(() => {
        if (active) setChatLoading(false);
      });

    return () => {
      active = false;
    };
  }, [errand?.id]);

  const group = statusGroup(errand?.status);
  const currency = errand?.currency_code;

  const offers = useMemo(() => {
    const list = Array.isArray(errand?.offers) ? [...errand.offers] : [];
    const isAccepted = (offer) =>
      offer.id === errand?.accepted_offer_id ||
      String(offer.status).toLowerCase() === "accepted";

    return list
      .sort((a, b) => Number(isAccepted(b)) - Number(isAccepted(a)))
      .map((offer) => ({ offer, accepted: isAccepted(offer) }));
  }, [errand]);

  const money = count(errand?.payments) + count(errand?.settlements) + count(errand?.ledger_journals);
  const deposits =
    count(errand?.security_deposit_reservations) +
    count(errand?.security_deposit_claims) +
    count(errand?.security_deposit_transactions);
  const history = count(errand?.versions);

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "items", label: "Items", count: count(errand?.items) },
    { value: "offers", label: "Offers", count: offers.length },
    ...(money ? [{ value: "money", label: "Payments", count: money }] : []),
    ...(deposits ? [{ value: "deposits", label: "Deposits", count: deposits }] : []),
    ...(history ? [{ value: "history", label: "History", count: history }] : []),
  ];

  const canToggle =
    errand &&
    ["draft", "open"].includes(errand.status) &&
    !errand.agreement_locked_at;

  const description = errand?.description || "";
  const longDescription = description.length > 220;

  const open = loading || !!errand || !!error;

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title="Errand details"
      subtitle="Customer and erander view"
      description={errand?.reference_code || (loading ? "Loading errand" : "")}
      icon={ClipboardList}
      tone={MODAL_TONE[group]}
      badge={errand ? <StatusPill value={errand.status} /> : null}
      loading={loading}
      size="xl"
      position="center"
      height="auto"
      sizeStorageKey="admin.errand"
      zIndex={70}
    >
				
      <div className="space-y-5 pb-1">
        {loading && !errand ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 rounded-3xl bg-surface-muted/60 px-6 py-14 text-sm font-semibold text-content-muted"
          >
            <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
            Loading the complete errand
          </div>
        ) : null}

        {error ? <Banner tone="danger">{error}</Banner> : null}

        {errand ? (
          <>
            {/* Summary */}
            <div
              className={`rounded-3xl border border-l-4 border-line bg-surface-white p-5 ${BAR[group]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-extrabold tracking-tight text-content sm:text-2xl">
                    {errand.title || "Untitled errand"}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
                    <span className="inline-flex items-center gap-1">
                      Ref
                      <code className="font-mono text-[11px] text-content">
                        {errand.reference_code}
                      </code>
                      <CopyButton value={errand.reference_code} label="Errand reference copied" />
                    </span>

                    <span className="inline-flex items-center gap-1">
                      ID
                      <code className="font-mono text-[11px] text-content">
                        {shortId(errand.id)}
                      </code>
                      <CopyButton value={errand.id} label="Errand ID copied" />
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${GROUP_TONE[group]}`}
                >
                  {humanize(errand.status)}
                </span>
              </div>

              {description ? (
                <div className="mt-3">
                  <p
                    className={`whitespace-pre-wrap break-words text-sm leading-6 text-content-muted ${
                      longDescription && !expandText ? "line-clamp-3" : ""
                    }`}
                  >
                    {description}
                  </p>
                  {longDescription ? (
                    <button
                      type="button"
                      onClick={() => setExpandText((value) => !value)}
                      className="mt-1 text-xs font-bold text-brand underline underline-offset-2"
                    >
                      {expandText ? "Show less" : "Read more"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-content-subtle">No description</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Stat
                  label="Estimated total"
                  value={
                    errand.estimated_total != null
                      ? currencyValue(errand.estimated_total, currency)
                      : "—"
                  }
                />
                <Stat
                  label="Offers"
                  value={offers.length}
                  hint={errand.offers_enabled ? "Open for offers" : "Offers paused"}
                />
                <Stat label="Items" value={count(errand.items)} />
                <Stat
                  label="Scheduled"
                  value={errand.scheduled_for ? formatDate(errand.scheduled_for) : "—"}
                />
              </div>
            </div>

            {/* People */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Customer", errand.customer, errand.requested_by, "—"],
                [
                  "Assigned erander",
                  errand.assigned_erander,
                  errand.assigned_erander_id,
                  "Not assigned",
                ],
              ].map(([label, profile, id, fallback]) => (
                <div key={label} className="rounded-2xl bg-surface-muted/60 p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                    {label}
                  </p>
                  {profile ? (
                    <PersonButton profile={profile} fallbackId={id} onClick={openProfile} />
                  ) : (
                    <span className="text-xs text-content-muted">{fallback}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Chat */}
            {chatCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <MessageSquareText
                    size={18}
                    className="mt-0.5 shrink-0 text-success-dark"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-brand">Errand conversations</p>
                    <p className="mt-0.5 text-xs text-success-dark">
                      {chatCount} {chatCount === 1 ? "conversation is" : "conversations are"} linked
                      to this errand.
                    </p>
                  </div>
                </div>

                <Link
                  to={`/admin/chats?errandId=${encodeURIComponent(errand.id)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-content-inverse transition hover:opacity-90"
                >
                  Read chat
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            ) : chatLoading ? (
              <p className="flex items-center gap-2 text-xs text-content-muted">
                <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
                Checking for errand conversations
              </p>
            ) : null}

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Errand sections"
              className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((item) => {
                const active = item.value === tab;

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.value)}
                    className={`relative inline-flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active ? "text-content" : "text-content-muted hover:text-content"
                    }`}
                  >
                    {item.label}
                    {item.count !== undefined ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          active
                            ? "bg-brand text-content-inverse"
                            : "bg-surface-muted text-content-muted"
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Overview */}
            {tab === "overview" ? (
              <div className="space-y-6" role="tabpanel">
                {errand.customer_notes ? (
                  <Banner tone="warning" icon={StickyNote}>
                    <p className="text-sm font-extrabold">Customer notes</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">
                      {errand.customer_notes}
                    </p>
                  </Banner>
                ) : null}

                <Section icon={Calendar} title="Key details">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {DETAIL_FIELDS.map((key) => (
                      <DetailField
                        key={key}
                        label={humanize(key)}
                        value={errand[key]}
                        row={errand}
                        field={key}
                      />
                    ))}
                  </div>
                </Section>

                {errand.location_snapshot ? (
                  <Section icon={MapPin} title="Location">
                    <div className="grid gap-2">
                      <DetailField
                        label="Location snapshot"
                        value={errand.location_snapshot}
                        row={errand}
                        field="location_snapshot"
                      />
                    </div>
                  </Section>
                ) : null}

                <Section icon={MapPin} title="Pickup and delivery stops" count={count(errand.stops)}>
                  {errand.stops?.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {errand.stops.map((stop) => (
                        <div
                          key={stop.id}
                          className="rounded-2xl border border-line p-3.5"
                        >
                          <p className="text-xs font-extrabold text-content">
                            {humanize(stop.stop_type)} · Stop {stop.sequence_number}
                          </p>
                          <p className="mt-1 break-words text-xs leading-5 text-content-muted">
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
                          {stop.contact_name || stop.contact_phone ? (
                            <p className="mt-1 text-xs text-content-muted">
                              {stop.contact_name} {stop.contact_phone}
                            </p>
                          ) : null}
                          {stop.instructions ? (
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-content-muted">
                              {stop.instructions}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty>No separate stop records. See the location above.</Empty>
                  )}
                </Section>

                {errand.business ? (
                  <Section title="Business">
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
                            className="inline-flex items-center gap-1 text-success-dark underline"
                          >
                            {errand.business.website}
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        </Meta>
                      ) : null}
                    </dl>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {/* Items */}
            {tab === "items" ? (
              <div role="tabpanel">
                <Section icon={Package} title="Required items" count={count(errand.items)}>
                  {errand.items?.length ? (
                    <div className="space-y-2">
                      {errand.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-line p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 break-words text-sm font-bold text-content">
                              {item.item_name}
                            </p>
                            <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-content-muted">
                              {item.quantity} {item.unit}
                            </span>
                          </div>

                          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-content-muted">
                            {item.description ||
                              item.customer_notes ||
                              "No additional instructions"}
                          </p>

                          {item.estimated_unit_price != null ? (
                            <p className="mt-2 text-xs text-content-muted">
                              Estimated unit price{" "}
                              <b className="tabular-nums text-content">
                                {currencyValue(item.estimated_unit_price, currency)}
                              </b>
                            </p>
                          ) : null}

                          {item.item_url ? (
                            <a
                              href={item.item_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex max-w-full items-center gap-1 break-all text-xs text-success-dark underline"
                            >
                              {item.item_url}
                              <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
                            </a>
                          ) : null}

                          <div className="mt-2 flex items-center gap-1 text-[11px] text-content-subtle">
                            <code className="break-all">{shortId(item.id)}</code>
                            <CopyButton value={item.id} label="Item ID copied" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty>No itemized requirements.</Empty>
                  )}
                </Section>
              </div>
            ) : null}

            {/* Offers */}
            {tab === "offers" ? (
              <div role="tabpanel">
                <Section title="Offers" count={offers.length}>
                  {offers.length ? (
                    <div className="space-y-3">
                      {offers.map(({ offer, accepted }) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          accepted={accepted}
                          openProfile={openProfile}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty>No offers submitted.</Empty>
                  )}
                </Section>
              </div>
            ) : null}

            {/* Payments */}
            {tab === "money" ? (
              <div className="space-y-6" role="tabpanel">
                <EntryList title="Payments" rows={errand.payments} errand={errand} openProfile={openProfile} />
                <EntryList title="Settlements" rows={errand.settlements} errand={errand} openProfile={openProfile} />
                <EntryList
                  title="Financial ledger journals"
                  rows={errand.ledger_journals}
                  errand={errand}
                  openProfile={openProfile}
                />
              </div>
            ) : null}

            {/* Deposits */}
            {tab === "deposits" ? (
              <div className="space-y-6" role="tabpanel">
                <EntryList
                  title="Security-deposit reservations"
                  rows={errand.security_deposit_reservations}
                  errand={errand}
                  openProfile={openProfile}
                />
                <EntryList
                  title="Security-deposit claims"
                  rows={errand.security_deposit_claims}
                  errand={errand}
                  openProfile={openProfile}
                />
                <EntryList
                  title="Security-deposit transactions"
                  rows={errand.security_deposit_transactions}
                  errand={errand}
                  openProfile={openProfile}
                />
              </div>
            ) : null}

            {/* History */}
            {tab === "history" ? (
              <div role="tabpanel">
                <EntryList
                  title="Errand version history"
                  rows={errand.versions}
                  errand={errand}
                  openProfile={openProfile}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
						
						
						
						
						{
        errand ? (
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              Close
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => copyText(errand, "Errand copied as JSON")}
                className={BTN_GHOST}
              >
                <FileJson size={14} aria-hidden="true" />
                Copy JSON
              </button>

              {chatCount > 0 ? (
                <Link
                  to={`/admin/chats?errandId=${encodeURIComponent(errand.id)}`}
                  className={BTN_GHOST}
                >
                  <MessageSquareText size={14} aria-hidden="true" />
                  Read chat
                </Link>
              ) : null}

              {canManage ? (
                <button
                  type="button"
                  onClick={() => onToggleOffers(errand)}
                  disabled={!canToggle}
                  title={
                    canToggle
                      ? undefined
                      : "Offers can only change while the errand is draft or open and not locked"
                  }
                  className={BTN_NAVY}
                >
                  {errand.offers_enabled ? (
                    <Pause size={14} aria-hidden="true" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  {errand.offers_enabled ? "Pause new offers" : "Enable new offers"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null
      }
    </Modal>
  );
}