# LT-03 Live Training CRUD Endpoint Spec

> Status: Implementation-ready v1 API spec.
>
> This document defines the first Live Training write API slice. It covers scheduled Live Training
> CRUD and calendar side effects only. It does not include LiveKit room creation, tokens, start/end
> runtime, sockets, or attendance collection.

## Purpose

Create the first usable Live Training API surface:

- create scheduled Live Trainings,
- update scheduled Live Trainings,
- read visible Live Trainings,
- cancel Live Trainings through soft-delete semantics,
- attach existing resources as pre-training and post-training files,
- create/update the paired `calendar_events` row as a side effect,
- keep `CalendarController` read-only.
- exclude soft-deleted `live_trainings` and `calendar_events` from normal read queries.

Calendar is a projection surface. Live Training owns all writes for Live Training-backed calendar
events.

## Controller Split

Use separate controllers by lifecycle:

- `LiveTrainingController`
  - Owns training definition CRUD and scheduling.
  - Owns trainers, course links, before/after resource links, and paired calendar event writes.
- `LiveTrainingSessionsController`
  - Future runtime controller only.
  - Owns start, join, end, LiveKit token, active session state, reconnect, sockets, and attendance.
  - Do not implement it in this slice unless a file shell is needed later.
- `CalendarController`
  - Read-only.
  - Must not expose Live Training-backed create/update/delete routes.

## NestJS Module Shape

Use the existing `live-training` feature module:

```text
apps/api/src/live-training/
  live-training.module.ts
  live-training.controller.ts
  live-training.service.ts
  live-training.repository.ts
  schemas/
    create-live-training.schema.ts
    update-live-training.schema.ts
    live-training-list-query.schema.ts
    live-training-list.schema.ts
    live-training-details.schema.ts
```

Responsibilities:

- `LiveTrainingController`
  - HTTP routing only.
  - Feature and permission decorators.
  - TypeBox request/response validation.
  - Wrap responses with `BaseResponse` or `PaginatedResponse`.
- `LiveTrainingService`
  - Access policy orchestration.
  - Transaction boundaries.
  - Cross-table write rules.
  - DTO assembly.
- `LiveTrainingRepository`
  - Drizzle queries only.
  - Runs under tenant RLS context.
  - Does not accept tenant IDs from endpoint contracts.

## Required Schema Change

Add a `deleted_at timestamptz null` column to `live_trainings`.

Reasoning:

- `status = cancelled` is a business lifecycle state.
- `deleted_at` means hidden from normal reads.
- `calendar_events` already has `deleted_at`; Live Training needs the same soft-delete marker so
  normal Live Training and Calendar reads can exclude deleted records consistently.

## Routes

```text
GET /live-training
GET /live-training/:id
POST /live-training
PATCH /live-training/:id
DELETE /live-training/:id
```

No runtime routes in this slice:

```text
POST /live-training/:id/sessions/start
POST /live-training/:id/sessions/:sessionId/join
POST /live-training/:id/sessions/:sessionId/end
GET /live-training/:id/sessions/latest
GET /live-training/:id/sessions/:sessionId/attendance
```

Those belong to a future `LiveTrainingSessionsController` spec.

## Permissions And Feature Gates

All endpoints require:

```text
@RequireFeature(FEATURES.LIVE_TRAINING)
```

Permission rules:

- `GET /live-training`
  - `PERMISSIONS.LIVE_TRAINING_READ`
  - still filters rows by visibility.
- `GET /live-training/:id`
  - `PERMISSIONS.LIVE_TRAINING_READ`
  - returns `404` when the user cannot see the row.
- `POST /live-training`
  - `PERMISSIONS.LIVE_TRAINING_CREATE`
- `PATCH /live-training/:id`
  - `PERMISSIONS.LIVE_TRAINING_UPDATE`, or
  - `PERMISSIONS.LIVE_TRAINING_UPDATE_OWN` when `author_id = currentUser.userId`.
- `DELETE /live-training/:id`
  - `PERMISSIONS.LIVE_TRAINING_DELETE`.

Visibility rules for read endpoints:

- admin/manage authority sees all tenant trainings,
- author sees own trainings,
- trainers in `live_training_members` see assigned trainings,
- `visibility_scope = all` is visible to every tenant user,
- `visibility_scope = linked_courses` is visible to users enrolled in at least one linked course.

Do not leak inaccessible training existence. Return `404` for inaccessible detail/update/delete
targets.

## Endpoint: List Live Trainings

```text
GET /live-training
```

Query params:

```text
page number optional
perPage number optional
status scheduled | active | ended | cancelled | expired optional
deliveryType online | offline optional
start string ISO date or datetime optional
end string ISO date or datetime optional
courseId uuid optional
```

Rules:

- Filter by schedule overlap when both `start` and `end` are provided:
  - `calendar_events.starts_at < end`
  - `calendar_events.ends_at > start`
- If only one date boundary is provided, reject with `400`.
- Apply visibility rules before returning rows.
- Exclude rows where `live_trainings.deleted_at IS NOT NULL` or
  `calendar_events.deleted_at IS NOT NULL`.
- Sort by `calendar_events.starts_at ASC` by default.

Response:

```ts
type LiveTrainingListItem = {
  id: string;
  calendarEventId: string;
  title: LocalizedText;
  description: LocalizedText | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  deliveryType: "online" | "offline";
  visibilityScope: "all" | "linked_courses";
  status: "scheduled" | "active" | "ended" | "cancelled" | "expired";
  maxParticipants: number;
  authorId: string;
  trainerIds: string[];
  linkedCourseIds: string[];
};
```

Wrap as:

```text
PaginatedResponse<LiveTrainingListItem[]>
```

## Endpoint: Get Live Training Details

```text
GET /live-training/:id
```

Path params:

```text
id uuid, required
```

Rules:

- Return `404` when not found or not visible.
- Include schedule data from `calendar_events`.
- Include trainers from `live_training_members`.
- Include course links from `live_training_links`.
- Include materials from `resource_entity` and `resources`.
- Do not include LiveKit room names, tokens, attendance, or runtime session state in this slice.

Material visibility:

- Admin, author, and assigned trainer see both `before` and `after` materials in every status.
- Student/observer sees `before` materials while status is not `ended`.
- Student/observer sees `after` materials only when status is `ended`.
- Cancelled/expired trainings show only `before` materials to student/observer unless product later
  defines a different policy.

Response:

```ts
type LiveTrainingDetails = LiveTrainingListItem & {
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  author: LiveTrainingUserSummary;
  trainers: LiveTrainingUserSummary[];
  linkedCourses: LiveTrainingCourseSummary[];
  materials: {
    before: LiveTrainingMaterial[];
    after: LiveTrainingMaterial[];
  };
};

type LiveTrainingUserSummary = {
  id: string;
  fullName: string | null;
  email: string;
};

type LiveTrainingCourseSummary = {
  id: string;
  title: LocalizedText;
};

type LiveTrainingMaterial = {
  resourceId: string;
  title: LocalizedText;
  description: LocalizedText | null;
  contentType: string;
  fileUrl: string;
  relationshipType: "live_training_before" | "live_training_after";
};
```

Wrap as:

```text
BaseResponse<LiveTrainingDetails>
```

## Endpoint: Create Live Training

```text
POST /live-training
```

Request body:

```ts
type CreateLiveTrainingBody = {
  title: LocalizedText;
  description?: LocalizedText | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location?: string | null;
  deliveryType: "online" | "offline";
  visibilityScope: "all" | "linked_courses";
  maxParticipants?: number;
  settings?: Record<string, unknown>;
  trainerUserIds?: string[];
  linkedCourseIds?: string[];
  beforeResourceIds?: string[];
  afterResourceIds?: string[];
};
```

Rules:

- `startsAt` and `endsAt` must be valid ISO date/datetime strings.
- `endsAt` must be after `startsAt`.
- Default `maxParticipants` to `100`.
- Default `settings` to `{}`.
- `author_id = currentUser.userId`.
- Add the author as a trainer if `trainerUserIds` is omitted or does not include the author.
- Reject `visibilityScope = all` when `linkedCourseIds` is non-empty.
- Reject `visibilityScope = linked_courses` when `linkedCourseIds` is empty.
- Validate every linked course exists and is manageable/usable by the actor.
- Validate every trainer user exists in the current tenant.
- Validate every before/after resource exists in the current tenant and is not archived.

Transaction:

1. Insert `calendar_events`.
2. Insert `live_trainings` referencing the calendar event.
3. Insert `live_training_members` for trainers.
4. Insert `live_training_links` for linked courses.
5. Insert `resource_entity` rows for before/after resources:
   - `entity_type = ENTITY_TYPES.LIVE_TRAINING`
   - `entity_id = live_trainings.id`
   - `relationship_type = live_training_before | live_training_after`

Response:

```text
BaseResponse<LiveTrainingDetails>
```

## Endpoint: Update Live Training

```text
PATCH /live-training/:id
```

Request body:

```ts
type UpdateLiveTrainingBody = Partial<CreateLiveTrainingBody>;
```

Rules:

- Reject update when training status is `active`.
- Reject changing cancelled/ended/expired trainings for this slice.
- If any schedule field changes, update the paired `calendar_events` row and increment
  `calendar_events.sequence`.
- If `visibilityScope` changes to `all`, reject when linked courses are present or included.
- If `visibilityScope` changes to `linked_courses`, require linked courses either already present or
  provided.
- Provided arrays replace the existing relation set:
  - `trainerUserIds`
  - `linkedCourseIds`
  - `beforeResourceIds`
  - `afterResourceIds`
- Omitted arrays leave existing relations unchanged.
- Material replacement only changes `resource_entity` rows for the matching Live Training and
  relationship type. It does not archive or delete `resources`.

Response:

```text
BaseResponse<LiveTrainingDetails>
```

## Endpoint: Cancel Live Training

```text
DELETE /live-training/:id
```

Behavior:

- This is a cancel/soft-delete endpoint, not a hard delete.
- Set `live_trainings.status = cancelled`.
- Set `live_trainings.deleted_at = now()`.
- Set `calendar_events.status = cancelled`.
- Set `calendar_events.deleted_at = now()`.
- Do not delete `resources`.
- Do not delete `resource_entity` rows.
- Reject cancellation when status is `active`; runtime session cancellation belongs to the future
  sessions flow.

Response:

```text
BaseResponse<LiveTrainingDetails>
```

## Calendar Side Effects

Live Training writes own the paired `calendar_events` row.

Create mapping:

```text
calendar_events.uid = generated stable UID
calendar_events.sequence = 0
calendar_events.status = scheduled
calendar_events.title = body.title
calendar_events.description = body.description
calendar_events.starts_at = body.startsAt
calendar_events.ends_at = body.endsAt
calendar_events.timezone = body.timezone
calendar_events.location = body.location
calendar_events.organizer_user_id = currentUser.userId
```

Update mapping:

- Update the same schedule/title/description/location fields.
- Increment `sequence` when visible calendar fields change.

Cancel mapping:

- Set status to `cancelled`.
- Set `deleted_at = now()` on both `live_trainings` and `calendar_events`.
- Increment `sequence`.

Calendar API then reads the event from `calendar_events` and enriches it through Live Training joins.

## Resource Rules

Use the existing `resources` table and `resource_entity` join table.

Before files:

```text
resource_entity.entity_type = live_training
resource_entity.entity_id = live_trainings.id
resource_entity.relationship_type = live_training_before
```

After files:

```text
resource_entity.entity_type = live_training
resource_entity.entity_id = live_trainings.id
resource_entity.relationship_type = live_training_after
```

Do not add a new Live Training resources table in this slice.

## Non-Goals

- No LiveKit rooms or tokens.
- No start/join/end runtime endpoints.
- No attendance or statistics endpoints.
- No generic Calendar write endpoints.
- No recurrence expansion.
- No RSVP/invitation workflow.
- No physical calendars.
- No material upload endpoint; upload remains in the existing file/resource API.

## Test Cases

API E2E:

- Admin creates online Live Training and receives details response.
- Create inserts exactly one `calendar_events` row.
- Create links trainers, linked courses, before resources, and after resources.
- Create rejects `visibilityScope = all` with linked courses.
- Create rejects `visibilityScope = linked_courses` without linked courses.
- Update changes schedule and increments `calendar_events.sequence`.
- Update replaces provided relation arrays and preserves omitted relation arrays.
- Delete cancels both `live_trainings` and `calendar_events`.
- Delete does not hard-delete resources or resource links.
- Student detail hides after resources before training is ended.
- Student detail shows after resources when training status is `ended`.
- Admin/author/trainer detail shows before and after resources regardless of status.
- Inaccessible detail returns `404`.

Validation:

- Run API typecheck.
- Run targeted Live Training controller E2E.
- Regenerate Swagger/API schema and web API client after implementation.
