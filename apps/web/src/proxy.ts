import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 proxy (formerly middleware). Runs before a dashboard page renders
// and stamps the request with the current pathname so the server-side
// PermissionGuard can resolve the route's required permission from headers.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Only run on dashboard routes (where the permission guard lives); skip static
// assets and Next internals.
export const config = {
  matcher: ["/dashboard/:path*"],
};
