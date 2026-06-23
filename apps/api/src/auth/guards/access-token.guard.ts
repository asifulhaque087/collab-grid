import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { AuthService } from "@/auth/auth.service";

@Injectable()
export class AccessTokenGuard extends AuthGuard("jwt") {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const accessToken = request.cookies?.["accessToken"] as string | undefined;
    const accessSecret =
      this.configService.getOrThrow<string>("ACCESS_TOKEN_SECRET");
    const refreshSecret =
      this.configService.getOrThrow<string>("REFRESH_TOKEN_SECRET");

    if (
      !accessToken ||
      this.authService.isTokenExpired(accessToken, accessSecret)
    ) {
      // Access token missing/expired — try to silently rotate using the
      // refresh token cookie.
      const refreshToken = request.cookies?.["refreshToken"] as
        | string
        | undefined;
      if (!refreshToken) throw new UnauthorizedException();

      if (this.authService.isTokenExpired(refreshToken, refreshSecret)) {
        throw new UnauthorizedException();
      }

      const { newAccessToken, newRefreshToken } =
        await this.authService.refreshAccessToken({ token: refreshToken });

      const cookieSettings = this.authService.getCookieSettings(
        newAccessToken,
        newRefreshToken,
      );

      response.cookie(
        cookieSettings.access.name,
        cookieSettings.access.value,
        cookieSettings.access.options,
      );
      response.cookie(
        cookieSettings.refresh.name,
        cookieSettings.refresh.value,
        cookieSettings.refresh.options,
      );

      request.headers["authorization"] = `Bearer ${newAccessToken}`;
    } else {
      request.headers["authorization"] = `Bearer ${accessToken}`;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
