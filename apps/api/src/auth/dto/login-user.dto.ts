import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

// Request body for POST /auth/login. Email-only for now — login by phone is
// deferred until the `users` table gains a real, unique phone column (see the
// User Login feature notes). Bounds mirror RegisterUserDto.
export class LoginUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only hashes the first 72 bytes
  password!: string;
}
