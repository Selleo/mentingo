# PR #1797 feedback audit

Target: `pz_feat_1714_add_dashboard` in `/Users/jherma/WebstormProjects/mentingo-pz_feat_1714-review`

Base: `staging` at `fdf21162658ba781ccfb938c9a30b2f59e45302b`

Checked-out head: `82190035c` (`--wip-- [skip ci]`), six commits ahead of
`origin/pz_feat_1714_add_dashboard` (`9ec367172`). The primary checkout has an
unrelated modification to `apps/api/src/swagger/api-schema.json` and was left
untouched.

GitHub review snapshot: 39 inline threads; 31 current unresolved, 7 outdated,
and 1 resolved. Outdated comments were re-checked against the current code
before being classified. No GitHub comments or thread states will be changed.

## Feasibility scale

- **A — safe/local:** clear correctness or contained maintainability change with
  existing repository patterns.
- **B — feasible with focused tests:** useful change that crosses a small API,
  query, or shared-contract boundary.
- **C — needs design/clarification:** the requested change can alter behavior,
  migration history, or response shape and should not be guessed.
- **N/A — already handled or not actionable:** the current checkout already
  addresses it, the reviewer answered the concern, or repository rules make the
  requested action incorrect.

## Applied before this run

| Feedback                                                               | Current evidence                                                                                                | Feasibility | Status                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| Guard dashboard settings endpoints with `DASHBOARD_READ`               | `settings.controller.ts` has the permission decorator on both dashboard routes                                  | A           | Applied                                                     |
| Move the practice judge builder out of a service                       | `build-ai-practice-judge-configuration.ts` exists and the service is removed from the module                    | A           | Applied                                                     |
| Remove the obsolete dashboard migration and repair migration numbering | The checked-out branch carries the repaired 0181–0184 chain and no longer contains the obsolete 0175/0183 files | C           | Applied locally; migration execution still needs validation |
| Split the practice conversation UI                                     | Dedicated practice header/composer/messages/completion/replay-loader components exist                           | A           | Applied                                                     |
| Extract dashboard grid component/types and utilities                   | `SortableWidget`, `types.ts`, and `dashboardGrid.utils.ts` exist                                                | A           | Applied                                                     |
| Rename the widget registry to match its TypeScript contents            | Current file is `widgetRegistry.ts`                                                                             | A           | Applied                                                     |
| Avoid querying dashboard endpoints without an authenticated session    | Both dashboard widget query hooks use auth-store state in `enabled` and have no request-time try/catch          | A           | Applied                                                     |
| Remove the dashboard certificate non-null assertion                    | Current hook guards `currentUser?.id` with `enabled` and a runtime check                                        | A           | Applied                                                     |

## Current-thread disposition

All 31 current unresolved threads are accounted for below. The seven outdated
threads and one already-resolved thread were rechecked but are not reopened.

| Threads | Disposition              | Rank    | Evidence or reason                                                                                                                                                                                                                   |
| ------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 2    | Implemented              | A       | Settings now repairs missing legacy dashboard data, and both dashboard settings endpoints have the read guard.                                                                                                                       |
| 3–6     | Already handled          | A       | Widget queries are disabled without a session; the suspense paths translate the unauthenticated error. Adding request-time `try/catch` would duplicate query-library behavior.                                                       |
| 8–9     | Implemented              | A       | Grid refs are consolidated and the drag/reflow helpers have JSDoc; the reusable widget/types/util files already exist.                                                                                                               |
| 10–11   | Implemented              | A       | The registry uses the TypeScript filename and the practice roleplay SQL uses the shared AI mentor enum.                                                                                                                              |
| 12–14   | Implemented              | B       | Shared JSONB localization and AI Judge evaluation SQL utilities now serve practice and lesson reads; practice-specific joins remain in the practice repository. A SQL-shape regression test covers scalar and localized JSONB forms. |
| 15–17   | Implemented              | A       | The pure judge builder is a utility, ownership checks share one helper, and practice failure codes use a shared typed constant.                                                                                                      |
| 18      | Kept as-is               | N/A     | Practice instructions and lesson system prompts have different inputs and semantics.                                                                                                                                                 |
| 19–20   | Already handled          | N/A     | The next-lesson path already uses a bounded `selectDistinctOn` query, and the judge repository methods already return selected rows directly to their callers.                                                                       |
| 21–23   | Implemented              | A       | Repeated statistics status and deadline-risk literals now use shared constants/enums.                                                                                                                                                |
| 24–25   | Kept as-is               | N/A     | Obsolete dashboard migrations are absent; the current 0181–0184 journal chain is preserved.                                                                                                                                          |
| 26–27   | Kept as-is / implemented | N/A / A | The daily practice query rollover is required for date changes; the certificate hook no longer relies on a non-null assertion.                                                                                                       |
| 28–30   | Implemented              | A       | Evaluation status rendering is simplified, the lesson separator uses the existing token, and deadline-risk values use the shared enum.                                                                                               |
| 31      | Implemented              | B       | Dashboard calendar now accepts `view=all                                                                                                                                                                                             | upcoming`and`selectedDate`; `all`preserves month markers and selected-day events while`upcoming` applies the backend five-item limit. |

The generated prompt export comment (thread 7) is intentionally not applied:
the repository requires generated prompt files to be regenerated from source,
not removed or hand-edited.

## Implementation plan

Work through these in order. Checkboxes are updated as changes are made and
validated.

### 1. Safe correctness and consistency fixes — rank A

- [x] Make settings reads resilient when legacy JSON lacks `dashboard` or
      `dashboard.widgets`; preserve the canonical default layout and add focused
      coverage. The fallback is implemented; focused validation remains.
- [x] Dashboard widget query hooks already avoid unauthenticated requests and
      their suspense paths translate the unauthenticated error. No additional
      try/catch was added.
- [x] Replace repeated AI-practice ownership/status checks with a private helper
      and replace free-form practice error strings with a typed shared constant.
- [x] Use shared enums/constants for roleplay, deadline-risk values, and dashboard
      training statuses where the same values are repeated.
- [x] Remove one-use evaluation icon/title branches and confirm the remaining
      AI-mentor lesson feedback separator already uses the existing design token.
- [x] Add JSDoc to the non-obvious dashboard drag/reflow helpers and consolidate
      the grid refs into one object ref where this does not change drag behavior.
- [x] Search for and fix equivalent repeated patterns in the affected dashboard
      and AI-practice surfaces.

### 2. Focused query/repository improvements — rank B

- [x] Reuse the existing AI-mentor judgement query/building logic for practice
      rubrics where the schemas permit it; retain practice-specific source joins.
- [x] Remove redundant repository wrapping/normalization only where persisted
      JSONB and current callers prove it is safe, and add regression coverage for
      legacy rows.
- [ ] Replace the student next-lesson post-processing loop with a bounded Drizzle
      query-builder expression if the resulting query remains readable and keeps one
      lesson per course.
- [ ] Simplify the AI judge configuration repository return shape where callers
      do not need the first-row destructuring.

### 3. Behavior/API decisions — rank C or N/A

- [x] Keep separate welcome prompts unless source/tests show identical semantics:
      practice openings need learner instructions, while lesson welcomes need the
      generated system prompt. The current source uses distinct variables and
      inputs, so the separation is intentional.
- [x] Do not remove generated prompt exports: repository instructions require
      regenerating them from prompt sources.
- [x] Do not reintroduce obsolete migration files to satisfy outdated line
      comments; validate the repaired journal/snapshot chain instead.
- [x] Move the event-calendar five-item limit behind an explicit backend view
      contract. The `all` view preserves month markers and selected-day events;
      the `upcoming` view excludes the selected date and returns five events.
- [x] Do not change the resolved backend sorting comment unless validation shows
      that server normalization is harmful; sorting plus order normalization is a
      persistence invariant, not only presentation ordering.

## Validation record

- `pnpm install --offline --frozen-lockfile` — passed in the review worktree.
- `pnpm --filter=@repo/shared build` — passed.
- `pnpm --filter=@repo/prompts build` — passed; regenerated
  `packages/prompts/src/generated-prompts.ts` through the existing script.
- `pnpm --filter=@repo/email-templates build` — passed.
- `pnpm --filter=@repo/scorm-export-runtime build` — passed.
- `pnpm --filter=@repo/scorm-export-generator build` — passed.
- `pnpm --filter=api lint-tsc` — passed.
- `pnpm --filter=web lint-tsc` — passed.
- Focused API ESLint — passed.
- Focused web ESLint — passed.
- `pnpm --filter=api test -- --runInBand
src/ai/utils/__tests__/ai-judge-jsonb.sql.spec.ts
src/calendar/calendar.service.spec.ts` — passed (3 tests).
- `pnpm --filter=web test --
app/modules/Dashboard/Home/widgets/admin-event-calendar.test.tsx` — passed;
  the package script ran the full suite: 378 tests passed, 12 skipped.
- `pnpm --filter=api test -- --runInBand
src/ai/services/ai-practice.service.spec.ts` — passed (2 tests).
- Web Vitest command (the package script expanded it to the full suite) —
  passed: 378 tests passed, 12 skipped, 87 files passed, 2 skipped.
- Settings E2E — blocked by the test harness environment after database setup:
  missing JWT/SMTP configuration led to Nest dependency recursion and a stack
  overflow. It did not reach the assertions.
- Migration metadata inspection — the new 0181–0184 entries and snapshots are
  present, but the full historical chain has a pre-existing gap at
  `0056_snapshot.json` (`0056.prevId` points to the missing 0055 snapshot).
  This is outside the dashboard diff and was not rewritten destructively.
- `git diff --check` — passed after the final documentation update.
- API Swagger/client regeneration was attempted through the existing bootstrap
  path but was blocked by the review worktree's pre-existing Nest bootstrap
  failure (`JwtStrategy` receives an undefined `ConfigService`, then a queue
  worker fails during the test-module workaround). The source schema/controller
  is updated; generated API artifacts still need regeneration in a working API
  environment before merge.
