import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  Clock3,
  MessageCircle,
  Pencil,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import ActionMenu from "@/components/ActionMenu";
import { getErrandById } from "@/services/errands/errandsApi";
import { getOffersForErrand } from "@/services/offers/offersApi";
import {
  getErrandFundingSummary,
  getFundReleaseRequest,
  initializePayment,
} from "@/services/payments/paymentsApi";

import ProgressTracker from "../../shared/ProgressTracker";
import { BudgetMonitor } from "../../shared/ErrandTools";
import {
  ActionBanner,
  ActivitySection,
  BackButton,
  EMPTY_RELEASE,
  ErrandError,
  ErrandHeader,
  ErrandLayout,
  ErrandLoading,
  ErrandPage,
  FundingSection,
  FundReleaseSection,
  InformationSection,
  ItemsSection,
  OverviewSection,
  PartialErrorNotice,
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
} from "../../shared/ErrandView";

import FundErrandModal from "../FundErrandModal";

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

export default function ErandDetails({
  errandId: suppliedErrandId,
  onFundNow,
  onRaiseTicket,
}) {
  const params = useParams();
  const navigate = useNavigate();

  const errandId =
    suppliedErrandId || params.errandId || params.erandId || params.id;

  const [errand, setErrand] = useState(null);
  const [acceptedOffer, setAcceptedOffer] = useState(null);
  const [funding, setFunding] = useState(null);
  const [release, setRelease] = useState(EMPTY_RELEASE);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("overview");
  const [fundOpen, setFundOpen] = useState(false);

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

        setErrand(errandData);

        const [offersResult, fundingResult, releaseResult] =
          await Promise.allSettled([
            getOffersForErrand(errandId),
            getErrandFundingSummary(errandId),
            getFundReleaseRequest(errandId),
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
          console.error("Unable to retrieve errand offers:", offersResult.reason);
        }

        setAcceptedOffer(selectedOffer);

        if (fundingResult.status === "fulfilled") {
          setFunding(unwrapFundingResponse(fundingResult.value));
        } else {
          setFunding(null);
          console.error(
            "Unable to retrieve errand funding summary:",
            fundingResult.reason
          );
        }

        if (releaseResult.status === "fulfilled") {
          setRelease(unwrapReleaseResponse(releaseResult.value));
        } else {
          setRelease(EMPTY_RELEASE);
          console.error(
            "Unable to retrieve fund-release information:",
            releaseResult.reason
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
        refreshError?.message || "Unable to refresh the fund-release status."
      );
    } finally {
      setReleaseLoading(false);
    }
  }, [errandId]);

  useEffect(() => {
    loadErrand();
  }, [loadErrand]);

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
          Number(item.quantity ?? 1) * Number(item.estimated_unit_price ?? 0),
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

  const handleEdit = useCallback(() => {
    if (errandId) navigate(ROUTES.edit(errandId));
  }, [navigate, errandId]);

  const handleViewOffers = useCallback(() => {
    if (errandId) navigate(ROUTES.offers(errandId));
  }, [navigate, errandId]);

  const handleRaiseTicket = useCallback(() => {
    if (typeof onRaiseTicket === "function") {
      onRaiseTicket({ errandId, errand, offer: acceptedOffer });
      return;
    }

    toast.info("Ticket support is not connected on this page yet.");
  }, [onRaiseTicket, errandId, errand, acceptedOffer]);

  const handleFundNow = useCallback(() => {
    // A parent can still override the built-in checkout.
    if (typeof onFundNow === "function") {
      onFundNow({ errandId, errand, offer: acceptedOffer, funding });
      return;
    }

    if (!errand?.id) {
      toast.error("Errand details are still loading.");
      return;
    }

    setFundOpen(true);
  }, [onFundNow, errandId, errand, acceptedOffer, funding]);

  const handleCloseFund = useCallback(() => setFundOpen(false), []);

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
        onClick: () => toast.info("Coming soon."),
      },
      {
        id: "chat-erander",
        label: "Chat any erander",
        description: "Message any erander about this errand",
        icon: MessageCircle,
        onClick: () => toast.info("Coming soon."),
      },
    ],
    [handleViewOffers]
  );

  if (loading) {
    return (
      <ErrandPage>
        <ErrandLoading />
      </ErrandPage>
    );
  }

  if (error && !errand) {
    return (
      <ErrandPage>
        <BackButton onClick={() => navigate(-1)} label="Back" />
        <ErrandError message={error} onRetry={() => loadErrand()} />
      </ErrandPage>
    );
  }

  if (!errand) return null;

  const canFund = errand.status === "awaiting_funding" && amountDue > 0;
  const canEdit = canEditErrand(errand);

  const eranderName = assignedErander?.name || "";

  const subtitle =
    releaseRequest?.status === "released"
      ? "The funds have been released to your erander."
      : releaseRequest
        ? "Your erander has requested the release of funds."
        : canFund
          ? "Fund this errand so your erander can get started."
          : isAssigned
            ? "Your erander is assigned to this errand."
            : "Review offers to choose an erander for this errand.";

  const eranderStat = eranderName ? (
    assignedErander.profileTo ? (
      <Link
        to={assignedErander.profileTo}
        className="group inline-flex min-w-0 items-center gap-2 rounded-full text-brand-mint transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
      >
        <UserRound
          className="h-4 w-4 shrink-0"
          strokeWidth={3}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate underline decoration-white/30 underline-offset-4 group-hover:decoration-brand-mint">
          {eranderName}
        </span>
      </Link>
    ) : (
      <>
        <Check
          className="h-4 w-4 shrink-0 text-brand-mint"
          strokeWidth={3}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{eranderName}</span>
      </>
    )
  ) : isAssigned ? (
    <>
      <Check
        className="h-4 w-4 shrink-0 text-brand-mint"
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
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          Take action
        </button>
      }
    />
  );

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
      tone: "mint",
      progress: getFundedPercent(amountFunded, agreedTotal),
    },
    {
      label: "Still to fund",
      value: formatCurrency(amountDue, currency),
    },
    { label: "Your erander", value: eranderStat },
  ];

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "items", label: "Items", count: originalItems.length },
    { value: "proposal", label: "Accepted offer" },
    { value: "payments", label: "Payments" },
    { value: "activity", label: "Activity", count: activity.length },
  ];

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

      <PriceCard
        role={ROLE}
        offer={acceptedOffer}
        total={proposedTotal}
        currency={currency}
        funded={funding ? amountFunded : undefined}
        due={funding ? amountDue : undefined}
      />

      <SupportCard role={ROLE} onRaiseTicket={handleRaiseTicket} />
    </>
  );

  return (
    <ErrandPage>
      <BackButton onClick={() => navigate(-1)} label="Back" />

      <ErrandHeader
        errand={errand}
        subtitle={subtitle}
        stats={stats}
        onCopyId={() => copyErrandId(errand)}
        onRefresh={() => loadErrand({ silent: true })}
        refreshing={refreshing}
        onRaiseTicket={handleRaiseTicket}
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit errand
            </button>
          ) : null
        }
      />

      <PartialErrorNotice message={error} />

      {canFund ? (
        <ActionBanner
          icon={Clock3}
          title="Fund this errand to get it started"
          description={`Pay ${formatCurrency(amountDue, currency)} so ${
            eranderName || "your erander"
          } can proceed.`}
          actionLabel="Fund errand"
          onAction={handleFundNow}
        />
      ) : null}

      <FundErrandModal
        open={fundOpen}
        errand={errand}
        onClose={handleCloseFund}
        onGetFundingSummary={getErrandFundingSummary}
        onInitializePayment={initializePayment}
      />

      <ProgressTracker
        errand={errand}
        payment={funding}
        fundRelease={release}
        timestamps={progressTimestamps}
        showAssignedErander
        viewerRole="customer"
      />

      <ErrandLayout tabs={tabs} tab={tab} onTab={setTab} sidebar={sidebar}>
        {tab === "overview" ? (
          <>
            <OverviewSection errand={errand} currency={currency} role={ROLE} />
            <InformationSection errand={errand} role={ROLE} />
          </>
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
            <FundingSection funding={funding} currency={currency} role={ROLE} />

            <FundReleaseSection
              role={ROLE}
              request={releaseRequest}
              events={release?.events ?? []}
              loading={releaseLoading}
              onRefresh={refreshRelease}
            />
          </>
        ) : null}

        {tab === "activity" ? <ActivitySection activity={activity} /> : null}
      </ErrandLayout>
    </ErrandPage>
  );
}