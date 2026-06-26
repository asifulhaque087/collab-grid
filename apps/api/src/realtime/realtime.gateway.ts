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
import { RealtimeService } from './realtime.service';
import { ZoneService } from './zone.service';
import type {
  BoardJoinResult,
  CanvasUser,
  CursorMovePayload,
  JoinPayload,
  SoftLockPayload,
  ViewportUpdatePayload,
} from './realtime.types';

interface SocketData {
  user: CanvasUser;
  boardId?: string;
  zones: Set<string>;
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
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  // Subscribe to Redis key-expiry events so an expired soft lock auto-releases
  // the widget for everyone (turns it back to the default color). Requires the
  // server started with `notify-keyspace-events Ex` (see docker-compose.yml).
  afterInit() {
    this.subscriber.on('pmessage', (_pattern, _channel, expiredKey) => {
      const parsed = this.realtime.parseLockKey(expiredKey);
      if (!parsed) return;
      this.server
        .to(this.zone.boardRoom(parsed.boardId))
        .emit('widget:lock:soft:release', { widgetId: parsed.widgetId });
    });
    // Don't block bootstrap on Redis being reachable — ioredis retries and the
    // subscription activates once connected.
    this.subscriber
      .psubscribe('__keyevent@*__:expired')
      .catch(() => undefined);
  }

  // A client may pass a stored userId/name (sessionStorage) so a refresh keeps
  // its identity and locks; otherwise we mint a fresh anonymous identity.
  handleConnection(client: Socket) {
    const { userId, name } = client.handshake.auth ?? {};
    const user = this.realtime.buildUser(userId, name);
    const data: SocketData = { user, zones: new Set() };
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

    data.boardId = board.id;

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
}
