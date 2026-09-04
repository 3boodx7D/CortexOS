# CortexOS Control Center

A personal command center for managing development projects, study focus, deadlines, gaming mode, music, and future AI/cloud integrations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cortexos/src/App.tsx` — the complete responsive application shell and all initial product surfaces.
- `artifacts/cortexos/src/index.css` — CortexOS visual tokens, typography, grid background, panels, and motion.
- `artifacts/api-server/src/lib/cortex-data.ts` — initial API-backed seed data for the first version.
- `artifacts/api-server/src/routes/` — CortexOS API handlers for overview, projects, notes, and deadlines.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts; regenerate clients after changes.

## Architecture decisions

- The first version uses an in-memory API data layer so the full experience is usable immediately while the native Windows daemon and cloud persistence are added later.
- The frontend talks to the shared API server through generated React Query hooks, not hard-coded page-local data.
- External services are represented through an integration status surface first; Supabase and AI providers can be connected without redesigning the app.
- The product surface is route-complete in the first version, with native-only capabilities presented as ready-to-connect control surfaces.

## Product

CortexOS is a cyber-obsidian-inspired personal mission control for a developer, student, and gamer. The first version includes the overview cockpit, project vault, study hub, deadline radar, game room, offline music surface, backups, AI router, data studio, settings, notes, and API-ready integration status.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The Vite build needs `PORT` and `BASE_PATH`; the managed workflow supplies both automatically.
- The current API data is process-local and resets when the API workflow restarts; persistent storage is intentionally deferred for the initial UI/API version.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
