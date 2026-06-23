import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

// Request body for POST /auth/register. Built from the `users` schema — only
// the fields needed to create an account; clinic/profile details are filled in
// later during onboarding (`users.isOnboarded`).
export class RegisterUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only hashes the first 72 bytes
  password!: string;
}
