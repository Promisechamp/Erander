import { useEffect, useState } from "react";
import {
AlertCircle,
CheckCircle2,
LoaderCircle,
LockKeyhole,
ShieldCheck,
Wallet,
X,
} from "lucide-react";

const PENDING_PAYMENT_KEY = "erander.pendingPayment";

function formatCurrency(value, currency = "NGN") {
const amount = Number(value);

if (!Number.isFinite(amount)) {
return "Unavailable";
}

try {
return new Intl.NumberFormat("en-NG", {
style: "currency",
currency,
maximumFractionDigits: 2,
}).format(amount);
} catch {
return `${currency} ${amount.toLocaleString("en-NG")}`;
}
}

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

function normalizeFundingSummary(result, errand) {
const details =
result?.data?.funding ||
result?.funding ||
result?.data ||
result;

const agreedTotal = Number(details?.agreedTotal);
const amountFunded = Number(details?.amountFunded);
const amountDue = Number(details?.amountDue);
const overpaymentAmount = Number(details?.overpaymentAmount ?? 0);

const currency = String(
details?.currency || errand?.currency_code || "NGN",
)
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
"The server returned an invalid funding summary. Please refresh the errand and try again.",
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

const errandId = getErrandId(errand);

useEffect(() => {
if (!open) {
setPaymentDetails(null);
setLoading(false);
setPaying(false);
setError("");
return undefined;
}

const handleKeyDown = (event) => {
  if (event.key === "Escape" && !paying) {
    onClose?.();
  }
};

window.addEventListener("keydown", handleKeyDown);

return () => {
  window.removeEventListener("keydown", handleKeyDown);
};

}, [open, paying, onClose]);

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
      throw new Error(
        "The funding-summary service has not been connected.",
      );
    }

    const result = await onGetFundingSummary(errandId);

    if (cancelled) {
      return;
    }

    const details = normalizeFundingSummary(result, errand);

    setPaymentDetails(details);
  } catch (requestError) {
    if (!cancelled) {
      setError(getErrorMessage(requestError));
    }
  } finally {
    if (!cancelled) {
      setLoading(false);
    }
  }
}

loadPaymentDetails();

return () => {
  cancelled = true;
};

}, [open, errandId, onGetFundingSummary]);

if (!open) {
return null;
}

const currency =
paymentDetails?.currency ||
errand?.currency_code ||
"NGN";

const amountDue = paymentDetails?.amountDue;

const canPay =
Boolean(paymentDetails) &&
Number.isFinite(amountDue) &&
amountDue > 0 &&
!loading &&
!paying;

const handlePayment = async () => {
if (!canPay || !errandId) {
return;
}

if (typeof onInitializePayment !== "function") {
  setError("The payment service has not been connected.");
  return;
}

setPaying(true);
setError("");

try {
  const result = await onInitializePayment(errandId);

  const checkout =
    result?.data?.data ||
    result?.data ||
    result;

  const authorizationUrl =
    checkout?.authorizationUrl ||
    checkout?.authorization_url;

  const paymentId =
    checkout?.paymentId ||
    checkout?.payment_id ||
    checkout?.payment?.id;

  const reference =
    checkout?.reference ||
    checkout?.paymentReference ||
    checkout?.payment_reference;

  if (
    typeof paymentId !== "string" ||
    !paymentId.trim()
  ) {
    throw new Error(
      "The server did not return a valid payment ID. Please try again.",
    );
  }

  if (
    typeof reference !== "string" ||
    !reference.trim()
  ) {
    throw new Error(
      "The server did not return a valid payment reference. Please try again.",
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(authorizationUrl);
  } catch {
    throw new Error(
      "The payment provider did not return a valid checkout URL.",
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname
  ) {
    throw new Error(
      "The payment provider did not return a valid secure checkout URL.",
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  const isPaystackCheckout =
    hostname === "checkout.paystack.com" ||
    hostname.endsWith(".paystack.com");

  if (!isPaystackCheckout) {
    throw new Error(
      "The payment provider returned an unexpected checkout address.",
    );
  }

  const pendingPayment = {
    paymentId: paymentId.trim(),
    reference: reference.trim(),
    errandId: String(errandId),
    createdAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify(pendingPayment),
    );
  } catch {
    throw new Error(
      "Your browser could not save the payment session. Please enable browser storage and try again. No checkout redirect was started.",
    );
  }

  window.location.assign(parsedUrl.toString());
} catch (paymentError) {
  setError(getErrorMessage(paymentError));
  setPaying(false);
}

};

return (
<div
className="fixed inset-0 z-[100] flex items-end justify-center bg-[#091426]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
onMouseDown={(event) => {
if (event.target === event.currentTarget && !paying) {
onClose?.();
}
}}
>
<section
role="dialog"
aria-modal="true"
aria-labelledby="fund-errand-title"
aria-describedby="fund-errand-description"
className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
>
<header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
<div className="flex items-start gap-3">
<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf3] text-[#15803d]">
<Wallet size={22} />
</div>

        <div>
          <h2
            id="fund-errand-title"
            className="text-lg font-extrabold text-[#14213d] sm:text-xl"
          >
            Fund your errand
          </h2>

          <p
            id="fund-errand-description"
            className="mt-1 text-sm leading-5 text-slate-500"
          >
            Review your agreed amount before continuing to secure
            checkout.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={paying}
        aria-label="Close funding modal"
        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#14213d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X size={20} />
      </button>
    </header>

    <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
      <div className="rounded-2xl bg-[#14213d] p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Amount payable now
        </p>

        <p className="mt-2 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">
          {loading
            ? "Loading…"
            : paymentDetails
              ? formatCurrency(paymentDetails.amountDue, currency)
              : "—"}
        </p>

        <p className="mt-2 text-xs leading-5 text-white/65">
          Your payment amount is based on the accepted offer and the
          funding already recorded by ERANDER.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              Errand
            </p>

            <p className="mt-1 break-words text-sm font-extrabold text-[#14213d]">
              {errand?.title || "Your errand"}
            </p>

            <p className="mt-1 break-words text-xs text-slate-400">
              Reference:{" "}
              {errand?.reference_code || errand?.reference || "—"}
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <Wallet size={18} />
          </div>
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 py-6 text-sm text-slate-500"
          >
            <LoaderCircle size={18} className="animate-spin" />
            Retrieving your confirmed funding summary…
          </div>
        ) : paymentDetails ? (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                Agreed errand total
              </span>

              <span className="text-right text-sm font-bold text-[#14213d]">
                {formatCurrency(paymentDetails.agreedTotal, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                Already funded
              </span>

              <span className="text-right text-sm font-bold text-emerald-700">
                {formatCurrency(paymentDetails.amountFunded, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-sm font-extrabold text-[#14213d]">
                Outstanding balance
              </span>

              <span className="text-right text-base font-extrabold text-[#14213d]">
                {formatCurrency(paymentDetails.amountDue, currency)}
              </span>
            </div>

            {paymentDetails.eranderName && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">
                  Accepted erander
                </p>

                <p className="mt-1 text-sm font-bold text-[#14213d]">
                  {paymentDetails.eranderName}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 py-5">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-rose-600"
            />

            <p className="text-sm leading-6 text-slate-600">
              We couldn't retrieve the funding summary. No payment
              checkout has been initiated.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0 text-rose-600"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-rose-800">
              Unable to continue
            </p>

            <p className="mt-1 break-words text-sm leading-5 text-rose-700">
              {error}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-emerald-100 bg-[#e9fbf3] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-[#15803d]"
          />

          <div>
            <p className="text-sm font-extrabold text-[#14213d]">
              Secure payment
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Your transaction is initiated through ERANDER's backend.
              Payment confirmation depends on server-side verification,
              not just the checkout redirect.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePayment}
        disabled={!canPay}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#35d07f] px-5 py-4 text-sm font-extrabold text-[#14213d] transition hover:bg-[#27bd6f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? (
          <>
            <LoaderCircle size={18} className="animate-spin" />
            Preparing secure checkout…
          </>
        ) : (
          <>
            <LockKeyhole size={17} />
            Continue to Secure Payment
          </>
        )}
      </button>

      {paymentDetails && paymentDetails.amountDue === 0 && (
        <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={17} />
          There is no outstanding balance.
        </p>
      )}

      <p className="text-center text-xs leading-5 text-slate-400">
        Do not close this page while payment initialization is in
        progress.
      </p>
    </div>
  </section>
</div>

);
}