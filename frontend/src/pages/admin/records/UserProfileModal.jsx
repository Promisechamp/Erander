import { ClipboardList, Landmark, LoaderCircle, Wallet } from "lucide-react";

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

export default function UserProfileModal({ loading, details, error, onClose }) {
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
      position="bottom"
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

          <Section icon={ClipboardList} title="Recent wallet transactions">
            {details.recentTransactions?.length ? (
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-surface-muted">
                    <tr>
                      {["Reference", "Type", "Amount", "Status", "Created"].map(
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
                    {details.recentTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <span className="max-w-[200px] truncate">{tx.reference}</span>
                            <CopyButton value={tx.id} label="Transaction ID copied" />
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
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-content-muted">No wallet transactions.</p>
            )}
          </Section>

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