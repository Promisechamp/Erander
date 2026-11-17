import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Hourglass,
  LifeBuoy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

import { useChat } from "@/contexts/ChatContext";
import Modal from "@/components/Modal";
import SecurityDepositFundingModal from "@/components/SecurityDepositFundingModal";

import { getErrandById } from "@/services/errands/errandsApi";
import { getMyErandOffers } from "@/services/offers/offersApi";
import {
  getErrandFundingSummary,
  getFundReleaseRequest,
  requestFundRelease,
} from "@/services/payments/paymentsApi";
import {
  getSecurityDepositFundingSummary,
  verifySecurityDepositFunding,
} from "@/services/payments/securityDepositFundingApi";

import ProgressTracker from "../../shared/ProgressTracker";
import StatusBadge from "../../shared/StatusBadge";
import {
  ActivitySection,
  EMPTY_RELEASE,
  ErrandError,
  ErrandLayout,
  ErrandPage,
  FundingSection,
  FundReleaseSection,
  InformationSection,
  ItemsSection,
  OverviewSection,
  PersonCard,
  PriceCard,
  ProposalSection,
  SupportCard,
  copyErrandId,
  formatCurrency,
  formatDateTime,
  getActivityItems,
  getFullName,
  getFundedPercent,
  getProgressTimestamps,
  unwrapErrandResponse,
  unwrapFundingResponse,
  unwrapOffersResponse,
  unwrapReleaseResponse,
} from "../../shared/ErrandView";

import CreateSupportTicket from "@/pages/support/CreateSupportTicket";

const ROLE = "erander";

const BTN =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_GREEN = `${BTN} bg-brand-green text-brand shadow-sm hover:brightness-95 active:scale-[0.98]`;

const BTN_NAVY = `${BTN} bg-brand text-content-inverse shadow-sm hover:opacity-90 active:scale-[0.98]`;

const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:border-line-strong hover:bg-surface-muted hover:text-content`;

const CARD =
  "rounded-2xl border border-line bg-surface-white shadow-erander-card";

const EYEBROW =
  "text-[11px] font-extrabold uppercase tracking-[0.14em] text-content-subtle";

const NEXT_TONE = {
  success: "bg-brand-pale text-success-dark",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
  neutral: "bg-surface-muted text-content-muted",
};

const EASE = [0.22, 1, 0.36, 1];

const sectionReveal = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.42,
    delay: 0.035 + i * 0.045,
    ease: EASE,
  },
});

const tabMotion = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

/* -------------------------------------------------------------------------- */
/*                              SKELETON PIECES                               */
/* -------------------------------------------------------------------------- */

function SkeletonBlock({ className = "", rounded = "rounded-lg" }) {
  const reduce = useReducedMotion();

  return (
    <div
      className={`relative overflow-hidden bg-surface-muted ${rounded} ${className}`}
      aria-hidden="true"
    >
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)",
          }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1.7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}

function SkeletonCircle({ className = "" }) {
  return (
    <SkeletonBlock className={className} rounded="rounded-full" />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading offer details">
      {/* Header */}
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBlock className="h-6 w-28" rounded="rounded-full" />
            <SkeletonBlock className="h-3 w-36" />
          </div>

          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-24" rounded="rounded-xl" />
            <SkeletonBlock className="h-10 w-24" rounded="rounded-xl" />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-2/3 max-w-lg" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
        </div>

        <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-line border-t border-line pt-4 sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-2 px-3 py-3 first:pl-0 sm:py-1">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-5 w-28" />
            </div>
          ))}
        </div>
      </section>

      {/* Next step */}
      <section className={`${CARD} flex gap-4 border-l-4 border-l-brand-green p-5 sm:p-6`}>
        <SkeletonCircle className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-3 w-full max-w-md" />
        </div>
        <SkeletonBlock className="hidden h-10 w-36 rounded-xl sm:block" />
      </section>

      {/* Chat */}
      <section className={`${CARD} flex items-center gap-4 p-5`}>
        <SkeletonCircle className="h-11 w-11 shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-3 w-full max-w-sm" />
        </div>
        <SkeletonBlock className="hidden h-10 w-36 rounded-xl sm:block" />
      </section>

      {/* Progress */}
      <section className={`${CARD} p-5 sm:p-6`}>
        <SkeletonBlock className="mb-5 h-4 w-36" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex flex-col items-center gap-2">
              <SkeletonCircle className="h-10 w-10" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          ))}
        </div>
        <SkeletonBlock className="mt-5 h-1.5 w-full" rounded="rounded-full" />
      </section>

      {/* Tabs and content */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((item) => (
              <SkeletonBlock
                key={item}
                className="h-9 w-20 shrink-0"
                rounded="rounded-xl"
              />
            ))}
          </div>

          <section className={`${CARD} space-y-4 p-5 sm:p-6`}>
            <SkeletonBlock className="h-5 w-1/3" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-11/12" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-10/12" />
            <SkeletonBlock className="h-3 w-2/3" />
          </section>
        </div>

        <aside className="space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <section key={item} className={`${CARD} space-y-3 p-5`}>
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-3 w-3/4" />
              <SkeletonBlock className="h-3 w-2/3" />
            </section>
          ))}
        </aside>
      </div>

      <span className="sr-only">Loading offer details…</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HEADER COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Stat({ label, value, progress, index = 0 }) {
  return (
    <div
      className={`min-w-0 px-3 py-3 first:pl-0 ${
        index > 0 ? "sm:border-l sm:border-line sm:pl-5" : ""
      }`}
    >
      <dt className="truncate text-xs font-semibold text-content-muted">
        {label}
      </dt>

      <dd className="mt-1 flex min-w-0 items-center gap-2 truncate text-base font-extrabold tabular-nums text-content">
        {value}
      </dd>

      {typeof progress === "number" && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <motion.div
            className="h-full rounded-full bg-brand-green"
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          />
        </div>
      )}
    </div>
  );
}

function OfferHeader({
  errand,
  subtitle,
  stats,
  copied,
  refreshing,
  onCopy,
  onRefresh,
  onHelp,
}) {
  return (
    <header className={`${CARD} p-5 sm:p-6`}>
      {/* Reference and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {errand.reference_code && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-pale px-2.5 py-1.5 text-xs font-extrabold text-success-dark">
              Ref {errand.reference_code}

              {errand.id && (
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy errand ID"
                  title="Copy errand ID"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md transition hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.7, opacity: 0 }}
                        className="inline-flex"
                      >
                        <Check size={12} strokeWidth={3} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.7, opacity: 0 }}
                        className="inline-flex"
                      >
                        <Copy size={12} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )}
            </span>
          )}

          {errand.created_at && (
            <span className="text-xs font-medium text-content-muted">
              Created {formatDateTime(errand.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh errand details"
            className={BTN_GHOST}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onHelp}
            className={BTN_GHOST}
          >
            <LifeBuoy size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Get help</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-5">
        <p className={EYEBROW}>Offer details</p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-extrabold leading-tight tracking-tight text-brand sm:text-3xl">
            {errand.title || "Errand details"}
          </h1>

          <StatusBadge status={errand.status} />
        </div>

        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-content-muted">
            {subtitle}
          </p>
        )}
      </div>

      {/* Financial summary */}
      <dl className="mt-6 grid grid-cols-2 divide-x divide-y divide-line border-t border-line pt-3 sm:grid-cols-4 sm:divide-y-0">
        {stats.map((stat, index) => (
          <Stat key={stat.label} {...stat} index={index} />
        ))}
      </dl>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ACTION COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function NextStepCard({ step }) {
  if (!step) return null;

  const Icon = step.icon;

  return (
    <section
      aria-label="Next step"
      className={`${CARD} flex flex-col gap-4 border-l-4 border-l-brand-green p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${NEXT_TONE[step.tone]}`}
        >
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className={EYEBROW}>Next step</p>

          <h2 className="mt-1 text-base font-extrabold tracking-tight text-content">
            {step.title}
          </h2>

          <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
            {step.text}
          </p>
        </div>
      </div>

      {step.action && (
        <button
          type="button"
          onClick={step.action.onClick}
          disabled={step.action.busy}
          className={`${BTN_GREEN} shrink-0`}
        >
          {step.action.busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={16} aria-hidden="true" />
          )}

          {step.action.busy
            ? step.action.busyLabel
            : step.action.label}
        </button>
      )}
    </section>
  );
}

function MessageCard({ name, onOpen }) {
  return (
    <section
      aria-label="Message the customer"
      className={`${CARD} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-5`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
          <MessageCircle size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-content">
            Talk to {name || "the customer"}
          </h2>

          <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
            Keep questions, updates and errand communication in one conversation.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={`${BTN_NAVY} shrink-0`}
      >
        <Send size={15} aria-hidden="true" />
        Message customer
      </button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              NOTICE COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function SoftNotice({ children }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <AlertCircle
        size={18}
        className="mt-0.5 shrink-0 text-amber-700"
        aria-hidden="true"
      />

      <p className="min-w-0 flex-1 text-sm leading-6 text-amber-900">
        {children} Some of the latest information may not be available.
      </p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    "Secure 100% of your accepted offer total using your wallet, Paystack, or a combination of both.",
    "The customer funds the errand after the agreement is in place.",
    "Once the errand is funded and your deposit is secured, request execution-fund release.",
    "Your request is reviewed, and it only shows as released after the payment provider confirms the transfer.",
  ];

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-brand">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-pale text-success-dark">
          <ShieldCheck size={17} aria-hidden="true" />
        </span>
        How errand funding works
      </h2>

      <ol className="mt-4 space-y-3">
        {steps.map((text, index) => (
          <li key={text} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-pale text-xs font-extrabold text-success-dark">
              {index + 1}
            </span>

            <span className="pt-0.5 text-sm leading-6 text-content-muted">
              {text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function OfferDetails({ onRaiseTicket }) {
  const { offerId } = useParams();
  const { openChat } = useChat();

  const [errand, setErrand] = useState(null);
  const [myOffer, setMyOffer] = useState(null);
  const [funding, setFunding] = useState(null);
  const [release, setRelease] = useState(EMPTY_RELEASE);
  const [securityDeposit, setSecurityDeposit] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [securityDepositOpen, setSecurityDepositOpen] = useState(false);
  const verifiedSecurityReferences = useRef(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("overview");
		
		const [supportOpen, setSupportOpen] = useState(false);
  const [supportErrand, setSupportErrand] = useState(null);


  const loadErrand = useCallback(
    async ({ silent = false } = {}) => {
      if (!offerId) {
        setError("The offer ID is missing from the page URL.");
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
        const offersResult = await getMyErandOffers();
        const offers = unwrapOffersResponse(offersResult);

        const selectedOffer = offers.find(
          (offer) => String(offer.id) === String(offerId)
        );

        if (!selectedOffer) {
          throw new Error("Your offer could not be found.");
        }

        const errandId =
          selectedOffer.erand_id || selectedOffer.errand?.id;

        if (!errandId) {
          throw new Error(
            "The errand ID associated with this offer could not be found."
          );
        }

        const errandResult = await getErrandById(errandId);
        const loadedErrand = unwrapErrandResponse(errandResult);

        if (!loadedErrand) {
          throw new Error("The associated errand could not be found.");
        }

        setErrand(loadedErrand);
        setMyOffer(selectedOffer);

        const isOfferAccepted = String(selectedOffer?.status || "").toLowerCase() === "accepted";
        const [fundingResult, releaseResult, depositResult] = await Promise.allSettled([
          getErrandFundingSummary(errandId),
          getFundReleaseRequest(errandId),
          isOfferAccepted ? getSecurityDepositFundingSummary(errandId) : Promise.resolve(null),
        ]);

        setFunding(
          fundingResult.status === "fulfilled"
            ? unwrapFundingResponse(fundingResult.value)
            : null
        );

        setRelease(
          releaseResult.status === "fulfilled"
            ? unwrapReleaseResponse(releaseResult.value)
            : EMPTY_RELEASE
        );

        setSecurityDeposit(
          depositResult.status === "fulfilled" && depositResult.value
            ? depositResult.value
            : null
        );
      } catch (loadError) {
        console.error("Unable to load offer details:", loadError);

        setError(
          loadError?.message || "An error occurred while loading the errand."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [offerId]
  );

  const refreshRelease = useCallback(async () => {
    if (!errand?.id) return;

    setReleaseLoading(true);

    try {
      const result = await getFundReleaseRequest(errand.id);
      setRelease(unwrapReleaseResponse(result));
    } catch (refreshError) {
      toast.error(
        refreshError?.message ||
          "Unable to refresh the fund-release status."
      );
    } finally {
      setReleaseLoading(false);
    }
  }, [errand?.id]);

  useEffect(() => {
    loadErrand();
  }, [loadErrand]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("security_deposit_reference");
    if (!reference || !errand?.id || verifiedSecurityReferences.current.has(reference)) return;

    verifiedSecurityReferences.current.add(reference);
    let active = true;

    (async () => {
      try {
        toast.message("Verifying your security-deposit payment…");
        const result = await verifySecurityDepositFunding({ erandId: errand.id, reference });
        if (!active) return;
        if (result?.secured) {
          toast.success(result.message || "Your security deposit is secured.");
          setSecurityDeposit((previous) => ({ ...(previous || {}), secured: true, securityDepositStatus: "secured" }));
          await loadErrand({ silent: true });
        } else {
          toast.message(result.message || "Paystack has not confirmed the security-deposit payment yet.");
        }
      } catch (verificationError) {
        if (active) toast.error(verificationError?.message || "Unable to verify the security-deposit payment. You can retry from this errand.");
      } finally {
        if (active) {
          params.delete("security_deposit_reference");
          params.delete("reference");
          params.delete("trxref");
          const query = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        }
      }
    })();

    return () => { active = false; };
  }, [errand?.id, loadErrand]);

  const submitRelease = async () => {
    if (!errand?.id || submittingRelease) return;

    setSubmittingRelease(true);

    try {
      const result = await requestFundRelease(errand.id);

      setRelease((previous) => ({
        ...previous,
        request: result.request,
      }));

      toast.success(
        result.existing
          ? "An existing fund-release request was found."
          : result.message || "Fund-release request submitted."
      );

      setConfirmOpen(false);
      await refreshRelease();
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          "Unable to submit the fund-release request."
      );
    } finally {
      setSubmittingRelease(false);
    }
  };

  
		
		const handleRaiseTicket = useCallback(() => {
  if (!errand?.id) {
    toast.error("Errand details are still loading. Please try again.");
    return;
  }

  const ticketContext = {
    errandId: errand.id,
    errand,
    //offer: acceptedOffer,
				offer: myOffer,
  };

  if (typeof onRaiseTicket === "function") {
    onRaiseTicket(ticketContext);
    return;
  }

  setSupportErrand(errand);
  setSupportOpen(true);
}, [onRaiseTicket, errand, myOffer]);
		
		
		
		
		

  const handleCopy = async () => {
    await copyErrandId(errand);
    setCopied(true);

    window.setTimeout(() => setCopied(false), 1200);
  };

  const currency =
    errand?.currency_code ||
    myOffer?.currency_code ||
    funding?.currency ||
    "NGN";

  const originalItems = useMemo(
    () => (Array.isArray(errand?.items) ? errand.items : []),
    [errand?.items]
  );

  const offerItems = useMemo(
    () => (Array.isArray(myOffer?.items) ? myOffer.items : []),
    [myOffer?.items]
  );

  const originalItemEstimate = useMemo(
    () =>
      originalItems.reduce(
        (total, item) =>
          total +
          Number(item.quantity ?? 1) *
            Number(item.estimated_unit_price ?? 0),
        0
      ),
    [originalItems]
  );

  const customer = useMemo(() => {
    const profile =
      errand?.customer ||
      errand?.requested_by_profile ||
      errand?.requester ||
      null;

    const name = getFullName(profile);

    if (!name) return null;

    return {
      name,
      avatar: profile.avatar_url || profile.profile_image || null,
      username: profile.username || null,
      reference: profile.reference_code || null,
    };
  }, [errand]);

  const activity = useMemo(
    () => getActivityItems(errand, myOffer, release, ROLE),
    [errand, myOffer, release]
  );

  const progressTimestamps = useMemo(
    () => getProgressTimestamps(errand, release),
    [errand, release]
  );

  /* ---------------------------------------------------------------------- */
  /*                                LOADING                                 */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <ErrandPage>
        <PageSkeleton />
      </ErrandPage>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*                                  ERROR                                 */
  /* ---------------------------------------------------------------------- */

  if (error && !errand) {
    return (
      <ErrandPage>
        <motion.div {...sectionReveal(0)}>
          <ErrandError
            message={error}
            onRetry={() => loadErrand()}
          />
        </motion.div>
      </ErrandPage>
    );
  }

  if (!errand) return null;

  /* ---------------------------------------------------------------------- */
  /*                             DERIVED VALUES                             */
  /* ---------------------------------------------------------------------- */

  const offerStatus = String(myOffer?.status || "").toLowerCase();
  const isAccepted = offerStatus === "accepted";

  const errandStatus = String(errand.status || "").toLowerCase();

  const releaseRequest = release?.request ?? null;
  const releaseStatus = String(
    releaseRequest?.status || ""
  ).toLowerCase();

  const securityDepositSecured = securityDeposit?.secured === true ||
    securityDeposit?.securityDepositStatus === "secured";

  const canSecureErrand = isAccepted && !securityDepositSecured &&
    ["offer_selected", "awaiting_funding", "funded"].includes(errandStatus);

  // A rejected request or failed transfer is terminal for that request, not
  // for the errand. The erander may submit a fresh request while the errand
  // remains funded and the required security deposit is still reserved.
  const retryableReleaseStatuses = ["rejected", "failed"];
  const canRetryRelease = retryableReleaseStatuses.includes(releaseStatus);
  const canRequestRelease =
    errandStatus === "funded" &&
    securityDepositSecured &&
    (!releaseRequest || canRetryRelease);

  const proposedTotal = Number(myOffer?.proposed_total ?? 0);
  const estimatedTotal = Number(errand.estimated_total ?? 0);

  const agreedTotal = Number(
    funding?.agreedTotal ?? (isAccepted ? proposedTotal : 0)
  );

  const amountFunded = Number(funding?.amountFunded ?? 0);
  const amountDue = Number(funding?.amountDue ?? 0);

  const subtitle =
    errandStatus === "disputed"
      ? "This errand is under dispute review. Contact support for guidance."
      : errandStatus === "completed"
        ? "The errand is completed. Your net service earnings follow the platform's settlement rules."
        : errandStatus === "completion_submitted"
          ? "You submitted the completed work and are waiting for the customer's review."
          : errandStatus === "in_progress"
            ? "You are carrying out this errand."
            : canSecureErrand
              ? "Your accepted errand needs its 100% security deposit secured before execution-fund release."
              : errandStatus === "funded" && canRetryRelease
                ? releaseStatus === "rejected"
                  ? "Your previous fund-release request was rejected. You can review the reason and submit a new request."
                  : "The previous fund transfer failed. You can review the issue and retry the release request."
                : errandStatus === "funded"
                  ? canRequestRelease
                    ? "The errand is funded and your security deposit is secured. You can request the release of execution funds before starting work."
                    : releaseStatus === "approved"
                      ? "Your release request was approved. The payment provider must still confirm the transfer."
                      : releaseStatus === "processing"
                        ? "The payment provider is processing the execution-fund transfer."
                        : "Your fund-release request is awaiting review."
                  : isAccepted
                    ? "The customer accepted your offer. Secure your errand, then wait for customer funding."
                    : "Waiting for the customer to respond to your offer.";

  /* ---------------------------------------------------------------------- */
  /*                              NEXT STEP                                 */
  /* ---------------------------------------------------------------------- */

  let nextStep = null;

  if (errandStatus === "disputed") {
    nextStep = {
      icon: AlertCircle,
      tone: "danger",
      title: "This errand is under dispute",
      text: "Follow the support team's instructions and provide any requested information.",
    };
  } else if (errandStatus === "completed") {
    nextStep = {
      icon: CheckCircle2,
      tone: "success",
      title: "Errand completed",
      text: "The errand is finalized. Your net service earnings follow the platform's settlement rules.",
    };
  } else if (errandStatus === "completion_submitted") {
    nextStep = {
      icon: Hourglass,
      tone: "attention",
      title: "Waiting for the customer's review",
      text: "You submitted the completed work. The customer must review it before the errand can be finalized and settled.",
    };
  } else if (errandStatus === "in_progress") {
    nextStep = {
      icon: ShieldCheck,
      tone: "success",
      title: "You are carrying out this errand",
      text: "Continue the agreed work and keep the customer updated through the errand chat.",
    };
  } else if (releaseStatus === "released") {
    nextStep = {
      icon: CheckCircle2,
      tone: "success",
      title: "Your execution funds were released",
      text: "The payment provider confirmed release of the execution funds. Your net service earnings remain pending until the errand is finalized and settled. Check the Payments tab for details.",
    };
  } else if (canSecureErrand) {
    nextStep = {
      icon: ShieldCheck,
      tone: "attention",
      title: "Secure your errand",
      text: "Reserve the full 100% security deposit. You can use your wallet, pay directly through Paystack, or combine both.",
      action: {
        label: "Secure errand",
        busyLabel: "Loading security deposit",
        busy: false,
        onClick: () => setSecurityDepositOpen(true),
      },
    };
  } else if (canRequestRelease) {
    const previousRequestWasRejected = releaseStatus === "rejected";
    const previousTransferFailed = releaseStatus === "failed";

    nextStep = {
      icon: previousRequestWasRejected || previousTransferFailed ? RefreshCw : Wallet,
      tone: previousRequestWasRejected || previousTransferFailed ? "attention" : "success",
      title: previousRequestWasRejected
        ? "Your release request was rejected"
        : previousTransferFailed
          ? "Your fund transfer failed"
          : "Request your execution funds",
      text: previousRequestWasRejected
        ? releaseRequest?.decisionReason || releaseRequest?.decision_reason ||
          "Your previous request was not approved. Review the request history in the Payments tab, then submit a new request."
        : previousTransferFailed
          ? releaseRequest?.failureReason || releaseRequest?.failure_reason ||
            "The previous transfer did not complete. Review the request history in the Payments tab, then retry."
          : "This errand is funded and your security deposit is secured. Request release of the execution funds before starting the work. The request is reviewed before any transfer starts.",
      action: {
        label: canRetryRelease ? "Retry fund release" : "Request fund release",
        busyLabel: "Submitting request",
        busy: submittingRelease,
        onClick: () => setConfirmOpen(true),
      },
    };
  } else if (releaseRequest && ["pending", "approved", "processing"].includes(releaseStatus)) {
    nextStep = {
      icon: Hourglass,
      tone: "attention",
      title: "Your release request is in progress",
      text:
        releaseStatus === "approved"
          ? "The request was approved, but approval is not transfer confirmation. Follow the payment-provider transfer on the Payments tab."
          : releaseStatus === "processing"
            ? "The payment provider is processing the execution-fund transfer. It is not complete until confirmed."
            : "The request is awaiting review. No execution-fund transfer has been confirmed yet. Follow it on the Payments tab.",
    };
  } else if (isAccepted && errandStatus === "awaiting_funding") {
    nextStep = {
      icon: Clock3,
      tone: "attention",
      title: "Waiting for the customer to fund",
      text: "Your offer was accepted. Don't start work until the errand is funded.",
    };
  } else if (isAccepted) {
    nextStep = {
      icon: ShieldCheck,
      tone: "success",
      title: "Your offer was accepted",
      text: "Follow the errand's progress below. Execution-fund release is requested after funding and security-deposit reservation, before work begins.",
    };
  } else if (offerStatus === "pending") {
    nextStep = {
      icon: Hourglass,
      tone: "attention",
      title: "Waiting for the customer",
      text: "The customer hasn't responded to your offer yet.",
    };
  } else if (["rejected", "withdrawn", "expired", "superseded"].includes(offerStatus)) {
    nextStep = {
      icon: XCircle,
      tone: "neutral",
      title:
        offerStatus === "rejected"
          ? "The customer chose another offer"
          : `This offer was ${offerStatus}`,
      text: "It stays in your history. You can browse available errands to send a new offer.",
    };
  }
  /* ---------------------------------------------------------------------- */
  /*                              PAGE SUMMARY                              */
  /* ---------------------------------------------------------------------- */

  const stats = [
    {
      label: isAccepted ? "Agreed total" : "Your offer",
      value:
        (isAccepted ? agreedTotal : proposedTotal) > 0
          ? formatCurrency(
              isAccepted ? agreedTotal : proposedTotal,
              currency
            )
          : "Not found",
    },
    {
      label: "Funded",
      value: funding
        ? formatCurrency(amountFunded, currency)
        : "Unavailable",
      progress: funding
        ? getFundedPercent(amountFunded, agreedTotal)
        : undefined,
    },
    {
      label: "Still to fund",
      value: funding
        ? formatCurrency(amountDue, currency)
        : "Unavailable",
    },
    {
      label: "Fund release",
      value: releaseStatus ? (
        <StatusBadge status={releaseStatus} />
      ) : (
        "Not requested"
      ),
    },
  ];

  const tabs = [
    { value: "overview", label: "Overview" },
    {
      value: "items",
      label: "Items",
      count: originalItems.length,
    },
    { value: "proposal", label: "Your offer" },
    { value: "payments", label: "Payments" },
    {
      value: "activity",
      label: "Activity",
      count: activity.length,
    },
  ];

  /* ---------------------------------------------------------------------- */
  /*                                 SIDEBAR                                */
  /* ---------------------------------------------------------------------- */

  const sidebar = (
    <>
      <PersonCard
        role={ROLE}
        person={customer}
        footer={
          isAccepted && myOffer?.responded_at
            ? `The customer accepted your offer on ${formatDateTime(
                myOffer.responded_at
              )}`
            : null
        }
      />

      <PriceCard
        role={ROLE}
        offer={myOffer}
        total={proposedTotal}
        currency={currency}
        funded={funding ? amountFunded : undefined}
        due={funding ? amountDue : undefined}
      />

      <SupportCard
        role={ROLE}
        onRaiseTicket={handleRaiseTicket}
      />

      <HowItWorks />
    </>
  );

  /* ---------------------------------------------------------------------- */
  /*                                  RENDER                                */
  /* ---------------------------------------------------------------------- */

  return (
    <ErrandPage>
      <div className="space-y-5">
        {/* Header */}
        <motion.div {...sectionReveal(0)}>
          <OfferHeader
            errand={errand}
            subtitle={subtitle}
            stats={stats}
            copied={copied}
            refreshing={refreshing}
            onCopy={handleCopy}
            onRefresh={() => loadErrand({ silent: true })}
            onHelp={handleRaiseTicket}
          />
        </motion.div>

        {/* Background refresh warning */}
        {error && (
          <motion.div {...sectionReveal(1)}>
            <SoftNotice>{error}</SoftNotice>
          </motion.div>
        )}

        {/* Next step */}
        {nextStep && (
          <motion.div {...sectionReveal(2)}>
            <NextStepCard step={nextStep} />
          </motion.div>
        )}

        {/* Customer conversation */}
        {myOffer?.offered_by && errand?.id && (
          <motion.div {...sectionReveal(3)}>
            <MessageCard
              name={customer?.name}
              onOpen={() =>
                openChat({
                  errandId: errand.id,
                  eranderId: myOffer.offered_by,
                })
              }
            />
          </motion.div>
        )}

        {/* Progress */}
        <motion.div {...sectionReveal(4)}>
          <ProgressTracker
            errand={errand}
            payment={funding}
            fundRelease={release}
            timestamps={progressTimestamps}
            showAssignedErander={false}
            viewerRole="erander"
          />
        </motion.div>

        {/* Main content and sidebar */}
        <motion.div {...sectionReveal(5)}>
          <ErrandLayout
            tabs={tabs}
            tab={tab}
            onTab={setTab}
            sidebar={sidebar}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                {...tabMotion}
                className="min-w-0 space-y-5"
              >
                {tab === "overview" && (
                  <>
                    <OverviewSection
                      errand={errand}
                      currency={currency}
                      role={ROLE}
                    />

                    <InformationSection
                      errand={errand}
                      role={ROLE}
                    />
                  </>
                )}

                {tab === "items" && (
                  <ItemsSection
                    items={originalItems}
                    offerItems={offerItems}
                    currency={currency}
                    errand={errand}
                    role={ROLE}
                    estimatedTotal={estimatedTotal}
                  />
                )}

                {tab === "proposal" && (
                  <ProposalSection
                    offer={myOffer}
                    originalItems={originalItems}
                    originalItemEstimate={originalItemEstimate}
                    currency={currency}
                    role={ROLE}
                  />
                )}

                {tab === "payments" && (
                  <>
                    <section className={`${CARD} p-5 sm:p-6`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${securityDepositSecured ? "bg-brand-pale text-success-dark" : "bg-amber-50 text-amber-700"}`}>
                            <ShieldCheck size={19} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <h2 className="text-sm font-extrabold text-content">Security deposit</h2>
                            <p className="mt-1 text-xs leading-5 text-content-muted">
                              {securityDepositSecured
                                ? "Your full security deposit is reserved for this errand."
                                : "Secure 100% of the accepted offer total before requesting execution-fund release."}
                            </p>
                            {securityDeposit?.requiredAmount && (
                              <p className="mt-2 text-sm font-extrabold tabular-nums text-content">Required: {formatCurrency(Number(securityDeposit.requiredAmount), currency)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={securityDepositSecured ? "secured" : securityDeposit?.securityDepositStatus || "not_secured"} />
                          {!securityDepositSecured && isAccepted && (
                            <button type="button" onClick={() => setSecurityDepositOpen(true)} className={BTN_GREEN}>
                              <ShieldCheck size={15} /> Secure errand
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                    <FundingSection
                      funding={funding}
                      currency={currency}
                      role={ROLE}
                    />

                    <FundReleaseSection
                      role={ROLE}
                      request={releaseRequest}
                      events={release?.events ?? []}
                      canRequest={canRequestRelease}
                      submitting={submittingRelease}
                      loading={releaseLoading}
                      onRequest={() => setConfirmOpen(true)}
                      onRefresh={refreshRelease}
                    />
                  </>
                )}

                {tab === "activity" && (
                  <ActivitySection activity={activity} />
                )}
              </motion.div>
            </AnimatePresence>
          </ErrandLayout>
        </motion.div>
      </div>

      {/* Fund release confirmation */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        dismissible={!submittingRelease}
        loading={submittingRelease}
        icon={Wallet}
        tone="success"
        title="Request fund release?"
        subtitle="Payments"
        size="sm"
        position="center"
        resizable={false}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submittingRelease}
              className={BTN_GHOST}
            >
              Not yet
            </button>

            <button
              type="button"
              onClick={submitRelease}
              disabled={submittingRelease}
              className={BTN_GREEN}
            >
              {submittingRelease ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Submitting
                </>
              ) : (
                <>
                  <Send size={16} aria-hidden="true" />
                  Submit request
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-1">
          <p className="text-sm leading-6 text-content-muted">
            You're asking for the release of funds for{" "}
            <b className="font-extrabold text-content">
              {errand.title || "this errand"}
            </b>.
          </p>

          <div className="rounded-xl border border-line bg-surface-muted/60 p-4 text-sm leading-6 text-content-muted">
            Nothing is paid out straight away. Your request is reviewed
            first, and funds only show as released after the payment
            provider confirms the transfer.
          </div>
        </div>
      </Modal>
						
						
						<SecurityDepositFundingModal
        isOpen={securityDepositOpen}
        onClose={() => setSecurityDepositOpen(false)}
        errandId={errand.id}
        errandTitle={errand.title}
        onSecured={async () => {
          setSecurityDeposit((previous) => ({ ...(previous || {}), secured: true, securityDepositStatus: "secured" }));
          await loadErrand({ silent: true });
        }}
      />
      
      <CreateSupportTicket
								open={supportOpen}
								onClose={() => {
										setSupportOpen(false);
										setSupportErrand(null);
								}}
								errand={supportErrand}
								onCreated={() => {
										setSupportOpen(false);
										setSupportErrand(null);
								}}
						/>
						
						
    </ErrandPage>
  );
}