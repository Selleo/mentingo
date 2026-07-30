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

## Risk Matrix: What Can Break And The Fix

The implementation must treat these as concrete failure modes, not merely code-review guidance.

### Security and tenant-isolation risks

| Risk | Failure mode | Required fix | Proof |
| --- | --- | --- | --- |
| Raw connection fallback | A query executes through `DB_APP` without `app.tenant_id`. | Make `DB` fail closed; keep `DB_APP` private to the runner; add a source audit for direct `DB_APP` injection. | Missing-context test fails before a connection is checked out. |
| RLS policy misconfiguration | A table is missing RLS, uses the wrong tenant column, or is owned by a role that bypasses RLS. | Inventory every tenant table; verify policy, owner, grants, `FORCE ROW LEVEL SECURITY`, and no `BYPASSRLS` for the app role. | Cross-tenant read/write/delete e2e tests plus a database-role inspection check. |
| Tenant context spoofing | A request body, query parameter, job payload, or stale user object selects another tenant. | Resolve tenant only from the trusted host/auth/session/job boundary; validate the job tenant against its signed/claimed source; never trust arbitrary payload tenant IDs. | Resolver tests for host, auth, support mode, and conflicting IDs. |
| Context bleed between async work | A callback created for Tenant A runs after the request or under Tenant B. | Never reuse a transaction-bearing ALS context for detached work; require all fire-and-forget work to enqueue a job or explicitly call `runWithTenantContext`; reject tenant changes inside active transactions. | Concurrent tenant stress test with delayed promises and detached-task audit. |
| Stale transaction in a detached callback | A callback retains an ALS `trx` after its transaction committed and later attempts a query. | Await all work in a transaction; prohibit `void`/fire-and-forget inside transaction callbacks; expose a context-only handoff for asynchronous work. | Unit test that a detached callback cannot use a completed transaction. |
| Admin/tenant boundary confusion | A mixed repository executes a privileged `DB_ADMIN` query from a tenant-facing method. | Split mixed repositories or mark admin methods explicitly; keep `DB_ADMIN` on an allowlist and never expose it through `DB`. | Static allowlist test and support-mode/cross-tenant e2e tests. |
| Bypass route regression | A health/webhook/public route has no tenant context but reaches a tenant repository. | Keep bypasses explicit; route public operations to dedicated admin/public providers; fail closed for tenant `DB`. | Bypassed-route integration tests. |
| Raw SQL or privileged database functions | A repository uses raw SQL or a `SECURITY DEFINER` function that bypasses expected policies. | Audit raw SQL and database functions; restrict `SECURITY DEFINER`, set safe `search_path`, and document approved exceptions. | SQL/static audit and least-privilege database review. |

### Transaction-lifetime and correctness risks

| Risk | Failure mode | Required fix | Proof |
| --- | --- | --- | --- |
| Lazy Drizzle builder escapes | Repository returns an unexecuted builder; the wrapper commits before the query runs. | Await/assimilate thenables in the repository wrapper; forbid returning builders, cursors, streams, or async iterators from ordinary methods. | Unit test with a lazy Drizzle thenable and a compile/source audit for streaming methods. |
| External I/O remains inside a transaction | Luma/S3/email/AI/calendar waits keep a connection checked out. | Split DB and external phases; use outbox/BullMQ for durable post-commit side effects. | Delayed-provider test plus `pg_stat_activity` assertion. |
| Lost atomicity after splitting | Database commits but the external operation fails, or the reverse. | Persist an outbox event/status in the DB transaction; retry external work idempotently; expose failed/dead-letter state for repair. | Outbox retry, duplicate-delivery, and failure-recovery tests. |
| Too-small transaction boundary | Two reads that must share a snapshot use separate automatic transactions. | Require `@Transactional()` or `tenantRunner.transaction()` for consistency-sensitive operations; document that ordinary repository calls are independent units. | Snapshot/rollback test for a representative multi-query use case. |
| Too-large transaction boundary | A service marks itself transactional and performs network/file work inside it. | Review `@Transactional()` methods for external calls; static rule for known provider calls in transaction callbacks; keep transaction decorators narrow. | Architecture lint and transaction-duration metric. |
| Nested transaction surprise | Calling `db.transaction()` through the proxy creates an accidental savepoint or consumes another connection. | Use `REQUIRED` propagation; expose `transaction()` only through the runner; audit and replace direct `db.transaction()` calls. | Nested transaction test verifies one physical connection and expected rollback behavior. |
| Parallel work on one transaction | `Promise.all` issues concurrent operations against one reserved connection or creates lock-order deadlocks. | Do not promise parallel DB execution inside one transaction; serialize dependent writes; use separate transactions only when independence is explicit. | Concurrency/lock-order test and deadlock telemetry. |
| Deadlocks and serialization failures | Shorter transactions change lock ordering or expose existing concurrent writes. | Keep lock ordering stable; do not silently retry non-idempotent callbacks; add bounded, opt-in retry only for classified transient errors. | Database fault-injection tests and retry metrics. |
| Transaction timeout/cancellation | Request abort or database timeout leaves a callback awaiting while a connection remains checked out. | Propagate cancellation, ensure the driver callback rejects, configure statement/transaction timeouts, and always observe rollback/release. | Abort test and connection-count assertion after timeout. |
| Pool overhead from one transaction per repository call | High read traffic creates excessive BEGIN/COMMIT overhead or checkout contention. | Keep multi-query reads in an explicit transaction where justified; measure checkout wait and transaction rate; batch repository operations rather than widening every request. | Load test comparing pool wait, throughput, and transaction count. |
| Retry repeats side effects | A transaction retry repeats emails, events, uploads, or non-idempotent writes. | Never include external side effects in retryable callbacks; use idempotency keys and outbox deduplication. | Duplicate-delivery and retry tests. |

### Application and framework risks

| Risk | Failure mode | Required fix | Proof |
| --- | --- | --- | --- |
| Direct service DB usage remains | After request transactions are removed, an unmigrated service gets `MissingTenantTransactionError` or bypasses the wrapper. | Maintain an inventory of all `DB` injections and `db.transaction` calls; migrate by domain; make the cutover gate fail CI if new direct usage appears. | Static audit reaches zero ordinary-service injections before cutover. |
| Proxy self-invocation bypasses decorators | A service calls its own decorated method through `this`, skipping the provider proxy. | Use `tenantRunner.transaction()` in self-call paths or split the transaction entry point into another provider; test both paths. | Self-invocation unit test. |
| Provider wrapping/order failure | Nest injects the raw repository or calls it before the wrapper is installed. | Use an explicit provider-factory helper that preserves the class token; avoid lifecycle-dependent discovery; test the compiled Nest module graph. | Module integration test asserts injected instance is wrapped. |
| Method metadata/`this` loss | Decorators alter method binding, error identity, or return types. | Preserve `this`, arguments, thrown errors, and promise/thenable behavior; avoid wrapping constructors/getters. | Decorator unit tests and API regression tests. |
| Compatibility parameters bypass context | A legacy `trx`/`dbInstance` argument points to another tenant or raw connection. | During migration, validate any supplied transaction equals the ALS transaction; remove the parameters before final cutover. | Mismatch test rejects foreign transaction instances. |
| ALS propagation differs across RxJS/jobs/timers | Context is lost or inherited unexpectedly at framework boundaries. | Add explicit context adapters at HTTP, worker, gateway, cron, and handler entry points; avoid relying on undocumented propagation across detached timers. | One context-propagation test per entry-point family. |
| Error wrapping hides tenant failures | A generic error converts a missing-context or RLS error into a 500 without an actionable signal. | Preserve typed database-boundary errors, map them to safe client responses, and log correlation/tenant metadata without secrets. | Error contract and log-redaction tests. |
| Tests use unrealistic mocks | Unit mocks allow raw DB access and fail to detect missing RLS context. | Add integration tests against PostgreSQL/RLS, and make mock `DB` fail closed by default. | CI tenant-isolation suite. |

### Operations and compliance risks

| Risk | Failure mode | Required fix | Proof |
| --- | --- | --- | --- |
| No forensic signal | Pool exhaustion or RLS rejection cannot be correlated to a request/job. | Emit request/job correlation ID, tenant ID hash or safe identifier, transaction duration, pool wait, and failure class; never log secrets or full SQL parameters. | Dashboard/alert review and redaction tests. |
| Timeout masks a code defect | `idle_in_transaction_session_timeout` kills work but leaves partial business behavior or noisy errors. | Keep the timeout as defense in depth; alert on terminations; fix transaction boundaries and provide retry/repair semantics where safe. | Preprod reproduction plus timeout-termination alert. |
| Incomplete rollback/audit semantics | A failed operation leaves an outbox row, status, or audit record inconsistent. | Define transaction ownership for outbox/audit writes; publish durable events inside the same transaction and process them after commit. | Rollback and outbox atomicity tests. |
| Migration cutover too early | Some route, worker, or test path still depends on a request-wide transaction. | Use a staged feature flag/compatibility phase, inventory gate, and canary load test before switching the interceptor. | CI gate and preprod canary checklist. |
| Compliance evidence is undocumented | The system may be isolated but reviewers cannot prove it. | Store the final RLS policy/role audit, threat-model decisions, test results, timeout configuration, and rollout/rollback record with the implementation. | Release evidence checklist. |

## Required Mitigations Before Cutover

The request interceptor must not switch to context-only mode until all of these are true:

- [ ] No ordinary service injects tenant `DB` directly.
- [ ] Every tenant repository is registered through the automatic wrapper.
- [ ] No ordinary repository method requires a caller-provided `trx` or `dbInstance`.
- [ ] Every non-HTTP tenant entry point establishes tenant context.
- [ ] All transaction callbacks containing external I/O are split or explicitly approved.
- [ ] `DB` has no raw `DB_APP` fallback.
- [ ] PostgreSQL RLS, ownership, grants, and `BYPASSRLS` checks pass.
- [ ] Missing-context, cross-tenant, cancellation, nested-transaction, and concurrency tests pass.
- [ ] Preprod idle-transaction reproduction shows no accumulated sessions.
- [ ] Rollback procedure is tested: restore request transaction behavior without reintroducing unbounded external waits, or disable the migrated route slice safely.

## Fix Selection Rules

When a failure is found during migration, choose the smallest fix that preserves the boundary:

1. Missing tenant context: fix the entry-point context setup; do not use `DB_ADMIN` or restore a global request transaction.
2. One method needs atomic multi-query behavior: add `@Transactional()` or a narrow `tenantRunner.transaction()` boundary.
3. A method performs DB, network, and DB: split it into phases and use an outbox/queue for durable side effects.
4. A repository needs a caller-specific transaction: first check whether it can reuse ALS; retain a validated compatibility parameter only until the call graph is migrated.
5. A read needs a shared snapshot: make the service operation explicitly transactional rather than widening all requests.
6. A stream/cursor needs a long-lived connection: use a dedicated streaming API with explicit close/cancellation semantics; do not pass it through the ordinary repository wrapper.
7. A privileged query is needed: create or use an explicit admin repository and audit its authorization; never weaken tenant RLS.
8. A transient database failure occurs: classify and retry only idempotent database work; never retry external side effects inside the transaction.
9. Pool pressure increases: inspect transaction duration and checkout wait, batch logical work, and fix accidental transaction nesting before increasing pool size.

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
