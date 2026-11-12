import { getDatabasePool } from "../../../config/database.js";
import { hasAdminPermission } from "../auth/adminPermissions.js";

const CONFIG_KEYS = [
  "finance.commission_policy",
  "finance.compensation_limits",
  "finance.expense_policy",
  "funding.release_policy",
  "wallet.earnings_policy",
  "security_deposit.policy",
  "platform.risk_policy",
];

const COMMISSION_FINANCE_EDITABLE_KEYS = new Set([
  "default_rate_percent",
  "category_overrides",
  "country_overrides",
  "business_plan_overrides",
]);

function fail(res, status, message, code = "CONFIGURATION_REQUEST_FAILED") {
  return res.status(status).json({ success: false, message, code });
}

function cleanText(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function isSuperAdmin(req) {
  return hasAdminPermission(req.admin, "system_config:manage");
}

function canRead(req) {
  return hasAdminPermission(req.admin, "system_config:read") || isSuperAdmin(req);
}

function canManageCommission(req) {
  return hasAdminPermission(req.admin, "commission:manage") || isSuperAdmin(req);
}

function validPercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validateRateMap(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `${label} must be an object of percentage rates.`;
  for (const [key, rate] of Object.entries(value)) {
    if (!key.trim() || !validPercent(rate)) return `${label} contains an invalid percentage for ${key || "an unnamed entry"}.`;
  }
  return null;
}

function validateConfiguration(key, config, currentConfig, financeOnly) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "Configuration must be a JSON object.";

  if (key === "finance.commission_policy") {
    const { default_rate_percent: rate, minimum_rate_percent: min, maximum_rate_percent: max } = config;
    if (![rate, min, max].every(validPercent)) return "Commission rates must be numbers between 0 and 100.";
    if (min > max || rate < min || rate > max) return "The default commission rate must be within the configured minimum and maximum.";
    if (config.calculation_base !== "erander_retained_compensation") return "Commission must be calculated from erander-retained compensation.";
    if (config.generic_other_fee_allowed !== false) return "An unrestricted commission-exempt Other fee is not permitted.";
    if (!Array.isArray(config.commissionable_components) || !config.commissionable_components.includes("other_additional_compensation")) {
      return "All additional erander compensation must remain commissionable.";
    }
    if (!Array.isArray(config.excluded_components) || !config.excluded_components.includes("approved_reimbursable_expense")) {
      return "Only approved reimbursable expenses may be excluded from commission.";
    }
    for (const [name, map] of [["Category overrides", config.category_overrides], ["Country overrides", config.country_overrides], ["Business-plan overrides", config.business_plan_overrides]]) {
      const error = validateRateMap(map, name);
      if (error) return error;
      for (const [scope, overrideRate] of Object.entries(map)) {
        if (overrideRate < min || overrideRate > max) return `${name} rate for ${scope} must be between ${min}% and ${max}%.`;
      }
    }
    if (financeOnly) {
      if (!currentConfig) return "A Super Admin must activate the initial commission boundaries before Finance Admins can manage rates.";
      for (const field of Object.keys(config)) {
        if (!COMMISSION_FINANCE_EDITABLE_KEYS.has(field) && JSON.stringify(config[field]) !== JSON.stringify(currentConfig[field])) {
          return `Finance Admins cannot change the protected commission setting: ${field}.`;
        }
      }
      if (rate < currentConfig.minimum_rate_percent || rate > currentConfig.maximum_rate_percent) {
        return `The commission rate must remain between ${currentConfig.minimum_rate_percent}% and ${currentConfig.maximum_rate_percent}%.`;
      }
      for (const mapName of ["category_overrides", "country_overrides", "business_plan_overrides"]) {
        for (const [scope, overrideRate] of Object.entries(config[mapName] || {})) {
          if (overrideRate < currentConfig.minimum_rate_percent || overrideRate > currentConfig.maximum_rate_percent) {
            return `${mapName} rate for ${scope} must remain within the Super Admin-approved range (${currentConfig.minimum_rate_percent}%–${currentConfig.maximum_rate_percent}%).`;
          }
        }
      }
    }
    return null;
  }

  if (key === "finance.compensation_limits") {
    if (!config.category_limits || typeof config.category_limits !== "object" || Array.isArray(config.category_limits)) return "Category compensation limits must be an object.";
    if (config.review_if_unconfigured !== true) return "Unconfigured compensation limits must require review.";
    for (const [category, limits] of Object.entries(config.category_limits)) {
      if (!limits || typeof limits !== "object" || Array.isArray(limits)) return `Limits for ${category} must be an object.`;
      for (const field of ["max_amount_minor", "max_percent_of_item_budget"]) {
        const value = limits[field];
        if (value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || (field === "max_percent_of_item_budget" && Number(value) > 100))) {
          return `The ${field} value for ${category} is invalid.`;
        }
      }
    }
    return null;
  }

  if (key === "finance.expense_policy") {
    for (const field of ["customer_approval_required", "description_required", "justification_required", "evidence_required", "other_expense_requires_manual_review", "excluded_from_commission_only_when_approved"]) {
      if (config[field] !== true) return `${field.replaceAll("_", " ")} must remain enabled.`;
    }
    if (!Array.isArray(config.allowed_reimbursable_types) || !config.allowed_reimbursable_types.length) return "At least one approved reimbursable expense type is required.";
    return null;
  }

  if (key === "funding.release_policy") {
    if (config.release_mode !== "full_only" || config.allow_partial_release !== false) return "ERANDER v1 supports full release only. Partial release must remain disabled.";
    for (const field of ["agreement_disclosure_required_before_acceptance", "customer_funding_must_be_confirmed", "admin_approval_required", "execution_funds_release_must_be_confirmed"]) {
      if (config[field] !== true) return `${field.replaceAll("_", " ")} must remain enabled.`;
    }
    return null;
  }

  if (key === "wallet.earnings_policy") {
    for (const field of ["credit_pending_after_successful_execution_fund_release", "make_available_after_errand_completion", "hold_if_dispute_or_review", "security_deposit_is_separate"]) {
      if (config[field] !== true) return `${field.replaceAll("_", " ")} must remain enabled.`;
    }
    return null;
  }

  if (key === "security_deposit.policy") {
    if (Number(config.required_reservation_percent) !== 100) return "The ERANDER v1 security-deposit reservation requirement is 100%.";
    if (config.tiered_requirements_enabled !== false) return "Tiered security-deposit requirements are disabled in v1.";
    for (const field of ["waiver_requires_super_admin", "waiver_reason_required", "waiver_audit_required", "deposit_is_not_a_fee"]) {
      if (config[field] !== true) return `${field.replaceAll("_", " ")} must remain enabled.`;
    }
    return null;
  }

  if (key === "platform.risk_policy") {
    for (const field of ["unconfigured_compensation_requires_review", "flag_suspected_contact_exchange", "admin_chat_review_permitted"]) {
      if (config[field] !== true) return `${field.replaceAll("_", " ")} must remain enabled.`;
    }
    if (config.chat_is_end_to_end_encrypted !== false) return "The chat transparency setting must accurately state that chat is not end-to-end encrypted.";
    return null;
  }

  return "This configuration key is not supported.";
}

async function getActiveConfig(client, key) {
  const result = await client.query(
    `SELECT v.id, v.config_key, v.config, v.version_number, a.effective_at
       FROM public.platform_configuration_activations a
       JOIN public.platform_configuration_versions v ON v.id = a.config_version_id
      WHERE v.config_key = $1
        AND a.effective_at <= now()
        AND (a.superseded_at IS NULL OR a.superseded_at > now())
      ORDER BY a.effective_at DESC
      LIMIT 1`,
    [key],
  );
  return result.rows[0] || null;
}

function configurationSnapshot(version) {
  if (!version) return {};
  return {
    config_key: version.config_key,
    version_id: version.id,
    version_number: version.version_number,
    config: version.config,
  };
}

async function writeConfigurationAudit(client, {
  req,
  configKey,
  action,
  reason,
  beforeVersion = null,
  afterVersion = null,
  metadata = {},
  roleCode,
}) {
  await client.query(
    `INSERT INTO public.audit_logs
       (event_category, actor_id, action, entity_type, entity_id, role_code,
        reason, before_data, after_data, metadata)
     VALUES
       ('platform_configuration', $1::uuid, $2, 'platform_configuration', $3, $4,
        $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
    [
      req.admin.id,
      action,
      configKey,
      roleCode,
      reason,
      JSON.stringify(configurationSnapshot(beforeVersion)),
      JSON.stringify(configurationSnapshot(afterVersion)),
      JSON.stringify({
        source: 'admin_configuration_api',
        configKey,
        versionId: afterVersion?.id || null,
        previousVersionId: beforeVersion?.id || null,
        versionNumber: afterVersion?.version_number ?? null,
        ...metadata,
      }),
    ],
  );
}

export async function listPlatformConfiguration(req, res, next) {
  if (!canRead(req)) return fail(res, 403, "You do not have permission to view system configuration.", "ADMIN_PERMISSION_REQUIRED");
  try {
    const result = await getDatabasePool().query(
      `SELECT v.id, v.config_key, v.version_number, v.config, v.change_reason,
              v.created_by, v.created_at, a.activated_by, a.activation_reason,
              a.effective_at, a.superseded_at,
              CASE
                WHEN a.id IS NULL THEN 'draft'
                WHEN a.effective_at > now() AND (a.superseded_at IS NULL OR a.superseded_at > now()) THEN 'scheduled'
                WHEN a.effective_at <= now() AND (a.superseded_at IS NULL OR a.superseded_at > now()) THEN 'active'
                ELSE 'superseded'
              END AS version_status
         FROM public.platform_configuration_versions v
         LEFT JOIN public.platform_configuration_activations a ON a.config_version_id = v.id
        ORDER BY v.config_key, v.version_number DESC`,
    );
    const groups = CONFIG_KEYS.map((key) => {
      const versions = result.rows.filter((row) => row.config_key === key);
      return {
        key,
        active: versions.find((row) => row.version_status === "active") || null,
        scheduled: versions.find((row) => row.version_status === "scheduled") || null,
        drafts: versions.filter((row) => row.version_status === "draft"),
        history: versions,
      };
    });
    return res.json({
      success: true,
      data: {
        groups,
        permissions: {
          canRead: true,
          canManageAll: isSuperAdmin(req),
          canManageCommission: canManageCommission(req),
          isSuperAdmin: isSuperAdmin(req),
        },
      },
    });
  } catch (error) { return next(error); }
}

export async function getPlatformConfigurationHistory(req, res, next) {
  if (!canRead(req)) return fail(res, 403, "You do not have permission to view system configuration.", "ADMIN_PERMISSION_REQUIRED");
  const { configKey } = req.params;
  if (!CONFIG_KEYS.includes(configKey)) return fail(res, 404, "Configuration section not found.", "CONFIGURATION_NOT_FOUND");
  try {
    const result = await getDatabasePool().query(
      `SELECT v.id, v.config_key, v.version_number, v.config, v.change_reason,
              v.created_by, v.created_at, a.activated_by, a.activation_reason,
              a.effective_at, a.superseded_at,
              CASE
                WHEN a.id IS NULL THEN 'draft'
                WHEN a.effective_at > now() AND (a.superseded_at IS NULL OR a.superseded_at > now()) THEN 'scheduled'
                WHEN a.effective_at <= now() AND (a.superseded_at IS NULL OR a.superseded_at > now()) THEN 'active'
                ELSE 'superseded'
              END AS version_status
         FROM public.platform_configuration_versions v
         LEFT JOIN public.platform_configuration_activations a ON a.config_version_id = v.id
        WHERE v.config_key = $1
        ORDER BY v.version_number DESC`, [configKey],
    );
    const audit = await getDatabasePool().query(
      `SELECT l.id, l.event_category, l.action, l.actor_id, l.role_code,
              l.reason, l.before_data, l.after_data, l.metadata, l.created_at,
              p.first_name, p.last_name, p.display_name
         FROM public.audit_logs l
         LEFT JOIN public.profiles p ON p.id = l.actor_id
        WHERE l.event_category = 'platform_configuration'
          AND l.entity_type = 'platform_configuration'
          AND l.entity_id = $1
        ORDER BY l.created_at DESC LIMIT 100`, [configKey],
    );
    return res.json({ success: true, data: { versions: result.rows, audit: audit.rows } });
  } catch (error) { return next(error); }
}

export async function createPlatformConfigurationDraft(req, res, next) {
  const { configKey } = req.params;
  const reason = cleanText(req.body?.reason, 1000);
  const config = req.body?.config;
  if (!CONFIG_KEYS.includes(configKey)) return fail(res, 404, "Configuration section not found.", "CONFIGURATION_NOT_FOUND");
  const financeOnly = !isSuperAdmin(req) && canManageCommission(req) && configKey === "finance.commission_policy";
  if (!isSuperAdmin(req) && !financeOnly) return fail(res, 403, "You do not have permission to change this configuration.", "ADMIN_PERMISSION_REQUIRED");
  if (reason.length < 10) return fail(res, 400, "Explain why this configuration change is needed (at least 10 characters).", "CONFIGURATION_REASON_REQUIRED");

  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [configKey]);
    const current = await getActiveConfig(client, configKey);
    const validationError = validateConfiguration(configKey, config, current?.config || null, financeOnly);
    if (validationError) {
      await client.query("ROLLBACK");
      return fail(res, 400, validationError, "CONFIGURATION_VALIDATION_FAILED");
    }
    const nextVersion = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM public.platform_configuration_versions WHERE config_key = $1`, [configKey],
    );
    const inserted = await client.query(
      `INSERT INTO public.platform_configuration_versions
         (config_key, version_number, config, change_reason, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5::uuid)
       RETURNING id, config_key, version_number, config, change_reason, created_at`,
      [configKey, Number(nextVersion.rows[0].next_version), JSON.stringify(config), reason, req.admin.id],
    );
    await writeConfigurationAudit(client, {
      req,
      configKey,
      action: "draft_created",
      reason,
      beforeVersion: current,
      afterVersion: inserted.rows[0],
      roleCode: financeOnly ? "finance_admin" : "super_admin",
      metadata: { draftCreated: true },
    });
    await client.query("COMMIT");
    return res.status(201).json({ success: true, message: "Configuration draft created. It is not live until activated.", data: { version: inserted.rows[0] } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally { client.release(); }
}

export async function activatePlatformConfiguration(req, res, next) {
  const { configKey } = req.params;
  const versionId = cleanText(req.body?.versionId, 80);
  const reason = cleanText(req.body?.reason, 1000);
  const effectiveAtRaw = req.body?.effectiveAt;
  if (!CONFIG_KEYS.includes(configKey)) return fail(res, 404, "Configuration section not found.", "CONFIGURATION_NOT_FOUND");
  const financeOnly = !isSuperAdmin(req) && canManageCommission(req) && configKey === "finance.commission_policy";
  if (!isSuperAdmin(req) && !financeOnly) return fail(res, 403, "You do not have permission to activate this configuration.", "ADMIN_PERMISSION_REQUIRED");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(versionId)) return fail(res, 400, "A valid draft version is required.", "INVALID_CONFIGURATION_VERSION");
  if (reason.length < 10) return fail(res, 400, "Explain why this configuration is being activated (at least 10 characters).", "CONFIGURATION_REASON_REQUIRED");
  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() < Date.now() - 60_000 || effectiveAt.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
    return fail(res, 400, "Effective date must be now or a future date within 12 months.", "INVALID_EFFECTIVE_DATE");
  }

  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [configKey]);
    const draftResult = await client.query(
      `SELECT v.id, v.config_key, v.version_number, v.config
         FROM public.platform_configuration_versions v
        WHERE v.id = $1::uuid AND v.config_key = $2
        FOR UPDATE`, [versionId, configKey],
    );
    const draft = draftResult.rows[0];
    if (!draft) { await client.query("ROLLBACK"); return fail(res, 404, "Configuration draft not found.", "CONFIGURATION_VERSION_NOT_FOUND"); }
    const alreadyActivated = await client.query("SELECT 1 FROM public.platform_configuration_activations WHERE config_version_id = $1::uuid", [versionId]);
    if (alreadyActivated.rows[0]) { await client.query("ROLLBACK"); return fail(res, 409, "This version has already been activated or scheduled.", "CONFIGURATION_VERSION_ALREADY_USED"); }
    const current = await getActiveConfig(client, configKey);
    if (current?.effective_at && effectiveAt.getTime() < new Date(current.effective_at).getTime()) {
      effectiveAt.setTime(new Date(current.effective_at).getTime());
    }
    const validationError = validateConfiguration(configKey, draft.config, current?.config || null, financeOnly);
    if (validationError) { await client.query("ROLLBACK"); return fail(res, 400, validationError, "CONFIGURATION_VALIDATION_FAILED"); }
    const pending = await client.query(
      `SELECT a.id FROM public.platform_configuration_activations a
         JOIN public.platform_configuration_versions v ON v.id = a.config_version_id
        WHERE v.config_key = $1 AND a.effective_at > now()
          AND (a.superseded_at IS NULL OR a.superseded_at > now())
        LIMIT 1`, [configKey],
    );
    if (pending.rows[0]) { await client.query("ROLLBACK"); return fail(res, 409, "There is already a scheduled configuration change for this section. Resolve it before scheduling another.", "CONFIGURATION_ALREADY_SCHEDULED"); }
    const previousVersionId = current?.id || null;
    if (current) {
      await client.query(
        `UPDATE public.platform_configuration_activations
            SET superseded_at = $2::timestamptz
          WHERE config_version_id = $1::uuid
            AND (superseded_at IS NULL OR superseded_at > now())`,
        [current.id, effectiveAt.toISOString()],
      );
    }
    const scheduled = effectiveAt.getTime() > Date.now() + 60_000;
    await client.query(
      `INSERT INTO public.platform_configuration_activations
         (config_version_id, activated_by, activation_reason, effective_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
      [versionId, req.admin.id, reason, effectiveAt.toISOString()],
    );
    await writeConfigurationAudit(client, {
      req,
      configKey,
      action: scheduled ? "scheduled" : "activated",
      reason,
      beforeVersion: current,
      afterVersion: draft,
      roleCode: financeOnly ? "finance_admin" : "super_admin",
      metadata: {
        effectiveAt: effectiveAt.toISOString(),
        scheduled,
      },
    });
    await client.query("COMMIT");
    return res.json({ success: true, message: scheduled ? "Configuration change scheduled." : "Configuration version activated.", data: { versionId, effectiveAt: effectiveAt.toISOString(), status: scheduled ? "scheduled" : "active" } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally { client.release(); }
}
