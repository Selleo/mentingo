# Gamification implementation progress

## 2026-04-28 — Slice 1: Points tracer — DONE

### Key decisions

- Implemented the first gamification slice only: chapter completion awards hardcoded default points through `PointsService.award()`.
- Added `point_events` as the append-only idempotency ledger with a unique `(userId, eventType, entityId)` constraint.
- Stored the denormalized lifetime total on `user_statistics.totalPoints` with `lastPointAt`; points are upserted in the same transaction as the ledger insert.
- Kept role gating inside `PointsService` by checking for the student system role before writing any ledger/statistics rows.
- Surfaced the current user's gamification summary on `GET /auth/current-user` and rendered the lifetime point total only on the profile owner view.

### Files changed

- `apps/api/src/storage/schema/index.ts`
- `apps/api/src/storage/migrations/0107_add_gamification_points_tracer.sql`
- `apps/api/src/storage/migrations/meta/_journal.json`
- `apps/api/src/gamification/gamification.constants.ts`
- `apps/api/src/gamification/points.service.ts`
- `apps/api/src/gamification/handlers/user-chapter-finished-points.handler.ts`
- `apps/api/src/gamification/gamification.module.ts`
- `apps/api/src/gamification/__tests__/points.service.spec.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/user/user.service.ts`
- `apps/api/src/user/schemas/user.schema.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/mutations/helpers/handleAuthSuccess.ts`
- `apps/web/app/api/mutations/useHandleMagicLink.ts`
- `apps/web/app/modules/Profile/Profile.page.tsx`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Course completion and AI mentor pass events are intentionally deferred to slice 2.
- Tenant-configurable defaults and per-entity overrides are intentionally deferred to slice 3.
- Achievement unlocks, leaderboard, and retroactive admin flows remain deferred to later slices.
- `pnpm lint-tsc-web` / `pnpm lint` currently report one pre-existing React hook dependency warning in `ChatMessage.tsx`; neither command fails.
- `pnpm format:check` fails on pre-existing formatting issues in `.bmad-core/`, `.claude/`, `.serena/`, untracked CURRENT-WORK issue docs, and `docs/gamification.md`; changed files were formatted with Prettier.
- `pnpm test:api:e2e` was attempted and failed in an existing lesson quiz feedback e2e with `quiz_attempts_course_id_courses_id_fk` (1 failed, 19 passed); rerunning `lesson.controller.e2e-spec.ts` alone passed, so this appears to be suite isolation/flakiness rather than this slice.
- `pnpm test:web:e2e` was attempted and failed because the Playwright Chromium executable is not installed locally (`pnpm exec playwright install` required); setup DB passed before the browser launch failure.

## 2026-04-28 — Slice 2: Course completion + AI mentor pass events — DONE

### Key decisions

- Extended the existing gamification points pipeline without changing the public `PointsService.award()` entry point: course completion and AI mentor pass now flow through the same idempotent ledger/total update path as chapter completion.
- Added `UserAiMentorLessonPassedEvent` and exported it through the event registry so the outbox dispatcher can materialize and publish it like the existing user completion events.
- Emitted the AI mentor pass event only when persisted AI mentor progress first transitions to `passed = true`; once passed, the stored `passed` flag remains sticky so later failed re-attempts cannot create a second transition.
- Added dedicated CQRS handlers for `UserCourseFinishedEvent` and `UserAiMentorLessonPassedEvent`, mapping them to `course_completed` and `ai_pass` point event types respectively.
- Kept role gating and duplicate protection delegated to `PointsService`, so staff/no-op and re-completion behavior remains centralized.

### Files changed

- `apps/api/src/events/index.ts`
- `apps/api/src/events/user/user-ai-mentor-lesson-passed.event.ts`
- `apps/api/src/gamification/gamification.constants.ts`
- `apps/api/src/gamification/gamification.module.ts`
- `apps/api/src/gamification/handlers/user-ai-mentor-lesson-passed-points.handler.ts`
- `apps/api/src/gamification/handlers/user-course-finished-points.handler.ts`
- `apps/api/src/gamification/__tests__/points-handlers.spec.ts`
- `apps/api/src/gamification/__tests__/points.service.spec.ts`
- `apps/api/src/studentLessonProgress/ai-mentor-pass-event.utils.ts`
- `apps/api/src/studentLessonProgress/__tests__/ai-mentor-pass-event.utils.spec.ts`
- `apps/api/src/studentLessonProgress/studentLessonProgress.service.ts`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Tenant-configurable defaults and per-entity overrides are still deferred to slice 3.
- Achievement unlocks, leaderboard, and retroactive admin flows remain deferred to later slices.
- `pnpm lint-tsc-api`, `pnpm test:api`, `pnpm lint-tsc-web`, `pnpm lint`, and `pnpm test:web` pass; web lint commands continue to report the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
- `pnpm test:api:e2e` was attempted and failed in the pre-existing `group.controller.e2e-spec.ts` student-cookie setup path (`Invalid value "undefined" for header "Cookie"`) plus an `afterAll` timeout; 19/20 suites passed.
- `pnpm test:web:e2e` was attempted and failed because the Playwright Chromium executable is not installed locally (`pnpm exec playwright install` required); DB setup completed before browser launch.
- `pnpm format:check` still fails on pre-existing formatting issues in `.bmad-core/`, `.claude/`, `.serena/`, untracked `CURRENT-WORK` issue docs, and `docs/gamification.md`; changed source/test files were formatted with Prettier.
