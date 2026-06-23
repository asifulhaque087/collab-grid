import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthUser, JwtPayload } from "@/auth/auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>("ACCESS_TOKEN_SECRET"),
    });
  }

  // Return value is attached to `req.user`.
  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.id, email: payload.email };
  }
}
