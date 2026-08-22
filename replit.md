# Wave Park Occupancy

Dashboard for monitoring UrbnSurf Melbourne wave-session occupancy and capacity.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Supabase migrations manage the application database schema.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/wave-dashboard` — React dashboard
- `artifacts/api-server` — API routes and Supabase data access
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema` — shared database shape definitions
- Supabase project `wave_park_occupancy` — runtime data store

## Architecture decisions

- Supabase PostgreSQL is the runtime database; the server accesses it through the connected Supabase connector.
- The API keeps database access server-side so the dashboard never receives Supabase credentials.
- The existing session and refresh-log data was migrated from Replit PostgreSQL into Supabase.

## Product

The dashboard displays wave-session occupancy by date and hour, supports live refreshes from UrbnSurf, and provides raw session data for inspection.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
