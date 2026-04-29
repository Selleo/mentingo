# Gamification

Feature spec and functional design for the gamification system: points, achievements, leaderboard.

## 1. Feature description

### 1.1 Original request (Polish, verbatim)

> **Grywalizacja: osiągnięcia**
> Użytkownik widzi w profilu osiągnięcia które zdobył i do których brakuje mu jeszcze punktów.
> Osiągnięcia mogą być zarządzane przez admina (każde osiągnięcie to obrazek i limit punktów).
>
> **Grywalizacja: ranking**
> Użytkownik ma możliwość wyświetlić ranking pozostałych użytkowników, top 10 osób z największą
> liczbą punktów. Można filtrować ranking po grupach, domyślnie filtr ustawiony jest na wszystkich
> w firmie.
>
> **Grywalizacja: zbieranie punktów**
> Użytkownik otrzymuje punkty za niektóre akcje w platformie, przykładowo:
> - Ukończenie Chaptera: 10 pkt
> - Zaliczona rozmowa z AI: 30 pkt
> - Ukończenie całego kursu: 50 pkt
>
> Zebrane punkty są wyświetlone w profilu użytkownika.

### 1.2 Summary

Three coupled subfeatures:

1. **Points** — students earn points for completing learning activities (chapters, AI mentor
   passes, courses). Total displayed on the user's own profile.
2. **Achievements** — admin-managed catalog of badges (image + point threshold). Auto-unlocked
   when a user's total reaches the threshold. Profile shows earned badges and progress to locked
   ones.
3. **Leaderboard** — top 10 students by points within the tenant ("cała firma"), with a group
   filter. The viewer's own rank is always visible, even outside the top 10.

### 1.3 Out of scope (v1)

- Non-threshold achievement criteria (streaks, "finish 3 courses", etc.) — threshold only.
- Public profile pages for other users.
- Email notifications on unlock.
- Pagination beyond top 10 (deferred).
- Per-tenant feature flag (always on globally).
- Negative points / penalties / clawbacks.
- Backfill of points for completions made before deploy.

---

## 2. Decisions log

Every row below was answered explicitly during requirements gathering. Implementation must not
deviate without re-discussion.

| # | Topic | Decision |
|---|-------|----------|
| 1 | Achievement criteria | Points threshold only |
| 2 | Achievement fields | image + multilingual name + multilingual description + threshold |
| 3 | Achievement scope | Per-tenant catalog |
| 4 | Point values | Per-tenant defaults + per-entity (chapter/course/AI lesson) override |
| 5 | Repeat policy | Once per (user, eventType, entityId) ever — no farming |
| 6 | Reversal policy | Earned points and unlocked achievements never revoked |
| 7 | Backfill | None — only forward from deploy |
| 8 | Total storage | Append-only ledger + denormalized total on user |
| 9 | Leaderboard size | Top 10 |
| 10 | Leaderboard scope | Tenant-wide default + group filter |
| 11 | Group filter visibility | All groups in tenant pickable |
| 12 | Own-rank visibility | Always shown, even outside top 10 |
| 13 | Time window | All-time + "this month" tabs |
| 14 | Row identity | Avatar + full name + points |
| 15 | Tie-breaker | `ORDER BY totalPoints DESC, lastPointAt ASC` |
| 16 | Profile UI | Single grid: earned in color, locked grayscale + progress bar |
| 17 | Profile visibility | Own profile only |
| 18 | Admin permission | Reuse existing tenant-admin permission |
| 19 | Award trigger | NestJS event listeners on existing completion events |
| 20 | Unlock notification | Toast on next page load |
| 21 | Image upload | Reuse existing S3 presigned-URL flow |
| 22 | Duplicate thresholds | Allowed |
| 23 | Threshold edit | Re-evaluate on save — retroactive unlock for qualifying users |
| 24 | Achievement delete | Soft-delete (`isActive`); existing unlocks preserved |
| 25 | Staff on leaderboard | Students only; staff don't accumulate points |
| 26 | Feature flag | None — always on |

---

## 3. Functional specification

### 3.1 Points

#### 3.1.1 Earning events

Points are awarded when one of these existing events fires successfully for the first time per
entity:

| Event | Source | Default points |
|-------|--------|---------------:|
| Chapter completion | `UserChapterFinished` event | 10 |
| AI mentor lesson pass | `aiMentorStudentLessonProgress.passed = true` (new event needed) | 30 |
| Course completion | `UserCourseFinished` event | 50 |

Defaults are per-tenant settings; each chapter, course, and AI mentor lesson row may store an
optional `points` override that wins when present.

#### 3.1.2 Award rules

- **Idempotency**: ledger has a unique key on `(userId, eventType, entityId)`. A second
  completion event for the same entity is a no-op.
- **Atomicity**: in a single DB transaction the system inserts the ledger row, increments the
  user's denormalized `totalPoints`, sets `lastPointAt`, and runs achievement re-evaluation for
  that user.
- **Role gating**: only users with the student role accrue points. Staff completion events are
  ignored for points purposes.
- **No reversal**: undoing/resetting a completion does not delete ledger rows or decrement
  totals. Earned is earned.
- **No backfill**: completions that happened before deploy do not produce ledger rows.

#### 3.1.3 Configuration surface

- Tenant settings: `defaultChapterPoints`, `defaultCoursePoints`, `defaultAiPassPoints` (all
  integers ≥ 0; 0 means "no points for this action").
- Per-entity override: nullable integer column on `chapters`, `courses`, `aiMentorLessons`.

### 3.2 Achievements

#### 3.2.1 Data fields

Per achievement (tenant-scoped):

- `id`, `tenantId`
- `imageReference` (S3 key, uploaded via existing presigned-URL flow)
- `pointThreshold` (integer ≥ 1)
- `name` — translatable across pl/en/de/lt/cs (existing locales)
- `description` — translatable across same locales
- `isActive` (soft-delete flag)
- `createdAt`, `updatedAt`

A user can unlock the same achievement at most once. Unlock is recorded in `userAchievements`
with `(userId, achievementId, unlockedAt)`.

#### 3.2.2 Unlock rules

- After every points award, re-evaluate that user's `totalPoints` against all active
  achievements they don't yet hold; insert one `userAchievement` row per newly qualifying badge.
- Duplicate thresholds are allowed; multiple achievements may unlock from a single event.
- When admin **lowers** an achievement's threshold (or creates one with a low threshold), all
  users whose `totalPoints` already meet it are retroactively granted the badge in the same
  request.
- When admin **raises** a threshold, users who already hold the badge keep it. No revocation.
- **Soft delete** flips `isActive = false`. The badge disappears from admin catalog and from
  locked-badge slots on profiles, but remains visible on profiles of users who already hold it.

#### 3.2.3 Notification

After a request that unlocks one or more badges, the response (or a `/me/pending-unlocks`
endpoint read on next page load) returns the unlocked achievements. The frontend shows a toast
per unlock and clears the pending state. No persisted in-app notification, no email.

### 3.3 Leaderboard

#### 3.3.1 Query

Two tabs:

- **All-time** — `ORDER BY totalPoints DESC, lastPointAt ASC LIMIT 10`, scoped to
  `tenantId = current` and `role = student`.
- **This month** — `SUM(points) FROM pointEvents WHERE createdAt >= startOfCurrentMonth`,
  grouped by user, same ordering rule (tiebreak by earliest `MAX(createdAt)`), same scope.

#### 3.3.2 Group filter

- Default: no group filter ("cała firma" — entire tenant).
- Dropdown lists every group in the tenant; selecting one restricts the query to members of that
  group via the existing `groupUsers` junction.

#### 3.3.3 Row content

Each row: avatar, full name, points. The current viewer's row is highlighted.

#### 3.3.4 Own rank

A separate response field returns the viewer's rank (1-based) within the same filtered query —
even if outside the top 10. Rendered as a sticky "You: #N" row beneath the top 10 when the
viewer isn't already in the list.

### 3.4 Profile

The user's own profile shows:

- **Total points** (lifetime).
- **Achievements grid**: every active achievement in the tenant catalog rendered together.
  - Earned: full color, with `unlockedAt` date on hover/tooltip.
  - Locked: grayscale image + progress bar `currentTotal / pointThreshold` and the delta to go.
- Sorted by `pointThreshold ASC`, then `createdAt ASC`.

Other users' profiles are not exposed in v1. The leaderboard is the only place a user sees other
users' point standings.

### 3.5 Admin panel

Admins (existing tenant-admin permission) get a new section:

- **Achievements CRUD**
  - List view: image, name, threshold, isActive, createdAt.
  - Create/edit form: image upload, multilingual name + description, integer threshold ≥ 1,
    isActive toggle.
  - Soft-delete action (sets `isActive = false`).
- **Tenant point defaults** — three integer inputs (chapter / AI pass / course).
- **Per-entity overrides** — points input added to existing course editor, chapter editor, and
  AI mentor lesson editor. Empty input = "use tenant default".

Editing an achievement's threshold runs retroactive unlock evaluation in the same request.

### 3.6 Permissions

- View own points + achievements: any authenticated user (only own profile).
- View leaderboard: any authenticated student in the tenant.
- Manage achievements + point defaults + per-entity overrides: existing tenant-admin permission.
- No new permission entries are introduced.

---

## 4. Data model (target shape)

> Field names are illustrative; final naming follows Drizzle conventions in
> `apps/api/src/storage/schema/index.ts`. All tables include `tenantId` and `withTenantIdIndex`.

### `point_events` (append-only ledger)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | pk |
| tenantId | uuid | scope |
| userId | uuid | fk users |
| eventType | enum | `chapter_completed` / `ai_pass` / `course_completed` |
| entityId | uuid | chapter / aiMentorLesson / course id |
| points | integer | snapshot at award time (so later config changes don't rewrite history) |
| createdAt | timestamp | |

Unique index: `(userId, eventType, entityId)`.
Range index for monthly leaderboard: `(tenantId, createdAt)`.

### `users` / `user_statistics`

Add to `user_statistics` (or `users`, whichever is closer):

- `totalPoints` integer not null default 0
- `lastPointAt` timestamp nullable

### `achievements`

| Column | Type |
|--------|------|
| id, tenantId, createdAt, updatedAt | standard |
| imageReference | text |
| pointThreshold | integer |
| isActive | boolean default true |

### `achievement_translations`

`(achievementId, locale)` → `name`, `description`. One row per supported locale per achievement.

### `user_achievements`

| Column | Type | Notes |
|--------|------|-------|
| id, tenantId | standard | |
| userId | uuid | fk |
| achievementId | uuid | fk |
| unlockedAt | timestamp | |

Unique index: `(userId, achievementId)`.

### `tenant_settings` (extended)

Add columns:

- `defaultChapterPoints` integer default 10
- `defaultCoursePoints` integer default 50
- `defaultAiPassPoints` integer default 30

### `chapters`, `courses`, `ai_mentor_lessons`

Add nullable integer column `pointsOverride`.

---

## 5. Integration points

- **Event listeners** — new module subscribes to `UserChapterFinished`, `UserCourseFinished`, and
  a new AI-mentor-pass event (must be added; currently AI mentor pass writes
  `aiMentorStudentLessonProgress.passed = true` without emitting an event).
- **Existing event files** at `apps/api/src/events/user/` — add `ai-mentor-passed.event.ts`.
- **Service** — `PointsService` exposes `award(userId, eventType, entityId)` that resolves the
  effective point value (override → tenant default → 0), inserts the ledger row, bumps total,
  evaluates achievements, and returns newly unlocked badges.
- **Frontend** — TanStack Query hooks for: own profile (points + achievements grid),
  leaderboard (with tab + group filter + own rank), pending unlock toasts.
- **Profile page** — `apps/web/app/modules/Profile/Profile.page.tsx` extended.
- **Admin panel** — new module under `apps/web/app/modules/Admin/Achievements/` plus point
  inputs added to existing course/chapter/AI mentor editors and tenant settings page.
- **i18n** — new keys for UI strings under `apps/web/app/locales/<locale>/`. Achievement
  name/description are stored per-locale in `achievement_translations` (data, not i18n bundle).

---

## 6. Open implementation questions (not requirements)

Resolved as part of writing the implementation plan, not the spec:

- Exact column placement (`users` vs `user_statistics`) for `totalPoints`.
- API shape: single `/me` payload that includes pending unlocks, or a separate
  `/me/pending-unlocks` endpoint.
- Whether the achievement evaluation runs synchronously in the awarding transaction or in an
  after-commit hook (synchronous is the default given expected volume).
- Caching strategy for the leaderboard (none in v1 unless load tests show otherwise).
