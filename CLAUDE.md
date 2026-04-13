# Patreon Violin Meetup App

## Stack
- **Next.js 16** (App Router) + **Tailwind CSS v4** + **TypeScript**
- **Supabase** (database only — no auth, no RLS, service role key)
- Deployed to **Vercel**

## Architecture
- All DB access goes through Next.js API routes (no client-side Supabase)
- Admin auth: password in `ADMIN_PASSWORD` env var, sent as `Authorization: Bearer <pw>`
- No user accounts — subscribers identify by name (localStorage)

## Supabase — IMPORTANT
- **This project uses its own Supabase project: `myxyfrcufezdzxtkkbof`**
- The MCP Supabase tool is connected to a DIFFERENT project (arcoscribeapp) — **DO NOT use MCP Supabase tools for this project**
- To run migrations, use the Supabase Dashboard SQL Editor for project `myxyfrcufezdzxtkkbof`
- Never apply migrations via `mcp__supabase__apply_migration` — it will hit the wrong project

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
| created_at | timestamptz | |

### `signups`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| meetup_id | uuid | FK to meetups |
| name | text | Case-insensitive unique per meetup (partial index excludes cancelled) |
| position | int | Determines confirmed vs waitlist |
| status | text | `active`, `played`, `not_reached`, `no_show`, `cancelled` |
| has_priority | boolean | This signup got priority bump |
| granted_priority | boolean | Admin grants priority for next meetup |
| created_at | timestamptz | |

### `ideas`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| text | text | The topic/question |
| votes | int | Upvote counter |
| is_done | boolean | Admin marks as covered |
| created_at | timestamptz | |

## Key Design Decisions
- **Confirmed vs waitlisted** is derived from `position <= max_spots`, never stored
- **Priority** is one-time: admin grants `granted_priority` → next signup gets `has_priority` and sorts first
- **Cancel** = set status to cancelled + recalculate positions (auto-promotes waitlist)
- **Ideas voting** uses localStorage to prevent double-voting per device (good enough for ~20 people)
- All dates displayed in **Eastern Time** via `src/lib/eastern-time.ts`

## Environment Variables
```
SUPABASE_URL=https://myxyfrcufezdzxtkkbof.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
ADMIN_PASSWORD=<your choice>
```

## File Structure
```
src/
  app/
    page.tsx              # Subscriber page (signup + ideas board)
    admin/page.tsx        # Admin dashboard
    api/
      admin/login/        # Auth check
      meetups/            # CRUD meetups
      ideas/              # CRUD ideas + upvote
  components/
    eastern-datetime-field.tsx  # Date/time picker in ET
  lib/
    api.ts                # Client-side API functions
    admin.ts              # Admin auth helper
    supabase.ts           # Supabase client (service role)
    types.ts              # TypeScript interfaces
    eastern-time.ts       # Eastern Time utilities
    positions.ts          # Position recalculation logic
```

## Deployment
- `vercel --prod` to deploy
- Env vars must be set in Vercel dashboard (Settings > Environment Variables)
