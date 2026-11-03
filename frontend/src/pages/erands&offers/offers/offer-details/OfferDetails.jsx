import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { getErrandById } from "@/services/errands/errandsApi";
import { getMyErandOffers } from "@/services/offers/offersApi";
import {
  getErrandFundingSummary,
  getFundReleaseRequest,
  requestFundRelease,
} from "@/services/payments/paymentsApi";

import ProgressTracker from "../../shared/ProgressTracker";
import StatusBadge from "../../shared/StatusBadge";
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
  InfoCard,
  ItemsSection,
  OverviewSection,
  PartialErrorNotice,
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

const ROLE = "erander";

export default function OfferDetails({ onRaiseTicket }) {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const [errand, setErrand] = useState(null);
  const [myOffer, setMyOffer] = useState(null);
  const [funding, setFunding] = useState(null);
  const [release, setRelease] = useState(EMPTY_RELEASE);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("overview");

  const loadErrand = useCallback(
    async ({ silent = false } = {}) => {
      if (!offerId) {
        setError("The offer ID is missing from the page URL.");
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

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

        const errandId = selectedOffer.erand_id || selectedOffer.errand?.id;

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

        const [fundingResult, releaseResult] = await Promise.allSettled([
          getErrandFundingSummary(errandId),
          getFundReleaseRequest(errandId),
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
        refreshError?.message || "Unable to refresh the fund-release status."
      );
    } finally {
      setReleaseLoading(false);
    }
  }, [errand?.id]);

  useEffect(() => {
    loadErrand();
  }, [loadErrand]);

  const handleRequestRelease = async () => {
    if (!errand?.id || submittingRelease) return;

    const confirmed = window.confirm(
      "Submit a request for the release of funds for this errand?"
    );

    if (!confirmed) return;

    setSubmittingRelease(true);

    try {
      const result = await requestFundRelease(errand.id);

      setRelease((previous) => ({ ...previous, request: result.request }));

      toast.success(
        result.existing
          ? "An existing fund-release request was found."
          : result.message || "Fund-release request submitted."
      );

      await refreshRelease();
    } catch (requestError) {
      toast.error(
        requestError?.message || "Unable to submit the fund-release request."
      );
    } finally {
      setSubmittingRelease(false);
    }
  };

  const handleRaiseTicket = useCallback(() => {
    if (typeof onRaiseTicket === "function") {
      onRaiseTicket({ errandId: errand?.id, errand, offer: myOffer });
      return;
    }

    toast.info("Ticket support is not connected on this page yet.");
  }, [onRaiseTicket, errand, myOffer]);

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
          Number(item.quantity ?? 1) * Number(item.estimated_unit_price ?? 0),
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

  const isAccepted =
    String(myOffer?.status || "").toLowerCase() === "accepted";

  const errandStatus = String(errand.status || "").toLowerCase();
  const releaseRequest = release?.request ?? null;
  const releaseStatus = releaseRequest?.status;

  const canRequestRelease = errandStatus === "funded" && !releaseRequest;

  const proposedTotal = Number(myOffer?.proposed_total ?? 0);
  const estimatedTotal = Number(errand.estimated_total ?? 0);

  const agreedTotal = Number(
    funding?.agreedTotal ?? (isAccepted ? proposedTotal : 0)
  );

  const amountFunded = Number(funding?.amountFunded ?? 0);
  const amountDue = Number(funding?.amountDue ?? 0);

  const subtitle =
    String(releaseStatus || "").toLowerCase() === "released"
      ? "The payment provider has confirmed the release of your funds."
      : errandStatus === "funded"
        ? canRequestRelease
          ? "The errand is funded. You can request the release of funds."
          : "Your fund-release request is in progress."
        : isAccepted
          ? "The customer accepted your offer. Funding comes next."
          : "Waiting for the customer to respond to your offer.";

  const stats = [
    {
      label: isAccepted ? "Agreed total" : "Your offer",
      value:
        (isAccepted ? agreedTotal : proposedTotal) > 0
          ? formatCurrency(isAccepted ? agreedTotal : proposedTotal, currency)
          : "Not found",
    },
    {
      label: "Funded",
      value: funding ? formatCurrency(amountFunded, currency) : "Unavailable",
      tone: "mint",
      progress: getFundedPercent(amountFunded, agreedTotal),
    },
    {
      label: "Still to fund",
      value: funding ? formatCurrency(amountDue, currency) : "Unavailable",
    },
    {
      label: "Fund release",
      value: releaseStatus ? (
        <span className="inline-flex rounded-full bg-white p-0.5">
          <StatusBadge status={releaseStatus} />
        </span>
      ) : (
        "Not requested"
      ),
    },
  ];

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "items", label: "Items", count: originalItems.length },
    { value: "proposal", label: "Your offer" },
    { value: "payments", label: "Payments" },
    { value: "activity", label: "Activity", count: activity.length },
  ];

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

      <SupportCard role={ROLE} onRaiseTicket={handleRaiseTicket} />

      <InfoCard title="How fund release works">
        <p>
          Requesting a release does not move money straight away. Your request
          is reviewed first, then paid out.
        </p>
        <p>
          It only shows as released after the payment provider confirms a
          successful transfer.
        </p>
      </InfoCard>
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
      />

      <PartialErrorNotice message={error} />

      {canRequestRelease ? (
        <ActionBanner
          icon={Send}
          title="Request your funds"
          description="This errand is funded. Ask for the release of your money. The request is reviewed before any transfer starts."
          actionLabel="Request fund release"
          busyLabel="Submitting request"
          busy={submittingRelease}
          onAction={handleRequestRelease}
          actionIcon={Send}
        />
      ) : null}

      <ProgressTracker
        errand={errand}
        payment={funding}
        fundRelease={release}
        timestamps={progressTimestamps}
        showAssignedErander={false}
        viewerRole="erander"
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
          <ProposalSection
            offer={myOffer}
            originalItems={originalItems}
            originalItemEstimate={originalItemEstimate}
            currency={currency}
            role={ROLE}
          />
        ) : null}

        {tab === "payments" ? (
          <>
            <FundingSection funding={funding} currency={currency} role={ROLE} />

            <FundReleaseSection
              role={ROLE}
              request={releaseRequest}
              events={release?.events ?? []}
              canRequest={canRequestRelease}
              submitting={submittingRelease}
              loading={releaseLoading}
              onRequest={handleRequestRelease}
              onRefresh={refreshRelease}
            />
          </>
        ) : null}

        {tab === "activity" ? <ActivitySection activity={activity} /> : null}
      </ErrandLayout>
    </ErrandPage>
  );
}
