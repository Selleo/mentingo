# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

pnpm + turborepo monorepo. Two apps and seven internal packages:

- `apps/api` — NestJS 10 backend (Drizzle ORM on Postgres, BullMQ, Socket.io, Passport, Stripe, Langchain/Langfuse). Entry `apps/api/src/main.ts`, root module `apps/api/src/app.module.ts`.
- `apps/web` — Remix v2 in **SPA mode** (`ssr: false` in `apps/web/vite.config.ts`). Routes declared programmatically in `apps/web/routes.ts`; `server.js` exists but is not used in dev.
- `apps/reverse-proxy` — Caddy config for `*.lms.localhost` HTTPS routing in dev.
- `packages/shared` — types, enums, permission/language constants used by both apps. Built (tsup → `dist/`).
- `packages/email-templates` — react-email templates rendered by the API. Built (tsup → `dist/`).
- `packages/prompts` — YAML AI prompts compiled to TS via `generate-prompts.ts`. Built (tsc → `dist/`).
- `packages/eslint-config`, `packages/typescript-config` — shared lint/tsconfig presets (`@repo/*`).
- `packages/ui` — minimal stub (button/card/code), src consumed directly, no build.
- `packages/performance-tests` — k6 load/stress/spike/soak suites.

`pnpm packages:build` builds the three packages that have a `dist/` (`shared`, `email-templates`, `prompts`) — required before the API can run cleanly. Turbo wires `dev` to depend on `@repo/email-templates#build`, which itself depends on `@repo/shared#build`.

Node 20.15.0 / pnpm 10.22.0 (see `.tool-versions`).

## Common commands

Most commands proxy through pnpm filters; you rarely need to `cd` into a workspace.

```bash
# One-time bootstrap (also handles Caddy, Docker, .env, migrations, seed)
pnpm setup:unix          # macOS/Linux
pnpm setup:win           # Windows

# Run everything (api + web + reverse-proxy + email-templates watch)
pnpm dev

# Lint + typecheck (these run `tsc --noEmit` *and* eslint together)
pnpm lint-tsc-web
pnpm lint-tsc-api
pnpm lint-tsc-web --fix
pnpm lint-tsc-api --fix
pnpm format           # prettier write
pnpm format:check

# Tests
pnpm test:web                              # vitest unit
pnpm test:api                              # jest unit
pnpm test:api:e2e                          # jest e2e (apps/api/test/jest-e2e.json, maxWorkers=1)
pnpm test:web:e2e                          # playwright
bash test-e2e.sh                           # alt e2e wrapper at repo root
pnpm --filter=api exec jest path/to.spec.ts   # single api test file
pnpm --filter=api exec jest -t "name"          # single api test by name
pnpm --filter=web exec vitest run path/to.test.tsx   # single web unit test
pnpm --filter=web exec playwright test path/to.spec.ts   # single web e2e

# Database (drizzle-kit, scoped to api workspace)
pnpm db:generate         # generate a new migration from schema changes
pnpm db:migrate          # apply pending migrations
pnpm db:seed             # full dev seed (sample courses, users, etc.)
pnpm --filter=api db:truncate-tables
pnpm --filter=api db:seed-bulk

# API client codegen — regenerate after any API schema/route change
pnpm generate:client     # reads apps/api/src/swagger/api-schema.json -> apps/web/app/api/generated-api.ts

# Performance (requires k6 installed)
pnpm perf:load | perf:stress | perf:spike | perf:soak | perf:mixed
pnpm perf:load:dashboard

# Release tagging (drives changelog + tag push)
make release TAG=vX.Y.Z
```

Husky runs `pnpm lint-staged` on commit (tsc-files + eslint scoped to changed paths) and `pnpm test:web && pnpm test:api` on push (see `.husky/`, `lint-staged.config.mjs`). `pnpm gpush` exists as `git push --no-verify` — do not use unless explicitly asked.

## Conventions (non-obvious; from README/CONTRIBUTING)

- **After `pnpm db:generate`**: rename the migration file to something descriptive _and_ update its `tag` value in `apps/api/src/storage/migrations/meta/_journal.json`. Drizzle won't catch the mismatch until you run migrations on a fresh DB.
- **Conventional Commits** for messages (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`). PR titles follow the same format.
- **Branch naming**: `[initials]_[type]_[module]_[ticket]_[short_description]`, e.g. `jd_feat_lms_459_implement_sso`.
- **Generated file**: `apps/web/app/api/generated-api.ts` is produced by `pnpm generate:client`. Don't hand-edit it; regenerate after API changes and commit the diff.
- Default dev accounts (password `password` for all):
  - **Confirmed working after `pnpm db:seed` with default `.env`**: admin = `admin+tenant1@example.com`, student = `student+tenant1@example.com` (both password `password`).
  - Setup-script seed (`pnpm setup:unix|win`, `apps/api/src/seed/seed-prod.ts`) creates 3 in a single "Default Tenant", no email suffixing: `admin@example.com`, `user@example.com` (student — note `user@`, not `student@`), `contentcreator@example.com`.
  - `pnpm db:seed` (`apps/api/src/seed/seed.ts` + `users-seed.ts`) iterates `DEV_TENANT_ORIGINS` (falls back to `CORS_ORIGIN`) and seeds each tenant separately. For every tenant it appends a `+<suffix>` to each base email, where `<suffix>` is the first hostname label of the origin (`getTenantEmailSuffix` / `addEmailSuffix` in `seed-helpers.ts:276-286`). Bases: `admin@`, `student@`, `student2@`, `student0@`, `contentcreator@`, `contentcreator2@example.com`.
  - With the default `.env` (`DEV_TENANT_ORIGINS=https://tenant1.lms.localhost,https://tenant2.lms.localhost,https://tenant3.lms.localhost`), the actual login emails are `admin+tenant1@example.com`, `student+tenant1@example.com`, …, `admin+tenant2@example.com`, etc. The unsuffixed `admin@example.com` will NOT exist after `pnpm db:seed`.
- Dev URLs: `https://app.lms.localhost` (web), `https://app.lms.localhost/api` (api), `https://api.lms.localhost/api` (Swagger), `https://mailbox.lms.localhost` (Mailhog).

## API architecture (apps/api/src)

Feature-module layout — each domain has its own folder (`auth/`, `user/`, `courses/`, `chapter/`, `lesson/`, `questions/`, `ai/`, `qa/`, `announcements/`, `articles/`, `news/`, `categories/`, `group/`, `certificates/`, `stripe/`, `scorm/`, `analytics/`, `statistics/`, `report/`, `activity-logs/`, `outbox/`, `events/`, `queue/`, `websocket/`, `ingestion/`, `luma/`, `super-admin/`, `integration/`, `support-mode/`, `localization/`, `seed/`, `health/`). Modules typically contain `*.controller.ts`, `*.service.ts`, `*.module.ts`, `schemas/`, and where applicable `handlers/` (CQRS) and `*.queue.service.ts` / `*.worker.ts` (BullMQ producer/consumer pair).

Cross-cutting infrastructure:

- **Multi-tenant Postgres + RLS** — schemas under `apps/api/src/storage/schema/` (drizzle + drizzle-typebox; helpers `tenantId`, `id`, `timestamps`, `withTenantIdIndex` in `storage/schema/utils.ts`). Two DB connections (`DB_ADMIN`, `DB_APP`) wired in `storage/db/db.module.ts` and `db.providers.ts`. **Tenant isolation is enforced at runtime by `storage/db/tenant-rls.interceptor.ts`** (registered globally in `app.module.ts`) using `TenantStateService` + `TenantDbRunnerService` — repository code reads from a request-scoped tenant connection; do not bypass it.
- **Migrations** — SQL in `apps/api/src/storage/migrations/`, journal at `meta/_journal.json` (rename `tag` after generating; see Conventions above). Two drizzle configs: `drizzle.config.ts` (introspection) and `drizzle.migrator.config.ts` (CLI runner used by `db:migrate` / `db:generate`).
- **Validation/typing** — Typebox + drizzle-typebox. Schemas usually live in `<module>/schemas/`, derive base shapes via `createSelectSchema(table)`, and compose with `Type.Object`/`Type.Composite`. `nestjs-typebox` patches Swagger; UUID format registration in `utils/setup-validation.ts`. Shared cross-app types come from `@repo/shared`.
- **Auth** — Passport strategies (`auth/strategy/`: jwt, local, google, microsoft, slack), JWT global guard, `PermissionsGuard` (`common/guards/permissions.guard.ts`) keyed off `@repo/shared`'s `PERMISSIONS`. Refresh handled by `auth/token.service.ts`.
- **CQRS / events** — `events/events.module.ts` registers `@nestjs/cqrs`. Domain events emitted from services; handlers (e.g. `NotifyAdminsHandler`, `NotifyUsersHandler`) live in `handlers/` folders and `events/`.
- **Queues (BullMQ)** — wrappers in `queue/queue.service.ts` and typed jobs in `queue/queue.types.ts`. Queues include document-ingestion, learning-time, master-course-export/sync, audio. Producers next to the feature service (`*.queue.service.ts`); consumers in `*.worker.ts` files (e.g. `courses/master-course.worker.ts`).
- **WebSockets** — `websocket/websocket.gateway.ts` with Redis adapter for horizontal scaling; JWT-authenticated heartbeat / lesson-join channels.
- **Storage / media** — `s3/s3.service.ts` (AWS SDK v3, MinIO-compatible in dev), `bunny/bunnyStream.service.ts` for video. Multer cap is 5GB.
- **Observability** — Sentry interceptor (`sentry/sentry.interceptor.ts`), Langfuse OpenTelemetry tracing (`langfuse/instrumentation.ts`).
- **Cache + rate limit** — Redis-backed cache (`cache/cache.module.ts`) and `AppThrottlerGuard` (300 req/min global) backed by Redis throttler storage.
- **Swagger output** — `apps/api/src/swagger/api-schema.json` and `integration-api-schema.json` are generated at boot via `exportSchemaToFile()` in `main.ts`. The web app's API client codegen (`pnpm generate:client`) reads `api-schema.json` directly, so re-run codegen after any controller/schema change.

Tests use jest. Unit config at `apps/api/jest.config.ts`, e2e at `apps/api/test/jest-e2e.json` (sequential, 30s timeout, separate setup at `test/jest-e2e-setup.ts` and `test/global-setup.ts`). Helpers for tenant/permission seeding in `apps/api/test/helpers/`.

## Web architecture (apps/web/app)

SPA-mode Remix. Top-level layout:

- `routes.ts` — programmatic route tree (no file-based `routes/` dir). Layouts nest as: root → `NavigationWrapper` → public/user/admin/super-admin shells.
- `modules/` — feature folders (`Auth`, `Courses`, `Admin`, `SuperAdmin`, `Dashboard`, `Announcements`, `Articles`, `News`, `QA`, `Profile`, `Statistics`, `stripe`, `Theme`, `Voice`, `Global`).
- `components/` — feature-aware components plus `components/ui/` (shadcn/Radix primitives).
- `api/` — **`generated-api.ts` is the swagger-typescript-api output (do not edit)**, plus `api-client.ts` (axios with interceptors for 401-refresh, 403-tenant-inactive, 429), `queryClient.ts` (React Query 5; 5min stale, retry policies), `socket.ts`, and hand-written hooks under `api/queries/` and `api/mutations/`.
- `config/` — `routeAccessConfig.ts`, `navigationConfig.ts`, `userRoles.ts` drive RBAC. `Guards/AccessGuard.tsx`, `Guards/MFAGuard.tsx`, `Guards/RouteGuard.tsx` enforce them at runtime.
- `hooks/`, `utils/`, `context/`, `assets/`, `locales/{en,pl,de,lt,cs}/translation.json`.
- `i18n.ts` — react-i18next setup (default `pl`, fallback `en`), wired in `modules/Global/Providers.tsx`.
- Auth state: zustand `useAuthStore` persisted as `auth-storage` in localStorage; refresh handled by the axios interceptor.
- Forms: react-hook-form + zod via `@hookform/resolvers`.
- Integrations: Sentry in `entry.client.tsx`, PostHog in `modules/Global/PostHogWrapper.tsx`, Stripe Elements in `modules/stripe/`.

Tests:

- Vitest unit (`apps/web/vitest.config.ts`, jsdom, `vitest.setup.ts`).
- Playwright e2e (`apps/web/playwright.config.ts`) split into projects per role under `apps/web/e2e/tests/{student,admin,content-creator,admin-student}/`. Auth state cached in `apps/web/e2e/.auth/*.json`. Setup project handles DB and login (`auth.setup.ts`, `db.setup.ts`).

## Local services (docker-compose.yml)

`pnpm setup:unix|win` brings these up. Direct ports for tooling: Postgres `5432` (user `postgres` / pass `guidebook` / db `guidebook`, image `pgvector/pgvector:pg16`), Redis `6379`, Mailhog SMTP `1025` / UI `8025`, MinIO API `9100` / console `9101` (`minioadmin/minioadmin`). The `create-minio-bucket` one-shot reads `apps/api/.env`.

## Things to know before changing code

- Editing API schemas/controllers usually means: change schema → restart api so Swagger re-emits → `pnpm generate:client` → commit both the schema JSON and `generated-api.ts`.
- Adding a new DB migration: `pnpm db:generate` → rename file → update `tag` in `_journal.json` → `pnpm db:migrate` → commit all three.
- Adding a Bull queue: register in `queue/queue.types.ts`, add a `*.queue.service.ts` producer, a `*.worker.ts` consumer, and wire both in the module providers.
- Adding a permission: extend `@repo/shared`'s `PERMISSIONS`, rebuild shared (`pnpm packages:build`), use it in both `PermissionsGuard` decorators (api) and `routeAccessConfig.ts` (web).
- Email content lives in `packages/email-templates`; rebuild that package (or rely on turbo `dev` dependency) before the API picks up changes.
