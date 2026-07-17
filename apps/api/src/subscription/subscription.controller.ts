import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { RoleGuard } from '@/auth/guards/role.guard';
import { LimitGuard } from '@/auth/guards/limit.guard';
import { LimitUpdaterGuard } from '@/auth/guards/limit-updater.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscription')
@UseGuards(AccessTokenGuard, RoleGuard, LimitGuard, LimitUpdaterGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.Subscription })
  findAll(@GetUser() user: AuthUser) {
    return this.subscriptionService.findAll(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.Subscription })
  subscribe(@Body() dto: CreateSubscriptionDto, @GetUser() user: AuthUser) {
    return this.subscriptionService.subscribe(dto, user.userId);
  }
}
