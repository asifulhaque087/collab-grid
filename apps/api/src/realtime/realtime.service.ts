import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { boardTable, smartWidgetTable } from '@/schemas';
import { REDIS } from './redis.module';
import type {
  CanvasUser,
  CanvasWidgetDto,
  LockKind,
  Viewport,
  WidgetLock,
} from './realtime.types';

// Soft lock = 60s, hard lock = 5min (extended on checkout).
const SOFT_LOCK_MS = 60_000;
export const HARD_LOCK_MS = 300_000;
// Minimum gap between two lock attempts from one user. Anything faster than a
// human possibly could is treated as a mouse-teleportation bot and dropped.
const MIN_LOCK_INTERVAL_MS = 120;

const ADJECTIVES = [
  'Swift', 'Calm', 'Brave', 'Clever', 'Lucky', 'Bright', 'Quiet', 'Bold',
  'Gentle', 'Witty', 'Nimble', 'Mellow',
];
const ANIMALS = [
  'Otter', 'Falcon', 'Panda', 'Fox', 'Heron', 'Lynx', 'Beaver', 'Sparrow',
  'Marmot', 'Bison', 'Wren', 'Ibex',
];
const COLORS = [
  '#0d9488', '#d97706', '#059669', '#6366f1', '#ec4899', '#f59e0b',
  '#14b8a6', '#8b5cf6', '#ef4444', '#3b82f6',
];

@Injectable()
export class RealtimeService {
  // In-memory guard for bot detection — last lock attempt time per user.
  private readonly lastLockAttempt = new Map<string, number>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // ── Identity ────────────────────────────────────────────
  // Mint a friendly anonymous identity, or rehydrate the name/color for a
  // returning userId so a refresh keeps the same presence label.
  buildUser(userId?: string, name?: string): CanvasUser {
    const id = userId?.trim() || randomUUID();
    const seed = this.hash(id);
    const color = COLORS[seed % COLORS.length];
    const label =
      name?.trim() ||
      `${ADJECTIVES[seed % ADJECTIVES.length]} ${ANIMALS[(seed >> 3) % ANIMALS.length]}`;
    return { userId: id, name: label, color };
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ── Board + widgets ─────────────────────────────────────
  async getPublicBoard(slug: string) {
    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: eq(boardTable.slug, slug),
      }),
    );
    if (err || !board) return null;
    return board;
  }

  // Placed widgets (those with canvas coordinates) for a board, annotated with
  // any live lock so peers joining mid-session see amber/red state immediately.
  async getBoardWidgets(boardId: string): Promise<CanvasWidgetDto[]> {
    const [rows, err] = await tryit(
      this.db
        .select()
        .from(smartWidgetTable)
        .where(
          and(
            eq(smartWidgetTable.boardId, boardId),
            isNotNull(smartWidgetTable.posX),
          ),
        ),
    );
    if (err || !rows) return [];

    const widgets: CanvasWidgetDto[] = [];
    for (const w of rows) {
      const lock = await this.getLock(boardId, w.id);
      // Prefer an in-flight Redis position (a move not yet persisted to DB) so a
      // refresh recovers the latest coordinates.
      const live = await this.getWidgetPosition(boardId, w.id);
      widgets.push({
        id: w.id,
        name: w.name,
        sku: w.sku,
        photo: w.photo,
        price: w.price ? Number(w.price) : 0,
        quantity: w.quantity,
        x: live?.x ?? Number(w.posX),
        y: live?.y ?? Number(w.posY),
        width: w.width,
        height: w.height,
        lock: lock
          ? { userId: lock.userId, kind: lock.kind, ttl: lock.ttl }
          : undefined,
      });
    }
    return widgets;
  }

  // ── Presence ────────────────────────────────────────────
  private presenceKey(boardId: string) {
    return `presence:${boardId}`;
  }

  async addPresence(boardId: string, user: CanvasUser, socketId: string) {
    await this.redis.hset(
      this.presenceKey(boardId),
      user.userId,
      JSON.stringify({ ...user, socketId }),
    );
  }

  async removePresence(boardId: string, userId: string) {
    await this.redis.hdel(this.presenceKey(boardId), userId);
  }

  async getPeers(boardId: string, excludeUserId: string): Promise<CanvasUser[]> {
    const all = await this.redis.hgetall(this.presenceKey(boardId));
    return Object.entries(all)
      .filter(([userId]) => userId !== excludeUserId)
      .map(([, raw]) => {
        const p = JSON.parse(raw) as CanvasUser;
        return { userId: p.userId, name: p.name, color: p.color };
      });
  }

  // ── Widget position recovery ────────────────────────────
  // Latest coordinates from an in-progress/just-finished move, kept in Redis
  // so a refresh recovers them before the async DB persist lands.
  private widgetPosKey(boardId: string, widgetId: string) {
    return `widgetpos:${boardId}:${widgetId}`;
  }

  async saveWidgetPosition(
    boardId: string,
    widgetId: string,
    x: number,
    y: number,
  ) {
    await this.redis.set(
      this.widgetPosKey(boardId, widgetId),
      JSON.stringify({ x, y }),
      'EX',
      3600,
    );
  }

  async getWidgetPosition(
    boardId: string,
    widgetId: string,
  ): Promise<{ x: number; y: number } | null> {
    const raw = await this.redis.get(this.widgetPosKey(boardId, widgetId));
    return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
  }

  // ── Viewport recovery ───────────────────────────────────
  async saveViewport(boardId: string, userId: string, viewport: Viewport) {
    await this.redis.set(
      `viewport:${boardId}:${userId}`,
      JSON.stringify(viewport),
      'EX',
      3600,
    );
  }

  // ── Soft / hard locks ───────────────────────────────────
  private lockKey(boardId: string, widgetId: string) {
    return `lock:${boardId}:${widgetId}`;
  }

  // Atomic acquire via SET NX PX. Returns the lock on success, or the current
  // holder on failure (so the gateway can tell the requester who has it).
  async acquireSoftLock(
    boardId: string,
    widgetId: string,
    userId: string,
  ): Promise<
    | { ok: true; lock: WidgetLock }
    | { ok: false; reason: 'taken' | 'bot'; holder?: string }
  > {
    // Bot guard: reject impossibly fast successive lock attempts.
    const now = Date.now();
    const last = this.lastLockAttempt.get(userId) ?? 0;
    this.lastLockAttempt.set(userId, now);
    if (now - last < MIN_LOCK_INTERVAL_MS) {
      return { ok: false, reason: 'bot' };
    }

    const key = this.lockKey(boardId, widgetId);
    const value = JSON.stringify({ userId, kind: 'soft' as LockKind });
    const res = await this.redis.set(key, value, 'PX', SOFT_LOCK_MS, 'NX');

    if (res === 'OK') {
      return {
        ok: true,
        lock: { widgetId, userId, kind: 'soft', ttl: SOFT_LOCK_MS },
      };
    }
    const holder = await this.getLock(boardId, widgetId);
    return { ok: false, reason: 'taken', holder: holder?.userId };
  }

  async releaseLock(boardId: string, widgetId: string, userId: string) {
    const holder = await this.getLock(boardId, widgetId);
    if (holder?.userId === userId) {
      await this.redis.del(this.lockKey(boardId, widgetId));
    }
  }

  async getLock(
    boardId: string,
    widgetId: string,
  ): Promise<WidgetLock | null> {
    const key = this.lockKey(boardId, widgetId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const ttl = await this.redis.pttl(key);
    const parsed = JSON.parse(raw) as { userId: string; kind: LockKind };
    return { widgetId, userId: parsed.userId, kind: parsed.kind, ttl };
  }

  // All of a user's live locks on a board (with remaining ttl) for refresh
  // recovery. Scans the board's lock keyspace — fine at board scale.
  async getUserLocks(boardId: string, userId: string): Promise<WidgetLock[]> {
    const prefix = this.lockKey(boardId, '');
    const locks: WidgetLock[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100,
      );
      cursor = next;
      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { userId: string; kind: LockKind };
        if (parsed.userId !== userId) continue;
        const ttl = await this.redis.pttl(key);
        locks.push({
          widgetId: key.slice(prefix.length),
          userId,
          kind: parsed.kind,
          ttl,
        });
      }
    } while (cursor !== '0');
    return locks;
  }

  // ── Hard lock (checkout) ────────────────────────────────
  private hardSetKey(boardId: string) {
    return `hardlocks:${boardId}`;
  }
  private paidKey(boardId: string, widgetId: string) {
    return `paid:${boardId}:${widgetId}`;
  }

  // Promote all of a user's live soft locks to 5-minute hard locks (checkout).
  // The same lock key is reused with an extended TTL; the widget is tracked in a
  // per-board set so the expiry handler knows it was a hard lock. Returns the
  // promoted widget ids.
  async promoteToHardLocks(boardId: string, userId: string): Promise<string[]> {
    const locks = await this.getUserLocks(boardId, userId);
    const ids: string[] = [];
    for (const lock of locks) {
      const key = this.lockKey(boardId, lock.widgetId);
      // Skip locks that vanished between the scan and now.
      if (!(await this.redis.get(key))) continue;
      await this.redis.set(
        key,
        JSON.stringify({ userId, kind: 'hard' as LockKind }),
        'PX',
        HARD_LOCK_MS,
      );
      await this.redis.sadd(this.hardSetKey(boardId), lock.widgetId);
      ids.push(lock.widgetId);
    }
    return ids;
  }

  // Mark a hard-locked widget as paid (set by the payment flow before/within the
  // 5-minute window). The expiry handler reads this to decide purchased vs release.
  async markPaid(boardId: string, widgetId: string) {
    await this.redis.set(this.paidKey(boardId, widgetId), '1', 'EX', 600);
  }

  // Called when a lock key expires. Distinguishes a plain soft-lock expiry from
  // a hard-lock expiry, and for hard locks whether the item was paid.
  async resolveExpiredLock(
    boardId: string,
    widgetId: string,
  ): Promise<'soft' | 'hard-purchased' | 'hard-released'> {
    const wasHard =
      (await this.redis.srem(this.hardSetKey(boardId), widgetId)) > 0;
    if (!wasHard) return 'soft';

    const paid = await this.redis.get(this.paidKey(boardId, widgetId));
    if (paid) {
      await this.redis.del(this.paidKey(boardId, widgetId));
      return 'hard-purchased';
    }
    return 'hard-released';
  }

  // Permanently remove a purchased widget from the board (it's sold).
  async removeWidget(boardId: string, widgetId: string) {
    await tryit(
      this.db
        .delete(smartWidgetTable)
        .where(
          and(
            eq(smartWidgetTable.id, widgetId),
            eq(smartWidgetTable.boardId, boardId),
          ),
        ),
    );
    await this.redis.del(this.widgetPosKey(boardId, widgetId));
  }

  // Parse a Redis keyspace-expiry key back into (boardId, widgetId). Returns
  // null for keys that are not soft-lock keys.
  parseLockKey(key: string): { boardId: string; widgetId: string } | null {
    const m = /^lock:([^:]+):(.+)$/.exec(key);
    if (!m) return null;
    return { boardId: m[1], widgetId: m[2] };
  }
}
