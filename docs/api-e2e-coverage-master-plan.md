# API E2E Coverage Master Plan (Extensive)

Date: 2026-04-29
Scope: `apps/api/src/**/*controller.ts`

## 1. Objective
This plan upgrades E2E from mostly route/guard verification to deep behavioral verification.

Target outcomes:
- Cover all API controllers and all declared HTTP endpoints.
- Validate business invariants, not only status codes.
- Validate weird/failure cases (race conditions, malformed payloads, cross-tenant leakage attempts, replay/idempotency cases, boundary data).
- Assert side effects in DB and domain events where relevant.

## 2. Current Snapshot
Controller inventory:
- Controllers: 29
- Endpoints: 274

Static route-hit baseline from current E2E literals (approximate floor, not full semantic coverage):
- Matched endpoints: 125/274
- Unmatched endpoints: 149/274
- Highest uncovered controllers by route count:
  - `course.controller.ts`: 32 missing (static)
  - `settings.controller.ts`: 24 missing (static)
  - `lesson.controller.ts`: 16 missing (static)
  - `articles.controller.ts`: 14 missing (static)
  - `news.controller.ts`: 11 missing (static)
  - `auth.controller.ts`: 10 missing (static)

Important: this metric is intentionally conservative and does not measure depth; many currently matched routes still need business assertions.

## 3. Definition of Done
A controller is considered complete only if all are true:
- Every endpoint has at least one success-path E2E and relevant failure-path E2E.
- Authentication and authorization matrix is validated for relevant roles.
- Tenant isolation is validated (no cross-tenant access for non-managing actors).
- Validation errors are tested for malformed/missing/invalid payloads and query params.
- Business side effects are validated via DB assertions.
- Idempotency/retry behavior is validated where endpoint semantics require it.
- Concurrency behavior is validated for high-risk writes.
- External integration paths are tested with deterministic test doubles (Stripe/Luma/OpenAI/storage/webhooks).

## 4. Test Design Rules (Applies to All Controllers)
For every endpoint family, include:
- AuthN/AuthZ: unauthenticated, wrong-role, right-role.
- Input validation: missing fields, invalid enum, invalid UUID, invalid ranges, oversized payload, unsupported MIME.
- Business logic: success result correctness + DB state correctness.
- Multi-tenant: foreign-tenant ID rejection, managing-tenant exceptions where intended.
- Idempotency: replaying same request, duplicates, conflicting state.
- Concurrency: parallel writes with overlapping entities.
- Error semantics: expected error code + stable error message key.

## 5. Shared Test Infrastructure Upgrades
Before broad rollout:
- Add helper `expectForbiddenCrossTenant()` with seeded second tenant.
- Add helper `expectValidationError(field, code?)` for consistent schema failures.
- Add helper `expectOutboxEvent(type, predicate)` for event-producing endpoints.
- Add helper `runConcurrently(requestFactory, count)` for race scenarios.
- Add deterministic external doubles:
  - Stripe webhook signature validator stub + replay detector cases.
  - Luma/OpenAI stream stubs with chunk/failure modes.
  - File storage stubs for upload/delete consistency and retry paths.
- Add clock control helper for due-date, expiry, and token TTL flows.

## 6. Controller-by-Controller Coverage Plan

### 6.1 `AuthController` (`/auth`, 20 endpoints)
Coverage goals:
- Register/login/logout/refresh lifecycle correctness and cookie/session transitions.
- Support mode entry/exit with tenant/user context restoration.
- Password reset/create/forgot flow with token expiry, single-use token, invalid token.
- OAuth callbacks (google/microsoft/slack): success, denial callback, state mismatch, missing code.
- MFA setup/verify: invalid OTP, replay OTP, setup idempotency, role constraints.
- Magic link create/verify: one-time use, expired link, cross-tenant misuse.
Weird cases:
- Refresh token reuse after logout.
- Concurrent login attempts with password change in-between.
- Mixing MFA-required and non-required roles in same tenant.

### 6.2 `UserController` (`/user`, 17 endpoints)
Coverage goals:
- Full CRUD + bulk operations with DB-level verification of roles/groups/archive flags.
- Self-update restrictions vs admin update allowances.
- Onboarding page updates and reset consistency across all flags.
- Import flow: malformed files, duplicate emails, partial success with skip reasons.
Weird cases:
- Bulk role update attempts including current admin.
- Simultaneous bulk group and role updates on same user set.
- Archived users being targeted by mutable operations.

### 6.3 `SettingsController` (`/settings`, 38 endpoints)
Coverage goals:
- Every setting endpoint covered with success + validation + permission matrix.
- Persisted settings consistency (global vs user scoped) and merge semantics.
- Login assets/logo/background upload/update/delete path invariants.
- Registration form schema update and retrieval parity.
- Notification trigger toggles and default fallback behavior.
Weird cases:
- Partial settings patch causing unrelated keys to regress.
- Race between two admins updating disjoint setting branches.
- Invalid files for login page assets (size/type corruption).

### 6.4 `CourseController` (`/course`, 41 endpoints)
Coverage goals:
- Course lifecycle: create/update/delete, publication constraints, ownership transfer.
- Enrollment flows (user and group) including unenroll and status transitions.
- Student mode toggles and access control correctness.
- Course settings endpoints and certificate toggle behavior.
- Translation/language endpoints: create/delete/generate + missing translation reports.
- Master export endpoints: creation, listing, candidate selection, job status lifecycle.
- Statistics endpoints: response correctness against seeded progress/learning-time/quiz data.
Weird cases:
- Repeated enroll requests (idempotent vs conflict semantics).
- Enrolling deleted/archived users.
- Transfer ownership to non-eligible actor.
- Concurrent group enroll/unenroll for same course.

### 6.5 `LessonController` (`/lesson`, 19 endpoints)
Coverage goals:
- Create/update/delete lesson flows across types (standard, quiz, AI, embed).
- Context initialization and resource/image retrieval authorization.
- Quiz evaluation persistence and cleanup (`delete-student-quiz-answers`).
- Lesson display order updates and sequence integrity.
- AI mentor avatar upload constraints.
Weird cases:
- Updating lesson type with incompatible payload remnants.
- Deleting lesson while dependent progress/resources exist.
- Concurrent reorder requests producing duplicate positions.

### 6.6 `ChapterController` (`/chapter`, 6 endpoints)
Coverage goals:
- Chapter retrieval includes expected lesson composition.
- Create/update/delete chapter side effects on ordering.
- Freemium status toggles reflected in downstream access.
- Display-order mutation validation and cross-course protection.
Weird cases:
- Setting invalid display order bounds.
- Cross-course chapter ID used by unauthorized editor.

### 6.7 `CategoryController` (`/category`, 6 endpoints)
Coverage goals:
- Category CRUD with admin/student visibility differences.
- Pagination/sort/filter semantics and archived behavior.
- Bulk deletion integrity and linked entities handling.
Weird cases:
- Deleting category referenced by existing courses.
- Duplicate titles and normalization collisions.

### 6.8 `GroupController` (`/group`, 9 endpoints)
Coverage goals:
- Group CRUD plus user assignment and by-course listing.
- Auto-enrollment side effects when setting user groups.
- Bulk delete behavior and membership cleanup.
- Pagination/sort/filter correctness.
Weird cases:
- Assigning same group repeatedly to same user.
- Simultaneous group assignment and group-course enrollment changes.

### 6.9 `IntegrationAdminController` (`/integration/key`, 2 endpoints)
Coverage goals:
- Key generation, rotation, metadata retrieval.
- Key storage validation (hash/prefix only).
- Rate-limiting behavior under repeated rotate attempts.
Weird cases:
- Rapid rotate requests in parallel.
- Stale key usage immediately after rotate.

### 6.10 `IntegrationController` (`/integration`, 12 endpoints)
Coverage goals:
- Header contract enforcement (`X-API-Key`, `X-Tenant-Id`).
- Tenant list behavior for managing vs non-managing admins.
- User/group listing and mutation operations via integration API.
- Course enroll/unenroll (users/groups) with DB verification.
Weird cases:
- Cross-tenant access attempts with valid API key.
- Repeated enrollment payloads with duplicates.
- Mixed valid/invalid IDs in same integration request.

### 6.11 `AnnouncementsController` (`/announcements`, 6 endpoints)
Coverage goals:
- List/latest/unread/me endpoints correctness by role and read state.
- Create announcement with expected visibility and localization behavior.
- Mark-as-read updates unread counters and is idempotent.
Weird cases:
- Marking already read announcement.
- Announcement visibility around publish timing boundaries.

### 6.12 `NewsController` (`/news`, 11 endpoints)
Coverage goals:
- Add dedicated module E2E file with full route matrix.
- Draft vs published visibility rules by role.
- Localization create/update/delete and fallback behavior.
- Upload/preview/resource endpoints with ownership and file constraints.
Weird cases:
- Updating deleted language variant.
- Previewing content with malformed embedded resources.

### 6.13 `ArticlesController` (`/articles`, 18 endpoints)
Coverage goals:
- Section CRUD and language operations.
- Article CRUD, drafts/toc/list/detail/resource retrieval.
- Upload and preview pipelines.
- Cross-role visibility (admin/content creator/student).
Weird cases:
- Deleting section with nested articles.
- TOC ordering drift after concurrent updates.
- Resource access after article deletion.

### 6.14 `QAController` (`/qa`, 7 endpoints)
Coverage goals:
- Feature-flag-driven access behavior (`QAEnabled`, guest accessibility).
- CRUD and language endpoints with role constraints.
- Validation and duplicate locale protection.
Weird cases:
- Switching QA flag between requests.
- Delete language that is base locale.

### 6.15 `CertificatesController` (`/certificates`, 6 endpoints)
Coverage goals:
- User certificate list/detail/download correctness.
- Share-link creation authorization and ownership restrictions.
- Public share HTML/image rendering for valid and invalid cert IDs.
- Content-disposition filename handling for non-ASCII titles.
Weird cases:
- Share token for certificate from another tenant.
- Rendering when certificate exists but course/user metadata missing.

### 6.16 `StatisticsController` (`/statistics`, 2 endpoints)
Coverage goals:
- `user-stats` and `stats` data integrity against seeded telemetry.
- Permission enforcement for aggregate stats.
Weird cases:
- Empty tenant/user dataset behavior.
- Statistics with partially archived users/courses.

### 6.17 `ReportController` (`/report`, 1 endpoint)
Coverage goals:
- Summary report download content type, filename, and row correctness.
- Authorization and language parameter validation.
Weird cases:
- Very large dataset export pagination/chunking assumptions.
- Unsupported language fallback.

### 6.18 `StudentLessonProgressController` (`/studentLessonProgress`, 1 endpoint)
Coverage goals:
- Mark complete flow updates progress state and completion constraints.
- Permission matrix for learning mode and progress update permissions.
Weird cases:
- Repeated completion marking.
- Completion for non-enrolled student.

### 6.19 `AIController` (`/ai`, 5 endpoints)
Coverage goals:
- Thread ownership/visibility constraints.
- Message retrieval ordering and shape correctness.
- Judge/retake state transitions and authorization.
- Chat stream behavior for valid and invalid thread context.
Weird cases:
- Concurrent chat submissions to same thread.
- Judge called on inactive/retaken/foreign thread.

### 6.20 `LumaController` (`/luma`, 6 endpoints)
Coverage goals:
- Course-generation message/draft/file lifecycle.
- Ingestion and file deletion authorization + validation.
- Streaming chat response framing and termination.
Weird cases:
- Interrupted stream mid-response.
- Delete unknown ingested file.
- Invalid integration ID ownership.

### 6.21 `IngestionController` (`/ingestion`, 3 endpoints)
Coverage goals:
- Ingest document flow, list assigned docs, delete link behavior.
- File type/size constraints and lesson ownership checks.
Weird cases:
- Same document ingested twice.
- Delete already removed document link.

### 6.22 `FileController` (`/file`, 11 endpoints)
Coverage goals:
- Standard upload + delete flow with DB and storage side-effect assertions.
- Video init/status flow and permission model.
- TUS flow: options/create/head/patch semantics and offset handling.
- Bunny webhook validation and thumbnail generation behavior.
Weird cases:
- TUS offset conflicts (409) and resumed upload correctness.
- Pathological metadata headers.
- Unsupported video provider thumbnail inputs.

### 6.23 `SCORMController` (`/scorm`, 3 endpoints)
Coverage goals:
- Upload package validation and metadata persistence.
- Content serving for html/non-html payloads and headers.
- Metadata retrieval authorization and not-found handling.
Weird cases:
- Corrupted zip package.
- Path traversal attempts in SCORM content path.

### 6.24 `StripeController` (`/stripe`, 7 endpoints)
Coverage goals:
- Payment intent and checkout session creation with strict input validation.
- Promotion code CRUD behavior and permission matrix.
- Webhook signature validation and event handling side effects.
Weird cases:
- Webhook replay attacks.
- Unknown event types.
- Currency/amount boundary validation.

### 6.25 `EnvController` (`/env`, 8 endpoints)
Coverage goals:
- Secret upsert/retrieve with allowed key constraints.
- Public config endpoints with schema assertions.
- Config setup summary consistency.
Weird cases:
- Unsupported secret key names.
- Partial secret set producing partial config statuses.

### 6.26 `SuperAdmin TenantsController` (`/super-admin/tenants`, 5 endpoints)
Coverage goals:
- Tenant list/detail/create/update and support session creation.
- Managing-tenant guard behavior.
- Search/pagination behavior correctness.
Weird cases:
- Tenant host uniqueness collisions.
- Support session target tenant mismatch.

### 6.27 `AnalyticsController` (`/analytics`, 1 endpoint)
Coverage goals:
- Secret guard enforcement.
- Successful path with valid secret and deterministic count assertion.
Weird cases:
- Invalid secret format and missing secret env.

### 6.28 `HealthController` (`/healthcheck`, 1 endpoint)
Coverage goals:
- Liveness response and consistent schema.
- Dependency degraded mode behavior if any checks are added later.
Weird cases:
- None critical currently; keep as smoke + future extension.

### 6.29 `TestConfigController` (`/test-config`, 2 endpoints)
Coverage goals:
- Staging-only enforcement (`OnlyStaging`) for setup/teardown.
- Auth requirements where applicable.
Weird cases:
- Repeated setup/teardown idempotency.
- Partial teardown recovery.

## 7. Phase Plan (Execution Order)

### Phase 0: Harness Hardening
- Implement shared helpers and external doubles.
- Add deterministic seed sets for multi-tenant, multi-role, multi-course scenarios.

### Phase 1: Route and Contract Closure
- Close all uncovered route entries, prioritized by high-risk modules:
  - `course`, `settings`, `lesson`, `articles`, `news`, `auth`, `integration`.
- Ensure each endpoint has auth + validation + base success tests.

### Phase 2: Business Invariant Depth
- Add DB-assertive tests for domain state transitions.
- Add cross-entity behaviors (enrollment effects, stats consistency, resource lifecycle).

### Phase 3: Weird/Fault Cases
- Add concurrency, idempotency, replay, and malformed protocol cases.
- Add boundary datasets (large lists, long text, high cardinality groups/users).

### Phase 4: Stability and CI
- Tag flaky tests and remove nondeterminism.
- Add suite partitioning for runtime budget and parallel CI shards.
- Add coverage dashboard output (controller + endpoint + scenario-type matrix).

## 8. Coverage Matrix Requirements Per Endpoint
Minimum scenario matrix per endpoint class:
- Read endpoint:
  - unauthenticated/forbidden/success/not-found/tenant-leak attempt
- Write endpoint:
  - unauthenticated/forbidden/validation failure/success/duplicate-or-conflict/tenant-leak attempt
- Integration or streaming endpoint:
  - auth/header checks/happy path/retry-replay behavior/partial-failure behavior

## 9. Tracking Checklist (Controller Completion)
- [ ] AuthController
- [ ] UserController
- [ ] SettingsController
- [ ] CourseController
- [ ] LessonController
- [ ] ChapterController
- [ ] CategoryController
- [ ] GroupController
- [ ] IntegrationAdminController
- [ ] IntegrationController
- [ ] AnnouncementsController
- [ ] NewsController
- [ ] ArticlesController
- [ ] QAController
- [ ] CertificatesController
- [ ] StatisticsController
- [ ] ReportController
- [ ] StudentLessonProgressController
- [ ] AIController
- [ ] LumaController
- [ ] IngestionController
- [ ] FileController
- [ ] ScormController
- [ ] StripeController
- [ ] EnvController
- [ ] SuperAdmin TenantsController
- [ ] AnalyticsController
- [ ] HealthController
- [ ] TestConfigController

## 10. Success Exit Criteria
This plan is complete when:
- Every controller in this document is checked complete.
- Every endpoint has route + business + edge coverage per matrix.
- CI can run the E2E suite reliably with low flake rate and stable runtime.
