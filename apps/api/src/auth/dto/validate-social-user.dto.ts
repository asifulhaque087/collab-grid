import { IsEmail, IsOptional, IsString } from "class-validator";

// Built from a Google profile in GoogleStrategy.validate() and handed to
// AuthService.validateSocialUser(). `profilePicture` is carried for parity with
// the OAuth profile but is not persisted yet (no column on the users table).
export class ValidateSocialUserDto {
  @IsString()
  username!: string;

  @IsString()
  provider!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  profilePicture?: string;
}
