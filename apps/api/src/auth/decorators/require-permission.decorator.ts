import { SetMetadata } from "@nestjs/common";
import type { PermissionTuple } from "@/auth/permissions";

// Metadata key the PermissionsGuard reads to learn which permissions a route
// requires. Kept here next to the decorator so the two never drift.
export const REQUIRE_PERMISSION_KEY = "require_permission";

// Marks a route (or whole controller) as requiring one or more CASL
// (action, subject) permissions. When several are passed the guard enforces
// AND semantics — the caller must hold *every* listed permission.
//
//   @RequirePermission({ action: Action.Create, subject: Subjects.Plan })
//   @Post()
//   create() { ... }
//
//   @RequirePermission(
//     { action: Action.Create, subject: Subjects.Patient },
//     { action: Action.Create, subject: Subjects.Prescription },
//   )
export const RequirePermission = (...permissions: PermissionTuple[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
