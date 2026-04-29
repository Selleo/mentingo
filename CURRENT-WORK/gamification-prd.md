# Gamification PRD

Companion to `docs/gamification.md` (functional spec). This PRD captures the user-facing problem,
the chosen solution, user stories, and the implementation decisions reached during requirements
gathering. Where this PRD and the spec disagree, this PRD wins — it incorporates clarifications
made after the spec was drafted.

## Problem Statement

Students using the platform have no signal that their effort accumulates over time and no way to
see how they compare with peers. Completing a chapter, passing an AI mentor lesson, or finishing a
course produces no reward beyond progress checkmarks. Tenant admins have no lever to celebrate
achievement or to drive engagement on specific learning activities. The result is flat motivation
mid-course and weak habit formation across cohorts.

## Solution

Introduce three coupled mechanics on top of existing completion flows:

1. **Points** — students automatically earn points when they complete a chapter, pass an AI
   mentor lesson, or finish a course. Defaults are tenant-configurable and overridable per
   entity. The current total is always visible on the student's own profile.
2. **Achievements** — admins curate a per-tenant catalog of badges (image + multilingual name and
   description + point threshold). Each user's profile shows the full catalog: badges they have
   unlocked render in color, badges they haven't render in grayscale with a progress bar toward
   the threshold.
3. **Leaderboard** — any authenticated student can open a leaderboard showing the top 10 students
   in their tenant by points, switch between "All-time" and "This month" tabs, filter by group,
   and always see their own rank highlighted (sticky row when outside the top 10).

The system is always-on per tenant, students-only for accrual, and never revokes points or
unlocked achievements once earned.

## User Stories

### Student — earning points

1. As a student, I want to receive points automatically when I complete a chapter, so that I am
   rewarded for finishing a unit of work without having to claim anything manually.
2. As a student, I want to receive points when I pass an AI mentor lesson, so that conversational
   practice counts toward my total.
3. As a student, I want to receive points when I finish a whole course, so that long-form
   commitment is rewarded more than incremental progress.
4. As a student, I want my point total to update immediately on completion, so that the feedback
   loop feels tight.
5. As a student, I do not want to be able to farm points by re-completing the same chapter,
   lesson, or course, so that the leaderboard reflects real progress.
6. As a student, I want my earned points to never be revoked if a course or chapter is reset,
   reorganized, or deleted, so that my history is stable.

### Student — viewing own profile

7. As a student, I want to see my lifetime point total on my own profile, so that I have a
   single place to check my progress.
8. As a student, I want to see every achievement in my tenant's catalog on my profile, so that
   I know what is available to earn.
9. As a student, I want unlocked achievements to render in full color with the date I unlocked
   them on hover, so that I can take pride in past wins.
10. As a student, I want locked achievements to render in grayscale with a progress bar showing
    `currentTotal / threshold` and the points remaining, so that I have a concrete next goal.
11. As a student, I want achievements sorted by threshold ascending so the next attainable badge
    appears near the top of the locked tier, so that motivation aligns with proximity.
12. As a student, I do not want to see other students' profile pages in v1, so that the
    leaderboard remains the single comparison surface.

### Student — unlock notification

13. As a student, I want a toast to appear when I unlock a new achievement, so that I notice the
    reward without having to check my profile.
14. As a student, I want multiple toasts when a single completion crosses multiple thresholds,
    so that no unlock is silently swallowed.
15. As a student, I do not want unlock emails or persisted in-app notifications in v1, so that
    the experience stays lightweight.

### Student — leaderboard

16. As a student, I want to open a leaderboard view that lists the top 10 students in my tenant
    by total points, so that I can see who is ahead.
17. As a student, I want to switch to a "This month" tab that ranks by points earned in the
    current calendar month, so that I have a chance to climb without competing against legacy
    accumulation.
18. As a student, I want to filter the leaderboard by group, so that I can compare myself to
    classmates rather than the whole tenant.
19. As a student, I want the default filter to be "the whole company" with no group restriction,
    so that the headline view is the broadest one.
20. As a student, I want to be able to filter by any group in the tenant, even ones I am not a
    member of, so that I can scout other cohorts.
21. As a student, I want my own row highlighted when I am inside the top 10, so that I can spot
    myself instantly.
22. As a student, I want a sticky "You: #N" row beneath the top 10 when I am outside it, so that
    I always know where I stand without scrolling.
23. As a student, I want each leaderboard row to show avatar, full name, and points, so that I
    can identify peers at a glance.
24. As a student, I want ties broken so that whoever reached the score earlier ranks higher, so
    that the ordering feels deterministic.

### Admin — achievement catalog

25. As a tenant admin, I want a dedicated Achievements section in the admin panel, so that I can
    manage the catalog without polluting other admin areas.
26. As a tenant admin, I want to create a new achievement by uploading an image, entering name
    and description in every supported locale, and setting an integer point threshold, so that
    badges align with the tenant's brand and language coverage.
27. As a tenant admin, I want to allow duplicate thresholds across achievements, so that two
    badges can unlock from the same total when the catalog is themed.
28. As a tenant admin, I want to edit an existing achievement's image, translations, and
    threshold, so that I can iterate without recreating it.
29. As a tenant admin, I want lowering a threshold to retroactively unlock the badge for every
    user already past it within the same request, so that the change feels immediate and fair.
30. As a tenant admin, I want raising a threshold to leave existing unlocks in place, so that I
    do not accidentally take rewards away.
31. As a tenant admin, I want to soft-delete an achievement so that it disappears from the
    catalog and from locked-badge slots on profiles but remains visible on profiles of users who
    already hold it, so that history is preserved.

### Admin — points configuration

32. As a tenant admin, I want to set tenant-level default points for chapter completion, AI
    mentor pass, and course completion, so that I can tune incentive density once for the whole
    tenant.
33. As a tenant admin, I want to override the default points on a specific chapter, course, or
    AI mentor lesson, so that I can boost or zero out specific units.
34. As a tenant admin, I want a clear toggle that distinguishes "use the tenant default" from
    "this entity is worth zero points", so that I never accidentally suppress all rewards on an
    entity I meant to leave on default.
35. As a tenant admin, I want changes to defaults or overrides to apply only to future awards
    and never to rewrite past totals or history, so that the ledger is trustworthy.

### Admin — viewing aggregated state (implicit)

36. As a tenant admin, I want to use the existing tenant-admin permission to access all of the
    above, so that no new role or permission entry is introduced.

### System — non-functional

37. As an operator, I want every point award to be idempotent on
    `(userId, eventType, entityId)`, so that retried events and duplicate webhooks do not inflate
    totals.
38. As an operator, I want the awarding ledger to be append-only with a snapshot of the points
    value at award time, so that defaults can change without rewriting history.
39. As an operator, I want the user's denormalized total and `lastPointAt` to be updated in the
    same transaction as the ledger insert, so that reads are consistent.
40. As an operator, I want staff (non-student) completion events to flow through the same
    pipeline but be no-op'd at the role gate, so that adding new participating roles later is a
    one-line change.
41. As an operator, I want gamification to be always on for every tenant with no feature flag,
    so that there is no per-tenant configuration drift.
42. As an operator, I want no backfill of points for completions made before deploy, so that
    rollout has a hard, auditable starting line.

## Implementation Decisions

### Backend modules (new)

- **`PointsService.award(userId, eventType, entityId, tenantId)`** — the only public entry
  point for accruing points. In one DB transaction it (a) resolves the effective points value
  via override → tenant default → 0, (b) attempts to insert a ledger row protected by the
  `(userId, eventType, entityId)` unique index — duplicates are silently no-op, (c) increments
  the user's `totalPoints` and writes `lastPointAt`, (d) runs the achievement evaluator, and
  (e) returns any newly unlocked achievements to the caller. Designed as a deep module so the
  call sites are trivial.
- **`AchievementEvaluator`** — pure function `(currentTotal, heldAchievementIds, activeCatalog)
  → newlyUnlockedIds`. No DB. Called by both `PointsService.award` and by the admin threshold
  edit flow. Lives behind a thin repository wrapper that provides the catalog and held-ids and
  persists the resulting unlocks.
- **`LeaderboardQueryService`** — `(tenantId, scope: 'all-time' | 'month', groupId?, viewerId)
  → { top10, ownRank }`. Builds two SQL variants:
  - All-time: `SELECT ... ORDER BY total_points DESC, last_point_at ASC LIMIT 10`.
  - Monthly: `SELECT user_id, SUM(points) AS month_points, MAX(created_at) AS last_in_month
    FROM point_events WHERE created_at >= start_of_current_month GROUP BY user_id ORDER BY
    month_points DESC, last_in_month ASC LIMIT 10`.
  - In both modes, `ownRank` is computed via a separate `RANK()` window query against the same
    filter set, so the viewer's rank is correct even outside the top 10.
  - Group filter joins `group_users` when `groupId` is supplied.
- **`AchievementsAdminService`** — CRUD over `achievements` and `achievement_translations`. On
  threshold lower (or new achievement creation with an already-met threshold), runs synchronous
  retroactive unlock in the same DB transaction. Soft-delete sets `isActive = false`.
- **Event listeners** — three thin handlers subscribe to `UserChapterFinished`,
  `UserCourseFinished`, and the new `UserAiMentorLessonPassed`. Each unconditionally calls
  `PointsService.award`; the role gate lives inside the service so adding new participating
  roles later is a single change.

### Backend modules (modified)

- AI mentor lesson progress write site emits a new `UserAiMentorLessonPassed` event when
  `passed` flips to `true` for the first time on a `(user, lesson)` pair. Mirrors the existing
  event style used by chapter/course completion.
- Existing chapter editor, course editor, and AI mentor lesson editor APIs accept a new
  `pointsOverride` field (nullable integer ≥ 0).
- Existing tenant settings (`GlobalSettings`) JSONB blob is extended with three integer fields:
  `defaultChapterPoints`, `defaultCoursePoints`, `defaultAiPassPoints`. The `tenant_settings`
  column-shaped table mentioned in the functional spec is not introduced — defaults live in the
  existing JSONB blob.
- Profile / `/me` endpoint payload extended with `totalPoints`, the achievements grid (full
  active catalog plus the viewer's `userAchievements` joined in), and per-locked-badge progress.

### Frontend modules (new)

- **Achievements section on existing Profile page** — added inline to `Profile.page.tsx`, not a
  new route or modal. Renders the full active catalog as a single grid: earned badges in color
  with `unlockedAt` tooltip, locked badges grayscale with a progress bar and remaining-points
  label.
- **Leaderboard page** — new student-facing route. Tab control for All-time / This month, group
  filter dropdown listing every group in the tenant, top-10 list, sticky own-rank row when
  applicable, viewer's row visually highlighted when present in the top 10.
- **Admin Achievements module** — list view, create/edit form with image upload + multilingual
  name and description fields + threshold input + active toggle, soft-delete action.
- **Tenant defaults form** — three integer inputs added to the existing tenant settings admin
  page.
- **Per-entity points override input** — added to existing chapter, course, and AI mentor
  lesson editors. UI is a "Use tenant default" toggle plus a number input enabled only when the
  toggle is off, so empty/null and explicit zero are unambiguously distinct.
- **Toast handler** — completion mutations (chapter / AI pass / course) carry a
  `newlyUnlocked: Achievement[]` field in the response; the frontend shows one toast per entry.

### Schema

- New tables:
  - `point_events` — append-only ledger. Unique index on `(userId, eventType, entityId)`. Range
    index on `(tenantId, createdAt)` to support monthly aggregation. Stores a snapshot of the
    `points` value at award time so subsequent config changes never rewrite history.
  - `achievements` — id, tenantId, imageReference (S3 key), pointThreshold, isActive,
    timestamps.
  - `achievement_translations` — `(achievementId, locale)` → name, description.
  - `user_achievements` — `(userId, achievementId, unlockedAt)` with a unique index on the
    pair.
- Extended tables:
  - `user_statistics` gains `totalPoints integer not null default 0` and `lastPointAt
    timestamp` (nullable). Lives here rather than on `users` because the streak fields it joins
    are already on this table.
  - `chapters`, `courses`, `ai_mentor_lessons` each gain `pointsOverride` (nullable integer).
- Extended types:
  - `GlobalSettings` (JSONB-backed) gains `defaultChapterPoints`, `defaultCoursePoints`,
    `defaultAiPassPoints`. Default initial values mirror the original Polish brief
    (10 / 30 / 50).

### API contracts (shape only)

- `GET /me` (or its equivalent profile endpoint) — adds `gamification: { totalPoints, lastPointAt
  }`.
- `GET /me/achievements` — returns the achievement grid: every active achievement merged with
  the viewer's `userAchievements`, including locked-badge progress.
- Completion mutations (chapter, course, AI mentor lesson pass) — extend the response with
  `gamification: { pointsAwarded: number, newlyUnlocked: Achievement[] }`. Single round-trip,
  no separate poll endpoint.
- `GET /leaderboard?scope=all-time|month&groupId?` — returns `{ top10: Row[], ownRank: number,
  ownRow: Row | null }`. Rows contain `userId, fullName, avatarUrl, points`.
- Admin endpoints under the tenant-admin permission:
  - `POST/PATCH/DELETE /admin/achievements` and translations.
  - `PATCH /admin/tenant-settings/points-defaults`.
  - Existing chapter/course/AI mentor editor endpoints accept `pointsOverride`.

### Award atomicity and idempotency

- The unique index on `(userId, eventType, entityId)` is the single source of truth for "already
  awarded". The transaction tries the insert, swallows the unique-violation, and exits the
  transaction without bumping the total in that case.
- The total bump and the achievement evaluator both run inside the same transaction. On commit
  the listener returns the newly unlocked rows to the API caller for the toast payload.

### Role gating

- `PointsService.award` checks the user's role internally and no-ops when the user is not a
  student. Listeners stay role-agnostic. Adding new participating roles is a single change in
  the service.

### Retroactive unlocks on threshold edits

- Synchronous, in-request, in the same DB transaction as the threshold update. Acceptable for
  the v1 user-base size; revisit if future load testing shows admin requests timing out, in
  which case migrate to the existing outbox-based async pipeline.

### Tests (boundaries to cover)

- **Unit tests on `PointsService`** — idempotency on duplicate events, role gating no-op for
  staff, override → default → 0 resolution, transaction rolls back ledger insert when total
  bump fails.
- **Unit tests on `AchievementEvaluator`** — pure-function tests over thresholds, multiple
  unlocks from a single award, retroactive unlocks on threshold lower, soft-delete excluded
  from the active catalog passed in.
- **Integration tests on `LeaderboardQueryService`** — against a real Postgres instance:
  all-time vs monthly aggregation, group filter, tiebreaker by `lastPointAt` ascending, own
  rank correct both inside and outside the top 10.

End-to-end tests across completion → toast are not part of v1 testing scope.

## Out of Scope

- Achievement criteria other than point thresholds (streaks, "finish 3 courses", etc.).
- Public profile pages — other students' profiles are not exposed in v1.
- Email notifications on unlock and persisted in-app notification storage.
- Pagination of the leaderboard beyond the top 10.
- A per-tenant feature flag — gamification is on for every tenant.
- Negative points, penalties, or clawbacks. Earned is earned.
- Backfill of points for completions made before deploy.
- Any participation in points by non-student roles. Staff completions flow through the pipeline
  but are no-op'd.
- End-to-end tests of the full completion → toast pipeline.
- Caching of leaderboard query results (revisit only if load testing shows it's needed).
- Async / queued retroactive unlock on threshold edit (revisit only if request times out at
  scale).

## Further Notes

- The Polish brief's listed point values (10 / 30 / 50) become the default seed values for the
  `GlobalSettings` integer fields. Admins can change them per tenant from day one.
- "This month" is calendar-month based on UTC at the time of the query — there is no
  per-tenant timezone offset in v1.
- Image upload reuses whichever existing presigned-URL S3 flow the implementing developer finds
  closest in shape. The PRD does not lock this in.
- The achievement evaluator runs synchronously in the same transaction as the award. If load
  testing later proves this is too slow to be in the request path, the after-commit hook
  variant is the documented escape hatch.
- All new entities are tenant-scoped via `tenantId` and the existing `withTenantIdIndex`
  convention. No cross-tenant reads anywhere in this feature.
- No new permission entries: admin surfaces reuse the existing tenant-admin permission, student
  surfaces reuse standard authenticated-user gating.
