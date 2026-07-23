import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from '@/auth/auth.service';
import { RegisterUserDto } from '@/auth/dto/register-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { RefreshAccessTokenDto } from '@/auth/dto/refresh-access-token.dto';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { GoogleAuthGuard } from '@/auth/guards/google-auth.guard';
import { AuthTokens, AuthUser, type Quota } from '@/auth/auth.types';
import type { PermissionTuple } from '@/auth/permissions';

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterUserDto): Promise<{
    user: { id: string; name: string; email: string };
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.authService.registerUser(dto);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto): Promise<{
    user: { id: string; name: string; email: string };
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.authService.loginUser(dto);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Your password has been reset. You can now log in.' };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@GetUser() authUser: AuthUser): Promise<{
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: PermissionTuple[];
    plan: string;
    quotas: Quota[];
  }> {
    const tenantId = authUser.primaryUserId ?? authUser.userId;
    
		console.time('Promise.all me endpoint');
		
    const [user, access, planInfo] = await Promise.all([
      this.authService.getMe(authUser.userId),
      this.authService.getAccessContext(authUser.userId),
      this.authService.getUserQuotas(tenantId),
    ]);
    
    console.timeEnd('Promise.all me endpoint');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: access.roles,
      permissions: access.permissions,
      plan: planInfo.plan,
      quotas: planInfo.quotas,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async logout(@GetUser() authUser: AuthUser): Promise<{ message: string }> {
    await this.authService.logout(authUser.userId);

    return { message: 'Signed out successfully.' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshAccessTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { newAccessToken, newRefreshToken } =
      await this.authService.refreshAccessToken(dto);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(
    @GetUser() tokens: AuthTokens,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): void {
    const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');
    const plan = state || undefined;
    const redirect = `${clientUrl}/api/auth/callback?accessToken=${encodeURIComponent(
      tokens.accessToken,
    )}&refreshToken=${encodeURIComponent(tokens.refreshToken)}${plan ? `&plan=${encodeURIComponent(plan)}` : ''}`;
    res.redirect(redirect);
  }
}
