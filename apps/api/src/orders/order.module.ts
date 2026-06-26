import { Module } from '@nestjs/common';
import { RealtimeModule } from '@/realtime/realtime.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [RealtimeModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
