import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from './redis.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ZoneService } from './zone.service';
import { SocketAuthService } from './socket-auth.service';
import { RabbitmqService } from './rabbitmq.service';
import { WidgetPersistenceConsumer } from './widget-persistence.consumer';

@Module({
  // JwtModule (no global config needed — the socket auth verifies with an
  // explicit secret) lets SocketAuthService verify handshake access tokens.
  imports: [RedisModule, JwtModule.register({})],
  providers: [
    RealtimeGateway,
    RealtimeService,
    ZoneService,
    SocketAuthService,
    RabbitmqService,
    WidgetPersistenceConsumer,
  ],
  exports: [RealtimeService, ZoneService, RealtimeGateway],
})
export class RealtimeModule {}
