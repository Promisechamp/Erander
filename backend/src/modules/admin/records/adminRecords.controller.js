import { getDatabasePool } from "../../../config/database.js";
import { hasAdminPermission } from "../auth/adminPermissions.js";
import { loadWalletTransactionDetails } from "../../wallets/wallet.controller.js";

/**
 * ERANDER admin read models.
 * All table/column names and joins are server-owned allowlists. Values are
 * parameterized. User profile references are hydrated so the UI can display
 * names/avatars rather than UUIDs, while retaining copyable IDs in detail.
 */
const DATASETS = {
  users: {
    profiles: {
      table: "profiles", permission: "users:read",
      columns: ["id", "first_name", "last_name", "other_names", "display_name", "avatar_url", "email", "phone", "account_status", "user_roles", "preferred_currency", "created_at", "updated_at"],
      search: ["id", "display_name", "first_name", "last_name", "other_names", "email", "phone"], statusColumn: "account_status",
    },
  },
  errands: {
    erands: {
      table: "erands", permission: "errands:read",
      columns: ["id", "reference_code", "title", "description", "category", "status", "currency_code", "estimated_total", "requested_by", "assigned_erander_id", "business_id", "location_snapshot", "location_address_id", "customer_notes", "current_version", "accepted_offer_id", "agreement_accepted_at", "agreement_locked_at", "scheduled_for", "expires_at", "offers_enabled", "max_erander_offers", "created_at", "updated_at", "deleted_at"],
      search: ["id", "reference_code", "title", "description", "category"], statusColumn: "status", excludeDeleted: true,
      profileRefs: ["requested_by", "assigned_erander_id"],
      relatedErrand: false,
    },
  },
  finance: {
    payments: { table: "erand_payments", permission: "finance:read", columns: ["id", "erand_id", "payer_id", "payment_type", "amount", "currency_code", "status", "payment_provider", "provider_reference", "initiated_at", "provider_confirmed_at", "platform_confirmed_at", "failure_reason", "created_at"], search: ["id", "provider_reference", "payment_provider"], statusColumn: "status", profileRefs: ["payer_id"], relatedErrand: true },
    refunds: { table: "erand_refunds", permission: "finance:read", columns: ["id", "payment_id", "requested_by", "amount", "currency_code", "status", "reason", "payment_provider", "provider_refund_reference", "initiated_at", "provider_confirmed_at", "platform_confirmed_at", "failure_reason", "created_at"], search: ["id", "provider_refund_reference", "payment_provider"], statusColumn: "status", profileRefs: ["requested_by"] },
    settlements: { table: "erand_settlements", permission: "finance:read", columns: ["id", "erand_id", "recipient_id", "settlement_type", "amount", "currency_code", "status", "payment_provider", "provider_reference", "approved_at", "initiated_at", "provider_confirmed_at", "platform_confirmed_at", "failure_reason", "created_at"], search: ["id", "provider_reference", "payment_provider", "settlement_type"], statusColumn: "status", profileRefs: ["recipient_id"], relatedErrand: true },
  },
  wallets: {
    wallets: { table: "wallets", permission: "wallets:read", columns: ["id", "profile_id", "currency_code", "available_balance", "pending_balance", "reserved_balance", "status", "created_at", "updated_at"], search: ["id", "profile_id", "currency_code"], statusColumn: "status", profileRefs: ["profile_id"] },
    transactions: { table: "wallet_transactions", permission: "wallets:read", columns: ["id", "wallet_id", "reference", "type", "amount_minor", "currency_code", "status", "description", "payment_provider", "provider_reference", "related_erand_id", "related_transaction_id", "created_at", "updated_at", "completed_at"], search: ["id", "wallet_id", "reference", "type", "description", "provider_reference"], statusColumn: "status", walletOwnerRef: true, relatedErrand: true, relatedErrandField: "related_erand_id" },
    accounts: { table: "withdrawal_accounts", permission: "wallets:read", columns: ["id", "profile_id", "payment_provider", "country_code", "currency_code", "bank_name", "bank_code", "account_name", "account_number_last4", "status", "is_default", "verified_at", "created_at", "updated_at"], search: ["id", "profile_id", "bank_name", "account_name", "account_number_last4", "bank_code"], statusColumn: "status", profileRefs: ["profile_id"] },
  },
  withdrawals: {
    requests: { table: "withdrawal_requests", permission: "wallets:read", columns: ["id", "reference", "idempotency_key", "profile_id", "wallet_id", "withdrawal_account_id", "currency_code", "amount_minor", "fee_minor", "net_amount_minor", "wallet_transaction_id", "status", "payment_provider", "provider_transfer_reference", "provider_transfer_code", "bank_name_snapshot", "account_name_snapshot", "account_number_last4_snapshot", "provider_recipient_code_snapshot", "reviewed_by", "reviewed_at", "processed_at", "completed_at", "failure_reason", "rejection_reason", "metadata", "created_at", "updated_at"], search: ["id", "reference", "profile_id", "wallet_transaction_id", "bank_name_snapshot", "account_name_snapshot", "account_number_last4_snapshot", "provider_transfer_reference", "provider_transfer_code", "failure_reason", "rejection_reason"], statusColumn: "status", profileRefs: ["profile_id", "reviewed_by"] },
  },
  "security-deposits": {
    accounts: { table: "erander_security_deposit_accounts", permission: "security_deposits:read", columns: ["id", "erander_id", "account_status", "tier", "required_deposit_percent", "deposit_requirement_waived", "waiver_reason", "waived_by", "waived_at", "notes", "created_at", "updated_at"], search: ["id", "erander_id", "account_status", "waiver_reason"], statusColumn: "account_status", profileRefs: ["erander_id", "waived_by"], depositAccountSummary: true },
    reservations: { table: "erander_security_deposit_reservations", permission: "security_deposits:read", columns: ["id", "security_account_id", "erand_id", "amount_minor", "currency_code", "status", "reserved_at", "released_at", "release_reason", "notes", "created_at", "updated_at"], search: ["id", "security_account_id", "erand_id", "release_reason"], statusColumn: "status", relatedErrand: true, securityAccountOwnerRef: true },
    claims: { table: "erander_security_deposit_claims", permission: "security_deposits:read", columns: ["id", "reservation_id", "erand_id", "customer_id", "erander_id", "currency_code", "requested_amount_minor", "approved_amount_minor", "status", "claim_reason", "evidence", "trust_safety_decision", "trust_safety_reason", "trust_safety_decided_by", "trust_safety_decided_at", "finance_authorized_by", "finance_authorized_at", "settled_at", "created_at", "updated_at"], search: ["id", "reservation_id", "erand_id", "customer_id", "erander_id", "claim_reason"], statusColumn: "status", profileRefs: ["customer_id", "erander_id", "trust_safety_decided_by", "finance_authorized_by"], relatedErrand: true },
    transactions: { table: "erander_security_deposit_transactions", permission: "security_deposits:read", columns: ["id", "security_account_id", "reservation_id", "erand_id", "wallet_transaction_id", "transaction_type", "amount_minor", "currency_code", "status", "payment_provider", "provider_reference", "reason", "failure_reason", "initiated_at", "provider_confirmed_at", "platform_confirmed_at", "created_at", "updated_at"], search: ["id", "security_account_id", "reservation_id", "erand_id", "provider_reference", "transaction_type"], statusColumn: "status", relatedErrand: true, securityAccountOwnerRef: true },
  },
  verification: {
    businesses: { table: "businesses", permission: "verification:read", columns: ["id", "name", "legal_name", "verification_status", "account_status", "country_code", "created_by", "email", "phone", "website", "description", "logo_url", "created_at", "updated_at"], search: ["id", "name", "legal_name", "country_code", "email", "phone"], statusColumn: "verification_status", profileRefs: ["created_by"] },
  },
  disputes: {
    disputed_errands: { table: "erands", permission: "disputes:read", columns: ["id", "reference_code", "title", "description", "category", "status", "currency_code", "estimated_total", "requested_by", "assigned_erander_id", "created_at", "updated_at"], search: ["id", "reference_code", "title", "description"], statusColumn: "status", fixedStatus: "disputed", excludeDeleted: true, profileRefs: ["requested_by", "assigned_erander_id"], relatedErrand: false },
  },
  reconciliation: {
    runs: { table: "financial_reconciliation_runs", permission: "reconciliation:read", columns: ["id", "reference", "run_type", "started_by", "payment_provider", "currency_code", "status", "started_at", "completed_at", "total_records_checked", "total_issues_found", "total_issues_resolved", "failure_reason", "summary", "created_at", "updated_at"], search: ["id", "reference", "run_type", "payment_provider", "currency_code"], statusColumn: "status", profileRefs: ["started_by"] },
    issues: { table: "financial_reconciliation_issues", permission: "reconciliation:read", columns: ["id", "issue_reference", "issue_type", "severity", "status", "currency_code", "payment_provider", "provider_reference", "related_payment_id", "related_withdrawal_request_id", "related_wallet_transaction_id", "related_wallet_id", "description", "resolution_notes", "assigned_to", "resolved_by", "resolved_at", "created_at", "updated_at"], search: ["id", "issue_reference", "issue_type", "provider_reference", "description"], statusColumn: "status", profileRefs: ["assigned_to", "resolved_by"] },
  },
  "audit-logs": {
    audit_logs: { table: "audit_logs", permission: "audit_logs:read", columns: ["id", "event_category", "actor_id", "target_profile_id", "assignment_id", "action", "entity_type", "entity_id", "role_code", "reason", "before_data", "after_data", "metadata", "created_at"], search: ["id", "event_category", "actor_id", "target_profile_id", "action", "entity_type", "entity_id", "role_code", "reason"], profileRefs: ["actor_id", "target_profile_id"] },
  },
};

const columnCache = new Map();
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

async function getAvailableColumns(pool, table) {
  if (columnCache.has(table)) return columnCache.get(table);
  const result = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row.data_type]));
  columnCache.set(table, columns);
  return columns;
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function buildWhere(config, available, query, status, values) {
  const clauses = [];
  if (config.excludeDeleted && available.has("deleted_at")) clauses.push('t."deleted_at" IS NULL');
  if (config.fixedStatus && config.statusColumn && available.has(config.statusColumn)) {
    values.push(config.fixedStatus); clauses.push(`t.${quoteIdentifier(config.statusColumn)} = $${values.length}`);
  }
  if (status && config.statusColumn && available.has(config.statusColumn)) {
    values.push(status); clauses.push(`t.${quoteIdentifier(config.statusColumn)}::text = $${values.length}`);
  }
  if (query) {
    const fields = config.search.filter((field) => available.has(field));
    if (fields.length) {
      values.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
      const parameter = `$${values.length}`;
      clauses.push(`(${fields.map((field) => `t.${quoteIdentifier(field)}::text ILIKE ${parameter} ESCAPE '\\'`).join(" OR ")})`);
    }
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function profileJson(alias) {
  return `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', ${alias}.id, 'first_name', ${alias}.first_name, 'last_name', ${alias}.last_name,
    'other_names', ${alias}.other_names, 'display_name', ${alias}.display_name,
    'avatar_url', ${alias}.avatar_url,
    'account_status', ${alias}.account_status, 'user_roles', ${alias}.user_roles,
    'preferred_currency', ${alias}.preferred_currency, 'created_at', ${alias}.created_at,
    'updated_at', ${alias}.updated_at
  ) END`;
}

function personJoins(config, available) {
  const joins = [];
  const selects = [];
  (config.profileRefs || []).filter((field) => available.has(field)).forEach((field, index) => {
    const alias = `person_${index}`;
    joins.push(`LEFT JOIN public.profiles ${alias} ON ${alias}.id = t.${quoteIdentifier(field)}`);
    selects.push(`${profileJson(alias)} AS ${quoteIdentifier(`${field}_profile`)}`);
  });
  if (config.walletOwnerRef && available.has("wallet_id")) {
    joins.push('LEFT JOIN public.wallets owner_wallet ON owner_wallet.id = t."wallet_id"');
    joins.push("LEFT JOIN public.profiles wallet_owner ON wallet_owner.id = owner_wallet.profile_id");
    selects.push(`${profileJson("wallet_owner")} AS "wallet_profile"`);
    selects.push(`${profileJson("wallet_owner")} AS "wallet_owner"`);
  }
  if (config.securityAccountOwnerRef && available.has("security_account_id")) {
    joins.push('LEFT JOIN public.erander_security_deposit_accounts deposit_account ON deposit_account.id = t."security_account_id"');
    joins.push("LEFT JOIN public.profiles deposit_owner ON deposit_owner.id = deposit_account.erander_id");
    selects.push(`${profileJson("deposit_owner")} AS "erander_profile"`);
    selects.push(`${profileJson("deposit_owner")} AS "erander_owner"`);
  }
  if (config.depositAccountSummary) {
    selects.push(`(SELECT COUNT(*)::integer FROM public.erander_security_deposit_reservations r WHERE r.security_account_id=t.id) AS "reservation_count"`);
    selects.push(`(SELECT COUNT(*)::integer FROM public.erander_security_deposit_reservations r WHERE r.security_account_id=t.id AND r.status IN ('reserved','under_review')) AS "active_reservation_count"`);
    selects.push(`COALESCE((SELECT jsonb_agg(jsonb_build_object('currency_code', totals.currency_code, 'amount_minor', totals.amount_minor) ORDER BY totals.currency_code) FROM (SELECT r.currency_code, SUM(r.amount_minor)::bigint AS amount_minor FROM public.erander_security_deposit_reservations r WHERE r.security_account_id=t.id AND r.status IN ('reserved','under_review') GROUP BY r.currency_code) totals), '[]'::jsonb) AS "reserved_by_currency"`);
    selects.push(`COALESCE((SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object('errand', CASE WHEN e2.id IS NULL THEN NULL ELSE jsonb_build_object('id',e2.id,'reference_code',e2.reference_code,'title',e2.title,'status',e2.status,'currency_code',e2.currency_code) END) ORDER BY r.created_at DESC) FROM public.erander_security_deposit_reservations r LEFT JOIN public.erands e2 ON e2.id=r.erand_id WHERE r.security_account_id=t.id),'[]'::jsonb) AS "deposit_reservations"`);
  }
  if (config.relatedErrand && available.has(config.relatedErrandField || "erand_id")) {
    joins.push(`LEFT JOIN public.erands related_erand ON related_erand.id = t.${quoteIdentifier(config.relatedErrandField || "erand_id")}`);
    selects.push(`CASE WHEN related_erand.id IS NULL THEN NULL ELSE jsonb_build_object('id', related_erand.id, 'reference_code', related_erand.reference_code, 'title', related_erand.title, 'status', related_erand.status, 'currency_code', related_erand.currency_code) END AS "related_erand"`);
  }
  return { joins: joins.join("\n"), selects };
}

export async function listAdminRecords(req, res, next) {
  try {
    const { section, dataset } = req.params;
    const config = DATASETS[section]?.[dataset];
    if (!config) return res.status(404).json({ success: false, message: "This administrative dataset is not available." });
    if (!hasAdminPermission(req.admin, config.permission)) return res.status(403).json({ success: false, message: "You do not have permission to view these records." });

    const pool = getDatabasePool();
    const available = await getAvailableColumns(pool, config.table);
    if (!available.size) return res.status(503).json({ success: false, message: `The configured table public.${config.table} is not available.` });
    const selectedColumns = config.columns.filter((field) => available.has(field));
    if (!selectedColumns.includes("id")) return res.status(503).json({ success: false, message: "The configured table does not expose its expected record identifier." });

    const page = parsePositiveInteger(req.query.page, 1, 1000000);
    const limit = parsePositiveInteger(req.query.limit, 20, 100);
    const search = String(req.query.search || "").trim().slice(0, 100);
    const status = String(req.query.status || "").trim().slice(0, 40);
    const values = [];
    const where = buildWhere(config, available, search, status, values);
    const orderColumn = ["created_at", "requested_at", "updated_at", "id"].find((field) => available.has(field)) || "id";
    const count = await pool.query(`SELECT COUNT(*)::bigint AS total FROM public.${quoteIdentifier(config.table)} t ${where}`, values);
    const total = Number(count.rows[0]?.total || 0);
    const offset = (page - 1) * limit;
    const params = [...values, limit, offset];
    const refs = personJoins(config, available);
    const selectSql = selectedColumns.map((field) => `t.${quoteIdentifier(field)}`).concat(refs.selects).join(",\n");
    const responseColumns = [...selectedColumns, ...(config.depositAccountSummary ? ["reservation_count", "active_reservation_count", "reserved_by_currency"] : []), ...(config.walletOwnerRef ? ["wallet_owner"] : []), ...(config.securityAccountOwnerRef ? ["erander_owner"] : [])];
    const result = await pool.query(
      `SELECT ${selectSql} FROM public.${quoteIdentifier(config.table)} t
       ${refs.joins} ${where}
       ORDER BY t.${quoteIdentifier(orderColumn)} DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return res.status(200).json({ success: true, data: {
      section, dataset, items: result.rows, columns: responseColumns, page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)), permissions: req.admin.permissions || [], generatedAt: new Date().toISOString(),
    } });
  } catch (error) {
    console.error("Admin records query failed:", { section: req.params.section, dataset: req.params.dataset, code: error?.code || null, message: error?.message || "Unknown database error" });
    return next(error);
  }
}

export async function getAdminErrandDetails(req, res, next) {
  if (!["errands:read", "security_deposits:read", "finance:read", "disputes:read"].some((permission) => hasAdminPermission(req.admin, permission))) return res.status(403).json({ success: false, message: "You do not have permission to inspect errands." });
  const { erandId } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(erandId || "")) return res.status(400).json({ success: false, message: "A valid errand ID is required." });
  try {
    const pool = getDatabasePool();
    const result = await pool.query(`
      SELECT e.*,
        CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'first_name',c.first_name,'last_name',c.last_name,'other_names',c.other_names,'display_name',c.display_name,'avatar_url',c.avatar_url,'account_status',c.account_status,'user_roles',c.user_roles) END AS customer,
        CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'first_name',r.first_name,'last_name',r.last_name,'other_names',r.other_names,'display_name',r.display_name,'avatar_url',r.avatar_url,'account_status',r.account_status,'user_roles',r.user_roles) END AS assigned_erander,
        CASE WHEN b.id IS NULL THEN NULL ELSE to_jsonb(b) END AS business,
        COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.created_at) FROM public.erand_items i WHERE i.erand_id=e.id AND i.is_current=TRUE),'[]'::jsonb) AS items,
        COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sequence_number) FROM public.erand_stops s WHERE s.erand_id=e.id),'[]'::jsonb) AS stops,
        COALESCE((SELECT jsonb_agg(to_jsonb(v) || jsonb_build_object('changed_by_profile', CASE WHEN vp.id IS NULL THEN NULL ELSE jsonb_build_object('id',vp.id,'first_name',vp.first_name,'last_name',vp.last_name,'display_name',vp.display_name,'avatar_url',vp.avatar_url,'account_status',vp.account_status) END) ORDER BY v.version_number DESC) FROM public.erand_versions v LEFT JOIN public.profiles vp ON vp.id=v.changed_by WHERE v.erand_id=e.id),'[]'::jsonb) AS versions,
        COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object(
          'offered_by_profile', CASE WHEN op.id IS NULL THEN NULL ELSE jsonb_build_object('id',op.id,'first_name',op.first_name,'last_name',op.last_name,'display_name',op.display_name,'avatar_url',op.avatar_url,'account_status',op.account_status) END,
          'items', COALESCE((SELECT jsonb_agg(to_jsonb(oi) || jsonb_build_object('item',to_jsonb(ei)) ORDER BY ei.sort_order,oi.created_at) FROM public.erand_offer_items oi LEFT JOIN public.erand_items ei ON ei.id=oi.erand_item_id WHERE oi.offer_id=o.id),'[]'::jsonb)
        ) ORDER BY o.created_at DESC) FROM public.erand_offers o LEFT JOIN public.profiles op ON op.id=o.offered_by WHERE o.erand_id=e.id),'[]'::jsonb) AS offers,
        COALESCE((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('payer_profile', CASE WHEN pp.id IS NULL THEN NULL ELSE jsonb_build_object('id',pp.id,'first_name',pp.first_name,'last_name',pp.last_name,'display_name',pp.display_name,'avatar_url',pp.avatar_url) END, 'refunds', COALESCE((SELECT jsonb_agg(to_jsonb(rf) ORDER BY rf.created_at DESC) FROM public.erand_refunds rf WHERE rf.payment_id=p.id),'[]'::jsonb), 'confirmations', COALESCE((SELECT jsonb_agg(to_jsonb(pc) ORDER BY pc.created_at DESC) FROM public.erand_payment_confirmations pc WHERE pc.payment_id=p.id),'[]'::jsonb), 'events', COALESCE((SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.created_at DESC) FROM public.erand_payment_events pe WHERE pe.payment_id=p.id),'[]'::jsonb)) ORDER BY p.created_at DESC) FROM public.erand_payments p LEFT JOIN public.profiles pp ON pp.id=p.payer_id WHERE p.erand_id=e.id),'[]'::jsonb) AS payments,
        COALESCE((SELECT jsonb_agg(to_jsonb(st) || jsonb_build_object('recipient_profile', CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object('id',sp.id,'first_name',sp.first_name,'last_name',sp.last_name,'display_name',sp.display_name,'avatar_url',sp.avatar_url,'account_status',sp.account_status) END) ORDER BY st.created_at DESC) FROM public.erand_settlements st LEFT JOIN public.profiles sp ON sp.id=st.recipient_id WHERE st.erand_id=e.id),'[]'::jsonb) AS settlements,
        COALESCE((SELECT jsonb_agg(to_jsonb(j) || jsonb_build_object('entries', COALESCE((SELECT jsonb_agg(to_jsonb(le) ORDER BY le.created_at) FROM public.erand_ledger_entries le WHERE le.journal_id=j.id),'[]'::jsonb)) ORDER BY j.created_at DESC) FROM public.erand_ledger_journals j WHERE j.erand_id=e.id),'[]'::jsonb) AS ledger_journals,
        COALESCE((SELECT jsonb_agg(to_jsonb(sr) ORDER BY sr.created_at DESC) FROM public.erander_security_deposit_reservations sr WHERE sr.erand_id=e.id),'[]'::jsonb) AS security_deposit_reservations,
        COALESCE((SELECT jsonb_agg(to_jsonb(cl) ORDER BY cl.created_at DESC) FROM public.erander_security_deposit_claims cl WHERE cl.erand_id=e.id),'[]'::jsonb) AS security_deposit_claims,
        COALESCE((SELECT jsonb_agg(to_jsonb(tx) ORDER BY tx.created_at DESC) FROM public.erander_security_deposit_transactions tx WHERE tx.erand_id=e.id),'[]'::jsonb) AS security_deposit_transactions
      FROM public.erands e
      LEFT JOIN public.profiles c ON c.id=e.requested_by
      LEFT JOIN public.profiles r ON r.id=e.assigned_erander_id
      LEFT JOIN public.businesses b ON b.id=e.business_id
      WHERE e.id=$1::uuid LIMIT 1
    `, [erandId]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Errand not found." });
    return res.json({ success: true, data: { errand: result.rows[0] } });
  } catch (error) { return next(error); }
}

export async function getAdminUserDetails(req, res, next) {
  const canReadFullProfile = hasAdminPermission(req.admin, "users:read");
  const canReadWallets = hasAdminPermission(req.admin, "wallets:read");
  const canReadRelatedContext = ["finance:read", "security_deposits:read", "verification:read", "audit_logs:read", "disputes:read"].some((permission) => hasAdminPermission(req.admin, permission));
  if (!canReadFullProfile && !canReadWallets && !canReadRelatedContext) return res.status(403).json({ success: false, message: "You do not have permission to inspect this user." });
  const { profileId } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId || "")) return res.status(400).json({ success: false, message: "A valid profile ID is required." });
  try {
    const pool = getDatabasePool();
    const profileSql = canReadFullProfile
      ? "SELECT id,first_name,last_name,other_names,display_name,avatar_url,phone,account_status,user_roles,preferred_currency,addresses,created_at,updated_at FROM public.profiles WHERE id=$1::uuid LIMIT 1"
      : "SELECT id,first_name,last_name,display_name,avatar_url,account_status,created_at FROM public.profiles WHERE id=$1::uuid LIMIT 1";
    const profile = await pool.query(profileSql, [profileId]);
    if (!profile.rows[0]) return res.status(404).json({ success: false, message: "User profile not found." });
    let wallets = { rows: [] }, accounts = { rows: [] }, transactions = { rows: [] };
    if (canReadWallets) {
      [wallets, accounts, transactions] = await Promise.all([
        pool.query("SELECT id,profile_id,currency_code,available_balance,pending_balance,reserved_balance,status,created_at,updated_at FROM public.wallets WHERE profile_id=$1::uuid ORDER BY currency_code", [profileId]),
        pool.query("SELECT id,profile_id,payment_provider,country_code,currency_code,bank_name,bank_code,account_name,account_number_last4,status,is_default,verified_at,provider_recipient_code,created_at,updated_at FROM public.withdrawal_accounts WHERE profile_id=$1::uuid ORDER BY is_default DESC,created_at DESC", [profileId]),
        pool.query("SELECT wt.id,wt.wallet_id,wt.reference,wt.type,wt.amount_minor,wt.currency_code,wt.status,wt.description,wt.related_erand_id,wt.payment_provider,wt.provider_reference,wt.created_at,wt.completed_at FROM public.wallet_transactions wt JOIN public.wallets w ON w.id=wt.wallet_id WHERE w.profile_id=$1::uuid ORDER BY wt.created_at DESC LIMIT 100", [profileId]),
      ]);
    }
    return res.json({ success: true, data: { profile: profile.rows[0], wallets: wallets.rows, withdrawalAccounts: accounts.rows, recentTransactions: transactions.rows } });
  } catch (error) { return next(error); }
}


const ADMIN_TRANSACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Full, read-only investigation view for financial transaction records. */
export async function getAdminTransactionDetails(req, res, next) {
  const { transactionId } = req.params;
  const kind = String(req.query.kind || "wallet").trim().toLowerCase();
  const permissionByKind = {
    wallet: "wallets:read",
    "security-deposit": "security_deposits:read",
    reservation: "security_deposits:read",
    claim: "security_deposits:read",
    payment: "finance:read",
    refund: "finance:read",
    settlement: "finance:read",
    withdrawal: "wallets:read",
  };
  const permission = permissionByKind[kind];
  if (!permission) return res.status(400).json({ success: false, message: "Unsupported transaction type." });
  if (!hasAdminPermission(req.admin, permission)) return res.status(403).json({ success: false, message: "You do not have permission to inspect this transaction." });
  if (!ADMIN_TRANSACTION_ID_PATTERN.test(transactionId || "")) return res.status(400).json({ success: false, message: "A valid transaction ID is required." });

  try {
    const pool = getDatabasePool();
    let transaction = null;
    let details = {};

    if (kind === "wallet") {
      const result = await pool.query("SELECT * FROM public.wallet_transactions WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) details = await loadWalletTransactionDetails(pool, transaction);
    } else if (kind === "withdrawal") {
      const result = await pool.query("SELECT * FROM public.withdrawal_requests WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction?.wallet_transaction_id) {
        const walletResult = await pool.query("SELECT * FROM public.wallet_transactions WHERE id=$1::uuid LIMIT 1", [transaction.wallet_transaction_id]);
        if (walletResult.rows[0]) {
          details = await loadWalletTransactionDetails(pool, walletResult.rows[0]);
          details.walletTransaction = walletResult.rows[0];
        }
      }
    } else if (kind === "security-deposit") {
      const result = await pool.query("SELECT * FROM public.erander_security_deposit_transactions WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        if (transaction.wallet_transaction_id) {
          const walletResult = await pool.query("SELECT * FROM public.wallet_transactions WHERE id=$1::uuid LIMIT 1", [transaction.wallet_transaction_id]);
          if (walletResult.rows[0]) {
            details = await loadWalletTransactionDetails(pool, walletResult.rows[0]);
            details.walletTransaction = walletResult.rows[0];
          }
        }
        if (transaction.reservation_id) {
          const [reservation, claims] = await Promise.all([
            pool.query("SELECT * FROM public.erander_security_deposit_reservations WHERE id=$1::uuid LIMIT 1", [transaction.reservation_id]),
            pool.query("SELECT * FROM public.erander_security_deposit_claims WHERE reservation_id=$1::uuid ORDER BY created_at ASC", [transaction.reservation_id]),
          ]);
          details.reservation = reservation.rows[0] || null;
          details.claims = claims.rows;
        }
      }
    } else if (kind === "reservation") {
      const result = await pool.query("SELECT * FROM public.erander_security_deposit_reservations WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        const [claims, depositTransactions, errand] = await Promise.all([
          pool.query("SELECT * FROM public.erander_security_deposit_claims WHERE reservation_id=$1::uuid ORDER BY created_at ASC", [transactionId]),
          pool.query("SELECT * FROM public.erander_security_deposit_transactions WHERE reservation_id=$1::uuid ORDER BY created_at ASC", [transactionId]),
          pool.query("SELECT id,reference_code,title,status,category,currency_code,estimated_total,requested_by,assigned_erander_id,created_at,updated_at FROM public.erands WHERE id=$1::uuid LIMIT 1", [transaction.erand_id]),
        ]);
        details = { claims: claims.rows, securityDepositTransactions: depositTransactions.rows, errand: errand.rows[0] || null };
      }
    } else if (kind === "claim") {
      const result = await pool.query("SELECT * FROM public.erander_security_deposit_claims WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        const [reservation, depositTransactions, errand] = await Promise.all([
          pool.query("SELECT * FROM public.erander_security_deposit_reservations WHERE id=$1::uuid LIMIT 1", [transaction.reservation_id]),
          pool.query("SELECT * FROM public.erander_security_deposit_transactions WHERE reservation_id=$1::uuid ORDER BY created_at ASC", [transaction.reservation_id]),
          pool.query("SELECT id,reference_code,title,status,category,currency_code,estimated_total,requested_by,assigned_erander_id,created_at,updated_at FROM public.erands WHERE id=$1::uuid LIMIT 1", [transaction.erand_id]),
        ]);
        details = { reservation: reservation.rows[0] || null, securityDepositTransactions: depositTransactions.rows, errand: errand.rows[0] || null };
      }
    } else if (kind === "payment") {
      const result = await pool.query("SELECT * FROM public.erand_payments WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        const [refunds, events, confirmations, errand] = await Promise.all([
          pool.query("SELECT * FROM public.erand_refunds WHERE payment_id=$1::uuid ORDER BY created_at ASC", [transactionId]),
          pool.query("SELECT * FROM public.erand_payment_events WHERE payment_id=$1::uuid ORDER BY created_at ASC", [transactionId]),
          pool.query("SELECT to_jsonb(pc) AS record FROM public.erand_payment_confirmations pc WHERE pc.payment_id=$1::uuid ORDER BY pc.created_at ASC", [transactionId]),
          pool.query("SELECT id,reference_code,title,status,category,currency_code,estimated_total,requested_by,assigned_erander_id,created_at,updated_at FROM public.erands WHERE id=$1::uuid LIMIT 1", [transaction.erand_id]),
        ]);
        details = { refunds: refunds.rows, paymentEvents: events.rows, paymentConfirmations: confirmations.rows.map((item) => item.record), errand: errand.rows[0] || null };
      }
    } else if (kind === "refund") {
      const result = await pool.query("SELECT * FROM public.erand_refunds WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        const payment = await pool.query("SELECT * FROM public.erand_payments WHERE id=$1::uuid LIMIT 1", [transaction.payment_id]);
        details.payment = payment.rows[0] || null;
        if (payment.rows[0]) {
          const [events, confirmations, siblings] = await Promise.all([
            pool.query("SELECT * FROM public.erand_payment_events WHERE payment_id=$1::uuid ORDER BY created_at ASC", [transaction.payment_id]),
            pool.query("SELECT to_jsonb(pc) AS record FROM public.erand_payment_confirmations pc WHERE pc.payment_id=$1::uuid ORDER BY pc.created_at ASC", [transaction.payment_id]),
            pool.query("SELECT * FROM public.erand_refunds WHERE payment_id=$1::uuid ORDER BY created_at ASC", [transaction.payment_id]),
          ]);
          details.paymentEvents = events.rows;
          details.paymentConfirmations = confirmations.rows.map((item) => item.record);
          details.relatedRefunds = siblings.rows;
        }
      }
    } else if (kind === "settlement") {
      const result = await pool.query("SELECT * FROM public.erand_settlements WHERE id=$1::uuid LIMIT 1", [transactionId]);
      transaction = result.rows[0] || null;
      if (transaction) {
        const errand = await pool.query("SELECT id,reference_code,title,status,category,currency_code,estimated_total,requested_by,assigned_erander_id,created_at,updated_at FROM public.erands WHERE id=$1::uuid LIMIT 1", [transaction.erand_id]);
        details.errand = errand.rows[0] || null;
      }
    }

    if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found." });

    const auditEntityIds = [transactionId];
    if (kind === "withdrawal" && transaction?.wallet_transaction_id) {
      auditEntityIds.push(transaction.wallet_transaction_id);
    }
    const [audit, ledger] = await Promise.all([
      pool.query("SELECT id,event_category,actor_id,target_profile_id,assignment_id,action,entity_type,entity_id,role_code,reason,before_data,after_data,metadata,created_at FROM public.audit_logs WHERE entity_id = ANY($1::text[]) ORDER BY created_at ASC", [auditEntityIds]),
      kind === "wallet"
        ? pool.query("SELECT transaction_id,account_id,entry_side,amount_minor,currency_code,description FROM public.wallet_ledger_entries WHERE transaction_id=$1::uuid", [transactionId])
        : kind === "withdrawal" && transaction?.wallet_transaction_id
          ? pool.query("SELECT transaction_id,account_id,entry_side,amount_minor,currency_code,description FROM public.wallet_ledger_entries WHERE transaction_id=$1::uuid", [transaction.wallet_transaction_id])
          : Promise.resolve({ rows: [] }),
    ]);

    return res.json({
      success: true,
      data: {
        kind,
        transaction,
        details: { ...details, ledgerEntries: details.ledgerEntries || ledger.rows, adminAudit: audit.rows },
        communications: { available: false, message: "The supplied v5 backend does not expose a transaction-linked messaging model. No unrelated private messages are included." },
      },
    });
  } catch (error) { return next(error); }
}

export async function getAdminSettingsAvailability(req, res) {
  if (!hasAdminPermission(req.admin, "settings:read")) return res.status(403).json({ success: false, message: "You do not have permission to view platform settings." });
  return res.status(200).json({ success: true, data: { configured: false, message: "No versioned platform settings model was present in the supplied schema. Settings remain informational until a persistent configuration model and audited workflow are established.", permissions: req.admin.permissions || [] } });
}
