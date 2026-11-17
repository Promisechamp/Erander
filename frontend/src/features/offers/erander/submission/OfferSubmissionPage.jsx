import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  Info,
  LoaderCircle,
  Package,
  Send,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { createErandOffer } from "@/services/offers/offersApi";

function formatMoney(amount, currency = "NGN") {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-NG")}`;
  }
}

function formatDate(value) {
  if (!value) return "Flexible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Flexible";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseAmount(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function formatCategory(category) {
  const labels = {
    shopping: "Shopping",
    delivery: "Delivery",
    confidential: "Confidential documents",
    pickup: "Legacy pickup",
    home_help: "Home help",
    personal_assistance: "Personal assistance",
    business_support: "Business support",
    other: "Other errands",
  };

  return labels[category] || "Other errands";
}

function PriceInput({
  label,
  value,
  onChange,
  currency,
  helpText,
  disabled = false,
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#14213D]">
        {label}
      </label>

      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
          {currency}
        </span>

        <input
          type="number"
          min="0"
          max="999999999999"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="0.00"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-14 pr-4 text-sm font-semibold text-[#14213D] outline-none transition placeholder:text-slate-300 focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {helpText && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200 ${className}`}
    />
  );
}

function OfferPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="mt-5 h-7 w-3/4 max-w-lg" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        <SkeletonBlock className="mt-6 h-20 w-full" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SkeletonBlock className="h-5 w-48" />

        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"
          >
            <div>
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-3 h-3 w-56" />
            </div>

            <SkeletonBlock className="h-12 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="mt-6 h-12 w-full" />
        <SkeletonBlock className="mt-5 h-12 w-full" />
        <SkeletonBlock className="mt-5 h-12 w-full" />
      </div>
    </div>
  );
}

function ConfirmationModal({
  open,
  errand,
  currency,
  itemTotal,
  serviceFee,
  deliveryFee,
  otherFees,
  total,
  submitting,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, submitting, onClose]);

  if (!open || !errand) return null;

  const rows = [
    { label: "Proposed item total", value: itemTotal },
    { label: "Service fee", value: serviceFee },
    { label: "Delivery fee", value: deliveryFee },
    { label: "Other fees", value: otherFees },
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-[#091426]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-confirmation-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <Send size={21} />
            </div>

            <h2
              id="offer-confirmation-title"
              className="mt-4 text-xl font-extrabold text-[#14213D]"
            >
              Review your offer
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Confirm the prices and fees before submitting your
              proposal to the customer.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close confirmation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">
              Errand
            </p>

            <p className="mt-1 break-words text-sm font-extrabold text-[#14213D]">
              {errand.title}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {errand.reference_code}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-slate-500">{row.label}</span>

                <span className="font-bold text-[#14213D]">
                  {formatMoney(row.value, currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-200 pt-5">
            <div>
              <p className="text-sm font-extrabold text-[#14213D]">
                Total proposed amount
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Subject to customer acceptance.
              </p>
            </div>

            <p className="text-right text-xl font-extrabold text-[#16864B]">
              {formatMoney(total, currency)}
            </p>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#B7E8CE] bg-[#F3FCF7] p-4">
            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-[#16864B]"
            />

            <p className="text-xs leading-6 text-slate-600">
              Submitting this offer does not mean it has been accepted.
              Review every amount carefully. Only proceed if you can
              complete the errand under the proposed terms.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Continue editing
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#35D07F] px-4 py-3 text-sm font-extrabold text-[#14213D] transition hover:bg-[#63E69D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit offer
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function OfferSubmissionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { errandId } = useParams();

  const errand = location.state?.errand || null;

  const [itemPrices, setItemPrices] = useState({});
  const [serviceFee, setServiceFee] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [otherFees, setOtherFees] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pageError, setPageError] = useState("");

  const items = useMemo(
    () => (Array.isArray(errand?.items) ? errand.items : []),
    [errand]
  );

  const currency = errand?.currency_code || "NGN";

  const itemTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const proposedPrice = parseAmount(
        itemPrices[item.id]?.unitPrice ??
          item.estimated_unit_price ??
          0
      );

      const quantity = parseAmount(item.quantity);

      return sum + proposedPrice * quantity;
    }, 0);
  }, [items, itemPrices]);

  const parsedServiceFee = parseAmount(serviceFee);
  const parsedDeliveryFee = parseAmount(deliveryFee);
  const parsedOtherFees = parseAmount(otherFees);

  const total = useMemo(
    () =>
      itemTotal +
      parsedServiceFee +
      parsedDeliveryFee +
      parsedOtherFees,
    [
      itemTotal,
      parsedServiceFee,
      parsedDeliveryFee,
      parsedOtherFees,
    ]
  );

  const budget = parseAmount(errand?.estimated_total);

  const exceedsBudget = total > budget;

  useEffect(() => {
    if (!errand) return;

    const initialPrices = {};

    for (const item of errand.items || []) {
      initialPrices[item.id] = {
        unitPrice: String(item.estimated_unit_price ?? ""),
        notes: "",
      };
    }

    setItemPrices(initialPrices);
  }, [errand]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard/available-errands");
    }
  }, [navigate]);

  useEffect(() => {
    if (!errandId) {
      setPageError("An errand ID is required to prepare an offer.");
      return;
    }

    if (!errand) {
      setPageError(
        "This page needs the selected errand details. Return to Available Errands and open the request again."
      );
    }
  }, [errand, errandId]);

  function updateItemPrice(itemId, value) {
    setItemPrices((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        unitPrice: value,
      },
    }));
  }

  function updateItemNotes(itemId, value) {
    setItemPrices((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        notes: value,
      },
    }));
  }

  function validateOffer() {
    if (!errand?.id || errand.id !== errandId) {
      return "The selected errand is invalid. Return to Available Errands and select it again.";
    }

    const feeValues = [
      { label: "Service fee", value: serviceFee },
      { label: "Delivery fee", value: deliveryFee },
      { label: "Other fees", value: otherFees },
    ];

    for (const fee of feeValues) {
      if (fee.value !== "" && !/^\d+(\.\d{1,2})?$/.test(fee.value)) {
        return `${fee.label} must be a valid amount with up to two decimal places.`;
      }

      if (parseAmount(fee.value) < 0) {
        return `${fee.label} cannot be negative.`;
      }
    }

    for (const item of items) {
      const price = itemPrices[item.id]?.unitPrice ?? "";

      if (price === "" || !/^\d+(\.\d{1,2})?$/.test(price)) {
        return `Enter a valid unit price for "${item.item_name}".`;
      }

      if (parseAmount(price) < 0) {
        return `The price for "${item.item_name}" cannot be negative.`;
      }

      if (parseAmount(item.quantity) <= 0) {
        return `The quantity for "${item.item_name}" is invalid.`;
      }
    }

    if (!Number.isFinite(total) || total < 0) {
      return "The total proposed amount is invalid.";
    }

    if (offerMessage.trim().length > 2000) {
      return "Your message must be no longer than 2,000 characters.";
    }

    return "";
  }

  function handleReviewOffer(event) {
    event.preventDefault();

    const validationError = validateOffer();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setShowConfirmation(true);
  }

  async function handleSubmitOffer() {
    if (submitting) return;

    const validationError = validateOffer();

    if (validationError) {
      setShowConfirmation(false);
      toast.error(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        offer_message: offerMessage.trim() || null,
        proposed_service_fee: parsedServiceFee.toFixed(2),
        proposed_delivery_fee: parsedDeliveryFee.toFixed(2),
        proposed_other_fees: parsedOtherFees.toFixed(2),
        items: items.map((item) => ({
          erand_item_id: item.id,
          proposed_quantity: String(item.quantity),
          proposed_unit_price: parseAmount(
            itemPrices[item.id]?.unitPrice
          ).toFixed(2),
          notes: itemPrices[item.id]?.notes?.trim() || null,
        })),
      };

      await createErandOffer(errandId, payload);

      setShowConfirmation(false);

      toast.success("Your offer has been submitted successfully.");

      navigate("/dashboard/my-offers", {
        replace: true,
      });
    } catch (error) {
      const message =
        error?.message ||
        "We couldn't submit your offer. Please try again.";

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (pageError || !errand) {
    return (
      <DashboardLayout
        title="Submit an offer"
        description="Prepare your proposal for a customer's errand."
      >
        <section className="rounded-2xl border border-amber-200 bg-white p-6 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <CircleAlert size={26} />
          </div>

          <h2 className="mt-5 text-xl font-extrabold text-[#14213D]">
            Errand details unavailable
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {pageError ||
              "Return to Available Errands and select the errand you want to work on."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/dashboard/available-errands")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#203658]"
          >
            <ArrowLeft size={16} />
            Browse available errands
          </button>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Submit an offer"
      description="Prepare a transparent proposal for this errand."
    >
      <button
        type="button"
        onClick={handleBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#16864B]"
      >
        <ArrowLeft size={17} />
        Back to errand details
      </button>

      <form onSubmit={handleReviewOffer} className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-[#14213D] p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[26px] border-white/[0.04]" />
          <div className="pointer-events-none absolute -bottom-16 right-20 h-40 w-40 rounded-full bg-[#20CC88]/10 blur-2xl" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#8CF0B5]">
                <ShoppingBag size={13} />
                {formatCategory(errand.category)}
              </span>

              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                {errand.reference_code}
              </span>
            </div>

            <h2 className="mt-5 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
              {errand.title}
            </h2>

            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
              {errand.description ||
                "No additional description was provided."}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <Wallet size={16} />
                  <span className="text-xs font-semibold">
                    Customer's estimated budget
                  </span>
                </div>

                <p className="mt-2 break-words text-xl font-extrabold text-[#8CF0B5]">
                  {formatMoney(errand.estimated_total, currency)}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarClock size={16} />
                  <span className="text-xs font-semibold">
                    Requested schedule
                  </span>
                </div>

                <p className="mt-2 text-sm font-bold text-white">
                  {formatDate(errand.scheduled_for)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <Package size={21} />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-[#14213D]">
                Item pricing
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Review the requested quantities and enter the unit price
                you propose for each item.
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-5">
              <div className="flex items-start gap-3">
                <Info
                  size={19}
                  className="mt-0.5 shrink-0 text-slate-400"
                />

                <div>
                  <p className="text-sm font-bold text-[#14213D]">
                    No itemized list
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    This request does not have itemized products.
                    You can enter applicable service, delivery, and
                    other fees below.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {items.map((item, index) => {
                const unitPrice = parseAmount(
                  itemPrices[item.id]?.unitPrice ??
                    item.estimated_unit_price
                );

                const quantity = parseAmount(item.quantity);

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-extrabold text-[#14213D]">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-extrabold text-[#14213D]">
                          {item.item_name || `Item ${index + 1}`}
                        </h3>

                        {item.description && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Requested quantity: {item.quantity}
                          {item.unit ? ` ${item.unit}` : ""}
                        </p>

                        {item.customer_notes && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-bold text-slate-500">
                              Customer's notes
                            </p>

                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                              {item.customer_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <PriceInput
                        label="Your proposed unit price"
                        value={
                          itemPrices[item.id]?.unitPrice ??
                          String(item.estimated_unit_price ?? "")
                        }
                        onChange={(event) =>
                          updateItemPrice(item.id, event.target.value)
                        }
                        currency={currency}
                        helpText={
                          `Customer estimate: ${formatMoney(
                            item.estimated_unit_price,
                            currency
                          )} per unit.`
                        }
                      />

                      <div className="flex flex-col justify-center rounded-xl bg-[#F3FCF7] p-4">
                        <p className="text-xs font-semibold text-slate-500">
                          Proposed line total
                        </p>

                        <p className="mt-2 break-words text-lg font-extrabold text-[#16864B]">
                          {formatMoney(
                            unitPrice * quantity,
                            currency
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Unit price × quantity
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor={`item-notes-${item.id}`}
                        className="block text-xs font-bold text-slate-600"
                      >
                        Item notes (optional)
                      </label>

                      <input
                        id={`item-notes-${item.id}`}
                        type="text"
                        maxLength={500}
                        value={itemPrices[item.id]?.notes || ""}
                        onChange={(event) =>
                          updateItemNotes(item.id, event.target.value)
                        }
                        placeholder="Explain substitutions, pricing or other details"
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-[#14213D] outline-none transition placeholder:text-slate-400 focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Total proposed item cost
              </p>

              <p className="mt-1 text-xl font-extrabold text-[#14213D]">
                {formatMoney(itemTotal, currency)}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
              <ClipboardList size={14} />
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <Wallet size={21} />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-[#14213D]">
                Your fees
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Add the fees required to complete the task. Enter zero
                where a fee does not apply.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <PriceInput
              label="Service fee"
              value={serviceFee}
              onChange={(event) => setServiceFee(event.target.value)}
              currency={currency}
              helpText="Your compensation for carrying out the errand."
            />

            <PriceInput
              label="Delivery or transportation fee"
              value={deliveryFee}
              onChange={(event) => setDeliveryFee(event.target.value)}
              currency={currency}
              helpText="Transport and delivery costs, where applicable."
            />

            <PriceInput
              label="Other fees"
              value={otherFees}
              onChange={(event) => setOtherFees(event.target.value)}
              currency={currency}
              helpText="Any additional applicable costs. Explain them in your message."
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="offer-message"
              className="block text-sm font-bold text-[#14213D]"
            >
              Message to the customer
            </label>

            <textarea
              id="offer-message"
              rows={5}
              maxLength={2000}
              value={offerMessage}
              onChange={(event) => setOfferMessage(event.target.value)}
              placeholder="Introduce your approach, explain your fees, mention relevant experience or clarify how you will complete the errand."
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-[#14213D] outline-none transition placeholder:text-slate-400 focus:border-[#35D07F] focus:ring-4 focus:ring-[#35D07F]/10"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-5 text-slate-400">
                Be clear about what your offer includes.
              </p>

              <p className="text-xs font-semibold text-slate-400">
                {offerMessage.length}/2000
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-[#14213D]">
                Offer summary
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Check the complete amount before sending your proposal.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Item total</span>
              <span className="font-bold text-[#14213D]">
                {formatMoney(itemTotal, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Service fee</span>
              <span className="font-bold text-[#14213D]">
                {formatMoney(parsedServiceFee, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">
                Delivery or transportation
              </span>
              <span className="font-bold text-[#14213D]">
                {formatMoney(parsedDeliveryFee, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Other fees</span>
              <span className="font-bold text-[#14213D]">
                {formatMoney(parsedOtherFees, currency)}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#14213D] p-5 text-white sm:p-6">
            <p className="text-sm font-semibold text-slate-300">
              Total proposed amount
            </p>

            <p className="mt-2 break-words text-3xl font-extrabold sm:text-4xl">
              {formatMoney(total, currency)}
            </p>

            <p className="mt-3 text-xs leading-6 text-slate-300">
              This is your proposed total. The customer must review and
              accept it before it becomes the agreed amount.
            </p>
          </div>

          {exceedsBudget && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <Info
                size={19}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <p className="text-sm font-extrabold text-amber-900">
                  Your offer exceeds the customer's estimate
                </p>

                <p className="mt-1 text-xs leading-6 text-amber-800">
                  Your offer is {formatMoney(total - budget, currency)}{" "}
                  above the estimated budget. The customer may still
                  review your proposal, but the final approved amount
                  must be explicitly agreed.
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <Clock3
              size={18}
              className="mt-0.5 shrink-0 text-slate-400"
            />

            <p className="text-xs leading-6 text-slate-500">
              The customer may accept or reject your offer. Do not begin
              work or spend the customer's money before the required
              agreement and funding steps are completed.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#35D07F] px-5 py-3.5 text-sm font-extrabold text-[#14213D] transition hover:bg-[#63E69D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Review and submit
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </form>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        ERANDER · Get things done.
      </footer>

      <ConfirmationModal
        open={showConfirmation}
        errand={errand}
        currency={currency}
        itemTotal={itemTotal}
        serviceFee={parsedServiceFee}
        deliveryFee={parsedDeliveryFee}
        otherFees={parsedOtherFees}
        total={total}
        submitting={submitting}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleSubmitOffer}
      />
    </DashboardLayout>
  );
}