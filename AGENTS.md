# AGENTS.md

## Purpose

Instructions for AI coding agents working in this Mentingo monorepo. Keep changes repo-native, scoped, and consistent with the existing API/web contracts.

## Tech Stack

- Package manager: `pnpm` with Turbo (`package.json`, `turbo.json`).
- Backend: NestJS 10 in `apps/api`.
- Frontend: Remix + Vite + React in `apps/web`.
- Database: Postgres/pgvector with Drizzle migrations.
- Runtime services: Redis, BullMQ, Socket.IO, MinIO/S3, Mailhog.
- Tests: Jest for API, Vitest and Playwright for web.
- Shared packages: `@repo/shared`, `@repo/prompts`, `@repo/email-templates`.

## Repository Layout

- `apps/api/` — NestJS API, database schema/migrations, workers, realtime, AI Mentor.
- `apps/web/` — Remix app, generated API client, UI modules, Playwright E2E.
- `packages/shared/` — cross-app constants/types/utilities.
- `packages/prompts/` — AI prompt YAML/templates and generated prompt exports.
- `packages/email-templates/` — email template package used by API.
- `docs/` — deployment and Langfuse/evaluation notes.

## Commands

- Install/setup: `pnpm setup:unix` or `pnpm setup:win`.
- Run all dev servers: `pnpm dev`.
- Run test-mode dev servers: `pnpm dev:test`.
- Build: `pnpm build`.
- API lint/typecheck: `pnpm lint-tsc-api`.
- Web lint/typecheck: `pnpm lint-tsc-web`.
- API tests: `pnpm test:api`.
- Web unit tests: `pnpm test:web`.
- Web E2E tests: `pnpm test:web:e2e`.
- Generate web API client: `pnpm generate:client`.
- Generate DB migration: `pnpm db:generate`.
- Run DB migrations: `pnpm db:migrate`.

## Global Rules

- Use `pnpm`; do not introduce another package manager or lockfile.
- Reuse constants from `packages/shared/src/index.ts`; do not duplicate permission, language, file, tenant, session, or access-guard values.
- Do not hand-edit generated files: `apps/web/app/api/generated-api.ts`, `apps/api/src/swagger/api-schema.json`, or `packages/prompts/src/generated-prompts.ts`.
- After API contract changes, regenerate the web client before using new API methods.
- Keep tenant, permission, and language behavior explicit in both API and web changes.
- Do not commit secrets from `.env` files or log tokens/passwords/API keys.
- Keep edits scoped. Do not reformat unrelated files.

## Shared Conventions

- Languages: use `SUPPORTED_LANGUAGES` from `packages/shared/src/constants/languages.ts`.
- Permissions/roles: use `PERMISSIONS`, `SYSTEM_ROLE_SLUGS`, `SYSTEM_ROLE_PERMISSIONS`, and permission helpers from `packages/shared/src/constants/permissions.ts` and `packages/shared/src/utils/permissions.ts`.
- API responses: backend controllers wrap data with `BaseResponse` or `PaginatedResponse` from `apps/api/src/common/index.ts`; frontend generated types expect that shape.
- Frontend API calls: use `ApiClient.api...` from `apps/web/app/api/api-client.ts`; do not add ad hoc Axios/fetch calls for app endpoints.
- Tests: prefer existing factories/fixtures/flows over custom setup code, especially in `apps/web/e2e`.

## Definition Of Done

- Run the narrowest relevant validation command for touched code.
- Update or add tests for changed behavior.
- Regenerate generated artifacts only through existing scripts.
- Keep changes limited to the task.
- Report commands run, commands skipped, assumptions, and remaining risks.
