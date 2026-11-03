import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  getErrandFundingSummary,
  verifyPayment,
} from "@/services/payments/paymentsApi";

const PENDING_PAYMENT_KEY = "erander.pendingPayment";

function readPendingPayment() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_KEY);

    if (!raw) return null;

    const payment = JSON.parse(raw);

    if (
      !payment ||
      typeof payment.paymentId !== "string" ||
      !payment.paymentId.trim() ||
      typeof payment.reference !== "string" ||
      !payment.reference.trim()
    ) {
      return null;
    }

    return payment;
  } catch {
    return null;
  }
}

function savePendingPayment(payment) {
  try {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify(payment),
    );
  } catch {
    // Verification does not depend on browser storage.
  }
}

function clearPendingPayment() {
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    // Cleanup failure must not change verification status.
  }
}

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnedReference =
    searchParams.get("reference") ||
    searchParams.get("trxref") ||
    "";

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState(
    "We're locating your existing payment and verifying it securely.",
  );
  const [pendingPayment, setPendingPayment] = useState(
    () => readPendingPayment(),
  );
  const [isRetrying, setIsRetrying] = useState(false);

  const automaticVerificationStarted = useRef(false);
  const verificationInProgress = useRef(false);

  const recoverPayment = useCallback(async () => {
    const savedPayment = readPendingPayment();

    // Use the saved payment only if its reference matches the callback.
    if (
      savedPayment?.paymentId &&
      savedPayment?.reference &&
      savedPayment.reference === returnedReference
    ) {
      return savedPayment;
    }

    /*
     * The callback reference is not a payment UUID.
     * Recover the UUID through the authenticated funding-summary endpoint.
     */
    const knownErrandId = savedPayment?.errandId;

    if (knownErrandId) {
      const summary = await getErrandFundingSummary(knownErrandId);
      const recovered = summary?.pendingPayment;

      if (
        recovered?.paymentId &&
        recovered?.reference === returnedReference
      ) {
        const payment = {
          ...recovered,
          errandId: summary.errandId || knownErrandId,
        };

        savePendingPayment(payment);
        setPendingPayment(payment);

        return payment;
      }
    }

    /*
     * If session storage has been lost completely, this callback URL
     * contains no errand ID. Do not guess which errand belongs to the
     * payment reference or verify an unrelated payment.
     */
    throw new Error(
      "The payment reference was found, but the errand ID needed to recover its payment is missing. Open the errand funding page and retry verification there.",
    );
  }, [returnedReference]);

  const runVerification = useCallback(
    async ({ automatic = false } = {}) => {
      if (verificationInProgress.current) return;

      verificationInProgress.current = true;

      if (!automatic) {
        setIsRetrying(true);
      }

      setStatus("verifying");
      setMessage(
        "We're locating your existing payment and checking the transaction with Paystack.",
      );

      try {
        if (!returnedReference) {
          throw new Error(
            "The Paystack callback did not include a transaction reference.",
          );
        }

        const payment = await recoverPayment();

        if (!payment?.paymentId) {
          throw new Error(
            "We could not recover the payment ID for verification.",
          );
        }

        if (payment.reference !== returnedReference) {
          throw new Error(
            "The recovered payment reference does not match the Paystack callback reference.",
          );
        }

        // This calls POST /payments/:paymentId/verify.
        await verifyPayment(payment.paymentId);

        clearPendingPayment();

        setPendingPayment(payment);
        setStatus("success");
        setMessage(
          "ERANDER has verified the existing payment successfully.",
        );
      } catch (error) {
        setStatus("error");
        setMessage(
          error?.message ||
            "We couldn't confirm the payment. You can retry verification without creating another payment.",
        );
      } finally {
        verificationInProgress.current = false;
        setIsRetrying(false);
      }
    },
    [recoverPayment, returnedReference],
  );

  useEffect(() => {
    if (automaticVerificationStarted.current) return;

    automaticVerificationStarted.current = true;

    void runVerification({ automatic: true });
  }, [runVerification]);

  const goToErrand = () => {
    if (pendingPayment?.errandId) {
      navigate(
        `/dashboard/erands/${encodeURIComponent(
          pendingPayment.errandId,
        )}`,
        { replace: true },
      );
      return;
    }

    navigate("/dashboard/erands", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex justify-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                status === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : status === "verifying"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {status === "success" ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : status === "verifying" ? (
                <LoaderCircle className="h-8 w-8 animate-spin" />
              ) : (
                <AlertCircle className="h-8 w-8" />
              )}
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {status === "success"
                ? "Payment verified"
                : status === "verifying"
                  ? "Verifying payment"
                  : "Payment not confirmed yet"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {message}
            </p>
          </div>

          {returnedReference && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Paystack reference
              </p>

              <p className="mt-2 break-all font-mono text-sm text-slate-800">
                {returnedReference}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="leading-6">
              ERANDER checks payment transactions with the provider.
              Returning from checkout alone does not mark an errand as
              funded.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {status === "error" && (
              <button
                type="button"
                onClick={() => void runVerification()}
                disabled={isRetrying}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRetrying ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}

                {isRetrying
                  ? "Retrying verification..."
                  : "Retry verification"}
              </button>
            )}

            {status === "success" && (
              <button
                type="button"
                onClick={goToErrand}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
              >
                Check errand funding status
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </button>
            )}

            {status === "error" && (
              <button
                type="button"
                onClick={goToErrand}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-5 w-5" />
                Open errand funding page
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}