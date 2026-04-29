# Slice 7 — Leaderboard all-time + own rank

## Type

#AFK

## What to build

Stand up the leaderboard end-to-end for a single scope: All-time. Group filter and the "This
month" tab arrive in slice #8.

Backend:

- `LeaderboardQueryService` exposes `query({ tenantId, scope: 'all-time', viewerId }) → {
  top10, ownRank, ownRow }`.
- All-time query: `SELECT user.id, user.fullName, user.avatar, user_statistics.totalPoints,
  user_statistics.lastPointAt FROM users JOIN user_statistics ... WHERE tenantId = current AND
  role = student ORDER BY totalPoints DESC, lastPointAt ASC LIMIT 10`.
- `ownRank` is computed via a window-function query (`RANK() OVER (ORDER BY totalPoints DESC,
  lastPointAt ASC)`) against the same filtered set, so the value is correct whether the
  viewer is inside or outside the top 10.
- `ownRow` is the viewer's row (avatar, full name, points) when they have at least one point
  event recorded.
- Endpoint: `GET /leaderboard?scope=all-time` behind authenticated-student gating.

Frontend:

- New leaderboard page (route in the standard student section).
- Header for the "All-time" tab (the only tab in this slice).
- Top-10 list: avatar, full name, points per row.
- Viewer's row visually highlighted when present in the top 10.
- Sticky "You: #N" row beneath the top 10 when the viewer is outside it. Hidden when the
  viewer is inside the top 10 (already highlighted there).
- Empty state when the tenant has no students with points yet.

Tie-breaker is `lastPointAt ASC` per spec — whoever reached the score earlier ranks higher.

See `CURRENT-WORK/gamification-prd.md` sections "Backend modules (new)" →
`LeaderboardQueryService` and "Frontend modules (new)" → Leaderboard page.

## Acceptance criteria

- [ ] `LeaderboardQueryService` exposes a single all-time query method scoped to `tenantId`
  and `role = student`.
- [ ] Result includes top 10 rows ordered by `totalPoints DESC, lastPointAt ASC`.
- [ ] Result includes `ownRank` (1-based, full-tenant rank of the viewer) regardless of
  whether the viewer is in the top 10.
- [ ] Result includes `ownRow` with avatar, full name, points when the viewer has any point
  events.
- [ ] `GET /leaderboard?scope=all-time` is accessible to authenticated students; non-students
  do not appear in the result rows.
- [ ] Frontend leaderboard page renders the All-time tab, top-10 list, and the sticky own-rank
  row when the viewer is outside the top 10.
- [ ] Viewer's row is visually highlighted when present in the top 10.
- [ ] Empty state renders when no students have any points.
- [ ] Integration tests against Postgres: ordering correctness, tiebreaker by `lastPointAt`,
  own-rank computation when viewer is inside and outside the top 10, staff filtered out.

## Blocked by

- Blocked by #1

## User stories addressed

- User story 16
  - As a student, I want to open a leaderboard view that lists the top 10 students in my
    tenant by total points, so that I can see who is ahead.
- User story 19
  - As a student, I want the default filter to be "the whole company" with no group
    restriction, so that the headline view is the broadest one.
- User story 21
  - As a student, I want my own row highlighted when I am inside the top 10, so that I can
    spot myself instantly.
- User story 22
  - As a student, I want a sticky "You: #N" row beneath the top 10 when I am outside it, so
    that I always know where I stand without scrolling.
- User story 23
  - As a student, I want each leaderboard row to show avatar, full name, and points, so that
    I can identify peers at a glance.
- User story 24
  - As a student, I want ties broken so that whoever reached the score earlier ranks higher,
    so that the ordering feels deterministic.
