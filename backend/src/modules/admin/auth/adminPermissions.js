const ROLE_PERMISSIONS = {
  super_admin: ["*"],
  finance_admin: [
    "finance:read", "finance:manage", "wallets:read", "wallets:manage",
    "security_deposits:read", "security_deposits:manage", "security_deposits:settle",
    "reconciliation:read", "reconciliation:manage", "settings:manage", "system_config:read", "commission:manage",
  ],
  support_admin: ["users:read", "errands:read", "disputes:read", "disputes:manage"],
  trust_safety_admin: ["users:read", "users:restrict", "errands:read", "errands:safety_manage", "disputes:read", "disputes:manage", "security_deposits:read", "security_deposits:review"],
  verification_admin: ["users:read", "verification:read", "verification:manage"],
  operations_admin: ["users:read", "errands:read", "errands:manage", "verification:read"],
  read_only_auditor: ["users:read", "errands:read", "finance:read", "wallets:read", "security_deposits:read", "disputes:read", "verification:read", "reconciliation:read", "audit_logs:read"],
};

export function getAdminPermissions(roles = []) {
  const permissions = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || []));
  return permissions.has("*") ? ["*"] : [...permissions].sort();
}

export function hasAdminPermission(admin, permission) {
  const permissions = admin?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}
