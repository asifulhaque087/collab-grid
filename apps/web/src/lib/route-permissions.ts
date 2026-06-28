import { Action, Subjects, type AppAbility } from "./ability";

// The super-admin super-grant (manage:all). Only the super-admin role holds it,
// so gating a route on it makes the route + its sidebar item super-admin-only.
export const SUPER_ADMIN_REQUIREMENT: PermissionRequirement = {
  action: Action.Manage,
  subject: Subjects.All,
};

// The permission a dashboard route requires to be viewed. The PermissionGuard
// resolves the current path to one of these and redirects to /unauthorized when
// the user's ability can't satisfy it. `action`/`subject` are optional so a
// route can be gated purely by `tenantOnly` (no specific permission).
export interface PermissionRequirement {
  action?: Action;
  subject?: Subjects;
  // Tenant-business feature: deny the super-admin (manage:all holder) even
  // though manage:all would otherwise satisfy any permission. The SaaS operator
  // manages the platform (Users/Roles/Plans/Transactions), not a tenant's
  // boards, inventory, orders, or billing.
  tenantOnly?: boolean;
}

// Evaluate a requirement against a user's ability. Tenant-only routes are
// denied to the super-admin first; otherwise the optional action/subject gate
// must be satisfied. A requirement with neither a permission nor tenantOnly
// always passes.
export function canAccess(
  ability: AppAbility,
  requirement: PermissionRequirement,
): boolean {
  if (requirement.tenantOnly && ability.can(Action.Manage, Subjects.All)) {
    return false;
  }
  if (
    requirement.action &&
    requirement.subject &&
    !ability.can(requirement.action, requirement.subject)
  ) {
    return false;
  }
  return true;
}

// Route prefix → required permission. Longest matching prefix wins, so a more
// specific route can override its parent. Routes absent from this map (e.g.
// /dashboard/billing, /dashboard/settings) are self-service and left ungated.
const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  requirement: PermissionRequirement;
}> = [
  // Boards/Inventory/Orders/Billing are tenant-business features — hidden from
  // the super-admin even though manage:all satisfies their permission gates.
  { prefix: "/dashboard/boards", requirement: { action: Action.Read, subject: Subjects.Board, tenantOnly: true } },
  { prefix: "/dashboard/inventory", requirement: { action: Action.Read, subject: Subjects.SmartWidget, tenantOnly: true } },
  { prefix: "/dashboard/users", requirement: { action: Action.Read, subject: Subjects.User } },
  { prefix: "/dashboard/roles", requirement: { action: Action.Read, subject: Subjects.Group } },
  // Plans is super-admin-only — tenants subscribe via Billing, not manage plans.
  { prefix: "/dashboard/plans", requirement: SUPER_ADMIN_REQUIREMENT },
  { prefix: "/dashboard/orders", requirement: { action: Action.Read, subject: Subjects.PaymentHistory, tenantOnly: true } },
  // Transactions is super-admin-only — tenants get Orders instead.
  { prefix: "/dashboard/transactions", requirement: SUPER_ADMIN_REQUIREMENT },
  // Billing is tenant self-service (subscribe/upgrade) — not a super-admin menu.
  { prefix: "/dashboard/billing", requirement: { tenantOnly: true } },
];

// Resolve the permission required to view the given path, or null when the
// route has no gate.
export function getRequiredPermissionForPath(
  pathname: string,
): PermissionRequirement | null {
  let match: PermissionRequirement | null = null;
  let matchedLength = -1;
  for (const entry of ROUTE_PERMISSIONS) {
    if (
      (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) &&
      entry.prefix.length > matchedLength
    ) {
      match = entry.requirement;
      matchedLength = entry.prefix.length;
    }
  }
  return match;
}
