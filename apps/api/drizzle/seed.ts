import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { hashSync } from 'bcryptjs';
import * as schema from '../src/schemas';
import {
  PERMISSION_CATALOG,
  Action,
  Subjects,
  permissionKey,
} from '../src/auth/permissions';
import {
  FREE_PLAN_SLUG,
  PRO_PLAN_SLUG,
  TENANT_ROLE_SLUG,
  SUPER_ADMIN_ROLE_SLUG,
} from '../src/auth/rbac.constants';

const {
  permissionsTable,
  groupTable,
  groupPermissionTable,
  userTable,
  userGroupTable,
  userPlanSnapshotTable,
  paymentHistoryTable,
  boardTable,
  smartWidgetTable,
} = schema;

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }), {
  schema,
});

// ─── Tenant permissions ───────────────────────────────────────────────────────
// Roles are for permission checks. The tenant role is the source of truth for
// what a tenant user is allowed to do at all.

const isTenantPermission = (p: { action: string; subject: string }) =>
  !(p.action === Action.Manage && p.subject === Subjects.All);

const TENANT_PERMISSIONS = PERMISSION_CATALOG.filter(isTenantPermission);

const TENANT_PERMISSION_KEYS = new Set(
  TENANT_PERMISSIONS.map((p) => permissionKey(p.action, p.subject)),
);

// ─── Plan quotas ──────────────────────────────────────────────────────────────
// Plans set numeric quotas on a *subset* of tenant permissions.
// Every permission tracked by a plan MUST exist in TENANT_PERMISSIONS —
// enforced by assertPlanSubsetOfTenant() before any DB writes.

const PLAN_QUOTAS: {
  action: Action;
  subject: Subjects;
  free: number;
  pro: number;
}[] = [
  { action: Action.Create, subject: Subjects.Board, free: 2, pro: 15 },
  { action: Action.Create, subject: Subjects.Group, free: 3, pro: 20 },
  { action: Action.Create, subject: Subjects.SmartWidget, free: 25, pro: -1 },
];

function assertPlanSubsetOfTenant() {
  const violations = PLAN_QUOTAS.filter(
    (q) => !TENANT_PERMISSION_KEYS.has(permissionKey(q.action, q.subject)),
  );
  if (violations.length > 0) {
    const keys = violations
      .map((v) => permissionKey(v.action, v.subject))
      .join(', ');
    throw new Error(
      `Plan quotas reference permissions not in the tenant role: ${keys}. ` +
        `Add them to PERMISSION_CATALOG (with isTenantPermission returning true) first.`,
    );
  }
}

// ─── Other static data ────────────────────────────────────────────────────────

const SYSTEM_GROUPS = [
  {
    slug: SUPER_ADMIN_ROLE_SLUG,
    title: 'Super Admin',
    type: 'role' as const,
    createdBy: 'constant' as const,
  },
  {
    slug: TENANT_ROLE_SLUG,
    title: 'Tenant',
    type: 'role' as const,
    createdBy: 'constant' as const,
  },
  {
    slug: FREE_PLAN_SLUG,
    title: 'Free',
    type: 'plan' as const,
    createdBy: 'constant' as const,
  },
  {
    slug: PRO_PLAN_SLUG,
    title: 'Pro',
    type: 'plan' as const,
    createdBy: 'constant' as const,
  },
] as const;

const SEED_USERS = [
  {
    name: 'Super Admin',
    email: 'admin@collabgrid.com',
    plan: 'pro' as const,
    groupSlug: SUPER_ADMIN_ROLE_SLUG,
  },
  {
    name: 'Tenant User',
    email: 'tenant@collabgrid.com',
    plan: 'free' as const,
    groupSlug: TENANT_ROLE_SLUG,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Guard: every plan quota must be covered by the tenant role first.
  assertPlanSubsetOfTenant();

  console.log('Seeding database...');

  // 0. Clear all tables in dependency order (leaf tables first).
  console.log('  Clearing tables...');
  await db.delete(smartWidgetTable);
  await db.delete(boardTable);
  await db.delete(userPlanSnapshotTable);
  await db.delete(paymentHistoryTable);
  await db.delete(userGroupTable);
  await db.delete(groupPermissionTable);
  await db.delete(userTable);
  await db.delete(groupTable);
  await db.delete(permissionsTable);

  // 1. Seed permissions — derived entirely from PERMISSION_CATALOG.
  console.log('  Seeding permissions...');
  const permissionIds: Record<string, string> = {};

  for (const perm of PERMISSION_CATALOG) {
    const [row] = await db
      .insert(permissionsTable)
      .values({
        action: perm.action,
        subject: perm.subject,
        name: perm.name,
        description: perm.description,
      })
      .returning();
    permissionIds[permissionKey(perm.action, perm.subject)] = row.id;
  }

  // 2. Seed system groups (roles + plans).
  console.log('  Seeding groups (roles + plans)...');
  const groupIds: Record<string, string> = {};

  for (const group of SYSTEM_GROUPS) {
    const [row] = await db.insert(groupTable).values(group).returning();
    groupIds[group.slug] = row.id;
  }

  // 3. Seed group permissions.
  console.log('  Seeding group permissions...');

  // super-admin: single manage:all grant, no quota.
  await db.insert(groupPermissionTable).values({
    groupId: groupIds[SUPER_ADMIN_ROLE_SLUG],
    permissionId: permissionIds[permissionKey(Action.Manage, Subjects.All)],
    totalOperation: null,
  });

  // tenant role: every non-super-admin permission, no quota (boolean capability).
  for (const perm of TENANT_PERMISSIONS) {
    await db.insert(groupPermissionTable).values({
      groupId: groupIds[TENANT_ROLE_SLUG],
      permissionId: permissionIds[permissionKey(perm.action, perm.subject)],
      totalOperation: null,
    });
  }

  // plans: quota caps sourced from PLAN_QUOTAS (guaranteed subset of tenant above).
  for (const quota of PLAN_QUOTAS) {
    const key = permissionKey(quota.action, quota.subject);
    await db.insert(groupPermissionTable).values([
      {
        groupId: groupIds[FREE_PLAN_SLUG],
        permissionId: permissionIds[key],
        totalOperation: quota.free,
      },
      {
        groupId: groupIds[PRO_PLAN_SLUG],
        permissionId: permissionIds[key],
        totalOperation: quota.pro,
      },
    ]);
  }

  // 4. Seed users.
  console.log('  Seeding users...');
  const hashedPassword = hashSync('qwerty1234%', 10);

  // Free-plan quota lookup, keyed by permission tuple.
  const freeQuotaByKey = new Map(
    PLAN_QUOTAS.map((q) => [permissionKey(q.action, q.subject), q.free]),
  );

  for (const user of SEED_USERS) {
    const [row] = await db
      .insert(userTable)
      .values({
        name: user.name,
        email: user.email,
        password: hashedPassword,
        provider: 'local',
        plan: user.plan,
      })
      .returning();

    await db
      .insert(userGroupTable)
      .values({ userId: row.id, groupId: groupIds[user.groupSlug] });

    // The PermissionsGuard resolves tenant grants from userPlanSnapshot, so a
    // tenant needs a snapshot to do anything. Seed every tenant permission:
    // quota'd perms get the free-plan cap; the rest are boolean capabilities
    // (granted/remaining = null = unlimited). Admins get grants via their role.
    if (user.groupSlug === TENANT_ROLE_SLUG) {
      await db.insert(userPlanSnapshotTable).values(
        TENANT_PERMISSIONS.map((perm) => {
          const quota = freeQuotaByKey.get(
            permissionKey(perm.action, perm.subject),
          );
          return {
            userId: row.id,
            action: perm.action,
            subject: perm.subject,
            granted: quota ?? null,
            remaining: quota ?? null,
            extra: 0,
          };
        }),
      );
    }
  }

  console.log('Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
