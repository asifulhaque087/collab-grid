import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

// Pulls whatever the active strategy attached to `req.user` (e.g. the AuthUser
// from JwtStrategy, or the AuthTokens from GoogleStrategy on the callback).
export const GetUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
