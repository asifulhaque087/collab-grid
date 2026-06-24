// Single source of truth for every permission in the system, modeled CASL-style
// as an (action, subject) pair. These same definitions seed the `permissions`
// master catalog (see drizzle/seed.ts) and back the `@RequirePermission(...)`
// decorator + CASL ability, so a route can never gate on a permission that
// doesn't exist in the database.

// CASL actions. `Manage` is CASL's wildcard ("any action"); the rest are the
// standard CRUD verbs.
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

// CASL subjects — the resources permissions apply to. `All` is CASL's wildcard
// subject (pairs with `Manage` for a super-grant).
export enum Subjects {
  All = 'all',
  Board = 'Board',
  SmartWidget = 'SmartWidget',
  User = 'User',
  Group = 'Group',
  Permission = 'Permission',
  PaymentHistory = 'PaymentHistory',
  UserPlanSnapshot = 'UserPlanSnapshot',
}

// A single permission, identified by its (action, subject) pair.
export interface PermissionTuple {
  action: Action;
  subject: Subjects;
}

export interface PermissionDefinition extends PermissionTuple {
  name: string;
  description: string;
}

// Rows for the `permissions` table. Adding a permission here + re-running the
// seed is all that's needed to make it available to plans, roles, and the
// guard. Whether a grant behaves as a boolean capability or a numeric quota is
// decided per plan-permission `totalOperation` — not stored on the permission itself.
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Super-admin wildcard — pairs with Manage:All for full system access.
  {
    action: Action.Manage,
    subject: Subjects.All,
    name: 'Manage Everything',
    description: 'Full system access — conferred by the super-admin role only.',
  },

  // Board
  {
    action: Action.Create,
    subject: Subjects.Board,
    name: 'Create Board',
    description: 'Create new canvas boards.',
  },
  {
    action: Action.Read,
    subject: Subjects.Board,
    name: 'Read Board',
    description: 'View boards and their contents.',
  },
  {
    action: Action.Update,
    subject: Subjects.Board,
    name: 'Update Board',
    description: 'Edit board settings and metadata.',
  },
  {
    action: Action.Delete,
    subject: Subjects.Board,
    name: 'Delete Board',
    description: 'Delete boards permanently.',
  },

  // SmartWidget (inventory items placed on boards)
  {
    action: Action.Create,
    subject: Subjects.SmartWidget,
    name: 'Create Smart Widget',
    description: 'Add inventory widgets to boards.',
  },
  {
    action: Action.Read,
    subject: Subjects.SmartWidget,
    name: 'Read Smart Widget',
    description: 'View widgets on canvas boards.',
  },
  {
    action: Action.Update,
    subject: Subjects.SmartWidget,
    name: 'Update Smart Widget',
    description: 'Edit widget properties and canvas position.',
  },
  {
    action: Action.Delete,
    subject: Subjects.SmartWidget,
    name: 'Delete Smart Widget',
    description: 'Remove widgets from boards.',
  },

  // User (sub-users created by a tenant)
  {
    action: Action.Create,
    subject: Subjects.User,
    name: 'Create User',
    description: 'Create sub-users and team members.',
  },
  {
    action: Action.Read,
    subject: Subjects.User,
    name: 'Read User',
    description: 'View users and their profiles.',
  },
  {
    action: Action.Update,
    subject: Subjects.User,
    name: 'Update User',
    description: 'Edit user records and role assignments.',
  },
  {
    action: Action.Delete,
    subject: Subjects.User,
    name: 'Delete User',
    description: 'Remove users from the workspace.',
  },

  // Group (custom roles and plans)
  {
    action: Action.Create,
    subject: Subjects.Group,
    name: 'Create Group',
    description: 'Create custom roles for team members.',
  },
  {
    action: Action.Read,
    subject: Subjects.Group,
    name: 'Read Group',
    description: 'View roles and subscription plans.',
  },
  {
    action: Action.Update,
    subject: Subjects.Group,
    name: 'Update Group',
    description: 'Edit roles and their permission sets.',
  },
  {
    action: Action.Delete,
    subject: Subjects.Group,
    name: 'Delete Group',
    description: 'Delete custom roles.',
  },

  // Read-only ancillary resources
  {
    action: Action.Read,
    subject: Subjects.Permission,
    name: 'Read Permission',
    description: 'View the permission catalog.',
  },
  {
    action: Action.Read,
    subject: Subjects.PaymentHistory,
    name: 'Read Payment History',
    description: 'View payment transaction records.',
  },
  {
    action: Action.Read,
    subject: Subjects.UserPlanSnapshot,
    name: 'Read Plan Snapshot',
    description: 'View user plan quota and usage.',
  },
];

// Stable string form of a permission tuple — used as a Set/Map key when
// resolving a user's effective grants. Matches CASL's "action:subject" feel.
export function permissionKey(action: string, subject: string): string {
  return `${action}:${subject}`;
}
