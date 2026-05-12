# AGENTS.md

## Purpose

Backend-specific instructions for `apps/api`. Preserve tenant isolation, generated API contracts, and existing NestJS module boundaries.

## Tech Stack

- NestJS 10 with global guards/interceptors in `src/app.module.ts`.
- Drizzle + Postgres via `@knaadh/nestjs-drizzle-postgres`.
- Migrations: `drizzle-kit` with configs in `drizzle.config.ts` and `drizzle.migrator.config.ts`.
- Validation/OpenAPI: TypeBox + `nestjs-typebox` + Swagger.
- Auth: JWT cookies, Passport strategies, Redis-backed session revocation.
- Jobs/events: BullMQ in `src/queue`, Nest CQRS events, outbox in `src/outbox`.
- Realtime: Socket.IO gateways in `src/websocket` and file upload notifications.
- Tests: Jest unit and e2e.

## Commands

- Dev server: `pnpm --filter=api dev`.
- Test-mode dev server: `pnpm --filter=api dev:test`.
- Build: `pnpm --filter=api build`.
- Lint/typecheck: `pnpm --filter=api lint-tsc`.
- Unit tests: `pnpm --filter=api test`.
- E2E tests: `pnpm --filter=api test:e2e`.
- Generate schema migration: from `apps/api`, run `npx drizzle-kit generate --name=<meaningful_name>`.
- Generate custom/data migration: from `apps/api`, run `npx drizzle-kit generate --custom --name=<meaningful_name>`.
- Run migrations: `pnpm --filter=api db:migrate`.
- Seed: `pnpm --filter=api db:seed`.

## Backend Structure

- `src/main.ts` — app bootstrap, Swagger export, CORS, cookies, validation, TUS raw body, Socket.IO adapter.
- `src/app.module.ts` — module graph and global guards/interceptors.
- `src/storage/db/` — Drizzle providers, tenant resolver, RLS runner/interceptor.
- `src/storage/schema/index.ts` — database schema.
- `src/storage/migrations/` — Drizzle migrations and metadata.
- `src/common/` — response wrappers, decorators, guards, config, helpers, permissions.
- `src/<domain>/*.controller.ts` — HTTP routes.
- `src/<domain>/*.service.ts` and `src/<domain>/repositories/` — business logic and persistence.
- `src/<domain>/schemas/` — TypeBox request/response schemas.
- `test/` — API factories, helpers, e2e setup.

## Backend Rules

- Inject `DB` from `src/storage/db/db.providers.ts` for normal tenant-scoped queries.
- Use `DB_ADMIN` only for deliberate cross-tenant/admin operations such as tenant resolution, migrations, seeds, and support-mode tenant lookup.
- Keep request handlers thin; put domain logic in services and query details in repositories where that pattern exists.
- Validate controller inputs/outputs with `@Validate(...)` and TypeBox schemas.
- Return `new BaseResponse(...)` or `new PaginatedResponse(...)` from controllers.
- Protect endpoints with `@RequirePermission(PERMISSIONS.X)` from `@repo/shared`.
- Read actor scope from `@CurrentUser()`; do not trust body/query user IDs for authorization.
- Use `OutboxPublisher.publish(...)` for durable domain events instead of direct side effects when existing flow uses outbox/events.
- Generate migrations only through Drizzle Kit. Use normal generated migrations for schema changes and `--custom` mainly for data migrations or other custom SQL changes.
- Always pass a meaningful `--name=<meaningful_name>` when generating migrations.
- Do not create migration files by hand and do not modify generated migration files by hand.

## Important Flows

### Tenant RLS Flow

- Entry: `src/storage/db/tenant-rls.interceptor.ts`.
- Main logic: `src/storage/db/tenant-resolver.service.ts`, `src/storage/db/tenant-db-runner.service.ts`.
- DB providers: `src/storage/db/db.module.ts`, `src/storage/db/db.providers.ts`.
- Agent rule: never bypass tenant scoping accidentally; background work touching tenant data must use `runWithTenant` or `runForEachTenant`.

### Auth And Permission Flow

- Entry: `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/permissions.guard.ts`.
- Controllers: `src/auth/auth.controller.ts`, `src/user/user.controller.ts`.
- Shared constants: `packages/shared/src/constants/permissions.ts`.
- Agent rule: add permissions through shared constants and route metadata, not inline role checks.

### Language Flow

- Constant: `packages/shared/src/constants/languages.ts`.
- API usage examples: `src/courses/course.controller.ts`, `src/stripe/schemas/checkoutSession.schema.ts`, `src/user/user.service.ts`.
- Agent rule: use `SUPPORTED_LANGUAGES`/`SupportedLanguages`; do not hardcode language arrays in schemas or services.
- Agent rule: resolve localized JSONB fields in repository/database queries, usually with `LocalizationService.getLocalizedSqlField`; public API response schemas should return localized strings instead of language maps unless the endpoint explicitly manages translations.

### Course/Lesson Flow

- Entry: `src/courses/course.controller.ts`, `src/lesson/lesson.controller.ts`.
- Main logic: `src/courses/course.service.ts`, `src/lesson/services/`.
- Persistence: `src/courses/master-course.repository.ts`, `src/lesson/repositories/`.
- Tests: `src/courses/__tests__/`, `src/lesson/__tests__/`.
- Agent rule: preserve permission distinctions between assigned, manageable, own, and admin course access.

### Outbox And Worker Flow

- Publisher: `src/outbox/outbox.publisher.ts`.
- Dispatcher: `src/outbox/outbox-dispatcher.service.ts`, `src/outbox/outbox-dispatcher.cron.ts`.
- Claiming: `src/outbox/outbox.repository.ts`.
- Queues: `src/queue/queue.service.ts`, `src/queue/queue.types.ts`.
- Agent rule: keep `FOR UPDATE SKIP LOCKED` claiming and event materialization intact when changing durable events.

### File And Video Upload Flow

- Entry: `src/file/file.controller.ts`.
- TUS bootstrap: `src/main.ts`.
- Validation: `src/file/validators/`, `src/file/utils/`, `src/file/schemas/`.
- Storage config: `src/common/configuration/s3.ts`, `src/s3/`.
- Agent rule: reuse existing MIME/type validators and upload schemas; do not add permissive inline file checks.

## Testing

- Put e2e specs in `src/**/__tests__/*.e2e-spec.ts`.
- Put unit specs in `*.spec.ts` matching existing module patterns.
- Use factories/helpers from `apps/api/test`.
- Use `src/test-config` for deterministic E2E state needed by web tests.
- Run focused Jest tests for changed modules, or `pnpm --filter=api lint-tsc` for broader changes.

## Safety Boundaries

- Do not weaken auth, permission, tenant, or validation checks to satisfy tests.
- Do not use `DB_ADMIN` as a shortcut around RLS.
- Do not edit migrations by hand; keep the Drizzle generation flow intact.
- Do not call external AI/payment/storage providers in tests when deterministic fixtures can cover the behavior.
- Do not expose prompt internals, hidden grading criteria, tokens, passwords, or tenant secrets in logs/errors.
