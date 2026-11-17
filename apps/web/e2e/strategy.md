# E2E Strategy

The playbook for writing and changing Playwright tests in `apps/web/e2e`. Agents and humans follow it the same way. If a rule here conflicts with an existing spec, the rule wins; fix the spec when you touch it.

## 1. What a test is

**One test = one user goal, verified where the user sees the result.**

- A test starts where the user starts (a page, a link, an email) and ends with the outcome the user cares about (the entity is listed, the learner can open the course, the login page hides the form).
- A step of a flow is not a test. Do not write separate tests for "opens the create page", "form is prefilled", "option is available in the selector", "request email is sent" when another test walks through that step on the way to its goal. Put the step's assertion into that test.
- Write a separate test only for a separate **rule**: validation, conflict, permission denial, a business variant (bulk vs single only if the UI path differs), an error state.
- One entity lifecycle (create → update → delete) is one test. Bulk actions on N items get one test, not one per N.
- A role/permission matrix is one parametrized test (`for (const role of …) test(...)`), not one file per role.

## 2. Before you write a test

1. Search for an existing test that already walks through the same steps:
   `rg -l "<flowName>|<HANDLE>" apps/web/e2e/specs`
2. If one exists, **extend it** with your assertion instead of adding a test.
3. If none exists, find the domain folder in `specs/<domain>/` and the file that matches the layout in §4.
4. Reuse flows (`flows/<domain>/`), factories (`factories/`) and handles (`data/<domain>/handles.ts`). Add to them rather than writing helpers in the spec.

## 3. Assertions

- **Every test asserts a user-visible outcome in the UI.** An API check alone is not enough.
- Backend state may be checked additionally with `expect.poll(...)` when writes settle asynchronously.
- **Settings and permissions are verified by their effect**, where the affected user sees it: toggle invite-only registration → the register page shows the invite-only screen; enable Q&A → the Q&A nav entry appears; enroll a group → a group member sees and opens the course. Model: `specs/settings/login-methods.spec.ts`.
- Upload tests assert the uploaded thing is shown/persisted, not just that the parent entity exists.
- Use retrying assertions (`await expect(locator)...`, `expect.poll`). Do not write `expect(await locator.textContent())`.
- Never make an assertion optional (`{ optional: true }` on toasts or similar). If it may not appear, it is not an assertion.
- Prefer existing assertion flows (e.g. `assertQuizLessonProgressFlow`, `assertCourseLessonProgressFlow`) over inline API polls.

## 4. File layout per domain

```txt
specs/<domain>/
  <entity>-lifecycle.spec.ts    create → update → delete through the UI
  <entity>-validation.spec.ts   invalid input, conflicts
  <entity>-access.spec.ts       role matrix and public/anonymous access
  <entity>-<variant>.spec.ts    separate business rules (bulk, import, archive, ...)
  <domain>.fixture.ts           optional domain fixture (see §7)
```

Tests that check test infrastructure (fixtures, helpers) do not live in `specs/<domain>/`.

## 5. Tenants, sessions and fixtures

Each Playwright worker gets its own tenant (`_getWorkerTenantWorkspace`). Tests inside one worker run one after another; workers run in parallel on different tenants.

| Need                                                                             | Use                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Signed-in user of a role in the worker tenant                                    | `withWorkerPage(role, async ({ page }) => …)`                                                        |
| Anonymous visitor (login, register, password recovery, magic link, public pages) | `createWorkspacePage()` — a fresh context with no session                                            |
| A dedicated tenant for one test (tenant scoping, settings you cannot restore)    | `createIsolatedWorkspace()` / `withIsolatedWorkerPage()`                                             |
| The default root tenant                                                          | `{ root: true }` option of `withWorkerPage` / `createWorkspacePage` — only when the feature needs it |

Rules:

- Run visitor flows as a visitor. Do not run them inside an admin session.
- Never log out or change the password of the worker's shared role accounts; create a dedicated user with a factory instead.
- Tenant-level settings changed by a test must be restored to their **original** value in `cleanup` (read it first). If restoring is not possible, use an isolated workspace.
- Never change settings in the root tenant (`root: true`); it is shared by all workers.
- `apiClient` and factories act as the user of the most recent `withWorkerPage` context. Switching roles re-syncs them; keep setup for a role inside that role's block.

## 6. Setup and cleanup

- Arrange data through factories (API), not through the UI, unless the UI step is what the test verifies.
- Register cleanup **immediately after** creating an entity, before any UI step or assertion that can fail.
- Prefer factory helpers that register their own cleanup (model: `createEmailTemplate` in `specs/email-templates/email-template.fixture.ts`).
- Use `cleanup.add`, never `try/finally`. Do not swallow cleanup errors with empty `catch`.
- Use unique values (`${prefix}-${Date.now()}`) for anything that must be unique.
- Shared constants (passwords, default names) live in `data/test-data/`, not in specs.

## 7. Where code lives

| Code                                    | Place                                                             |
| --------------------------------------- | ----------------------------------------------------------------- |
| Selectors                               | `data/<domain>/handles.ts` (`data-testid` values)                 |
| Static test data                        | `data/test-data/`                                                 |
| API setup/teardown                      | `factories/<entity>.factory.ts`                                   |
| Reusable UI action sequences            | `flows/<domain>/<action>.flow.ts`                                 |
| Reusable assertion sequences            | `flows/<domain>/assert-<thing>.flow.ts`                           |
| Network mocks                           | `flows/<domain>/mock-<thing>.flow.ts` (one harness per domain)    |
| Composite arrange used by several specs | domain fixture (`specs/<domain>/<domain>.fixture.ts`) or `utils/` |
| Business intent and assertions          | `specs/`                                                          |

Specs contain no helper functions, types or API wrappers. If you need one, put it in the right place above.

Flows perform UI actions with plain inputs. They do not create data, register cleanup or decide what the test asserts (assertion flows are the exception and are named `assert-*`).

## 8. Selectors and copy

- Use `page.getByTestId(HANDLES.X)`. Add a `data-testid` to the component and a handle to `data/<domain>/handles.ts` when one is missing.
- Do not use `getByText`, CSS/class/attribute locators, or `getByRole` with an English `name`. They break on copy changes and other locales.
- Do not pass string literals to `getByTestId`; use a handle (dynamic handles are functions: `HANDLES.item(id)`).
- Tests are locale-independent. Only `specs/i18n/` asserts translated copy.
- Exception: accessibility-focused assertions may use roles without names.

## 9. Mocks

Real backend by default. `page.route` is allowed only for:

- external providers that are not available in the test environment (LLM, Luma, LiveKit, Stripe),
- states that cannot be reached through the API (provider errors, slow responses),
- UI-contract suites (dashboard cards, reports UI) — each such happy path must also have **one real-data test**.

Mocks go through the domain's mock flow; specs do not call `page.route` directly. A spec that depends on real external credentials skips conditionally with a reason (`test.skip(!isConfigured, "requires OpenAI")`).

## 10. Skips and timeouts

- No unconditional `test.skip` / `test.fixme`. A broken test is fixed, deleted, or skipped with a linked issue in the reason string.
- No `waitForTimeout` and no waits that are sleeps in disguise (e.g. waiting for a TOTP window). Wait for a condition.
- `test.slow()` / `test.setTimeout` only for genuinely long flows, with a one-line comment why.

## 11. Lint

`apps/web/.eslintrc.cjs` has an override for `e2e/specs/**` that flags `getByText`, literal `getByTestId`, `getByRole` with `name`, direct `page.route` and unconditional `test.skip`/`test.fixme`. The rules are warnings while the existing suite is migrated; new and changed specs must have **zero** warnings.

## 12. Running

- All: `pnpm --filter=web test:e2e`
- One spec: `pnpm --filter=web test:e2e e2e/specs/<domain>/<file>.spec.ts --project=chromium`
- Run every spec you add or change before committing; when you merge or delete tests, run the spec that absorbed them.

## 13. Checklist before a PR

- [ ] I searched for an existing test with the same steps (§2) and extended it where possible.
- [ ] Each new test is a user goal or a separate rule, not a step (§1).
- [ ] Each test asserts a UI outcome; settings/permissions are verified by their effect (§3).
- [ ] Right session: worker page, visitor page, or isolated workspace; nothing changes the root tenant (§5).
- [ ] Cleanup is registered right after creation; changed settings are restored to original values (§6).
- [ ] No helpers in specs; selectors are handles; no copy; no direct mocks (§7–9).
- [ ] No unconditional skip, no sleeps (§10); zero lint warnings in changed specs (§11).
- [ ] Changed specs pass locally (§12).

## Reference

- Setup chain: `db.setup.ts` (migrations, seed) → `auth.setup.ts` (admin login, onboarding) → browser projects.
- Fixtures: `fixtures/test.fixture.ts` (public surface), `cleanup.fixture.ts`, `factory.fixture.ts`, `api.fixture.ts`.
- Timeouts: test 90s, expect 10s, action 15s, navigation 30s.
- Good examples: `settings/login-methods` (setting → visible effect), `gamification/leaderboards`, `curriculum/content-lesson-audio`, `curriculum/quiz-matching-questions` (asserts persisted type, scoring and pairs), `email-templates/*` (self-cleaning domain fixture), `learning-paths/learning-paths-test-helpers.ts` (`arrangeLearningPath`).
