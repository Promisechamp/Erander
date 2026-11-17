import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import Modal from "./Modal";

import { formatMoney } from "@/pages/erands&offers/shared/ErrandTools";

const PENDING_PAYMENT_KEY = "erander.pendingPayment";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_GHOST = `${BUTTON} border border-line bg-surface-white text-content-muted hover:bg-surface hover:text-content`;
const BUTTON_GREEN = `${BUTTON} bg-brand-green font-extrabold text-brand-navy hover:brightness-95`;

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "We couldn't process your request. Please try again."
  );
}

function getErrandId(errand) {
  return errand?.id || errand?.erand_id || null;
}

function normalizeFundingSummary(result, fallbackCurrency) {
  const details =
    result?.data?.funding || result?.funding || result?.data || result;

  const agreedTotal = Number(details?.agreedTotal);
  const amountFunded = Number(details?.amountFunded);
  const amountDue = Number(details?.amountDue);
  const overpaymentAmount = Number(details?.overpaymentAmount ?? 0);

  const currency = String(details?.currency || fallbackCurrency || "NGN")
    .trim()
    .toUpperCase();

  if (
    !Number.isFinite(agreedTotal) ||
    !Number.isFinite(amountFunded) ||
    !Number.isFinite(amountDue) ||
    !Number.isFinite(overpaymentAmount) ||
    agreedTotal <= 0 ||
    amountFunded < 0 ||
    amountDue < 0 ||
    overpaymentAmount < 0 ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new Error(
      "The server returned an invalid funding summary. Please refresh the errand and try again."
    );
  }

  return {
    ...details,
    agreedTotal,
    amountFunded,
    amountDue,
    overpaymentAmount,
    currency,
  };
}

/** Only an https Paystack checkout address is ever opened. */
function getSafeCheckoutUrl(authorizationUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(authorizationUrl);
  } catch {
    throw new Error("The payment provider did not return a valid checkout URL.");
  }

  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname) {
    throw new Error(
      "The payment provider did not return a valid secure checkout URL."
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (hostname !== "checkout.paystack.com" && !hostname.endsWith(".paystack.com")) {
    throw new Error(
      "The payment provider returned an unexpected checkout address."
    );
  }

  return parsedUrl.toString();
}

function SummaryRow({ label, value, valueClassName = "" }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right text-sm font-semibold tabular-nums text-content ${valueClassName}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function FundErrandModal({
  open,
  errand,
  onClose,
  onGetFundingSummary,
  onInitializePayment,
}) {
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const errandId = getErrandId(errand);
  const errandCurrency = errand?.currency_code;

  // Closing is blocked while a checkout is being prepared.
  const handleClose = useCallback(() => {
    if (!paying) onClose?.();
  }, [paying, onClose]);

  useEffect(() => {
    if (!open) {
      setPaymentDetails(null);
      setLoading(false);
      setPaying(false);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !errandId) {
      setPaymentDetails(null);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;

    async function loadPaymentDetails() {
      setLoading(true);
      setError("");
      setPaymentDetails(null);

      try {
        if (typeof onGetFundingSummary !== "function") {
          throw new Error("The funding-summary service has not been connected.");
        }

        const result = await onGetFundingSummary(errandId);

        if (cancelled) return;

        setPaymentDetails(normalizeFundingSummary(result, errandCurrency));
      } catch (requestError) {
        if (!cancelled) setError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPaymentDetails();

    return () => {
      cancelled = true;
    };
  }, [open, errandId, errandCurrency, onGetFundingSummary, reloadKey]);

  if (!open) return null;

  const currency = paymentDetails?.currency || errandCurrency || "NGN";
  const amountDue = paymentDetails?.amountDue;

  const canPay =
    Boolean(paymentDetails) &&
    Number.isFinite(amountDue) &&
    amountDue > 0 &&
    !loading &&
    !paying;

  const fundedPercent = paymentDetails
    ? Math.min(
        100,
        Math.max(
          0,
          (paymentDetails.amountFunded / paymentDetails.agreedTotal) * 100
        )
      )
    : 0;

  const handlePayment = async () => {
    if (!canPay || !errandId) return;

    if (typeof onInitializePayment !== "function") {
      setError("The payment service has not been connected.");
      return;
    }

    setPaying(true);
    setError("");

    try {
      const result = await onInitializePayment(errandId);

      const checkout = result?.data?.data || result?.data || result;

      const authorizationUrl =
        checkout?.authorizationUrl || checkout?.authorization_url;

      const paymentId =
        checkout?.paymentId || checkout?.payment_id || checkout?.payment?.id;

      const reference =
        checkout?.reference ||
        checkout?.paymentReference ||
        checkout?.payment_reference;

      if (typeof paymentId !== "string" || !paymentId.trim()) {
        throw new Error(
          "The server did not return a valid payment ID. Please try again."
        );
      }

      if (typeof reference !== "string" || !reference.trim()) {
        throw new Error(
          "The server did not return a valid payment reference. Please try again."
        );
      }

      const checkoutUrl = getSafeCheckoutUrl(authorizationUrl);

      const pendingPayment = {
        paymentId: paymentId.trim(),
        reference: reference.trim(),
        errandId: String(errandId),
        createdAt: new Date().toISOString(),
      };

      try {
        window.sessionStorage.setItem(
          PENDING_PAYMENT_KEY,
          JSON.stringify(pendingPayment)
        );
      } catch {
        throw new Error(
          "Your browser could not save the payment session. Please enable browser storage and try again. No checkout redirect was started."
        );
      }

      window.location.assign(checkoutUrl);
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
      setPaying(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Fund your errand"
      description="Review your agreed amount before continuing to secure checkout."
      size="sm"
    >
      <div className="space-y-6">
        {/* Amount payable */}
        <div className="rounded-3xl bg-brand-navy px-5 py-5 text-content-inverse sm:px-6">
          <p className="text-sm font-medium text-white/70">
            Amount payable now
          </p>

          <div className="mt-1 flex min-h-[2.5rem] items-center">
            {loading ? (
              <span role="status" aria-live="polite">
                <LoaderCircle
                  className="h-8 w-8 animate-spin text-brand-mint sm:h-9 sm:w-9"
                  aria-hidden="true"
                />
                <span className="sr-only">Loading amount</span>
              </span>
            ) : (
              <p className="break-words text-3xl font-extrabold tracking-tight tabular-nums text-brand-mint sm:text-4xl">
                {paymentDetails
                  ? formatMoney(paymentDetails.amountDue, currency)
                  : "—"}
              </p>
            )}
          </div>

          <p className="mt-2 text-xs leading-5 text-white/70">
            Based on the accepted offer and the funding already recorded.
          </p>
        </div>

        {/* Errand + breakdown */}
        <section aria-label="Funding summary">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-content-muted">
            Errand
          </p>

          <p className="mt-1 break-words text-base font-extrabold tracking-tight text-content">
            {errand?.title || "Your errand"}
          </p>

          <p className="mt-0.5 break-words text-xs text-content-subtle">
            Reference {errand?.reference_code || errand?.reference || "—"}
          </p>

          {loading ? (
            <div role="status" aria-live="polite" className="mt-5 space-y-3">
              <span className="sr-only">Retrieving your funding summary</span>
              <div className="h-4 animate-pulse rounded-full bg-surface-muted" />
              <div className="h-4 animate-pulse rounded-full bg-surface-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-muted" />
            </div>
          ) : paymentDetails ? (
            <div className="mt-5 space-y-5">
              <dl className="divide-y divide-line-soft border-y border-line-soft">
                <SummaryRow
                  label="Agreed errand total"
                  value={formatMoney(paymentDetails.agreedTotal, currency)}
                />

                <SummaryRow
                  label="Already funded"
                  value={formatMoney(paymentDetails.amountFunded, currency)}
                  valueClassName="!text-success-dark"
                />

                {paymentDetails.overpaymentAmount > 0 ? (
                  <SummaryRow
                    label="Overpaid"
                    value={formatMoney(
                      paymentDetails.overpaymentAmount,
                      currency
                    )}
                    valueClassName="!text-amber-700"
                  />
                ) : null}

                <SummaryRow
                  label="Outstanding balance"
                  value={formatMoney(paymentDetails.amountDue, currency)}
                  valueClassName="!font-extrabold"
                />

                {paymentDetails.eranderName ? (
                  <SummaryRow
                    label="Accepted erander"
                    value={paymentDetails.eranderName}
                  />
                ) : null}
              </dl>

              <div>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-content">
                    Funded so far
                  </span>
                  <span className="tabular-nums text-content-muted">
                    {Math.round(fundedPercent)}%
                  </span>
                </div>

                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                  role="progressbar"
                  aria-label="Funding progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(fundedPercent)}
                >
                  <div
                    className="h-full rounded-full bg-brand-green transition-[width] duration-500 ease-out"
                    style={{ width: `${fundedPercent}%` }}
                  />
                </div>
              </div>

              {paymentDetails.amountDue === 0 ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-r-2xl border-l-4 border-success bg-brand-pale p-4 text-sm font-semibold text-success-dark"
                >
                  <CheckCircle2 size={17} aria-hidden="true" />
                  There is no outstanding balance.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-surface p-4">
              <AlertCircle
                size={19}
                className="mt-0.5 shrink-0 text-content-muted"
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p className="text-sm font-bold text-content">
                  Funding summary unavailable
                </p>

                <p className="mt-1 text-sm leading-6 text-content-muted">
                  We couldn't retrieve the funding summary. No payment checkout
                  has been started.
                </p>

                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-white px-4 py-2 text-xs font-bold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  Try again
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Error */}
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-r-2xl border-l-4 border-red-500 bg-red-50 p-4"
          >
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-red-600"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-950">
                Unable to continue
              </p>

              <p className="mt-1 break-words text-sm leading-6 text-red-800">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        {/* Trust note */}
        <p className="flex items-start gap-2.5 text-xs leading-5 text-content-muted">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-success"
            aria-hidden="true"
          />
          You'll be taken to Paystack to pay securely. We never see or store
          your card details.
        </p>

        {/* Actions */}
        <div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleClose}
              disabled={paying}
              className={BUTTON_GHOST}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePayment}
              disabled={!canPay}
              className={BUTTON_GREEN}
            >
              {paying ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Preparing secure checkout
                </>
              ) : (
                <>
                  <LockKeyhole size={16} aria-hidden="true" />
                  Continue to secure payment
                </>
              )}
            </button>
          </div>

          {paying ? (
            <p className="mt-3 text-center text-xs text-content-muted">
              Please don't close this page while checkout is being prepared.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
