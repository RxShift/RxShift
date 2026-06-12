import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Host-based routing:
//   rxshift.io          → marketing pages at root URLs
//   app.rxshift.io      → platform; paths rewritten to /app/* internally
//   app.localhost:3200  → same behavior for local dev
//   localhost:3200/app  → direct platform access in dev (no subdomain needed)
//
// Auth: /app/* requires a Supabase session, except the login + auth routes.

const PUBLIC_APP_PATHS = ["/app/login", "/app/auth"];

function isAppHost(host: string): boolean {
  return host.startsWith("app.");
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  const isProd = process.env.NODE_ENV === "production";

  // Marketing host in production: /app/* belongs on the app subdomain
  if (isProd && !isAppHost(host) && pathname.startsWith("/app")) {
    const appUrl = new URL(request.url);
    appUrl.host = `app.${host.replace(/^www\./, "")}`;
    appUrl.pathname = pathname.replace(/^\/app/, "") || "/";
    return NextResponse.redirect(appUrl);
  }

  // App host: rewrite to the /app route tree
  let effectivePath = pathname;
  let rewritten = false;
  if (isAppHost(host) && !pathname.startsWith("/app")) {
    effectivePath = pathname === "/" ? "/app" : `/app${pathname}`;
    rewritten = true;
  }

  const isAppRoute = effectivePath.startsWith("/app");

  // Refresh the Supabase session (required for SSR auth)
  let response = rewritten
    ? NextResponse.rewrite(new URL(effectivePath, request.url))
    : NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = rewritten
            ? NextResponse.rewrite(new URL(effectivePath, request.url))
            : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAppRoute) {
    const isPublic = PUBLIC_APP_PATHS.some((p) => effectivePath.startsWith(p));
    if (!user && !isPublic) {
      const loginUrl = new URL(
        isAppHost(host) ? "/login" : "/app/login",
        request.url
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // Run on everything except static assets and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|api/).*)"],
};
