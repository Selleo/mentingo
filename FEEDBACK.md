# PR #1828 review feedback

## Review scope

- Pull request: [Selleo/mentingo#1828](https://github.com/Selleo/mentingo/pull/1828)
- Worktree: `/Users/jherma/WebstormProjects/mentingo-pr-1828`
- Review branch: `review/pr-1828`
- Base: `staging` at `085ba899e62a1199c065ca2a4dfc42a41be84bab`
- Head: `e84f1ea62003bfcf91c6249b1f156390a2dfe59e` (`fix: small things`)
- Scope: backend automation engine, email-template integration, API client changes, automation admin UI, migrations, translations, and tests.

The PR is large (275 changed files, approximately 65,003 additions), is reported as `CONFLICTING` by GitHub, and its recorded checks include backend lint/build failures and frontend lint failure. Those check results are treated as evidence to reproduce after rebasing, not as a substitute for local validation.

No application-code feedback was implemented in this review. The only files added are this review and the implementation plan.

## Existing Mentingo review style

I checked the current PR discussion and recent Mentingo review comments, especially PR #1797. The useful local pattern is:

- Prefer short, line-specific comments over broad prose.
- Ask for a concrete repo-native improvement: reuse an enum/helper/query, move a utility, remove dead code, or make the backend contract authoritative.
- Separate correctness, security/tenant, API-contract, maintainability, test, and visual feedback instead of mixing them.
- Rank the comments. Migration, permission, data-integrity, and runtime-delivery issues are blocking; naming, comments, and small cleanup are lower priority.
- Explain the failure mode, not just the preferred style.
- Challenge unnecessary normalization, duplicate queries, one-use abstractions, client-side enforcement, and hand-maintained/generated contracts.
- Keep product and UI comments concrete: identify the user action, the confusing state, and the expected recovery path.

PR #1828 currently has only one substantive inline discussion (`delete comment` in `automations-source.types.ts`), so there is no existing technical review to preserve or resolve.

## Recommendation

**Request changes before merge.** The migration chain, API permission mismatch, missing request validation, cross-automation tree validation, and non-atomic save path can cause failed deployments, inaccessible or incorrectly authorized UI, invalid persisted graphs, and partially saved automations. The PR should be rebased or merged with current `staging` before the final review because GitHub reports conflicts.

## Ranked findings

Feasibility describes the relative implementation effort/risk: **High** is a focused change with low coupling, **Medium** crosses a small number of layers, and **Low** requires migration or architectural work. It is not a severity score.

### F-01 — Migration chain is not mergeable or upgrade-safe

- **Priority:** P0 / blocking
- **Feasibility:** Low
- **Evidence:** `apps/api/src/storage/migrations/0179_add_automation_tables.sql`, `0179_add_email_notification_templates.sql`, `0180_enable_email_notification_templates_rls.sql`, and `apps/api/src/storage/migrations/meta/_journal.json`.
- **Why:** There are two migrations with the `0179` prefix. The automation migration already creates `email_notification_templates`, while the second `0179` repeats that table. The journal has 180 entries and ends at `0179_add_automation_tables`; it has no journal entry for the email-template migration or `0180`. The `0180_snapshot.json` is also not represented in the journal chain.
- **Risk:** Fresh databases and upgraded databases can execute different effective schemas. Drizzle can fail to apply, skip, or misidentify the migration; RLS may be absent on an upgraded database; duplicate objects can hide an incomplete migration rather than make it safe.
- **Better pattern:** Merge/fetch the target `staging` baseline first, then assign unique migration names/numbers, regenerate snapshots and `_journal.json` through the repository migration script, and inspect every `id`/`prevId` link. Validate both a fresh database and an upgrade from the current staging schema, including RLS and policies.
- **Status:** Not implemented.

### F-02 — Frontend route access grants a permission rejected by the API

- **Priority:** P0 / blocking
- **Feasibility:** High
- **Evidence:** `apps/web/app/config/routeAccessConfig.ts:138-146` allows `USER_MANAGE` or `AUTOMATION_MANAGE`; `apps/api/src/automations/automations.controller.ts:20` and `apps/api/src/automations/automations-steps/automations-steps.controller.ts:12` require `AUTOMATION_MANAGE`.
- **Why:** A user with only `USER_MANAGE` can pass the web route guard and load the automation page, but every automation API request can return 403.
- **Risk:** The user sees a broken page, confusing authorization errors, and possibly partial UI state. It also creates two contradictory access-control contracts.
- **Better pattern:** Make `AUTOMATION_MANAGE` the canonical route requirement. If `USER_MANAGE` is intentionally sufficient, change the backend permission policy and cover both paths with authorization tests; do not rely on frontend hiding as security.
- **Status:** Not implemented.

### F-03 — Automation tree validation accepts a parent from another automation

- **Priority:** P0 / blocking
- **Feasibility:** Medium
- **Evidence:** `apps/api/src/automations/automations-steps/automations-steps.service.ts:166-180` validates only that `parentId` exists; it does not verify the parent belongs to `input.automationId`. `buildStepGraph` also silently ignores missing parents.
- **Why:** A caller can create or replace a step in automation B with a parent ID from automation A in the same tenant. The persisted graph then has an orphaned node or a tree that does not represent the requested automation.
- **Risk:** Runtime execution can omit nodes, execute only a partial tree, or produce a misleading successful save. A malformed tree can be introduced through the API even if the builder UI cannot create it.
- **Better pattern:** Validate the complete submitted tree in one transaction: all IDs belong to the automation, IDs are unique, exactly one root exists, every non-root parent exists in the submitted set, node kinds/configurations are valid, and no cycle exists. Reject missing parents rather than ignoring them. Add cross-tenant and cross-automation tests.
- **Status:** Not implemented.

### F-04 — Automation endpoints accept compile-time types instead of runtime schemas

- **Priority:** P0 / blocking
- **Feasibility:** Medium
- **Evidence:** `apps/api/src/automations/automations.controller.ts:50-94` and `apps/api/src/automations/automations-steps/automations-steps.controller.ts:17-47` use raw `@Body()` values without `@Validate` schemas. `RunSimulationBody`, status bodies, step records, and bulk updates are TypeScript types only at runtime.
- **Why:** HTTP clients can submit unknown properties, invalid UUIDs, unsupported statuses, malformed localized values, or arbitrary node contexts.
- **Risk:** Invalid data reaches services and JSONB columns, API documentation is incomplete, and the generated client cannot accurately protect callers. This combines with F-03 to make graph corruption possible outside the UI.
- **Better pattern:** Define TypeBox request/response schemas in the API contract layer, apply `@Validate`, document responses, and regenerate Swagger and the web client using existing scripts. Add 400-response tests for malformed nodes, status transitions, localized fields, and simulation payloads.
- **Status:** Not implemented.

### F-05 — Metadata and step-tree saves are two independent requests

- **Priority:** P0 / blocking
- **Feasibility:** Low
- **Evidence:** `apps/web/app/api/mutations/admin/useUpdateAutomation.ts:26-34` patches automation metadata and then replaces steps with a second request. `apps/web/app/modules/Admin/Automation/Builder/hooks/useBuilderHeaderActions.ts:62-66` navigates immediately after calling save.
- **Why:** The two writes are not atomic, and the navigation callback does not await the mutation. A successful metadata update followed by a failed tree update leaves a split-brain automation; navigation can also hide the failure from the user.
- **Risk:** Users can lose a graph, enable a stale graph, or believe changes were saved when the second request failed. Retries can produce ambiguous state.
- **Better pattern:** Add one backend command that validates and persists metadata plus the complete tree in one database transaction, or provide an explicit server-side version/claim protocol. Await the mutation before navigation, preserve dirty state on failure, and show an inline save/error state.
- **Status:** Not implemented.

### F-06 — Frontend automation calls bypass the generated API client

- **Priority:** P1
- **Feasibility:** High
- **Evidence:** `ApiClient.instance` is used directly in `apps/web/app/api/mutations/admin/useUpdateAutomation.ts:27-33`, `useCreateAutomation.ts:24`, `useAutomationById.ts:13-20`, and `useSimulation.ts:35-38`, among other new automation hooks.
- **Why:** The repository contract requires app endpoints to use `ApiClient.api...`; direct Axios calls bypass generated request/response types and can drift from the API schema.
- **Risk:** Contract changes are not caught at compile time, response envelopes can be handled inconsistently, and auth/error behavior can diverge from generated callers.
- **Better pattern:** Complete the API schemas first, regenerate `apps/web/app/api/generated-api.ts`, and use generated methods in all automation hooks. Do not hand-edit generated artifacts.
- **Status:** Not implemented.

### F-07 — Empty or racing automation execution can crash before logging

- **Priority:** P1
- **Feasibility:** High
- **Evidence:** `apps/api/src/automations/automation-runner/automation-runner.service.ts:52-69` reads `automationSteps[0].tenantId` before checking whether steps exist. The same method logs after loading recipients and automation, without checking the automation status/tree invariants first.
- **Why:** An enabled automation can temporarily have no steps during a save, migration, deletion, or race. Indexing the empty array throws before the failure can be represented as an automation log.
- **Risk:** Event processing can fail with an unhandled TypeError, with no tenant-scoped run record and no actionable operator signal.
- **Better pattern:** Load and validate the automation and tree first; derive tenant ID from the automation record, not an arbitrary first step. Record a skipped/failed run with a reason for empty or invalid trees, and make the transition/update transaction prevent enabled-invalid state.
- **Status:** Not implemented.

### F-08 — Batch runner reports one result for multiple non-idempotent email sends

- **Priority:** P1
- **Feasibility:** Low
- **Evidence:** `automation-runner.service.ts:72-96` catches the whole execution and writes one aggregate log, while `:248-272` sends to recipients sequentially.
- **Why:** If recipient 1 succeeds and recipient 2 fails, the aggregate run is marked failed even though one message was delivered. Retrying the event can send recipient 1 again. There is no per-recipient state, idempotency key, or retry boundary.
- **Risk:** Duplicate emails, incomplete delivery with no precise diagnosis, and long-running event handlers that are difficult to retry safely.
- **Better pattern:** Use the existing outbox/queue conventions for durable email commands, create a run/event ID, persist per-recipient attempts, and make sends idempotent where the provider supports it. Keep the HTTP/event handler focused on validation, claiming, and enqueueing.
- **Status:** Not implemented.

### F-09 — Custom template rendering drops tenant branding and plain-text content

- **Priority:** P1
- **Feasibility:** Medium
- **Evidence:** `apps/api/src/automations/automation-runner/automation-template.service.ts:37-44` passes `primaryColor: ""`; `automation-runner.service.ts:249-265` sends `text: renderedSubject` and the rendered HTML as the body.
- **Why:** The automation path does not resolve the tenant's branding before rendering, while the email-template preview/test path does. The plain-text part is the subject rather than a text representation of the message.
- **Risk:** Tenant emails can lose their visual identity, render invalid styles, and be inaccessible or unusable for clients that prefer plain text.
- **Better pattern:** Centralize tenant-aware rendering and logo resolution in the email-template service, use the recipient tenant for every render, and generate a real text fallback from the rendered content. Add a send-path test for branding, language, logo attachment, subject, HTML, and text.
- **Status:** Not implemented.

### F-10 — Inactivity recipients omit `userId`, so language resolution falls back to English

- **Priority:** P1
- **Feasibility:** High
- **Evidence:** `apps/api/src/automations/automation-runner/automation-data-resolver.service.ts:268-305` returns email, tenant, and variables but not `userId`. `automation-runner.service.ts:274-277` uses `recipient.userId` to resolve `user_default` language.
- **Why:** `InactiveUser` events contain the user ID, but the resolver discards it.
- **Risk:** Users with Polish or another supported preference can receive the wrong template language for short/long inactivity automations.
- **Better pattern:** Preserve `userId` in every recipient resolver and add one test per inactivity event proving the selected localized template follows the user's preference.
- **Status:** Not implemented.

### F-11 — Navigation hides automation from automation-only administrators

- **Priority:** P1
- **Feasibility:** High
- **Evidence:** `apps/web/app/config/navigationConfig.ts:158-165` does not include `PERMISSIONS.AUTOMATION_MANAGE` in the Manage group requirement.
- **Why:** The API and route contract introduce a dedicated automation permission, but the navigation group still requires unrelated management permissions.
- **Risk:** A correctly authorized automation administrator cannot discover or open the feature through normal navigation.
- **Better pattern:** Add `AUTOMATION_MANAGE` to the group requirement and add a permission-focused navigation test. Keep the route and API requirements aligned with F-02.
- **Status:** Not implemented.

### F-12 — Turning Active off changes the automation to Draft instead of Disabled

- **Priority:** P1
- **Feasibility:** High
- **Evidence:** `apps/web/app/modules/Admin/Automation/Builder/hooks/useBuilderHeaderActions.ts:106-115` maps `active === false` to status `draft`, even though the backend status set includes `disabled`.
- **Why:** A pause action has different semantics from reverting a workflow to an unvalidated draft.
- **Risk:** Operators cannot temporarily pause a valid automation without losing its active lifecycle state or being forced through simulation again. The UI's “Active/Draft” language disagrees with the backend's enabled/disabled/archived/draft model.
- **Better pattern:** Use `disabled` for an intentional pause, reserve `draft` for incomplete/unvalidated configuration, and make the transition rules explicit in the API. Confirm destructive lifecycle changes and show the current state consistently in list, drawer, builder, and logs.
- **Status:** Not implemented.

### F-13 — Default seeding is N+1, race-prone, and hides failures as skips

- **Priority:** P1
- **Feasibility:** Medium
- **Evidence:** `apps/api/src/automations/automations-seed-defaults.service.ts:288-321` loads all automations and then steps one automation at a time, checks triggers in memory, and counts creation errors as `skipped`.
- **Why:** Concurrent seed requests can both observe a missing trigger and create duplicates. A real creation failure is indistinguishable from an intentional existing-trigger skip.
- **Risk:** Duplicate default workflows, extra database load for large tenants, and misleading operational results.
- **Better pattern:** Add a tenant-scoped uniqueness strategy for default trigger types, use a transaction or idempotent upsert, batch the trigger query, and return separate `created`, `alreadyExists`, and `failed` results.
- **Status:** Not implemented.

### F-14 — Localized announcement content is selected arbitrarily

- **Priority:** P1
- **Feasibility:** Medium
- **Evidence:** `apps/api/src/automations/automation-runner/automation-data-resolver.service.ts:503-515` selects `Object.values(...)[0]` for title and content.
- **Why:** Object order is not a recipient-language policy. The resolver does not use the recipient's supported language or the repository's localization helper.
- **Risk:** Recipients can receive an arbitrary locale, and the selected language can change as JSONB keys are written in a different order.
- **Better pattern:** Resolve localized values using the recipient's language with the existing localization service, define a documented fallback chain, and test all supported languages plus fallback.
- **Status:** Not implemented.

### F-15 — Trigger lookup uses `LIKE` instead of an exact event match

- **Priority:** P2
- **Feasibility:** High
- **Evidence:** `apps/api/src/automations/repositories/automation-steps/automation-steps.repository.ts:91-101` uses JSONB `->> 'name' LIKE triggerName`.
- **Why:** Event names are identifiers, not patterns. A pattern-like value can match unintended triggers.
- **Risk:** The wrong automations can run for an event, especially as event names grow or contain shared prefixes.
- **Better pattern:** Use an exact equality predicate, centralize the event-name enum/map, and validate trigger names when steps are saved.
- **Status:** Not implemented.

### F-16 — Debug output and unchecked update results remain in production paths

- **Priority:** P2
- **Feasibility:** High
- **Evidence:** `automation-runner.service.ts:63` and `:137` contain `console.log`; the catch at `:74` uses `error: any`. The automation repository update methods assume an updated row exists.
- **Why:** Production paths should use the structured Nest logger and typed unknown-error handling. Repository update/delete no-row cases should become explicit domain errors, not later property access failures.
- **Risk:** Noisy logs, missing context, and misleading 500s for stale/deleted automation IDs.
- **Better pattern:** Remove debug logs, use structured logger metadata, narrow unknown errors, and return `NotFoundException`/domain errors when an update affects no row. Rename `GetByAutomationId` and `ReplaceAutomationStepTree` to repository-native camelCase while touching the code.
- **Status:** Not implemented.

### F-17 — Validation and simulation rules are duplicated across backend and frontend

- **Priority:** P2
- **Feasibility:** Medium
- **Evidence:** Server simulation/validation lives in `apps/api/src/automations/automation-runner`; UI rules are duplicated in `apps/web/app/modules/Admin/Automation/Builder/hooks/useSimulationValidation.ts` and builder components.
- **Why:** The UI can say a graph is valid while the server rejects it, or the server can change a rule without updating the builder.
- **Risk:** Confusing activation failures and drift in supported node/action configuration.
- **Better pattern:** Make the server contract authoritative, share only stable types/constants through the shared package, and return structured validation errors that the builder can map to nodes. Keep frontend validation as fast feedback, not authorization.
- **Status:** Not implemented.

### F-18 — Test coverage does not cover the production automation path

- **Priority:** P1
- **Feasibility:** Medium
- **Evidence:** The PR adds unit/controller tests and frontend automation flows, but no focused API E2E covering trigger -> resolver -> runner -> email, tenant isolation, permission failure, migration fresh/upgrade, empty trees, custom branding, or recipient locale. The PR metadata also reports E2E as skipped.
- **Why:** The highest-risk behavior is cross-module and transactional; unit tests alone do not prove the deployed contract.
- **Risk:** The issues above can pass isolated tests and fail only when an event, tenant context, database migration, email renderer, and UI permission are combined.
- **Better pattern:** Add narrow API E2E scenarios using existing factories/Mailhog: permission denial, cross-tenant/cross-automation parent rejection, valid activation, disabled behavior, localized custom template delivery, partial recipient failure/retry, and fresh/upgrade migration checks. Add web E2E for permission-based navigation, save failure recovery, and active/disabled UX.
- **Status:** Not implemented.

## Maintainability and cleanup feedback

These are not merge blockers individually, but should be addressed while the affected areas are being stabilized:

- `apps/api/src/automations/automations-steps/automations-steps.service.ts:98-109` contains `deletePreviousTree`, and `:182-204` contains `validateTree`; review whether these are dead or incomplete validation paths and remove or integrate them.
- The duplicate `apps/api/src/courses/public-course-thumbnail.*` and `apps/api/src/public-course-thumbnail/*` implementations should be reduced to one module. The courses version is the one imported by the app module; the other appears unreferenced.
- Keep `tenantId` out of client-facing `AutomationRecordInput` if it is derived from the authenticated tenant. Use a separate internal seed/service input if the seed path needs it.
- Normalize trigger/event constants and avoid circular type-to-runtime imports around `AutomationEventNames` and `AutomationEventTypes`.
- Replace serial per-recipient user lookups in high-volume resolvers with existing batch repository methods where possible.
- The PR adds CRLF content in at least `automation-data-resolver.service.ts`; the full diff has 20,444 `git diff --check` findings. Normalize changed text files and rerun lint/format checks without reformatting unrelated files.

## UI/UX review

### U-01 — Save state and recovery are unclear

The builder appears to combine explicit save, autosave, simulation, and navigation, but the save-and-leave path does not await the mutation. Show a persistent `Saving…`, `Saved`, and `Save failed — retry` state; disable or defer navigation while a save is pending; and retain unsaved changes when the request fails. Autosave should not produce a success toast on every keystroke.

### U-02 — Activation lifecycle needs one vocabulary

The frontend uses “Active/Draft”, the backend has enabled/disabled/archived/draft, and the toggle maps off to draft. Use one user-facing state model with explicit “Pause/Disable” semantics and explain why activation is unavailable when a simulation is required.

### U-03 — Create should lead to a useful next action

`AutomationPage:44-50` creates a draft but leaves the user on the list. Return the created ID and navigate to its builder, or provide an explicit “Open builder” action in the success state. A newly created empty draft should not look like a silently completed workflow.

### U-04 — Autosave can lose the last edit and race requests

The drawer autosave behavior should flush on close/unmount, serialize mutations, and expose pending/error state. Otherwise a fast close or two quick edits can leave the server behind the UI.

### U-05 — Localized editing can overwrite other languages

The drawer sends only the current language while the repository appears to replace the localized JSONB object. Preserve existing locale keys with a server-side merge or make the locale scope explicit before saving.

### U-06 — Large action modal needs responsive and accessible behavior

`apps/web/app/modules/Admin/Automation/Builder/components/EditActionModal.tsx:129-148` uses a 90% viewport modal with two fixed half-width columns. Stack the columns at narrow widths, keep the footer/actions visible, and provide keyboard-accessible alternatives for graph editing and adding nodes.

### U-07 — List and logs need server-side scale controls

The list and logs are filtered client-side after loading all records. Add backend pagination and filters for status, automation, event, and date; preserve the current filter in the URL; and show an explicit “no matching results” state. This is important before automation logs grow in production.

### U-08 — Builder visual tokens and error placement

Avoid hard-coded connector colors such as `colors.black`; use theme tokens with dark-mode contrast. Put node validation errors next to the affected node/action and provide a summary before activation so users do not need to infer why the toggle is disabled.

## Review conclusion

The feature direction is viable, and the UI has a reasonable foundation of builder, simulation, template, and log surfaces. The current implementation is not ready to merge because the deployable migration chain and several authoritative backend contracts are incomplete or inconsistent with the web application. Resolve F-01 through F-05 first, then F-06 through F-18 and the UI items in the order listed, rebase against `staging`, and rerun the focused API/web checks plus migration validation.
