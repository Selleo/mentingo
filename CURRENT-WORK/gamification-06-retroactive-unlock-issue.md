# Slice 6 — Retroactive unlock on threshold edit

## Type

#AFK

## What to build

Make admin threshold edits and new-achievement creation retroactively unlock the badge for
every user already past the threshold, in the same DB request. Reuse the `AchievementEvaluator`
from slice #5; this slice is the admin-side wiring plus tests.

Behavior:

- **Threshold lower** (or new achievement with a threshold already met by some users): in the
  same DB transaction as the threshold update, run the evaluator across all users with
  `totalPoints >= newThreshold` who do not already hold the badge, and insert one
  `user_achievements` row per qualifying user. Synchronous, in-request.
- **Threshold raise**: leave existing `user_achievements` rows untouched. No revoke. New
  unlocks for the badge are gated on the new (higher) threshold from this point forward.
- **Soft-delete an achievement**: existing `user_achievements` rows for that achievement are
  preserved; the badge remains visible on the profile of any user who already holds it,
  disappears from the locked-badge tier and from the admin default list view.

The PRD acknowledges that synchronous backfill is acceptable at v1 scale; if request timeouts
emerge under future load, the documented escape hatch is the existing outbox-based async
pipeline. Not in scope for this slice.

See `CURRENT-WORK/gamification-prd.md` sections "Retroactive unlocks on threshold edits" and
"Out of scope" → async retroactive unlock.

## Acceptance criteria

- [ ] Admin endpoint for editing an achievement runs retroactive unlock evaluation in the same
  DB transaction when the new threshold is lower than the previous one.
- [ ] Admin endpoint for creating an achievement runs retroactive unlock evaluation in the
  same DB transaction when any existing user's `totalPoints` meets the threshold.
- [ ] Threshold raise leaves existing `user_achievements` rows untouched; no badge is revoked.
- [ ] Soft-deleting an achievement preserves all existing `user_achievements` rows for that
  achievement; users who hold it continue to see it on their profile in earned-state.
- [ ] Soft-deleted achievement no longer appears in the locked-badge tier on any profile and
  no longer appears in the admin default list view.
- [ ] Unit tests on `AchievementEvaluator` retro behavior: threshold lower unlocks all
  qualifying users, threshold raise no-ops, soft-delete excluded from active catalog.
- [ ] Integration test: admin lowers threshold via API → multiple `user_achievements` rows
  inserted in same transaction → toast-triggering payload not required for this admin path.

## Blocked by

- Blocked by #5

## User stories addressed

- User story 29
  - As a tenant admin, I want lowering a threshold to retroactively unlock the badge for
    every user already past it within the same request, so that the change feels immediate
    and fair.
- User story 30
  - As a tenant admin, I want raising a threshold to leave existing unlocks in place, so that
    I do not accidentally take rewards away.
- User story 31
  - As a tenant admin, I want to soft-delete an achievement so that it disappears from the
    catalog and from locked-badge slots on profiles but remains visible on profiles of users
    who already hold it, so that history is preserved.
