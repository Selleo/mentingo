# PR #1804 Feedback

## Review scope

- Repository: `Selleo/mentingo`
- Pull request: [#1804](https://github.com/Selleo/mentingo/pull/1804)
- Base: `staging` at `fdf21162658ba781ccfb938c9a30b2f59e45302b`
- Reviewed head: `83c0b63ec`
- Worktree: `/Users/jherma/WebstormProjects/mentingo-pr-1804`
- Feature: Maily-based email notification template authoring, localization, rendering, image upload, cleanup, and admin UI
- Recommendation: **Request changes**

The PR is currently marked `CHANGES_REQUESTED` and conflicts with `staging`. GitHub reports successful lint/build/unit and backend E2E checks for the latest visible run, but the test plan in this PR explicitly identifies missing controller E2E, full page, and real builder workflow coverage. Green checks do not close the findings below.

## How feedback is currently given on comparable PRs

The existing PR feedback is mostly inline and line-anchored. It is strongest when it points to a repository-native pattern, for example:

- reuse the existing validation pipe and file-type detection;
- keep tenant access in the tenant runner rather than using `DB_ADMIN`;
- move business logic from repositories into services;
- remove avoidable type assertions through schema typing;
- use explicit dependency versions;
- simplify local control flow.

The current review also shows weaknesses that this document intentionally corrects:

- comments use no severity or merge-blocking priority;
- several comments are fragments such as `Same as above` or `.` and require surrounding context;
- the review does not consistently state the user-visible or operational consequence;
- cross-cutting concerns such as API authority, tenant isolation, cleanup races, and product wiring are easy to miss when reviewing one line at a time;
- UI/UX and test-coverage risk are not separated from code-style feedback;
- a partial review is marked `CHANGES_REQUESTED` without a clear closure checklist.

For this review, each finding has an impact, feasibility, reason for the feedback, failure mode, preferred pattern, and implementation status. A finding is blocking when the code can violate a backend invariant, corrupt user-visible state, or make the feature materially unusable.

## Finding summary

| ID | Severity | Feasibility of fix | Area | Status |
| --- | --- | --- | --- | --- |
| F-001 | High | High | Published-template API invariant | Implemented |
| F-002 | High | Medium | Image cleanup race | Implemented |
| F-003 | Medium | High | Public image URL robustness | Implemented |
| F-004 | Medium | Medium | Runtime payload validation and bounds | Implemented |
| F-005 | Medium, scope-dependent | Low to Medium | No runtime notification consumer | Resolved as authoring-only |
| F-006 | Medium | High | Mobile and unsaved-edit UX | Implemented |
| F-007 | Low to Medium | Medium | Cleanup durability | Partially implemented: synchronous fallback; durable reconciliation remains |
| F-008 | Medium | High | Status transition state machine | Implemented |
| F-009 | Medium | High | Missing end-to-end coverage | Partially implemented: focused regressions; controller/browser gaps remain |

## Independent findings

### F-001: Published templates can be made invalid through the API

- Severity: **High, blocking**
- Feasibility: **High**
- Evidence: `apps/api/src/email-notification-templates/email-templates.service.ts:125-173` validates URL safety but does not call `assertPublishable` when updating a template. Publishing separately calls it at `:178-190`.
- Why this feedback: the business spec says blocking diagnostics continue to block save/publish flows for published templates, but the current rule is enforced only by `EditEmailTemplate.page.tsx:179-188`. The backend must be authoritative because callers can bypass the web UI, requests can race, and generated API clients are not a security boundary.
- Problem: a direct `PATCH` can add a missing subject, footer, logo, untranslated content, or other diagnostic error to a template whose status is already `published`. A stale or custom client can therefore persist a published template that the UI would reject. If runtime delivery is wired later, the invalid template can fail at send time or deliver incomplete mail.
- Better pattern: either make published templates immutable until moved to draft, or compute diagnostics for the candidate update on the API and reject blocking errors whenever `existing.status === published`. Keep the same rule in the UI as an early feedback path, not as the enforcement layer.
- Acceptance criteria: API tests cover invalid updates to published templates, valid updates, direct callers that omit the UI flow, and concurrent status/update behavior.

### F-002: Image cleanup can delete an image re-added to the current template

- Severity: **High, blocking**
- Feasibility: **Medium**
- Evidence: updates compute removed sources at `apps/api/src/email-notification-templates/email-templates.service.ts:155-173`, enqueue cleanup with `excludeTemplateId`, and the worker excludes that template again through `:482-505` and `:552-566`.
- Why this feedback: cleanup runs asynchronously after the database mutation, so the worker observes a later state than the update that produced the job. The current-template exclusion is unsafe for update jobs.
- Problem: update a template from image A to image B, then quickly back to image A. The first cleanup job runs after the second update, intentionally skips the current template, sees no other reference to A, and deletes A from storage even though the current template references it. The saved email then contains a broken image. The same race can occur with retries and multiple browser tabs.
- Better pattern: for update cleanup, inspect all current tenant templates, including the updated template. The old source is already removed by the committed update, so excluding the current row is unnecessary. Keep the tenant-prefix validation and add an interleaving test that re-adds an image before the worker executes. A versioned cleanup job or a transactional outbox can further protect against stale jobs.
- Acceptance criteria: a stale cleanup job never deletes a key referenced by any current template in the tenant; delete cleanup remains safe; duplicate references are handled idempotently.

### F-003: Malformed public image references can become 500 responses

- Severity: **Medium**
- Feasibility: **High**
- Evidence: `apps/api/src/public-email-template-image/public-email-template-image.service.ts:12-18` calls `decodeURIComponent(reference)` without handling `URIError`; the public controller invokes it directly at `:23-29`.
- Why this feedback: this is a public endpoint and the route parameter is attacker-controlled. Invalid percent encoding is normal hostile input, not an exceptional internal state.
- Problem: a request such as a malformed encoded reference can escape the intended placeholder response and become an internal server error. Besides noisy logs, this makes broken links less resilient and can expose an unstable public endpoint to cheap error traffic.
- Better pattern: catch decode failures and return `null`, then use the existing placeholder response. Validate the decoded key with the same exact tenant/category contract used by cleanup. Add malformed-encoding and traversal-shaped input tests.
- Acceptance criteria: malformed, empty, wrong-tenant, and wrong-category references return the placeholder with a normal cache policy and never throw.

### F-004: Backend template JSON is structurally too permissive and unbounded

- Severity: **Medium**
- Feasibility: **Medium**
- Evidence: `apps/api/src/email-notification-templates/schemas/emailNotificationTemplate.schema.ts:13-46` accepts recursive nodes with arbitrary attributes, arbitrary node types, `Type.Any()` values, and no depth, node-count, or serialized-size limits. Rendering occurs through Maily at `apps/api/src/email-notification-templates/utils/renderTemplateContent.ts:41-69`.
- Why this feedback: frontend Zod typing and TypeScript assertions do not protect the API. The API is the persistence and rendering boundary for a large recursive document.
- Problem: malformed or excessively large JSON can be stored and later cause render failures, slow preview/test-send requests, oversized emails, or disproportionate memory/CPU use. The current schema validates the broad container shape but does not guarantee a renderable Maily document.
- Better pattern: define the supported node/attribute union as far as Maily allows, reject unknown dangerous structures, and enforce bounded depth, node count, text length, and total payload size. Normalize or validate the document once in the service before persistence and rendering.
- Acceptance criteria: invalid node shapes fail with a 400, bounded large documents are accepted intentionally, oversized/deep documents are rejected consistently by create and update, and render failures are translated into safe API errors.

### F-005: Published templates have no runtime notification consumer

- Severity: **Medium, scope-dependent**
- Feasibility: **Low to Medium**
- Evidence: repository search finds `EmailNotificationTemplatesService` consumers only in its own module and admin API path. Existing notification handlers still instantiate static package templates, for example `apps/api/src/certificates/handlers/certificate-email.handler.ts:58-64`, `apps/api/src/courses/handlers/course-due-date-reminder-email.handler.ts:61-68`, and `apps/api/src/course-chat/handlers/course-chat-mention-email.handler.ts:109-121`.
- Why this feedback: the business spec says administrators control messages Mentingo sends, while the PR body describes customization opportunities through an automation engine. In the current head, publication changes only CRUD state; it does not change any notification delivery path.
- Problem: an administrator can spend time building, publishing, and test-sending a template while learner-facing notifications continue using the old React email templates. The `published` state can imply activation when it is currently only an authoring state.
- Better pattern: if this PR is intentionally authoring-only, state that boundary explicitly in the product/API contract and use a status name or UI copy that does not imply activation. If live customization is in scope, add an explicit notification key/trigger binding, variable contract, tenant-scoped lookup, language fallback, render failure fallback, and delivery tests. Do not make handlers infer a template from a display name.
- Acceptance criteria: the team makes an explicit scope decision; either a published template is demonstrably consumed by a defined notification trigger, or the UI/spec clearly says publication is preparation for a later automation integration.

### F-006: The editor has narrow-screen overflow and no unsaved-navigation protection

- Severity: **Medium**
- Feasibility: **High**
- Evidence: the editor shell and action bar are fixed at `apps/web/app/modules/Admin/EmailTemplates/EditEmailTemplate.page.tsx:327-415`; the status control is fixed at `w-[160px]` and the action group has no wrapping behavior. The page has explicit save/status actions but no dirty-navigation guard around the page breadcrumb or route changes.
- Why this feedback: email authoring is a long-form editing workflow, so accidental loss and inaccessible actions are product failures, not cosmetic issues. The source-based review did not use a browser viewport, so this is a responsive-risk finding that needs a focused visual check.
- Problem: on narrow screens, the name, duplicate button, status select, and save button can compete for one row and clip or overflow. A user can also edit content, click away through the breadcrumb/list route, and lose unsaved changes because the page does not prompt or preserve a draft.
- Better pattern: make the toolbar wrap or move actions into a responsive overflow/action row; keep Save visible and accessible. Add a dirty-navigation blocker, or explicitly autosave drafts if the product chooses that model. Preserve the current explicit save behavior rather than silently changing it.
- Acceptance criteria: the full toolbar is usable at mobile widths, keyboard focus remains visible, dirty route changes warn or preserve edits, and a focused Playwright/mobile test covers both paths.

### F-007: Cleanup enqueue failure creates permanent storage orphans

- Severity: **Low to Medium**
- Feasibility: **Medium**
- Evidence: `apps/api/src/email-notification-templates/email-templates.service.ts:464-479` catches queue-enqueue errors, logs a warning, and returns success for the mutation. The tests intentionally codify this behavior at `apps/api/src/email-notification-templates/__tests__/email-notification-templates.service.spec.ts:702-761`.
- Why this feedback: keeping the database mutation successful during a Redis outage is reasonable, but swallowing the only cleanup trigger makes the storage lifecycle non-durable.
- Problem: every delete/update performed while Redis is unavailable leaves potentially large uploaded files behind with no guaranteed retry. Over time this creates cost and storage clutter, and the warning may not be monitored.
- Better pattern: publish a durable outbox event in the same transaction as the template change, or add a scheduled reconciliation job that enumerates unreferenced tenant image keys. Keep queue retries for transient processing failures, but do not rely on a best-effort enqueue as the only source of truth.
- Acceptance criteria: a temporary Redis outage does not permanently orphan uploaded files, and cleanup remains idempotent.

### F-008: The API permits archived-to-published transitions

- Severity: **Medium**
- Feasibility: **High**
- Evidence: `apps/api/src/email-notification-templates/email-templates.service.ts:178-200` publishes after loading the template but does not restrict the current status. The UI status selector can call publish for any selected next status at `apps/web/app/modules/Admin/EmailTemplates/EditEmailTemplate.page.tsx:193-219`.
- Why this feedback: the documented lifecycle distinguishes archived templates from restored drafts. State transitions should be authoritative on the API, not inferred from the current UI options.
- Problem: a client can publish an archived template directly, bypassing the intended review/edit step and making the `unarchive` endpoint unnecessary for that path. This becomes more consequential if published templates later drive live notifications.
- Better pattern: define and enforce an explicit transition matrix, for example `draft -> published`, `published -> draft|archived`, and `archived -> draft`; reject invalid transitions with a conflict response. If direct archived publication is intentional, document it and test it instead.
- Acceptance criteria: every allowed and rejected transition is covered at the service/API level and the UI presents only valid next states.

### F-009: The strongest workflow paths are still untested end to end

- Severity: **Medium**
- Feasibility: **High**
- Evidence: `docs/test-plans/email-template-builder-test-plan.md:13-18` explicitly lists missing main-controller E2E, full page behavior, browser-level builder coverage, and package tests. The current Playwright scenario at `apps/web/e2e/specs/admin/email-template-builder.spec.ts:11-72` covers basic create, rename, subject save, reload, list visibility, and delete only.
- Why this feedback: the feature crosses generated contracts, tenant/RLS access, multipart upload, rendering, localization, queue cleanup, and responsive UI. Unit tests cannot prove the integrated behavior.
- Problem: regressions in authorization, response wrappers, cross-tenant access, publish blocking, test-send, image delivery, language changes, and status transitions can merge while the basic CRUD scenario remains green.
- Better pattern: implement the test plan in priority order, starting with controller E2E for auth/tenant/status/preview/test-send and one real Playwright workflow covering a second language, publish, and test-send. Add the cleanup race and malformed public-reference cases as focused backend tests.
- Acceptance criteria: the missing test-plan items are either implemented or explicitly deferred with an owner and issue; deferred coverage must not be described as complete.

## Existing feedback status observed on the PR

The current head appears to include some earlier review requests, but the review history does not provide a clear closure matrix:

| Existing feedback theme | Current observation | Status |
| --- | --- | --- |
| Chain the Cheerio selectors and perform one final length check | `renderTemplateContent.ts:100-117` uses the chained form | Implemented in current head |
| Use explicit versions for newly added API dependencies | Newly added API dependencies are pinned in `apps/api/package.json` | Implemented for API additions |
| Await the async email rendering path | Announcement rendering awaits `buildEmail` at `announcement-email.handler.ts:67-81` | Implemented in current head |
| Reuse validation/file-type conventions | Image upload uses the existing base file-type pipe at `email-template-image.controller.ts:59-66` | Implemented in current head |
| Move all repository/business logic and remove all assertions | Repository/service still contain the split and broad recursive JSON assertions by design | Partially addressed; needs a deliberate architecture decision |
| Avoid `DB_ADMIN` for tenant-scoped work | The public image path uses tenant resolution and the cleanup worker uses `runWithTenant`; comparable public thumbnail feedback still needs explicit closure | Needs confirmation |
| Add complete controller/page/E2E coverage | The PR test plan still lists these as missing | Not implemented |

“Implemented” here means the requested shape is visible in the current PR head; it does not mean I reran the relevant test or CI command.

## Review conclusion

F-001 through F-006 and F-008 are implemented in this worktree. F-005 is explicitly authoring-only because the PR has no trigger-binding contract. F-007 has a synchronous fallback but still benefits from durable reconciliation, and F-009 has focused regression coverage while the broader controller/browser matrix remains open.

## Validation limits

- No local tests, typechecks, builds, browser runs, migrations, commits, pushes, or GitHub review comments were performed.
- The source review used the PR head and the existing GitHub review/check metadata.
- `git diff --check` was run once during inspection; generated artifacts report trailing-whitespace noise from their generated line endings. This was not treated as a semantic validation result.
