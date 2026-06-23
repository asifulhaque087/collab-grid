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
  // quota snapshot), sets the auth cookies, and returns the safe user fields.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterUserDto,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.registerUser(dto);

    const cookieSettings = this.authService.getCookieSettings(
      user.accessToken,
      user.refreshToken,
    );

    res.cookie(
      cookieSettings.access.name,
      cookieSettings.access.value,
      cookieSettings.access.options,
    );
    res.cookie(
      cookieSettings.refresh.name,
      cookieSettings.refresh.value,
      cookieSettings.refresh.options,
    );

    // Never leak the password hash or refresh token in the response body;
    // tokens travel in httpOnly cookies.
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
    });
  }

  // Email/password login. Verifies credentials, sets the auth cookies, and
  // returns the safe user fields (same shape as register).
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto, @Res() res: Response): Promise<void> {
    const user = await this.authService.loginUser(dto);

    const cookieSettings = this.authService.getCookieSettings(
      user.accessToken,
      user.refreshToken,
    );

    res.cookie(
      cookieSettings.access.name,
      cookieSettings.access.value,
      cookieSettings.access.options,
    );
    res.cookie(
      cookieSettings.refresh.name,
      cookieSettings.refresh.value,
      cookieSettings.refresh.options,
    );

    // Never leak the password hash or refresh token in the response body;
    // tokens travel in httpOnly cookies.
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
    });
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

  // Signs the user out: clears the server-side refresh token and both httpOnly
  // auth cookies. The guard ensures only an authenticated caller reaches here.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async logout(
    @GetUser() authUser: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    await this.authService.logout(authUser.userId);

    // Match the options the cookies were set with so the browser clears them.
    const clearOptions = { httpOnly: true, secure: false };
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.json({ message: 'Signed out successfully.' });
  }

  // Kicks off the Google OAuth redirect; the guard handles the rest.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  // Google redirects here after consent. `req.user` is the token pair returned
  // by GoogleStrategy.validate(); we set the cookies and bounce to the client.
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(
    @GetUser() tokens: AuthTokens,
    @Res() res: Response,
  ): void {
    const cookieSettings = this.authService.getCookieSettings(
      tokens.accessToken,
      tokens.refreshToken,
    );

    res.cookie(
      cookieSettings.access.name,
      cookieSettings.access.value,
      cookieSettings.access.options,
    );
    res.cookie(
      cookieSettings.refresh.name,
      cookieSettings.refresh.value,
      cookieSettings.refresh.options,
    );

    res.redirect(this.configService.getOrThrow<string>('CLIENT_URL'));
  }
}
