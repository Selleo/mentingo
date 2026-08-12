# Email Template Builder Test Plan

## Current Coverage Summary

The email template builder has useful unit coverage, but it does not have full automated coverage.

Covered today:

- Backend email notification template service behavior, including locale validation, name conflicts, auto-naming, duplication, preview rendering, test sends, update/delete image cleanup, orphan image purge, and status transitions.
- Backend image upload controller E2E behavior for authentication, permission checks, successful image upload, oversized files, and invalid file types.
- Frontend builder editor unit behavior for image upload handling, base-language edits, translation-mode edits, inline diagnostics, diagnostic anchoring, string extraction, language flattening, logo handling, and structural base-content restoration.

Not covered today:

- Main email notification template API controller E2E flows for list, create, update, delete, publish, archive, unarchive, preview, test-send, and duplicate.
- Full frontend page behavior for the email template list and edit builder pages, including the dirty-navigation guard.
- Browser-level Playwright coverage for the real administrator builder workflow.
- Automated tests in the `@repo/email-templates` package itself; it currently has generated HTML fixtures but no package-level test script.

## Goals

- Add API E2E tests for all externally exposed email notification template endpoints.
- Add frontend component/page tests around the list and edit-builder workflow orchestration.
- Add one high-value Playwright E2E scenario that exercises the real UI and API integration.
- Optionally add automated smoke coverage for the standalone React email template package.

## API E2E Coverage

Add a new E2E spec for `EmailNotificationTemplatesController`.

Target routes:

- `GET /api/email-notification-templates`
- `POST /api/email-notification-templates`
- `GET /api/email-notification-templates/:id`
- `PATCH /api/email-notification-templates/:id`
- `DELETE /api/email-notification-templates/:id`
- `DELETE /api/email-notification-templates/bulk`
- `POST /api/email-notification-templates/:id/publish`
- `POST /api/email-notification-templates/:id/make-draft`
- `POST /api/email-notification-templates/:id/archive`
- `POST /api/email-notification-templates/:id/unarchive`
- `POST /api/email-notification-templates/:id/preview`
- `POST /api/email-notification-templates/:id/test-send`
- `POST /api/email-notification-templates/:id/duplicate`

Required assertions:

- Unauthenticated requests return `401`.
- Users without `PERMISSIONS.EMAIL_TEMPLATE_MANAGE` return `403`.
- Authorized admins can create, list, fetch, update, duplicate, delete, and bulk-delete templates.
- Status transition endpoints move templates to the expected status.
- Publishing is blocked when diagnostics contain blocking errors.
- Preview returns rendered `subject`, `html`, and resolved `language`.
- Test-send sends to the current user through the test email adapter.
- Cross-tenant access is blocked by tenant scoping.
- Responses use `BaseResponse` or `PaginatedResponse` shapes.

## Backend Unit Coverage

Keep existing service and utility tests, then add missing unit coverage only where E2E would be too heavy.

Recommended additions:

- Controller-level tests are not required if the E2E spec covers route validation, permissions, response wrappers, and delegation.
- Add unit tests only for any uncovered helper extracted during E2E setup.
- Add a cleanup queue/worker unit test if the worker behavior is not indirectly covered by service tests.
- Keep regression coverage for malformed public image references, published-template update blocking, status transition guards, and the update cleanup race.

## Frontend List Page Coverage

Add component tests for `EmailTemplates.page.tsx`.

Required assertions:

- Loading state renders while templates are loading.
- Error state renders when the list query fails.
- Empty state renders when the API returns no templates.
- Template rows render with expected names/statuses.
- Name and status filters update query parameters and reset pagination.
- Pagination controls update page/per-page state.
- Create button calls the create mutation with the current UI language and navigates to the edit page.
- Row click navigates to the edit page.
- Single selected row calls the single-delete mutation.
- Multiple selected rows call the bulk-delete mutation.

## Frontend Edit Builder Page Coverage

Add component tests for `EditEmailTemplate.page.tsx`.

Required assertions:

- Loading and load-failed states render correctly.
- Save calls the update mutation with current `name`, `subject`, `blocks`, `strings`, `baseLanguage`, and `availableLocales`.
- Save is blocked for published templates when blocking diagnostics exist.
- Publish is blocked when blocking diagnostics exist.
- Publish, make-draft, archive, and unarchive call the correct mutation for each target status.
- Dirty form state is saved before a status change.
- Duplicate calls the duplicate mutation and navigates to the duplicated template.
- Send test email saves a dirty form before calling the test-send mutation.
- Dirty navigation opens the discard confirmation and browser unloads expose the native warning.
- Inline rename commits on Enter and cancels on Escape/blur.
- Adding a language updates `availableLocales` and initializes `strings[language]`.
- Removing a language removes it from `availableLocales` and deletes `strings[language]`.
- Setting a new base language uses `swapBaseLanguageContent`.
- Subject edits write to the selected language.

## Existing Frontend Builder Unit Coverage To Preserve

Keep the current tests around:

- `EmailTemplateEditor` upload and editor-update behavior.
- Inline diagnostics and diagnostic anchor measurement.
- `extractStringsFromDoc`.
- `flattenForLanguage`.
- `applyStructuralChangesToBase`.
- `swapBaseLanguageContent`.
- `logoHeader`.
- Tiptap extensions for variable highlighting and UUID handling.

When adding new behavior to the builder canvas, prefer focused unit tests around the smallest changed utility or editor callback before adding broad page tests.

## Playwright E2E Coverage

Add one high-value browser scenario for the administrator workflow.

Scenario:

1. Log in as an admin with `EMAIL_TEMPLATE_MANAGE`.
2. Open the email templates list.
3. Create a new template.
4. Rename it.
5. Edit the base-language subject and body.
6. Add a second language.
7. Verify diagnostics appear for missing or unchanged translation content.
8. Fill the translated subject/body enough to clear blocking errors.
9. Save the template.
10. Send a test email.
11. Publish the template.
12. Assert the final status is published in the UI and via API-backed state.

Use existing E2E factories, fixtures, selectors, and cleanup patterns. Add stable `data-testid` handles where the builder currently lacks reliable selectors.

## `@repo/email-templates` Package Coverage

The package currently has snapshot fixtures but no test script. Add a small package-level smoke test only if the team wants automated guardrails around the rendered React email exports.

Recommended smoke checks:

- Every exported template used by the fixture generator is exported.
- Rendering each template with fixed sample props returns non-empty HTML.
- The rendered HTML contains the expected subject/body anchor text for the sample case.
- No template throws during render.

Avoid asserting large HTML snapshots unless they are intentionally maintained as a regression baseline.

## Suggested Implementation Order

1. Add API E2E coverage for create/list/get/update/delete/publish.
2. Add API E2E coverage for preview/test-send/duplicate/archive/unarchive/bulk-delete.
3. Add list page component tests.
4. Add edit builder page component tests.
5. Add missing stable E2E selectors.
6. Add the Playwright administrator workflow.
7. Decide whether to add package-level smoke tests for `@repo/email-templates`.

## Validation Commands

Run focused commands after each group of changes:

```sh
pnpm --filter=api test -- email-notification-templates
pnpm --filter=api test:e2e -- email-template
pnpm --filter=web test -- EmailTemplates
pnpm --filter=web test -- EmailTemplateEditor
```

Run broader checks before merging:

```sh
pnpm lint-tsc-api
pnpm lint-tsc-web
pnpm --filter=web test:e2e -- email-template
```

If package-level smoke tests are added:

```sh
pnpm --filter @repo/email-templates build
pnpm --filter @repo/email-templates test
```
