import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import type { Socket } from 'socket.io';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { buildAbility } from '@/auth/ability';
import { Action, Subjects, type PermissionTuple } from '@/auth/permissions';
import {
  boardTable,
  groupPermissionTable,
  groupTable,
  permissionsTable,
  userGroupTable,
  userPlanSnapshotTable,
  userTable,
} from '@/schemas';

// Authenticates socket clients for privileged actions (widget moves). End users
// are anonymous and simply fail authentication, which the gateway treats as
// "not allowed to move" — exactly the spec's rule that only a tenant or a
// permitted sub-user may reposition widgets.
@Injectable()
export class SocketAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Mint a short-lived WebSocket token bound to a specific user + board.
  // Called by TokenExchangeController after the user authenticates via the
  // regular HTTP auth flow. The returned token is sent by the client as
  // handshake.auth.token and verified in verifyWsToken / authenticate.
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

  // Verify a WS exchange token and return its payload (userId + boardId).
  // Returns null when the token is missing, expired, or has the wrong purpose.
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

  // Verify the WS exchange token and return the authenticated userId.
  // Returns null for anonymous/invalid clients (public end users).
  authenticate(client: Socket): string | null {
    return this.verifyWsToken(client)?.id ?? null;
  }

  // True when the user owns the board (tenant scope). Used to let the owner open
  // their own restricted (unpublished) board over the socket.
  async ownsBoard(userId: string, boardId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ parentId: userTable.parentId })
      .from(userTable)
      .where(eq(userTable.id, userId));
    if (!user) return false;
    const tenantScope = user.parentId ?? userId;

    const [board] = await this.db
      .select({ tenantId: boardTable.tenantId })
      .from(boardTable)
      .where(eq(boardTable.id, boardId));
    return !!board && board.tenantId === tenantScope;
  }

  // True when the user may move widgets on this board: they must own the board
  // (tenant scope) and hold the update:SmartWidget capability (directly via a
  // role, or via the tenant plan snapshot, or manage:all for super-admin).
  async canManageWidgets(userId: string, boardId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ parentId: userTable.parentId })
      .from(userTable)
      .where(eq(userTable.id, userId));
    if (!user) return false;
    const tenantScope = user.parentId ?? userId;

    const [board] = await this.db
      .select({ tenantId: boardTable.tenantId })
      .from(boardTable)
      .where(eq(boardTable.id, boardId));
    if (!board || board.tenantId !== tenantScope) return false;

    const grants: PermissionTuple[] = [];

    // Tenant plan-snapshot capabilities (a present row = granted capability).
    const [snapshot] = await tryit(
      this.db
        .select({
          action: userPlanSnapshotTable.action,
          subject: userPlanSnapshotTable.subject,
          granted: userPlanSnapshotTable.granted,
          remaining: userPlanSnapshotTable.remaining,
        })
        .from(userPlanSnapshotTable)
        .where(eq(userPlanSnapshotTable.userId, tenantScope)),
    );
    for (const row of snapshot ?? []) {
      const unlimited =
        row.granted === null ||
        row.granted === -1 ||
        row.remaining === null ||
        row.remaining === -1;
      if (unlimited || row.remaining !== 0) {
        grants.push({
          action: row.action as PermissionTuple['action'],
          subject: row.subject as PermissionTuple['subject'],
        });
      }
    }

    // Role-based grants for this specific user (custom + admin roles).
    const [roleGrants] = await tryit(
      this.db
        .select({
          action: permissionsTable.action,
          subject: permissionsTable.subject,
        })
        .from(userGroupTable)
        .innerJoin(
          groupTable,
          and(
            eq(userGroupTable.groupId, groupTable.id),
            eq(groupTable.type, 'role'),
          ),
        )
        .innerJoin(
          groupPermissionTable,
          eq(groupPermissionTable.groupId, groupTable.id),
        )
        .innerJoin(
          permissionsTable,
          eq(groupPermissionTable.permissionId, permissionsTable.id),
        )
        .where(eq(userGroupTable.userId, userId)),
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
