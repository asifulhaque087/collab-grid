import { z } from "zod";

// Field bounds mirror the API DTOs (apps/api/src/auth/dto/*) so client-side
// validation matches what the server will accept.
const email = z.string().email("Enter a valid email address");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const loginSchema = z.object({
  email,
  password,
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name must be at most 255 characters"),
  email,
  password,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is missing"),
  password,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// Form-only schemas: add a `confirmPassword` field whose match check happens
// entirely on the client. The extra field is stripped before the API call —
// the server never receives or validates it.
const confirmPassword = z.string().min(1, "Please confirm your password");

export const registerFormSchema = registerSchema
  .extend({ confirmPassword })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
