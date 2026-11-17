import { useCallback, useState } from "react";

import {
  getProfileAdminRoles,
  releaseSecurityDepositReservation,
  resolveReconciliationIssue,
  reviewSecurityDepositClaim,
  runFinancialReconciliation,
  setProfileAdminRole,
  settleSecurityDepositClaim,
  toggleErrandOffers,
  updateBusinessVerification,
  updateProfileAccountStatus,
} from "@/services/admin/adminActionsApi";
import {
  approveAdminWithdrawal,
  processAdminWithdrawal,
  rejectAdminWithdrawal,
  verifyAdminWithdrawalTransfer,
} from "@/services/admin/adminWalletApi";

import { ROLE_LABELS, WITHDRAWAL_ACTIONS } from "./recordsUtils";

const INITIAL_FORM = {
  reason: "",
  status: "",
  decision: "approved",
  approvedAmountMinor: "",
  runType: "full_reconciliation",
  currencyCode: "",
};

/**
 * Every admin write lives here: generic actions, role management and
 * withdrawal approvals. onDone closes the record dialog, reload refreshes
 * the list, reopenErrand refreshes an open errand dialog.
 */
export default function useRecordActions({ reload, onDone, reopenErrand }) {
  const [message, setMessage] = useState("");

  /* ------------------------------ Generic actions ---------------------------- */
  const [actionType, setActionType] = useState("");
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openAction = useCallback((type, row = null) => {
    setTarget(row);
    setActionType(type);
    setError("");

    const initialStatus =
      type === "user-status"
        ? row?.account_status || "active"
        : type === "business-verification"
          ? row?.verification_status || "pending"
          : type === "reconciliation-issue"
            ? row?.status || "investigating"
            : "";

    setForm({
      ...INITIAL_FORM,
      status: initialStatus,
      approvedAmountMinor: row?.requested_amount_minor
        ? String(row.requested_amount_minor)
        : "",
    });
  }, []);

  const closeAction = useCallback(() => {
    if (busy) return;
    setActionType("");
    setError("");
  }, [busy]);

  const runAction = useCallback(async () => {
    const refreshErrandId = actionType === "errand-offers" ? target?.id : null;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      let result;
      const reason = form.reason.trim();

      if (actionType === "user-status")
        result = await updateProfileAccountStatus(target.id, {
          status: form.status,
          reason,
        });
      else if (actionType === "business-verification")
        result = await updateBusinessVerification(target.id, {
          status: form.status,
          reason,
        });
      else if (actionType === "errand-offers")
        result = await toggleErrandOffers(target.id, {
          enabled: !target.offers_enabled,
          reason,
        });
      else if (actionType === "claim-review")
        result = await reviewSecurityDepositClaim(target.id, {
          decision: form.decision,
          reason,
          approvedAmountMinor:
            form.decision === "approved"
              ? Number(form.approvedAmountMinor)
              : null,
        });
      else if (actionType === "claim-settle")
        result = await settleSecurityDepositClaim(target.id);
      else if (actionType === "reservation-release")
        result = await releaseSecurityDepositReservation(target.id, reason);
      else if (actionType === "reconciliation-run")
        result = await runFinancialReconciliation({
          runType: form.runType,
          currencyCode: form.currencyCode || null,
        });
      else if (actionType === "reconciliation-issue")
        result = await resolveReconciliationIssue(target.id, {
          status: form.status,
          reason,
        });

      if (result?.success === false)
        throw new Error(result.message || "The operation failed.");

      setMessage(result?.message || "The operation completed successfully.");
      setActionType("");
      setTarget(null);
      onDone?.();

      await reload();
      if (refreshErrandId)
        await reopenErrand?.(refreshErrandId, { silent: true });
    } catch (requestError) {
      setError(requestError?.message || "The operation failed.");
    } finally {
      setBusy(false);
    }
  }, [actionType, target, form, onDone, reload, reopenErrand]);

  /* --------------------------------- Roles ----------------------------------- */
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleData, setRoleData] = useState(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleCode, setRoleCode] = useState("support_admin");
  const [roleReason, setRoleReason] = useState("");
  const [roleError, setRoleError] = useState("");

  const openRoleManager = useCallback(async (row) => {
    setRoleTarget(row);
    setRoleData(null);
    setRoleReason("");
    setRoleError("");
    setRoleBusy(true);

    try {
      const response = await getProfileAdminRoles(row.id);
      setRoleData(response?.data || null);
    } catch (requestError) {
      setRoleData({
        assignments: [],
        availableRoles: Object.keys(ROLE_LABELS),
      });
      setRoleError(
        requestError?.message || "Unable to load administrator roles."
      );
    } finally {
      setRoleBusy(false);
    }
  }, []);

  const closeRoles = useCallback(() => {
    if (roleBusy) return;
    setRoleData(null);
    setRoleTarget(null);
    setRoleError("");
  }, [roleBusy]);

  const changeRole = useCallback(
    async (activate) => {
      if (!roleTarget || !roleCode) return;

      if (roleReason.trim().length < 5) {
        setRoleError("Enter a reason of at least five characters.");
        return;
      }

      setRoleBusy(true);
      setRoleError("");
      setMessage("");

      try {
        const response = await setProfileAdminRole(roleTarget.id, roleCode, {
          activate,
          reason: roleReason.trim(),
        });

        setMessage(
          response?.message || `Role ${activate ? "assigned" : "revoked"}.`
        );

        const updated = await getProfileAdminRoles(roleTarget.id);
        setRoleData(updated?.data || null);
        setRoleReason("");
        await reload();
      } catch (requestError) {
        setRoleError(
          requestError?.message || "Unable to update administrator role."
        );
      } finally {
        setRoleBusy(false);
      }
    },
    [roleTarget, roleCode, roleReason, reload]
  );

  /* ------------------------------- Withdrawals -------------------------------- */
  const [withdrawalConfirm, setWithdrawalConfirm] = useState(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);

  const openWithdrawalConfirm = useCallback((row, action) => {
    setWithdrawalConfirm({ row, action });
    setConfirmReason("");
    setConfirmError("");
  }, []);

  const closeWithdrawalConfirm = useCallback(() => {
    if (withdrawalBusy) return;
    setWithdrawalConfirm(null);
  }, [withdrawalBusy]);

  const confirmWithdrawal = useCallback(async () => {
    if (!withdrawalConfirm) return;

    const { row, action } = withdrawalConfirm;
    const config = WITHDRAWAL_ACTIONS[action];

    if (config.needsReason && confirmReason.trim().length < 5) {
      setConfirmError(
        "A rejection reason of at least five characters is required."
      );
      return;
    }

    setWithdrawalBusy(true);
    setConfirmError("");
    setMessage("");

    try {
      let response;

      if (action === "approve") response = await approveAdminWithdrawal(row.id);
      if (action === "reject")
        response = await rejectAdminWithdrawal(row.id, confirmReason.trim());
      if (action === "process") response = await processAdminWithdrawal(row.id);
      if (action === "verify")
        response = await verifyAdminWithdrawalTransfer(row.id);

      setMessage(response?.message || "Withdrawal operation completed.");
      setWithdrawalConfirm(null);
      onDone?.();
      await reload();
    } catch (requestError) {
      setConfirmError(requestError?.message || "Withdrawal operation failed.");
    } finally {
      setWithdrawalBusy(false);
    }
  }, [withdrawalConfirm, confirmReason, onDone, reload]);

  return {
    message,
    clearMessage: () => setMessage(""),

    actionType,
    target,
    form,
    setForm,
    busy,
    error,
    openAction,
    closeAction,
    runAction,

    roleTarget,
    roleData,
    roleBusy,
    roleCode,
    setRoleCode,
    roleReason,
    setRoleReason,
    roleError,
    openRoleManager,
    closeRoles,
    changeRole,

    withdrawalConfirm,
    confirmReason,
    setConfirmReason,
    confirmError,
    withdrawalBusy,
    openWithdrawalConfirm,
    closeWithdrawalConfirm,
    confirmWithdrawal,
  };
}