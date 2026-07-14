import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '@/auth/auth.module';
import { RedisModule } from './redis.module';
import { TokenExchangeController } from './token-exchange.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ZoneService } from './zone.service';
import { SocketAuthService } from './socket-auth.service';
import { RabbitmqService } from './rabbitmq.service';
import { WidgetPersistenceConsumer } from './widget-persistence.consumer';

@Module({
  // JwtModule (no global config needed — the socket auth verifies with an
  // explicit secret) lets SocketAuthService verify handshake access tokens.
  imports: [RedisModule, JwtModule.register({}), AuthModule],
  controllers: [TokenExchangeController],
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
