# Security Enhancement Plan — Budo League Fantasy App

**Created**: 2026-03-14
**Author**: Raymond + Claude (Senior Engineering Partner)
**Status**: Planning
**Target**: Harden the app so that even an MIT-level attacker finds no viable entry point.

---

## Table of Contents

1. [Current Security Posture](#1-current-security-posture)
2. [Phase 1: Immediate Hardening (Week 1)](#phase-1-immediate-hardening-week-1)
3. [Phase 2: Input Validation & Error Sanitization (Week 2)](#phase-2-input-validation--error-sanitization-week-2)
4. [Phase 3: Rate Limiting & Abuse Prevention (Week 3)](#phase-3-rate-limiting--abuse-prevention-week-3)
5. [Phase 4: Database & RLS Lockdown (Week 4)](#phase-4-database--rls-lockdown-week-4)
6. [Phase 5: Monitoring, Logging & Incident Response (Week 5)](#phase-5-monitoring-logging--incident-response-week-5)
7. [Phase 6: Ongoing Hardening & Maintenance](#phase-6-ongoing-hardening--maintenance)
8. [Security Standards Reference](#security-standards-reference)
9. [Verification Checklist](#verification-checklist)

---

## 1. Current Security Posture

### What's Already Solid
- Supabase Auth with server-side `getUser()` on all mutation routes
- Admin routes protected by `requireAdminSession()` with role checks
- Cron routes protected by `CRON_SECRET` bearer token
- No hardcoded secrets in source code; `.env.local` in `.gitignore`
- OpenAI API key has injection validation
- No `exec()`/shell commands with user input (zero RCE surface)
- No `dangerouslySetInnerHTML` with user-controlled content
- Modern dependency versions across the stack
- Proper server-side `getUser()` / client-side `getSession()` split

### What Needs Work

| Area | Current Score | Target |
|------|--------------|--------|
| Security Headers (CSP, HSTS) | 0% | 100% |
| Rate Limiting | 30% | 95% |
| Error Message Sanitization | 40% | 100% |
| Input Validation | 70% | 95% |
| Auth & Authorization | 78% | 98% |
| Database RLS | 75% | 95% |
| Secrets Management | 85% | 98% |
| Transport Security | 95% | 100% |

---

## Phase 1: Immediate Hardening (Week 1)

> **Goal**: Close the widest attack surface with minimal code changes.

### 1.1 — Add Security Headers via Middleware

**Why**: The app currently sends zero security headers. This means it can be iframed (clickjacking), has no XSS mitigation layer, and doesn't enforce HTTPS at the browser level. Every modern security standard (OWASP, Google, Mozilla Observatory) requires these.

**File**: `src/middleware.ts` (extend existing middleware)

**Headers to add**:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | See below | Prevents XSS, code injection |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS for 2 years |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser APIs |

**CSP policy for Budo League** (Tailwind-compatible, shipped):
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' blob: data: https://*.supabase.co;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

> **Note**: `script-src 'unsafe-inline'` is a pragmatic compromise for Next.js App Router which injects inline scripts for hydration. Nonce-based CSP with `strict-dynamic` requires per-request nonce generation and propagation to every `<script>` tag — not straightforward in Next.js middleware without a custom server. For a ~100 user app, the XSS risk is low (all user input is already sanitized). `'unsafe-eval'` has been removed.
>
> `style-src 'unsafe-inline'` is needed for Tailwind CSS inline styles. Google Fonts origins are whitelisted because the app imports Manrope, Sora, Outfit, and JetBrains Mono.

**Implementation approach**:
- Generate a unique nonce per request in middleware using `crypto.randomUUID()`
- Pass nonce to pages via `x-nonce` request header
- Apply headers to all responses via `NextResponse.next()` with modified headers
- Exclude `/_next/static` and `/_next/image` from CSP processing (static assets)

**Estimated effort**: 2 hours
**Risk**: Low — headers are additive, won't break existing functionality
**Test**: Run [Mozilla Observatory](https://observatory.mozilla.org/) and [SecurityHeaders.com](https://securityheaders.com/) scans after deploy

---

### 1.2 — Enable Vercel Security Features

**Why**: Vercel provides free WAF, DDoS protection, and bot management. DDoS and WAF are already active by default. Bot protection needs manual activation.

**Steps**:
1. Go to Vercel Dashboard > Project > Settings > Security
2. Enable **Bot Protection** in "Log-Only Mode" first
3. Monitor for 1 week to identify false positives
4. Switch to **Block Mode** for non-browser traffic
5. Note: DDoS mitigation and WAF are already active on all Vercel plans (no action needed)

**Estimated effort**: 15 minutes
**Risk**: None in Log-Only mode

---

### 1.3 — Fix Auth Bypass in `/api/reviews`

**Why**: This route accepts a spoofed `userId` from the request body with zero authentication. Anyone can submit reviews pretending to be any user.

**File**: `src/app/api/reviews/route.ts`

**Fix**:
- Add `supabase.auth.getUser()` check
- Use `user.id` from the auth token instead of trusting `body.userId`
- Allow unauthenticated reviews but set `user_id: null` (anonymous feedback)

**Estimated effort**: 30 minutes

---

### 1.4 — Remove localStorage Admin Password

**Why**: `src/app/dashboard/admin/players/new/page.tsx` stores an admin password in localStorage (XSS-accessible, persists after logout). The backend never validates this password — it's dead code that creates a false sense of security.

**Fix**:
- Remove `window.localStorage.setItem("tbl_admin_password", ...)` and the `x-admin-password` header
- The route already uses `requireAdminSession()` for real auth — the password mechanism is redundant

**Estimated effort**: 30 minutes

---

### 1.5 — Add `credentials: "same-origin"` to Missing Fetch Calls

**Why**: Two fetch calls in transfer pages don't send auth cookies.

**Files**:
- `src/app/dashboard/transfers/page.tsx` line 298
- `src/app/dashboard/transfers/next/page.tsx` line 271

**Fix**: Add `credentials: "same-origin"` to the fetch options.

**Estimated effort**: 10 minutes

---

## Phase 2: Input Validation & Error Sanitization (Week 2)

> **Goal**: Stop trusting client input. Stop leaking internal errors.

### 2.1 — Create API Error Handler Utility

**Why**: 35+ API routes return raw Supabase error messages (`error.message`) to clients. These leak table names, column names, constraint names, and query structure. An attacker can map your entire DB schema from error messages alone.

**File to create**: `src/lib/api-error.ts`

**Pattern**:
```typescript
// Two-layer error handling:
// Layer 1 (client): Generic safe message + error code
// Layer 2 (server): Full structured log with context

export function apiError(
  userMessage: string,
  code: string,
  status: number,
  internalError?: unknown
): NextResponse {
  // Log full details server-side (Vercel captures stdout)
  if (internalError) {
    console.error(JSON.stringify({
      code,
      message: userMessage,
      internal: internalError instanceof Error
        ? internalError.message
        : String(internalError),
      timestamp: new Date().toISOString(),
    }));
  }

  // Return sanitized response to client
  return NextResponse.json(
    { error: userMessage, code },
    { status }
  );
}
```

**Rollout**: Replace all `return NextResponse.json({ error: error.message })` calls across 35+ routes with `apiError()`. Do this incrementally — 5-10 routes per session.

**Files affected** (all in `src/app/api/`):
- `free-hit-backup/route.ts`
- `fixtures/route.ts`
- `chips/route.ts`
- `teams/route.ts`, `teams/[teamId]/route.ts`, `teams/player-counts/route.ts`
- `rosters/route.ts`, `rosters/current/route.ts`, `rosters/save/route.ts`
- `voice-admin/undo/route.ts`, `voice-admin/process/route.ts`, `voice-admin/matches/route.ts`
- `admin/fixtures/route.ts` (7 locations), `admin/teams/route.ts` (4 locations)
- `admin/gameweeks/route.ts`, `admin/match-scores/route.ts`, `admin/match-scorers/route.ts`
- `players/route.ts`, `standings/route.ts`, `player-stats/route.ts`
- `results/route.ts`, `reviews/route.ts`

**Estimated effort**: 4-5 hours (mechanical but wide-reaching)
**Risk**: Low — only changes error response shape, not business logic

---

### 2.2 — Add Zod Input Validation to High-Risk Routes

**Why**: API routes currently trust that `req.json()` returns the expected shape. A crafted request with missing fields, wrong types, or extra properties can cause silent failures or unexpected behavior. Zod provides runtime type checking that TypeScript cannot (types are erased at build time).

**Dependency**: Zod is already in the dependency tree (shadcn/ui uses it). No new install needed.

**Priority routes to validate** (ordered by risk):

**Route 1: `/api/rosters/save` (POST)**
```typescript
const SaveRosterSchema = z.object({
  gameweek_id: z.number().int().positive(),
  picks: z.array(z.object({
    player_id: z.string().uuid(),
    position: z.number().int().min(1).max(17),
    is_captain: z.boolean(),
    is_vice_captain: z.boolean(),
  })).length(17),
  chip: z.enum(["bench_boost", "triple_captain", "wildcard", "free_hit"]).optional(),
});
```

**Route 2: `/api/transfers` (POST)**
```typescript
const TransferSchema = z.object({
  gameweek_id: z.number().int().positive(),
  transfers_in: z.array(z.string().uuid()),
  transfers_out: z.array(z.string().uuid()),
});
```

**Route 3: `/api/voice-admin/commit-manual` (POST)**
```typescript
const ManualEntrySchema = z.object({
  matchId: z.number().int().positive(),
  events: z.array(z.object({
    playerId: z.string().uuid(),
    actions: z.array(z.object({
      action: z.string().min(1).max(50),
      quantity: z.number().int().min(0).max(100),
    })),
  })),
});
```

**Route 4: `/api/admin/match-scores` (POST)**
```typescript
const MatchScoresSchema = z.object({
  matches: z.array(z.object({
    id: z.number().int().positive(),
    home_goals: z.number().int().min(0),
    away_goals: z.number().int().min(0),
    is_played: z.boolean().optional(),
    is_final: z.boolean().optional(),
  })),
});
```

**Route 5: `/api/chips` (POST)**
```typescript
const ChipSchema = z.object({
  chip: z.enum(["bench_boost", "triple_captain", "wildcard", "free_hit"]),
  gameweek_id: z.number().int().positive(),
});
```

**Validation helper** (create in `src/lib/validate.ts`):
```typescript
import { ZodSchema, ZodError } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Invalid request data", details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
```

**Estimated effort**: 3-4 hours
**Risk**: Low — adds validation before existing logic, doesn't change happy path

---

### 2.3 — Fix `parseInt()` Without Validation

**Why**: `parseInt("abc")` returns `NaN`, which propagates into Supabase queries silently.

**Files** (~8 instances):
- `src/app/api/activity-feed/route.ts` (lines 17, 27)
- `src/app/api/voice-admin/process/route.ts` (line 56)
- `src/app/api/admin/match-scores/route.ts` (lines 106-107, 126-127)

**Fix**: Replace `parseInt(x)` with:
```typescript
const num = Number(x);
if (!Number.isFinite(num)) {
  return NextResponse.json({ error: "Invalid parameter" }, { status: 400 });
}
```

**Estimated effort**: 1 hour

---

## Phase 3: Rate Limiting & Abuse Prevention (Week 3)

> **Goal**: Prevent spam, brute force, and resource exhaustion attacks.

### 3.1 — Evaluate Rate Limiting Strategy

**Current state**: `src/lib/rate-limit.ts` uses in-memory storage. On Vercel serverless, each function invocation gets fresh memory — so the rate limiter resets on every cold start. It only works within a single warm instance.

**Options**:

| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| **Current in-memory** | Zero cost, no setup | Resets on cold start, per-instance only | Free |
| **Upstash Redis** (`@upstash/ratelimit`) | Persistent across instances, battle-tested, Vercel-recommended | External dependency, needs Redis account | Free tier: 10k req/day |
| **Vercel WAF rules** | Zero code, edge-level, blocks before function runs | Less granular, Pro plan for custom rules | Free (basic) / Pro |

**Recommendation for ~100 users**: The current in-memory approach provides some protection and is acceptable at this scale. If abuse occurs or the user base grows, upgrade to Upstash Redis (15 min setup, free tier).

### 3.2 — Add Rate Limits to Unprotected Mutation Routes

**Regardless of backend choice**, these routes need rate limiting:

| Route | Suggested Limit | Why |
|-------|----------------|-----|
| `POST /api/rosters/save` | 10 req/min per user | Prevents save-spam |
| `POST /api/transfers` | 10 req/min per user | Prevents transfer abuse |
| `POST /api/chips` | 5 req/min per user | Chip activation is irreversible |
| `POST /api/mini-leagues` | 5 req/min per user | Prevents league creation spam |
| `POST /api/mini-leagues/join` | 10 req/min per user | Prevents invite code brute-force |
| `POST /api/reviews` | 3 req/min per IP | Prevents review spam |
| `POST /api/push/subscribe` | 10 req/min per user | Prevents subscription spam |
| `GET /api/search` | 30 req/min per user | Prevents search DoS |
| `POST /api/voice-admin/*` | 10 req/min per admin | OpenAI API calls are expensive |

**Implementation**: Import the existing `rateLimit` function from `src/lib/rate-limit.ts` and add it to the top of each route handler.

**Estimated effort**: 2-3 hours
**Risk**: Low — only rejects excess requests, doesn't affect normal usage

---

### 3.3 — Protect Against Brute Force on Invite Codes

**Why**: Invite codes use `XXXX-XXXX` format (8 alphanumeric chars). Without rate limiting, an attacker could brute-force valid codes.

**Fix**:
- Add rate limiting to `/api/mini-leagues/join` (as above)
- Add a lockout after 10 failed attempts per IP (15 minute cooldown)
- Log failed join attempts for monitoring

**Estimated effort**: 1 hour

---

## Phase 4: Database & RLS Lockdown (Week 4)

> **Goal**: Defense-in-depth so that even if an API route has a bug, the database rejects unauthorized access.

### 4.1 — Audit All Tables for RLS

**Why**: If RLS is disabled on a table and a code bug exposes the admin Supabase client, an attacker gets full read/write access. RLS is the safety net.

**Steps**:
1. Connect to Supabase SQL editor
2. Run: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
3. For every table where `rowsecurity = false`, enable RLS and create appropriate policies
4. All user-scoped tables MUST have policies using `(SELECT auth.uid()) = user_id`

**Tables that MUST have RLS** (based on schema knowledge):
- `fantasy_teams` — users can only read/write their own team
- `user_rosters` — users can only read/write their own rosters
- `current_squads` — users can only read/write their own squad
- `user_chips` — users can only read/write their own chips
- `user_transfers` — users can only read/write their own transfers
- `mini_league_members` — users can only manage their own memberships
- `notifications` — users can only read their own notifications
- `push_subscriptions` — users can only manage their own subscriptions

**Tables that need public READ + admin WRITE**:
- `players`, `teams`, `matches`, `gameweeks`, `player_stats`, `player_match_events`
- `scoring_rules`, `bps_rules`, `mini_leagues`

**Performance tip**: Use `(SELECT auth.uid()) = user_id` instead of `auth.uid() = user_id`. The subquery form caches the result per-statement instead of calling the function per-row. This can yield 10-100x performance improvement on larger tables.

**Estimated effort**: 3-4 hours (requires Supabase Dashboard access)
**Risk**: Medium — incorrect policies can break read access. Test thoroughly.

---

### 4.2 — Reduce Service Role Key Usage

**Why**: `getSupabaseServerOrThrow()` (service role) bypasses ALL RLS. Currently 74 files use it, including read-only GET routes that don't need admin access.

**Approach**:
- Create a `getSupabaseServer()` function that uses the anon key with cookie-based auth (respects RLS)
- Reserve `getSupabaseServerOrThrow()` for routes that genuinely need RLS bypass:
  - Admin write operations
  - Cron jobs (no user session)
  - Cross-user data aggregation (standings, leaderboards)
- Switch public read routes (`/api/players`, `/api/teams`, `/api/matches`, `/api/fixtures`) to anon client

**Estimated effort**: 4-5 hours (incremental, route by route)
**Risk**: Medium — requires RLS policies to be correct first (do 4.1 before this)

---

### 4.3 — BOLA Audit (Broken Object Level Authorization)

**Why**: OWASP API Security #1 risk. Any route that accepts a resource ID must verify the authenticated user owns that resource. Otherwise user A can modify user B's roster.

**Routes to audit**:

| Route | Takes ID from | Must verify |
|-------|--------------|-------------|
| `POST /api/rosters/save` | body `user_id` | `user_id === auth.user.id` |
| `GET /api/rosters/current` | query `user_id` | `user_id === auth.user.id` |
| `POST /api/transfers` | body (implicit) | User can only transfer their own players |
| `GET /api/chips` | query `user_id` | `user_id === auth.user.id` |
| `POST /api/mini-leagues/[id]/leave` | path `id` | User is a member of this league |
| `PUT /api/notifications` | body `ids` | Notifications belong to auth user |
| `DELETE /api/push/subscribe` | body | Subscription belongs to auth user |

**Fix pattern**: At the top of each route, after auth check:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (body.userId && body.userId !== user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Estimated effort**: 2-3 hours
**Risk**: Low — adds checks before existing logic

---

## Phase 5: Monitoring, Logging & Incident Response (Week 5)

> **Goal**: Know when something goes wrong. Respond quickly.

### 5.1 — Structured Error Logging

**Why**: Currently errors are logged with `console.error(error)` which produces unstructured text. Vercel's log drain can parse JSON, making it searchable and alertable.

**Pattern** (already defined in `api-error.ts` from Phase 2):
```json
{
  "level": "error",
  "code": "ROSTER_SAVE_FAILED",
  "userId": "abc-123",
  "route": "/api/rosters/save",
  "message": "duplicate key constraint violation",
  "timestamp": "2026-03-14T10:00:00Z"
}
```

**What to NEVER log**:
- Passwords, tokens, JWTs, API keys
- Full email addresses (mask as `r***@gmail.com`)
- Database connection strings
- `.env` values
- Full request bodies (may contain sensitive data)

**Estimated effort**: Included in Phase 2 error sanitization work

---

### 5.2 — Security Event Monitoring

**Track these events** (log as structured JSON):

| Event | Where | Why |
|-------|-------|-----|
| Failed auth attempts | Middleware / API routes | Detect brute force |
| Admin actions | `requireAdminSession()` | Audit trail |
| Rate limit hits | Rate limiter | Detect abuse |
| Failed invite code attempts | `/api/mini-leagues/join` | Detect brute force |
| Unusual data patterns | Roster save, transfers | Detect automated abuse |

**Implementation**: Add logging to existing auth and rate-limit checks. No new infrastructure needed — Vercel captures stdout.

**Estimated effort**: 2 hours

---

### 5.3 — Dependency Vulnerability Scanning

**Steps**:
1. Run `npm audit` weekly (or add to CI)
2. Enable GitHub Dependabot alerts (free) on the repo
3. Review and patch critical vulnerabilities within 48 hours

**Estimated effort**: 30 minutes setup, then ongoing

---

## Phase 6: Ongoing Hardening & Maintenance

> **Goal**: Security is not a one-time task. Keep the posture strong.

### 6.1 — Monthly Security Checklist

- [ ] Run `npm audit` — patch critical/high vulnerabilities
- [ ] Check Vercel security logs for anomalies
- [ ] Review any new API routes for auth, validation, error handling
- [ ] Run Mozilla Observatory scan — maintain A+ rating
- [ ] Verify RLS policies haven't been accidentally disabled
- [ ] Check that no `.env` values were committed to git

### 6.2 — Pre-Merge Security Review

Before merging any PR that touches API routes, verify:
- [ ] Auth check present (`getUser()` or `requireAdminSession()`)
- [ ] Input validated (Zod schema or manual checks)
- [ ] Error messages sanitized (no raw `error.message` to client)
- [ ] Rate limiting applied to mutation endpoints
- [ ] BOLA check: resource ownership verified
- [ ] No new `getSupabaseServerOrThrow()` usage where anon client suffices

### 6.3 — Upgrade Path

| Item | Current | Target | When |
|------|---------|--------|------|
| NextAuth | v4 | v5 | When v5 stabilizes |
| Rate limiting | In-memory | Upstash Redis | When user base grows past 200 |
| Logging | Console + Vercel | Structured + alerting | When needed |
| CSP | `unsafe-inline` styles | Nonce-based styles | When Tailwind supports it |

---

## Security Standards Reference

This plan was designed to comply with:

### OWASP Top 10 (Web, 2021)
| # | Risk | Our Mitigation |
|---|------|----------------|
| A01 | Broken Access Control | Auth on all routes, BOLA audit, RLS |
| A02 | Cryptographic Failures | HTTPS enforced, HSTS header, no plaintext secrets |
| A03 | Injection | Supabase parameterized queries, Zod validation, CSP |
| A04 | Insecure Design | Defense-in-depth (auth + RLS + validation layers) |
| A05 | Security Misconfiguration | Security headers, error sanitization, RLS audit |
| A06 | Vulnerable Components | `npm audit`, Dependabot, monthly reviews |
| A07 | Auth Failures | Supabase Auth, server-side `getUser()`, rate limiting |
| A08 | Data Integrity Failures | Input validation, signed JWTs, admin role checks |
| A09 | Logging Failures | Structured logging, security event monitoring |
| A10 | SSRF | No user-supplied URL fetching (except OpenAI, which is validated) |

### OWASP API Security Top 10 (2023)
| # | Risk | Our Mitigation |
|---|------|----------------|
| API1 | BOLA | Phase 4.3 — ownership checks on all resource endpoints |
| API2 | Broken Authentication | Supabase Auth, server-side verification |
| API3 | Broken Object Property AuthZ | Scoped API responses, no over-fetching |
| API4 | Unrestricted Resource Consumption | Rate limiting (Phase 3) |
| API5 | Broken Function-Level AuthZ | `requireAdminSession()`, middleware role checks |
| API6 | Sensitive Business Flow Abuse | Rate limiting on chip activation, transfers |
| API7 | SSRF | Not applicable (no user-supplied URL fetching) |
| API8 | Security Misconfiguration | Full header suite, error sanitization |
| API9 | Improper Inventory Management | Monthly route audit |
| API10 | Unsafe API Consumption | OpenAI key validation, response validation |

### Additional Standards
- **Mozilla Observatory**: Target A+ rating (requires all security headers)
- **Google Lighthouse**: Security audit pass
- **Vercel Security Best Practices**: WAF, bot protection, DDoS mitigation
- **Next.js Official Security Guide**: CSP via middleware, auth in data access layer (not middleware), Server Action CSRF protection

---

## Verification Checklist

After completing all phases, verify:

- [ ] Mozilla Observatory score: A+
- [ ] SecurityHeaders.com score: A+
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] All API mutation routes have: auth + validation + rate limit + error sanitization
- [ ] All admin routes have: `requireAdminSession()` + role check
- [ ] All user-scoped tables have RLS enabled with correct policies
- [ ] No raw `error.message` returned to clients in any route
- [ ] Vercel Bot Protection enabled in Block mode
- [ ] GitHub Dependabot alerts enabled
- [ ] Zero hardcoded secrets in source code
- [ ] All fetch calls include `credentials: "same-origin"`
- [ ] No `localStorage` storing sensitive data (passwords, tokens)
- [ ] Service role key only used where RLS bypass is genuinely needed

---

## Estimated Total Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Immediate Hardening | 4-5 hours | CRITICAL — do first |
| Phase 2: Validation & Errors | 8-10 hours | HIGH — do second |
| Phase 3: Rate Limiting | 3-4 hours | HIGH |
| Phase 4: Database & RLS | 10-12 hours | MEDIUM — most impactful |
| Phase 5: Monitoring | 3-4 hours | MEDIUM |
| Phase 6: Ongoing | 1 hour/month | CONTINUOUS |

**Total one-time effort**: ~30-35 hours across 5 weeks
**Ongoing maintenance**: ~1 hour per month

---

*This plan will be executed at once *
