import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Supabase session refresh (keeps auth cookies alive) ──
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

  // Calling getUser() triggers token refresh if the access token is expired
  await supabase.auth.getUser();

  // ── Admin auth (next-auth) ──
  if (pathname === "/admin/login" || pathname.startsWith("/api/auth")) {
    return supabaseResponse;
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
    if (userRole && userRole !== "super_admin") {
      const isBlocked = superAdminOnlyPages.some(
        (page) => pathname === page || pathname.startsWith(page + "/")
      );
      if (isBlocked) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
