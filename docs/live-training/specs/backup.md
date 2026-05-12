# LT-01 Domain Model, Constants, And DB

> Status: Working v1 design spec.
>
> This document records the agreed v1 domain model for Live Training. It covers constants,
> permissions/access boundaries, resource ownership, socket boundaries, and the database structure.
> It is not a migration file and should be implemented through normal shared constants, NestJS,
> Drizzle schema, and migration changes.

## Purpose

Define the first stable Live Training domain boundary before implementation. LT-01 should answer:

- what objects exist in the domain,
- how calendar scheduling relates to Live Training,
- how Live Training links to courses and lessons,
- where assigned staff differs from actual runtime attendance,
- which constants and permissions are needed,
- what is intentionally not implemented in v1.

## Decisions Locked For V1

- Calendar has only one generic table: `calendar_events`.
- No physical `calendars` table in v1.
- No calendar audience table in v1.
- No RSVP/response table in v1.
- No group, direct-user, or custom audience rules in v1.
- Recurrence is not implemented in v1.
- `rrule` and `exdates` may exist as nullable future iCalendar compatibility fields, but the app
  must treat every v1 row as one concrete event occurrence.
- Live Training visibility is explicit through `live_trainings.visibility_scope`.
- Live Training course linking is M:N through elastic `live_training_links`.
- Course lesson linkage is represented by `live_lessons`, not by putting `lesson_id` directly on
  `live_trainings` or `live_training_links`.
- Trainers/co-trainers/moderators are assigned through `live_training_members`.
- Course learners and all-tenant learners are not materialized as members.
- Actual runtime participation is tracked separately from assigned members.
- Live Training attendance is domain-specific, not generic calendar attendance.
- Live Training resources use existing `resources` + `resource_entity`.
- Live Training needs its own socket event surface instead of relying only on generic lesson
  websocket semantics.
- Redis may be used later as cache/ephemeral state, but DB remains source of truth.

## Domain Concepts

### Calendar Event

`calendar_events` is the generic scheduled event shell. It stores time, title, description,
timezone, organizer, status, and future iCalendar-compatible fields. It does not store LiveKit
state, attendance, or course completion.

### Live Training

`live_trainings` is the product object. It owns the training configuration, visibility scope,
author, delivery type, max participants, settings, and status. Every Live Training has exactly one
calendar event.

### Live Training Member

`live_training_members` stores assigned staff/members such as trainers, co-trainers, and moderators.
This is planned access/staff assignment, not proof that someone joined.

### Live Training Link

`live_training_links` connects a Live Training to external domain entities. It is elastic by shape,
but v1 only allows `entity_type = course`.

### Live Lesson

`live_lessons` bridges a Live Training link to a concrete LMS lesson row. This allows one Live
Training to appear as separate `lessons(type = live_training)` rows in multiple courses.

### Live Training Session

`live_training_sessions` is a runtime execution attempt. It is created when a trainer starts the
session, not when the event is scheduled.

### Session Participant And Attendance

`live_training_session_participants` stores one aggregate runtime row per actual user in a session.
`live_training_attendance` stores raw join/leave intervals and reconnects. Completion is not based
on attendance.

## Shared Constants

Add or expose constants through the existing shared/constants pattern.

```text
LESSON_TYPES.LIVE_TRAINING = "live_training"
ENTITY_TYPES.LIVE_TRAINING = "live_training"
```

Live Training constants:

```text
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
LIVE_TRAINING_MEMBER_ROLES.CO_TRAINER = "co_trainer"
LIVE_TRAINING_MEMBER_ROLES.MODERATOR = "moderator"
LIVE_TRAINING_MEMBER_ROLES.OBSERVER = "observer"
```

Notes:

- `observer` is reserved in `live_training_members` for later explicit-user assignment; v1 should
  not materialize course learners or all-tenant users into members.
- Keep values in shared constants when frontend and backend both need them.

## Permissions And Access Boundary

`@RequirePermission` should remain coarse-grained. Service methods must still enforce tenant,
author, member, course enrollment, and course-management rules.

Suggested permissions:

```text
live_training.read
live_training.manage
live_training.manage_own
live_training.join
live_training.statistics
```

Suggested role mapping:

- Admin:
  - `live_training.read`
  - `live_training.manage`
  - `live_training.join`
  - `live_training.statistics`
- Content Creator:
  - `live_training.read`
  - `live_training.manage_own`
  - `live_training.join`
  - `live_training.statistics` if current course statistics permissions permit it
- Student:
  - `live_training.read`
  - `live_training.join`

Service-level access rules:

- Admin can see/manage tenant Live Trainings according to permissions.
- Author can see/manage own Live Trainings according to permissions.
- Trainers/co-trainers/moderators can see assigned trainings through `live_training_members`.
- `visibility_scope = all`: tenant users can see/join as observers.
- `visibility_scope = linked_courses`: enrolled users in at least one linked course can see/join.
- Content Creator may only create/manage trainings allowed by ownership/course rules.
- Course link creation must verify course manageability.
- Start/end must verify admin or assigned member role.

## Socket Boundary

Create a dedicated Live Training socket gateway or gateway service surface. It may share the same
Socket.IO namespace/path as existing websocket infrastructure, but event names and room semantics
should be Live Training-specific.

Suggested rooms:

```text
live-training:<liveTrainingId>
live-training-session:<sessionId>
```

Suggested events:

```text
liveTraining:sessionStarted
liveTraining:sessionEnded
liveTraining:participantUpdated
liveTraining:popupAvailable
```

Rules:

- Do not reuse `join:lesson` semantics for Live Training session state.
- Socket state is notification/presence support only.
- Durable session and attendance state must be persisted in DB.
- Redis may cache active sessions later but must not be required to reconstruct final state.

## Resource Model

Use existing central resources:

```text
resources
resource_entity
```

Live Training resources:

```text
resource_entity.entity_type = live_training
resource_entity.entity_id = live_trainings.id
resource_entity.relationship_type = attachment
```

Rules:

- Do not add `live_session_resources` in v1.
- PDF/PPTX/supporting documents attach to `live_trainings`.
- PPTX v1 support means upload/download and trainer screen share, not native synced slides.
- If linked to courses, lesson UI should load resources through the related `live_training`.

## Database Structure

### Table: `calendar_events`

Generic schedule and iCalendar-compatible event shell. Live Training owns one event row.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

uid text not null                   -- stable ICS UID
sequence integer not null default 0 -- ICS SEQUENCE

status text not null                -- scheduled | cancelled | ended | expired

title jsonb not null default {}
description jsonb null

starts_at timestamptz not null
ends_at timestamptz not null
timezone text not null              -- e.g. Europe/Warsaw

location text null                  -- mainly for offline events
organizer_user_id uuid null references users(id)

rrule text null                     -- reserved for future recurrence support
exdates jsonb null                  -- reserved for future recurrence support

deleted_at timestamptz null
```

Suggested indexes:

```text
tenant_id
tenant_id, starts_at, ends_at
tenant_id, uid
```

Notes:

- Do not add `calendar_id`.
- Do not materialize recurring occurrences in v1.
- ICS export/import later can be generated from these fields plus Live Training/member data.

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

Example `settings`:

```json
{
  "observerMicrophoneEnabled": false,
  "screenShareEnabled": true
}
```

Suggested indexes:

```text
tenant_id
tenant_id, status
author_id
calendar_event_id unique
```

Validation rules:

- Reject adding course links when `visibility_scope = all`.
- Reject changing to `all` while links exist.
- Reject starting/publishing a `linked_courses` training without links.

### Table: `live_training_members`

Assigned Live Training staff/members. This is not actual attendance.

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

live_training_id uuid not null references live_trainings(id) on delete cascade
user_id uuid not null references users(id)

role text not null                  -- trainer | co_trainer | moderator | observer
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

V1 role usage:

- Use `trainer`, `co_trainer`, and `moderator`.
- Keep `observer` reserved for future explicit-user assignment.
- Course learners and all-tenant learners are not materialized into this table.

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
- Each course link must create one LMS `lessons(type = live_training)` row and one `live_lessons`
  bridge row.
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

Suggested indexes:

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

role text not null                  -- trainer | co_trainer | moderator | observer | admin

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
- A user with three reconnects has one participant row.
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

Suggested indexes:

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

## Visibility Rules

- Admins see/manage tenant Live Trainings according to permissions.
- Authors see/manage their own Live Trainings according to permissions.
- Trainers/co-trainers/moderators see assigned trainings through `live_training_members`.
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
live_training_members for trainer/co-trainers/moderators
```

Create course-linked Live Training:

```text
calendar_events
live_trainings(visibility_scope = linked_courses)
live_training_members for trainer/co-trainers/moderators
live_training_links row per course
lessons(type = live_training) row per linked course
live_lessons row per linked course lesson
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
validate trainer/co-trainer/moderator/admin access
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

## Explicitly Deferred

- Physical `calendars`.
- Calendar audience tables.
- RSVP/response tables.
- Direct-user audiences.
- Group audiences.
- Recurrence expansion/materialization.
- Generic calendar attendance.
- Native synced PPTX slide state.
- Recording/egress.

## Implementation Notes For Later Specs

- LT-02 should define API contracts and service-level access checks from this model.
- LT-03 should define how `lessons(type = live_training)` is created, rendered, and completed.
- LT-04 should define LiveKit token grants from `live_training_members` and observer visibility.
- LT-05 should define webhook/idempotency behavior for `live_training_attendance`.
