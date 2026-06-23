import { IsEmail } from "class-validator";

// Request body for POST /auth/forgot-password. We only need the email; the
// response is intentionally generic so it never reveals whether an account
// exists for that address.
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
