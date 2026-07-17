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
  FREE_PACKAGE_SLUG,
  TENANT_ROLE_SLUG,
  SUPER_ADMIN_ROLE_SLUG,
} from '../src/auth/rbac.constants';
import { sql } from 'drizzle-orm';

const {
  permissionsTable,
  roleTable,
  rolePermissionTable,
  userRoleTable,
  packageTable,
  packagePermissionLimitTable,
  subscriptionTable,
  userTable,
  boardTable,
  smartWidgetTable,
  orderTable,
  orderItemTable,
} = schema;

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }), {
  schema,
});

// ─── Tenant permissions ───────────────────────────────────────────────────────

const isTenantPermission = (p: { action: string; subject: string }) =>
  !(p.action === Action.Manage && p.subject === Subjects.All);

const TENANT_PERMISSIONS = PERMISSION_CATALOG.filter(isTenantPermission);

const TENANT_PERMISSION_KEYS = new Set(
  TENANT_PERMISSIONS.map((p) => permissionKey(p.action, p.subject)),
);

// ─── Package quotas ────────────────────────────────────────────────────────────

const PACKAGE_QUOTAS: {
  action: Action;
  subject: Subjects;
  free: number;
}[] = [
  { action: Action.Create, subject: Subjects.Board, free: 2 },
  { action: Action.Create, subject: Subjects.Group, free: 3 },
  { action: Action.Create, subject: Subjects.SmartWidget, free: 25 },
];

function assertQuotaSubsetOfTenant() {
  const violations = PACKAGE_QUOTAS.filter(
    (q) => !TENANT_PERMISSION_KEYS.has(permissionKey(q.action, q.subject)),
  );
  if (violations.length > 0) {
    const keys = violations
      .map((v) => permissionKey(v.action, v.subject))
      .join(', ');
    throw new Error(
      `Package quotas reference permissions not in the tenant role: ${keys}. ` +
        `Add them to PERMISSION_CATALOG (with isTenantPermission returning true) first.`,
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  assertQuotaSubsetOfTenant();

  console.log('Seeding database...');

  // 0. Clear all tables in dependency order (leaf tables first).
  // console.log('  Clearing tables...');
  // await db.delete(orderItemTable);
  // await db.delete(orderTable);
  // await db.delete(smartWidgetTable);
  // await db.delete(boardTable);
  // await db.delete(subscriptionTable);
  // await db.delete(packagePermissionLimitTable);
  // await db.delete(packageTable);
  // await db.delete(userRoleTable);
  // await db.delete(rolePermissionTable);
  // await db.delete(roleTable);
  // await db.delete(userTable);
  // await db.delete(permissionsTable);

  console.log('  Clearing tables...');

  const clearTableIfExists = async (table: any, tableName: string) => {
    const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    );
  `);

    // pg driver returns rows inside a .rows array
    if (result.rows && result.rows[0]?.exists) {
      await db.delete(table);
    }
  };
  // Execute deletes in dependency order (leaf tables first)
  await clearTableIfExists(orderItemTable, 'order_item');
  await clearTableIfExists(orderTable, 'order');
  await clearTableIfExists(smartWidgetTable, 'smart_widget');
  await clearTableIfExists(boardTable, 'board');
  await clearTableIfExists(subscriptionTable, 'subscription');
  await clearTableIfExists(
    packagePermissionLimitTable,
    'package_permission_limit',
  );
  await clearTableIfExists(packageTable, 'package');
  await clearTableIfExists(userRoleTable, 'user_role');
  await clearTableIfExists(rolePermissionTable, 'role_permission');
  await clearTableIfExists(roleTable, 'role');
  await clearTableIfExists(userTable, 'user');
  await clearTableIfExists(permissionsTable, 'permissions'); // 1. Seed permissions — derived entirely from PERMISSION_CATALOG.
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

  // 2. Seed system roles.
  console.log('  Seeding roles...');

  const [superAdminRole] = await db
    .insert(roleTable)
    .values({
      slug: SUPER_ADMIN_ROLE_SLUG,
      title: 'Super Admin',
      primaryUserId: null,
      secondaryUserId: null,
    })
    .returning();

  console.log('  Seeding users...');
  const hashedPassword = hashSync('qwerty1234%', 10);

  // 3. Seed super admin user.
  const [superAdminUser] = await db
    .insert(userTable)
    .values({
      name: 'Super Admin',
      email: 'admin@collabgrid.com',
      password: hashedPassword,
      provider: 'local',
    })
    .returning();

  await db.insert(userRoleTable).values({
    userId: superAdminUser.id,
    roleId: superAdminRole.id,
  });

  // 4. Seed tenant role (owned by super admin).
  const [tenantRole] = await db
    .insert(roleTable)
    .values({
      slug: TENANT_ROLE_SLUG,
      title: 'Tenant',
      primaryUserId: superAdminUser.id,
      secondaryUserId: superAdminUser.id,
    })
    .returning();

  // 5. Seed free package (owned by super admin).
  console.log('  Seeding packages...');

  const [freePackage] = await db
    .insert(packageTable)
    .values({
      slug: FREE_PACKAGE_SLUG,
      title: 'Free',
      primaryUserId: superAdminUser.id,
      secondaryUserId: superAdminUser.id,
    })
    .returning();

  // 6. Seed role permissions.
  console.log('  Seeding role permissions...');

  // super-admin: single manage:all grant.
  await db.insert(rolePermissionTable).values({
    roleId: superAdminRole.id,
    permissionId: permissionIds[permissionKey(Action.Manage, Subjects.All)],
  });

  // tenant role: every non-super-admin permission.
  for (const perm of TENANT_PERMISSIONS) {
    await db.insert(rolePermissionTable).values({
      roleId: tenantRole.id,
      permissionId: permissionIds[permissionKey(perm.action, perm.subject)],
    });
  }

  // 7. Seed package permission limits.
  console.log('  Seeding package permission limits...');

  for (const quota of PACKAGE_QUOTAS) {
    const key = permissionKey(quota.action, quota.subject);
    await db.insert(packagePermissionLimitTable).values({
      packageId: freePackage.id,
      permissionId: permissionIds[key],
      limit: quota.free,
    });
  }

  // 8. Seed tenant user.
  console.log('  Seeding tenant user...');

  const [tenantUser] = await db
    .insert(userTable)
    .values({
      name: 'Tenant User',
      email: 'tenant@collabgrid.com',
      password: hashedPassword,
      provider: 'local',
    })
    .returning();

  await db.insert(userRoleTable).values({
    userId: tenantUser.id,
    roleId: tenantRole.id,
  });

  // 9. Seed subscription for tenant user (free package, never expires).
  await db.insert(subscriptionTable).values({
    userId: tenantUser.id,
    packageId: freePackage.id,
    startDate: new Date(),
    endDate: null,
    paymentMethod: 'manual',
    amount: '0',
  });

  console.log('Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
