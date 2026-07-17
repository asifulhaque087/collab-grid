import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  and,
  eq,
  gt,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import type { Request } from 'express';
import { REQUIRE_PERMISSION_KEY } from '@/auth/decorators/require-permission.decorator';
import { Action, type PermissionTuple } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { DRIZZLE, type DrizzleDB } from '@/drizzle/drizzle.module';
import {
  subscriptionTable,
  packagePermissionLimitTable,
  permissionsTable,
  limitUsageTable,
  userLimitUsageTable,
  userTable,
} from '@/schemas';

@Injectable()
export class LimitUpdaterGuard implements CanActivate {
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

    if (await this.isBackofficeUser(user.userId)) return true;

    const tenantId = await this.resolveTenantId(user.userId);

    const activeSubs = await this.getActiveSubscriptions(tenantId);
    if (!activeSubs || activeSubs.length === 0) return true;

    for (const perm of createPerms) {
      await this.incrementUsage(tenantId, user.userId, activeSubs, perm);
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
        )
        .orderBy(subscriptionTable.startDate),
    );

    if (err) {
      throw new InternalServerErrorException(
        'Failed to resolve active subscriptions.',
      );
    }

    return rows ?? [];
  }

  private async incrementUsage(
    tenantId: string,
    userId: string,
    activeSubs: { packageId: string }[],
    permission: PermissionTuple,
  ) {
    for (const sub of activeSubs) {
      const limitRow = await this.findLimit(sub.packageId, permission);
      if (!limitRow) continue;
      if (limitRow.limit === null || limitRow.limit === -1) return;

      const [usageRows] = await tryit(
        this.db
          .select({ id: limitUsageTable.id, used: limitUsageTable.used })
          .from(limitUsageTable)
          .where(
            eq(
              limitUsageTable.packagePermissionLimitId,
              limitRow.id,
            ),
          )
          .limit(1),
      );

      const existing = usageRows?.[0];

      if (existing) {
        if (existing.used >= limitRow.limit) continue;

        const [, updateErr] = await tryit(
          this.db
            .update(limitUsageTable)
            .set({ used: sql`${limitUsageTable.used} + 1` })
            .where(eq(limitUsageTable.id, existing.id)),
        );

        if (updateErr) {
          throw new InternalServerErrorException(
            'Failed to update usage counter.',
          );
        }

        if (userId !== tenantId) {
          await this.linkSubUser(userId, existing.id);
        }

        return;
      }

      const [created] = await tryit(
        this.db
          .insert(limitUsageTable)
          .values({
            packagePermissionLimitId: limitRow.id,
            used: 1,
          })
          .returning({ id: limitUsageTable.id }),
      );

      if (!created?.[0]) {
        throw new InternalServerErrorException(
          'Failed to create usage counter.',
        );
      }

      if (userId !== tenantId) {
        await this.linkSubUser(userId, created[0].id);
      }

      return;
    }
  }

  private async findLimit(
    packageId: string,
    permission: PermissionTuple,
  ) {
    const [rows, err] = await tryit(
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
            eq(packagePermissionLimitTable.packageId, packageId),
            eq(permissionsTable.action, permission.action),
            eq(permissionsTable.subject, permission.subject),
          ),
        )
        .limit(1),
    );

    if (err) {
      throw new InternalServerErrorException(
        'Failed to resolve permission limit.',
      );
    }

    return rows?.[0] ?? null;
  }

  private async linkSubUser(userId: string, limitUsageId: string) {
    const [, err] = await tryit(
      this.db.insert(userLimitUsageTable).values({
        userId,
        limitUsageId,
      }),
    );

    if (err) {
      throw new InternalServerErrorException(
        'Failed to link sub-user usage.',
      );
    }
  }
}
