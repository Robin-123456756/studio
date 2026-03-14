import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the validated data or a 400 error response.
 */
export function parseBody<T>(
  schema: ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: "Invalid request data",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
