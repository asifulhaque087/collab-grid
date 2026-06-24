
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@/auth/auth.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { RoleModule } from '@/roles/role.module';
import { PlanModule } from '@/plans/plan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    AuthModule,
    RoleModule,
    PlanModule,
  ],
})
export class AppModule {}
