# LT-05 Live Training Lessons

## Summary

Add `Live Training` as an LMS lesson type. A Live Training lesson is a course lesson that points to
one Live Training, shows simple lesson-level metadata, and redirects users to the full
`/live-training/:id` workspace for training details, files, people, and runtime behavior.

Live Training stays a separate domain object. Lesson creation can create or link the Live Training,
but editing the Live Training itself happens through the existing Live Training flow.

## Decisions

- Lesson title and Live Training title are separate fields.
- Lesson metadata belongs to the lesson.
- Live Training schedule/title/description/delivery/settings belong to Live Training.
- The course lesson screen must not become a second Live Training editor.
- In V1, one lesson links to one Live Training.
- In V1, one Live Training can be linked to at most one lesson.
- Keep `live_lessons` as a bridge table so the model can later support M:N, but enforce V1
  one-to-one with uniqueness constraints.
- Calendar-created Live Trainings stay standalone unless explicitly linked later.
- Course lesson creation can create a new Live Training inline.
- Linking an existing standalone Live Training can be added after the create path is stable.

## User Flow

### Create Live Training Lesson

1. Trainer opens the existing course lesson creation flow.
2. Trainer selects lesson type `Live Training`.
3. The normal lesson form keeps its own title/metadata fields.
4. A Live Training section appears inside the lesson form.
5. The Live Training section uses the reusable Live Training form fields also used by Calendar.
6. Submit creates everything in one backend transaction:
   - lesson,
   - calendar event,
   - Live Training,
   - live lesson bridge row.
7. After creation, the course lesson list shows a Live Training lesson item.

### View Live Training Lesson

The lesson page should show only a lightweight lesson-facing view:

- lesson title,
- simple Live Training metadata:
  - Live Training title,
  - schedule,
  - online/offline,
  - status,
  - location when offline,
- primary action: go to `/live-training/:id`.

No inline Live Training edit surface should be shown in the lesson page.

### Manage Live Training

All Live Training changes happen on `/live-training/:id`:

- Live Training title/description,
- schedule,
- delivery type,
- location,
- max participants,
- viewer permissions,
- trainers,
- files,
- delete/cancel,
- later start/join/finish/runtime.

## Reusable Form Shape

Extract the current Calendar Live Training form fields so they can be reused without reusing the
Calendar modal shell.

Recommended frontend shape:

```text
LiveTrainingFormFields
LiveTrainingScheduleFields
LiveTrainingDeliveryFields
LiveTrainingViewerPermissionFields
```

Rules:

- Shared fields do not own submission.
- Shared fields receive form state and update callbacks.
- Calendar dialog remains responsible for:
  - selected slot defaults,
  - modal/menu shell,
  - `POST /live-training`,
  - Calendar query invalidation.
- Lesson form remains responsible for:
  - lesson title and lesson metadata,
  - embedding Live Training create payload,
  - calling the lesson create endpoint,
  - course lesson query invalidation.

## Backend Model

Use existing Live Training and Calendar ownership:

```text
lessons(type = live_training)
calendar_events
live_trainings
live_lessons
```

`live_lessons` remains a bridge:

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

lesson_id uuid not null references lessons(id) on delete cascade
live_training_id uuid not null references live_trainings(id) on delete cascade
```

V1 constraints:

```text
unique(lesson_id)
unique(live_training_id)
```

Future M:N support can drop `unique(live_training_id)` when reusing one Live Training in multiple
lessons becomes a real product requirement.

## Backend API

Prefer creating Live Training lessons through the existing lesson creation endpoint instead of
calling Live Training create first from the frontend.

Example request shape:

```text
POST /courses/:courseId/lessons
```

```json
{
  "type": "live_training",
  "title": "Lesson title",
  "liveTraining": {
    "title": "Live Training title",
    "description": "Optional Live Training description",
    "startsAt": "2026-05-20T10:00:00.000Z",
    "endsAt": "2026-05-20T11:00:00.000Z",
    "allDay": false,
    "timezone": "Europe/Warsaw",
    "deliveryType": "online",
    "location": null,
    "maxParticipants": 100,
    "settings": {
      "viewerPermissions": {
        "microphoneEnabled": false,
        "cameraEnabled": false
      }
    }
  }
}
```

Transaction responsibilities:

- validate course/lesson permissions,
- validate Live Training create permissions or define course-lesson create as sufficient for this
  embedded path,
- create lesson,
- create `calendar_events`,
- create `live_trainings`,
- create `live_lessons`,
- create trainers/resources later if the lesson form supports them.

## Read Model

Lesson detail/list responses for Live Training lessons should include enough data to render the
lesson card/page without becoming the full Live Training detail response:

```text
lesson id
lesson title
lesson type
liveTraining:
  id
  title
  startsAt
  endsAt
  deliveryType
  status
  location
```

For complete Live Training details, frontend must navigate to:

```text
/live-training/:id
```

## Calendar Behavior

Course-created Live Trainings still create `calendar_events` as a side effect.

Calendar reads remain generic:

- Calendar starts from `calendar_events`.
- Live Training enrichment is merged through the Live Training source query.
- Course enrollment visibility should allow enrolled users to see linked Live Training events.

## Implementation Progress

- [ ] Update LT-01 schema/migration if `live_lessons` still contains obsolete course-link-only
      assumptions.
- [ ] Add shared lesson type constant for `live_training`.
- [ ] Add backend `live_lessons` Drizzle schema and migration constraints for V1 one-to-one.
- [ ] Add lesson create schema support for embedded `liveTraining` payload.
- [ ] Implement lesson service transaction for `type = live_training`.
- [ ] Extract reusable Live Training form fields from Calendar create dialog.
- [ ] Rewire Calendar dialog to use the shared form fields without changing behavior.
- [ ] Add Live Training lesson type option in the course lesson create UI.
- [ ] Render shared Live Training fields inside the lesson create form.
- [ ] Render lightweight Live Training lesson view with redirect to `/live-training/:id`.
- [ ] Add targeted API and frontend tests after the flow stabilizes.

## Open Questions

- Should creating a Live Training lesson require both lesson create permission and
  `LIVE_TRAINING_CREATE`, or is lesson create permission enough inside the course flow?
- Should the author of the Live Training be the current user who creates the lesson?
- Should the initial trainer list include only the author, or should the lesson form support adding
  trainers immediately?
- If a Live Training lesson is deleted, should the linked Live Training be cancelled/deleted in V1?
- Should linking an existing standalone Live Training be included in this slice or deferred until
  after create works?
