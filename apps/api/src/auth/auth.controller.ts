import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { AuthTokens, AuthUser } from '@/auth/auth.types';
import type { PermissionTuple } from '@/auth/permissions';
import { userPlanSnapshotTable } from '@/schemas';

// Generic response for the forgot-password endpoint — deliberately identical
// whether or not the email maps to an account (no enumeration).
const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Email/password registration. Creates the user (free plan + doctor role +
  // quota snapshot) and returns the auth token pair + safe user fields. The
  // client stores the tokens (no httpOnly cookies are set).
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterUserDto): Promise<{
    user: { id: string; name: string; email: string; plan: string };
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.authService.registerUser(dto);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  }

  // Email/password login. Verifies credentials and returns the auth token pair
  // + safe user fields (same shape as register). The client stores the tokens.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto): Promise<{
    user: { id: string; name: string; email: string; plan: string };
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.authService.loginUser(dto);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  }

  // Starts the password-reset flow: emails a reset link if the account exists.
  // Always returns the same generic message so the response can't be used to
  // tell whether an email is registered.
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  // Completes the password-reset flow: validates the token and sets the new
  // password. A missing/expired token yields a 400 from the service.
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Your password has been reset. You can now log in.' };
  }

  // Returns the authenticated user's safe profile. The guard verifies (and, if
  // needed, silently rotates) the access-token cookie and attaches `req.user`.
  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@GetUser() authUser: AuthUser): Promise<{
    id: string;
    name: string;
    email: string;
    plan: string;
    roles: string[];
    permissions: PermissionTuple[];
    quotas: Omit<typeof userPlanSnapshotTable.$inferSelect, 'userId'>[];
  }> {
    const [user, access] = await Promise.all([
      this.authService.getMe(authUser.userId),
      this.authService.getAccessContext(authUser.userId),
    ]);

    // Same allowlist as register/login — never leak the password hash or tokens.
    // `roles`/`permissions` let the web gate admin menus/pages.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      roles: access.roles,
      permissions: access.permissions,
      quotas: access.quotas,
    };
  }

  // Signs the user out: clears the server-side refresh token. The client is
  // responsible for discarding the stored access/refresh tokens. The guard
  // ensures only an authenticated caller reaches here.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async logout(@GetUser() authUser: AuthUser): Promise<{ message: string }> {
    await this.authService.logout(authUser.userId);

    return { message: 'Signed out successfully.' };
  }

  // Explicit token rotation. The client calls this with its stored refresh
  // token to mint a fresh access/refresh pair — this is the single,
  // centralized place rotation happens (the guard no longer rotates).
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshAccessTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { newAccessToken, newRefreshToken } =
      await this.authService.refreshAccessToken(dto);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // Kicks off the Google OAuth redirect; the guard handles the rest.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  // Google redirects here after consent. `req.user` is the token pair returned
  // by GoogleStrategy.validate(); we hand the tokens back to the client as
  // query params on the client URL (no httpOnly cookies are set, so the SPA
  // stores them directly).
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(
    @GetUser() tokens: AuthTokens,
    @Res() res: Response,
  ): void {
    const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');
    const redirect = `${clientUrl}/api/auth/callback?accessToken=${encodeURIComponent(
      tokens.accessToken,
    )}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
    res.redirect(redirect);
  }
}
