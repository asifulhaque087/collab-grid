import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PlanController } from './plan.controller';
import { PublicPlanController } from './public-plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [AuthModule],
  controllers: [PlanController, PublicPlanController],
  providers: [PlanService],
})
export class PlanModule {}
