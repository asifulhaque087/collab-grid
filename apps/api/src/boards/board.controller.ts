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
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Controller('boards')
@UseGuards(AccessTokenGuard, PermissionsGuard, QuotaGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.Board })
  findAll(@GetUser() user: AuthUser) {
    return this.boardService.findAll(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.Board })
  create(@Body() dto: CreateBoardDto, @GetUser() user: AuthUser) {
    return this.boardService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Update, subject: Subjects.Board })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBoardDto,
    @GetUser() user: AuthUser,
  ) {
    return this.boardService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Delete, subject: Subjects.Board })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.boardService.remove(id, user.userId);
  }
}
