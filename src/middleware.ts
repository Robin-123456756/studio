import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

// ── Security Headers (Phase 1.1) ──
// Applied to every response that passes through middleware.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

/** Apply security headers to a NextResponse */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep PWA install assets untouched by auth/session middleware.
  if (
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-")
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Supabase session refresh (keeps auth cookies alive)
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Admin pages and voice-admin API use NextAuth, not Supabase — skip the
  // Supabase token refresh to avoid an unnecessary network round-trip.
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/voice-admin");

  if (pathname === "/admin/login" || pathname.startsWith("/api/auth")) {
    return applySecurityHeaders(supabaseResponse);
  }

  if (!isAdminRoute) {
    // Calling getUser() triggers token refresh if the access token is expired
    await supabase.auth.getUser();
  }

  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based page blocking: scorer cannot access super-admin-only pages
    const superAdminOnlyPages = ["/admin/season", "/admin/players/import"];
    const userRole = token.role as string | undefined;
    if (userRole && userRole !== "superadmin") {
      const isBlocked = superAdminOnlyPages.some(
        (page) => pathname === page || pathname.startsWith(page + "/")
      );
      if (isBlocked) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    // Run on all routes except static files and PWA install assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
