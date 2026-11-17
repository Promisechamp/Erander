import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, MessageCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import {
  confirmErrandCompletion,
  startErrandExecution,
  submitErrandCompletion,
} from "@/services/errands/errandsApi";

const CARD = "rounded-2xl border border-line bg-surface-white p-5 shadow-[0_2px_12px_rgba(20,33,61,0.035)] sm:p-6";
const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-brand-green text-brand hover:brightness-95`;
const SECONDARY = `${BUTTON} border border-line bg-surface-white text-content hover:bg-surface-muted`;

export default function ErrandCompletionActions({
  errand,
  role,
  releaseStatus,
  securityDepositSecured = false,
  onOpenChat,
  onRaiseIssue,
  onUpdated,
}) {
  const [busy, setBusy] = useState(false);
  const status = String(errand?.status || "").toLowerCase();
  const isErander = role === "erander";
  const startNeedsDepositReview = isErander && status === "funded" && releaseStatus === "released" && !securityDepositSecured;
  const canStart = isErander && status === "funded" && releaseStatus === "released" && securityDepositSecured;
  const canSubmit = isErander && status === "in_progress";
  const canConfirm = !isErander && status === "completion_submitted";

  if (!canStart && !canSubmit && !canConfirm && !startNeedsDepositReview) return null;

  const runAction = async (action, successMessage) => {
    if (!errand?.id || busy) return;
    setBusy(true);
    try {
      const result = await action(errand.id);
      toast.success(result?.message || successMessage);
      await onUpdated?.();
    } catch (error) {
      toast.error(error?.message || "We couldn't update the errand. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={CARD} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-success-dark">
          <ClipboardCheck size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-content">
            {canStart ? "Ready to start?" : canSubmit ? "Ready to submit the completed work?" : "Review completed work"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-content-muted">
            {canStart
              ? "Execution funds have been released. Start the errand when you are ready to begin. Your security-deposit reservation must still be valid."
              : canSubmit
                ? "Before submitting, share relevant receipts, photos, progress updates and handover confirmation in the customer–erander chat. Do not photograph confidential document contents."
                : "Review the work and the receipts, photos or handover updates shared in your errand chat. Confirm only when the agreed work is complete."}
          </p>
          {startNeedsDepositReview ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              The required 100% security-deposit reservation is not currently confirmed. Refresh the errand after securing it; work cannot start until the server verifies the reservation.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {canStart ? (
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => runAction(startErrandExecution, "Errand started.")}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                Start errand
              </button>
            ) : null}
            {canSubmit ? (
              <>
                <button type="button" className={SECONDARY} disabled={busy} onClick={onOpenChat}>
                  <MessageCircle size={16} /> Open errand chat
                </button>
                <button type="button" className={PRIMARY} disabled={busy} onClick={() => runAction(submitErrandCompletion, "Completion submitted for customer review.")}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Submit completion
                </button>
              </>
            ) : null}
            {canConfirm ? (
              <>
                <button type="button" className={SECONDARY} disabled={busy} onClick={onOpenChat}>
                  <MessageCircle size={16} /> Review errand chat
                </button>
                {onRaiseIssue ? (
                  <button type="button" className={SECONDARY} disabled={busy} onClick={onRaiseIssue}>
                    Contact support
                  </button>
                ) : null}
                <button type="button" className={PRIMARY} disabled={busy} onClick={() => runAction(confirmErrandCompletion, "Completion confirmed.")}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm completion
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
