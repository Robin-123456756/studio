import { NextResponse } from "next/server";

/**
 * Two-layer error handling:
 * Layer 1 (client): Generic safe message + error code
 * Layer 2 (server): Full structured log with context
 *
 * NEVER expose raw Supabase/internal error messages to clients.
 */
export function apiError(
  userMessage: string,
  code: string,
  status: number,
  internalError?: unknown
): NextResponse {
  // Log full details server-side (Vercel captures stdout)
  if (internalError) {
    console.error(
      JSON.stringify({
        level: "error",
        code,
        message: userMessage,
        internal:
          internalError instanceof Error
            ? internalError.message
            : String(internalError),
        timestamp: new Date().toISOString(),
      })
    );
  }

  // Return sanitized response to client
  return NextResponse.json({ error: userMessage, code }, { status });
}
