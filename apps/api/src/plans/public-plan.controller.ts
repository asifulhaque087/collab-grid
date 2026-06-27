import { Controller, Get } from '@nestjs/common';
import { PlanService } from './plan.service';

// Unauthenticated plan listing for the public marketing homepage funnel.
// Kept separate from PlanController so it isn't subject to that controller's
// auth/permission/quota guards. Returns display-ready plan cards.
@Controller('plans')
export class PublicPlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('public')
  findPublic() {
    return this.planService.findPublicPlans();
  }
}
