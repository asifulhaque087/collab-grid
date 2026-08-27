import { env } from "@/env";

export const ACCESS_TOKEN_MAX_AGE = 60 * 7;
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
