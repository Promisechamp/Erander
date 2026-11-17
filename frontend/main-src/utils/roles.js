const ADMIN_ROLES = [
  "super_admin",
  "finance_team",
  "support_team",
  "trust_safety_team",
  "verification_team",
  "operations_team",
  "read_only_auditor",
];

export function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getUserRoles(user) {
  if (!user) return [];

  const possibleRoles = [
    user.role,
    user.admin_role,
    user.user_metadata?.role,
    user.user_metadata?.admin_role,
    user.app_metadata?.role,
    user.app_metadata?.admin_role,
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.user_metadata?.roles)
      ? user.user_metadata.roles
      : []),
  ];

  return [...new Set(
    possibleRoles
      .flat()
      .filter(Boolean)
      .map(normalizeRole)
  )];
}

export function isAdminUser(user) {
  return getUserRoles(user).some((role) =>
    ADMIN_ROLES.includes(role)
  );
}

export function isSuperAdmin(user) {
  return getUserRoles(user).includes("super_admin");
}

export function hasAdminPermission(user, allowedRoles = []) {
  const roles = getUserRoles(user);

  if (roles.includes("super_admin")) {
    return true;
  }

  return roles.some((role) => allowedRoles.includes(role));
}