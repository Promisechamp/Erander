import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { getErrandById, updateErrand } from "@/services/errands/errandsApi";

import ErrandRequestForm, {
  getCurrentDestination,
  toLocalInput,
} from "./ErrandRequestForm";

const EDITABLE_STATUSES = new Set(["draft", "open"]);

const FUNDED_OR_LATER = new Set([
  "funded",
  "in_progress",
  "completion_submitted",
  "completed",
  "disputed",
]);

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function unwrapErrand(result) {
  const data = result?.data;

  if (data?.errand) return data.errand;
  if (data?.erand) return data.erand;
  if (data?.request) return data.request;

  if (data && !Array.isArray(data) && data.id) return data;
  if (result?.errand) return result.errand;
  if (result?.erand) return result.erand;
  if (result?.id) return result;

  return null;
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return String(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/* Funded if the status says so, or any funding signal is on the record. */
function isFundedErrand(record) {
  if (!record) return false;

  const status = String(record.status || "").toLowerCase();

  if (FUNDED_OR_LATER.has(status)) return true;

  if (record.is_funded === true || record.isFunded === true) return true;

  if (record.agreement_locked_at || record.agreementLockedAt) return true;

  const fundingStatus = String(
    record.funding_status || record.fundingStatus || ""
  ).toLowerCase();

  if (
    ["funded", "fully_funded", "partially_funded", "partial"].includes(
      fundingStatus
    )
  ) {
    return true;
  }

  const funded = Number(
    record.amount_funded ?? record.amountFunded ?? record.funded_amount ?? 0
  );

  return Number.isFinite(funded) && funded > 0;
}

function recordToInitialValues(record) {
  const existingItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.erand_items)
      ? record.erand_items
      : [];

  return {
    form: {
      title: record.title || "",
      category: record.category || "other",
      description: record.description || "",
      estimated_total:
        record.estimated_total === null || record.estimated_total === undefined
          ? ""
          : String(record.estimated_total),
      customer_notes: record.customer_notes || "",
      scheduled_for: toLocalInput(record.scheduled_for),
      expires_at: toLocalInput(record.expires_at),
      max_erander_offers: String(record.max_erander_offers ?? 5),
    },
    items: existingItems.map((item) => ({
      item_name: item.item_name || "",
      quantity: String(item.quantity ?? 1),
      estimated_unit_price:
        item.estimated_unit_price === null ||
        item.estimated_unit_price === undefined
          ? ""
          : String(item.estimated_unit_price),
      description: item.description || "",
      customer_notes: item.customer_notes || "",
    })),
  };
}

/* -------------------------------------------------------
   LOADING AND ERROR
------------------------------------------------------- */

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading errand details"
      className="mx-auto w-full max-w-[1440px] space-y-6 px-0 py-6 sm:px-2 lg:py-8"
    >
      <span className="sr-only">Getting your current request ready</span>

      <div className="h-5 w-40 animate-pulse rounded-lg bg-surface-muted" />

      <div className="h-60 animate-pulse rounded-3xl bg-brand-navy/90" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-3xl border border-line bg-surface-white p-8 shadow-erander-card">
          <div className="space-y-6">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-3">
                <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-surface-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden h-96 animate-pulse rounded-3xl bg-surface-muted xl:block" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry, onBack }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-0 py-10 sm:px-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-content-muted transition hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        My errands
      </button>

      <div
        role="alert"
        className="rounded-r-3xl border-l-4 border-red-500 bg-red-50 p-6 sm:p-8"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            size={22}
            className="mt-0.5 shrink-0 text-red-600"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-red-950">
              We couldn't open this errand
            </h1>

            <p className="mt-1 break-words text-sm leading-6 text-red-800">
              {message || "This errand could not be found."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>

              <button
                type="button"
                onClick={onBack}
                className="rounded-full border border-line bg-surface-white px-5 py-2.5 text-sm font-bold text-content transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
              >
                My errands
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   PAGE
------------------------------------------------------- */

export default function EditErrandPage() {
  const { errandId } = useParams();
  const navigate = useNavigate();

  const [errand, setErrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadErrand = useCallback(async () => {
    if (!errandId) {
      setErrand(null);
      setPageError("The errand ID is missing from the page address.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const result = await getErrandById(errandId);
      const record = unwrapErrand(result);

      if (!record) {
        throw new Error(
          "We couldn't read this errand from the server response."
        );
      }

      setErrand(record);
    } catch (error) {
      setErrand(null);
      setPageError(
        error?.message || "Unable to load this errand. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [errandId]);

  useEffect(() => {
    loadErrand();
  }, [loadErrand]);

  const goToDetails = useCallback(
    () => navigate(`/dashboard/erands/${encodeURIComponent(errandId)}`),
    [navigate, errandId]
  );

  async function handleSubmit(payload) {
    await updateErrand(errandId, payload);

    toast.success("Your errand has been updated successfully.");

    goToDetails();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (pageError || !errand) {
    return (
      <DashboardLayout>
        <ErrorState
          message={pageError}
          onRetry={loadErrand}
          onBack={() => navigate("/dashboard/erands")}
        />
      </DashboardLayout>
    );
  }

  const status = String(errand.status || "").toLowerCase();
  const funded = isFundedErrand(errand);
  const editable = EDITABLE_STATUSES.has(status) && !funded;

  const lockedMessage = funded
    ? "This errand has been funded, so its agreed terms are locked. The details below are shown for reference."
    : `Requests can only be edited while they are drafts or open. This errand is currently ${formatStatus(
        errand.status
      )}. The details below are shown for reference.`;

  return (
    <DashboardLayout>
      <ErrandRequestForm
        key={errandId}
        mode="edit"
        initialValues={recordToInitialValues(errand)}
        currentDestination={getCurrentDestination(errand)}
        errandMeta={{
          reference_code: errand.reference_code,
          statusLabel: formatStatus(errand.status),
        }}
        editable={editable}
        lockedMessage={lockedMessage}
        currency={errand.currency_code || "NGN"}
        onSubmit={handleSubmit}
        onCancel={goToDetails}
        backLabel="Back to errand details"
      />
    </DashboardLayout>
  );
}
