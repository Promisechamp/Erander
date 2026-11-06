import { Check, LoaderCircle } from "lucide-react";

import Modal from "@/components/Modal";
import Select from "@/components/Select";

import { Banner } from "./RecordsUI";
import { BTN_GHOST, BTN_NAVY, INPUT, TEXTAREA } from "./recordsStyles";
import { currencyValue } from "./recordsUtils";

const TITLES = {
  "user-status": "Update user account status",
  "business-verification": "Review business verification",
  "claim-review": "Review security-deposit claim",
  "claim-settle": "Settle approved claim",
  "reservation-release": "Release reserved security deposit",
  "reconciliation-run": "Run financial reconciliation",
  "reconciliation-issue": "Update reconciliation issue",
};

export default function ActionModal({
  type,
  row,
  form,
  setForm,
  busy,
  error,
  onClose,
  onConfirm,
}) {
  const title =
    type === "errand-offers"
      ? row?.offers_enabled
        ? "Pause errand offers"
        : "Enable errand offers"
      : TITLES[type] || "Administrator action";

  const needsReason = !["claim-settle", "reconciliation-run"].includes(type);
  const reasonLength = form.reason.trim().length;

  const disabled =
    busy ||
    (needsReason && reasonLength < 10) ||
    (type === "claim-review" &&
      form.decision === "approved" &&
      !(Number(form.approvedAmountMinor) > 0));

  const patch = (values) => setForm((old) => ({ ...old, ...values }));

  return (
    <Modal
      isOpen={!!type}
      onClose={onClose}
      title={title}
      subtitle="Administrator action"
      description="Every supported action is checked by the backend and recorded with the acting administrator."
      size="lg"
      position="bottom"
      height="auto"
      headerTone="navy"
      zIndex={90}
      closeOnOutsideClick={!busy}
      closeOnEscape={!busy}
    >
      <div className="space-y-5">
        {type === "user-status" ? (
          <Select
            label="Account status"
            options={[
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "deactivated", label: "Deactivated" },
            ]}
            value={form.status}
            onChange={(value) => patch({ status: value })}
            searchable={false}
            clearable={false}
          />
        ) : null}

        {type === "business-verification" ? (
          <Select
            label="Verification decision"
            options={[
              { value: "pending", label: "Pending review" },
              { value: "verified", label: "Verified" },
              { value: "rejected", label: "Rejected" },
            ]}
            value={form.status}
            onChange={(value) => patch({ status: value })}
            searchable={false}
            clearable={false}
          />
        ) : null}

        {type === "claim-review" ? (
          <>
            <Select
              label="Decision"
              options={[
                { value: "approved", label: "Approve claim" },
                { value: "rejected", label: "Reject claim" },
              ]}
              value={form.decision}
              onChange={(value) => patch({ decision: value })}
              searchable={false}
              clearable={false}
            />

            {form.decision === "approved" ? (
              <div>
                <label
                  htmlFor="approved-amount"
                  className="mb-2 block text-sm font-bold text-content"
                >
                  Approved amount (minor units)
                </label>
                <input
                  id="approved-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.approvedAmountMinor}
                  onChange={(event) =>
                    patch({ approvedAmountMinor: event.target.value })
                  }
                  className={`${INPUT} tabular-nums`}
                />
                <p className="mt-1.5 text-xs text-content-muted">
                  For NGN ₦1,000.00, enter 100000.
                  {Number(form.approvedAmountMinor) > 0 ? (
                    <span className="ml-1 font-bold text-content">
                      ={" "}
                      {currencyValue(
                        form.approvedAmountMinor,
                        row?.currency_code,
                        true
                      )}
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {type === "reconciliation-run" ? (
          <>
            <Select
              label="Reconciliation scope"
              options={[
                { value: "full_reconciliation", label: "Full reconciliation" },
                { value: "wallet_balances", label: "Wallet balances" },
                { value: "ledger_integrity", label: "Ledger integrity" },
              ]}
              value={form.runType}
              onChange={(value) => patch({ runType: value })}
              searchable={false}
              clearable={false}
            />
            <Select
              label="Currency (optional)"
              options={[
                { value: "", label: "All supported currencies" },
                ...["NGN", "USD", "GBP", "EUR"].map((value) => ({
                  value,
                  label: value,
                })),
              ]}
              value={form.currencyCode}
              onChange={(value) => patch({ currencyCode: value || "" })}
              searchable={false}
              clearable={false}
            />
          </>
        ) : null}

        {type === "reconciliation-issue" ? (
          <Select
            label="Issue status"
            options={[
              { value: "investigating", label: "Investigating" },
              { value: "resolved", label: "Resolved" },
              { value: "ignored", label: "Ignored" },
            ]}
            value={form.status}
            onChange={(value) => patch({ status: value })}
            searchable={false}
            clearable={false}
          />
        ) : null}

        {needsReason && type ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor="action-reason"
                className="text-sm font-bold text-content"
              >
                {type === "reconciliation-issue" ? "Resolution notes" : "Reason"}
              </label>
              <span
                className={`text-xs tabular-nums ${
                  reasonLength >= 10 ? "text-success-dark" : "text-content-subtle"
                }`}
              >
                {reasonLength}/10 min
              </span>
            </div>
            <textarea
              id="action-reason"
              rows={4}
              value={form.reason}
              onChange={(event) => patch({ reason: event.target.value })}
              placeholder="Enter the reason. This will be retained in the audit trail."
              className={TEXTAREA}
            />
          </div>
        ) : null}

        {type === "claim-settle" ? (
          <Banner tone="warning">
            This operation posts the approved claim through the existing
            security-deposit settlement function and wallet ledger.
          </Banner>
        ) : null}

        {type === "reservation-release" ? (
          <p className="text-xs leading-5 text-content-muted">
            A reviewed release uses the existing database function and returns
            reserved funds through the wallet ledger.
          </p>
        ) : null}

        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className={BTN_GHOST}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={BTN_NAVY}
        >
          {busy ? (
            <>
              <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              Processing
            </>
          ) : (
            <>
              <Check size={15} aria-hidden="true" />
              Confirm action
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}