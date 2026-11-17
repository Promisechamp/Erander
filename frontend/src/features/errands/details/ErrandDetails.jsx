import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Hourglass,
  Inbox,
  LifeBuoy,
		Plus,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useChat } from "@/contexts/ChatContext";
import { updateErrandChatPreference } from "@/services/chat/chatApi";

import ActionMenu from "@/components/ActionMenu";
import { getErrandById } from "@/services/errands/errandsApi";
import { getOffersForErrand } from "@/services/offers/offersApi";
import {
  getErrandFundingSummary,
  getFundReleaseRequest,
  getErrandSecurityDepositStatus,
  initializePayment,
} from "@/services/payments/paymentsApi";

import {
  getFavoriteErranders,
  addFavoriteErander,
} from "@/services/favorites/favoriteErrandersApi";

import CustomerCategoryWorkspace from "../customer/CustomerCategoryWorkspace";
import ProgressTracker from "../shared/ProgressTracker";
import ErrandChatExecutionGuide from "../shared/ErrandChatExecutionGuide";
import ErrandCompletionActions from "../shared/ErrandCompletionActions";
import StatusBadge from "../shared/StatusBadge";
import { BudgetMonitor } from "../shared/ErrandTools";

import CreateSupportTicket from "@/pages/support/CreateSupportTicket";

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
  formatDateTime,
  getActivityItems,
  getFullName,
  getFundedPercent,
  getProgressTimestamps,
  unwrapErrandResponse,
  unwrapFundingResponse,
  unwrapOffersResponse,
  unwrapReleaseResponse,
  formatCurrency,
} from "../shared/ErrandView";

import FundErrandModal from "@/components/FundErrandModal";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const ROLE = "customer";

const ROUTES = {
  edit: (id) => `/dashboard/erands/${encodeURIComponent(id)}/edit`,
  offers: (id) => `/dashboard/erands/${encodeURIComponent(id)}/offers`,
  eranderProfile: (id) => `/dashboard/eranders/${encodeURIComponent(id)}`,
};

const ENDED_STATUSES = ["cancelled", "canceled", "expired"];

const FUNDED_OR_LATER = [
  "funded",
  "in_progress",
  "completion_submitted",
  "completed",
  "disputed",
];

const ASSIGNED_STATUSES = [
  "offer_selected",
  "assigned",
  "awaiting_funding",
  "funded",
  "in_progress",
  "completion_submitted",
  "completed",
  "disputed",
];

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_GREEN = `${BTN} bg-brand-green text-brand shadow-sm hover:brightness-95 active:scale-[0.98]`;

const BTN_NAVY = `${BTN} bg-brand text-content-inverse shadow-sm hover:opacity-90 active:scale-[0.98]`;

const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content hover:border-brand/20 hover:bg-surface-muted`;

const NEXT_TONE = {
  success: "bg-brand-pale text-success-dark",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
  neutral: "bg-surface-muted text-content-muted",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function canEditErrand(errand) {
  if (!errand) return false;

  const status = String(errand.status || "").toLowerCase().trim();

  if (ENDED_STATUSES.includes(status)) return false;
  if (FUNDED_OR_LATER.includes(status)) return false;

  if (
    errand.accepted_offer_id ||
    errand.acceptedOfferId ||
    errand.agreement_accepted_at ||
    errand.agreementAcceptedAt ||
    errand.agreement_locked_at ||
    errand.agreementLockedAt
  ) {
    return false;
  }

  if (errand.is_funded === true || errand.isFunded === true) return false;

  const fundingStatus = String(
    errand.funding_status || errand.fundingStatus || ""
  ).toLowerCase();

  if (
    ["funded", "fully_funded", "partially_funded", "partial"].includes(
      fundingStatus
    )
  ) {
    return false;
  }

  const funded = Number(
    errand.amount_funded ?? errand.amountFunded ?? errand.funded_amount ?? 0
  );

  if (Number.isFinite(funded) && funded > 0) return false;

  return true;
}

/* -------------------------------------------------------------------------- */
/*                               SHARED STYLES                                */
/* -------------------------------------------------------------------------- */

const CARD =
  "rounded-2xl border border-line bg-surface-white shadow-[0_2px_12px_rgba(20,33,61,0.035)]";

const EYEBROW =
  "text-[10px] font-extrabold uppercase tracking-[0.16em] text-content-subtle";

/* -------------------------------------------------------------------------- */
/*                               SKELETON LOADER                              */
/* -------------------------------------------------------------------------- */

function Bone({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden rounded-lg bg-surface-muted ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-[bone-shine_1.7s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
    </div>
  );
}

function SkeletonCard({ className = "", children }) {
  return (
    <div
      aria-hidden="true"
      className={`${CARD} p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function ErandDetailsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-5"
    >
      <span className="sr-only">Loading your errand details</span>

      {/* Page heading */}
      <div className="space-y-3">
        <Bone className="h-3 w-24" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <Bone className="h-8 w-2/3 max-w-md sm:h-10" />
            <Bone className="h-4 w-full max-w-sm" />
          </div>

          <div className="flex gap-2">
            <Bone className="h-10 w-24 rounded-xl" />
            <Bone className="h-10 w-10 rounded-xl sm:w-28" />
          </div>
        </div>
      </div>

      {/* Main overview */}
      <SkeletonCard className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Bone className="h-4 w-32" />
            <Bone className="h-7 w-24 rounded-full" />
          </div>
          <Bone className="mt-4 h-7 w-1/2 max-w-xs" />
          <Bone className="mt-2 h-3 w-40" />
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-3 p-4 sm:p-5">
              <Bone className="h-3 w-20" />
              <Bone className="h-5 w-28 max-w-full" />
              {item === 1 ? <Bone className="h-1.5 w-full" /> : null}
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Next action */}
      <SkeletonCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Bone className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Bone className="h-3 w-20" />
              <Bone className="h-5 w-56 max-w-full" />
              <Bone className="h-3.5 w-full max-w-lg" />
            </div>
          </div>
          <Bone className="h-11 w-32 rounded-xl" />
        </div>
      </SkeletonCard>

      {/* Progress */}
      <SkeletonCard>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-48 max-w-full" />
          </div>
          <Bone className="h-7 w-20 rounded-full" />
        </div>

        <div className="mt-7 flex items-center">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex flex-1 items-center">
              <Bone className="h-8 w-8 shrink-0 rounded-full" />
              {item !== 4 ? (
                <Bone className="mx-2 h-1 flex-1 rounded-full" />
              ) : null}
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Chat settings */}
      <SkeletonCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bone className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Bone className="h-4 w-32" />
              <Bone className="h-3.5 w-64 max-w-full" />
            </div>
          </div>
          <Bone className="h-10 w-36 rounded-xl" />
        </div>
      </SkeletonCard>

      {/* Main content and sidebar */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <SkeletonCard className="p-0">
            <div className="flex gap-6 overflow-hidden border-b border-line px-5 py-4">
              {[0, 1, 2, 3, 4].map((item) => (
                <Bone key={item} className="h-4 w-16 shrink-0" />
              ))}
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <Bone className="h-3 w-20" />
                <Bone className="h-6 w-52 max-w-full" />
              </div>
              <div className="space-y-2.5">
                <Bone className="h-3.5 w-full" />
                <Bone className="h-3.5 w-11/12" />
                <Bone className="h-3.5 w-2/3" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Bone className="h-24 rounded-xl" />
                <Bone className="h-24 rounded-xl" />
              </div>
            </div>
          </SkeletonCard>
        </div>

        <div className="hidden space-y-4 xl:block">
          {[0, 1, 2].map((item) => (
            <SkeletonCard key={item} className="space-y-4">
              <Bone className="h-4 w-32" />
              <div className="flex items-center gap-3">
                <Bone className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-28" />
                  <Bone className="h-3 w-20" />
                </div>
              </div>
              <Bone className="h-3 w-full" />
              <Bone className="h-10 w-full rounded-xl" />
            </SkeletonCard>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-content-subtle">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green" />
        Preparing your errand details
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Stat({ label, value, progress }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-content-subtle">
        {label}
      </dt>

      <dd className="mt-2 flex min-h-6 min-w-0 items-center gap-2 text-sm font-extrabold tabular-nums text-content sm:text-base">
        {value}
      </dd>

      {typeof progress === "number" ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-brand-green transition-[width] duration-700"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ErrandHeaderCard({
  errand,
  subtitle,
  stats,
  actions,
  copied,
  refreshing,
  onCopy,
  onRefresh,
  onHelp,
}) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-extrabold text-content">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
              ERRAND DETAILS
            </span>

            {errand.reference_code ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-white px-3 py-1.5 text-xs font-bold text-content-muted">
                {errand.reference_code}

                {errand.id ? (
                  <button
                    type="button"
                    onClick={onCopy}
                    aria-label="Copy errand ID"
                    title="Copy errand ID"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {copied ? (
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Copy size={12} aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </span>
            ) : null}

            {errand.created_at ? (
              <span className="text-xs font-medium text-content-subtle">
                Created {formatDateTime(errand.created_at)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh errand"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface-white px-3 text-sm font-bold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface-white px-3 text-sm font-bold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <LifeBuoy size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Get help</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-brand sm:text-3xl lg:text-[2.15rem]">
                {errand.title || "Errand details"}
              </h1>
              <StatusBadge status={errand.status} />
            </div>

            {subtitle ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-content-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            {actions}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line bg-surface-muted/40">
        <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </dl>
      </div>
    </section>
  );
}

function NextStepCard({ step }) {
  if (!step) return null;

  const Icon = step.icon;
  const ActionIcon = step.action?.icon;

  return (
    <section
      aria-label="Next step"
      className={`${CARD} relative overflow-hidden p-5 sm:p-6`}
    >
      <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand-green" />

      <div className="flex flex-col gap-4 pl-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${NEXT_TONE[step.tone]}`}
          >
            <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <p className={EYEBROW}>YOUR NEXT STEP</p>

            <h2 className="mt-1 text-base font-extrabold tracking-tight text-content sm:text-lg">
              {step.title}
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-content-muted">
              {step.text}
            </p>
          </div>
        </div>

        {step.action ? (
          <button
            type="button"
            onClick={step.action.onClick}
            className={`${BTN_GREEN} shrink-0`}
          >
            {ActionIcon ? (
              <ActionIcon size={16} aria-hidden="true" />
            ) : null}
            {step.action.label}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ChatPermissionCard({ allowed, saving, onToggle }) {
  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand">
            <MessageCircle size={19} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-content">
              Chat permissions
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
              {allowed
                ? "Eranders who have offered on this errand can start a conversation with you."
                : "Eranders cannot start a new conversation for this errand. Existing chats can continue."}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onToggle}
          className={`${allowed ? BTN_GHOST : BTN_NAVY} shrink-0`}
        >
          {saving ? (
            <Loader2
              size={15}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : null}

          {saving
            ? "Saving changes"
            : allowed
              ? "Stop new chats"
              : "Allow new chats"}
        </button>
      </div>
    </section>
  );
}

function SoftNotice({ children }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5"
    >
      <AlertCircle
        size={18}
        className="mt-0.5 shrink-0 text-amber-700"
        aria-hidden="true"
      />

      <p className="min-w-0 flex-1 text-sm leading-6 text-amber-900">
        {children} Some of the latest errand information may not be available.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function ErandDetails({
  errandId: suppliedErrandId,
  onFundNow,
  onRaiseTicket,
}) {
  const params = useParams();
  const navigate = useNavigate();
  const { openChat } = useChat();

  const [chatPreferenceSaving, setChatPreferenceSaving] = useState(false);

  const errandId =
    suppliedErrandId || params.errandId || params.erandId || params.id;

  const [errand, setErrand] = useState(null);
  const [acceptedOffer, setAcceptedOffer] = useState(null);
  const [funding, setFunding] = useState(null);
  const [release, setRelease] = useState(EMPTY_RELEASE);
  const [securityDepositStatus, setSecurityDepositStatus] = useState("unable_to_verify");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState("overview");
  const [fundOpen, setFundOpen] = useState(false);
		
		const [supportOpen, setSupportOpen] = useState(false);
  const [supportErrand, setSupportErrand] = useState(null);
		
		const [isFavoriteErander, setIsFavoriteErander] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
		
		
		
  /* ------------------------------------------------------------------------ */
  /*                               DATA LOADING                               */
  /* ------------------------------------------------------------------------ */

  const loadErrand = useCallback(
    async ({ silent = false } = {}) => {
      if (!errandId) {
        setError("An errand ID was not provided.");
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const errandResponse = await getErrandById(errandId);
        const errandData = unwrapErrandResponse(errandResponse);

        if (!errandData) {
          throw new Error("The server did not return the requested errand.");
        }

        const [offersResult, fundingResult, releaseResult, securityDepositResult] =
          await Promise.allSettled([
            getOffersForErrand(errandId),
            getErrandFundingSummary(errandId),
            getFundReleaseRequest(errandId),
            getErrandSecurityDepositStatus(errandId),
          ]);

        let selectedOffer = errandData.accepted_offer ?? null;

        if (offersResult.status === "fulfilled") {
          const retrievedOffers = unwrapOffersResponse(offersResult.value);

          const matchedFromOffers =
            retrievedOffers.find(
              (offer) =>
                String(offer.id) === String(errandData.accepted_offer_id)
            ) ||
            retrievedOffers.find(
              (offer) =>
                offer.status === "accepted" &&
                String(offer.erand_id) === String(errandData.id)
            ) ||
            null;

          if (matchedFromOffers) {
            selectedOffer = selectedOffer
              ? { ...selectedOffer, ...matchedFromOffers }
              : matchedFromOffers;
          }
        } else {
          console.error(
            "Unable to retrieve errand offers:",
            offersResult.reason
          );
        }

        let nextFunding = null;

        if (fundingResult.status === "fulfilled") {
          nextFunding = unwrapFundingResponse(fundingResult.value);
        } else {
          console.error(
            "Unable to retrieve errand funding summary:",
            fundingResult.reason
          );
        }

        let nextRelease = EMPTY_RELEASE;

        if (releaseResult.status === "fulfilled") {
          nextRelease = unwrapReleaseResponse(releaseResult.value);
        } else {
          console.error(
            "Unable to retrieve fund-release information:",
            releaseResult.reason
          );
        }

        setErrand(errandData);
        setAcceptedOffer(selectedOffer);
        setFunding(nextFunding);
        setRelease(nextRelease);
        setSecurityDepositStatus(
          securityDepositResult.status === "fulfilled"
            ? securityDepositResult.value.status
            : "unable_to_verify"
        );

        if (securityDepositResult.status === "rejected") {
          console.error(
            "Unable to retrieve security-deposit status:",
            securityDepositResult.reason
          );
        }
      } catch (loadError) {
        console.error("Unable to load customer errand:", loadError);

        setError(
          loadError?.message ||
            "Something went wrong while loading this errand."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [errandId]
  );

  const refreshRelease = useCallback(async () => {
    if (!errandId) return;

    setReleaseLoading(true);

    try {
      const result = await getFundReleaseRequest(errandId);
      setRelease(unwrapReleaseResponse(result));
    } catch (refreshError) {
      toast.error(
        refreshError?.message ||
          "Unable to refresh the fund-release status."
      );
    } finally {
      setReleaseLoading(false);
    }
  }, [errandId]);

  useEffect(() => {
    loadErrand();
  }, [loadErrand]);
		
		
		
  /* ------------------------------------------------------------------------ */
  /*                              DERIVED DATA                                */
  /* ------------------------------------------------------------------------ */

  const currency =
    funding?.currency ||
    acceptedOffer?.currency_code ||
    errand?.currency_code ||
    "NGN";

  const originalItems = useMemo(
    () => (Array.isArray(errand?.items) ? errand.items : []),
    [errand?.items]
  );

  const offerItems = useMemo(
    () => (Array.isArray(acceptedOffer?.items) ? acceptedOffer.items : []),
    [acceptedOffer?.items]
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

  const assignedErander = useMemo(() => {
    if (!acceptedOffer) return null;

    const name = getFullName(acceptedOffer);

    return {
      id: acceptedOffer.offered_by,
      name,
      avatar: acceptedOffer.erander_avatar_url || null,
      username: acceptedOffer.erander_username || null,
      reference: acceptedOffer.erander_reference_code || null,
      profileTo: acceptedOffer.offered_by
        ? ROUTES.eranderProfile(acceptedOffer.offered_by)
        : null,
    };
  }, [acceptedOffer]);

  const isAssigned = useMemo(() => {
    if (!errand) return false;

    if (
      errand.accepted_offer_id ||
      errand.acceptedOfferId ||
      errand.agreement_accepted_at ||
      errand.agreementAcceptedAt ||
      errand.agreement_locked_at ||
      errand.agreementLockedAt ||
      errand.assigned_erander_id ||
      errand.assignedEranderId ||
      errand.assigned_erander ||
      errand.assignedErander ||
      errand.erander ||
      acceptedOffer
    ) {
      return true;
    }

    return ASSIGNED_STATUSES.includes(
      String(errand.status || "").toLowerCase().trim()
    );
  }, [errand, acceptedOffer]);

  const proposedTotal = Number(acceptedOffer?.proposed_total ?? 0);
  const estimatedTotal = Number(errand?.estimated_total ?? 0);

  const agreedTotal = Number(
    funding?.agreedTotal ?? acceptedOffer?.proposed_total ?? 0
  );

  const amountFunded = Number(funding?.amountFunded ?? 0);
  const amountDue = Number(funding?.amountDue ?? 0);

  const releaseRequest = release?.request ?? null;

  const activity = useMemo(
    () => getActivityItems(errand, acceptedOffer, release, ROLE),
    [errand, acceptedOffer, release]
  );

  const progressTimestamps = useMemo(
    () => getProgressTimestamps(errand, release),
    [errand, release]
  );

  /* ------------------------------------------------------------------------ */
  /*                                  ACTIONS                                 */
  /* ------------------------------------------------------------------------ */

  const handleEdit = useCallback(() => {
    if (errandId) navigate(ROUTES.edit(errandId));
  }, [navigate, errandId]);

  const handleViewOffers = useCallback(() => {
    if (errandId) navigate(ROUTES.offers(errandId));
  }, [navigate, errandId]);

  const handleChatErander = useCallback(async () => {
    const targetEranderId =
      assignedErander?.id ||
      errand?.assigned_erander_id ||
      errand?.assignedEranderId;

    if (targetEranderId) {
      await openChat({ errandId, eranderId: targetEranderId });
      return;
    }

    handleViewOffers();
  }, [
    assignedErander?.id,
    errand?.assigned_erander_id,
    errand?.assignedEranderId,
    errandId,
    openChat,
    handleViewOffers,
  ]);

  const handleChatPreference = useCallback(async () => {
    if (!errand?.id || chatPreferenceSaving) return;

    const current = errand.allow_erander_initiated_chat !== false;

    setChatPreferenceSaving(true);

    try {
      const result = await updateErrandChatPreference(
        errand.id,
        !current
      );

      setErrand((previous) => ({
        ...previous,
        allow_erander_initiated_chat:
          result?.data?.allowEranderInitiatedChat ?? !current,
      }));

      toast.success(
        !current
          ? "Eranders can now initiate a chat for this errand."
          : "New erander-initiated chats are turned off for this errand."
      );
    } catch (preferenceError) {
      toast.error(
        preferenceError?.message ||
          "Unable to update chat settings."
      );
    } finally {
      setChatPreferenceSaving(false);
    }
  }, [errand, chatPreferenceSaving]);

  
		
		const handleRaiseTicket = useCallback(() => {
  if (!errand?.id) {
    toast.error("Errand details are still loading. Please try again.");
    return;
  }

  const ticketContext = {
    errandId: errand.id,
    errand,
    offer: acceptedOffer,
  };

  if (typeof onRaiseTicket === "function") {
    onRaiseTicket(ticketContext);
    return;
  }

  setSupportErrand(errand);
  setSupportOpen(true);
}, [onRaiseTicket, errand, acceptedOffer]);
		
		
		
		
  const handleFundNow = useCallback(() => {
    if (typeof onFundNow === "function") {
      onFundNow({
        errandId,
        errand,
        offer: acceptedOffer,
        funding,
      });
      return;
    }

    if (!errand?.id) {
      toast.error("Errand details are still loading.");
      return;
    }

    setFundOpen(true);
  }, [onFundNow, errandId, errand, acceptedOffer, funding]);

  const handleCloseFund = useCallback(() => {
    setFundOpen(false);
  }, []);

  const handleCopy = async () => {
    await copyErrandId(errand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  /* ------------------------------------------------------------------------ */
  /*                              ACTION MENU                                */
  /* ------------------------------------------------------------------------ */

  const errandActionItems = useMemo(
    () => [
      {
        id: "view-offers",
        label: "View offers",
        description: "See eranders who have sent offers",
        icon: Users,
        onClick: handleViewOffers,
      },
      {
        id: "assign-trusted",
        label: "Assign to a trusted erander",
        description: "Send this errand to an erander you already trust",
        icon: UserCheck,
        onClick: () =>
          toast.info("Trusted erander assignment is coming soon."),
      },
      {
        id: "chat-erander",
        label:
          assignedErander?.id || errand?.assigned_erander_id
            ? "Message your erander"
            : "Message an offerer",
        description:
          assignedErander?.id || errand?.assigned_erander_id
            ? "Open the conversation for this errand"
            : "Choose an offerer to start an errand chat",
        icon: MessageCircle,
        onClick: handleChatErander,
      },
    ],
    [
      handleViewOffers,
      handleChatErander,
      assignedErander?.id,
      errand?.assigned_erander_id,
    ]
  );
		
		
		
		useEffect(() => {
  const eranderId = assignedErander?.id;

  if (!eranderId) {
    setIsFavoriteErander(false);
    return;
  }

  let active = true;

  const checkFavoriteStatus = async () => {
    setFavoriteLoading(true);

    try {
      const response = await getFavoriteErranders();

      const data = response?.data ?? response ?? {};
      const favorites = Array.isArray(data.favorites)
        ? data.favorites
        : [];

      const exists = favorites.some(
        (favorite) =>
          String(favorite.erander_id || favorite.id) ===
          String(eranderId)
      );

      if (active) {
        setIsFavoriteErander(exists);
      }
    } catch (favoriteError) {
      console.error(
        "Unable to check favorite erander status:",
        favoriteError
      );
    } finally {
      if (active) {
        setFavoriteLoading(false);
      }
    }
  };

  checkFavoriteStatus();

  return () => {
    active = false;
  };
}, [assignedErander?.id]);

const handleAddFavoriteErander = useCallback(async () => {
  const eranderId = assignedErander?.id;

  if (!eranderId || favoriteSaving || isFavoriteErander) {
    return;
  }

  setFavoriteSaving(true);

  try {
    await addFavoriteErander(eranderId);

    setIsFavoriteErander(true);

    toast.success(
      `${assignedErander.name || "Erander"} added to your favorites.`
    );
  } catch (favoriteError) {
    toast.error(
      favoriteError?.message ||
        "Unable to add this erander to your favorites."
    );
  } finally {
    setFavoriteSaving(false);
  }
}, [
  assignedErander,
  favoriteSaving,
  isFavoriteErander,
]);





  /* ------------------------------------------------------------------------ */
  /*                              LOADING STATE                               */
  /* ------------------------------------------------------------------------ */

  if (loading || (!errand && !error)) {
    return (
      <ErrandPage>
        <ErandDetailsSkeleton />
      </ErrandPage>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               ERROR STATE                                */
  /* ------------------------------------------------------------------------ */

  if (error && !errand) {
    return (
      <ErrandPage>
        <ErrandError
          message={error}
          onRetry={() => loadErrand()}
        />
      </ErrandPage>
    );
  }

  if (!errand) return null;

  /* ------------------------------------------------------------------------ */
  /*                              PAGE CONDITIONS                             */
  /* ------------------------------------------------------------------------ */

  const errandStatus = String(errand.status || "").toLowerCase();
  const releaseStatus = String(
    releaseRequest?.status || ""
  ).toLowerCase();

  const canFund = errandStatus === "awaiting_funding" && amountDue > 0;
  const canEdit = canEditErrand(errand);

  const hasErander = Boolean(
    assignedErander?.id || errand.assigned_erander_id
  );

  const chatAllowed =
    errand.allow_erander_initiated_chat !== false;

  const eranderName = assignedErander?.name || "";

  const releaseDecisionReason =
    releaseRequest?.decisionReason ||
    releaseRequest?.decision_reason ||
    releaseRequest?.rejectionReason ||
    releaseRequest?.rejection_reason ||
    "";

  const releaseFailureReason =
    releaseRequest?.failureReason ||
    releaseRequest?.failure_reason ||
    releaseRequest?.errorMessage ||
    releaseRequest?.error_message ||
    "";

  const subtitle =
    errandStatus === "disputed"
      ? "This errand is under dispute review. Contact support if you need help."
      : errandStatus === "completed"
        ? "The errand has been completed. Any remaining settlement or refund is handled under the platform's settlement rules."
        : errandStatus === "completion_submitted"
          ? "Your erander submitted the completed work for your review."
          : errandStatus === "in_progress"
            ? "Your erander is carrying out the errand."
            : releaseStatus === "released"
              ? "The payment provider confirmed that the execution funds were released to your erander."
              : releaseStatus === "rejected"
                ? "The previous fund-release request was rejected. Your erander can review the decision and submit another request."
                : releaseStatus === "failed"
                  ? "The previous fund transfer did not complete. Your erander can review the issue and retry the request."
                  : ["pending", "approved", "processing"].includes(releaseStatus)
                    ? releaseStatus === "pending"
                      ? "Your erander requested the execution funds. The request is awaiting review; no transfer has been confirmed."
                      : releaseStatus === "approved"
                        ? "The fund-release request was approved. The transfer is not confirmed until the payment provider reports success."
                        : "The execution-fund transfer is being processed by the payment provider."
                    : canFund
                      ? "Fund this errand so your erander can secure the errand and request the execution funds before starting work."
                      : errandStatus === "funded"
                        ? "Your errand is funded. Your erander must secure the required security deposit and request execution-fund release before starting work."
                        : isAssigned
                        ? "Your erander is assigned to this errand."
                        : "Review offers to choose an erander for this errand.";

  /* ------------------------------------------------------------------------ */
  /*                               NEXT STEP                                  */
  /* ------------------------------------------------------------------------ */

  let nextStep = null;

  if (ENDED_STATUSES.includes(errandStatus)) {
    nextStep = {
      icon: XCircle,
      tone: "neutral",
      title: `This errand was ${
        errandStatus === "canceled" ? "cancelled" : errandStatus
      }`,
      text: "It stays in your history. You can post a new errand any time.",
    };
  } else if (errandStatus === "disputed") {
    nextStep = {
      icon: AlertCircle,
      tone: "danger",
      title: "This errand is under dispute",
      text: "Use Get help to talk to support about it.",
    };
  } else if (errandStatus === "completed") {
    nextStep = {
      icon: CheckCircle2,
      tone: "success",
      title: "Errand completed",
      text: "Completion has been confirmed. Any remaining settlement or refund is handled under the platform's settlement rules.",
    };
  } else if (errandStatus === "completion_submitted") {
    nextStep = {
      icon: CheckCircle2,
      tone: "attention",
      title: "Your erander says the work is done",
      text: "Review the submitted work and evidence. Execution-fund release is a separate earlier step; final settlement follows the completion and review process.",
    };
  } else if (errandStatus === "in_progress") {
    nextStep = {
      icon: ShieldCheck,
      tone: "success",
      title: "Your erander is carrying out the errand",
      text: "Follow the progress below, or message your erander if you have questions.",
    };
  } else if (releaseStatus === "released") {
    nextStep = {
      icon: CheckCircle2,
      tone: "success",
      title: "Execution funds released",
      text: "The payment provider confirmed the transfer to your erander. This is separate from the errand's completion review and final settlement.",
    };
  } else if (releaseStatus === "rejected") {
    nextStep = {
      icon: AlertCircle,
      tone: "danger",
      title: "The fund-release request was rejected",
      text: releaseDecisionReason ||
        "Your erander can review the decision and submit a new request. You do not need to fund the errand again unless the agreed funding changes.",
    };
  } else if (releaseStatus === "failed") {
    nextStep = {
      icon: RefreshCw,
      tone: "attention",
      title: "The fund transfer failed",
      text: releaseFailureReason ||
        "The previous transfer did not complete. Your erander can review the issue and retry the fund-release request.",
    };
  } else if (["pending", "approved", "processing"].includes(releaseStatus)) {
    const releaseMessages = {
      pending: {
        title: "Fund-release request awaiting review",
        text: "Your erander requested the execution funds. The request is being reviewed; no transfer has been confirmed yet.",
      },
      approved: {
        title: "Fund-release request approved",
        text: "The request was approved, but approval is not payment confirmation. The transfer must still be confirmed by the payment provider.",
      },
      processing: {
        title: "Execution-fund transfer processing",
        text: "The payment provider is processing the transfer. It will be marked released only after confirmation.",
      },
    };
    nextStep = {
      icon: Hourglass,
      tone: "attention",
      ...releaseMessages[releaseStatus],
    };
  } else if (canFund) {
    nextStep = {
      icon: Wallet,
      tone: "attention",
      title: "Fund this errand to get it started",
      text: `Pay ${formatCurrency(amountDue, currency)} so ${
        eranderName || "your erander"
      } can proceed.`,
      action: {
        label: "Fund errand",
        icon: Wallet,
        onClick: handleFundNow,
      },
    };
  } else if (errandStatus === "funded") {
    nextStep = {
      icon: ShieldCheck,
      tone: "success",
      title: "Errand funded",
      text: "The customer funding is confirmed. Your erander must secure the required security deposit and obtain execution-fund release before starting the work.",
    };
  } else if (isAssigned) {
    nextStep = {
      icon: UserCheck,
      tone: "success",
      title: "You chose an erander",
      text: "Follow the progress below. Funding comes next.",
    };
  } else {
    nextStep = {
      icon: Inbox,
      tone: "attention",
      title: "Choose an erander",
      text: "Review the offers you've received and pick the one that suits you.",
      action: {
        label: "View offers",
        icon: Users,
        onClick: handleViewOffers,
      },
    };
  }
  /* ------------------------------------------------------------------------ */
  /*                              ERANDER STAT                                */
  /* ------------------------------------------------------------------------ */

  const eranderStat = eranderName ? (
    assignedErander.profileTo ? (
					<div>
      <Link
        to={assignedErander.profileTo}
        className="inline-flex min-w-0 items-center gap-2 rounded-lg text-brand transition hover:text-success-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <UserRound
          size={15}
          className="shrink-0"
          aria-hidden="true"
        />

        <span className="min-w-0 truncate underline decoration-line-strong underline-offset-4">
          {eranderName}
        </span>
      </Link>
						
						
						

						
						
						
						
						
						
						<button
  type="button"
  onClick={handleAddFavoriteErander}
  disabled={
    isFavoriteErander ||
    favoriteSaving ||
    favoriteLoading
  }
  aria-label={
    isFavoriteErander
      ? "Erander is already in your favorites"
      : "Add erander to favorites"
  }
  title={
    isFavoriteErander
      ? "Already in your favorites"
      : "Add to favorites"
  }
  className={`inline-flex min-h-6 shrink-0 items-center justify-center gap-1.5 rounded-lg border mx-6 mt-2 px-2.5 text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
    isFavoriteErander
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-line bg-surface-white text-content-muted hover:border-brand/30 hover:bg-surface-muted hover:text-brand"
  }`}
>
  {favoriteSaving || favoriteLoading ? (
    <Loader2
      size={14}
      className="animate-spin"
      aria-hidden="true"
    />
  ) : isFavoriteErander ? (
    <CheckCircle2
      size={14}
      aria-hidden="true"
    />
  ) : (
    <Plus
      size={14}
      aria-hidden="true"
    />
  )}

  <span>
    {favoriteSaving
      ? "Adding..."
      : favoriteLoading
        ? "Checking..."
        : isFavoriteErander
          ? "Favorited"
          : "Favorite"}
  </span>
</button>
						
						
						
						
						
						
						
						
						
						
						
						
						
						</div>
    ) : (
      <>
        <Check
          size={15}
          className="shrink-0 text-success-dark"
          strokeWidth={3}
          aria-hidden="true"
        />

        <span className="min-w-0 truncate">{eranderName}</span>
      </>
    )
  ) : isAssigned ? (
    <>
      <Check
        size={15}
        className="shrink-0 text-success-dark"
        strokeWidth={3}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">Assigned</span>
    </>
  ) : (
    <ActionMenu
      items={errandActionItems}
      ariaLabel="Take action"
      placement="top"
      align="end"
      menuWidth={280}
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Users size={14} aria-hidden="true" />
          Take action
        </button>
      }
    />
  );

  /* ------------------------------------------------------------------------ */
  /*                                  STATS                                   */
  /* ------------------------------------------------------------------------ */

  const stats = [
    {
      label: "Agreed total",
      value:
        agreedTotal > 0
          ? formatCurrency(agreedTotal, currency)
          : "Not agreed yet",
    },
    {
      label: "Funded",
      value: formatCurrency(amountFunded, currency),
      progress: getFundedPercent(amountFunded, agreedTotal),
    },
    {
      label: "Still to fund",
      value: formatCurrency(amountDue, currency),
    },
    {
      label: "Your erander",
      value: eranderStat,
    },
  ];

  /* ------------------------------------------------------------------------ */
  /*                                   TABS                                   */
  /* ------------------------------------------------------------------------ */

  const categoryWorkspaceTabLabel = ({
    shopping: "Shopping details",
    delivery: "Delivery details",
    confidential: "Confidential details",
    home_help: "Task details",
    business_support: "Business details",
  })[String(errand?.category || "").toLowerCase()] || "Errand details";

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "task", label: categoryWorkspaceTabLabel },
    {
      value: "items",
      label: "Items",
      count: originalItems.length,
    },
    { value: "proposal", label: "Accepted offer" },
    { value: "payments", label: "Payments" },
    {
      value: "activity",
      label: "Activity",
      count: activity.length,
    },
  ];

  /* ------------------------------------------------------------------------ */
  /*                                  SIDEBAR                                */
  /* ------------------------------------------------------------------------ */

  const sidebar = (
    <>
      <PersonCard
        role={ROLE}
        person={assignedErander}
        missing={isAssigned && !assignedErander}
        footer={
          acceptedOffer?.responded_at
            ? `You accepted this offer on ${formatDateTime(
                acceptedOffer.responded_at
              )}`
            : null
        }
      />

      {isAssigned ? (
        <section className="rounded-2xl border border-line bg-surface-white p-4 shadow-erander-card">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-content">
                Erander security deposit
              </h3>
              <p className="mt-1 text-xs leading-5 text-content-muted">
                {securityDepositStatus === "secured"
                  ? "The required security deposit for this errand has been confirmed."
                  : securityDepositStatus === "processing"
                    ? "The security-deposit reservation is being processed."
                    : securityDepositStatus === "unsuccessful"
                      ? "The required security deposit has not been successfully verified."
                      : securityDepositStatus === "not_secured"
                        ? "The required security deposit has not yet been secured."
                        : "Security-deposit status is temporarily unavailable. Please refresh to check again."}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  securityDepositStatus === "secured"
                    ? "bg-emerald-50 text-emerald-700"
                    : securityDepositStatus === "processing"
                      ? "bg-amber-50 text-amber-700"
                      : securityDepositStatus === "unable_to_verify"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-rose-50 text-rose-700"
                }`}
              >
                {securityDepositStatus === "secured"
                  ? "Secured"
                  : securityDepositStatus === "processing"
                    ? "Processing"
                    : securityDepositStatus === "unsuccessful"
                      ? "Unsuccessful"
                      : securityDepositStatus === "not_secured"
                        ? "Not yet secured"
                        : "Unable to verify"}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <PriceCard
        role={ROLE}
        offer={acceptedOffer}
        total={proposedTotal}
        currency={currency}
        funded={funding ? amountFunded : undefined}
        due={funding ? amountDue : undefined}
      />

      <SupportCard
        role={ROLE}
        onRaiseTicket={handleRaiseTicket}
      />
    </>
  );

  /* ------------------------------------------------------------------------ */
  /*                              HEADER ACTIONS                              */
  /* ------------------------------------------------------------------------ */

  const headerActions =
    hasErander || canEdit ? (
      <>
        {hasErander ? (
          <button
            type="button"
            onClick={handleChatErander}
            className={BTN_GREEN}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Message erander
          </button>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            onClick={handleEdit}
            className={BTN_GHOST}
          >
            <Pencil size={16} aria-hidden="true" />
            Edit errand
          </button>
        ) : null}
      </>
    ) : null;

  /* ------------------------------------------------------------------------ */
  /*                                PAGE RENDER                               */
  /* ------------------------------------------------------------------------ */

  return (
    <ErrandPage>
      <div className="space-y-5">
        <ErrandHeaderCard
          errand={errand}
          subtitle={subtitle}
          stats={stats}
          actions={headerActions}
          copied={copied}
          refreshing={refreshing}
          onCopy={handleCopy}
          onRefresh={() => loadErrand({ silent: true })}
          onHelp={handleRaiseTicket}
        />

        {error ? <SoftNotice>{error}</SoftNotice> : null}

        <NextStepCard step={nextStep} />

        <ProgressTracker
          errand={errand}
          payment={funding}
          fundRelease={release}
          timestamps={progressTimestamps}
          showAssignedErander
          viewerRole="customer"
        />

        <ErrandCompletionActions
          errand={errand}
          role="customer"
          releaseStatus={String(release?.request?.status || "").toLowerCase()}
          onOpenChat={handleChatErander}
          onRaiseIssue={handleRaiseTicket}
          onUpdated={() => loadErrand({ silent: true })}
        />

        {errand?.assigned_erander_id || errand?.assignedEranderId || errand?.assigned_erander?.id ? (
          <ErrandChatExecutionGuide
            errand={errand}
            role="customer"
            onOpenChat={handleChatErander}
          />
        ) : null}

        <ChatPermissionCard
          allowed={chatAllowed}
          saving={chatPreferenceSaving}
          onToggle={handleChatPreference}
        />

        <FundErrandModal
          open={fundOpen}
          errand={errand}
          onClose={handleCloseFund}
          onGetFundingSummary={getErrandFundingSummary}
          onInitializePayment={initializePayment}
        />

        <ErrandLayout
          tabs={tabs}
          tab={tab}
          onTab={setTab}
          sidebar={sidebar}
        >
          {tab === "overview" ? (
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
          ) : null}

          {tab === "task" ? (
            <CustomerCategoryWorkspace errand={errand} />
          ) : null}

          {tab === "items" ? (
            <ItemsSection
              items={originalItems}
              offerItems={offerItems}
              currency={currency}
              errand={errand}
              role={ROLE}
              estimatedTotal={estimatedTotal}
            />
          ) : null}

          {tab === "proposal" ? (
            <>
              <ProposalSection
                offer={acceptedOffer}
                originalItems={originalItems}
                originalItemEstimate={originalItemEstimate}
                currency={currency}
                role={ROLE}
              />

              {acceptedOffer ? (
                <BudgetMonitor
                  budget={estimatedTotal}
                  approvedTotal={agreedTotal}
                  currency={currency}
                />
              ) : null}
            </>
          ) : null}

          {tab === "payments" ? (
            <>
              <FundingSection
                funding={funding}
                currency={currency}
                role={ROLE}
              />

              <FundReleaseSection
                role={ROLE}
                request={releaseRequest}
                events={release?.events ?? []}
                loading={releaseLoading}
                onRefresh={refreshRelease}
              />
            </>
          ) : null}

          {tab === "activity" ? (
            <ActivitySection activity={activity} />
          ) : null}
        </ErrandLayout>
      </div>
						
						
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