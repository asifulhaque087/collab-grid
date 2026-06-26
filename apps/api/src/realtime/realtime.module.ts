import { Module } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ZoneService } from './zone.service';

@Module({
  imports: [RedisModule],
  providers: [RealtimeGateway, RealtimeService, ZoneService],
  exports: [RealtimeService, ZoneService],
})
export class RealtimeModule {}
