import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE,
  AUTH_COOKIE_OPTS,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-cookies";

// Node runtime — we set cookies on the response.
export const runtime = "nodejs";

// The NestJS Google strategy redirects here with the token pair as query params
// (apps/api/src/auth/auth.controller.ts -> googleAuthRedirect). We capture them,
// set the httpOnly auth cookies, and drop the user on the dashboard. This keeps
// the SPA from ever touching raw tokens.
export function GET(request: NextRequest): NextResponse {
  const accessToken = request.nextUrl.searchParams.get("accessToken");
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  if (accessToken) {
    response.cookies.set("accessToken", accessToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }
  if (refreshToken) {
    response.cookies.set("refreshToken", refreshToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }
  return response;
}
