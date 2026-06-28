import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { QuotaGuard } from '@/auth/guards/quota.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('plans')
@UseGuards(AccessTokenGuard, PermissionsGuard, QuotaGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('permissions')
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  listPermissions() {
    return this.planService.listPermissions();
  }

  @Get()
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  findAll() {
    return this.planService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  create(@Body() dto: CreatePlanDto, @GetUser() user: AuthUser) {
    return this.planService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.planService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.planService.remove(id);
  }
}
