// Auth-cookie configuration shared by the BFF route handlers and the Next
// middleware. Kept free of `next/headers` so it can be imported from the Edge
// middleware runtime without pulling in server-only APIs.

// Cookie lifetimes mirror the backend JWT expirations so the httpOnly cookie and
// the token it carries expire together.
export const ACCESS_TOKEN_MAX_AGE = 60 * 7; // 7 minutes
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
