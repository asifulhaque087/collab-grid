import { Action, Subjects } from "./ability";

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
  { prefix: "/dashboard/plans", requirement: { action: Action.Read, subject: Subjects.Group } },
  { prefix: "/dashboard/orders", requirement: { action: Action.Read, subject: Subjects.PaymentHistory } },
  { prefix: "/dashboard/transactions", requirement: { action: Action.Read, subject: Subjects.PaymentHistory } },
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
