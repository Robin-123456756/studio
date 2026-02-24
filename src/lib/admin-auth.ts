import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Require an admin session. Returns { session, error }.
 * If error is non-null, return it immediately from the route handler.
 */
export async function requireAdminSession() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      session: null as null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null as null };
}
