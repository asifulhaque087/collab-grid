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
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Controller('packages')
@UseGuards(AccessTokenGuard, RoleGuard, LimitGuard)
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get('permissions')
  @RequirePermission({ action: Action.Read, subject: Subjects.Permission })
  listPermissions() {
    return this.packageService.listPermissions();
  }

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.Package })
  findAll() {
    return this.packageService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.Package })
  create(@Body() dto: CreatePackageDto, @GetUser() user: AuthUser) {
    return this.packageService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Update, subject: Subjects.Package })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packageService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Delete, subject: Subjects.Package })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packageService.remove(id);
  }
}
