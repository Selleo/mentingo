# Slice 3 — Tenant point defaults + per-entity overrides

## Type

#AFK

## What to build

Replace the hardcoded point constants from slices #1 and #2 with two layers of admin-controlled
configuration:

1. **Tenant-level defaults** — three integer fields on the existing `GlobalSettings` JSONB type
   (per-tenant settings row): `defaultChapterPoints`, `defaultCoursePoints`, `defaultAiPassPoints`.
   Initial seed values are 10 / 50 / 30 (matching the previous constants and the original Polish
   brief). Admins edit them from the existing tenant settings page.
2. **Per-entity overrides** — nullable integer column `pointsOverride` on `chapters`, `courses`,
   and `ai_mentor_lessons`. The chapter, course, and AI mentor lesson editors gain a "Use tenant
   default" toggle plus a number input that is enabled only when the toggle is off, so empty
   (null = use default) is unambiguously distinct from explicit zero.

`PointsService` resolves the effective value at award time as: per-entity override → tenant
default → 0. The integer is snapshotted into the `point_events.points` column, so subsequent
admin edits never rewrite past totals or history.

All admin surfaces in this slice gate behind the existing tenant-admin permission. No new
permission entries are introduced.

See `CURRENT-WORK/gamification-prd.md` sections "Schema" → `pointsOverride` columns and
"Backend modules (modified)" → `GlobalSettings` extension.

## Acceptance criteria

- [ ] `GlobalSettings` type and the persisted JSONB blob include `defaultChapterPoints`,
      `defaultCoursePoints`, `defaultAiPassPoints` (all integers ≥ 0). Migration seeds existing
      tenants with 10 / 50 / 30.
- [ ] `chapters`, `courses`, and `ai_mentor_lessons` each have a nullable integer
      `pointsOverride` column.
- [ ] `PointsService.award` resolves effective points via override → tenant default → 0 and
      snapshots the resolved value into `point_events.points`.
- [ ] Admin tenant settings page renders three integer inputs for the defaults; saving
      persists to the JSONB blob and is gated by tenant-admin permission.
- [ ] Each of the chapter, course, and AI mentor lesson editors renders a "Use tenant default"
      toggle and a number input enabled only when the toggle is off. Saving with the toggle on
      persists `null`; saving with the toggle off persists the integer (0 allowed).
- [ ] Editing a tenant default or a per-entity override does not change any existing
      `point_events` row or any user's `totalPoints`.
- [ ] Unit tests cover all three branches of effective-value resolution (override present,
      override null with default present, both zero).

## Blocked by

- Blocked by #1
- Blocked by #2

## User stories addressed

- User story 32
  - As a tenant admin, I want to set tenant-level default points for chapter completion, AI
    mentor pass, and course completion, so that I can tune incentive density once for the
    whole tenant.
- User story 33
  - As a tenant admin, I want to override the default points on a specific chapter, course,
    or AI mentor lesson, so that I can boost or zero out specific units.
- User story 34
  - As a tenant admin, I want a clear toggle that distinguishes "use the tenant default" from
    "this entity is worth zero points", so that I never accidentally suppress all rewards on
    an entity I meant to leave on default.
- User story 35
  - As a tenant admin, I want changes to defaults or overrides to apply only to future awards
    and never to rewrite past totals or history, so that the ledger is trustworthy.
- User story 36
  - As a tenant admin, I want to use the existing tenant-admin permission to access all of
    the above, so that no new role or permission entry is introduced.
