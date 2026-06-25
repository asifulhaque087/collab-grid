
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@/auth/auth.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { RoleModule } from '@/roles/role.module';
import { PlanModule } from '@/plans/plan.module';
import { BoardModule } from '@/boards/board.module';
import { SubscriptionModule } from '@/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    AuthModule,
    RoleModule,
    PlanModule,
    BoardModule,
    SubscriptionModule,
  ],
})
export class AppModule {}
