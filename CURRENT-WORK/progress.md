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

## 2026-04-29 — Slice 3: Tenant point defaults + per-entity overrides — DONE

### Key decisions

- Replaced hardcoded gamification point values with tenant-configured defaults stored on the existing global settings JSONB blob (`defaultChapterPoints`, `defaultCoursePoints`, `defaultAiPassPoints`) seeded to 10 / 50 / 30.
- Added nullable `pointsOverride` columns to courses, chapters, and AI mentor lessons; `null` means use the tenant default while an explicit integer, including `0`, overrides it.
- Updated `PointsService.award()` to resolve points at award time via override → tenant default → 0 and snapshot the resolved value into `point_events.points`; zero-point events still write the idempotency ledger row but do not bump `user_statistics.totalPoints`.
- Added tenant-admin settings UI/API for editing gamification defaults and per-entity editor controls with a "Use tenant default" switch plus enabled/disabled number input.
- Kept all new admin writes behind the existing settings/course/chapter/lesson permissions; no new permission entries were introduced.

### Files changed

- `apps/api/src/storage/schema/index.ts`
- `apps/api/src/storage/migrations/0108_add_gamification_points_config.sql`
- `apps/api/src/storage/migrations/meta/_journal.json`
- `apps/api/src/gamification/gamification.constants.ts`
- `apps/api/src/gamification/points.service.ts`
- `apps/api/src/gamification/__tests__/points.service.spec.ts`
- `apps/api/src/settings/constants/settings.constants.ts`
- `apps/api/src/settings/schemas/settings.schema.ts`
- `apps/api/src/settings/schemas/update-settings.schema.ts`
- `apps/api/src/settings/settings.controller.ts`
- `apps/api/src/settings/settings.service.ts`
- `apps/api/src/common/types.ts`
- `apps/api/src/courses/course.service.ts`
- `apps/api/src/courses/schemas/createCourse.schema.ts`
- `apps/api/src/courses/schemas/updateCourse.schema.ts`
- `apps/api/src/courses/schemas/showCourseCommon.schema.ts`
- `apps/api/src/chapter/repositories/adminChapter.repository.ts`
- `apps/api/src/chapter/schemas/chapter.schema.ts`
- `apps/api/src/lesson/lesson.schema.ts`
- `apps/api/src/lesson/repositories/adminLesson.repository.ts`
- `apps/api/src/lesson/services/adminLesson.service.ts`
- `apps/api/src/ai/__tests__/createAiMentorLesson.ts`
- `apps/api/test/factory/chapter.factory.ts`
- `apps/api/test/factory/course.factory.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/mutations/admin/useUpdateGamificationPointDefaults.ts`
- `apps/web/app/modules/Dashboard/Settings/components/admin/GamificationPointDefaults.tsx`
- `apps/web/app/modules/Dashboard/Settings/components/admin/OrganizationTabContent.tsx`
- `apps/web/app/modules/Admin/EditCourse/components/PointsOverrideField.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseSettings/CourseSettings.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseSettings/hooks/useCourseSettingsForm.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema.ts`
- `apps/web/app/modules/Admin/EditCourse/EditCourse.tsx`
- `apps/web/app/modules/Admin/EditCourse/EditCourse.types.ts`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewChapter/NewChapter.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewChapter/hooks/useNewChapterForm.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewChapter/validators/newChapterFormSchema.ts`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiMentorLessonForm.tsx`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/hooks/useAiMentorLessonForm.ts`
- `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/validators/useAiMentorLessonFormSchema.ts`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Achievement unlocks, profile achievement grid, leaderboard, and retroactive admin flows remain deferred to later slices.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, and `pnpm test:web` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
- `pnpm test:api:e2e` was attempted twice. The full parallel run reached 18/20 passing suites before failing with Postgres `sorry, too many clients already`; a sequential rerun also hit connection exhaustion in settings login-background/login-page-files suites. This appears environmental/resource related rather than slice-specific.
- `pnpm test:web:e2e` was attempted and still fails because the local Playwright Chromium executable is not installed (`pnpm exec playwright install` required); DB setup completed before browser launch.
- `pnpm format:check` still fails on pre-existing formatting issues in `.bmad-core/`, `.claude/`, `.serena/`, untracked `CURRENT-WORK` issue docs, and `docs/gamification.md`; changed source/test files were formatted with Prettier.

## 2026-04-29 — Slice 4: Achievements catalog + admin CRUD — DONE

### Key decisions

- Added the achievements catalog data model with tenant-scoped `achievements`, localized `achievement_translations`, and empty `user_achievements` unlock rows reserved for the next slice.
- Implemented tenant-admin CRUD under `/achievements/admin`, reusing the existing tenant management permission instead of adding a new permission.
- Kept deletes soft-only by setting `isActive = false`; inactive achievements are hidden by default but can be included via the admin list filter.
- Required a full translation set for every supported locale and intentionally allowed duplicate point thresholds.
- Reused the existing `FileService` S3 upload path for achievement badge images and returned signed image URLs in admin reads for table/form previews.
- Added a new admin Achievements navigation section and create/edit/list UI with multilingual fields, threshold validation, active toggle, image upload, and inactive filtering.

### Files changed

- `apps/api/src/storage/schema/index.ts`
- `apps/api/src/storage/migrations/0109_add_achievements_catalog.sql`
- `apps/api/src/storage/migrations/meta/_journal.json`
- `apps/api/src/gamification/achievements.controller.ts`
- `apps/api/src/gamification/achievements.repository.ts`
- `apps/api/src/gamification/achievements.service.ts`
- `apps/api/src/gamification/schemas/achievement.schema.ts`
- `apps/api/src/gamification/gamification.module.ts`
- `apps/api/src/gamification/__tests__/achievements.service.spec.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/queries/admin/useAchievements.ts`
- `apps/web/app/api/mutations/admin/useAchievementMutations.ts`
- `apps/web/app/modules/Admin/Achievements/Achievements.page.tsx`
- `apps/web/app/modules/Admin/Achievements/CreateAchievement.page.tsx`
- `apps/web/app/modules/Admin/Achievements/Achievement.page.tsx`
- `apps/web/app/modules/Admin/Achievements/AchievementForm.tsx`
- `apps/web/app/modules/Admin/Admin.layout.tsx`
- `apps/web/app/config/navigationConfig.ts`
- `apps/web/app/config/routeAccessConfig.ts`
- `apps/web/routes.ts`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Achievement unlock evaluation, profile achievement grid, toasts, retroactive threshold unlocks, and leaderboard remain deferred to later slices.
- `user_achievements` is created for the future unlock pipeline but no completion event inserts rows in this slice.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, and `pnpm test:web` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
- `pnpm test:api:e2e` was attempted and failed in the existing lesson quiz feedback redaction suite (`expected 201 Created, got 409 Conflict`); 19/20 suites passed, matching the previously observed suite-isolation/flakiness area.
- `pnpm test:web:e2e` was attempted and still fails because the local Playwright Chromium executable is not installed (`pnpm exec playwright install` required); DB setup completed before browser launch.
- `pnpm format:check` still fails on pre-existing formatting issues in `.bmad-core/`, `.claude/`, `.serena/`, untracked CURRENT-WORK issue docs, and `docs/gamification.md`; changed source/test files were formatted with Prettier.

## 2026-04-29 — Slice 5: Unlock evaluator + profile grid + toasts — DONE

### Key decisions

- Added a pure `AchievementEvaluator` for threshold-based unlock decisions, keeping all database reads/writes in the repository layer.
- Wired achievement unlock persistence into `PointsService.award()` so new `user_achievements` rows are inserted in the same transaction as the point ledger insert and `user_statistics` total bump.
- Kept existing outbox event handlers for idempotent asynchronous compatibility, but invoked `PointsService.award()` directly from completion mutation paths so HTTP responses can include `gamification: { pointsAwarded, newlyUnlocked }` immediately.
- Added an authenticated `/achievements/me` profile endpoint that returns the active tenant catalog merged with the current user's unlocks, progress, and signed badge image URLs.
- Rendered the profile achievement grid only for the profile owner, with earned badge tooltips and locked badge grayscale/progress rendering.
- Added a shared frontend toast helper and attached it to content lesson completion, quiz completion, and AI mentor judge completion flows; each newly unlocked achievement produces one toast.

### Files changed

- `apps/api/src/gamification/achievement.evaluator.ts`
- `apps/api/src/gamification/__tests__/achievement.evaluator.spec.ts`
- `apps/api/src/gamification/achievements.repository.ts`
- `apps/api/src/gamification/achievements.service.ts`
- `apps/api/src/gamification/profile-achievements.controller.ts`
- `apps/api/src/gamification/gamification.module.ts`
- `apps/api/src/gamification/points.service.ts`
- `apps/api/src/gamification/__tests__/points.service.spec.ts`
- `apps/api/src/gamification/schemas/achievement.schema.ts`
- `apps/api/src/studentLessonProgress/studentLessonProgress.service.ts`
- `apps/api/src/studentLessonProgress/studentLessonProgress.module.ts`
- `apps/api/src/studentLessonProgress/studentLessonProgress.controller.ts`
- `apps/api/src/lesson/lesson.controller.ts`
- `apps/api/src/lesson/services/lesson.service.ts`
- `apps/api/src/ai/utils/ai.schema.ts`
- `apps/api/src/ai/services/ai.service.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/queries/useProfileAchievements.ts`
- `apps/web/app/api/mutations/helpers/showAchievementUnlockToasts.ts`
- `apps/web/app/api/mutations/useMarkLessonAsCompleted.ts`
- `apps/web/app/api/mutations/useSubmitQuiz.ts`
- `apps/web/app/api/mutations/useJudgeLesson.ts`
- `apps/web/app/modules/Profile/Profile.page.tsx`
- `apps/web/app/modules/Profile/Profile.page.test.tsx`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Retroactive unlocks on achievement creation/threshold edits and leaderboard work remain deferred to later slices.
- Existing outbox-based points handlers remain registered; direct completion mutation awards run first and later handler invocations are idempotent duplicate no-ops.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, `pnpm test:web`, and `pnpm test:api:e2e` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
- `pnpm test:web:e2e` was attempted and still fails because the local Playwright Chromium executable is not installed (`pnpm exec playwright install` required); DB setup completed before browser launch.
- `pnpm format:check` still fails on pre-existing formatting issues in `.claude/`, untracked CURRENT-WORK issue docs, and `docs/gamification.md`; changed source/test/locale files were formatted with Prettier.

## 2026-04-29 — Slice 6: Retroactive achievement unlocks — DONE

### Key decisions

- Wired admin achievement creation and threshold-lowering updates to synchronously insert retroactive `user_achievements` rows inside the same repository transaction as the catalog write.
- Reused `evaluateAchievementUnlocks()` for each qualifying candidate user while pre-filtering by tenant, `totalPoints >= pointThreshold`, and missing user-achievement rows.
- Kept threshold raises non-destructive: existing unlock rows are never revoked and no retroactive insert pass runs for raises.
- Preserved soft-delete history by keeping `user_achievements` untouched and updating profile achievement reads to include inactive achievements only when the viewer already holds them.
- Left admin default listing behavior unchanged so inactive achievements remain hidden unless `includeInactive=true` is requested.

### Files changed

- `apps/api/src/gamification/achievements.repository.ts`
- `apps/api/src/gamification/__tests__/achievement.evaluator.spec.ts`
- `apps/api/src/gamification/__tests__/achievements.service.spec.ts`
- `apps/api/src/gamification/__tests__/achievements.controller.e2e-spec.ts`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Leaderboard all-time and monthly/group leaderboard slices remain deferred to later work.
- Added an API e2e spec for the admin threshold-lowering path, but did not run API e2e tests per the current instruction to avoid web and API e2e feedback loops.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, `pnpm test:web`, and `pnpm format:check` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
- `pnpm --filter api test -- achievement.evaluator.spec.ts achievements.service.spec.ts --runInBand` passes for focused iteration.

## 2026-04-29 — Slice 7: Leaderboard all-time + own rank — DONE

### Key decisions

- Implemented the first leaderboard slice for the all-time scope only; monthly scope and group filtering remain deferred to slice 8.
- Added `LeaderboardQueryService.query()` as the backend read path, scoped by tenant and restricted to users with the student system role.
- Ranked all-time results from `user_statistics.totalPoints` using the required `totalPoints DESC, lastPointAt ASC` ordering and a separate `RANK()` window query for the viewer's full-tenant rank outside the top 10.
- Kept leaderboard rows limited to students with positive lifetime points for the top-10 empty-state behavior, while returning the viewer's own row when they have a recorded point event.
- Added an authenticated student-only `/leaderboard?scope=all-time` API endpoint and a student dashboard Leaderboard page with the all-time tab, top-10 rows, highlighted viewer row, sticky outside-top-10 row, and empty state.
- Updated OpenAPI and the generated web client so the new endpoint is available through the standard API client.

### Files changed

- `apps/api/src/gamification/gamification.module.ts`
- `apps/api/src/gamification/leaderboard-query.service.ts`
- `apps/api/src/gamification/leaderboard.controller.ts`
- `apps/api/src/gamification/schemas/leaderboard.schema.ts`
- `apps/api/src/gamification/__tests__/leaderboard.controller.e2e-spec.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/queries/useLeaderboard.ts`
- `apps/web/app/modules/Leaderboard/Leaderboard.page.tsx`
- `apps/web/app/config/navigationConfig.ts`
- `apps/web/app/config/routeAccessConfig.ts`
- `apps/web/routes.ts`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Monthly leaderboard aggregation and group filtering remain deferred to slice 8.
- Added an API e2e spec for all-time ordering, tie-breaking, own-rank behavior outside the top 10, staff filtering, and non-student rejection, but did not run API e2e tests per the current instruction to avoid web and API e2e feedback loops.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, `pnpm test:web`, and `pnpm format:check` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.

## 2026-04-29 — Slice 8: Leaderboard monthly tab + group filter — DONE

### Key decisions

- Extended `LeaderboardQueryService.query()` to support both `all-time` and `month` scopes plus an optional `groupId`, keeping student role filtering and tenant scoping centralized in the SQL read model.
- Implemented the monthly leaderboard from `point_events` using current UTC calendar-month aggregation with `SUM(points) DESC, MAX(createdAt) ASC` ordering and the same filtered `RANK()` approach for `ownRank`.
- Applied group filtering to all-time and monthly queries via `group_users`, with `ownRank`/`ownRow` calculated against the same filtered population.
- Added a student-only `/leaderboard/groups` endpoint so the frontend can list every group in the tenant, including groups the viewer is not a member of, without reusing admin group permissions.
- Updated the leaderboard page to keep the group filter persistent while switching between All-time and This month tabs, defaulting to All-time and the whole-company filter.

### Files changed

- `apps/api/src/gamification/leaderboard-query.service.ts`
- `apps/api/src/gamification/leaderboard.controller.ts`
- `apps/api/src/gamification/schemas/leaderboard.schema.ts`
- `apps/api/src/gamification/__tests__/leaderboard.controller.e2e-spec.ts`
- `apps/api/src/swagger/api-schema.json`
- `apps/web/app/api/generated-api.ts`
- `apps/web/app/api/queries/useLeaderboard.ts`
- `apps/web/app/modules/Leaderboard/Leaderboard.page.tsx`
- `apps/web/app/locales/{cs,de,en,lt,pl}/translation.json`
- `CURRENT-WORK/progress.md`

### Blockers / notes for next iteration

- Final QA remains as the next slice; the core gamification feature slices are now implemented.
- Added API e2e coverage for monthly aggregation, monthly tiebreaking, tenant-wide group listing, group filtering, and monthly own-rank outside the top 10, but did not run API e2e tests per the current instruction to avoid web and API e2e feedback loops.
- `pnpm lint-tsc-api`, `pnpm lint-tsc-web`, `pnpm lint`, `pnpm test:api`, `pnpm test:web`, and `pnpm format:check` pass; web lint still reports the pre-existing `ChatMessage.tsx` React hook dependency warning without failing.
