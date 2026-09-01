import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_MAX_AGE, AUTH_COOKIE_OPTS, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

// Node runtime — we set cookies on the response.
export const runtime = "nodejs";

// The NestJS Google strategy redirects here with the token pair as query params
// (apps/api/src/auth/auth.controller.ts -> googleAuthRedirect). We capture them,
// set the httpOnly auth cookies, and drop the user on the dashboard. This keeps
// the SPA from ever touching raw tokens.

// === real ===
export function GET(request: NextRequest): NextResponse {
  // console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs")

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

  console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs 1", request.url);
  console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs 2", host);
  console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs 3", request.headers.get("x-forwarded-host"));
  console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs 4", request.headers.get("host"));

  const accessToken = request.nextUrl.searchParams.get("accessToken");
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");
  const plan = request.nextUrl.searchParams.get("plan");

  const destination = plan ? `/subscription/checkout?plan=${encodeURIComponent(plan)}` : "/dashboard/boards";
  // const response = NextResponse.redirect(new URL(destination, request.url));
  const response = NextResponse.redirect(new URL(destination, "https://lootboard.asif-haque.com"));

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

// === Exp 1===

// === new ===

// export function GET(request: NextRequest): NextResponse {
//   const accessToken = request.nextUrl.searchParams.get("accessToken");
//   const refreshToken = request.nextUrl.searchParams.get("refreshToken");
//   const plan = request.nextUrl.searchParams.get("plan");

//   // Clone nextUrl so host/protocol are automatically preserved
//   const redirectUrl = request.nextUrl.clone();

//   console.log(" call back route ^^^^^^^^^^^^^^^^^ from nextjs ", redirectUrl);

//   redirectUrl.pathname = plan ? "/subscription/checkout" : "/dashboard/boards";
//   redirectUrl.search = plan ? `?plan=${encodeURIComponent(plan)}` : "";

//   const response = NextResponse.redirect(redirectUrl);

//   if (accessToken) {
//     response.cookies.set("accessToken", accessToken, {
//       ...AUTH_COOKIE_OPTS,
//       maxAge: ACCESS_TOKEN_MAX_AGE,
//     });
//   }
//   if (refreshToken) {
//     response.cookies.set("refreshToken", refreshToken, {
//       ...AUTH_COOKIE_OPTS,
//       maxAge: REFRESH_TOKEN_MAX_AGE,
//     });
//   }

//   return response;
// }
