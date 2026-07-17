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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(AccessTokenGuard, RoleGuard, LimitGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.User })
  findAll(@GetUser() user: AuthUser) {
    return this.userService.findAll(user.userId, user.primaryUserId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.User })
  create(@Body() dto: CreateUserDto, @GetUser() user: AuthUser) {
    return this.userService.create(dto, user.userId, user.primaryUserId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Update, subject: Subjects.User })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Delete, subject: Subjects.User })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }
}
