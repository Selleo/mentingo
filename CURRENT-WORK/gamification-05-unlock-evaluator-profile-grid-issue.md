# Slice 5 — Unlock evaluator + profile grid + toasts

## Type

#AFK

## What to build

Wire the achievement catalog into the points pipeline and surface the result on the student's
profile.

Backend:

- Introduce `AchievementEvaluator` as a pure function `(currentTotal, heldAchievementIds,
  activeCatalog) → newlyUnlockedIds`. No DB inside the function — all data is passed in.
- A thin repository layer fetches `activeCatalog` (achievements where `isActive = true`) and
  `heldAchievementIds` for the user, calls the evaluator, and inserts one `user_achievements`
  row per newly qualifying badge inside the same transaction as `PointsService.award`.
- The `award` return value gains `newlyUnlocked: Achievement[]`.
- Completion mutations (chapter, course, AI mentor pass) propagate `newlyUnlocked` into their
  HTTP response under `gamification: { pointsAwarded, newlyUnlocked }`.

Frontend:

- New profile achievements grid section, added inline to the existing Profile page (no new
  route, no modal). Renders the full active catalog merged with the viewer's
  `user_achievements`:
  - Earned badges: full color, `unlockedAt` shown on hover/tooltip.
  - Locked badges: grayscale image, progress bar `currentTotal / pointThreshold`, label with
    points remaining.
  - Sort by `pointThreshold ASC`, then `createdAt ASC`.
- Toast handler attached to the three completion mutations: each entry in `newlyUnlocked`
  triggers one toast.
- No persisted in-app notification, no email, no `/me/pending-unlocks` polling endpoint.

Other students' profiles remain unexposed in v1.

See `CURRENT-WORK/gamification-prd.md` sections "Backend modules (new)" → `AchievementEvaluator`
and "Frontend modules (new)" → Achievements section + Toast handler.

## Acceptance criteria

- [ ] `AchievementEvaluator` exists as a pure function with no DB or service dependencies; its
  signature accepts current total, held ids, active catalog and returns newly unlocked ids.
- [ ] `PointsService.award` runs the evaluator inside the same transaction as the ledger
  insert and the total bump, persists the resulting `user_achievements` rows, and returns
  them to the caller.
- [ ] A single completion event that crosses multiple thresholds returns and persists every
  newly unlocked badge.
- [ ] Soft-deleted achievements are not present in the active catalog passed to the evaluator,
  so they cannot be newly unlocked.
- [ ] Completion mutation responses (chapter, course, AI mentor pass) carry `gamification: {
  pointsAwarded, newlyUnlocked }`.
- [ ] Profile page renders the full active achievement catalog in a single grid with earned
  vs. locked rendering, progress bars, and the documented sort order.
- [ ] Earned badges display `unlockedAt` on hover/tooltip.
- [ ] Toasts fire once per entry in `newlyUnlocked` on completion. Multiple unlocks from one
  completion produce multiple toasts.
- [ ] No `/me/pending-unlocks` endpoint exists; no persisted notifications; no emails.
- [ ] Other users' profile pages are not exposed.
- [ ] Unit tests on `AchievementEvaluator`: multiple unlocks from one award, soft-deleted
  excluded from active catalog, already-held excluded from new unlocks, threshold equality is
  inclusive (`total >= threshold`).

## Blocked by

- Blocked by #1
- Blocked by #4

## User stories addressed

- User story 8
  - As a student, I want to see every achievement in my tenant's catalog on my profile, so
    that I know what is available to earn.
- User story 9
  - As a student, I want unlocked achievements to render in full color with the date I
    unlocked them on hover, so that I can take pride in past wins.
- User story 10
  - As a student, I want locked achievements to render in grayscale with a progress bar
    showing `currentTotal / threshold` and the points remaining, so that I have a concrete
    next goal.
- User story 11
  - As a student, I want achievements sorted by threshold ascending so the next attainable
    badge appears near the top of the locked tier, so that motivation aligns with proximity.
- User story 12
  - As a student, I do not want to see other students' profile pages in v1, so that the
    leaderboard remains the single comparison surface.
- User story 13
  - As a student, I want a toast to appear when I unlock a new achievement, so that I notice
    the reward without having to check my profile.
- User story 14
  - As a student, I want multiple toasts when a single completion crosses multiple
    thresholds, so that no unlock is silently swallowed.
- User story 15
  - As a student, I do not want unlock emails or persisted in-app notifications in v1, so
    that the experience stays lightweight.
