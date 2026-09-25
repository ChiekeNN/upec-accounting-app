/**
 * Single source of truth for workspace roles.
 *
 * Imported by both server code (permissions, seeding) and client components
 * (labels, navigation), so this module must stay free of `process.env`,
 * database imports and any other server-only dependency.
 */

export const ROLES = ["admin", "director", "finance_officer", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Stored values from databases created before the "Accountant" role was renamed.
 * The migration rewrites these rows, but normalising on read keeps an
 * un-migrated database readable instead of silently downgrading someone to Viewer.
 */
const LEGACY_ROLES: Record<string, Role> = { accountant: "finance_officer" };

export function normaliseRole(value: string | null | undefined): Role {
  const candidate = (value && LEGACY_ROLES[value]) || value || "";
  return (ROLES as readonly string[]).includes(candidate) ? (candidate as Role) : "viewer";
}

/** What the role is called everywhere in the interface. */
export const roleLabel: Record<Role, string> = {
  admin: "Administrator",
  director: "Director",
  finance_officer: "Finance Officer",
  viewer: "Viewer",
};

/** Short line used on the role cards in Team & permissions. */
export const roleSummary: Record<Role, string> = {
  admin: "Full financial and access control",
  director: "Approvals, oversight and sign-off",
  finance_officer: "Record, post and correct entries",
  viewer: "View records and reports",
};

/** Longer line used in the member table's Access column. */
export const roleDescription: Record<Role, string> = {
  admin: "Full access to finance, budgets, accounts and team management",
  director: "Executive oversight — approve entries, set budgets and manage the team",
  finance_officer: "Record, post and correct transactions, budgets and accounts",
  viewer: "Read-only access to dashboards and reports",
};

/** Roles a team member can be given, in the order shown in the picker. */
export const assignableRoles: Role[] = ["finance_officer", "viewer", "director", "admin"];

/**
 * Can create and correct financial records: transactions, budget allocations
 * and the chart of accounts. This is what lets a Finance Officer fix a mistake
 * without asking an Administrator to do it for them.
 */
export function canEditRecords(role: Role): boolean {
  return role === "admin" || role === "director" || role === "finance_officer";
}

/** Can manage people and see the Director oversight area. */
export function hasAdminAccess(role: Role): boolean {
  return role === "admin" || role === "director";
}

/**
 * Only a true Administrator may create, promote or deactivate another
 * Administrator. A Director has the same day-to-day powers but cannot
 * alter the Administrator accounts.
 */
export function isOwner(role: Role): boolean {
  return role === "admin";
}
