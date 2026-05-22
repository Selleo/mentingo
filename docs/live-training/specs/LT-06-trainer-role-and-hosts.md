# LT-06 Trainer Role and Hosts

## Summary

Split global app capability from per-session Live Training membership.

`Trainer` is a global system role. A `Host` is a per-Live-Training member who can manage a specific
session. Content Creators can link scheduled Live Trainings to their own courses, but they need the
global Trainer role, host membership, authorship, or Admin permissions to manage/start/end Live
Trainings.

## Decisions

- Add global system role `trainer`.
- Rename Live Training member role `trainer` to `host`.
- Backfill must create missing system roles, rule sets, role-rule-set links, and permissions.
- Trainer role gets Live Training and standard self-service permissions only.
- Content Creator keeps course management/linking ability, but loses host-capable Live Training
  permissions by default.
- Host candidates are fetched through a dedicated Live Training endpoint that only returns users
  with the global Trainer role.
- Admins and Live Training authors can add/remove hosts.
- Existing hosts cannot invite hosts unless they are also author/admin.
- Assigned hosts must have the global Trainer role.
- Live Trainings are globally reusable by content creators for course assignment, but linking does
  not grant edit/session management rights.
- Trainer role is available only while Live Training is enabled.
- Live Training can be disabled only when no users currently have the global Trainer role.
- Calendar is always-on and is not disabled with Live Training.

## Permission Model

Trainer role permissions:

```text
account.read_self
account.update_self
user.read_self
settings.read_self
settings.update_self
env.read_public
category.read
calendar.read
live_training.read
live_training.create
live_training.update_own
live_training.join
live_training.start
live_training.end
live_training.statistics
certificate.read
certificate.share
certificate.render
file.upload
announcement.read
```

Content Creator keeps:

```text
calendar.read
live_training.read
live_training.join
```

Content Creator no longer gets by default:

```text
live_training.create
live_training.update_own
live_training.start
live_training.end
live_training.statistics
```

Admin keeps full Live Training permissions.

## Backend Rules

- `PermissionsBackfillService` upserts every system role from shared constants for every tenant.
- The backfill is idempotent and does not delete custom permissions.
- `live_training_members.role = host` is used for new host rows.
- Existing `live_training_members.role = trainer` rows are migrated to `host`.
- Host assignment validates:
  - current user is Admin/live training update-any, or the Live Training author,
  - every assigned host candidate has global `trainer` role,
  - author remains included as a host row.
- Host candidate endpoint:
  - requires Live Training update capability,
  - accepts search/pagination,
  - returns only active users with global Trainer role,
  - returns minimal user summary data.

## Frontend Rules

- Rename user-facing Live Training people copy from trainer to host.
- People selector uses the Live Training host candidate endpoint, not the generic users endpoint.
- UI can show host management for authors/admins only; backend remains the source of truth.
- Permission matrix and role labels include the global Trainer role.
- Permission matrix and all role selectors hide the global Trainer role while Live Training is
  disabled.
- Settings disables the Live Training switch while at least one active user has the global Trainer
  role.
- The general Courses sidebar item is hidden for Trainer because Trainer does not have course read
  access. Direct `/courses` access redirects to Calendar when enabled, otherwise Settings.
- Trainer can load certificate-related profile/settings data through certificate read/share/render
  permissions.
- Trainer can read announcements.

## Implementation Progress

- [x] Add shared `trainer` system role and permissions.
- [x] Extend permissions backfill to create missing roles/rule sets.
- [x] Rename Live Training member role constants and persisted default to `host`.
- [x] Regenerate Live Training schema migration with host defaults.
- [x] Add host candidate endpoint and backend validation.
- [x] Update frontend people selector and copy.
- [x] Add seed Trainer accounts.
- [x] Add Trainer role labels/translations.
- [x] Hide Courses navigation for Trainer and redirect direct `/courses` access to the best
      authenticated fallback.
- [x] Hide Trainer role from role lists while Live Training is disabled.
- [x] Block assigning Trainer role while Live Training is disabled.
- [x] Block disabling Live Training while any active user has Trainer role.
- [x] Remove Calendar from tenant feature gating and keep Calendar permission-gated only.
- [x] Regenerate API client.
- [x] Run API and web type/lint checks.

## Follow-Up

- Existing logged-in users must refresh their session or re-login after role permission changes
  because endpoint guards read permissions from the JWT.
