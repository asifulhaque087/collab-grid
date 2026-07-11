import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

@Injectable()
export class AccessTokenGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Pure token-based: prefer the Bearer token from the Authorization header,
    // falling back to the (legacy) accessToken cookie. No refresh-token
    // rotation happens here — rotation is centralized in POST /auth/refresh.
    const authHeader = request.headers.authorization;
    const token =
      authHeader?.startsWith("Bearer ") === true
        ? authHeader.slice("Bearer ".length)
        : undefined;

    if (token) {
      request.headers["authorization"] = `Bearer ${token}`;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
