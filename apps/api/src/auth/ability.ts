import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";
import { Action, Subjects, type PermissionTuple } from "./permissions";

// The app's CASL ability shape: rules are (Action, Subjects) tuples.
export type AppAbility = MongoAbility<[Action, Subjects]>;

// Build a CASL ability from a flat list of granted (action, subject) tuples.
// Used by the PermissionsGuard (server-side authorization decision) and mirrored
// on the web for menu/route gating.
export function buildAbility(grants: PermissionTuple[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const grant of grants) {
    can(grant.action, grant.subject);
  }
  return build();
}
