# CLAUDE.md - Budo League Project Rules

## Project Overview
Budo League is a fantasy football web app for a small league (~20-50 users) based in Kampala, Uganda. Built with Next.js (App Router), TypeScript, Supabase, and Tailwind CSS.

## Tech Stack
- **Framework**: Next.js 14+ (App Router, `src/app/`)
- **Language**: TypeScript (strict)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Auth**: Supabase Auth (email confirmation required)
- **Timezone**: Africa/Kampala (UTC+3)

## Project Structure
```
src/
├── app/              # Next.js App Router pages & API routes
│   ├── api/          # API route handlers
│   └── dashboard/    # Protected dashboard pages
├── components/       # React components
│   └── ui/           # shadcn/ui primitives
├── hooks/            # Custom React hooks
└── lib/              # Utilities, Supabase client, helpers
```

## Key Conventions

### Code Style
- Use `"use client"` directive only when needed (hooks, browser APIs, interactivity)
- Prefer named exports for components, default export for pages
- Use `cn()` from `@/lib/utils` for conditional classNames
- Keep components in `src/components/`, pages in `src/app/`
- Use `@/` path alias for imports

### Supabase & Auth
- Client-side Supabase: `import { supabase } from "@/lib/supabaseClient"`
- Server-side (API routes): use `createServerClient` from `@supabase/auth-helpers-nextjs` with cookies
- Always use `getSession()` on client-side, `getUser()` on server-side for auth checks
- Never trust client-side auth alone for mutations — always verify in API routes

### Database
- Player IDs are strings (UUID or numeric cast to string)
- Gameweek IDs are integers
- All timestamps should use `Africa/Kampala` timezone for display
- Max 3 players from the same team per squad
- Squad size: 17 players, Starting XI: 10 players

### Fantasy Rules (Important!)
- Formations: 1 GK, 2-3 DEF, 3-5 MID, 2-3 FWD
- Exactly 1 lady forward must start (2 in full squad)
- Lady players can ONLY play as forwards
- Captain gets 2x points, Triple Captain gets 3x
- GK can only swap with GK, lady can only swap with lady

### API Routes
- All API routes in `src/app/api/`
- Return `NextResponse.json()` with appropriate status codes
- Always check auth with `supabase.auth.getUser()` in API routes
- Use `cookies()` from `next/headers` for server client

### Styling
- Mobile-first design (users are primarily on mobile)
- Use shadcn/ui components from `@/components/ui/`
- FPL-inspired purple/green theme with gradients
- Primary brand color: `#37003C` (deep purple), accent: `#C8102E` (red)

## Do NOT
- Do not install a custom WebSocket server (use Supabase Realtime if needed)
- Do not over-engineer for scale (this is a 20-50 user league)
- Do not use `getUser()` on client-side (use `getSession()` instead)
- Do not create new tables without discussing first
- Do not modify existing API routes without checking downstream effects
- Do not use localStorage as the source
