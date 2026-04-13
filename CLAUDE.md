# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Supabase — CRITICAL

- **This project uses Supabase project `myxyfrcufezdzxtkkbof`** (URL: `https://myxyfrcufezdzxtkkbof.supabase.co`)
- The MCP Supabase tool is connected to a DIFFERENT project (arcoscribeapp) — **NEVER use any `mcp__supabase__*` tools for this project**
- Never run `mcp__supabase__apply_migration`, `mcp__supabase__execute_sql`, or any other MCP Supabase tool — they will hit the wrong database
- To run migrations, use the **Supabase Dashboard SQL Editor** for project `myxyfrcufezdzxtkkbof`

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (uses Turbopack)
npm run lint         # ESLint
```

No test framework is configured.

## Stack

- **Next.js 16** (App Router) + **Tailwind CSS v4** (inline config in globals.css) + **TypeScript** (strict)
- **Supabase** (PostgreSQL only — no auth, no RLS, service role key)
- **React 19** with hooks
- Deployed to **Vercel** (auto-deploys from GitHub)
- Path alias: `@/*` → `./src/*`

## Architecture

### Data flow

```
Browser → src/lib/api.ts (fetch wrappers) → API Routes → src/lib/supabase.ts → Supabase DB
```

All database access goes through Next.js API routes. There is no client-side Supabase client. The single Supabase client (`src/lib/supabase.ts`) uses the service role key.

### Auth model

- No user accounts — subscribers identify by name stored in `localStorage`
- Admin auth: plain password in `ADMIN_PASSWORD` env var, sent as `Authorization: Bearer <password>`
- Frontend stores admin password in `sessionStorage`
- Server-side verification via `verifyAdmin()` in `src/lib/admin.ts` — returns `null` if authorized, or a 401 `NextResponse`

### Two pages

- **`/`** — Subscriber view: see upcoming meetup, sign up by name, idea board with voting
- **`/admin`** — Admin dashboard: create/edit/delete meetups, manage signups, mark meetups complete, manage ideas

### Eastern Time

All dates are stored as UTC (ISO 8601) in the database. All display and input uses Eastern Time via utilities in `src/lib/eastern-time.ts`. Key functions:
- `toEasternDateTimeLocalValue(iso)` — UTC ISO → `YYYY-MM-DDTHH:mm` in ET (for picker)
- `fromEasternDateTimeLocalValue(value)` — ET local value → UTC ISO (for saving to DB)
- `formatEasternDateTimeShort(iso)` — display format: "Mon, Apr 13, 7:00 PM ET"
- `shiftEasternDateTimeLocalValue(value, days)` — offset days (used to auto-set signup open date 7 days before meetup)

### Signup position & priority system

- **Confirmed vs waitlisted** is derived: `position <= max_spots` = confirmed. Never stored as a field.
- **Position recalculation** (`src/lib/positions.ts`): sorts non-cancelled signups by `has_priority DESC, position ASC`, then renumbers 1, 2, 3...
- **Priority lifecycle**: Admin sets `granted_priority = true` on a signup → when that person signs up for the next meetup (matched by case-insensitive name), `has_priority = true` is set → recalculation moves them to front. One-time use.
- **Cancel** = set status to `cancelled` + recalculate positions (auto-promotes from waitlist)

### Real-time updates

No WebSockets — uses polling. Meetup list refreshes every 10s, expanded signup list every 5s. Ideas refresh every 10s.

## Database Tables

### `meetups`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| title | text | Default "Violin Meetup" |
| meetup_date | timestamptz | When the meetup happens |
| signup_opens_at | timestamptz | When signups become available |
| max_spots | int | Confirmed spots (rest go to waitlist) |
| status | text | `upcoming` or `completed` |

### `signups`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| meetup_id | uuid | FK → meetups |
| name | text | Case-insensitive unique per meetup (partial index excludes cancelled) |
| position | int | Determines confirmed vs waitlist |
| status | text | `active`, `played`, `not_reached`, `no_show`, `cancelled` |
| has_priority | boolean | This signup got priority bump |
| granted_priority | boolean | Admin grants priority for next meetup |

### `ideas`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| text | text | The topic/question |
| votes | int | Upvote counter (localStorage prevents double-voting) |
| is_done | boolean | Admin marks as covered |

## API Routes

| Route | Methods | Auth |
|-------|---------|------|
| `/api/admin/login` | POST | public (validates password) |
| `/api/meetups` | GET, POST | GET public, POST admin |
| `/api/meetups/[id]` | GET, PATCH, DELETE | GET public, PATCH/DELETE admin |
| `/api/meetups/[id]/complete` | POST | admin |
| `/api/meetups/[id]/signups` | GET, POST | public |
| `/api/meetups/[id]/signups/[signupId]` | PATCH, DELETE | PATCH admin, DELETE public |
| `/api/ideas` | GET, POST | public |
| `/api/ideas/[id]` | PATCH, DELETE | PATCH public (upvote), DELETE admin |

## Environment Variables

```
SUPABASE_URL=https://myxyfrcufezdzxtkkbof.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
ADMIN_PASSWORD=<your choice>
```

## Deployment

- `vercel --prod` or push to GitHub for auto-deploy
- Env vars must be set in Vercel dashboard (Settings > Environment Variables)
