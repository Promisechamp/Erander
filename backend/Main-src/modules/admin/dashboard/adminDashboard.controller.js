import { getDatabasePool } from "../../../config/database.js";
import { hasAdminPermission } from "../auth/adminPermissions.js";

function canRead(admin, permission) {
  return hasAdminPermission(admin, permission);
}

async function safelyLoadMetric(name, loader, warnings) {
  try {
    return await loader();
  } catch (error) {
    // Do not return SQL details or database errors to the browser.
    console.error(`Admin dashboard metric '${name}' could not be loaded:`, {
      message: error?.message || "Unknown database error",
      code: error?.code || null,
    });
    warnings.push(name);
    return null;
  }
}

async function loadUsers(pool) {
  const result = await pool.query(`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE account_status = 'active')::bigint AS active,
      COUNT(*) FILTER (WHERE account_status = 'suspended')::bigint AS suspended,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '7 days'
      )::bigint AS created_last_7_days
    FROM public.profiles
  `);

  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    active: Number(row.active || 0),
    suspended: Number(row.suspended || 0),
    createdLast7Days: Number(row.created_last_7_days || 0),
  };
}

async function loadErrands(pool) {
  const result = await pool.query(`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status = 'open')::bigint AS open,
      COUNT(*) FILTER (
        WHERE status IN (
          'offer_selected', 'awaiting_funding', 'funded',
          'in_progress', 'completion_submitted'
        )
      )::bigint AS active,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed,
      COUNT(*) FILTER (WHERE status = 'disputed')::bigint AS disputed
    FROM public.erands
    WHERE deleted_at IS NULL
  `);

  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    open: Number(row.open || 0),
    active: Number(row.active || 0),
    completed: Number(row.completed || 0),
    disputed: Number(row.disputed || 0),
  };
}

async function loadPayments(pool) {
  const [summaryResult, recentResult] = await Promise.all([
    pool.query(`
      SELECT
        currency_code,
        COUNT(*) FILTER (WHERE status = 'confirmed')::bigint AS confirmed_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0)::numeric AS confirmed_amount,
        COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_count,
        COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
        COUNT(*) FILTER (WHERE status = 'reversed')::bigint AS reversed_count
      FROM public.erand_payments
      GROUP BY currency_code
      ORDER BY currency_code
    `),
    pool.query(`
      SELECT
        p.id,
        p.amount,
        p.currency_code,
        p.status,
        p.payment_provider,
        p.created_at,
        e.reference_code AS errand_reference
      FROM public.erand_payments p
      LEFT JOIN public.erands e ON e.id = p.erand_id
      ORDER BY p.created_at DESC
      LIMIT 8
    `),
  ]);

  return {
    byCurrency: summaryResult.rows.map((row) => ({
      currencyCode: row.currency_code,
      confirmedCount: Number(row.confirmed_count || 0),
      confirmedAmount: String(row.confirmed_amount || "0"),
      pendingCount: Number(row.pending_count || 0),
      failedCount: Number(row.failed_count || 0),
      reversedCount: Number(row.reversed_count || 0),
    })),
    recent: recentResult.rows.map((row) => ({
      id: row.id,
      amount: String(row.amount),
      currencyCode: row.currency_code,
      status: row.status,
      provider: row.payment_provider,
      errandReference: row.errand_reference,
      createdAt: row.created_at,
    })),
  };
}

async function loadWallets(pool) {
  const [walletResult, withdrawalResult, recentResult] = await Promise.all([
    pool.query(`
      SELECT
        currency_code,
        COUNT(*)::bigint AS wallet_count,
        COALESCE(SUM(available_balance), 0)::numeric AS available_balance,
        COALESCE(SUM(pending_balance), 0)::numeric AS pending_balance,
        COALESCE(SUM(reserved_balance), 0)::numeric AS reserved_balance
      FROM public.wallets
      GROUP BY currency_code
      ORDER BY currency_code
    `),
    pool.query(`
      SELECT
        currency_code,
        status,
        COUNT(*)::bigint AS request_count,
        COALESCE(SUM(amount_minor), 0)::numeric AS amount_minor
      FROM public.withdrawal_requests
      GROUP BY currency_code, status
      ORDER BY currency_code, status
    `),
    pool.query(`
      SELECT
        id,
        reference,
        currency_code,
        amount_minor,
        fee_minor,
        net_amount_minor,
        status,
        created_at
      FROM public.withdrawal_requests
      ORDER BY created_at DESC
      LIMIT 8
    `),
  ]);

  return {
    byCurrency: walletResult.rows.map((row) => ({
      currencyCode: row.currency_code,
      walletCount: Number(row.wallet_count || 0),
      availableBalance: String(row.available_balance || "0"),
      pendingBalance: String(row.pending_balance || "0"),
      reservedBalance: String(row.reserved_balance || "0"),
    })),
    withdrawalsByCurrencyAndStatus: withdrawalResult.rows.map((row) => ({
      currencyCode: row.currency_code,
      status: row.status,
      requestCount: Number(row.request_count || 0),
      amountMinor: String(row.amount_minor || "0"),
    })),
    recentWithdrawals: recentResult.rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      currencyCode: row.currency_code,
      amountMinor: String(row.amount_minor),
      feeMinor: String(row.fee_minor),
      netAmountMinor: String(row.net_amount_minor),
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

async function loadSecurityDeposits(pool) {
  const result = await pool.query(`
    SELECT
      currency_code,
      status,
      COUNT(*)::bigint AS claim_count,
      COALESCE(SUM(requested_amount_minor), 0)::numeric AS requested_amount_minor
    FROM public.erander_security_deposit_claims
    GROUP BY currency_code, status
    ORDER BY currency_code, status
  `);

  const claimsByCurrencyAndStatus = result.rows.map((row) => ({
    currencyCode: row.currency_code,
    status: row.status,
    claimCount: Number(row.claim_count || 0),
    requestedAmountMinor: String(row.requested_amount_minor || "0"),
  }));

  return {
    submittedClaims: claimsByCurrencyAndStatus
      .filter((row) => row.status === "submitted")
      .reduce((sum, row) => sum + row.claimCount, 0),
    claimsByCurrencyAndStatus,
  };
}

async function loadReconciliation(pool) {
  const result = await pool.query(`
    SELECT
      status,
      severity,
      COUNT(*)::bigint AS issue_count
    FROM public.financial_reconciliation_issues
    GROUP BY status, severity
    ORDER BY status, severity
  `);

  const issues = result.rows.map((row) => ({
    status: row.status,
    severity: row.severity,
    count: Number(row.issue_count || 0),
  }));

  return {
    openIssues: issues
      .filter((row) => ["open", "investigating"].includes(row.status))
      .reduce((sum, row) => sum + row.count, 0),
    criticalOpenIssues: issues
      .filter((row) => ["open", "investigating"].includes(row.status) && row.severity === "critical")
      .reduce((sum, row) => sum + row.count, 0),
    byStatusAndSeverity: issues,
  };
}

export async function getAdminDashboardOverview(req, res, next) {
  try {
    const pool = getDatabasePool();
    const admin = req.admin;
    const warnings = [];

    const permissions = {
      users: canRead(admin, "users:read"),
      errands: canRead(admin, "errands:read"),
      finance: canRead(admin, "finance:read"),
      wallets: canRead(admin, "wallets:read"),
      securityDeposits: canRead(admin, "security_deposits:read"),
      reconciliation: canRead(admin, "reconciliation:read"),
    };

    const [databaseResult, users, errands, payments, wallets, securityDeposits, reconciliation] = await Promise.all([
      pool.query("SELECT NOW() AS database_time"),
      permissions.users ? safelyLoadMetric("users", () => loadUsers(pool), warnings) : null,
      permissions.errands ? safelyLoadMetric("errands", () => loadErrands(pool), warnings) : null,
      permissions.finance ? safelyLoadMetric("payments", () => loadPayments(pool), warnings) : null,
      permissions.wallets ? safelyLoadMetric("wallets", () => loadWallets(pool), warnings) : null,
      permissions.securityDeposits ? safelyLoadMetric("securityDeposits", () => loadSecurityDeposits(pool), warnings) : null,
      permissions.reconciliation ? safelyLoadMetric("reconciliation", () => loadReconciliation(pool), warnings) : null,
    ]);

    return res.status(200).json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        databaseTime: databaseResult.rows[0]?.database_time || null,
        admin: {
          id: admin.id,
          roles: admin.roles || [],
        },
        permissions,
        users,
        errands,
        payments,
        wallets,
        securityDeposits,
        reconciliation,
        warnings,
      },
    });
  } catch (error) {
    return next(error);
  }
}
