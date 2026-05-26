# LT-04 Live Training Page

## Summary

Build `/live-training/:id` as the full Live Training workspace. Calendar remains a schedule view and
metadata jump-off; the Live Training page owns the full training context, edit flow, materials,
people, and later LiveKit runtime.

The page should feel close to the existing lesson view: focused content area, persistent metadata,
clear state, and direct actions. It should not look like a marketing page.

## Product Direction

Default layout should be compact and operational.

- Keep the meeting surface small by default so schedule, people, files, and status remain visible.
- Provide fullscreen only when the user needs a larger meeting experience.
- Treat active online sessions like a Discord-style channel before joining:
  - user can see that the session exists,
  - user can see active/waiting state,
  - user can join when eligible,
  - no video/audio starts before joining.
- Offline trainings should not render a video/meeting stage.

## Implementation Progress

- [x] Placeholder `/live-training/:id` route exists.
- [x] Replace placeholder with Live Training workspace shell.
- [x] Add page query using `GET /live-training/:id`.
- [x] Add compact online session preview state.
- [x] Add overview tab for training details and people.
- [x] Add files tab with before/after material tabs.
- [x] Add deferred attendance tab.
- [x] Add frontend utilities to derive page-level UI actions.
- [x] Add page-level action placement for edit/delete/start/join/finish from frontend-derived
      affordances.
- [x] Remove `actions` flags from Calendar response payloads and keep action derivation on the
      frontend.
- [x] Keep Live Training detail user summaries minimal: id, display name, profile picture URL.
- [x] Resolve profile picture references to usable file URLs in the API response.
- [x] Keep timezone out of the preview while dates are formatted in the viewer local timezone.
- [x] Add mobile-compact session preview layout.
- [x] Move shared Live Training UI constants/types out of component files while keeping component
      prop types local.
- [x] Add delete confirmation dialog and delete mutation.
- [x] Redirect invalid or missing Live Training detail URLs back to Calendar.
- [x] Add inline editing for metadata from the preview surface.
- [x] Add update mutation and edit form wiring.
- [x] Enforce shared title/description max lengths in API schemas and frontend inline edit controls.
- [x] Add wrapping title/description inline fields with hover-only editable affordance and focused
      character counters.
- [x] Keep Live Training page component code modular by extracting stage primitives, constants, and
      utility functions.
- [x] Add LiveKit room integration in the runtime slice.
- [ ] Add tests after the page behavior stabilizes.

## Backend Prerequisites

Already available:

- `GET /live-training/:id` for base details.
- `PATCH /live-training/:id` for metadata update.
- `DELETE /live-training/:id` for cancellation/soft delete.
- Calendar event and Live Training DB schema.
- Live Training trainer/member schema.
- Live Training session/session-participant/attendance schema.
- Before/after resources modeled through `resource_entity.relationship_type`.
- Shared permissions for read/create/update/delete/join/start/end/statistics.

Runtime behavior now available:

- Start session endpoint.
- Join session endpoint that returns a LiveKit token.
- Finish/end session endpoint.
- Active session detail inclusion in `GET /live-training/:id`.
- Session lifecycle service rules:
  - only authorized trainer/admin/author can start,
  - only authorized trainer/admin/author can finish,
  - finish is always manual,
  - dangerous metadata edits are blocked after session start where required.
- LiveKit room creation/token service.
- Attendance persistence from LiveKit webhook lifecycle.
- File visibility rules in API response:
  - before files visible before session end,
  - after files visible only after session end for students/viewers,
  - trainers/admin/author can see both.

Still needed:

- Live Training socket gateway for app-shell popup/status notifications.
- Fallback cleanup/expiry job for stale sessions and open attendance intervals.
- Max parallel active online session limit enforcement.

Access model:

- Route access is coarse-grained and can require `LIVE_TRAINING_READ`.
- Object-level visibility is backend-authoritative.
- If a user cannot see a specific Live Training, `GET /live-training/:id` should return `404`.
- Frontend must not duplicate object visibility rules to decide whether the route is allowed.
- Anyone who can successfully load the Live Training page is eligible to see the page workspace.
- Real join still requires a later join endpoint and backend token validation.

Response model:

- Do not keep generic `actions` flags in Calendar or Live Training responses for v1 UI.
- Calendar responses stay normalized and source-focused:
  - stable calendar fields,
  - `payload.liveTraining` for Live Training context,
  - no `actions` object.
- Live Training responses stay data-focused:
  - entity fields,
  - author/trainers/materials/session context,
  - no `actions` object.
- Backend must still enforce every mutation/runtime action.
- Frontend derives button visibility from:
  - current user permissions,
  - current user id,
  - Live Training `authorId`,
  - trainer list,
  - status/session state,
  - delivery type,
  - visibility scope and linked-course data when already present.
- If frontend cannot cheaply know a backend-only object rule, it may show an optimistic action and
  let the backend reject with a normal error toast.
- The frontend derivation is display-only. It must never be treated as authorization.

`GET /live-training/:id` must expose enough page data for the workspace:

- title, description, schedule, timezone, location,
- delivery type, visibility scope, status,
- max participants, settings,
- author id and author profile,
- trainers,
- linked courses/live lessons summary if needed,
- latest/current session,
- before/after resources after visibility filtering.

## Frontend Action Derivation

Add a dedicated FE utility, for example:

```text
apps/web/app/modules/LiveTraining/utils/liveTrainingActions.ts
```

Purpose:

- centralize display-only action derivation,
- avoid scattering permission checks through components,
- keep backend as the real authority.

Recommended derived actions:

```text
canShowEdit
canShowDelete
canShowStart
canShowJoin
canShowFinish
canShowStatistics
```

Inputs:

- current user id,
- current user permissions,
- Live Training author id,
- trainer ids,
- Live Training status,
- current session status when available,
- delivery type.

Initial v1 rules:

- `canShowEdit`:
  - user has `LIVE_TRAINING_UPDATE`, or
  - user has `LIVE_TRAINING_UPDATE_OWN` and is author.
- `canShowDelete`:
  - user has `LIVE_TRAINING_DELETE`.
- `canShowJoin`:
  - user successfully loaded the route,
  - and runtime slice later says session is joinable.
  - Until LiveKit slice, show disabled/mock join only when useful for layout.
- `canShowStart`:
  - user has `LIVE_TRAINING_START`,
  - and user is author or assigned trainer or has broad update/admin permission,
  - and training/session is not ended.
- `canShowFinish`:
  - user has `LIVE_TRAINING_END`,
  - and user is author or assigned trainer or has broad update/admin permission,
  - and session is active.
- `canShowStatistics`:
  - user has `LIVE_TRAINING_STATISTICS`.

These rules are for UI only. Backend services must independently validate all operations.

## Page Layout

Use a two-level layout:

1. Session preview stage
2. Workspace body

### Session Preview Stage

Show:

- title
- status badge
- online/offline badge
- schedule summary
- location if offline
- primary action area

Actions:

- `Edit` if user can update.
- `Delete` or `Cancel` if user can delete/cancel.
- `Start session` when scheduled and user can start.
- `Join session` when active/available and user can join.
- `Finish session` when active and user can end.

Do not put edit controls inside the Calendar details modal. Editing belongs on this page.

Timezone note:

- Backend stores timestamps in UTC.
- Frontend displays timestamps in the viewer local timezone.
- Do not show the Live Training `timezone` beside viewer-local formatted dates unless the frontend
  explicitly formats the date in that timezone or labels it as the original scheduling timezone.

## Session Stage

### Online Scheduled Or Waiting

Compact card, not a video grid.

Show:

- scheduled/waiting state
- planned start/end
- trainer summary
- `Start session` for authorized trainer/admin/author
- disabled or hidden `Join session` until joining is allowed

### Online Active, User Not Joined

Discord-like channel preview.

Show:

- "Live session is active"
- participant count when available
- trainers currently present when available
- `Join session`

Do not autoplay camera, microphone, or remote media before join.

### Online Joined

Replace preview with embedded LiveKit room in the compact stage.

Controls:

- leave
- microphone/camera controls based on role/settings
- fullscreen

Fullscreen should expand the meeting surface and keep meeting controls fixed. Exiting fullscreen
returns to the normal Live Training workspace.

### Offline

Do not render meeting/video stage.

Show:

- offline location card
- schedule
- manual session state controls if needed
- later offline/manual attendance tooling

## Sidebar Cards

Recommended right-side cards:

- Session lifecycle:
  - scheduled/active/ended
  - started at/by
  - ended at/by
  - participant count when available
- People:
  - author with avatar/name/email
  - trainers with avatars/names/emails
- Metadata:
  - delivery type
  - max participants
  - visibility scope
  - linked courses summary

## Tabs

Use tabs below the session stage.

### Overview

Read-only metadata and description in view mode.

In edit mode:

- title
- description
- language if allowed
- starts at
- ends at
- timezone
- delivery type
- location for offline
- max participants
- viewer permission settings for online

### Before Files

Pre-session materials.

- visible before and after session
- editable by authorized users

### After Files

Post-session materials.

- visible to trainers/admin/author anytime
- visible to students/viewers only after session is ended
- editable by authorized users

### Attendance

Later slice.

Show:

- attendance summary
- participant intervals
- export/report actions when allowed

### Settings

Later slice for less frequently used fields and operational flags.

## Inline Edit Mode

Inline edit happens on the Live Training page, not in Calendar.

Rules:

- There is no separate edit mode button for the preview metadata.
- Authorized users edit directly in the preview surface.
- Text fields commit on blur after local validation and normalization.
- Binary controls commit immediately.
- Schedule edits use the existing date/time popover and commit when the popover closes.
- Successful updates invalidate:
  - Live Training detail query,
  - Calendar event queries,
  - Calendar event details query if open/stale,
  - linked course and lesson queries, because Live Training details are embedded in course lesson
    views.

V1 editable fields:

- title
- description
- startsAt
- endsAt
- deliveryType
- location
- maxParticipants
- viewer permission settings

Do not include in first edit pass:

- linked courses/live lessons
- author
- trainers
- session status
- attendance
- LiveKit room state

## Edit Page Plan

Edit should stay inline inside `/live-training/:id`, not a separate route. The current page already
has the data, permissions, and workspace context; editable preview fields should look read-only
until hover/click so the preview does not become a large form.

### Entry Points

- No dedicated `Edit` button in the preview.
- Users with edit permission can click editable preview fields directly.
- Calendar event details keep only `Go to Live Training`; no edit action there for now.
- If the user opens an invalid Live Training URL, redirect to Calendar before the page renders.

### Edit Scope V1

Editable in the first pass:

- title,
- description,
- starts at,
- ends at,
- delivery type,
- offline location,
- max participants,
- online viewer permissions:
  - microphone enabled,
  - camera enabled.

Read-only in the first pass:

- author,
- trainers,
- linked courses/live lessons,
- visibility scope,
- calendar event id,
- status/session lifecycle,
- materials,
- attendance,
- LiveKit runtime state.

### UI Structure

Recommended edit layout:

- Keep the session preview stage visible and visually read-only by default.
- Editable text fields reveal a hover-only dotted border when the user can edit.
- Title and description edit inline as wrapping textareas, not modal or popover inputs.
- Title and description show focused-only character counters.
- Schedule edits use a small date/time popover because the date/time control is structured.
- Delivery type, max participants, location, microphone, and camera remain compact preview controls.
- Mutations happen on blur/popover close/toggle instead of through a global save bar.
- Keep destructive delete separate from edit-save actions.
- On mobile, popovers should stay within viewport width and avoid replacing the entire preview with
  a full form.

Field placement:

- Preview stage:
  - title,
  - short description,
  - schedule date/time fields,
  - delivery type,
  - location when offline,
  - max participants,
  - viewer permission toggles when online.
- status/delivery badges remain readable.
- Overview tab supports trainer management only for users who can edit the Live Training and have
  user-management permission. Content creators do not assign trainers; they remain the sole trainer
  on Live Trainings they create unless an admin/user manager assigns additional trainers.
- Files tab remains file management only.
- People block remains inline and compact:
  - author is always visible,
  - author cannot be removed,
  - authorized user managers can add trainers through an inline search popover,
  - authorized user managers can remove trainers from the people list,
  - duplicate author/trainer rows are merged into one person with multiple badges.
- First pass uses the existing `GET /user/all` API, so the add-trainer control is shown only when
  the user can both edit the training and manage/search users.
- Live Training UI actions are derived through a reusable capability mapper:
  - edit metadata/materials: update-any or update-own author permission,
  - manage people: edit permission plus user-management permission,
  - manage session: author/trainer role or broad Live Training management permission,
  - view all materials: author/trainer role or broad Live Training management permission.

### Validation Rules

- title is required,
- title max length is `LIVE_TRAINING_TITLE_MAX_LENGTH`,
- description max length is `LIVE_TRAINING_DESCRIPTION_MAX_LENGTH`,
- ends at must be after starts at,
- max participants must be between 1 and the shared Live Training maximum,
- location is optional for offline delivery,
- viewer permission settings only apply to online delivery,
- changing delivery type from offline to online clears or ignores location in the payload,
- changing delivery type from online to offline hides viewer permission controls but should preserve
  sane defaults in the request.

### API Flow

- Add `useUpdateLiveTraining` mutation.
- Mutation calls `PATCH /live-training/:id`.
- On success, invalidate:
  - Live Training detail query,
  - Calendar events query,
  - Calendar event details query if the query key is available.
- On error, use translated API error messages through the existing shared helper.
- After successful save:
  - keep user on the same Live Training page,
  - show success toast.

### State Model

- Keep edit state local to the page or a small edit hook.
- Initialize edit state from `GET /live-training/:id`.
- Do not mutate the loaded `liveTraining` object directly.
- Reset local edit state on:
  - successful save,
  - detail query id change.
- Track dirty state before sending a mutation so unchanged blur/toggle actions are ignored.

### Implementation Steps

- [x] Add `useUpdateLiveTraining` mutation.
- [x] Add local edit state for Live Training metadata.
- [x] Add inline editable preview metadata controls.
- [x] Use hover-only editable affordance for title/description.
- [x] Add focused-only absolute character counters for title/description.
- [x] Extract stage primitives, constants, and utility functions out of the main component file.
- [x] Submit `PATCH /live-training/:id` with normalized payload.
- [x] Invalidate Live Training and Calendar queries after save.
- [x] Add translated success/error copy.
- [x] Add inline trainer management in the People section.
- [x] Use infinite user search for adding trainers.
- [x] Preserve backend-owned author locking by only sending editable trainer ids.
- [x] Gate trainer assignment behind user-management permission and keep content creators as sole
      trainers by default.
- [x] Split frontend Live Training actions into reusable capabilities for edit, people management,
      session management, and material visibility.
- [ ] Add tests after the edit flow stabilizes.

## Manual Finish Requirement

Session completion must always be manually triggered by an authorized user.

- Do not auto-finish based on meeting empty state.
- Empty-room detection can be used later for warnings/reminders only.
- `Finish session` should close the runtime session, mark the session ended, and unlock after-files
  for students/viewers.

## Deferred Runtime

LiveKit runtime is intentionally deferred.

Before the runtime slice:

- render the online meeting area as a mocked/placeholder stage,
- keep the compact preview layout realistic,
- do not issue LiveKit tokens,
- do not start media devices,
- do not persist attendance from the mocked UI.

## Open Questions

- Exact button naming: `Cancel` vs `Delete` for scheduled trainings.
- Whether standalone Live Training can later be linked to courses from this page.
- Whether trainer candidate search should get a dedicated endpoint for own-training editors without
  `USER_MANAGE`.
- Whether offline attendance is manual-only or imported from another source.
