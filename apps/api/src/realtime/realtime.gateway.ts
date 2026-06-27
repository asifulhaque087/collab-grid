import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_SUBSCRIBER } from './redis.module';
import { HARD_LOCK_MS, RealtimeService } from './realtime.service';
import { ZoneService } from './zone.service';
import { SocketAuthService } from './socket-auth.service';
import { RabbitmqService } from './rabbitmq.service';
import type {
  BoardJoinResult,
  CanvasUser,
  CursorMovePayload,
  JoinPayload,
  SoftLockPayload,
  ViewportUpdatePayload,
  WidgetMovePayload,
  WidgetPlacePayload,
} from './realtime.types';

interface SocketData {
  user: CanvasUser;
  boardId?: string;
  zones: Set<string>;
  // Set at join: whether this socket may reposition widgets (tenant/sub-user
  // with update:SmartWidget). End users are anonymous → false.
  canMove: boolean;
}

@WebSocketGateway({
  namespace: '/canvas',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly zone: ZoneService,
    private readonly socketAuth: SocketAuthService,
    private readonly rabbit: RabbitmqService,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  // Subscribe to Redis key-expiry events so an expired soft lock auto-releases
  // the widget for everyone (turns it back to the default color). Requires the
  // server started with `notify-keyspace-events Ex` (see docker-compose.yml).
  afterInit() {
    this.subscriber.on('pmessage', (_pattern, _channel, expiredKey) => {
      const parsed = this.realtime.parseLockKey(expiredKey);
      if (!parsed) return;
      void this.handleLockExpiry(parsed.boardId, parsed.widgetId);
    });
    // Don't block bootstrap on Redis being reachable — ioredis retries and the
    // subscription activates once connected.
    this.subscriber
      .psubscribe('__keyevent@*__:expired')
      .catch(() => undefined);
  }

  // A lock key expired. Soft locks just release; hard locks either complete the
  // purchase (item leaves the canvas) or release back to the default state.
  private async handleLockExpiry(boardId: string, widgetId: string) {
    const outcome = await this.realtime.resolveExpiredLock(boardId, widgetId);
    const room = this.zone.boardRoom(boardId);
    if (outcome === 'soft') {
      this.server.to(room).emit('widget:lock:soft:release', { widgetId });
    } else if (outcome === 'hard-released') {
      this.server.to(room).emit('widget:lock:hard:release', { widgetId });
    } else {
      await this.realtime.removeWidget(boardId, widgetId);
      this.server.to(room).emit('widget:purchased', { widgetId });
    }
  }

  // A client may pass a stored userId/name (sessionStorage) so a refresh keeps
  // its identity and locks; otherwise we mint a fresh anonymous identity.
  handleConnection(client: Socket) {
    const { userId, name } = client.handshake.auth ?? {};
    const user = this.realtime.buildUser(userId, name);
    const data: SocketData = { user, zones: new Set(), canMove: false };
    client.data = data;
    client.emit('session', user);
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as SocketData;
    if (!data?.boardId) return;
    await this.realtime.removePresence(data.boardId, data.user.userId);
    client
      .to(this.zone.boardRoom(data.boardId))
      .emit('peer:left', { userId: data.user.userId });
  }

  @SubscribeMessage('board:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ): Promise<BoardJoinResult | { error: string }> {
    const data = client.data as SocketData;
    const board = await this.realtime.getPublicBoard(payload.slug);
    if (!board) return { error: 'Board not found' };

    // Authenticate once (JWT from handshake cookie) — drives both the access
    // gate and move privilege. Anonymous end users resolve to null.
    const authUserId = this.socketAuth.authenticate(client);

    // Access gate: public boards are open to anyone; restricted (unpublished)
    // boards may only be joined by their authenticated owner.
    if (board.access !== 'public') {
      const owner =
        !!authUserId && (await this.socketAuth.ownsBoard(authUserId, board.id));
      if (!owner) return { error: 'This board is not published.' };
    }

    data.boardId = board.id;

    // Resolve move privilege once at join so the high-frequency move handlers
    // stay cheap.
    data.canMove = authUserId
      ? await this.socketAuth.canManageWidgets(authUserId, board.id)
      : false;

    // Join the board-wide room (presence + lock events) and every zone the
    // viewport overlaps (cursors + future widget moves).
    await client.join(this.zone.boardRoom(board.id));
    const zones = this.zone.calculateOverlappingZones(payload.viewport);
    for (const z of zones) await client.join(this.zone.room(board.id, z));
    data.zones = new Set(zones);

    await this.realtime.addPresence(board.id, data.user, client.id);
    await this.realtime.saveViewport(board.id, data.user.userId, payload.viewport);

    const [widgets, peers, myLocks] = await Promise.all([
      this.realtime.getBoardWidgets(board.id),
      this.realtime.getPeers(board.id, data.user.userId),
      this.realtime.getUserLocks(board.id, data.user.userId),
    ]);

    // Tell existing viewers a new peer arrived.
    client
      .to(this.zone.boardRoom(board.id))
      .emit('peer:joined', data.user);

    return {
      boardId: board.id,
      slug: board.slug,
      name: board.name,
      maxWidth: board.maxWidth ?? 10000,
      maxHeight: board.maxHeight ?? 10000,
      widgets,
      peers,
      myLocks,
    };
  }

  @SubscribeMessage('cursor:move:send')
  onCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CursorMovePayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId) return;
    const zone = this.zone.zoneForPoint(payload.x, payload.y);
    if (!zone) return;
    // Broadcast only to others in the cursor's current zone (bandwidth-saving).
    client.to(this.zone.room(data.boardId, zone)).emit('cursor:move:receive', {
      userId: data.user.userId,
      name: data.user.name,
      color: data.user.color,
      x: payload.x,
      y: payload.y,
    });
  }

  @SubscribeMessage('viewport:update')
  async onViewportUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ViewportUpdatePayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId) return;

    await this.realtime.saveViewport(
      data.boardId,
      data.user.userId,
      payload.viewport,
    );

    const next = new Set(
      this.zone.calculateOverlappingZones(payload.viewport),
    );

    // Dynamically unsubscribe zones we left and subscribe the new ones.
    for (const z of data.zones) {
      if (!next.has(z)) await client.leave(this.zone.room(data.boardId, z));
    }
    for (const z of next) {
      if (!data.zones.has(z)) await client.join(this.zone.room(data.boardId, z));
    }
    data.zones = next;

    client.emit('viewport:synchronized', { zones: [...next] });
  }

  @SubscribeMessage('widget:lock:soft:init')
  async onSoftLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SoftLockPayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId) return;

    const result = await this.realtime.acquireSoftLock(
      data.boardId,
      payload.widgetId,
      data.user.userId,
    );

    if (!result.ok) {
      if (result.reason === 'bot') {
        client.emit('widget:lock:soft:denied', {
          widgetId: payload.widgetId,
          reason: 'Too many rapid actions — slow down.',
        });
        return;
      }
      client.emit('widget:lock:soft:denied', {
        widgetId: payload.widgetId,
        reason: 'Someone else already locked this item.',
      });
      return;
    }

    // Broadcast to the whole board so every viewer turns the widget amber.
    this.server
      .to(this.zone.boardRoom(data.boardId))
      .emit('widget:lock:soft:fixed', {
        widgetId: payload.widgetId,
        userId: data.user.userId,
        name: data.user.name,
        ttl: result.lock.ttl,
      });
  }

  // Manual release: the user removed an item from their locked-items sidebar.
  // Drop the Redis lock (only if they hold it) and tell the board so the widget
  // returns to its default state — and a refresh no longer recovers the lock.
  @SubscribeMessage('widget:lock:soft:release:init')
  async onSoftRelease(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SoftLockPayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId) return;

    await this.realtime.releaseLock(
      data.boardId,
      payload.widgetId,
      data.user.userId,
    );

    this.server
      .to(this.zone.boardRoom(data.boardId))
      .emit('widget:lock:soft:release', { widgetId: payload.widgetId });
  }

  // Checkout: promote all of the requesting user's soft locks to 5-minute hard
  // locks and turn them red for everyone on the board.
  @SubscribeMessage('widget:lock:hard:init')
  async onHardLock(@ConnectedSocket() client: Socket) {
    const data = client.data as SocketData;
    if (!data.boardId) return;

    const widgetIds = await this.realtime.promoteToHardLocks(
      data.boardId,
      data.user.userId,
    );
    if (widgetIds.length === 0) return;

    this.server
      .to(this.zone.boardRoom(data.boardId))
      .emit('widget:lock:hard:fixed', {
        widgetIds,
        userId: data.user.userId,
        ttl: HARD_LOCK_MS,
      });
  }

  // Live drag: store the position, debounce the durable persist, and stream the
  // move to peers in every zone the widget now overlaps.
  @SubscribeMessage('widget:move')
  async onWidgetMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WidgetMovePayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId || !data.canMove) return;

    await this.realtime.saveWidgetPosition(
      data.boardId,
      payload.widgetId,
      payload.x,
      payload.y,
    );
    this.rabbit.publishDebounced({
      boardId: data.boardId,
      widgetId: payload.widgetId,
      x: payload.x,
      y: payload.y,
    });
    this.broadcastToWidgetZones(client, data.boardId, payload, 'widget:moved');
  }

  // Drag end: persist immediately (no debounce) and anchor the final position.
  @SubscribeMessage('widget:move:end')
  async onWidgetMoveEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WidgetMovePayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId || !data.canMove) return;

    await this.realtime.saveWidgetPosition(
      data.boardId,
      payload.widgetId,
      payload.x,
      payload.y,
    );
    await this.rabbit.publish({
      boardId: data.boardId,
      widgetId: payload.widgetId,
      x: payload.x,
      y: payload.y,
    });
    this.broadcastToWidgetZones(client, data.boardId, payload, 'widget:anchored');
  }

  // First placement: a tenant dragged a sidebar inventory item onto the canvas.
  // Stamp its coordinates onto the DB row and broadcast the full widget to peers
  // in every zone its bounding box overlaps so it appears on their canvas (they
  // don't have it yet — getBoardWidgets only returns placed widgets).
  @SubscribeMessage('widget:place')
  async onWidgetPlace(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WidgetPlacePayload,
  ) {
    const data = client.data as SocketData;
    if (!data.boardId || !data.canMove) return;

    const widget = await this.realtime.placeWidget(
      data.boardId,
      payload.widgetId,
      payload.x,
      payload.y,
    );
    if (!widget) return;

    const zones = this.zone.calculateWidgetOverlappingZones(
      widget.x,
      widget.y,
      widget.width,
      widget.height,
    );
    for (const z of zones) {
      client.to(this.zone.room(data.boardId, z)).emit('widget:placed', widget);
    }
  }

  // Called by the order flow after a successful payment: remove each sold
  // widget, clear its locks, and broadcast widget:purchased so it leaves every
  // viewer's canvas (Amber → gone). Public so OrderService can invoke it.
  // Finally release any other locks the buyer still held so checkout leaves no
  // stray reservation behind in Redis.
  async completePurchase(
    boardId: string,
    widgetIds: string[],
    buyerUserId?: string,
  ) {
    const room = this.zone.boardRoom(boardId);
    for (const widgetId of widgetIds) {
      await this.realtime.removeWidget(boardId, widgetId);
      await this.realtime.clearLock(boardId, widgetId);
      this.server.to(room).emit('widget:purchased', { widgetId });
    }

    if (buyerUserId) {
      const released = await this.realtime.releaseAllUserLocks(
        boardId,
        buyerUserId,
      );
      for (const widgetId of released) {
        this.server.to(room).emit('widget:lock:soft:release', { widgetId });
      }
    }
  }

  private broadcastToWidgetZones(
    client: Socket,
    boardId: string,
    payload: WidgetMovePayload,
    event: 'widget:moved' | 'widget:anchored',
  ) {
    const zones = this.zone.calculateWidgetOverlappingZones(
      payload.x,
      payload.y,
      payload.width,
      payload.height,
    );
    const body = { widgetId: payload.widgetId, x: payload.x, y: payload.y };
    for (const z of zones) {
      client.to(this.zone.room(boardId, z)).emit(event, body);
    }
  }
}
