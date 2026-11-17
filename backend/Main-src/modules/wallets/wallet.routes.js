import { Router } from "express";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdminAuth } from "../../middleware/requireAdminAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";
import { hasAdminPermission } from "../admin/auth/adminPermissions.js";

import { getWalletOverview, getWalletTransaction } from "./wallet.controller.js";
import {
  addWithdrawalAccount,
  approveWithdrawal,
  cancelMyWithdrawal,
  createWithdrawalRequest,
  disableWithdrawalAccount,
  initializeWalletDeposit,
  listAdminWithdrawals,
  listMyWithdrawals,
  listWithdrawalAccounts,
  listWithdrawalBanks,
  processApprovedWithdrawal,
  rejectWithdrawal,
  resolveWithdrawalAccount,
  setDefaultWithdrawalAccount,
  verifyWalletDeposit,
  verifyWithdrawalTransfer,
} from "./wallet.actions.controller.js";

const router = Router();

function requireFinancePermission(permission) {
  return (req, res, next) => {
    if (!hasAdminPermission(req.admin, permission)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this finance action." });
    }
    return next();
  };
}

// Customer wallet routes.
router.use(requireAuth);
router.get("/", getWalletOverview);
router.get("/transactions/:transactionId", getWalletTransaction);
router.get("/banks", listWithdrawalBanks);
router.post("/deposits/initialize", requireCsrf, initializeWalletDeposit);
router.post("/deposits/verify", requireCsrf, verifyWalletDeposit);
router.get("/withdrawal-accounts", listWithdrawalAccounts);
router.post("/withdrawal-accounts/resolve", requireCsrf, resolveWithdrawalAccount);
router.post("/withdrawal-accounts", requireCsrf, addWithdrawalAccount);
router.patch("/withdrawal-accounts/:accountId/default", requireCsrf, setDefaultWithdrawalAccount);
router.delete("/withdrawal-accounts/:accountId", requireCsrf, disableWithdrawalAccount);
router.get("/withdrawals", listMyWithdrawals);
router.post("/withdrawals", requireCsrf, createWithdrawalRequest);
router.post("/withdrawals/:withdrawalId/cancel", requireCsrf, cancelMyWithdrawal);

// Finance administration. This router uses a separate admin session and
// permission check; customer authentication is not accepted for these routes.
const adminRouter = Router();
adminRouter.use(requireAdminAuth);
adminRouter.get("/withdrawals", requireFinancePermission("wallets:read"), listAdminWithdrawals);
adminRouter.post("/withdrawals/:withdrawalId/approve", requireCsrf, requireFinancePermission("wallets:manage"), approveWithdrawal);
adminRouter.post("/withdrawals/:withdrawalId/reject", requireCsrf, requireFinancePermission("wallets:manage"), rejectWithdrawal);
adminRouter.post("/withdrawals/:withdrawalId/process", requireCsrf, requireFinancePermission("wallets:manage"), processApprovedWithdrawal);
adminRouter.post("/withdrawals/:withdrawalId/verify-transfer", requireCsrf, requireFinancePermission("wallets:manage"), verifyWithdrawalTransfer);

// Mount the admin sub-router before the customer authentication middleware
// would be applied in the main API router. See the integration README.
export { adminRouter as walletAdminRoutes };
export default router;
