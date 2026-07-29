# Tenant RLS Transaction Boundaries

## Status

- Proposed
- Branch: `jh_fix_tenant_rls_transaction_boundaries`
- Base: `origin/staging` at branch creation
- Scope: API database infrastructure, tenant repositories, tenant-scoped services, workers, cron jobs, gateways, guards, and tests

## Summary

Mentingo currently resolves the tenant at the start of an HTTP request and keeps a PostgreSQL transaction open until the complete request handler finishes. The transaction is required because tenant RLS uses transaction-local `set_config('app.tenant_id', tenantId, true)`, but its current lifetime also covers unrelated network, file, AI, email, queue, and streaming waits.

This can leave connections `idle in transaction`. With the application pool currently limited to ten connections, ten slow or leaked requests can exhaust the pool and block otherwise healthy requests.

The target design separates tenant identity from transaction lifetime:

1. Request, worker, cron, gateway, or guard entry points establish only the tenant identity in `AsyncLocalStorage`.
2. Ordinary tenant repository calls automatically create short RLS transactions.
3. Repository calls reuse an existing transaction when invoked inside an explicit transaction boundary.
4. Services use `@Transactional()` for one atomic service method and `TenantDbRunnerService.transaction()` for explicit transaction phases.
5. Tenant repositories use the existing `DB` token, which becomes fail-closed and never falls back to an unscoped application connection.
6. External I/O never runs inside a database transaction unless a documented exception has been reviewed.

## Current State And Evidence

The current flow is implemented by:

- `apps/api/src/storage/db/tenant-rls.interceptor.ts`
- `apps/api/src/storage/db/tenant-db-runner.service.ts`
- `apps/api/src/storage/db/db-als.store.ts`
- `apps/api/src/storage/db/db.providers.ts`
- `apps/api/src/storage/db/db.module.ts`

Current request flow:

```text
HTTP request
  -> resolve tenant
  -> BEGIN
  -> SET LOCAL app.tenant_id
  -> execute complete controller/service call
  -> COMMIT
```

`createDbProxy()` currently selects `store?.trx ?? dbBase`. The fallback makes application queries possible without an active tenant transaction, but it also means the `DB` token cannot prove that RLS tenant context is active.

Repository and service usage on the branch base:

- 42 service files inject tenant `DB`.
- 38 repository files inject tenant `DB`.
- 92 service call sites start transactions through `db.transaction(...)`.
- 204 repository signatures accept a `trx` or `dbInstance` parameter.
- Several repositories also have deliberate `DB_ADMIN` paths and must be classified rather than migrated mechanically.

Known unsafe transaction examples include `CourseService.deleteCourse()`, which calls Luma while a database transaction is active. Other transaction bodies that call file, S3, email, AI, calendar, or other network services must be identified by the implementation audit.

These counts are planning baselines, not acceptance criteria. Re-run the inventory immediately before implementation because the staging branch changes frequently.

## Goals

- Preserve PostgreSQL RLS as the authoritative tenant-isolation mechanism.
- Remove the database transaction from the full HTTP request lifetime.
- Keep ordinary repository call sites free from `runWithTenant(...)` and explicit `trx` arguments.
- Allow several repositories to participate in one service-owned transaction.
- Allow a service method to execute multiple sequential transactions with external work between them.
- Make missing tenant context and missing tenant transaction fail visibly.
- Preserve deliberate cross-tenant and support-mode operations through explicit admin boundaries.
- Cover non-HTTP entry points consistently.
- Add observability that proves pool pressure and transaction duration improve after rollout.

## Non-Goals

- Upgrading Drizzle to solve transaction interception. Current Drizzle releases do not provide a supported global query-execution interceptor or transactional `pg-proxy`.
- Building a custom Drizzle session or driver adapter against internal APIs.
- Replacing PostgreSQL RLS with application-side tenant filters.
- Automatically making every service method transactional.
- Keeping remote calls transactionally atomic with PostgreSQL. Use outbox/queue compensation for cross-system workflows.
- Removing `DB_ADMIN`; it remains necessary for explicitly reviewed cross-tenant infrastructure.

## Architectural Decisions

### Tenant identity and transaction state are separate

Change the ALS shape from a mandatory transaction:

```ts
type DbAlsContext = {
  tenantId: string;
  trx: DatabasePg;
};
```

to tenant identity with an optional active transaction:

```ts
type DbAlsContext = {
  tenantId: string;
  trx?: DatabasePg;
};
```

An entry point may establish tenant identity without checking out a database connection.

### `DB` is transaction-aware and fail-closed

Keep the existing `DB` token for tenant persistence code, but remove its fallback to `DB_APP`.

Expected behavior:

```ts
const trx = dbAls.getStore()?.trx;

if (!trx) {
  throw new MissingTenantTransactionError();
}

return trx;
```

`DB_APP` remains the raw application-role database and is injected only into database infrastructure such as `TenantDbRunnerService`. `DB_ADMIN` remains a separate privileged boundary.

### Tenant repositories automatically own the smallest default transaction

Register tenant repositories through a central provider wrapper, for example:

```ts
...provideTenantRepository(CourseRepository)
```

The helper should expose the repository class as its existing Nest token while keeping the raw instance behind a private symbol token. The exposed instance is a JavaScript proxy around public methods:

```ts
if (tenantContext.hasTransaction()) {
  return repositoryMethod(...args);
}

return tenantRunner.transaction(() => repositoryMethod(...args));
```

This provider-factory approach is preferred over changing Drizzle internals or relying on provider discovery lifecycle ordering.

Repository methods must be awaited by the wrapper so Drizzle thenables execute before the transaction commits. Returning query builders, cursors, streams, or async iterators beyond the repository boundary is not supported by the automatic wrapper and requires an explicit streaming transaction API.

### Existing transactions are reused

`TenantDbRunnerService.transaction()` uses `REQUIRED` propagation:

- If ALS already contains a transaction for the current tenant, execute the callback in that transaction.
- Otherwise, start `DB_APP.transaction(...)`, execute transaction-local tenant configuration, store the transaction in a nested ALS context, await the callback, and commit or roll back normally.

Repository calls inside `@Transactional()` or `tenantRunner.transaction()` therefore reuse the existing transaction and do not create nested transactions.

Nested savepoints and `REQUIRES_NEW` are not part of the first implementation. Add them only for a verified use case. Sequential independent transactions are expressed with separate `tenantRunner.transaction()` calls.

### `@Transactional()` defines one service-method boundary

`@Transactional()` marks a service method that must execute atomically. The transaction wrapper uses the same `TenantDbRunnerService.transaction()` implementation as repositories.

Default behavior is `REQUIRED`:

```ts
@Transactional()
async updateCourse() {
  await this.courseRepository.update(...);
  await this.lessonRepository.update(...);
}
```

Both repositories reuse one transaction. The decorator must work without passing `trx` through service or repository signatures.

Implement the decorator through a tested Nest provider/method proxy mechanism. Do not depend on controller interceptors, because Nest controller interceptors do not automatically wrap arbitrary provider method calls. Explicitly test self-invocation behavior; if proxied service self-calls bypass the wrapper, require transaction entry methods to be invoked through another provider or use `tenantRunner.transaction()` for that path.

### Programmatic transactions support multiple phases

Use `TenantDbRunnerService.transaction()` when one method needs more than one transaction boundary:

```ts
async synchronizeCourse() {
  await this.tenantRunner.transaction(async () => {
    await this.courseRepository.markPending();
  });

  const result = await this.lumaService.synchronize();

  await this.tenantRunner.transaction(async () => {
    await this.courseRepository.markCompleted(result);
  });
}
```

No connection remains checked out during the Luma call.

### External side effects happen after commit

Do not call Luma, S3, Bunny, email, calendar, payment, AI, or other remote systems while a database transaction is open.

Choose one of:

- Perform external work before the transaction when it is safe and compensatable.
- Commit database state and then perform a non-critical external call.
- Prefer the existing outbox and BullMQ patterns for durable, retryable side effects triggered by committed state.

Course deletion should remove the Luma draft through a durable post-commit handler rather than from inside `CourseService.deleteCourse()`'s transaction.

### Admin access stays explicit

Classify persistence providers as:

- Tenant repository: uses `DB`, is automatically transaction-wrapped, and requires tenant identity.
- Admin repository/infrastructure: uses `DB_ADMIN`, is never automatically tenant-wrapped, and has a documented cross-tenant reason.
- Mixed repository: split tenant and admin responsibilities where practical. Until split, annotate/admin-audit individual methods and ensure an admin path cannot be reached accidentally through a tenant-facing API.

`DB_ADMIN` must never be used as a fallback when tenant context is missing.

## Target Flows

### HTTP request with ordinary repository reads

```text
HTTP interceptor
  -> resolve tenantId
  -> ALS { tenantId }
  -> controller/service
  -> repository proxy
       -> BEGIN
       -> SET LOCAL app.tenant_id
       -> ALS { tenantId, trx }
       -> repository query through DB proxy
       -> COMMIT
  -> response
```

### Atomic service method

```text
@Transactional service method
  -> BEGIN
  -> SET LOCAL app.tenant_id
  -> repository A reuses trx
  -> repository B reuses trx
  -> COMMIT
```

### DB, external I/O, DB

```text
tenantRunner.transaction phase 1
  -> COMMIT
external call without DB connection
tenantRunner.transaction phase 2
  -> COMMIT
```

### Background execution

```text
worker/cron/event/gateway
  -> runWithTenantContext(tenantId)
  -> ALS { tenantId }
  -> repository call
  -> automatic short tenant transaction
```

## API And Infrastructure Plan

### `db-als.store.ts`

- Allow tenant-only contexts with optional `trx`.
- Add small accessors that distinguish:
  - missing tenant identity;
  - tenant identity without a transaction;
  - active tenant transaction.
- Reject attempts to change tenant identity while an active transaction exists.
- Preserve ALS isolation across concurrent requests and jobs.

### `tenant-db-runner.service.ts`

Introduce explicit APIs:

```ts
runWithTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T>;
transaction<T>(fn: () => Promise<T>): Promise<T>;
runWithTenantTransaction<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T>;
runForEachTenant(...): Promise<void>;
```

Rules:

- `runWithTenantContext()` does not start a transaction.
- `transaction()` requires tenant identity and uses `REQUIRED` propagation.
- `runWithTenantTransaction()` is a compatibility/convenience composition of the two.
- Preserve `runWithTenant()` temporarily as a deprecated compatibility alias with its old transactional semantics until all callers are classified.
- Do not change `runForEachTenant()` semantics silently. Add a context-only variant or migrate each caller explicitly.
- Always use parameterized `set_config('app.tenant_id', tenantId, true)` on the same transaction used by repository queries.
- On error, rely on the driver transaction callback to roll back and always restore the parent ALS context.

### `db.providers.ts`

- Make `DB` resolve only the current ALS transaction.
- Throw typed errors for missing tenant identity and missing tenant transaction.
- Keep dynamic member binding to the active Drizzle transaction.
- Never expose `DB_APP` through the tenant proxy.
- Verify transaction methods cannot accidentally create unmanaged nested transactions.

### Repository transaction wrapper

- Add the provider helper and proxy implementation under `apps/api/src/storage/db/`.
- Preserve repository class tokens so existing constructor injection does not change.
- Preserve method `this` binding and thrown error types.
- Await synchronous values, promises, and Drizzle thenables correctly.
- Reuse active transactions.
- Prevent double wrapping.
- Exclude symbol properties, constructors, getters, and non-method members.
- Define an explicit escape hatch only for reviewed admin repositories.

### Transactional service decorator

- Add `@Transactional()` metadata under the database/common decorator boundary.
- Wrap marked service methods using the same runner and propagation rules.
- Preserve method arguments, return values, error stacks, and Nest dependency injection behavior.
- Document and test proxy/self-invocation limitations.
- Do not support `REQUIRES_NEW` in the first iteration.

### Request interceptor

- Continue resolving the tenant and rejecting missing tenants.
- Replace request-wide `runWithTenant()` with tenant-context-only execution.
- Preserve bypassed paths.
- Ensure bypassed tenantless paths cannot inject or use tenant `DB`; they must use an explicit admin/public persistence path where appropriate.

### Non-HTTP entry points

Audit and migrate:

- BullMQ workers;
- cron services;
- CQRS/outbox handlers;
- WebSocket gateways;
- authentication strategies and guards;
- webhook handlers;
- email handlers;
- test factories and setup helpers.

Each entry point must establish tenant identity, while repositories decide the default transaction lifetime.

## Service And Repository Migration

### Repository migration

- Register every tenant repository through `provideTenantRepository(...)`.
- Keep `@Inject(DB)` inside tenant repositories.
- Remove `trx`/`dbInstance` parameters when all callers can rely on ALS transaction reuse.
- Migrate incrementally: compatibility parameters may remain temporarily but must not be required for new code.
- Split or explicitly classify repositories that inject `DB_ADMIN`.
- Move direct query logic from services into domain repositories.
- Ensure repository methods contain persistence only and do not call external services.

### Service migration

- Remove tenant `DB` injection from ordinary services.
- Replace service-owned query builders with repository methods.
- Replace `this.db.transaction(...)` with:
  - `@Transactional()` for one complete atomic service method; or
  - `tenantRunner.transaction(...)` for a specific phase.
- Stop passing `trx` through service and repository call chains once the relevant slice is migrated.
- Split methods that mix DB and external I/O into explicit phases.
- Use outbox/BullMQ when a committed database change must reliably trigger an external side effect.

### Migration order

1. Add new ALS, runner, proxy, decorator, and repository-wrapper primitives behind existing request behavior.
2. Add unit and integration coverage before migrating consumers.
3. Wrap and migrate repositories domain by domain.
4. Migrate direct service queries and explicit transactions domain by domain.
5. Migrate background and non-HTTP tenant entry points.
6. Audit all transaction bodies for external waits and move them outside the transaction.
7. Only after the fail-closed audit passes:
   - remove request-wide transaction behavior;
   - make `DB` fail closed;
   - switch HTTP and background entry points to tenant-context-only execution.
8. Remove deprecated compatibility APIs and obsolete transaction parameters.

Do not perform steps 7 or 8 until the static inventory and integration tests prove no tenant query depends on the request transaction.

## Static Enforcement

Add repository-specific architecture checks, preferably through a small custom ESLint rule or a deterministic source audit test:

- Tenant repositories may inject `DB`, but not `DB_APP`.
- Ordinary services may not inject tenant `DB`.
- `DB_APP` is allowed only in database infrastructure.
- `DB_ADMIN` is allowed only in an explicit allowlist of admin/infrastructure providers.
- Tenant repositories must be registered through `provideTenantRepository(...)`.
- New repository methods must not accept transaction parameters.
- New external-service calls must not be added inside transaction callbacks.

Static checks supplement runtime and PostgreSQL enforcement; they are not the security boundary.

## PostgreSQL Enforcement And Mitigation

- Keep the application database role subject to RLS and without `BYPASSRLS`.
- Verify table ownership and `FORCE ROW LEVEL SECURITY` behavior for tenant tables.
- Make missing `app.tenant_id` fail closed in RLS policies or their shared tenant helper.
- Do not use connection-level `SET`/`RESET`; transaction-local configuration prevents tenant leakage through pooled connections.
- Add `idle_in_transaction_session_timeout` on preprod as defense in depth, initially five minutes unless valid transaction-duration evidence supports a lower value.
- Treat the timeout as mitigation, not the application fix.

## Implementation Checklist

### Baseline and observability

- [ ] Re-run and record inventories for service `DB` injections, repository `DB` injections, transaction callbacks, and transaction parameters.
- [ ] Inventory all tenant and admin repositories.
- [ ] Identify transaction callbacks containing Luma, HTTP, S3, Bunny, email, AI, payment, calendar, file, queue, or streaming waits.
- [ ] Add metrics for active/idle connections, pool checkout wait, transaction duration, and `idle in transaction` count.
- [ ] Add structured warnings for transactions exceeding the agreed threshold without logging secrets or query parameters.
- [ ] Apply and verify the preprod timeout mitigation separately from the application rollout.

### Core transaction infrastructure

- [ ] Make ALS transaction state optional while keeping tenant identity mandatory for tenant work.
- [ ] Add typed missing-context and missing-transaction errors.
- [ ] Implement tenant-context-only runner execution.
- [ ] Implement `transaction()` with `REQUIRED` propagation.
- [ ] Add a compatibility tenant-plus-transaction runner.
- [ ] Make `DB` fail closed when the cutover gate is met.
- [ ] Add repository provider wrapping with active-transaction reuse.
- [ ] Add and document `@Transactional()`.
- [ ] Add explicit admin repository classification.

### Repository migration

- [ ] Wrap all tenant repositories with the central provider helper.
- [ ] Verify ordinary repository calls automatically receive transaction-local tenant context.
- [ ] Verify repository calls inside explicit transactions reuse the active transaction.
- [ ] Classify and split mixed `DB`/`DB_ADMIN` repositories where needed.
- [ ] Remove transaction parameters in small domain-focused batches.
- [ ] Prevent query builders, streams, and iterators from escaping automatic repository boundaries.

### Service migration

- [ ] Move direct service query builders into repositories.
- [ ] Replace service `db.transaction(...)` calls with declarative or programmatic transaction boundaries.
- [ ] Remove tenant `DB` injection from ordinary services.
- [ ] Split DB/external/DB flows.
- [ ] Move Luma course-draft deletion out of the course-deletion transaction.
- [ ] Audit settings, thumbnail, file, course, lesson, learning-path, auth, calendar, and import flows for external work inside transactions.
- [ ] Use outbox and BullMQ for durable post-commit side effects where appropriate.

### Entry-point migration

- [ ] Change the HTTP interceptor to establish tenant identity only.
- [ ] Migrate workers and cron jobs to tenant-context-only execution.
- [ ] Migrate gateways, guards, strategies, webhooks, and handlers.
- [ ] Verify bypassed/public paths cannot reach tenant repositories without tenant context.
- [ ] Preserve deliberate `runForEachTenant()` behavior without holding a transaction across external work.

### Cleanup

- [ ] Remove deprecated request-wide transaction APIs.
- [ ] Remove obsolete `trx` and `dbInstance` parameters.
- [ ] Enable static enforcement in CI.
- [ ] Update `apps/api/AGENTS.md` with the final tenant/RLS flow and injection rules.
- [ ] Update architecture documentation if the implementation changes any decisions in this plan.

## Edge Cases

- **Nested repository calls:** the inner repository must reuse the active transaction.
- **Nested `@Transactional()` calls:** use `REQUIRED`; do not create a second transaction.
- **Two transactions in one service method:** use two sequential `tenantRunner.transaction()` calls.
- **Tenant switch inside a transaction:** reject it explicitly.
- **Parallel repository calls without an explicit transaction:** each may use its own short transaction and pool connection.
- **Parallel repository calls inside an explicit transaction:** verify driver behavior and avoid assuming parallel database execution on one reserved connection.
- **Repository returns a Drizzle builder:** the wrapper must await thenables; returning a still-configurable builder is forbidden.
- **Streaming/cursors:** require an explicit API whose lifetime owns and closes the transaction.
- **Long-running database query:** remains inside a transaction by necessity and is controlled by statement/transaction observability, not by moving the boundary.
- **External failure after commit:** use retryable outbox/queue handling or explicit compensation.
- **Admin method on a mixed repository:** do not silently create a tenant transaction around a privileged query.
- **Missing tenant context:** fail before checking out a connection.
- **Missing transaction in `DB`:** throw; never fall back to `DB_APP` or `DB_ADMIN`.
- **Test factories:** establish tenant context or use an explicit admin test helper.
- **Request cancellation:** transaction callback must reject so the driver rolls back and releases the connection.

## Tests And Validation

### Unit tests

- Repository wrapper starts one transaction for an ordinary call.
- Repository wrapper sets the tenant before the first query.
- Repository wrapper reuses an existing transaction.
- Repository wrapper commits successful calls and rolls back failed calls.
- `DB` throws without an active transaction.
- Tenant context without a transaction does not check out a connection.
- Nested `transaction()` and nested `@Transactional()` use `REQUIRED`.
- Tenant switching during an active transaction is rejected.
- Drizzle thenables finish before commit.
- Repository method errors preserve their original type.

### API integration tests

- Tenant A cannot read, update, or delete Tenant B data.
- Missing tenant identity cannot access tenant tables.
- Two concurrent tenants never observe each other's context.
- Ordinary repository calls work without a request-wide transaction.
- Several repositories inside `@Transactional()` roll back atomically.
- Two explicit transaction phases commit independently.
- A simulated slow Luma/HTTP call does not leave an application connection `idle in transaction`.
- Pool size ten remains available while more than ten requests wait on a mocked external provider.
- Background jobs and WebSocket handlers receive the same RLS guarantees as HTTP calls.
- Public/bypassed paths continue to work through explicit non-tenant persistence paths.

### Regression validation

- Run focused storage DB unit tests.
- Run tenant and multi-tenant API e2e tests.
- Run course deletion and Luma integration tests after moving the external side effect.
- Run worker/cron tests for each migrated entry point.
- Run `pnpm lint-tsc-api`.
- Run `pnpm test:api` before cutover.
- Re-run the idle-transaction reproduction and inspect `pg_stat_activity`.

## Rollout

1. Deploy observability and timeout mitigation to preprod.
2. Deploy infrastructure primitives while preserving current request transactions.
3. Migrate repositories and services in reviewable domain batches.
4. Enable fail-closed checks in preprod and run the full tenant test matrix.
5. Switch the request interceptor to tenant-context-only behavior.
6. Load-test with delayed external providers and a pool size of ten.
7. Monitor pool wait, transaction duration, rollback rate, missing-context errors, and `idle in transaction`.
8. Roll out to production with the timeout mitigation retained.

During the compatibility phase, avoid hiding missing migrations with a permanent raw-DB fallback. Any temporary fallback must emit a metric and must be removed before the request-wide transaction is disabled.

## Acceptance Criteria

- HTTP requests do not hold a database transaction when no database work is running.
- An ordinary tenant repository call automatically executes within a short transaction containing transaction-local tenant context.
- Repository calls inside explicit service transactions reuse the same transaction without `trx` arguments.
- Services can express two or more sequential transaction phases around external work.
- Tenant `DB` cannot execute without an active tenant transaction.
- Ordinary services no longer inject tenant `DB`.
- No audited transaction callback waits on an external provider.
- Cross-tenant isolation tests pass for HTTP and background entry points.
- With ten or more delayed Luma requests, the application database pool remains available for unrelated repository queries.
- Preprod no longer accumulates leaked `idle in transaction` sessions during the reproduction scenario.
