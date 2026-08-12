# Issue 1872 — Apply Feedback From Deploy

## Summary

Resolve the production/staging feedback collected after the course-overview deploy. The work covers four related but separable areas:

1. Make unauthenticated navigation recovery safe during React rendering.
2. Rename the course-overview section to “What you’ll learn” and align its translations.
3. Keep inline course-overview edits visible through targeted TanStack Query cache updates.
4. Preserve base-language fallbacks for learners while showing the selected language’s actual value to course editors, including an intentionally empty learning-outcomes translation.

Implementation branch: `jh_fix_1872_apply_feedback_from_deploy`, based on `staging`.

## Product Decisions And Constraints

- Navigation history exists to return an unauthenticated user to the protected route they originally attempted after authentication/MFA.
- Zustand’s persisted `navigation-history` store is the single source of truth. Route loaders and effects may update it; React render functions may only read it.
- A course editor viewing a selected course language must see that language’s own value. If its learning outcomes are missing or stored as an empty array, the editor sees an empty list and can clear/save it.
- A learner or preview experience continues to receive the existing base-language fallback when the selected course-language outcomes are missing or empty.
- Course-content language and UI language remain separate: learning-outcome text comes from the selected course language, while labels, buttons, empty states, and accessibility text come from the user’s UI locale.
- Inline overview saves must update the currently visible course query without waiting for a broad refetch. Related list/statistics caches may still be invalidated when their data cannot be safely derived from the submitted payload.
- Do not change permissions, tenant boundaries, course JSONB storage shape, or the update endpoint response contract.
- No database migration is expected.
- The course-overview section wording changes from “What you’ll master” to “What you’ll learn”. The Polish translation is `Czego się nauczysz`.

## Current State And Root Causes

### Navigation history

- `apps/web/app/lib/stores/navigationHistory.ts` uses Zustand `persist` with the `sessionStorage` key `navigation-history`.
- `apps/web/app/utils/saveEntryToNavigationHistory.ts` writes the same key directly, creating a second state writer.
- `UserDashboard.layout.tsx`, `MFAGuard.tsx`, and `MFA.page.tsx` call `mergeNavigationHistory()` from `useMemo` during render.
- `mergeNavigationHistory()` parses storage and calls Zustand `set()` during render.
- `UserDashboard.layout.tsx` also calls `clearHistory()` directly before returning `<Navigate>`.
- `useNavigationTracker.ts` already updates the store from `useEffect`, which is the safe pattern to retain.

This can change the store snapshot while React is rendering a concurrent route tree and is a credible trigger for the intermittent “Root did not complete” failure. The exact React error remains timing-dependent, so the fix should remove the invalid render-phase mutation even if a deterministic local reproduction is unavailable.

### Course-overview translations

- `CourseWhatYouWillLearn.tsx` uses `modernCourseView.overview.whatYouWillMaster`; retain the key for compatibility while changing its displayed values.
- The key exists in English, Polish, German, Lithuanian, Czech, and Spanish locale files.
- The French locale file does not contain `modernCourseView`, so this section falls back to English there.
- Verify all seven supported locale files and update the displayed values to the “learn” meaning. Add the missing approved French value without copying unrelated untranslated sections into the French file.

### Inline cache updates

- `CourseWhatYouWillLearn.tsx` saves `learningOutcomes` through `useUpdateCourse()`.
- `CourseOverview.tsx` saves description, category, and title through the same mutation.
- `useUpdateCourse.ts` currently invalidates the detail query, the broad `course` query family, and course lists after every successful inline save.
- The update endpoint returns only `{ message }`, so the client must patch the visible cache from the submitted localized payload rather than consume a returned course object.
- The public course detail cache is keyed by `getCourseQueryKey(idOrSlug, language)` in `app/api/queries/useCourse.ts`; the overview receives the route identifier so slug- and UUID-based routes update the active cache entry.

### Multilingual learning outcomes

- `CourseService.getCourse()` already uses exact title/description values for an editor while preserving fallback behavior for learners.
- It currently calls `getLocalizedLearningOutcomes(language, true)` for both editor and learner responses.
- That makes a missing or empty selected-language outcomes array appear as the base-language outcomes to an editor, preventing the editor from reliably clearing or distinguishing that translation.
- Existing API coverage in `course.controller.e2e-spec.ts` explicitly asserts this fallback for editors and must be updated to reflect the intended distinction.

## UI Direction

- Keep the current compact hero layout, inline editing, language selector, and existing empty-state behavior.
- Keep the “What you’ll learn” label translated using the UI locale, not the course-content language.
- When an editor switches course language, the outcomes draft must be reset from the newly loaded course data and must not retain the previous language’s local draft.
- After a successful inline save, the visible course overview should immediately show the saved title, description, category, or outcomes without a loading/refetch flash.
- Keep the certificate stat card visually consistent with the other course-stat tiles: its default shadow should match the neighboring cards; retain interactive hover/focus elevation where applicable.
- If a save fails, retain the existing error-toast behavior and do not commit the optimistic/targeted cache value.
- No new UI component, route, modal, onboarding, or navigation pattern is needed.

## Routing And Frontend Structure

### Navigation-history flow

- Keep `addLastUnauthorizedEntry()` as the store action that writes persisted state.
- Change `saveEntryToNavigationHistory()` to call `useNavigationHistoryStore.getState().addLastUnauthorizedEntry(...)` from client loaders. This is non-render code and is consistent with the web agent rules.
- Remove `mergeNavigationHistory()` and its manual JSON parsing from the store.
- In `UserDashboard.layout.tsx`, `MFAGuard.tsx`, and `MFA.page.tsx`, select `state.navigationHistory[0] ?? null` directly. Do not call a store setter or `getState()` during render.
- Keep redirect calculations pure. Move dashboard `clearHistory()` into an effect guarded by the same redirect condition; keep the existing auth/MFA clearing effects.
- Preserve the current redirect destination and avoid redirect loops when no history entry exists or when the stored path already matches the current path.
- Consider a persisted-store hydration guard only if focused tests demonstrate an asynchronous hydration gap; do not introduce a loading state speculatively because `sessionStorage` hydration is currently synchronous in the browser.

### Course-overview cache flow

- Add a small course-overview cache update helper or an equivalent narrowly scoped mutation option. It should use the shared `queryClient` and `getCourseQueryKey()` rather than creating a local query client or hardcoding a new key.
- On successful inline saves, patch the active localized public-course cache with only fields represented by the submitted payload:
  - `title` for title edits;
  - `description` for description edits;
  - `learningOutcomes` for outcomes edits;
  - `categoryId` and the selected localized category label when the category value is available from the existing category query.
- Keep the mutation-owned toast and error handling in the mutation layer. UI-only draft closing/navigation remains in the component flow.
- Do not globally remove invalidation from `useUpdateCourse()` if that would break the older full-course settings flows. Scope the targeted cache behavior to modern course-overview inline edits, or provide an explicit mutation option that those callers opt into.
- Retain narrowly justified invalidation for list queries or derived data that cannot be safely patched from the inline payload.

## Backend And API Plan

- In `apps/api/src/courses/course.service.ts`, make `getCourse()` select learning outcomes with exact-language semantics when `shouldUseExactLanguage` is true, and with base-language fallback otherwise.
- Keep the existing `getLocalizedLearningOutcomes()` helper and JSONB update behavior; only change which fallback mode is selected for the response.
- Preserve the existing public learner behavior: missing/empty translated outcomes fall back to the base language.
- Preserve editor behavior for title and description and align learning outcomes with it: missing/empty translated outcomes return `[]`.
- Update `apps/api/src/courses/__tests__/course.controller.e2e-spec.ts` to cover both cases:
  - editor requests for a missing/empty translated outcomes array return `[]`;
  - learner requests for the same course/language return base-language outcomes.
- Add or retain an update-and-read assertion proving that saving `learningOutcomes: []` for a translated language persists the empty translated array and does not remove the base-language value.
- No controller schema, Swagger response, generated client, migration, permission, or tenant change is expected.

## Localization Plan

- Update `modernCourseView.overview.whatYouWillMaster` to “What you’ll learn” in English and `Czego się nauczysz` in Polish.
- Update the equivalent “learn” wording in German, Lithuanian, Czech, Spanish, and French; verify the key exists in every supported locale: `en`, `pl`, `de`, `lt`, `cs`, `es`, and `fr`.
- Do not hand-edit generated artifacts; locale JSON is source content and does not require API client generation.
- Keep the existing translation key name unless a later cleanup explicitly renames it across source and tests; the user-facing copy is the required change.

## Implementation Checklist

### Navigation history

- [x] Replace direct `sessionStorage.setItem()` in `saveEntryToNavigationHistory.ts` with the persisted Zustand action.
- [x] Remove `mergeNavigationHistory()` and manual storage parsing from `navigationHistory.ts`.
- [x] Replace render-time merge calls with reactive state selectors in `UserDashboard.layout.tsx`, `MFAGuard.tsx`, and `MFA.page.tsx`.
- [x] Move dashboard `clearHistory()` into a guarded effect while preserving the existing redirect destination.
- [x] Add focused store/component coverage for persisted unauthorized-route recovery, matching paths, mismatched paths, logout, and MFA completion.

### Course overview and cache behavior

- [x] Add the targeted course-detail cache updater using the existing query-key helpers.
- [x] Wire title, description, category, and learning-outcome inline saves to update the visible localized cache after successful mutation.
- [x] Ensure a failed save does not leave an unconfirmed cache value.
- [x] Preserve existing behavior for full settings forms and dependent course lists.
- [x] Add/extend `CourseWhatYouWillLearn` tests for language switching, local draft reset, successful save, empty save, and failed save behavior.

### API localization

- [x] Change editor learning-outcome reads to exact-language semantics.
- [x] Keep learner/preview fallback semantics.
- [x] Update course controller E2E expectations and add the empty-translation persistence case.

### Locale coverage

- [x] Change the English outcome heading to “What you’ll learn”.
- [x] Change the Polish outcome heading to `Czego się nauczysz`.
- [x] Update the equivalent “learn” wording in German, Lithuanian, Czech, Spanish, and French.
- [x] Verify the heading key in all supported locale files.

### Visual consistency

- [x] Align `CertificateStatCard` default shadow with the neighboring progress, deadline, and author stat cards.
- [x] Preserve certificate-card hover, focus, disabled, and interactive behavior while changing only the baseline elevation.
- [x] Extend the certificate stat-card/component or course-overview visual test coverage to prevent a regression in tile shadow consistency.

### Documentation

- [x] Update `docs/specs/course-overview-management-business-spec.md` with the editor-vs-learner localization rule and inline-save behavior.
- [x] Keep this implementation plan as the issue execution checklist; do not add a duplicate product spec.

## Edge Cases

- No `navigation-history` entry: render the normal route with no redirect.
- Stored path equals the current path: do not clear/re-navigate unnecessarily.
- Malformed legacy storage: avoid crashing the render path; persisted-store hydration should fail safely or reset to an empty history state.
- Multiple protected-route attempts before login: preserve the existing “last attempted route” behavior rather than introducing a history stack.
- Selected course language has no outcomes key: editors see `[]`; learners receive the base-language outcomes.
- Selected course language has an explicit empty outcomes array: editors see `[]`; learners retain the established base-language fallback.
- Switching language while an inline save is pending: associate the mutation/cache update with the submitted language and do not overwrite the newly selected language’s data.
- Saving an empty outcome through blur or Enter: persist `[]`, close editing, update the current language cache, and do not resurrect the prior language’s outcomes.
- Category cache lacks the selected category label: update the identifier only and retain a narrowly scoped refetch for the label rather than displaying a fabricated value.
- Concurrent inline saves: prevent an older mutation response from overwriting a newer language/value, or serialize the editor save path.
- French or another locale lacks unrelated modern-overview keys: preserve the existing English fallback; only add/update the issue-scoped heading unless broader translation work is explicitly approved.

## Tests And Validation

### Unit and component validation

- `CourseWhatYouWillLearn.test.tsx`: language changes, draft reset, save/delete/empty-save, cache update, and failed mutation behavior.
- Navigation-history store/helper tests: loader-style writes persist through Zustand; render selectors do not mutate state.
- Course-overview component tests: inline edits update the visible course data without waiting for a refetch.
- Locale-key parity check for `modernCourseView.overview.whatYouWillMaster`.

### API validation

- Focused course controller E2E tests for editor exact-language outcomes, learner fallback, and empty translated outcomes.
- Course schema tests remain passing; no schema change is expected.

### Web E2E/manual validation

- Existing focused course-overview and responsive specs.
- Add a deterministic course-overview language flow that creates English and Polish outcomes, switches languages, clears one translation, refreshes, and verifies that the other language remains unchanged.
- Verify unauthenticated access to dashboard, admin, calendar, learning paths, and live training returns to the attempted route after login/MFA.
- Repeat hard refreshes on the staging production build with existing `navigation-history` storage and confirm no React #345 event is emitted.
- Test UI locale coverage at least in French and Polish, and verify course-content language independently from UI language.

### Commands

- `pnpm --filter=web test -- <focused test paths>`
- `pnpm --filter=api test:e2e -- <focused course spec>`
- `pnpm --filter=web lint-tsc`
- `pnpm --filter=api lint-tsc`
- `git diff --check`

## Rollout And Monitoring

- Deploy the navigation/cache/API changes together so the editor receives the new localization semantics and the web cache behavior is consistent with it.
- Monitor Sentry for React #345 and route error rates after deployment.
- Monitor course-overview save failures and requests to the course detail endpoint; targeted cache updates should reduce unnecessary detail refetches after inline edits.
- Confirm service-worker clients receive the new asset version before judging the React error rate.
