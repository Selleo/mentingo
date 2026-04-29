# Slice 8 — Leaderboard monthly tab + group filter

## Type

#AFK

## What to build

Extend the leaderboard from slice #7 with the second scope (`'month'`) and a group filter.
Schema, page route, and the All-time tab from slice #7 are reused.

Backend:

- `LeaderboardQueryService.query` accepts `scope: 'all-time' | 'month'` and an optional
  `groupId`.
- Monthly query: aggregates `point_events` since the start of the current calendar month
  (UTC), grouped by `userId`. Ordering is `SUM(points) DESC, MAX(createdAt) ASC` (earliest to
  reach the score wins ties). Joined with users for avatar / fullName / role-filter (`role =
  student`).
- Group filter (applies to both scopes): when `groupId` is supplied, the query joins
  `group_users` on `userId = group_users.userId AND group_users.groupId = :groupId`.
- `ownRank` continues to be computed via the same `RANK()` query against the same filter set
  for both scopes, so it's correct even outside the top 10.
- Endpoint signature: `GET /leaderboard?scope=all-time|month&groupId=<uuid?>`.

Frontend:

- Tab control on the leaderboard page: "All-time" / "This month".
- Group filter dropdown listing every group in the tenant (not just the viewer's groups —
  spec decision #11).
- Default state: All-time, no group filter ("cała firma").
- Viewer-row highlight, sticky own-rank row, empty state, and row content all behave
  identically across both tabs.

See `CURRENT-WORK/gamification-prd.md` sections "Backend modules (new)" →
`LeaderboardQueryService` and "Decisions log" rows 11–13.

## Acceptance criteria

- [ ] `LeaderboardQueryService.query` supports `scope: 'all-time' | 'month'` and optional
  `groupId`.
- [ ] Monthly query aggregates `SUM(points)` over `point_events` where `createdAt >=
  startOfCurrentMonth (UTC)`, grouped by `userId`, ordered by `SUM(points) DESC, MAX(createdAt)
  ASC LIMIT 10`.
- [ ] When `groupId` is supplied, results are restricted to members of that group via
  `group_users`. When omitted, results span the whole tenant.
- [ ] Group filter dropdown lists every group in the tenant, including ones the viewer does
  not belong to.
- [ ] Tab control switches between All-time and This month without unmounting the page; group
  filter persists across tab switches.
- [ ] Default page state is All-time with no group filter.
- [ ] `ownRank` is computed correctly under both scopes and under the group filter, including
  when the viewer is outside the top 10.
- [ ] Empty state renders for tabs/filters that yield no rows.
- [ ] Integration tests against Postgres: monthly aggregation correctness, monthly tiebreaker
  by `MAX(createdAt) ASC`, group-filtered queries, own-rank under monthly + group filter.

## Blocked by

- Blocked by #7

## User stories addressed

- User story 17
  - As a student, I want to switch to a "This month" tab that ranks by points earned in the
    current calendar month, so that I have a chance to climb without competing against legacy
    accumulation.
- User story 18
  - As a student, I want to filter the leaderboard by group, so that I can compare myself to
    classmates rather than the whole tenant.
- User story 20
  - As a student, I want to be able to filter by any group in the tenant, even ones I am not
    a member of, so that I can scout other cohorts.
