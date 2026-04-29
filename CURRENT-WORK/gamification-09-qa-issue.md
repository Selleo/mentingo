# Slice 9 — Manual QA pass

## Type

#HITL

## What to build

A consolidated end-to-end manual QA pass across all gamification flows shipped in slices #1–#8,
executed against a staging environment seeded with realistic tenant + group + student data.
This issue exists because automated coverage stops at unit + service-level integration; toast
behavior, locale rendering, image upload UX, profile rendering at scale, and admin retroactive
flows benefit from human verification.

Out of scope for automated tests per the PRD: end-to-end completion → toast pipeline. Cover it
here instead.

### QA test plan

#### A. Points pipeline (slices #1, #2, #3)

1. As a student, complete a chapter for the first time → confirm point total updates on
   profile and a row appears in `point_events`.
2. Complete the same chapter again (re-trigger via teacher reset or platform mechanism) →
   confirm no second ledger row, no total change, no error toast.
3. Pass an AI mentor lesson for the first time → confirm award, ledger row with `eventType =
   ai_pass`, total update.
4. Re-pass the same AI mentor lesson → confirm no double-award.
5. Finish a course for the first time → confirm award and total update.
6. Re-finish the same course → confirm no double-award.
7. As a tenant admin (not student), complete a chapter → confirm no point award, no ledger
   row.
8. As a tenant admin, change a tenant default points value → complete a new chapter as a
   student → confirm new value used. Then inspect a ledger row from before the change →
   confirm `points` snapshot is the old value.
9. As a tenant admin, set a chapter's `pointsOverride` to 100 with the toggle off → student
   completes that chapter → 100 points awarded. Toggle on → next student completion uses
   tenant default.
10. As a tenant admin, set a chapter's `pointsOverride` to 0 with the toggle off → student
    completion creates a ledger row with `points = 0` and the total does not change.

#### B. Achievements catalog (slice #4)

11. As a tenant admin, create an achievement with image, all locales filled, threshold = 50,
    isActive = true → confirm visible in admin list.
12. Create a second achievement with the same threshold (50) → confirm allowed.
13. Edit threshold from 50 to 75 → confirm persisted, but no user_achievements rows are
    revoked (verify in slice #6 retroactive flow).
14. Soft-delete an achievement → disappears from default admin list, can be filtered in.
15. Verify the create/edit form rejects `pointThreshold < 1`.
16. Upload an image larger than the configured cap → graceful error, no orphan S3 object.

#### C. Unlock evaluator + profile + toasts (slice #5)

17. As a student with `totalPoints` just below a threshold, complete one more entity that
    crosses it → toast appears with the badge, profile shows badge in earned state.
18. Complete an entity whose award value crosses two thresholds at once → two toasts appear,
    two earned badges on profile.
19. Confirm locked badges render in grayscale with progress bar (`current / threshold`) and
    points-remaining label.
20. Confirm earned badges render in full color and show `unlockedAt` on hover.
21. Confirm the achievements grid sorts by `pointThreshold ASC` then `createdAt ASC`.
22. Confirm soft-deleted achievement disappears from the locked tier of a student who has not
    earned it but stays visible (earned, in color) on the profile of a student who already
    holds it.
23. Confirm no email is sent on unlock and no persisted in-app notification appears.
24. Switch UI locale → confirm achievement name and description render in the new locale on
    both profile and admin list.
25. Confirm there is no public profile page for other students.

#### D. Retroactive unlock (slice #6)

26. As a tenant admin, lower an achievement's threshold below the current totals of multiple
    students → confirm those students immediately have the badge in the admin DB inspection
    AND see it on their profile in earned state on next refresh.
27. Raise an achievement's threshold → confirm previously-earned holders keep the badge.
28. Soft-delete an achievement that has existing holders → holders still see it; non-holders
    no longer see it in the locked tier.

#### E. Leaderboard (slices #7, #8)

29. Open the leaderboard as a student in the top 10 → confirm own row highlighted, no sticky
    own-rank row at bottom.
30. Open the leaderboard as a student outside the top 10 → confirm sticky "You: #N" row
    appears with the correct rank.
31. Open the leaderboard as a student with zero points → confirm rendering is sane (rank
    behavior verified against spec — typically empty `ownRow`).
32. Switch to the "This month" tab → confirm ordering changes to monthly aggregation.
33. Confirm a student who earned points last month but none this month does not appear in
    "This month" results.
34. Tiebreaker check (all-time): construct two students with equal totals → the one with
    earlier `lastPointAt` ranks higher.
35. Tiebreaker check (monthly): two students with equal monthly sums → the one whose
    last-point-this-month is earlier ranks higher.
36. Apply a group filter → confirm only members of that group appear, ordering and ranks
    recompute against the group set.
37. Confirm the group dropdown lists every group in the tenant, including groups the viewer
    is not a member of.
38. Confirm staff (admin/teacher) never appear in any leaderboard result row.
39. Combine "This month" + group filter → confirm both restrictions apply and own rank is
    correct.

#### F. Configuration drift / always-on

40. Confirm there is no per-tenant feature flag for gamification — all tenants have the
    Achievements admin section, the leaderboard route, and the profile section.
41. Confirm completions made before the deploy of slice #1 do not appear in `point_events`.

### Sign-off

- [ ] All test cases above pass on staging against seeded multi-tenant data.
- [ ] Edge cases noted during QA (if any) are filed as follow-up issues, not as v1 blockers
  unless they violate a PRD acceptance criterion.

## Blocked by

- Blocked by #1
- Blocked by #2
- Blocked by #3
- Blocked by #4
- Blocked by #5
- Blocked by #6
- Blocked by #7
- Blocked by #8

## User stories addressed

This QA pass verifies every user story in the PRD (1–42) against the deployed system. Stories
are not re-quoted here; refer to `CURRENT-WORK/gamification-prd.md` and the individual slice
issues for canonical text. The test plan above is organized so that each section (A–F) maps
to the slices that delivered the corresponding stories.
