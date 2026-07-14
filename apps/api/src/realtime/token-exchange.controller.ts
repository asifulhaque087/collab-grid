import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import type { AuthUser } from '@/auth/auth.types';
import { SocketAuthService } from './socket-auth.service';
import { ExchangeDto } from './dto/exchange.dto';

@Controller('realtime')
@UseGuards(AccessTokenGuard)
export class TokenExchangeController {
  constructor(private readonly socketAuth: SocketAuthService) {}

  @Post('token-exchange')
  async exchange(
    @Body() dto: ExchangeDto,
    @Req() req: { user: AuthUser },
  ): Promise<{ token: string }> {
    const token = await this.socketAuth.createWsToken(
      req.user.userId,
      dto.boardId,
    );
    return { token };
  }
}
