import { IsString, MaxLength, MinLength } from "class-validator";

// Request body for POST /auth/reset-password. `token` is the raw token from the
// emailed link; `password` is the new password (bounds mirror RegisterUserDto).
export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only hashes the first 72 bytes
  password!: string;
}
