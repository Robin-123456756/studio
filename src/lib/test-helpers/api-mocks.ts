/**
 * Shared mock factories for API route tests.
 *
 * Provides:
 * - mockSupabaseAdmin()  → mock for getSupabaseServerOrThrow (service role)
 * - mockSupabaseAuth()   → mock for supabaseServer (cookie-based auth)
 * - chainable query builder that mirrors PostgREST's .from().select().eq()... pattern
 */

/* ------------------------------------------------------------------ */
/*  Chainable query builder                                            */
/* ------------------------------------------------------------------ */

type MockResult = { data: unknown; error: unknown };

/**
 * Creates a chainable mock that records every method call and resolves
 * to `result` when awaited (PostgREST queries are thenable).
 */
export function chainable(result: MockResult = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      // .then / .catch / Symbol.toStringTag — make the chain thenable
      if (prop === "then") {
        return (resolve: (v: MockResult) => void) => resolve(result);
      }
      if (prop === "catch") {
        return () => Promise.resolve(result);
      }
      if (typeof prop === "symbol") return undefined;

      // Lazy-create a spy for every method name
      if (!chain[prop]) {
        chain[prop] = vi.fn().mockReturnValue(new Proxy({}, handler));
      }
      return chain[prop];
    },
  };

  return new Proxy({}, handler) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/* ------------------------------------------------------------------ */
/*  Supabase admin mock (getSupabaseServerOrThrow)                     */
/* ------------------------------------------------------------------ */

export interface MockTable {
  result: MockResult;
}

/**
 * Build a mock Supabase client where each table returns a specific result.
 *
 * Usage:
 *   const sb = mockSupabaseAdmin({
 *     teams: { result: { data: [{ name: "FC" }], error: null } },
 *   });
 */
export function mockSupabaseAdmin(tables: Record<string, MockTable> = {}) {
  const client = {
    from: vi.fn((table: string) => {
      const cfg = tables[table];
      return chainable(cfg?.result ?? { data: null, error: null });
    }),
  };
  return client;
}

/* ------------------------------------------------------------------ */
/*  Supabase auth mock (supabaseServer — cookie-based)                */
/* ------------------------------------------------------------------ */

interface AuthMockOptions {
  /** If provided, auth.getUser() resolves with this user. Null = not signed in. */
  user: { id: string; email?: string } | null;
  /** Table results for data queries (same as admin mock). */
  tables?: Record<string, MockTable>;
}

export function mockSupabaseAuth({ user, tables = {} }: AuthMockOptions) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Not signed in" } }
      ),
    },
    from: vi.fn((table: string) => {
      const cfg = tables[table];
      return chainable(cfg?.result ?? { data: null, error: null });
    }),
  };
  return client;
}

/* ------------------------------------------------------------------ */
/*  Request / URL helpers                                              */
/* ------------------------------------------------------------------ */

/** Build a GET Request with optional search params. */
export function mockGetRequest(
  path: string,
  params: Record<string, string> = {}
) {
  const url = new URL(path, "http://localhost:3000");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

/** Build a POST Request with a JSON body. */
export function mockPostRequest(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Response helpers                                                   */
/* ------------------------------------------------------------------ */

/** Parse a NextResponse into { status, body }. */
export async function parseResponse(res: Response) {
  const body = await res.json();
  return { status: res.status, body };
}
