import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";

// Role constants (matches DB check constraint values)
export const ROLES = {
  SUPER_ADMIN: "superadmin",
  SCORER: "scorer",
} as const;

export const ALL_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.SCORER];
export const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];

/**
 * Require an admin session. Returns { session, error }.
 * If error is non-null, return it immediately from the route handler.
 * Optionally restrict to specific roles via allowedRoles.
 */
export async function requireAdminSession(allowedRoles?: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      session: null as null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Role check if allowedRoles specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (session.user as any).role as string | undefined;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return {
        session: null as null,
        error: NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 }
        ),
      };
    }
  }

  return { session, error: null as null };
}
