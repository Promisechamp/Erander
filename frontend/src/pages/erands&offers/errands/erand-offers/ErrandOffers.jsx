import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/contexts/ChatContext";

import Modal from "@/components/Modal";
import Select from "@/components/Select";

import { getErrandById } from "@/services/errands/errandsApi";
import {
  acceptErandOffer,
  getOffersForErrand,
} from "@/services/offers/offersApi";

import { formatMoney } from "../../shared/ErrandTools";

import {
  MAX_COMPARE,
  PAGE_SIZE,
  SORT_OPTIONS,
  secondaryButtonClass,
  extractOffersFromResponse,
  getExtraFees,
  getName,
  getOfferStatus,
  getOfferTime,
  getProposalTotal,
  unwrapErrand,
} from "./offerUtils";

import {
  PageShell,
  OfferViewToggle,
  ErrandActionsMenu,
  MessagePanel,
  OfferCard,
  OffersTable,
  CompareBar,
  OffersLoadingState,
} from "./OfferViews";

import CompareModal from "./CompareModal";
import ReviewModal from "./ReviewModal";

/* -------------------------------------------------------
   MAIN PAGE
------------------------------------------------------- */

export default function ErandOffers({
  erandId: providedErandId,
  currency: currencyProp = "NGN",
  onAccepted,
  onGoBack,
  originalItems: providedItems = [],
  estimatedTotal,
}) {
  const navigate = useNavigate();
  const { openChat } = useChat();

  const { errandId: routeErrandId } = useParams();

  const erandId = providedErandId || routeErrandId;

  const [offers, setOffers] = useState([]);
  const [errand, setErrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("cards");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("price_low");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [reviewOffer, setReviewOffer] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const requestSequenceRef = useRef(0);

  /* -----------------------------------------------------
     FETCH OFFERS + ERRAND
  ----------------------------------------------------- */

  const loadOffers = useCallback(
    async ({ showLoader = true } = {}) => {
      if (
        erandId === undefined ||
        erandId === null ||
        String(erandId).trim() === ""
      ) {
        setOffers([]);
        setLoading(false);
        setLoadError("An errand ID was not provided.");
        return false;
      }

      const requestSequence = ++requestSequenceRef.current;

      if (showLoader) {
        setLoading(true);
      }

      setLoadError("");

      try {
        const [offersResult, errandResult] =
          await Promise.allSettled([
            getOffersForErrand(erandId),
            getErrandById(erandId),
          ]);

        if (requestSequence !== requestSequenceRef.current) {
          return false;
        }

        if (offersResult.status === "rejected") {
          throw offersResult.reason;
        }

        const fetchedOffers = extractOffersFromResponse(
          offersResult.value
        );

        setOffers(fetchedOffers);

        if (errandResult.status === "fulfilled") {
          setErrand(unwrapErrand(errandResult.value));
        } else {
          console.error(
            "Unable to fetch the errand:",
            errandResult.reason
          );
        }

        setVisibleCount(PAGE_SIZE);

        return true;
      } catch (error) {
        if (requestSequence !== requestSequenceRef.current) {
          return false;
        }

        console.error(
          "Unable to fetch offers for errand:",
          error
        );

        setLoadError(
          error?.response?.data?.message ||
            error?.message ||
            "We couldn't retrieve the offers for this errand."
        );

        return false;
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [erandId]
  );

  useEffect(() => {
    loadOffers();

    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadOffers]);

  /* -----------------------------------------------------
     DERIVED ERRAND DATA
  ----------------------------------------------------- */

  const currency = errand?.currency_code || currencyProp;

  const originalItems = useMemo(() => {
    if (providedItems.length > 0) {
      return providedItems;
    }

    return Array.isArray(errand?.items)
      ? errand.items
      : [];
  }, [providedItems, errand?.items]);

  const estimate = useMemo(() => {
    const provided = Number(estimatedTotal);

    if (Number.isFinite(provided) && provided > 0) {
      return provided;
    }

    const budget = Number(errand?.estimated_total);

    if (Number.isFinite(budget) && budget > 0) {
      return budget;
    }

    return originalItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity ?? 1) *
          Number(item.estimated_unit_price ?? 0),
      0
    );
  }, [
    estimatedTotal,
    errand?.estimated_total,
    originalItems,
  ]);

  const hasEstimate = estimate > 0;

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.filter(
        (option) =>
          option.value !== "closest" || hasEstimate
      ),
    [hasEstimate]
  );

  const activeSort =
    sort === "closest" && !hasEstimate
      ? "price_low"
      : sort;

  /* -----------------------------------------------------
     OFFER COLLECTIONS

     offers:
       Every offer returned by the backend.

     availableOffers:
       Only offers that are still pending and can be
       reviewed, accepted or compared.
  ----------------------------------------------------- */

  const availableOffers = useMemo(
    () =>
      offers.filter(
        (offer) => getOfferStatus(offer) === "pending"
      ),
    [offers]
  );

  const pendingCount = availableOffers.length;
  const totalOfferCount = offers.length;

  /* -----------------------------------------------------
     PRICE STATISTICS

     Only pending offers are included in decision
     statistics. Closed offers remain in the history.
  ----------------------------------------------------- */

  const lowestId = useMemo(() => {
    let lowest = null;

    availableOffers.forEach((offer) => {
      const total = getProposalTotal(offer);

      if (total === null) return;

      if (lowest === null || total < lowest.total) {
        lowest = {
          id: offer.id,
          total,
        };
      }
    });

    return availableOffers.length > 1
      ? lowest?.id ?? null
      : null;
  }, [availableOffers]);

  const latestId = useMemo(() => {
    if (availableOffers.length < 2) {
      return null;
    }

    return [...availableOffers].sort(
      (first, second) =>
        getOfferTime(second) - getOfferTime(first)
    )[0]?.id;
  }, [availableOffers]);

  const stats = useMemo(() => {
    const totals = availableOffers
      .map(getProposalTotal)
      .filter((value) => value !== null);

    if (!totals.length) {
      return null;
    }

    return {
      lowest: Math.min(...totals),
      highest: Math.max(...totals),
      average:
        totals.reduce((sum, value) => sum + value, 0) /
        totals.length,
    };
  }, [availableOffers]);

  /* -----------------------------------------------------
     SEARCH + SORT

     The full offer collection is used here. This is
     important because closed offers must remain visible.
  ----------------------------------------------------- */

  const visibleOffers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = term
      ? offers.filter((offer) =>
          getName(offer).toLowerCase().includes(term)
        )
      : offers;

    const priceOf = (offer) =>
      getProposalTotal(offer) ?? Number.POSITIVE_INFINITY;

    const statusPriority = (offer) => {
      const status = getOfferStatus(offer);

      if (status === "pending") return 0;
      if (status === "accepted") return 1;
      if (status === "superseded") return 2;

      return 3;
    };

    return [...filtered].sort((first, second) => {
      const priorityDifference =
        statusPriority(first) - statusPriority(second);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      switch (activeSort) {
        case "price_high":
          return (
            (getProposalTotal(second) ?? -1) -
            (getProposalTotal(first) ?? -1)
          );

        case "fees_low":
          return (
            getExtraFees(first) - getExtraFees(second)
          );

        case "closest":
          return (
            Math.abs(priceOf(first) - estimate) -
            Math.abs(priceOf(second) - estimate)
          );

        case "newest":
          return (
            getOfferTime(second) - getOfferTime(first)
          );

        case "price_low":
        default:
          return priceOf(first) - priceOf(second);
      }
    });
  }, [offers, search, activeSort, estimate]);

  const shownOffers = visibleOffers.slice(0, visibleCount);

  const remainingCount =
    visibleOffers.length - shownOffers.length;

  /* -----------------------------------------------------
     COMPARE DATA

     Only pending offers can enter comparison.
  ----------------------------------------------------- */

  const compareOffers = useMemo(
    () =>
      compareIds
        .map((id) =>
          availableOffers.find(
            (offer) => String(offer.id) === String(id)
          )
        )
        .filter(Boolean),
    [compareIds, availableOffers]
  );

  /* Remove offers from comparison if they are no longer
     pending after a refresh. */

  useEffect(() => {
    const pendingIds = new Set(
      availableOffers.map((offer) => String(offer.id))
    );

    setCompareIds((current) =>
      current.filter((id) =>
        pendingIds.has(String(id))
      )
    );
  }, [availableOffers]);

  /* -----------------------------------------------------
     ACTIONS
  ----------------------------------------------------- */

  const handleOpenChat = useCallback(
    (offer) => {
      if (!offer?.offered_by || !erandId) {
        toast.error(
          "The erander details are not available for chat."
        );
        return;
      }

      openChat({
        errandId: erandId,
        eranderId: offer.offered_by,
      });
    },
    [openChat, erandId]
  );

  const handleGoBack = useCallback(() => {
    if (typeof onGoBack === "function") {
      onGoBack();
      return;
    }

    navigate(-1);
  }, [onGoBack, navigate]);

  const toggleCompare = useCallback(
    (id) => {
      setCompareIds((current) => {
        const alreadySelected = current.some(
          (item) => String(item) === String(id)
        );

        if (alreadySelected) {
          return current.filter(
            (item) => String(item) !== String(id)
          );
        }

        if (current.length >= MAX_COMPARE) {
          return current;
        }

        const isPending = availableOffers.some(
          (offer) => String(offer.id) === String(id)
        );

        if (!isPending) {
          return current;
        }

        return [...current, id];
      });
    },
    [availableOffers]
  );

  /* -----------------------------------------------------
     ACCEPT OFFER

     The accepted offer and superseded offers are updated
     locally immediately, then synchronized with the
     backend. This prevents the history from disappearing
     if the follow-up refresh fails.
  ----------------------------------------------------- */

  const handleAccept = async () => {
    if (!selectedOffer?.id || accepting) {
      return;
    }

    if (getOfferStatus(selectedOffer) !== "pending") {
      toast.error(
        "This offer is no longer available for acceptance."
      );

      setSelectedOffer(null);
      setReviewOffer(null);

      await loadOffers({ showLoader: false });
      return;
    }

    const acceptedOfferId = selectedOffer.id;

    setAccepting(true);

    try {
      const response = await acceptErandOffer(
        acceptedOfferId
      );

      /* Optimistically preserve the complete history. */

      setOffers((currentOffers) =>
        currentOffers.map((offer) => {
          if (
            String(offer.id) === String(acceptedOfferId)
          ) {
            return {
              ...offer,
              status: "accepted",
            };
          }

          if (getOfferStatus(offer) === "pending") {
            return {
              ...offer,
              status: "superseded",
            };
          }

          return offer;
        })
      );

      setSelectedOffer(null);
      setReviewOffer(null);
      setCompareOpen(false);
      setCompareIds([]);

      toast.success(
        "Erander accepted successfully. Your offer history has been updated."
      );

      const refreshed = await loadOffers({
        showLoader: false,
      });

      if (!refreshed) {
        toast.info(
          "Your decision was saved. Your offer history will be synchronized when you refresh."
        );
      }

      if (typeof onAccepted === "function") {
        try {
          await onAccepted(response);
        } catch (callbackError) {
          console.error(
            "The offer was accepted, but the follow-up callback failed:",
            callbackError
          );

          toast.info(
            "Your offer was accepted. You can continue to your errand to complete the next step."
          );
        }
      }
    } catch (error) {
      console.error(
        "Unable to accept erander offer:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "We could not accept this offer. Please try again."
      );
    } finally {
      setAccepting(false);
    }
  };
		
		
		const handleViewDetails = useCallback(() => {
  navigate(`/dashboard/erands/${erandId}`);
}, [navigate, erandId]);

  /* -----------------------------------------------------
     LOADING, ERROR AND EMPTY STATES
  ----------------------------------------------------- */

  if (loading) {
    return (
      <OffersLoadingState onBack={handleGoBack} />
    );
  }

  if (loadError) {
    return (
      <PageShell
        stats={null}
        currency={currency}
        count={0}
        pendingCount={0}
        onBack={handleGoBack}
      >
        <MessagePanel
          icon={Info}
          tone="solid"
          title="Unable to load offers"
          body={loadError}
        >
          <button
            type="button"
            onClick={() => loadOffers()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
            />
            Try again
          </button>

          <button
            type="button"
            onClick={handleGoBack}
            className={secondaryButtonClass}
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
            />
            Go back
          </button>
        </MessagePanel>
      </PageShell>
    );
  }

  if (!offers.length) {
    return (
      <PageShell
        stats={null}
        currency={currency}
        count={0}
        pendingCount={0}
        onBack={handleGoBack}
        actions={
          <ErrandActionsMenu ariaLabel="Errand actions" />
        }
      >
        <MessagePanel
          icon={Package}
          title="No offers yet"
          body="Eranders who are interested in your errand will send their offers here. You can compare their prices and fees before choosing one."
        />
      </PageShell>
    );
  }

  /* -----------------------------------------------------
     MAIN CONTENT
  ----------------------------------------------------- */

  const reviewFromCompare = (offer) => {
    if (getOfferStatus(offer) !== "pending") {
      return;
    }

    setCompareOpen(false);
    setReviewOffer(offer);
  };

  return (
    <>
      <PageShell
        stats={stats}
        currency={currency}
        count={totalOfferCount}
        pendingCount={pendingCount}
        onBack={handleGoBack}
        actions={
          <ErrandActionsMenu ariaLabel="Errand actions" />
        }
      >
        <section aria-label="Offers ">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-white p-4 shadow-[0_2px_12px_rgba(20,33,61,0.035)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative sm:w-80">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search by erander name"
                aria-label="Search offers by erander name"
                className="h-11 w-full rounded-xl border border-line bg-surface-white pl-10 pr-9 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle transition hover:text-content"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-auto">
                <Select
                  options={sortOptions}
                  value={activeSort}
                  onChange={(value) => {
                    setSort(
                      Array.isArray(value)
                        ? String(value[0] ?? "price_low")
                        : String(value ?? "price_low")
                    );

                    setVisibleCount(PAGE_SIZE);
                  }}
                  placeholder="Sort offers"
                  aria-label="Sort offers"
                />
              </div>

              <OfferViewToggle
                value={view}
                onChange={setView}
              />
            </div>
          </div>

          <div className="mt-5" aria-live="polite">
            {visibleOffers.length === 0 ? (
              <MessagePanel
                icon={Search}
                title="No offers match that name"
                body="Try a different name or clear the search."
              >
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={secondaryButtonClass}
                >
                  Clear search
                </button>
              </MessagePanel>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                {shownOffers.map((offer) => {
                  const status = getOfferStatus(offer);

                  return (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      currency={currency}
                      estimate={estimate}
                      isLowest={
                        status === "pending" &&
                        offer.id === lowestId
                      }
                      isLatest={
                        status === "pending" &&
                        offer.id === latestId
                      }
                      selected={compareIds.some(
                        (id) =>
                          String(id) === String(offer.id)
                      )}
                      compareFull={
                        compareIds.length >= MAX_COMPARE
                      }
                      onToggleCompare={toggleCompare}
                      onReview={setReviewOffer}
                      onOpenChat={handleOpenChat}
																						onViewDetails={handleViewDetails}
                    />
                  );
                })}
              </div>
            ) : (
              <OffersTable
                offers={shownOffers}
                currency={currency}
                estimate={estimate}
                lowestId={lowestId}
                latestId={latestId}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                onReview={setReviewOffer}
                onOpenChat={handleOpenChat}
																onViewDetails={handleViewDetails}
              />
            )}
          </div>

          {visibleOffers.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-content-muted">
                Showing {shownOffers.length} of{" "}
                {visibleOffers.length}{" "}
                {visibleOffers.length === 1
                  ? "offer"
                  : "offers"}
              </p>

              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount(
                      (count) => count + PAGE_SIZE
                    )
                  }
                  className="rounded-xl bg-surface-muted px-5 py-2.5 text-sm font-semibold text-content transition hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Show{" "}
                  {Math.min(PAGE_SIZE, remainingCount)}{" "}
                  more
                </button>
              )}
            </div>
          )}

          <CompareBar
            count={compareOffers.length}
            onOpen={() => setCompareOpen(true)}
            onClear={() => setCompareIds([])}
          />
        </section>
      </PageShell>

      {compareOpen && compareOffers.length >= 2 ? (
        <CompareModal
          offers={compareOffers}
          currency={currency}
          originalItems={originalItems}
          estimate={estimate}
          onClose={() => setCompareOpen(false)}
          onReview={reviewFromCompare}
        />
      ) : null}

      {reviewOffer &&
      !selectedOffer &&
      getOfferStatus(reviewOffer) === "pending" ? (
        <ReviewModal
          offer={reviewOffer}
          currency={currency}
          originalItems={originalItems}
          estimate={estimate}
          proposedTotal={getProposalTotal(reviewOffer)}
          accepting={accepting}
          onClose={() => setReviewOffer(null)}
          onAccept={setSelectedOffer}
        />
      ) : null}

      <Modal
        isOpen={Boolean(selectedOffer)}
        onClose={() => {
          if (!accepting) {
            setSelectedOffer(null);
          }
        }}
        title="Accept this erander's offer?"
        description={
          selectedOffer
            ? `You are accepting ${getName(
                selectedOffer
              )}'s offer for ${formatMoney(
                getProposalTotal(selectedOffer),
                currency
              )}. This assigns the erander to your errand and creates the agreement.`
            : ""
        }
        size="sm"
        closeOnOverlayClick={!accepting}
        closeOnEscape={!accepting}
      >
        <div className="flex items-start gap-3 rounded-xl border border-brand-green/20 bg-brand-green/5 p-4">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-success"
            aria-hidden="true"
          />

          <p className="text-sm leading-6 text-content">
            Once accepted, you'll fund{" "}
            {selectedOffer
              ? formatMoney(
                  getProposalTotal(selectedOffer),
                  currency
                )
              : "the agreed amount"}{" "}
            to let the erander begin. You can still cancel
            before funding according to our policy.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={accepting}
            onClick={() => setSelectedOffer(null)}
            className="min-h-11 rounded-xl border border-line px-5 py-3 text-sm font-bold text-content-muted transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Review again
          </button>

          <button
            type="button"
            disabled={accepting}
            onClick={handleAccept}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? (
              <>
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2
                  size={16}
                  aria-hidden="true"
                />
                Accept offer
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}