import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { Socket } from 'socket.io';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { buildAbility } from '@/auth/ability';
import { Action, Subjects, type PermissionTuple } from '@/auth/permissions';
import {
  roleTable,
  rolePermissionTable,
  permissionsTable,
  userRoleTable,
} from '@/schemas';

@Injectable()
export class SocketAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createWsToken(
    userId: string,
    boardId: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { id: userId, boardId, purpose: 'ws-auth' },
      {
        secret: this.config.getOrThrow<string>('WS_TOKEN_SECRET'),
        expiresIn: '30s',
      },
    );
  }

  verifyWsToken(client: Socket): { id: string; boardId: string } | null {
    const token = (client.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{
        id: string;
        boardId: string;
        purpose: string;
      }>(token, {
        secret: this.config.getOrThrow<string>('WS_TOKEN_SECRET'),
        clockTolerance: 10,
      });
      if (payload.purpose !== 'ws-auth') return null;
      return { id: payload.id, boardId: payload.boardId };
    } catch {
      return null;
    }
  }

  authenticate(client: Socket): string | null {
    return this.verifyWsToken(client)?.id ?? null;
  }

  async canManageWidgets(userId: string): Promise<boolean> {
    const grants: PermissionTuple[] = [];

    const [roleGrants] = await tryit(
      this.db
        .select({
          action: permissionsTable.action,
          subject: permissionsTable.subject,
        })
        .from(userRoleTable)
        .innerJoin(roleTable, eq(userRoleTable.roleId, roleTable.id))
        .innerJoin(
          rolePermissionTable,
          eq(roleTable.id, rolePermissionTable.roleId),
        )
        .innerJoin(
          permissionsTable,
          eq(rolePermissionTable.permissionId, permissionsTable.id),
        )
        .where(eq(userRoleTable.userId, userId)),
    );

    for (const row of roleGrants ?? []) {
      grants.push({
        action: row.action as PermissionTuple['action'],
        subject: row.subject as PermissionTuple['subject'],
      });
    }

    return buildAbility(grants).can(Action.Update, Subjects.SmartWidget);
  }
}
