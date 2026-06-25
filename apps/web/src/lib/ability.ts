import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";

// CASL action/subject model — mirrors apps/api/src/auth/permissions.ts so the
// web's route/menu gating evaluates exactly like the server's PermissionsGuard.
export enum Action {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Update = "update",
  Delete = "delete",
}

export enum Subjects {
  All = "all",
  Board = "Board",
  SmartWidget = "SmartWidget",
  User = "User",
  Group = "Group",
  Permission = "Permission",
  PaymentHistory = "PaymentHistory",
  UserPlanSnapshot = "UserPlanSnapshot",
  Subscription = "Subscription",
}

// A single permission a user effectively holds, as returned by GET /auth/me.
export interface PermissionTuple {
  action: string;
  subject: string;
}

export type AppAbility = MongoAbility<[Action, Subjects]>;

// Build a CASL ability from the user's effective permission tuples.
export function createAbilityFor(
  user: { permissions?: PermissionTuple[] } | null,
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const p of user?.permissions ?? []) {
    can(p.action as Action, p.subject as Subjects);
  }
  return build();
}
