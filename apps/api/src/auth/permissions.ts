// Single source of truth for every permission in the system, modeled CASL-style
// as an (action, subject) pair. These same definitions seed the `permissions`
// master catalog (see drizzle/seed.ts) and back the `@RequirePermission(...)`
// decorator + CASL ability, so a route can never gate on a permission that
// doesn't exist in the database.

// CASL actions. `Manage` is CASL's wildcard ("any action"); the rest are the
// standard CRUD verbs. A capability that isn't naturally CRUD is mapped onto
// the closest verb (e.g. "view reports" -> Read Report, "use AI" -> Manage Ai).
export enum Action {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Update = "update",
  Delete = "delete",
}

// CASL subjects — the resources permissions apply to. `All` is CASL's wildcard
// subject (pairs with `Manage` for a super-grant; currently unused in the seed).
export enum Subjects {
  All = "all",
  Prescription = "Prescription",
  Patient = "Patient",
  Ai = "Ai",
  Report = "Report",
  Plan = "Plan",
  Subscription = "Subscription",
  Payment = "Payment",
  User = "User",
  Role = "Role",
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
// decided per plan-permission `value` — not stored on the permission itself.
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Prescriptions. Create is a numeric quota on plans (free 15 / pro unlimited);
  // the rest are boolean capabilities conferred by the doctor role.
  {
    action: Action.Create,
    subject: Subjects.Prescription,
    name: "Create prescriptions",
    description: "Create and save prescriptions in the builder.",
  },
  {
    action: Action.Read,
    subject: Subjects.Prescription,
    name: "Read prescriptions",
    description: "View saved prescriptions and history.",
  },
  {
    action: Action.Update,
    subject: Subjects.Prescription,
    name: "Update prescriptions",
    description: "Edit saved prescriptions.",
  },
  {
    action: Action.Delete,
    subject: Subjects.Prescription,
    name: "Delete prescriptions",
    description: "Delete saved prescriptions.",
  },
  // Patients. Create is a numeric quota on plans (free 50 / pro unlimited).
  {
    action: Action.Create,
    subject: Subjects.Patient,
    name: "Register patients",
    description: "Add new patients to the registry.",
  },
  {
    action: Action.Read,
    subject: Subjects.Patient,
    name: "Read patients",
    description: "View the patient registry and individual patients.",
  },
  {
    action: Action.Update,
    subject: Subjects.Patient,
    name: "Update patients",
    description: "Edit patient records.",
  },
  {
    action: Action.Delete,
    subject: Subjects.Patient,
    name: "Delete patients",
    description: "Delete patient records.",
  },
  {
    action: Action.Manage,
    subject: Subjects.Ai,
    name: "Use AI features",
    description: "Access AI-assisted suggestions and automation.",
  },
  {
    action: Action.Read,
    subject: Subjects.Report,
    name: "View reports & analytics",
    description: "Open the reports dashboard and analytics.",
  },
  // Plan management (admin-only, conferred by the super-admin role).
  {
    action: Action.Create,
    subject: Subjects.Plan,
    name: "Create plans",
    description: "Create billing plans and assign their permissions.",
  },
  {
    action: Action.Read,
    subject: Subjects.Plan,
    name: "Read plans",
    description: "View billing plans and their permissions.",
  },
  {
    action: Action.Update,
    subject: Subjects.Plan,
    name: "Update plans",
    description: "Edit billing plans and their permissions.",
  },
  {
    action: Action.Delete,
    subject: Subjects.Plan,
    name: "Delete plans",
    description: "Delete billing plans.",
  },
  // Subscribe to a plan (conferred by the doctor role).
  {
    action: Action.Create,
    subject: Subjects.Subscription,
    name: "Subscribe to a plan",
    description: "Purchase or upgrade a subscription plan.",
  },
  {
    action: Action.Read,
    subject: Subjects.Payment,
    name: "Read payments",
    description: "View all payment records (admin billing report).",
  },
  // User management (admin-only, conferred by the super-admin role).
  {
    action: Action.Create,
    subject: Subjects.User,
    name: "Create users",
    description: "Create SaaS users and assign their role.",
  },
  {
    action: Action.Read,
    subject: Subjects.User,
    name: "Read users",
    description: "View the user list and individual users.",
  },
  {
    action: Action.Update,
    subject: Subjects.User,
    name: "Update users",
    description: "Edit user records and reassign their role.",
  },
  {
    action: Action.Delete,
    subject: Subjects.User,
    name: "Delete users",
    description: "Delete user accounts.",
  },
  // Role management (admin-only, conferred by the super-admin role).
  {
    action: Action.Create,
    subject: Subjects.Role,
    name: "Create roles",
    description: "Create RBAC roles and assign their permissions.",
  },
  {
    action: Action.Read,
    subject: Subjects.Role,
    name: "Read roles",
    description: "View RBAC roles and their permissions.",
  },
  {
    action: Action.Update,
    subject: Subjects.Role,
    name: "Update roles",
    description: "Edit RBAC roles and their permissions.",
  },
  {
    action: Action.Delete,
    subject: Subjects.Role,
    name: "Delete roles",
    description: "Delete RBAC roles.",
  },
];

// Stable string form of a permission tuple — used as a Set/Map key when
// resolving a user's effective grants. Matches CASL's "action:subject" feel.
export function permissionKey(action: string, subject: string): string {
  return `${action}:${subject}`;
}
