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
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(AccessTokenGuard, PermissionsGuard, QuotaGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('permissions')
  @RequirePermission({ action: Action.Read, subject: Subjects.Permission })
  listPermissions() {
    return this.roleService.listPermissions();
  }

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.Group })
  findAll(@GetUser() user: AuthUser) {
    return this.roleService.findAll(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.Group })
  create(@Body() dto: CreateRoleDto, @GetUser() user: AuthUser) {
    return this.roleService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Update, subject: Subjects.Group })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @GetUser() user: AuthUser,
  ) {
    return this.roleService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Delete, subject: Subjects.Group })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: AuthUser,
  ) {
    return this.roleService.remove(id, user.userId);
  }
}
