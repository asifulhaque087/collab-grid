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

type UserWithGroup = {
  userId: string;
  parentId: string | null;
  groupId: string | null;
  slug: string | null;
  createdBy: string | null;
  type: string | null;
};

type RoleClassification = {
  adminRoleIds: string[];
  containsTenantRole: boolean;
  fallbackToParentQuota: boolean;
};

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
    if (!user?.userId) throw new UnauthorizedException('User context missing.');

    const userWithGroups = await this.fetchUserWithGroups(user.userId);
    const userRoles = userWithGroups.filter(
      (row) => row.groupId && row.type === 'role',
    );
    const currentUserInfo = userWithGroups[0];

    const { adminRoleIds, containsTenantRole, fallbackToParentQuota } =
      this.classifyRoles(userRoles);

    const grants = new Map<string, PermissionTuple>();
    const exhausted = new Set<string>();

    if (adminRoleIds.length > 0) {
      const adminGrants = await this.resolveAdminGrants(adminRoleIds);
      for (const [key, perm] of adminGrants) grants.set(key, perm);
    }

    if (containsTenantRole) {
      const targetQuotaUserId =
        fallbackToParentQuota && currentUserInfo.parentId
          ? currentUserInfo.parentId
          : currentUserInfo.userId;

      const { grants: tenantGrants, exhausted: tenantExhausted } =
        await this.resolveTenantGrants(targetQuotaUserId);

      for (const [key, perm] of tenantGrants) {
        grants.set(key, perm);
        exhausted.delete(key);
      }
      for (const key of tenantExhausted) {
        grants.delete(key);
        exhausted.add(key);
      }
    }

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

  private async fetchUserWithGroups(userId: string): Promise<UserWithGroup[]> {
    const [rows, err] = await tryit(
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
        .where(eq(userTable.id, userId)),
    );

    if (err || !rows || rows.length === 0) {
      throw new InternalServerErrorException(
        'Failed to retrieve user access hierarchy.',
      );
    }

    return rows;
  }

  private classifyRoles(userRoles: UserWithGroup[]): RoleClassification {
    const adminRoleIds: string[] = [];
    let containsTenantRole = false;
    let fallbackToParentQuota = false;

    for (const role of userRoles) {
      if (
        (role.createdBy === 'constant' &&
          role.slug === SUPER_ADMIN_ROLE_SLUG) ||
        role.createdBy === 'admin'
      ) {
        adminRoleIds.push(role.groupId!);
      }

      if (
        (role.createdBy === 'constant' && role.slug === TENANT_ROLE_SLUG) ||
        role.createdBy === 'tenant'
      ) {
        containsTenantRole = true;
        if (role.createdBy === 'tenant') fallbackToParentQuota = true;
      }
    }

    return { adminRoleIds, containsTenantRole, fallbackToParentQuota };
  }

  private async resolveAdminGrants(
    adminRoleIds: string[],
  ): Promise<Map<string, PermissionTuple>> {
    const [perms, err] = await tryit(
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

    if (err) {
      throw new InternalServerErrorException(
        'Failed to resolve admin roles permissions.',
      );
    }

    const grants = new Map<string, PermissionTuple>();
    for (const row of perms ?? []) {
      grants.set(toKey(row.action, row.subject), {
        action: row.action as PermissionTuple['action'],
        subject: row.subject as PermissionTuple['subject'],
      });
    }
    return grants;
  }

  private async resolveTenantGrants(targetUserId: string): Promise<{
    grants: Map<string, PermissionTuple>;
    exhausted: Set<string>;
  }> {
    const [targetUserRows, targetUserErr] = await tryit(
      this.db
        .select({ planExpiresAt: userTable.planExpiresAt })
        .from(userTable)
        .where(eq(userTable.id, targetUserId)),
    );

    if (targetUserErr) {
      throw new InternalServerErrorException('Failed to check plan expiry.');
    }

    const planExpiresAt = targetUserRows?.[0]?.planExpiresAt;
    const planIsActive = !planExpiresAt || new Date(planExpiresAt) > new Date();

    const [quotaRows, quotaErr] = await tryit(
      this.db
        .select({
          action: userPlanSnapshotTable.action,
          subject: userPlanSnapshotTable.subject,
          granted: userPlanSnapshotTable.granted,
          remaining: userPlanSnapshotTable.remaining,
        })
        .from(userPlanSnapshotTable)
        .where(eq(userPlanSnapshotTable.userId, targetUserId)),
    );

    if (quotaErr) {
      throw new InternalServerErrorException(
        'Failed to check resource subscription balance.',
      );
    }

    const grants = new Map<string, PermissionTuple>();
    const exhausted = new Set<string>();

    for (const row of quotaRows ?? []) {
      const key = toKey(row.action, row.subject);
      const isUnlimitedGranted = row.granted === null || row.granted === -1;
      const isUnlimitedRemaining =
        row.remaining === null || row.remaining === -1;

      if (isUnlimitedGranted || isUnlimitedRemaining || row.remaining !== 0) {
        grants.set(key, {
          action: row.action as PermissionTuple['action'],
          subject: row.subject as PermissionTuple['subject'],
        });
      } else if (planIsActive) {
        // remaining === 0 but plan is still active — allow overflow.
        // QuotaGuard will increment `extra` to track the overage.
        grants.set(key, {
          action: row.action as PermissionTuple['action'],
          subject: row.subject as PermissionTuple['subject'],
        });
      } else {
        // remaining === 0 and plan has expired — hard block.
        exhausted.add(key);
      }
    }

    return { grants, exhausted };
  }
}
