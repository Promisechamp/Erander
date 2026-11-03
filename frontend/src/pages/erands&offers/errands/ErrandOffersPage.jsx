import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Handshake,
  Info,
  LoaderCircle,
  MessageSquareText,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Truck,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import {
  acceptErandOffer,
  getOffersForErrand,
  rejectErandOffer,
} from "@/services/offers/offersApi";

import { getErrandById } from "@/services/errands/errandsApi";

const STATUS_OPTIONS = [
  { value: "all", label: "All offers" },
  { value: "pending", label: "Awaiting your decision" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_STYLES = {
  pending: {
    label: "Awaiting your decision",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  accepted: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Clock3,
  },
  superseded: {
    label: "Superseded",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: Info,
  },
};

const CATEGORY_LABELS = {
  shopping: "Shopping",
  delivery: "Delivery",
  pickup: "Pickup",
  home_help: "Home help",
  personal_assistance: "Personal assistance",
  business_support: "Business support",
  other: "Other errands",
  groceries: "Shopping & groceries",
  documents: "Documents & office",
  gifts: "Gifts & special requests",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value, currency = "NGN") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function normalizeStatus(value) {
  return String(value || "pending").toLowerCase();
}

function getStatusConfig(status) {
  const normalized = normalizeStatus(status);

  return (
    STATUS_STYLES[normalized] || {
      label: normalized
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      className: "border-slate-200 bg-slate-100 text-slate-600",
      icon: Info,
    }
  );
}

function getOfferId(offer) {
  return offer?.id || offer?.offer_id || "";
}

function getCurrency(offer, errand) {
  return (
    offer?.currency_code ||
    errand?.currency_code ||
    "NGN"
  );
}

function getAmount(offer, field) {
  const amount = Number(offer?.[field]);
  return Number.isFinite(amount) ? amount : 0;
}

function getProposedTotal(offer) {
  const total = Number(offer?.proposed_total);

  if (Number.isFinite(total)) {
    return total;
  }

  return (
    getAmount(offer, "proposed_item_total") +
    getAmount(offer, "proposed_service_fee") +
    getAmount(offer, "proposed_delivery_fee") +
    getAmount(offer, "proposed_other_fees")
  );
}

function getOfferItems(offer) {
  const items =
    offer?.items ||
    offer?.offer_items ||
    offer?.erand_offer_items ||
    [];

  return Array.isArray(items) ? items : [];
}

function getOfferMessage(offer) {
  return offer?.offer_message || offer?.message || "";
}

function getErander(offer) {
  return (
    offer?.erander ||
    offer?.profile ||
    offer?.offered_by_profile ||
    offer?.offeredByProfile ||
    offer?.user ||
    {}
  );
}

function getEranderName(offer) {
  const erander = getErander(offer);

  const fullName = [
    erander?.first_name,
    erander?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    erander?.display_name ||
    erander?.full_name ||
    fullName ||
    offer?.erander_name ||
    offer?.display_name ||
    "ERANDER service provider"
  );
}

function getEranderInitials(offer) {
  const name = getEranderName(offer);

  if (name === "ERANDER service provider") {
    return "E";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getCreatedAt(offer) {
  return offer?.created_at || offer?.submitted_at || null;
}

function normalizeOffersResponse(result) {
  const data = result?.data ?? result ?? {};

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.offers)) {
    return data.offers;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

function normalizeErrandResponse(result) {
  const data = result?.data ?? result ?? {};

  return (
    data.errand ||
    data.erand ||
    data.request ||
    data
  );
}

function canRespondToOffers(errand) {
  if (!errand) return false;

  return (
    errand.status === "open" &&
    errand.offers_enabled !== false &&
    !errand.accepted_offer_id &&
    !errand.agreement_locked_at
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-slate-200" />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-3 w-48 max-w-full rounded bg-slate-100" />
        </div>

        <div className="h-7 w-24 rounded-full bg-slate-100" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl bg-slate-50 p-3">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-24 max-w-full rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="mt-5 h-16 rounded-xl bg-slate-50" />

      <div className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        config.className
      )}
    >
      <Icon size={14} />
      {config.label}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = {
    navy: "bg-[#14213d] text-white",
    green: "bg-[#e9fbf3] text-[#15803d]",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,33,61,0.04)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        <span className={cn("rounded-xl p-2.5", tones[tone] || tones.slate)}>
          <Icon size={19} />
        </span>
      </div>

      <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#14213d]">
        {value}
      </p>
    </div>
  );
}

function AmountTile({ label, value, currency }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 break-words text-sm font-extrabold text-[#14213d]">
        {formatMoney(value, currency)}
      </p>
    </div>
  );
}

function DecisionModal({
  action,
  offer,
  errand,
  busy,
  onClose,
  onConfirm,
}) {
  if (!action || !offer) return null;

  const accepting = action === "accept";
  const eranderName = getEranderName(offer);
  const total = getProposedTotal(offer);
  const currency = getCurrency(offer, errand);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#091426]/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-decision-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                accepting
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-600"
              )}
            >
              {accepting ? (
                <Handshake size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </span>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close confirmation"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <h2
            id="offer-decision-title"
            className="mt-4 text-xl font-extrabold text-[#14213d]"
          >
            {accepting ? "Accept this offer?" : "Reject this offer?"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {accepting
              ? `You are choosing ${eranderName} for this errand. Review the proposed total and make sure you are comfortable with the price before continuing.`
              : `You are about to reject the offer from ${eranderName}. Make sure this is the offer you want to decline.`}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">
              Proposed total
            </p>

            <p className="mt-1 text-2xl font-extrabold text-[#14213d]">
              {formatMoney(total, currency)}
            </p>

            {accepting && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Accepting an offer is not the same as funding the errand.
                Follow the next steps shown after acceptance, and do not
                assume work should begin before the required funding and
                agreement steps are complete.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Go back
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              accepting
                ? "bg-[#15803d] hover:bg-[#166534]"
                : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {busy ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Processing...
              </>
            ) : accepting ? (
              <>
                <Check size={17} />
                Confirm acceptance
              </>
            ) : (
              <>
                <XCircle size={17} />
                Confirm rejection
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ filtered, onReset, onBack }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:px-10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9fbf3] text-[#15803d]">
        <MessageSquareText size={28} />
      </span>

      <h3 className="mt-5 text-xl font-extrabold text-[#14213d]">
        {filtered ? "No matching offers" : "No offers received yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {filtered
          ? "Try a different search term or status filter."
          : "When eranders submit offers for this errand, you will be able to compare their proposed prices and review their messages here."}
      </p>

      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-[#14213d] transition hover:bg-slate-50"
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
        >
          <ArrowLeft size={16} />
          Back to errand
        </button>
      )}
    </div>
  );
}

export default function ErrandOffersPage() {
  const { errandId } = useParams();
  const navigate = useNavigate();

  const [errand, setErrand] = useState(null);
  const [offers, setOffers] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [decision, setDecision] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!errandId) {
        setError("The errand ID is missing from the page address.");
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [errandResult, offersResult] = await Promise.all([
          getErrandById(errandId),
          getOffersForErrand(errandId),
        ]);

        setErrand(normalizeErrandResponse(errandResult));
        setOffers(normalizeOffersResponse(offersResult));
      } catch (requestError) {
        setError(
          requestError?.message ||
            "We could not load this errand's offers. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [errandId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOffers = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return offers.filter((offer) => {
      const status = normalizeStatus(offer.status);

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const searchableText = [
        getEranderName(offer),
        getOfferMessage(offer),
        offer?.offer_message,
        offer?.reference_code,
        offer?.offered_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [offers, searchInput, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: offers.length,
      pending: offers.filter(
        (offer) => normalizeStatus(offer.status) === "pending"
      ).length,
      accepted: offers.filter(
        (offer) => normalizeStatus(offer.status) === "accepted"
      ).length,
      closed: offers.filter((offer) =>
        ["rejected", "withdrawn", "expired", "superseded"].includes(
          normalizeStatus(offer.status)
        )
      ).length,
    };
  }, [offers]);

  const respondingAllowed = canRespondToOffers(errand);

  const handleDecision = async () => {
    if (!decision?.offer || decisionBusy) return;

    const offerId = getOfferId(decision.offer);

    if (!offerId) {
      toast.error("We could not identify this offer.");
      return;
    }

    if (decision.action === "accept" && !canRespondToOffers(errand)) {
      toast.error(
        "This errand is no longer open for offer selection. Refresh the page to see its current status."
      );

      setDecision(null);
      await loadData({ silent: true });
      return;
    }

    setDecisionBusy(true);

    try {
      if (decision.action === "accept") {
        await acceptErandOffer(offerId);
        toast.success("Offer accepted successfully.");
      } else {
        await rejectErandOffer(offerId);
        toast.success("Offer rejected.");
      }

      setDecision(null);
      await loadData({ silent: true });
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          `We could not ${
            decision.action === "accept" ? "accept" : "reject"
          } this offer. Please try again.`
      );

      await loadData({ silent: true });
    } finally {
      setDecisionBusy(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
  };

  const goBackToErrand = () => {
    if (errandId) {
      navigate(`/dashboard/erands/${encodeURIComponent(errandId)}`);
    } else {
      navigate("/dashboard/erands");
    }
  };

  const category = errand?.category
    ? CATEGORY_LABELS[errand.category] ||
      errand.category.replaceAll("_", " ")
    : "";

  return (
    <div className="min-h-full bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={goBackToErrand}
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#14213d]"
            >
              <ArrowLeft size={16} />
              Back to errand
            </button>

            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-white">
                <Handshake size={23} />
              </span>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#14213d] sm:text-3xl">
                  Received Offers
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                  Compare offers, review proposed costs, and choose the
                  erander who best fits your needs.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadData({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#14213d] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <>
            <div className="mb-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-6 w-2/3 max-w-md rounded bg-slate-200" />
              <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
            </div>

            <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>

            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Info size={25} />
            </span>

            <h2 className="mt-4 text-lg font-extrabold text-[#14213d]">
              We couldn't load the offers
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() => loadData()}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white transition hover:bg-[#203659]"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : (
          <>
            <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(20,33,61,0.035)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {errand?.reference_code && (
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        {errand.reference_code}
                      </span>
                    )}

                    {category && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        <Tag size={11} />
                        {category}
                      </span>
                    )}
                  </div>

                  <h2 className="break-words text-xl font-extrabold text-[#14213d] sm:text-2xl">
                    {errand?.title || "Your errand"}
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={15} />
                      Created {formatDate(errand?.created_at)}
                    </span>

                    {errand?.scheduled_for && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={15} />
                        Scheduled {formatDate(errand.scheduled_for, true)}
                      </span>
                    )}

                    {errand?.estimated_total !== undefined &&
                      errand?.estimated_total !== null && (
                        <span className="inline-flex items-center gap-1.5">
                          <Wallet size={15} />
                          Budget {formatMoney(
                            errand.estimated_total,
                            errand.currency_code || "NGN"
                          )}
                        </span>
                      )}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-bold capitalize",
                    respondingAllowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  )}
                >
                  {String(errand?.status || "unknown").replaceAll("_", " ")}
                </span>
              </div>

              {errand?.description && (
                <p className="mt-4 whitespace-pre-wrap break-words border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                  {errand.description}
                </p>
              )}

              {!respondingAllowed && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <Info
                    size={19}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />

                  <p className="text-xs leading-5 text-amber-800 sm:text-sm">
                    This errand is not currently open for offer selection.
                    You can still review the offers, but you cannot accept
                    another offer from this page.
                  </p>
                </div>
              )}
            </section>

            <section
              aria-label="Offer summary"
              className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <SummaryCard
                label="Total received"
                value={summary.total}
                icon={FileText}
                tone="navy"
              />

              <SummaryCard
                label="Awaiting decision"
                value={summary.pending}
                icon={Clock3}
                tone="amber"
              />

              <SummaryCard
                label="Accepted"
                value={summary.accepted}
                icon={CheckCircle2}
                tone="green"
              />

              <SummaryCard
                label="Closed offers"
                value={summary.closed}
                icon={XCircle}
                tone="slate"
              />
            </section>

            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,33,61,0.03)] sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Search size={18} className="text-[#15803d]" />

                <h2 className="text-sm font-extrabold text-[#14213d]">
                  Find an offer
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                <label className="relative block">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search erander name or offer message..."
                    aria-label="Search received offers"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#14213d] outline-none transition placeholder:text-slate-400 focus:border-[#20cc88] focus:ring-4 focus:ring-[#20cc88]/10"
                  />
                </label>

                <label className="relative block">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter offers by status"
                    className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-[#14213d] outline-none transition focus:border-[#20cc88] focus:ring-4 focus:ring-[#20cc88]/10"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </label>
              </div>
            </section>

            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#14213d]">
                  Erander offers
                </h2>

                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Showing {filteredOffers.length} of {offers.length} offers
                </p>
              </div>

              <button
                type="button"
                onClick={goBackToErrand}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e9fbf3] px-3.5 text-xs font-extrabold text-[#15803d] transition hover:bg-[#d9f7e9] sm:text-sm"
              >
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Errand details</span>
                <span className="sm:hidden">Back</span>
              </button>
            </div>

            {filteredOffers.length === 0 ? (
              <EmptyState
                filtered={
                  Boolean(searchInput.trim()) || statusFilter !== "all"
                }
                onReset={handleResetFilters}
                onBack={goBackToErrand}
              />
            ) : (
              <div className="space-y-4">
                {filteredOffers.map((offer) => {
                  const offerId = getOfferId(offer);
                  const status = normalizeStatus(offer.status);
                  const currency = getCurrency(offer, errand);
                  const eranderName = getEranderName(offer);
                  const erander = getErander(offer);
                  const message = getOfferMessage(offer);
                  const createdAt = getCreatedAt(offer);
                  const items = getOfferItems(offer);
                  const total = getProposedTotal(offer);

                  const canDecide =
                    status === "pending" &&
                    respondingAllowed &&
                    Boolean(offerId);

                  return (
                    <article
                      key={offerId || `${offer?.offered_by}-${createdAt}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(20,33,61,0.035)] transition hover:border-slate-300"
                    >
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            {erander?.avatar_url || erander?.avatar ? (
                              <img
                                src={erander.avatar_url || erander.avatar}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 object-cover"
                              />
                            ) : (
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf3] text-sm font-extrabold text-[#15803d]">
                                {getEranderInitials(offer)}
                              </span>
                            )}

                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-base font-extrabold text-[#14213d] sm:text-lg">
                                {eranderName}
                              </h3>

                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                {createdAt && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays size={14} />
                                    {formatDate(createdAt, true)}
                                  </span>
                                )}

                                {items.length > 0 && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Package size={14} />
                                    {items.length} priced{" "}
                                    {items.length === 1 ? "item" : "items"}
                                  </span>
                                )}

                                {erander?.verification_status === "verified" && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700">
                                    <ShieldCheck size={14} />
                                    Verified
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <StatusBadge status={status} />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <AmountTile
                            label="Items"
                            value={getAmount(offer, "proposed_item_total")}
                            currency={currency}
                          />

                          <AmountTile
                            label="Service fee"
                            value={getAmount(offer, "proposed_service_fee")}
                            currency={currency}
                          />

                          <AmountTile
                            label="Delivery fee"
                            value={getAmount(offer, "proposed_delivery_fee")}
                            currency={currency}
                          />

                          <AmountTile
                            label="Other fees"
                            value={getAmount(offer, "proposed_other_fees")}
                            currency={currency}
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d9f7e9] bg-[#f5fdf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#15803d] shadow-sm">
                              <Wallet size={19} />
                            </span>

                            <div>
                              <p className="text-xs font-semibold text-slate-500">
                                Total proposed price
                              </p>

                              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-[#15803d]">
                                {formatMoney(total, currency)}
                              </p>
                            </div>
                          </div>

                          {errand?.estimated_total !== undefined &&
                            errand?.estimated_total !== null && (
                              <div className="text-left sm:text-right">
                                <p className="text-xs font-semibold text-slate-500">
                                  Your estimated budget
                                </p>

                                <p className="mt-1 text-sm font-bold text-[#14213d]">
                                  {formatMoney(
                                    errand.estimated_total,
                                    currency
                                  )}
                                </p>
                              </div>
                            )}
                        </div>

                        {message && (
                          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                            <p className="flex items-center gap-2 text-xs font-extrabold text-slate-500">
                              <MessageSquareText size={14} />
                              Message from erander
                            </p>

                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                              {message}
                            </p>
                          </div>
                        )}

                        {status === "accepted" && (
                          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <CheckCircle2
                              size={20}
                              className="mt-0.5 shrink-0 text-emerald-700"
                            />

                            <div>
                              <p className="text-sm font-extrabold text-emerald-800">
                                This offer has been accepted
                              </p>

                              <p className="mt-1 text-xs leading-5 text-emerald-700">
                                Continue to the errand details to review
                                the next steps for agreement and funding.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {erander?.business_name ? (
                              <>
                                <BriefcaseBusiness size={15} />
                                {erander.business_name}
                              </>
                            ) : (
                              <>
                                <UserRound size={15} />
                                Independent erander
                              </>
                            )}
                          </div>

                          {canDecide ? (
                            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setDecision({
                                    action: "reject",
                                    offer,
                                  })
                                }
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                              >
                                <X size={16} />
                                Reject
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDecision({
                                    action: "accept",
                                    offer,
                                  })
                                }
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#15803d] px-5 text-sm font-bold text-white transition hover:bg-[#166534]"
                              >
                                <Check size={16} />
                                Accept offer
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              {status === "pending" && !respondingAllowed
                                ? "Decision unavailable"
                                : "No action available"}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf3] text-[#15803d]">
                <ShieldCheck size={19} />
              </span>

              <div>
                <h3 className="text-sm font-extrabold text-[#14213d]">
                  Review before accepting
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                  Compare the complete proposed price, the erander's
                  message, and the errand requirements. Acceptance does
                  not itself confirm that payment has been received or
                  authorize work to begin before the required agreement
                  and funding steps.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <DecisionModal
        action={decision?.action}
        offer={decision?.offer}
        errand={errand}
        busy={decisionBusy}
        onClose={() => {
          if (!decisionBusy) setDecision(null);
        }}
        onConfirm={handleDecision}
      />
    </div>
  );
}