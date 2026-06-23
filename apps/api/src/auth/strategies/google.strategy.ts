import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";
import { AuthService } from "@/auth/auth.service";
import { ValidateSocialUserDto } from "@/auth/dto/validate-social-user.dto";
import { AuthTokens } from "@/auth/auth.types";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>("GOOGLE_CLIENT_ID"),
      clientSecret: configService.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
      callbackURL: configService.getOrThrow<string>("GOOGLE_CALLBACK_URL"),
      scope: ["email", "profile"],
    });
  }

  // Return value becomes `req.user` for the callback route.
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<AuthTokens> {
    const { id, displayName, emails, photos, provider } = profile;

    const email = emails && emails.length > 0 ? emails[0].value : null;
    const photo = photos && photos.length > 0 ? photos[0].value : undefined;

    if (!email) {
      throw new UnauthorizedException(
        "No email associated with this Google account",
      );
    }

    const socialUserDto: ValidateSocialUserDto = {
      username: displayName || id,
      provider,
      email,
      profilePicture: photo,
    };

    const { accessToken, refreshToken } =
      await this.authService.validateSocialUser(socialUserDto);

    return { accessToken, refreshToken };
  }
}
