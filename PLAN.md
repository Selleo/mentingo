# PR #1828 implementation plan

## Scope and status

This plan turns [`FEEDBACK.md`](./FEEDBACK.md) into an implementation sequence. The implementation pass has addressed the core backend/API, generated-client, lifecycle, seed, and delivery-boundary findings. Remaining validation and scale work is explicit below.

Status vocabulary:

- **Not implemented:** identified during review; no code change was made.
- **Partially implemented:** code changes exist, but required validation or part of the finding remains outstanding.
- **Ready to implement:** acceptance criteria are defined, but implementation still requires an authorized coding pass.
- **Implemented:** code and the relevant validation have been completed.

## Phase 0 — Rebase and establish a safe baseline

1. Rebase or merge current `staging` into the PR branch and resolve the reported conflict. Preserve the exact automation/email-template intent while removing duplicate merge artifacts.
2. Install dependencies with the repository-required Node/pnpm versions.
3. Record baseline results for API lint/typecheck, web lint/typecheck, focused unit tests, and `git diff --check` after line-ending normalization.

**Exit criteria:** the branch is based on current `staging`, the worktree is clean except for intentional changes, and all subsequent migration/file references are based on the rebased tree.

Status: **Partially implemented** — staging was merged and the migration chain was regenerated through 0184; local upgrade application and journal/tail validation pass, while a separate fresh/staging-upgrade rehearsal remains pending.

## Phase 1 — Make the database migration chain deployable

Feedback: **F-01**

1. Inspect the target baseline's latest migration number and journal.
2. Assign unique migration names/numbers to automation tables, email notification templates, and email-template RLS.
3. Regenerate Drizzle snapshots and `_journal.json` through the existing migration command; do not hand-edit generated migration metadata.
4. Verify each snapshot `id` points to the preceding snapshot's `prevId` and that each journal tag has exactly one migration file.
5. Run a fresh database migration and an upgrade migration from the current staging schema. Assert email-template tables, automation tables, indexes, enums, RLS, and policies.

**Exit criteria:** one deterministic migration chain works both from empty and existing staging databases, including email-template RLS.

Status: **Partially implemented** — schemas, validation decorators, generated artifacts, graph validation, exact trigger matching, and no-row handling are implemented; full HTTP contract tests and structured node-level error mapping remain pending.

## Phase 2 — Establish authoritative API and graph contracts

Feedback: **F-03, F-04, F-15, F-16, F-17**

1. Define TypeBox schemas for automation records, status transitions, simulation input, individual steps, bulk step trees, and response envelopes.
2. Apply `@Validate` to every new automation endpoint and document success/error responses.
3. Remove client-controlled `tenantId` from public input; derive tenant scope from the authenticated request. Keep any internal seed input separate.
4. Implement complete tree validation in the service transaction: one root, same-automation parents, all IDs present and unique, no missing parents, supported node types/configs, and no cycles.
5. Replace trigger `LIKE` matching with exact identifier equality and centralize supported event/action constants.
6. Convert no-row updates to explicit not-found/domain errors, remove debug `console.log` calls, and use structured typed logging.
7. Decide which rules are shared stable constants and which remain server-owned. Return structured validation errors that the builder can render per node.
8. Regenerate Swagger and the web client using existing scripts.

**Exit criteria:** malformed or cross-automation graphs receive 400 responses, tenant/permission boundaries are enforced server-side, and generated web types describe the actual API.

Status: **Partially implemented** — atomic save, runner safeguards, tenant-aware rendering, localized resolution, seed hardening, and queued retryable email delivery are implemented; cross-module delivery/idempotency and end-to-end validation remain pending.

## Phase 3 — Make save and execution reliable

Feedback: **F-05, F-07, F-08, F-09, F-10, F-13, F-14**

1. Add a transaction-backed command for automation metadata plus complete tree replacement, or define a server-side versioned save protocol if the endpoint must remain split.
2. Await save before navigation and preserve dirty state after failure.
3. Reject or log empty/invalid enabled trees before execution; derive tenant context from the automation record.
4. Move long-running/retryable email delivery into the existing outbox/queue patterns. Add run IDs, per-recipient attempts, retry policy, and idempotency behavior.
5. Centralize tenant-aware email rendering, including primary color, logo, localized subject/body, and a real plain-text fallback.
6. Preserve `userId` in every resolver that can use user preferences, especially short/long inactivity events.
7. Resolve localized announcement content using recipient language and an explicit fallback chain.
8. Make default seeding idempotent with a tenant-scoped uniqueness strategy, batch trigger lookup, transactional/upsert behavior, and separate already-existing versus failed counts.

**Exit criteria:** a save is atomic from the user's perspective, enabled workflows cannot run an invalid/empty tree, delivery can be retried without duplicate sends, and localized branded emails are correct.

Status: **Partially implemented** — atomic save, runner safeguards, tenant-aware rendering, localized resolution, seed hardening, and queued retryable email delivery are implemented; cross-module delivery/idempotency and end-to-end validation remain pending.

## Phase 4 — Align web permissions and lifecycle UX

Feedback: **F-02, F-06, F-11, F-12, U-01 through U-08**

1. Require `AUTOMATION_MANAGE` consistently in route access, navigation, and API calls; add a permission-only administrator test.
2. Replace direct Axios usage in automation hooks with regenerated `ApiClient.api...` methods.
3. Define enabled/disabled/draft/archived lifecycle semantics. Use disabled for pause, draft for incomplete configuration, and show the same labels in list, drawer, builder, and logs.
4. Return the new automation ID and navigate to the builder, or provide a clear open-builder success action.
5. Add explicit save status, flush autosave on close, serialize save requests, and avoid background autosave success-toast spam.
6. Merge localized JSONB updates instead of replacing other locales; add a clear locale editing affordance.
7. Make the action modal responsive, keep actions visible, improve keyboard graph editing, and use theme tokens for connectors and validation state.
8. Add server pagination/filtering for automations and logs, URL-persisted filters, and clear empty/error/loading states.

**Exit criteria:** an automation-only administrator can discover, edit, save, pause, and recover from errors without encountering a route/API mismatch or ambiguous lifecycle state.

Status: **Partially implemented** — permission/client/lifecycle/autosave/create-to-builder/responsive modal work is implemented; persistent save-state UI, server pagination/filtering, and keyboard/error-placement polish remain pending.

## Phase 5 — Test and cleanup

Feedback: **F-18** and maintainability feedback

1. Add API E2E coverage for permission denial, tenant isolation, cross-automation parent rejection, valid activation, disabled behavior, empty-tree handling, custom template branding/text, localized recipient resolution, partial delivery/retry, and migration fresh/upgrade paths.
2. Add web E2E coverage for permission-based navigation, create-to-builder flow, save failure recovery, autosave close behavior, lifecycle labels, and responsive action editing where practical.
3. Extend existing unit tests for exact trigger matching, seed idempotency/failure reporting, tree validation, repository no-row behavior, and structured simulation errors.
4. Remove the duplicate public-course-thumbnail module, dead tree-validation code, debug logs, and unnecessary one-use abstractions.
5. Run the narrowest affected checks, then the repository API/web lint/typecheck and relevant E2E suites. Re-run `git diff --check`.

**Exit criteria:** tests cover the cross-module paths that caused the blocking findings, dead/duplicate code is removed, and all failures are either fixed or explicitly documented as pre-existing.

Status: **Partially implemented** — focused API/web unit coverage and migration metadata checks are in place; cross-module API/browser E2E and fresh/upgrade database rehearsals remain pending.

## Feedback implementation matrix

| Feedback | Area | Feasibility | Implementation status | Required validation |
| --- | --- | ---: | --- | --- |
| F-01 | Migrations/RLS | Low | Partially implemented | Fresh and staging-upgrade migration tests |
| F-02 | API/web permissions | High | Implemented | API 403/200 tests and route/navigation permission test |
| F-03 | Graph integrity | Medium | Implemented | Cross-automation, missing-parent, duplicate, cycle tests |
| F-04 | Runtime API schemas | Medium | Partially implemented | 400 contract tests, Swagger/client regeneration, typecheck |
| F-05 | Atomic save | Low | Implemented | Transaction failure/retry and save-navigation E2E |
| F-06 | Generated client | High | Implemented | Generated client usage search and web typecheck |
| F-07 | Empty execution | High | Partially implemented | Empty/invalid enabled-tree runner test |
| F-08 | Delivery reliability | Low | Partially implemented | Per-recipient retry/idempotency integration test |
| F-09 | Email rendering | Medium | Partially implemented | Branded HTML/text/logo/language delivery test |
| F-10 | Inactivity locale | High | Partially implemented | User-preference localization test |
| F-11 | Navigation permission | High | Implemented | Automation-only admin E2E |
| F-12 | Lifecycle semantics | High | Implemented | Enabled/disabled/draft transition tests and UI E2E |
| F-13 | Default seed | Medium | Partially implemented | Concurrent/idempotent seed test |
| F-14 | Announcement locale | Medium | Partially implemented | Supported-language and fallback tests |
| F-15 | Trigger equality | High | Partially implemented | Exact event-name repository test |
| F-16 | Logging/errors | High | Implemented | No debug output and no-row error tests |
| F-17 | Validation ownership | Medium | Partially implemented | Structured server validation mapped in builder |
| F-18 | Cross-module tests | Medium | Partially implemented | Focused API/web E2E and migration checks |
| U-01 | Save/recovery UX | Medium | Partially implemented | Persistent save-state and recovery E2E |
| U-02 | Lifecycle vocabulary | High | Implemented | Lifecycle E2E |
| U-03 | Create-to-builder | High | Implemented | Create flow E2E |
| U-04 | Autosave reliability | Medium | Implemented | Close/race E2E |
| U-05 | Localized merge | Medium | Implemented | Multi-locale save test |
| U-06 | Responsive action editor | Medium | Partially implemented | Responsive/accessibility E2E |
| U-07 | List/log scale controls | Medium | Not implemented | Pagination/filter URL E2E |
| U-08 | Theme/error placement | Medium | Not implemented | Dark-mode/node-error E2E |

## Final implementation gate

Do not merge until the remaining F-01/F-04 validation gaps and cross-module tests are resolved on the staging-based branch. Server-side list/log scale controls and the remaining UI polish can follow as separate work if product scope permits. Re-request review with the final migration diff, generated artifact diff, exact test commands/results, and any explicitly accepted non-blocking gaps.
