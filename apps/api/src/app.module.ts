
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@/auth/auth.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { RoleModule } from '@/roles/role.module';
import { PackageModule } from '@/packages/package.module';
import { BoardModule } from '@/boards/board.module';
import { InventoryModule } from '@/inventory/inventory.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { OrderModule } from '@/orders/order.module';
import { UserModule } from '@/users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    AuthModule,
    RoleModule,
    UserModule,
    PackageModule,
    BoardModule,
    InventoryModule,
    SubscriptionModule,
    RealtimeModule,
    OrderModule,
  ],
})
export class AppModule {}
