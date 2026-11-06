import { useMemo, useState } from "react";
import { Copy, ExternalLink, LockKeyhole, Search } from "lucide-react";

import Modal from "@/components/Modal";

import {
  Avatar,
  CopyButton,
  DetailField,
  PersonButton,
  StatusPill,
} from "./RecordsUI";
import {
  BTN_DANGER_SOFT,
  BTN_GHOST,
  BTN_GREEN,
  BTN_NAVY,
} from "./recordsStyles";
import {
  MONEY_MAJOR_KEYS,
  MONEY_MINOR_KEYS,
  STATUS_COLUMNS,
  copyText,
  currencyValue,
  formatValue,
  fullName,
  getRowTitle,
  humanize,
  shortId,
} from "./recordsUtils";

const HIDDEN_FIELDS = ["avatar_url", "last_name", "other_names"];

export default function RecordDetailsModal({
  row,
  section,
  dataset,
  columns,
  pageTitle,
  perms,
  enableWithdrawalActions,
  onClose,
  onAction,
  onRoles,
  onWithdrawal,
  openProfile,
  openErrand,
}) {
  const [fieldSearch, setFieldSearch] = useState("");

  const fields = useMemo(() => {
    if (!row) return [];
    const query = fieldSearch.trim().toLowerCase();

    return columns
      .filter((field) => row[field] !== undefined && !HIDDEN_FIELDS.includes(field))
      .filter((field) => {
        if (!query) return true;
        return (
          humanize(field).toLowerCase().includes(query) ||
          formatValue(field, row[field], row).toLowerCase().includes(query)
        );
      });
  }, [row, columns, fieldSearch]);

  const summaryAmounts = row
    ? [...MONEY_MINOR_KEYS, ...MONEY_MAJOR_KEYS]
        .filter((key) => row[key] !== null && row[key] !== undefined && row[key] !== "")
        .slice(0, 3)
    : [];

  /* ------------------------------ Available actions ----------------------------- */
  const actions = [];

  if (row) {
    if (section === "users" && perms.users)
      actions.push({
        key: "status",
        label: "Change account status",
        className: BTN_NAVY,
        onClick: () => onAction("user-status", row),
      });

    if (section === "users" && perms.roles)
      actions.push({
        key: "roles",
        label: "Manage administrator roles",
        className: BTN_GHOST,
        onClick: () => onRoles(row),
      });

    if (section === "errands" && perms.errands)
      actions.push({
        key: "offers",
        label: row.offers_enabled ? "Pause new offers" : "Enable new offers",
        className: BTN_NAVY,
        disabled: !(["draft", "open"].includes(row.status) && !row.agreement_locked_at),
        onClick: () => onAction("errand-offers", row),
      });

    if (section === "security-deposits" && row.erand_id)
      actions.push({
        key: "open-errand",
        label: "Open the errand with this deposit",
        className: BTN_GHOST,
        icon: ExternalLink,
        onClick: () => openErrand(row.erand_id),
      });

    if (
      section === "security-deposits" &&
      dataset === "claims" &&
      perms.reviewDeposits &&
      row.status === "submitted"
    )
      actions.push({
        key: "review",
        label: "Review claim",
        className: BTN_NAVY,
        onClick: () => onAction("claim-review", row),
      });

    if (
      section === "security-deposits" &&
      dataset === "claims" &&
      perms.settleDeposits &&
      row.status === "approved"
    )
      actions.push({
        key: "settle",
        label: "Settle approved claim",
        className: BTN_GREEN,
        onClick: () => onAction("claim-settle", row),
      });

    if (
      section === "security-deposits" &&
      dataset === "reservations" &&
      perms.settleDeposits &&
      ["reserved", "active", "held"].includes(String(row.status).toLowerCase())
    )
      actions.push({
        key: "release",
        label: "Review and release reservation",
        className: BTN_GREEN,
        onClick: () => onAction("reservation-release", row),
      });

    if (section === "verification" && perms.verification)
      actions.push({
        key: "verify",
        label: "Review verification",
        className: BTN_NAVY,
        onClick: () => onAction("business-verification", row),
      });

    if (section === "reconciliation" && dataset === "issues" && perms.reconciliation)
      actions.push({
        key: "issue",
        label: "Update issue status",
        className: BTN_NAVY,
        onClick: () => onAction("reconciliation-issue", row),
      });

    if (section === "withdrawals" && enableWithdrawalActions && perms.wallets) {
      if (row.status === "pending")
        actions.push({
          key: "approve",
          label: "Approve",
          className: BTN_GREEN,
          onClick: () => onWithdrawal(row, "approve"),
        });

      if (["pending", "approved"].includes(row.status))
        actions.push({
          key: "reject",
          label: "Reject",
          className: BTN_DANGER_SOFT,
          onClick: () => onWithdrawal(row, "reject"),
        });

      if (row.status === "approved")
        actions.push({
          key: "process",
          label: "Initiate Paystack transfer",
          className: BTN_NAVY,
          onClick: () => onWithdrawal(row, "process"),
        });

      if (row.status === "processing")
        actions.push({
          key: "verify-transfer",
          label: "Verify transfer",
          className: BTN_GHOST,
          onClick: () => onWithdrawal(row, "verify"),
        });
    }
  }

  /* --------------------------------- Field render --------------------------------- */
  function renderField(field) {
    const value = row[field];
    const profile =
      row[`${field}_profile`] ||
      (field === "profile_id" && row.wallet_profile) ||
      (field === "erander_id" && row.erander_profile) ||
      null;

    if (field === "reserved_by_currency" && Array.isArray(value))
      return (
        <DetailField
          key={field}
          label="Currently reserved by currency"
          value={value
            .map(
              (item) =>
                `${item.currency_code}: ${currencyValue(item.amount_minor, item.currency_code, true)}`
            )
            .join(" · ")}
          row={row}
          field="reserved_by_currency"
        />
      );

    if (["wallet_owner", "erander_owner"].includes(field) && value)
      return (
        <div key={field} className="rounded-2xl bg-surface-muted/60 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-content-muted">
            {humanize(field)}
          </p>
          <div className="mt-2">
            <PersonButton profile={value} fallbackId={value.id} onClick={openProfile} />
          </div>
        </div>
      );

    if (profile)
      return (
        <div key={field} className="rounded-2xl bg-surface-muted/60 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-content-muted">
            {humanize(field)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <PersonButton profile={profile} fallbackId={value} onClick={openProfile} />
            <CopyButton value={value} />
          </div>
        </div>
      );

    if (field === "erand_id" && value)
      return (
        <div
          key={field}
          className="rounded-2xl border-l-4 border-brand-green bg-brand-pale p-3.5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-success-dark">
            Related errand
          </p>
          <button
            type="button"
            onClick={() => openErrand(value)}
            className="mt-2 inline-flex items-center gap-2 text-sm font-extrabold text-brand hover:underline"
          >
            {row.related_erand?.reference_code || shortId(value)}
            <ExternalLink size={14} aria-hidden="true" />
          </button>
          <div className="mt-1 flex items-center gap-1">
            <code className="break-all text-[11px] text-content-muted">{value}</code>
            <CopyButton value={value} />
          </div>
        </div>
      );

    return (
      <DetailField
        key={field}
        label={humanize(field)}
        value={value}
        row={row}
        field={field}
      />
    );
  }

  return (
    <Modal
      isOpen={!!row}
      onClose={onClose}
      title={
        section === "users"
          ? "User profile"
          : section === "errands"
            ? "Errand record"
            : "Record details"
      }
      subtitle={pageTitle}
      description={row ? String(getRowTitle(row, section)) : ""}
      size="xl"
      position="bottom"
      height="auto"
      headerTone="navy"
    >
      {row ? (
        <div className="space-y-5">
          {/* Summary */}
          <div className="rounded-2xl bg-brand px-5 py-5 text-content-inverse">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {section === "users" ? <Avatar profile={row} size="lg" /> : null}

                <div className="min-w-0">
                  <p className="break-words text-lg font-extrabold">
                    {getRowTitle(row, section)}
                  </p>

                  {section === "users" ? (
                    <p className="text-xs text-white/70">
                      {row.phone || "No phone number"}
                    </p>
                  ) : null}

                  <div className="mt-1 flex items-center gap-1 text-white/70">
                    <code className="break-all text-[11px]">{row.id}</code>
                    <CopyButton value={row.id} className="!text-white/70 hover:!bg-white/10 hover:!text-white" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {STATUS_COLUMNS.filter((column) => row[column]).map((column) => (
                  <span key={column} className="rounded-full bg-white p-0.5">
                    <StatusPill value={row[column]} />
                  </span>
                ))}
              </div>
            </div>

            {summaryAmounts.length ? (
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {summaryAmounts.map((key) => (
                  <div key={key}>
                    <dt className="text-xs text-white/70">{humanize(key)}</dt>
                    <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-brand-mint">
                      {formatValue(key, row[key], row)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {row.created_at ? (
              <p className="mt-3 text-xs text-white/70">
                Created {formatValue("created_at", row.created_at, row)}
              </p>
            ) : null}
          </div>

          {/* Actions */}
          {actions.length ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <LockKeyhole size={16} className="text-success-dark" aria-hidden="true" />
                <h3 className="text-sm font-extrabold text-content">
                  Available actions
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      disabled={action.disabled}
                      onClick={action.onClick}
                      className={action.className}
                    >
                      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                      {action.label}
                    </button>
                  );
                })}

                {section === "users" ? (
                  <button
                    type="button"
                    onClick={() => openProfile(row, row.id)}
                    className={BTN_GHOST}
                  >
                    Full profile
                  </button>
                ) : null}
              </div>
            </div>
          ) : section === "users" ? (
            <button
              type="button"
              onClick={() => openProfile(row, row.id)}
              className={BTN_GHOST}
            >
              Full profile
            </button>
          ) : null}

          {section === "finance" ? (
            <p className="rounded-2xl bg-surface-muted/60 p-4 text-xs leading-5 text-content-muted">
              Financial records are shown with their provider references and
              status. State changes must go through provider-confirmed
              payment, refund and settlement workflows.
            </p>
          ) : null}

          {section === "disputes" ? (
            <p className="rounded-2xl bg-surface-muted/60 p-4 text-xs leading-5 text-content-muted">
              The current database does not expose a dedicated dispute-case or
              evidence decision model. The disputed errand can be opened from
              the Errand Operations page for full context.
            </p>
          ) : null}

          {/* Fields */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-content">
                All fields
                <span className="ml-2 text-xs font-semibold text-content-muted">
                  {fields.length}
                </span>
              </h3>

              <div className="flex items-center gap-2">
                <label className="relative block">
                  <span className="sr-only">Find a field</span>
                  <Search
                    size={14}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
                  />
                  <input
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                    placeholder="Find a field"
                    className="h-9 w-40 rounded-full border border-line bg-surface-white pl-8 pr-3 text-xs text-content outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-pale sm:w-48"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => copyText(row, "Record copied as JSON")}
                  className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
                >
                  <Copy size={13} aria-hidden="true" />
                  Copy JSON
                </button>
              </div>
            </div>

            {fields.length === 0 ? (
              <p className="rounded-2xl bg-surface-muted/60 p-4 text-center text-sm text-content-muted">
                No fields match “{fieldSearch}”.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {fields.map(renderField)}
              </div>
            )}
          </div>

          {/* Related blocks */}
          {row.erander_profile ? (
            <div className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                Erander
              </p>
              <PersonButton
                profile={row.erander_profile}
                fallbackId={row.erander_profile.id}
                onClick={openProfile}
              />
            </div>
          ) : null}

          {Array.isArray(row.deposit_reservations) ? (
            <section>
              <h4 className="mb-2 text-sm font-extrabold text-content">
                Errands secured by this deposit account (
                {row.deposit_reservations.length})
              </h4>

              {row.deposit_reservations.length ? (
                <div className="space-y-2">
                  {row.deposit_reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-content">
                          {reservation.errand?.reference_code ||
                            shortId(reservation.erand_id)}{" "}
                          · {reservation.errand?.title || "Errand"}
                        </p>
                        <p className="mt-1 text-xs text-content-muted">
                          {currencyValue(
                            reservation.amount_minor,
                            reservation.currency_code,
                            true
                          )}{" "}
                          · {humanize(reservation.status)}
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          <code className="break-all text-[11px] text-content-subtle">
                            {reservation.erand_id}
                          </code>
                          <CopyButton value={reservation.erand_id} />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openErrand(reservation.erand_id)}
                        className={`${BTN_NAVY} !px-3.5 !py-2 text-xs`}
                      >
                        Open errand
                        <ExternalLink size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted">
                  No errand reservations are linked to this account.
                </p>
              )}
            </section>
          ) : null}

          <details className="rounded-2xl border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-content-muted hover:text-content">
              Raw data
            </summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-line-soft p-4 font-mono text-[11px] leading-5 text-content">
              {JSON.stringify(row, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          Close
        </button>
      </div>
    </Modal>
  );
}