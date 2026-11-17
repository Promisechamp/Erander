import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import Modal from "@/components/Modal";
import { formatMoney } from "@/features/errands/shared/ErrandTools";
import {
  cancelSecurityDepositFunding,
  getSecurityDepositFundingSummary,
  initializeSecurityDepositFunding,
  verifySecurityDepositFunding,
} from "@/services/payments/securityDepositFundingApi";

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GREEN = `${BTN} bg-brand-green font-extrabold text-brand-navy shadow-sm hover:brightness-95`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface hover:text-content`;

const money = formatMoney;

/* -------------------------------------------------------------------------- */
/*                              AMOUNT HELPERS                                */
/* -------------------------------------------------------------------------- */

function toMinor(value) {
  const text = String(value ?? "0").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return NaN;
  const [whole, fraction = ""] = text.split(".");
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}

function fromMinor(value) {
  const minor = Math.max(0, Number(value) || 0);
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

/** Only an https Paystack checkout address is ever opened. */
function openCheckout(authorizationUrl) {
  let parsed;

  try {
    parsed = new URL(authorizationUrl);
  } catch {
    throw new Error("The payment provider did not return a valid checkout URL.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    parsed.protocol !== "https:" ||
    (hostname !== "checkout.paystack.com" && !hostname.endsWith(".paystack.com"))
  ) {
    throw new Error(
      "The payment provider returned an unexpected checkout address."
    );
  }

  window.location.assign(parsed.toString());
}

/* -------------------------------------------------------------------------- */
/*                                  PIECES                                    */
/* -------------------------------------------------------------------------- */

function ChoiceCard({ active, disabled, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${
        active
          ? "border-brand-navy bg-brand-pale/60 ring-2 ring-brand-pale"
          : "border-line bg-surface-white hover:border-line-strong hover:bg-surface"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          active
            ? "bg-brand-navy text-brand-mint"
            : "bg-surface-muted text-content-muted"
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-content">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-content-muted">
          {description}
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${
          active
            ? "border-brand-navy bg-brand-navy shadow-[inset_0_0_0_3px_var(--tw-shadow-color,#fff)]"
            : "border-line-strong bg-surface-white"
        }`}
      />
    </button>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt
        className={`text-sm ${
          strong ? "font-extrabold text-content" : "text-content-muted"
        }`}
      >
        {label}
      </dt>
      <dd
        className={`text-right tabular-nums ${
          strong
            ? "text-base font-extrabold text-content"
            : "text-sm font-semibold text-content"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Notice({ tone = "danger", icon: Icon = AlertCircle, title, children }) {
  const styles = {
    danger: "border-red-500 bg-red-50 text-red-950",
    attention: "border-amber-400 bg-amber-50 text-amber-900",
    success: "border-success bg-brand-pale text-brand-navy",
  };

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-r-2xl border-l-4 p-4 ${styles[tone]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />

      <div className="min-w-0">
        {title ? <p className="text-sm font-bold">{title}</p> : null}
        <div className={`${title ? "mt-1 " : ""}text-sm leading-6 opacity-90`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   MODAL                                    */
/* -------------------------------------------------------------------------- */

export default function SecurityDepositFundingModal({
  isOpen,
  onClose,
  errandId,
  errandTitle,
  onSecured,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [mode, setMode] = useState("split");
  const [walletContribution, setWalletContribution] = useState("0.00");
  const [error, setError] = useState("");

  const currency = summary?.currency || "NGN";
  const requiredMinor = Number(summary?.requiredAmountMinor || 0);
  const availableMinor = Number(summary?.availableBalanceMinor || 0);
  const walletMinor = toMinor(walletContribution);
  const safeWalletMinor = Number.isFinite(walletMinor) ? walletMinor : 0;
  const paystackMinor = Math.max(0, requiredMinor - safeWalletMinor);

  const pendingAttempt = summary?.pendingAttempt || null;
  const canPaystack = currency === "NGN";
  const canWalletOnly = availableMinor >= requiredMinor && requiredMinor > 0;
  const isAlreadySecured = summary?.secured === true;

  const contributionValid =
    Number.isFinite(walletMinor) &&
    walletMinor >= 0 &&
    walletMinor <= availableMinor &&
    walletMinor <= requiredMinor &&
    walletMinor + paystackMinor === requiredMinor &&
    (paystackMinor === 0 || canPaystack);

  const walletError = !Number.isFinite(walletMinor)
    ? "Enter a valid amount, for example 2500.00."
    : walletMinor > availableMinor
      ? "That is more than your available wallet balance."
      : walletMinor > requiredMinor
        ? "That is more than the security deposit."
        : "";

  const breakdown = useMemo(
    () => ({
      wallet: fromMinor(safeWalletMinor),
      paystack: fromMinor(paystackMinor),
      required: fromMinor(requiredMinor),
    }),
    [safeWalletMinor, paystackMinor, requiredMinor]
  );

  const walletShare =
    requiredMinor > 0
      ? Math.min(100, Math.max(0, (safeWalletMinor / requiredMinor) * 100))
      : 0;

  async function loadSummary({ quiet = false } = {}) {
    if (!errandId) return;

    if (!quiet) {
      setLoading(true);
      setSummary(null);
    }

    setError("");

    try {
      const data = await getSecurityDepositFundingSummary(errandId);

      setSummary(data);

      const required = Number(data.requiredAmountMinor || 0);
      const available = Number(data.availableBalanceMinor || 0);

      if (data.pendingAttempt) {
        setMode(
          Number(data.pendingAttempt.paystackAmountMinor) === 0
            ? "wallet"
            : Number(data.pendingAttempt.walletContributionMinor) === 0
              ? "paystack"
              : "split"
        );
        setWalletContribution(fromMinor(data.pendingAttempt.walletContributionMinor));
      } else if (available >= required && required > 0) {
        setMode("wallet");
        setWalletContribution(fromMinor(required));
      } else if (data.currency === "NGN" && available > 0 && required > 100) {
        setMode("split");
        setWalletContribution(fromMinor(Math.min(available, required)));
      } else if (data.currency === "NGN") {
        setMode("paystack");
        setWalletContribution("0.00");
      } else {
        setMode("wallet");
        setWalletContribution(fromMinor(Math.min(available, required)));
      }

      if (data.secured) onSecured?.(data);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load security-deposit details.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    } else {
      setError("");
      setSubmitting(false);
    }
    // loadSummary intentionally runs only when the modal opens for this errand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, errandId]);

  function chooseMode(nextMode) {
    setMode(nextMode);

    if (nextMode === "wallet") setWalletContribution(fromMinor(requiredMinor));
    if (nextMode === "paystack") setWalletContribution("0.00");
    if (nextMode === "split") {
      setWalletContribution(
        fromMinor(Math.min(availableMinor, Math.max(0, requiredMinor - 1)))
      );
    }
  }

  async function handleSecure() {
    if (!contributionValid || submitting || pendingAttempt) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await initializeSecurityDepositFunding({
        erandId: errandId,
        walletContribution: fromMinor(safeWalletMinor),
      });

      if (result.secured) {
        toast.success("Your security deposit has been reserved successfully.");
        onSecured?.(result);
        onClose?.();
        return;
      }

      if (result.authorizationUrl) {
        openCheckout(result.authorizationUrl);
        return;
      }

      await loadSummary({ quiet: true });
      toast.message(
        result.message || "Your security-deposit payment is being prepared."
      );
    } catch (submitError) {
      setError(submitError?.message || "Unable to start security-deposit funding.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleResume() {
    if (!pendingAttempt?.authorizationUrl) return;

    try {
      openCheckout(pendingAttempt.authorizationUrl);
    } catch (resumeError) {
      setError(resumeError.message);
    }
  }

  async function handleVerifyPending() {
    if (!pendingAttempt?.providerReference || verifying) return;

    setVerifying(true);
    setError("");

    try {
      const result = await verifySecurityDepositFunding({
        erandId: errandId,
        reference: pendingAttempt.providerReference,
      });

      if (result?.secured) {
        toast.success(result.message || "Your security deposit is secured.");
        onSecured?.(result);
        await loadSummary({ quiet: true });
      } else {
        toast.message(
          result?.message ||
            "Paystack has not confirmed the payment yet. You can safely check again."
        );
      }
    } catch (verifyError) {
      setError(
        verifyError?.message || "Unable to verify the Paystack payment yet."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleCancelPending() {
    if (!pendingAttempt?.id || cancelling) return;

    setCancelling(true);

    try {
      await cancelSecurityDepositFunding({
        erandId: errandId,
        attemptId: pendingAttempt.id,
      });

      toast.success(
        "Checkout cancelled. Your wallet contribution is available again."
      );

      await loadSummary({ quiet: true });
    } catch (cancelError) {
      setError(cancelError?.message || "Unable to cancel this payment attempt.");
    } finally {
      setCancelling(false);
    }
  }

  const busy = submitting || cancelling || verifying;

  const footer = (
    <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className={BTN_GHOST}
      >
        Close
      </button>

      {!isAlreadySecured && summary
        ? pendingAttempt
          ? (
            <>
              <button
                type="button"
                onClick={handleCancelPending}
                disabled={cancelling || submitting || verifying}
                className={BTN_GHOST}
              >
                {cancelling ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : null}
                Cancel checkout
              </button>

              <button
                type="button"
                onClick={handleVerifyPending}
                disabled={
                  !pendingAttempt.providerReference || verifying || cancelling
                }
                className={BTN_GHOST}
              >
                {verifying ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={16} aria-hidden="true" />
                )}
                Verify payment
              </button>

              <button
                type="button"
                onClick={handleResume}
                disabled={
                  !pendingAttempt.authorizationUrl || cancelling || verifying
                }
                className={BTN_GREEN}
              >
                <CreditCard size={16} aria-hidden="true" />
                Continue to Paystack
              </button>
            </>
          )
          : (
            <button
              type="button"
              onClick={handleSecure}
              disabled={loading || submitting || !contributionValid}
              className={BTN_GREEN}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <LockKeyhole size={16} aria-hidden="true" />
              )}
              {submitting
                ? "Securing errand…"
                : paystackMinor > 0
                  ? "Continue to payment"
                  : "Secure errand"}
            </button>
          )
        : null}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!busy}
      loading={busy}
      icon={ShieldCheck}
      tone="success"
      title="Secure this errand"
      subtitle="Security deposit"
      size="md"
      position="center"
      resizable={false}
      footer={footer}
    >
      {loading ? (
        <div role="status" aria-live="polite" className="space-y-4 py-2">
          <span className="sr-only">Loading your wallet and security-deposit details</span>
          <div className="h-36 animate-pulse rounded-3xl bg-brand-navy/90" />
          <div className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      ) : isAlreadySecured ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-pale text-success-dark">
            <CheckCircle2 size={28} aria-hidden="true" />
          </span>

          <h3 className="mt-4 text-lg font-extrabold tracking-tight text-content">
            This errand is secured
          </h3>

          <p className="mt-2 max-w-sm text-sm leading-6 text-content-muted">
            The full security deposit has been confirmed and reserved for this
            accepted agreement.
          </p>
        </div>
      ) : !summary ? (
        <div className="space-y-4 py-2">
          <Notice title="We couldn't load the security-deposit details">
            {error || "Please try again."}
          </Notice>

          <button
            type="button"
            onClick={() => loadSummary()}
            className={BTN_GHOST}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-5 pb-1">
          {/* Required amount */}
          <div className="overflow-hidden rounded-3xl bg-brand-navy text-content-inverse">
            <div className="px-5 pb-5 pt-5 sm:px-6">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
                {errandTitle || "Accepted errand"}
              </p>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/70">
                    Required security deposit (100%)
                  </p>

                  <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-brand-mint sm:text-4xl">
                    {money(breakdown.required, currency)}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                  <LockKeyhole size={12} aria-hidden="true" />
                  Reserved, not a fee
                </span>
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-white/10 px-5 py-3.5 text-sm sm:px-6">
              <span className="text-white/70">Available wallet balance</span>
              <strong className="tabular-nums">
                {money(fromMinor(availableMinor), currency)}
              </strong>
            </div>
          </div>

          {pendingAttempt ? (
            <>
              <Notice
                tone="attention"
                icon={AlertCircle}
                title="A payment is already in progress"
              >
                Your wallet contribution is being held while Paystack confirms
                the remaining amount. Continue checkout, or cancel it to return
                the held wallet contribution.
              </Notice>

              <dl className="divide-y divide-line-soft border-y border-line-soft">
                <Row
                  label="Held from wallet"
                  value={money(
                    fromMinor(pendingAttempt.walletContributionMinor),
                    currency
                  )}
                />
                <Row
                  label="Paying through Paystack"
                  value={money(
                    fromMinor(pendingAttempt.paystackAmountMinor),
                    currency
                  )}
                />
              </dl>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-content">
                  How would you like to fund it?
                </h3>

                <p className="mt-1 text-sm leading-6 text-content-muted">
                  You choose how much comes from your wallet. Paystack collects
                  only the remaining amount.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Funding method"
                className="space-y-2.5"
              >
                <ChoiceCard
                  active={mode === "wallet"}
                  disabled={!canWalletOnly}
                  icon={Wallet}
                  title="Use wallet balance"
                  description={
                    canWalletOnly
                      ? "Deduct the full security deposit from your available wallet balance."
                      : "Your available wallet balance is not enough to cover the full deposit."
                  }
                  onClick={() => chooseMode("wallet")}
                />

                <ChoiceCard
                  active={mode === "paystack"}
                  disabled={!canPaystack}
                  icon={CreditCard}
                  title="Pay directly with Paystack"
                  description={
                    canPaystack
                      ? "Pay the full deposit directly into the security reserve. Your wallet balance stays untouched."
                      : "Direct Paystack funding is currently available for NGN deposits only."
                  }
                  onClick={() => chooseMode("paystack")}
                />

                <ChoiceCard
                  active={mode === "split"}
                  disabled={!canPaystack || availableMinor <= 0 || requiredMinor <= 100}
                  icon={ShieldCheck}
                  title="Split wallet and Paystack"
                  description="Choose the amount to reserve from your wallet and pay the rest directly through Paystack."
                  onClick={() => chooseMode("split")}
                />
              </div>

              {mode === "split" ? (
                <div>
                  <label
                    htmlFor="wallet-contribution"
                    className="mb-1.5 block text-sm font-bold text-content"
                  >
                    Wallet contribution ({currency})
                  </label>

                  <input
                    id="wallet-contribution"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={fromMinor(Math.min(availableMinor, requiredMinor))}
                    step="0.01"
                    value={walletContribution}
                    onChange={(event) => setWalletContribution(event.target.value)}
                    aria-invalid={Boolean(walletError)}
                    aria-describedby="wallet-contribution-help"
                    className={`min-h-11 w-full rounded-full border bg-surface-white px-5 text-sm font-bold tabular-nums text-content outline-none transition focus:ring-2 ${
                      walletError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-line focus:border-brand-navy focus:ring-brand-pale"
                    }`}
                  />

                  <p
                    id="wallet-contribution-help"
                    className={`mt-1.5 px-1 text-xs ${
                      walletError ? "font-semibold text-red-700" : "text-content-muted"
                    }`}
                  >
                    {walletError ||
                      `Maximum from your wallet: ${money(
                        fromMinor(Math.min(availableMinor, requiredMinor)),
                        currency
                      )}`}
                  </p>
                </div>
              ) : null}

              {/* Breakdown */}
              <section aria-label="Funding breakdown">
                <h3 className="text-sm font-extrabold text-content">
                  Funding breakdown
                </h3>

                <div
                  className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label={`${Math.round(walletShare)} percent from wallet, ${Math.round(
                    100 - walletShare
                  )} percent through Paystack`}
                >
                  <span
                    className="h-full bg-brand-navy transition-[width] duration-300"
                    style={{ width: `${walletShare}%` }}
                  />
                  <span className="h-full flex-1 bg-brand-green" />
                </div>

                <dl className="mt-2 divide-y divide-line-soft border-b border-line-soft">
                  <Row
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-navy" aria-hidden="true" />
                        Wallet contribution
                      </span>
                    }
                    value={money(breakdown.wallet, currency)}
                  />
                  <Row
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-green" aria-hidden="true" />
                        Paystack payment
                      </span>
                    }
                    value={money(breakdown.paystack, currency)}
                  />
                  <Row
                    strong
                    label="Total security deposit"
                    value={money(breakdown.required, currency)}
                  />
                </dl>
              </section>
            </>
          )}

          {error ? (
            <Notice title="Unable to continue">
              <span className="break-words">{error}</span>
            </Notice>
          ) : null}

          <Notice tone="success" icon={ShieldCheck}>
            Your security deposit is your money, not a platform fee. The full
            amount is refunded to your erander wallet once the errand is
            complete.
          </Notice>
        </div>
      )}
    </Modal>
  );
}
