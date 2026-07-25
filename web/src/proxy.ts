// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose"; // Assuming jose is the package you are using
import { vars } from "@/vars";
import { ACCESS_TOKEN_MAX_AGE, AUTH_COOKIE_OPTS, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

import { env } from "@/env";

// --- CONFIGURATION & SECRETS ---
const accessSecret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const refreshSecret = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET);

// --- HELPERS ---
async function isTokenValid(token: string, secret: Uint8Array): Promise<boolean> {
  if (!secret.length || !token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

async function rotateTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    // Using your vars configuration layout here
    const res = await fetch(`${vars.API_GATEWAY_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: refreshToken }),
      cache: "no-store",
    });

    // console.log("++++++++++++++++++++++++++++++++++ from rotating ", res.ok);

    if (!res.ok) return null;

    const json = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (!json.accessToken || !json.refreshToken) return null;
    return { accessToken: json.accessToken, refreshToken: json.refreshToken };
  } catch {
    return null;
  }
}

// --- MIDDLEWARE ---
export async function proxy(request: NextRequest) {
  // console.log("@@@@@@@@@@@@@@@@@@ 2");

  // 1. Clone request headers to safely modify them downstream
  const requestHeaders = new Headers(request.headers);

  // Set the current path for downstream server components
  const currentPath = request.nextUrl.pathname;
  requestHeaders.set("x-current-path", currentPath);
  console.log("===================== 1 current path ", currentPath);

  // Extract string values safely from cookies
  const accessToken = request.cookies.get("accessToken")?.value ?? "";
  const refreshToken = request.cookies.get("refreshToken")?.value ?? "";

  // console.log("$$$$$$$$$$$$$$$$$$$$$$ 2 accesstoken ", accessToken);
  // console.log("$$$$$$$$$$$$$$$$$$$$$$ 3 refresh token", refreshToken);

  // console.log("@@@@@@@@@@@@@@@@@@ 2");

  let finalAccessToken = "";
  let tokensWereRotated = false;
  let newRefreshToken = "";

  // console.log("vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv ", process.env.ACCESS_TOKEN_SECRET);

  // 2. Token Evaluation Flow
  if (await isTokenValid(accessToken, accessSecret)) {
    // Case A: Access token is verified and active
    finalAccessToken = accessToken;
  } else if (await isTokenValid(refreshToken, refreshSecret)) {
    // Case B: Access token is invalid/expired, but refresh token passes signature verification
    const newTokens = await rotateTokens(refreshToken);

    if (newTokens) {
      finalAccessToken = newTokens.accessToken;
      newRefreshToken = newTokens.refreshToken;
      tokensWereRotated = true;
    }
  }
  // Case C: If both are invalid, finalAccessToken remains an empty string

  // 3. Set Authorization Key Header
  // Sets 'Bearer <token>' if valid/rotated, otherwise sets an empty string
  // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^ ", finalAccessToken);
  // if (finalAccessToken) {
  //   requestHeaders.set("authorization", `Bearer ${finalAccessToken}`);
  // } else {
  //   requestHeaders.set("authorization", "");
  // }

  const incomingAuth = request.headers.get("authorization");

  if (finalAccessToken) {
    requestHeaders.set("authorization", `Bearer ${finalAccessToken}`);
  } else if (incomingAuth) {
    // If we have no cookies but the incoming request already has an Auth header, preserve it!
    requestHeaders.set("authorization", incomingAuth);
  } else {
    requestHeaders.set("authorization", "");
  }

  // 4. Create response passing the updated request headers downstream
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 5. Commit newly rotated tokens back to user's browser storage if applicable
  if (tokensWereRotated && finalAccessToken) {
    response.cookies.set("accessToken", finalAccessToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    response.cookies.set("refreshToken", newRefreshToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  return response;
}

// --- OPTIONAL MATCH CONFLICT FILTER ---
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
