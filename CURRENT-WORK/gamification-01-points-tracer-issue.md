# Slice 1 — Points tracer: chapter completion → ledger → profile total

## Type

#AFK

## What to build

End-to-end tracer bullet for the points pipeline using only chapter completion as the input
event. Schema, service, listener, API, and minimal frontend display all land together so that
completing a chapter increments a real, idempotent points total visible on the student's own
profile. Course completion and AI mentor pass are intentionally deferred to slice #2; tenant
configuration and per-entity overrides are deferred to slice #3.

Default point values are hardcoded as constants in this slice (chapter = 10, AI pass = 30,
course = 50 per the original Polish brief). The constants are the only resolution path the
service knows about until slice #3 introduces tenant defaults and overrides.

`PointsService.award()` is the single entry point. It opens a DB transaction, attempts an insert
into `point_events` protected by a unique index on `(userId, eventType, entityId)`, increments
`totalPoints` on `user_statistics` and writes `lastPointAt` on success, and returns. Duplicate
events are silent no-ops. The role gate lives inside the service: non-student callers fall
through without any DB write.

See `CURRENT-WORK/gamification-prd.md` sections "Backend modules (new)", "Schema", and "Award
atomicity and idempotency" for the canonical shape.

## Acceptance criteria

- [ ] `point_events` table exists with `(tenantId, userId, eventType, entityId, points,
  createdAt)` and a unique index on `(userId, eventType, entityId)`.
- [ ] `user_statistics` has new columns `totalPoints integer not null default 0` and
  `lastPointAt timestamp` (nullable).
- [ ] `PointsService.award(userId, eventType, entityId, tenantId)` exists and runs in one DB
  transaction.
- [ ] A duplicate `(userId, eventType, entityId)` award is a no-op — no new ledger row, no
  total change, no error surfaced to the caller.
- [ ] Awards for non-student users are no-ops at the role gate inside `PointsService`.
- [ ] A new `UserChapterFinished` listener calls `PointsService.award` with `eventType =
  chapter_completed`.
- [ ] `/me` (or equivalent profile endpoint) response includes `gamification: { totalPoints,
  lastPointAt }`.
- [ ] The Profile page renders the lifetime point total in a visible block.
- [ ] Resetting/deleting a chapter does not delete ledger rows or decrement totals.
- [ ] Unit tests cover: idempotency on duplicate event, role gate no-op for non-students,
  rollback when total bump fails, append-only behavior on chapter reset.
- [ ] No backfill: completions that happened before this slice ships do not produce ledger
  rows.

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1
  - As a student, I want to receive points automatically when I complete a chapter, so that I
    am rewarded for finishing a unit of work without having to claim anything manually.
- User story 4
  - As a student, I want my point total to update immediately on completion, so that the
    feedback loop feels tight.
- User story 5
  - As a student, I do not want to be able to farm points by re-completing the same chapter,
    lesson, or course, so that the leaderboard reflects real progress.
- User story 6
  - As a student, I want my earned points to never be revoked if a course or chapter is reset,
    reorganized, or deleted, so that my history is stable.
- User story 7
  - As a student, I want to see my lifetime point total on my own profile, so that I have a
    single place to check my progress.
- User story 37
  - As an operator, I want every point award to be idempotent on `(userId, eventType,
    entityId)`, so that retried events and duplicate webhooks do not inflate totals.
- User story 38
  - As an operator, I want the awarding ledger to be append-only with a snapshot of the points
    value at award time, so that defaults can change without rewriting history.
- User story 39
  - As an operator, I want the user's denormalized total and `lastPointAt` to be updated in
    the same transaction as the ledger insert, so that reads are consistent.
- User story 40
  - As an operator, I want staff (non-student) completion events to flow through the same
    pipeline but be no-op'd at the role gate, so that adding new participating roles later is
    a one-line change.
- User story 41
  - As an operator, I want gamification to be always on for every tenant with no feature flag,
    so that there is no per-tenant configuration drift.
- User story 42
  - As an operator, I want no backfill of points for completions made before deploy, so that
    rollout has a hard, auditable starting line.
