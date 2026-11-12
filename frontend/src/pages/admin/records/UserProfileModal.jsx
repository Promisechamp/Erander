import { useMemo, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  Landmark,
  LoaderCircle,
  Search,
  Wallet,
  X,
} from "lucide-react";

import Modal from "@/components/Modal";

import {
  Avatar,
  Banner,
  CopyButton,
  DetailField,
  StatCard,
  StatusPill,
} from "./RecordsUI";
import { BTN_GHOST } from "./recordsStyles";
import { currencyValue, fullName, humanize } from "./recordsUtils";

/* -------------------------------------------------------------------------- */
/*                                  SECTION                                   */
/* -------------------------------------------------------------------------- */

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-content">
        {Icon ? <Icon size={16} className="text-content-muted" aria-hidden="true" /> : null}
        {title}
      </h4>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                          TRANSACTIONS (SEARCHABLE)                         */
/* -------------------------------------------------------------------------- */

function TransactionsSection({ transactions, onOpenTransaction }) {
  const [query, setQuery] = useState("");
  const text = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!text) return transactions;

    return transactions.filter((tx) => {
      const haystack = [
        tx.reference,
        tx.type,
        humanize(tx.type),
        tx.status,
        humanize(tx.status),
        tx.currency_code,
        String(tx.amount_minor ?? ""),
        currencyValue(tx.amount_minor, tx.currency_code, true),
      ];

      return haystack.some(
        (value) => value && String(value).toLowerCase().includes(text)
      );
    });
  }, [transactions, text]);

  return (
    <Section icon={ClipboardList} title="Recent wallet transactions">
      {/* Search bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
          />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, type, status, amount…"
            aria-label="Search wallet transactions"
            className="h-10 w-full rounded-xl border border-line bg-surface-white pl-9 pr-9 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand/20 [&::-webkit-search-cancel-button]:appearance-none"
          />

          {query ? (
            <button
              type="button"
              onClick={(event) => {
                setQuery("");
                event.currentTarget.parentElement
                  ?.querySelector("input")
                  ?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-content-subtle transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {text ? (
          <span
            aria-live="polite"
            className="shrink-0 whitespace-nowrap rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-content-muted"
          >
            {filtered.length} of {transactions.length}
          </span>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="max-h-[440px] overflow-auto rounded-2xl border border-line">
          <table className="w-full min-w-[620px] text-left">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr>
                {["Reference", "Type", "Amount", "Status", "Created", ""].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-content-muted"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.map((tx) => {
                const canOpen = typeof onOpenTransaction === "function" && !!tx.id;

                return (
                  <tr
                    key={tx.id || tx.reference}
                    onClick={canOpen ? () => onOpenTransaction(tx) : undefined}
                    className={`transition ${canOpen ? "cursor-pointer hover:bg-brand-pale/60" : "hover:bg-surface-muted/50"}`}
                    title={canOpen ? "Open full transaction details" : undefined}
                  >
                    <td className="px-3 py-2.5 text-xs">
                      <span className="inline-flex items-center gap-1">
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenTransaction(tx);
                            }}
                            className="max-w-[150px] truncate text-left font-bold text-brand underline decoration-dotted underline-offset-4 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            aria-label={`Open details for transaction ${tx.reference || tx.id}`}
                          >
                            {tx.reference || tx.id}
                          </button>
                        ) : (
                          <span className="max-w-[150px] truncate">{tx.reference || tx.id || "—"}</span>
                        )}
                        <span onClick={(event) => event.stopPropagation()}>
                          <CopyButton value={tx.reference || tx.id} label="Transaction reference copied" />
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{humanize(tx.type)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums">
                      {currencyValue(tx.amount_minor, tx.currency_code, true)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill value={tx.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-muted">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canOpen ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenTransaction(tx);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold text-brand transition hover:bg-brand-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          Details <ChevronRight size={13} aria-hidden="true" />
                        </button>
                      ) : <span className="text-[11px] text-content-subtle">Unavailable</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : text ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-sm font-semibold text-content">
            No transactions match “{query}”.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-[11px] font-bold text-brand underline decoration-dotted underline-offset-4 hover:no-underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <p className="text-xs text-content-muted">No wallet transactions.</p>
      )}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              USER PROFILE MODAL                            */
/* -------------------------------------------------------------------------- */

export default function UserProfileModal({
  loading,
  details,
  error,
  onClose,
  onOpenTransaction,
}) {
  const profile = details?.profile;

  return (
    <Modal
      isOpen={loading || !!details}
      onClose={() => {
        if (!loading) onClose();
      }}
      title="User information"
      subtitle="ERANDER profile"
      description={profile ? fullName(profile) : "Loading user"}
      size="xl"
      position="center"
      height="auto"
      headerTone="navy"
      zIndex={80}
    >
      {loading && !details ? (
        <div role="status" className="flex items-center gap-2 py-8 text-sm text-content-muted">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Loading user information
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {error ? <Banner tone="warning">{error}</Banner> : null}

          {/* Header card */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand p-5 text-content-inverse">
            <Avatar profile={profile} size="lg" />

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-extrabold">{fullName(profile)}</h3>
              <p className="text-xs text-white/70">
                {profile.phone || "No phone number"}
              </p>
              <div className="mt-1 flex items-center gap-1 text-white/70">
                <code className="break-all text-[11px]">{profile.id}</code>
                <CopyButton
                  value={profile.id}
                  className="!text-white/70 hover:!bg-white/10 hover:!text-white"
                />
              </div>
            </div>

            {profile.account_status ? (
              <span className="rounded-full bg-white p-0.5">
                <StatusPill value={profile.account_status} />
              </span>
            ) : null}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Wallets" value={details.wallets?.length || 0} />
            <StatCard
              label="Bank accounts"
              value={details.withdrawalAccounts?.length || 0}
            />
            <StatCard
              label="Recent transactions"
              value={details.recentTransactions?.length || 0}
            />
          </div>

          {/* Profile fields */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(profile)
              .filter(([key]) => !["avatar_url", "addresses"].includes(key))
              .map(([key, value]) => (
                <DetailField
                  key={key}
                  label={humanize(key)}
                  value={value}
                  row={profile}
                  field={key}
                />
              ))}
          </div>

          {/* Addresses */}
          {Array.isArray(profile.addresses) && profile.addresses.length > 0 ? (
            <Section title="Saved addresses">
              <div className="space-y-2">
                {profile.addresses.map((address, index) => (
                  <div
                    key={address.id || index}
                    className="grid gap-2 rounded-2xl border border-line p-3.5 sm:grid-cols-2"
                  >
                    {Object.entries(address || {}).map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-content-muted">
                          {humanize(key)}
                        </p>
                        {key === "id" || key.endsWith("_id") ? (
                          <div className="flex items-center gap-1">
                            <code className="break-all text-xs">{String(value)}</code>
                            <CopyButton value={value} />
                          </div>
                        ) : (
                          <p className="break-words text-xs text-content">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value ?? "—")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Wallets */}
          <Section icon={Wallet} title="Wallets">
            {details.wallets?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {details.wallets.map((wallet) => (
                  <div key={wallet.id} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm text-content">
                        {wallet.currency_code} wallet
                      </b>
                      <StatusPill value={wallet.status} />
                    </div>

                    <p className="mt-3 text-xl font-extrabold tabular-nums text-content">
                      {currencyValue(wallet.available_balance, wallet.currency_code, true)}
                    </p>
                    <p className="text-[11px] text-content-muted">Available</p>

                    <p className="mt-2 text-xs text-content-muted">
                      Pending {currencyValue(wallet.pending_balance, wallet.currency_code, true)}
                      {" · "}
                      Reserved {currencyValue(wallet.reserved_balance, wallet.currency_code, true)}
                    </p>

                    <div className="mt-2 flex items-center gap-1">
                      <code className="break-all text-[11px] text-content-subtle">
                        {wallet.id}
                      </code>
                      <CopyButton value={wallet.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted">No wallet accounts.</p>
            )}
          </Section>

          {/* Withdrawal accounts */}
          <Section icon={Landmark} title="Bank / withdrawal accounts">
            {details.withdrawalAccounts?.length ? (
              <div className="space-y-2">
                {details.withdrawalAccounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-line p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-sm text-content">{account.bank_name}</b>
                      <StatusPill value={account.status} />
                    </div>

                    <p className="mt-1 text-xs text-content-muted">
                      {account.account_name} · ••••{account.account_number_last4} ·{" "}
                      {account.currency_code}
                    </p>
                    <p className="mt-1 text-[11px] text-content-subtle">
                      {account.is_default ? "Default account · " : ""}
                      {account.country_code} · {account.payment_provider}
                    </p>

                    <div className="mt-1 flex items-center gap-1">
                      <code className="break-all text-[11px] text-content-subtle">
                        {account.id}
                      </code>
                      <CopyButton value={account.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted">No saved withdrawal accounts.</p>
            )}
          </Section>

          {/* Recent transactions with search */}
          <TransactionsSection
            transactions={details.recentTransactions || []}
            onOpenTransaction={onOpenTransaction}
          />

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