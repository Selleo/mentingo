# Slice 4 — Achievements catalog + admin CRUD

## Type

#AFK

## What to build

Stand up the achievements data model and the admin module that manages the catalog. No unlock
logic in this slice — `user_achievements` rows do not get inserted from completions yet. The
profile page does not render the catalog yet either; that lands in slice #5.

The admin module is a new section under the existing tenant-admin area:

- **List view**: image, name (in current locale), threshold, isActive flag, createdAt.
- **Create/edit form**: image upload (reusing whichever existing presigned-URL S3 flow is
  closest in shape — implementer's pick, see PRD note), multilingual name and description
  fields covering all currently supported locales, integer threshold input ≥ 1, isActive
  toggle.
- **Soft-delete action**: flips `isActive = false`. Soft-deleted rows disappear from the list
  by default but can be filtered in.

Duplicate thresholds across achievements are explicitly allowed at the data model and the
form-validation layer.

See `CURRENT-WORK/gamification-prd.md` sections "Schema" → `achievements`,
`achievement_translations`, `user_achievements`, and "Backend modules (new)" →
`AchievementsAdminService`.

## Acceptance criteria

- [ ] `achievements` table exists with `(id, tenantId, imageReference, pointThreshold,
  isActive, createdAt, updatedAt)`. `isActive` defaults to true.
- [ ] `achievement_translations` table exists with `(achievementId, locale, name, description)`
  keyed on `(achievementId, locale)`.
- [ ] `user_achievements` table exists with `(id, tenantId, userId, achievementId, unlockedAt)`
  and a unique index on `(userId, achievementId)`. Empty in this slice.
- [ ] Admin list, create, edit, and soft-delete endpoints exist behind the tenant-admin
  permission.
- [ ] Image upload reuses an existing presigned-URL flow; the chosen flow is documented in the
  PR description.
- [ ] Create/edit form validates `pointThreshold ≥ 1`, accepts duplicate thresholds across
  achievements, and persists translations for every supported locale.
- [ ] Soft-delete sets `isActive = false`, preserves the row, and hides it from the default
  list view.
- [ ] Unit/integration tests cover: create with full translation set, edit (image change +
  translation change + threshold change), soft-delete, duplicate threshold acceptance.
- [ ] No completion event creates a `user_achievements` row in this slice.

## Blocked by

- Blocked by #1

## User stories addressed

- User story 25
  - As a tenant admin, I want a dedicated Achievements section in the admin panel, so that I
    can manage the catalog without polluting other admin areas.
- User story 26
  - As a tenant admin, I want to create a new achievement by uploading an image, entering name
    and description in every supported locale, and setting an integer point threshold, so that
    badges align with the tenant's brand and language coverage.
- User story 27
  - As a tenant admin, I want to allow duplicate thresholds across achievements, so that two
    badges can unlock from the same total when the catalog is themed.
- User story 28
  - As a tenant admin, I want to edit an existing achievement's image, translations, and
    threshold, so that I can iterate without recreating it.
- User story 31
  - As a tenant admin, I want to soft-delete an achievement so that it disappears from the
    catalog and from locked-badge slots on profiles but remains visible on profiles of users
    who already hold it, so that history is preserved.
- User story 36
  - As a tenant admin, I want to use the existing tenant-admin permission to access all of
    the above, so that no new role or permission entry is introduced.
