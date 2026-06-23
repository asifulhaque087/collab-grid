import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tryit } from '@collab-grid/common';
import { eq, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import { buildAbility } from '@/auth/ability';
import { REQUIRE_PERMISSION_KEY } from '@/auth/decorators/require-permission.decorator';
import {
  type PermissionTuple,
  permissionKey as toKey,
} from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { DRIZZLE, type DrizzleDB } from '@/drizzle/drizzle.module';
import {
  userTable,
  groupTable,
  userGroupTable,
  permissionsTable,
  groupPermissionTable,
  userPlanSnapshotTable,
} from '@/schemas';
import { SUPER_ADMIN_ROLE_SLUG, TENANT_ROLE_SLUG } from '@/auth/rbac.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      PermissionTuple[] | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    if (!user?.userId) {
      throw new UnauthorizedException('User context missing.');
    }

    // 1. Fetch User details along with all assigned groups/roles
    const [userWithGroups, fetchErr] = await tryit(
      this.db
        .select({
          userId: userTable.id,
          parentId: userTable.parentId,
          groupId: groupTable.id,
          slug: groupTable.slug,
          createdBy: groupTable.createdBy,
          type: groupTable.type,
        })
        .from(userTable)
        .leftJoin(userGroupTable, eq(userTable.id, userGroupTable.userId))
        .leftJoin(groupTable, eq(userGroupTable.groupId, groupTable.id))
        .where(eq(userTable.id, user.userId)),
    );

    if (fetchErr || !userWithGroups || userWithGroups.length === 0) {
      throw new InternalServerErrorException(
        'Failed to retrieve user access hierarchy.',
      );
    }

    // Filter out only group records of type 'role'
    const userRoles = userWithGroups.filter(
      (row) => row.groupId && row.type === 'role',
    );
    const currentUserInfo = userWithGroups[0];

    // Track matching setups based on your criteria
    const adminRoleIds: string[] = [];
    let containsTenantRole = false;
    let fallbackToParentQuota = false;

    for (const role of userRoles) {
      // Condition 1: Admin evaluation
      // (createdBy === 'constant' && slug === 'admin') OR (createdBy === 'admin')
      if (
        (role.createdBy === 'constant' &&
          role.slug === SUPER_ADMIN_ROLE_SLUG) ||
        role.createdBy === 'admin'
      ) {
        adminRoleIds.push(role.groupId!);
      }

      // Condition 2: Tenant evaluation
      // (createdBy === 'constant' && slug === 'tenant') OR (createdBy === 'tenant')
      if (
        (role.createdBy === 'constant' && role.slug === TENANT_ROLE_SLUG) ||
        role.createdBy === 'tenant'
      ) {
        containsTenantRole = true;
        // If the role itself was explicitly created by a tenant, check parent's snapshot quota
        if (role.createdBy === 'tenant') {
          fallbackToParentQuota = true;
        }
      }
    }

    const grants = new Map<string, PermissionTuple>();
    const exhausted = new Set<string>();

    // 2. Resolve Admin Roles Permissions (Conferred always)
    if (adminRoleIds.length > 0) {
      const [adminPerms, adminPermsErr] = await tryit(
        this.db
          .select({
            action: permissionsTable.action,
            subject: permissionsTable.subject,
          })
          .from(groupPermissionTable)
          .innerJoin(
            permissionsTable,
            eq(groupPermissionTable.permissionId, permissionsTable.id),
          )
          .where(inArray(groupPermissionTable.groupId, adminRoleIds)),
      );

      if (adminPermsErr) {
        throw new InternalServerErrorException(
          'Failed to resolve admin roles permissions.',
        );
      }

      for (const row of adminPerms) {
        grants.set(toKey(row.action, row.subject), {
          action: row.action as PermissionTuple['action'],
          subject: row.subject as PermissionTuple['subject'],
        });
      }
    }

    // 3. Resolve Tenant snapshot quotas if role criteria matches
    if (containsTenantRole) {
      // Decide target user ID based on hierarchy requirement
      const targetQuotaUserId =
        fallbackToParentQuota && currentUserInfo.parentId
          ? currentUserInfo.parentId
          : currentUserInfo.userId;

      const [quotaRows, quotaErr] = await tryit(
        this.db
          .select({
            action: userPlanSnapshotTable.action,
            subject: userPlanSnapshotTable.subject,
            granted: userPlanSnapshotTable.granted,
            remaining: userPlanSnapshotTable.remaining,
          })
          .from(userPlanSnapshotTable)
          .where(eq(userPlanSnapshotTable.userId, targetQuotaUserId)),
      );

      if (quotaErr) {
        throw new InternalServerErrorException(
          'Failed to check resource subscription balance.',
        );
      }

      // Quotas override logic
      for (const row of quotaRows) {
        const key = toKey(row.action, row.subject);

        const isUnlimitedGranted = row.granted === null || row.granted === -1;
        const isUnlimitedRemaining =
          row.remaining === null || row.remaining === -1;

        // If granted or remaining are null/-1, it's open access or unlimited.
        // Otherwise, make sure remaining balance hasn't bottomed out to 0.
        if (isUnlimitedGranted || isUnlimitedRemaining || row.remaining !== 0) {
          grants.set(key, {
            action: row.action as PermissionTuple['action'],
            subject: row.subject as PermissionTuple['subject'],
          });
          exhausted.delete(key);
        } else {
          // Explicitly exhausted (remaining === 0 and not unlimited)
          grants.delete(key);
          exhausted.add(key);
        }
      }
    }

    // 4. Evaluate against required decorators
    const ability = buildAbility([...grants.values()]);

    for (const permission of required) {
      if (ability.can(permission.action, permission.subject)) continue;

      if (exhausted.has(toKey(permission.action, permission.subject))) {
        throw new ForbiddenException(
          "You've reached your plan's limit for this feature. Upgrade to Pro to continue.",
        );
      }
      throw new UnauthorizedException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }
}
