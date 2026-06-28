import { Action, Subjects } from "./ability";

// The super-admin super-grant (manage:all). Only the super-admin role holds it,
// so gating a route on it makes the route + its sidebar item super-admin-only.
export const SUPER_ADMIN_REQUIREMENT: PermissionRequirement = {
  action: Action.Manage,
  subject: Subjects.All,
};

// The permission a dashboard route requires to be viewed. The PermissionGuard
// resolves the current path to one of these and redirects to /unauthorized when
// the user's ability can't satisfy it.
export interface PermissionRequirement {
  action: Action;
  subject: Subjects;
}

// Route prefix → required permission. Longest matching prefix wins, so a more
// specific route can override its parent. Routes absent from this map (e.g.
// /dashboard/billing, /dashboard/settings) are self-service and left ungated.
const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  requirement: PermissionRequirement;
}> = [
  { prefix: "/dashboard/boards", requirement: { action: Action.Read, subject: Subjects.Board } },
  { prefix: "/dashboard/inventory", requirement: { action: Action.Read, subject: Subjects.SmartWidget } },
  { prefix: "/dashboard/users", requirement: { action: Action.Read, subject: Subjects.User } },
  { prefix: "/dashboard/roles", requirement: { action: Action.Read, subject: Subjects.Group } },
  // Plans is super-admin-only — tenants subscribe via Billing, not manage plans.
  { prefix: "/dashboard/plans", requirement: SUPER_ADMIN_REQUIREMENT },
  { prefix: "/dashboard/orders", requirement: { action: Action.Read, subject: Subjects.PaymentHistory } },
  // Transactions is super-admin-only — tenants get Orders instead.
  { prefix: "/dashboard/transactions", requirement: SUPER_ADMIN_REQUIREMENT },
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
