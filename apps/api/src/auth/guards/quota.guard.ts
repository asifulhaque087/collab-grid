import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import type { Request } from 'express';
import { REQUIRE_PERMISSION_KEY } from '@/auth/decorators/require-permission.decorator';
import { Action, type PermissionTuple } from '@/auth/permissions';
import { SUPER_ADMIN_ROLE_SLUG } from '@/auth/rbac.constants';
import type { AuthUser } from '@/auth/auth.types';
import { DRIZZLE, type DrizzleDB } from '@/drizzle/drizzle.module';
import {
  groupTable,
  userGroupTable,
  userPlanSnapshotTable,
  userTable,
} from '@/schemas';

// Decrements the tenant's plan quota for each CREATE permission on a route.
// Must run after PermissionsGuard (which already verifies the user has budget).
// Skips admins and unlimited quotas (remaining === null or -1).
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      PermissionTuple[] | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    const createPerms = (required ?? []).filter(
      (p) => p.action === Action.Create,
    );
    if (createPerms.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    if (!user?.userId) throw new UnauthorizedException('User context missing.');

    if (await this.isAdminUser(user.userId)) return true;

    const tenantId = await this.resolveTenantId(user.userId);

    for (const perm of createPerms) {
      await this.decrementQuota(tenantId, perm);
    }

    return true;
  }

  private async isAdminUser(userId: string): Promise<boolean> {
    const [userGroups, err] = await tryit(
      this.db
        .select({ slug: groupTable.slug, createdBy: groupTable.createdBy })
        .from(userGroupTable)
        .innerJoin(groupTable, eq(userGroupTable.groupId, groupTable.id))
        .where(eq(userGroupTable.userId, userId)),
    );

    if (err) throw new InternalServerErrorException('Failed to resolve user role.');

    return (userGroups ?? []).some(
      (g) =>
        (g.slug === SUPER_ADMIN_ROLE_SLUG && g.createdBy === 'constant') ||
        g.createdBy === 'admin',
    );
  }

  // For tenant sub-users (parentId set), the quota lives on the parent tenant.
  private async resolveTenantId(userId: string): Promise<string> {
    const [rows, err] = await tryit(
      this.db
        .select({ parentId: userTable.parentId })
        .from(userTable)
        .where(eq(userTable.id, userId)),
    );

    if (err || !rows?.length) {
      throw new InternalServerErrorException('Failed to resolve user record.');
    }

    return rows[0].parentId ?? userId;
  }

  // Decrements remaining for the permission; overflows into extra when remaining hits 0.
  private async decrementQuota(
    tenantId: string,
    perm: PermissionTuple,
  ): Promise<void> {
    const [snapshots, snapErr] = await tryit(
      this.db
        .select()
        .from(userPlanSnapshotTable)
        .where(
          and(
            eq(userPlanSnapshotTable.userId, tenantId),
            eq(userPlanSnapshotTable.action, perm.action),
            eq(userPlanSnapshotTable.subject, perm.subject),
          ),
        ),
    );

    if (snapErr) throw new InternalServerErrorException('Failed to read plan quota.');

    const snapshot = snapshots?.[0];
    if (!snapshot) return;

    const { id, remaining, extra } = snapshot;

    if (remaining === null || remaining === -1) return;

    const [, updateErr] = await tryit(
      remaining > 0
        ? this.db
            .update(userPlanSnapshotTable)
            .set({ remaining: remaining - 1 })
            .where(eq(userPlanSnapshotTable.id, id))
        : this.db
            .update(userPlanSnapshotTable)
            .set({ extra: extra + 1 })
            .where(eq(userPlanSnapshotTable.id, id)),
    );

    if (updateErr) throw new InternalServerErrorException('Failed to update plan quota.');
  }
}
