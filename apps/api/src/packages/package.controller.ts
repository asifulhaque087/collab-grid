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
import { RoleGuard } from '@/auth/guards/role.guard';
import { LimitGuard } from '@/auth/guards/limit.guard';
import { LimitUpdaterGuard } from '@/auth/guards/limit-updater.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Controller('packages')
@UseGuards(AccessTokenGuard, RoleGuard, LimitGuard, LimitUpdaterGuard)
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get('permissions')
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  listPermissions() {
    return this.packageService.listPermissions();
  }

  @Get()
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  findAll() {
    return this.packageService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  create(@Body() dto: CreatePackageDto, @GetUser() user: AuthUser) {
    return this.packageService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packageService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Manage, subject: Subjects.All })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packageService.remove(id);
  }
}
