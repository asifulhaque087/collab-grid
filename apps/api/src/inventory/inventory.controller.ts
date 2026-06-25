import {
  BadRequestException,
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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { QuotaGuard } from '@/auth/guards/quota.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

// Uploaded file shape from multer's memory storage (FileInterceptor default).
interface UploadedCsv {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Controller('inventory')
@UseGuards(AccessTokenGuard, PermissionsGuard, QuotaGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission({ action: Action.Read, subject: Subjects.SmartWidget })
  findAll(@GetUser() user: AuthUser, @Query('boardId') boardId?: string) {
    return this.inventoryService.findAll(user.userId, boardId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.SmartWidget })
  create(@Body() dto: CreateInventoryDto, @GetUser() user: AuthUser) {
    return this.inventoryService.create(dto, user.userId);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission({ action: Action.Create, subject: Subjects.SmartWidget })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @UploadedFile() file: UploadedCsv | undefined,
    @GetUser() user: AuthUser,
    @Body('boardId') boardId?: string,
  ) {
    if (!file) throw new BadRequestException('A CSV file is required.');
    return this.inventoryService.importCsv(file.buffer, user.userId, boardId);
  }

  @Patch(':id')
  @RequirePermission({ action: Action.Update, subject: Subjects.SmartWidget })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
    @GetUser() user: AuthUser,
  ) {
    return this.inventoryService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ action: Action.Delete, subject: Subjects.SmartWidget })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.inventoryService.remove(id, user.userId);
  }
}
