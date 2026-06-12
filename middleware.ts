import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rewrite app.rxshift.io/* → /app/* so the single deployment serves both domains.
// Paths already prefixed with /app, /api, or /_next pass through untouched.
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (
    host === "app.rxshift.io" &&
    !pathname.startsWith("/app") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.match(/\.[a-z0-9]+$/i)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
