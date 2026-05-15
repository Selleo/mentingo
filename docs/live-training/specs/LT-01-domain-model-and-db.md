# LT-01 Domain Model And DB

> Status: Partially implemented.
>
> This document defines the v1 Live Training domain model, shared constants, permissions, socket
> contract, resource handling, database structure, and lifecycle rules. It is not a migration file;
> implementation should happen through normal shared constants, NestJS services/controllers,
> Drizzle schema, and generated migrations.

## Implementation Progress

Completed:

- Shared Live Training domain constants.
- Shared `LESSON_TYPES.LIVE_TRAINING` constant.
- Shared `ENTITY_TYPES.LIVE_TRAINING` constant.
- Shared Live Training resource relationship constants for before/after files.
- Live Training permissions and system role mapping.
- Drizzle schema for `calendar_events`, `live_trainings`, `live_training_members`,
  `live_training_links`, `live_lessons`, `live_training_sessions`,
  `live_training_session_participants`, and `live_training_attendance`.
- Generated Drizzle migration for the v1 schema.
- Custom migration enabling tenant RLS for Live Training and calendar tables.
- Frontend lesson type value, label, and icon mapping for `live_training`.
- Shared Live Training socket room, client event, and server event constants.

Still open:

- Calendar API and React FullCalendar implementation.
- Live Training service/repository behavior on top of the schema.
- Course lesson creation/rendering behavior for Live Training.
- LiveKit room/token/session implementation.
- Attendance webhook/session lifecycle implementation.
- API and web E2E coverage.

## Purpose

Define the first implementable Live Training slice:

- schedule Live Training through a calendar-compatible event,
- link one Live Training to zero or many course lessons,
- assign trainers,
- start and end a LiveKit-backed runtime session,
- let eligible users join as observers,
- persist runtime participation and attendance,
- expose before/after resources through the existing resource model.

## Locked V1 Decisions

- Use an event-first calendar model with one generic `calendar_events` table.
- Do not add physical `calendars` in v1.
- Do not add generic calendar participant/audience/RSVP tables in v1.
- Do not support direct-user, group, or custom event audiences in v1.
- Calendar visibility is derived from Live Training visibility and links.
- Recurrence is not implemented in v1.
- Keep nullable `rrule` and `exdates` on `calendar_events` for future iCalendar compatibility only.
- Treat every v1 `calendar_events` row as one concrete event occurrence.
- Live Training owns exactly one `calendar_events` row.
- Live Training visibility is explicit through `live_trainings.visibility_scope`.
- Allowed v1 visibility scopes are `all` and `linked_courses`.
- If `visibility_scope = all`, the training is visible to tenant users and has no course completion.
- If `visibility_scope = linked_courses`, visibility is derived from linked course enrollment.
- Link Live Training to courses through `live_training_links`.
- V1 allows only `live_training_links.entity_type = course`.
- Do not put `lesson_id` directly on `live_trainings` or `live_training_links`.
- Use `live_lessons` as the bridge from Live Training link to concrete `lessons(type =
live_training)` rows.
- The same Live Training may appear in multiple courses as separate lesson rows.
- Do not snapshot course learners when scheduling or linking the training.
- Do not materialize course learners or all tenant users into `live_training_members`.
- Use `live_training_members` only for assigned trainers.
- Track actual runtime participation in Live Training-specific session and attendance tables.
- Attendance is not invitation, visibility, RSVP, or completion.
- Completion for linked lessons uses current enrolled users for each linked course when the session
  ends.
- Redis is optional cache/ephemeral state only; DB is the durable source of truth.
- Use existing `resources` + `resource_entity` for Live Training files.
- Use `resource_entity.relationship_type` to distinguish before-session and after-session files.
- Do not add `live_training_resources` or `live_session_resources` in v1.
- Use a dedicated Live Training socket event surface.

## Gateway And Socket Contract

Use a dedicated Live Training gateway surface. It may share the existing Socket.IO namespace/path
internally, but the room names and event names should be Live Training-specific.

Rooms:

```text
live-training:{liveTrainingId}
live-training-session:{sessionId}
live-training-user:{userId}
```

Client-to-server events:

```text
liveTraining:subscribe
liveTraining:unsubscribe
liveTraining:session:start
liveTraining:session:end
liveTraining:participant:heartbeat
liveTraining:participant:leave
```

Server-to-client events:

```text
liveTraining:session:started
liveTraining:session:ended
liveTraining:session:statusChanged
liveTraining:participant:joined
liveTraining:participant:left
liveTraining:participant:updated
liveTraining:attendance:updated
liveTraining:error
```

Rules:

- Do not reuse generic `lesson:*` or `join:lesson` semantics for Live Training runtime state.
- Sockets are for UI synchronization, notifications, and lightweight presence only.
- Start, join, LiveKit token issuing, end, and attendance persistence must still go through backend
  services and DB-backed rules.
- Redis may cache active presence/session state later, but DB remains the source of truth.
- LiveKit grants should be derived from the validated Live Training session role:
  trainer gets elevated room capabilities, observer gets view/listen-only capabilities.

## Permissions And Role Mapping

`@RequirePermission` should stay coarse-grained. Service methods must still enforce tenant,
author, assigned-member, enrollment, and manageable-course rules.

Recommended permissions:

```text
LIVE_TRAINING_READ
LIVE_TRAINING_CREATE
LIVE_TRAINING_UPDATE
LIVE_TRAINING_UPDATE_OWN
LIVE_TRAINING_DELETE
LIVE_TRAINING_JOIN
LIVE_TRAINING_START
LIVE_TRAINING_END
LIVE_TRAINING_STATISTICS
```

Recommended system role mapping:

```text
Student:
- LIVE_TRAINING_READ
- LIVE_TRAINING_JOIN

Content Creator:
- LIVE_TRAINING_READ
- LIVE_TRAINING_CREATE
- LIVE_TRAINING_UPDATE_OWN
- LIVE_TRAINING_JOIN
- LIVE_TRAINING_START
- LIVE_TRAINING_END
- LIVE_TRAINING_STATISTICS, limited by own/manageable course rules

Admin:
- all Live Training permissions
```

Service-level access rules:

- Read:
  - allow admin-level permission,
  - allow author,
  - allow assigned trainer,
  - allow enrolled user for linked-course trainings,
  - allow tenant user for all-scope trainings.
- Create:
  - require `LIVE_TRAINING_CREATE`,
  - validate manageable linked courses when creating course-linked trainings.
- Update:
  - allow `LIVE_TRAINING_UPDATE`,
  - or allow `LIVE_TRAINING_UPDATE_OWN` with author/manageable-course check,
  - block dangerous edits after a session starts.
- Delete/cancel:
  - require `LIVE_TRAINING_DELETE` or own/update authority according to the final service design,
  - prefer cancellation over hard delete once external calendar/LiveKit state exists.
- Start/end:
  - require `LIVE_TRAINING_START` or `LIVE_TRAINING_END`,
  - additionally require manage permission, own permission, or assigned trainer access.
- Join:
  - require `LIVE_TRAINING_JOIN`,
  - validate `visibility_scope`,
  - issue elevated LiveKit token for assigned trainer,
  - issue observer LiveKit token for eligible learners/all-scope users.
- Statistics:
  - require `LIVE_TRAINING_STATISTICS`,
  - additionally require admin, author, assigned trainer, or manageable linked course.

Do not add a separate global `LIVE_TRAINING_MODERATE` permission in v1.

## Implementation Schema

These names and relationships are the v1 implementation target.

### Shared Constants

```text
LESSON_TYPES.LIVE_TRAINING = "live_training"
ENTITY_TYPES.LIVE_TRAINING = "live_training"

LIVE_TRAINING_DELIVERY_TYPES.ONLINE = "online"
LIVE_TRAINING_DELIVERY_TYPES.OFFLINE = "offline"

LIVE_TRAINING_VISIBILITY_SCOPE.ALL = "all"
LIVE_TRAINING_VISIBILITY_SCOPE.LINKED_COURSES = "linked_courses"

LIVE_TRAINING_STATUSES.SCHEDULED = "scheduled"
LIVE_TRAINING_STATUSES.ACTIVE = "active"
LIVE_TRAINING_STATUSES.ENDED = "ended"
LIVE_TRAINING_STATUSES.CANCELLED = "cancelled"
LIVE_TRAINING_STATUSES.EXPIRED = "expired"

LIVE_TRAINING_SESSION_STATUSES.WAITING = "waiting"
LIVE_TRAINING_SESSION_STATUSES.ACTIVE = "active"
LIVE_TRAINING_SESSION_STATUSES.ENDED = "ended"
LIVE_TRAINING_SESSION_STATUSES.FAILED = "failed"

LIVE_TRAINING_MEMBER_ROLES.TRAINER = "trainer"

LIVE_TRAINING_SESSION_ROLES.TRAINER = "trainer"
LIVE_TRAINING_SESSION_ROLES.OBSERVER = "observer"

RESOURCE_RELATIONSHIP_TYPES.LIVE_TRAINING_BEFORE = "live_training_before"
RESOURCE_RELATIONSHIP_TYPES.LIVE_TRAINING_AFTER = "live_training_after"
```

### Table: `calendar_events`

Generic schedule and iCalendar-compatible event shell. Live Training owns one event row.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

uid text not null
sequence integer not null default 0

status text not null                -- scheduled | cancelled | ended | expired

title jsonb not null default {}
description jsonb null

starts_at timestamptz not null
ends_at timestamptz not null
timezone text not null

location text null
organizer_user_id uuid null references users(id)

rrule text null                     -- reserved for future recurrence support
exdates jsonb null                  -- reserved for future recurrence support

deleted_at timestamptz null
```

Indexes:

```text
tenant_id
tenant_id, starts_at, ends_at
tenant_id, uid
```

Rules:

- Do not add `calendar_id` in v1.
- Do not materialize recurring occurrences in v1.
- `uid`, `sequence`, `starts_at`, `ends_at`, `timezone`, `rrule`, and `exdates` are enough for
  later iCalendar export/import compatibility.

### Table: `live_trainings`

Live Training configuration and owner. One row per scheduled Live Training.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

calendar_event_id uuid not null references calendar_events(id) unique
author_id uuid not null references users(id)

delivery_type text not null         -- online | offline
visibility_scope text not null      -- all | linked_courses
status text not null                -- scheduled | active | ended | cancelled | expired
max_participants integer not null default 100

settings jsonb not null default {}
metadata jsonb not null default {}
```

Indexes:

```text
tenant_id
tenant_id, status
author_id
calendar_event_id unique
```

Rules:

- Reject adding course links when `visibility_scope = all`.
- Reject changing to `all` while links exist.
- Reject starting/publishing a `linked_courses` training without links.
- Keep observer microphone, screen-share, and similar switches inside `settings`.

### Table: `live_training_members`

Assigned Live Training staff/members. This is not actual attendance.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_id uuid not null references live_trainings(id) on delete cascade
user_id uuid not null references users(id)

role text not null                  -- trainer
display_order integer null

settings jsonb not null default {}
metadata jsonb not null default {}
```

Constraints and indexes:

```text
unique(live_training_id, user_id)

tenant_id
tenant_id, live_training_id
tenant_id, user_id
tenant_id, role
```

Rules:

- Use only `trainer` in v1.
- Do not store observers in `live_training_members`; derive observer access from visibility scope and
  linked course enrollment.
- Do not materialize course learners or all-tenant learners into this table.

### Table: `live_training_links`

Elastic attachment table. For v1, only `entity_type = course` is valid.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_id uuid not null references live_trainings(id) on delete cascade
entity_type text not null           -- v1: course
entity_id uuid not null             -- v1: courses.id

metadata jsonb not null default {}
```

Constraints and indexes:

```text
unique(live_training_id, entity_type, entity_id)

tenant_id
tenant_id, live_training_id
tenant_id, entity_type, entity_id
```

Rules:

- A Live Training can link to multiple courses.
- V1 must reject any `entity_type` except `course`.
- Each course link creates one `lessons(type = live_training)` row and one `live_lessons` row.
- Independent Live Trainings have no rows in this table.

### Table: `live_lessons`

Bridge from Live Training to concrete LMS lesson rows. One row per linked course lesson.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_id uuid not null references live_trainings(id) on delete cascade
live_training_link_id uuid not null references live_training_links(id) on delete cascade
lesson_id uuid not null references lessons(id) on delete cascade
```

Constraints and indexes:

```text
unique(live_training_link_id)
unique(lesson_id)
unique(live_training_id, lesson_id)

tenant_id
tenant_id, live_training_id
```

Rules:

- Do not store `lesson_id` directly on `live_trainings`.
- Do not store `lesson_id` directly on `live_training_links`.
- Each linked course gets its own concrete `lessons` row.
- The same Live Training may appear as separate lessons in multiple courses.

### Table: `live_training_sessions`

Runtime execution state. Created when trainer starts the session, not when the training is
scheduled.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_id uuid not null references live_trainings(id) on delete cascade

status text not null                -- waiting | active | ended | failed
started_at timestamptz null
ended_at timestamptz null
started_by_user_id uuid null references users(id)
ended_by_user_id uuid null references users(id)
end_reason text null

livekit_room_name text null
livekit_room_sid text null

peak_participant_count integer not null default 0
unique_participant_count integer not null default 0

metadata jsonb not null default {}
```

Indexes:

```text
tenant_id
tenant_id, live_training_id
tenant_id, status
tenant_id, livekit_room_name
```

Rules:

- Session state is persisted here.
- Redis may cache active session data later, but DB remains source of truth.
- Do not put join/leave attendance history in this table.

### Table: `live_training_session_participants`

One aggregate row per actual user in a runtime session.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_session_id uuid not null references live_training_sessions(id) on delete cascade
live_training_id uuid not null references live_trainings(id) on delete cascade
user_id uuid not null references users(id)

role text not null                  -- trainer | observer

first_joined_at timestamptz null
last_left_at timestamptz null
total_seconds integer not null default 0
join_count integer not null default 0

livekit_identity text null

metadata jsonb not null default {}
```

Constraints and indexes:

```text
unique(live_training_session_id, user_id)

tenant_id
tenant_id, live_training_session_id
tenant_id, live_training_id, user_id
tenant_id, user_id
```

Rules:

- This table is actual participation, not assignment.
- A user with multiple reconnects has one participant row.
- Aggregate fields are derived from `live_training_attendance` rows.

### Table: `live_training_attendance`

Raw join/leave interval table. One row per connection interval/reconnect.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_session_participant_id uuid not null references live_training_session_participants(id) on delete cascade
live_training_session_id uuid not null references live_training_sessions(id) on delete cascade
live_training_id uuid not null references live_trainings(id) on delete cascade
user_id uuid not null references users(id)

joined_at timestamptz not null
left_at timestamptz null

livekit_participant_sid text null
disconnect_reason text null

metadata jsonb not null default {}
```

Indexes:

```text
tenant_id
tenant_id, live_training_session_id, user_id
tenant_id, live_training_id, user_id
tenant_id, joined_at
```

Rules:

- Attendance is actual Live Training attendance only.
- Attendance is not visibility, RSVP, or lesson completion.
- A reconnect creates another row.
- Core facts like `joined_at`, `left_at`, and `user_id` must stay relational, not JSONB-only.
- JSONB metadata is only for provider/debug extras.

## Resource Model

Use existing central resources:

```text
resources
resource_entity
```

Live Training resources attach directly to the Live Training:

```text
resource_entity.entity_type = live_training
resource_entity.entity_id = live_trainings.id
```

Use `resource_entity.relationship_type` to lock the file phase:

```text
live_training_before
live_training_after
```

Rules:

- Do not add `live_training_resources` in v1.
- Do not add `live_session_resources` in v1.
- Before-session files use `relationship_type = live_training_before`.
- After-session files use `relationship_type = live_training_after`.
- Before-session files are visible to eligible users before, during, and after the session.
- After-session files are hidden until the Live Training is ended.
- File access must still validate Live Training visibility: author, assigned trainer,
  linked-course enrollment, or all-scope access.
- If we later need display order, per-role visibility, per-file unlock time, downloadable flags, or
  completion rules, add a small relation metadata table keyed by `resource_entity.id`.

## Visibility Rules

- Admins see/manage tenant Live Trainings according to permissions.
- Authors see/manage their own Live Trainings according to permissions.
- Trainers see assigned trainings through `live_training_members`.
- If `visibility_scope = all`, all tenant users can see/join as observers.
- If `visibility_scope = linked_courses`, users can see/join when enrolled in at least one linked
  course.
- Linked course visibility is derived from `live_training_links`.
- Do not create member rows for every enrolled course user.

## Course Linking Flow

Create independent Live Training:

```text
calendar_events
live_trainings(visibility_scope = all)
live_training_members for trainers
resource_entity rows for before/after files, if any
```

Create course-linked Live Training:

```text
calendar_events
live_trainings(visibility_scope = linked_courses)
live_training_members for trainers
live_training_links row per course
lessons(type = live_training) row per linked course
live_lessons row per linked course lesson
resource_entity rows for before/after files, if any
```

Add course link to existing Live Training:

```text
require visibility_scope = linked_courses
create live_training_links row
create lessons(type = live_training) row in that course
create live_lessons bridge row
```

V1 restriction:

- Do not allow adding/removing course links after a session starts.

## Session Flow

Start:

```text
validate manage permission, own permission, or assigned trainer access
validate visibility_scope rules
create live_training_sessions row
create/activate LiveKit room for online training
set live_training_sessions.status = active
set live_trainings.status = active
emit Live Training socket event
```

Join:

```text
validate user visibility
issue LiveKit token based on member role or observer access
create/update live_training_session_participants row
create live_training_attendance row with joined_at
```

Leave/disconnect:

```text
close open live_training_attendance row
recompute/update participant aggregate fields
update session peak/unique participant counts if needed
```

End:

```text
close LiveKit room
close any open attendance rows
set live_training_sessions.status = ended
set live_trainings.status = ended
set calendar_events.status = ended

for each live_lessons row:
  resolve linked course
  complete lesson_id for users enrolled in that course
```

Completion is not based on attendance.

## Deferred Scope

- Physical `calendars`.
- Calendar audience tables.
- RSVP/response tables.
- Direct-user audiences.
- Group audiences.
- Enrollment snapshots.
- Recurrence expansion/materialization.
- Generic calendar attendance.
- Native synced PPTX slide state.
- Recording/egress.
- Per-resource metadata table for display order, per-role visibility, custom unlock time, download
  flags, or completion rules.

## Implementation Checklist

- Add shared constants for `LESSON_TYPES.LIVE_TRAINING`, `ENTITY_TYPES.LIVE_TRAINING`, Live
  Training statuses, visibility scopes, member roles, session statuses, delivery types, and
  before/after resource relationship types.
- Add Live Training permissions to shared permission constants and system role mappings.
- Add Drizzle schema and migration for `calendar_events`, `live_trainings`,
  `live_training_members`, `live_training_links`, `live_lessons`, `live_training_sessions`,
  `live_training_session_participants`, and `live_training_attendance`.
- Add Live Training service rules for create/update/delete/cancel/start/end/join/statistics.
- Add course-linking logic that creates `lessons(type = live_training)` and `live_lessons` rows.
- Add resource upload/list access through `resource_entity.entity_type = live_training` and
  before/after relationship types.
- Add dedicated Live Training socket gateway/event surface.
- Add LiveKit token issuance based on `live_training_members.role` or observer visibility.
- Persist join/leave intervals and recompute participant aggregates.
- Complete linked course lessons on session end according to linked course enrollment.
- Add focused API tests for schema access rules, link creation, resource visibility, start/end, and
  attendance persistence.
