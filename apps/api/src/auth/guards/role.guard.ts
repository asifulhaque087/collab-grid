import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, inArray } from 'drizzle-orm';
import { tryit } from '@loot-board/common';
import type { Request } from 'express';
import { buildAbility } from '@/auth/ability';
import { REQUIRE_PERMISSION_KEY } from '@/auth/decorators/require-permission.decorator';
import type { PermissionTuple } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { DRIZZLE, type DrizzleDB } from '@/drizzle/drizzle.module';
import {
  userRoleTable,
  rolePermissionTable,
  permissionsTable,
} from '@/schemas';

@Injectable()
export class RoleGuard implements CanActivate {
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

    const [roleRows, roleErr] = await tryit(
      this.db
        .select({ roleId: userRoleTable.roleId })
        .from(userRoleTable)
        .where(eq(userRoleTable.userId, user.userId)),
    );

    if (roleErr) {
      throw new InternalServerErrorException('Failed to resolve user roles.');
    }

    if (!roleRows || roleRows.length === 0) {
      throw new UnauthorizedException(
        'You do not have permission to access this resource.',
      );
    }

    const roleIds = roleRows.map((r) => r.roleId);

    const [permRows, permErr] = await tryit(
      this.db
        .select({
          action: permissionsTable.action,
          subject: permissionsTable.subject,
        })
        .from(rolePermissionTable)
        .innerJoin(
          permissionsTable,
          eq(rolePermissionTable.permissionId, permissionsTable.id),
        )
        .where(inArray(rolePermissionTable.roleId, roleIds)),
    );

    if (permErr) {
      throw new InternalServerErrorException(
        'Failed to resolve role permissions.',
      );
    }

    const grants: PermissionTuple[] = (permRows ?? []).map((row) => ({
      action: row.action as PermissionTuple['action'],
      subject: row.subject as PermissionTuple['subject'],
    }));

    const ability = buildAbility(grants);

    for (const permission of required) {
      if (!ability.can(permission.action, permission.subject)) {
        throw new UnauthorizedException(
          'You do not have permission to access this resource.',
        );
      }
    }

    return true;
  }
}
