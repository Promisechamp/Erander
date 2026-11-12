import { LoaderCircle } from "lucide-react";

import Modal from "@/components/Modal";

import { Banner } from "./RecordsUI";
import {
  BTN_GHOST,
  BTN_NAVY,
  TEXTAREA,
  TONE_BUTTON,
} from "./recordsStyles";
import { WITHDRAWAL_ACTIONS, formatValue } from "./recordsUtils";

export default function WithdrawalConfirmModal({
  confirm,
  reason,
  setReason,
  error,
  busy,
  onClose,
  onConfirm,
}) {
  const config = confirm ? WITHDRAWAL_ACTIONS[confirm.action] : null;
  const row = confirm?.row;

  return (
    <Modal
      isOpen={!!confirm}
      onClose={onClose}
      title={config?.title || "Confirm"}
      subtitle="Withdrawal"
      description={row?.reference || ""}
      size="md"
      position="center"
      height="auto"
      headerTone="navy"
      zIndex={95}
      closeOnOutsideClick={!busy}
      closeOnEscape={!busy}
    >
      {confirm ? (
        <div className="space-y-5">
          <dl className="divide-y divide-line-soft rounded-2xl bg-surface-muted/60 px-4">
            {[
              ["Reference", row.reference],
              ["Amount", formatValue("amount_minor", row.amount_minor, row)],
              [
                "Bank",
                `${row.bank_name_snapshot || "—"} · •••• ${
                  row.account_number_last4_snapshot || "—"
                }`,
              ],
              ["Account name", row.account_name_snapshot],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <dt className="text-sm text-content-muted">{label}</dt>
                <dd className="min-w-0 break-words text-right text-sm font-semibold text-content">
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>

          <Banner tone={config?.warn ? "warning" : "success"}>{config?.body}</Banner>

          {config?.needsReason ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label
                  htmlFor="withdrawal-reason"
                  className="text-sm font-bold text-content"
                >
                  Rejection reason
                </label>
                <span className="text-xs tabular-nums text-content-subtle">
                  {reason.trim().length}/5 min
                </span>
              </div>
              <textarea
                id="withdrawal-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this withdrawal is being rejected."
                className={TEXTAREA}
              />
            </div>
          ) : null}

          {error ? <Banner tone="danger">{error}</Banner> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
              disabled={busy}
              className={TONE_BUTTON[config?.tone] || BTN_NAVY}
            >
              {busy ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                  Working
                </>
              ) : (
                config?.label
              )}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}