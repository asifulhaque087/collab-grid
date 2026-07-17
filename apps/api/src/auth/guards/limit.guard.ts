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
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import type { Request } from 'express';
import { REQUIRE_PERMISSION_KEY } from '@/auth/decorators/require-permission.decorator';
import type { PermissionTuple } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { DRIZZLE, type DrizzleDB } from '@/drizzle/drizzle.module';
import {
  subscriptionTable,
  packagePermissionLimitTable,
  permissionsTable,
  limitUsageTable,
  userTable,
} from '@/schemas';

@Injectable()
export class LimitGuard implements CanActivate {
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

    if (await this.isBackofficeUser(user.userId)) return true;

    const tenantId = await this.resolveTenantId(user.userId);

    const activeSubs = await this.getActiveSubscriptions(tenantId);

    if (!activeSubs || activeSubs.length === 0) return true;

    const packageIds = activeSubs.map((s) => s.packageId);

    for (const permission of required) {
      const hasCapacity = await this.hasCapacity(packageIds, permission);
      if (!hasCapacity) {
        throw new ForbiddenException(
          "You've reached your plan's limit for this feature. Upgrade to Pro to continue.",
        );
      }
    }

    return true;
  }

  private async isBackofficeUser(userId: string): Promise<boolean> {
    const [rows] = await tryit(
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscriptionTable)
        .where(eq(subscriptionTable.userId, userId)),
    );

    return !rows || rows[0].count === 0;
  }

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

  private async getActiveSubscriptions(tenantId: string) {
    const [rows, err] = await tryit(
      this.db
        .select({ packageId: subscriptionTable.packageId })
        .from(subscriptionTable)
        .where(
          and(
            eq(subscriptionTable.userId, tenantId),
            or(
              isNull(subscriptionTable.endDate),
              gt(subscriptionTable.endDate, new Date()),
            ),
          ),
        ),
    );

    if (err) {
      throw new InternalServerErrorException(
        'Failed to resolve active subscriptions.',
      );
    }

    return rows ?? [];
  }

  private async hasCapacity(
    packageIds: string[],
    permission: PermissionTuple,
  ): Promise<boolean> {
    const [limitRows, limitErr] = await tryit(
      this.db
        .select({
          id: packagePermissionLimitTable.id,
          limit: packagePermissionLimitTable.limit,
        })
        .from(packagePermissionLimitTable)
        .innerJoin(
          permissionsTable,
          eq(
            packagePermissionLimitTable.permissionId,
            permissionsTable.id,
          ),
        )
        .where(
          and(
            inArray(packagePermissionLimitTable.packageId, packageIds),
            eq(permissionsTable.action, permission.action),
            eq(permissionsTable.subject, permission.subject),
          ),
        ),
    );

    if (limitErr) {
      throw new InternalServerErrorException(
        'Failed to resolve permission limits.',
      );
    }

    if (!limitRows || limitRows.length === 0) return false;

    for (const limitRow of limitRows) {
      if (limitRow.limit === null || limitRow.limit === -1) return true;

      const [usageRows] = await tryit(
        this.db
          .select({ totalUsed: sql<number>`coalesce(sum(used), 0)::int` })
          .from(limitUsageTable)
          .where(
            eq(limitUsageTable.packagePermissionLimitId, limitRow.id),
          ),
      );

      const totalUsed = usageRows?.[0]?.totalUsed ?? 0;

      if (totalUsed < limitRow.limit) return true;
    }

    return false;
  }
}
