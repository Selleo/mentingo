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
- In V1, one lesson links to one Live Training per course language.
- The course base language must always have a Live Training assignment.
- Other course languages may have their own Live Training assignment, but they are optional.
- If a non-base language has no Live Training assignment, the lesson falls back to the base-language
  Live Training assignment, similar to the SCORM lesson flow.
- In V1, one Live Training can be assigned to multiple lessons.
- In V1, one Live Training link can also be reused by multiple lesson-language assignments.
- Keep `live_lessons` as a bridge table so the model can later support M:N.
- Enforce the V1 one-Live-Training-per-lesson-language rule through `live_lessons(lesson_id,
language)` uniqueness.
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
live_training_links
live_lessons
```

`live_training_links` remains the audience/access bridge. For this slice, course-created Live
Trainings create a `live_training_links(entity_type = course, entity_id = courseId)` row. Later this
same shape can support groups or other audience entities.

`live_lessons` remains a bridge from lesson to Live Training through the selected access link.
The bridge is language-specific, because one course lesson shell can point to a different concrete
Live Training for each course language:

```text
id uuid pk
tenant_id uuid not null
created_at timestamptz not null
updated_at timestamptz not null

lesson_id uuid not null references lessons(id) on delete cascade
language text not null
live_training_id uuid not null references live_trainings(id) on delete cascade
live_training_link_id uuid not null references live_training_links(id) on delete cascade
```

V1 DB/service constraint:

```text
one lesson can have at most one live_lessons row per language
```

Use `unique(lesson_id, language)` for this rule. Do not keep `unique(lesson_id)`, because that
would block assigning a separate Live Training for another course language.

## Multilingual Live Training Assignment

Live Training lessons are multilingual at the course lesson level.

A single `lessons` row remains the logical course lesson shell. The lesson title/description stay
localized through the existing lesson JSONB fields.

`live_lessons` is the language-specific assignment table between the lesson shell and concrete Live
Training sessions:

```text
lessons
- id
- type = live_training
- title jsonb
- description jsonb

live_lessons
- lesson_id
- language
- live_training_id
- live_training_link_id
```

This allows one course lesson to have one assigned Live Training per course language:

```text
lesson_123 + pl -> live_training_pl
lesson_123 + en -> live_training_en
lesson_123 + de -> live_training_de
```

Decisions:

- The selected course editor language decides which `live_lessons` row is created/read.
- Backend must reject create/link when the selected language is not in the course
  `availableLocales`.
- The course base language must have a Live Training assignment before the lesson is considered
  valid/publishable.
- Base-language assignment is required. Non-base-language assignments are optional overrides.
- If a requested non-base language has no assigned Live Training, resolve the base-language
  assignment.
- If the base language has no assignment, the lesson is treated as unassigned and must show the
  create/link assignment flow.
- Updating an existing Live Training lesson remains title-only and must not relink the Live
  Training.
- Creating/linking a Live Training for another language happens through the create/link flow for
  that selected course language.

DB rules:

```text
language text not null
unique(lesson_id, language)
index(tenant_id, lesson_id)
index(tenant_id, live_training_id)
index(tenant_id, live_training_link_id)
```

Do not keep `unique(live_training_link_id)`. That old constraint blocks assigning the same Live
Training access link to more than one lesson, which is explicitly allowed. Do not keep
`unique(lesson_id)`, because that blocks assigning a separate Live Training for another course
language.

Backend rules:

- `POST /lesson/beta-create-lesson/live` must use the selected course language.
- Validate the selected language against the parent course `availableLocales`.
- Create/link should reject if `live_lessons(lesson_id, language)` already exists.
- Create/publish validation must require a base-language `live_lessons` row.
- Create/link must not reject a Live Training just because its `live_training_link_id` is already
  used by another lesson.
- Course lesson list/detail should resolve `liveTrainingId` using the requested language first, then
  fall back to the course base language.
- If no assignment exists for the requested language or base language, return `liveTrainingId: null`.

Frontend rules:

- Course editor passes selected course language into Live Training lesson create/link.
- Edit mode only edits the lesson title for the selected language.
- If `liveTrainingId` exists, show the link to `/live-training/:id`.
- If `liveTrainingId` is missing for the selected language and the selected language is the course
  base language, show the create/link assignment flow for the base language.
- If `liveTrainingId` is missing for a non-base language, show that the base-language Live Training
  is being used and offer an optional language-specific override when the user has permission.

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
- reject creating/linking a Live Training assignment if the same lesson already has a
  `live_lessons` row for the selected language,
- allow linking the same Live Training to other lessons,
- create lesson,
- create `calendar_events`,
- create `live_trainings`,
- create `live_lessons`,
- create trainers/resources later if the lesson form supports them.

## Delete Behavior

Deleting a Live Training lesson and deleting the Live Training domain object are separate actions.

Live Training lesson deletion:

- Deleting a Live Training lesson deletes the `lessons` row.
- `live_lessons` rows are removed by cascade from `live_lessons.lesson_id`.
- The linked Live Training stays intact.
- Other lessons linked to the same Live Training continue to work.

Live Training deletion:

1. Backend checks how many `live_lessons` rows reference the Live Training.
2. If the count is greater than zero, backend rejects deletion.
3. Frontend confirmation must clearly say that the Live Training is linked to `x` lessons and that
   the related lessons must be deleted first.
4. Standalone Calendar Live Trainings with no lesson links can use the normal delete confirmation
   and can be cancelled/deleted.

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

- [x] Keep current `live_training_links` + `live_lessons.live_training_link_id` DB structure.
- [x] Add shared lesson type constant for `live_training`.
- [x] Reuse existing backend `live_lessons` Drizzle schema.
- [x] Add initial service-level V1 check for the create path that one lesson has at most one linked
      Live Training.
- [x] Add beta lesson create schema support for embedded `liveTraining` payload.
- [x] Add `POST /lesson/beta-create-lesson/live`.
- [x] Implement create transaction for new Live Training lesson:
  - create `lessons(type = live_training)`,
  - create linked Live Training through `LiveTrainingService`,
  - create `live_training_links(entity_type = course)`,
  - create `live_lessons`.
- [x] Add generated API client support for `beta-create-lesson/live`.
- [x] Add success translation key for Live Training lesson creation.
- [x] Add link-existing create flow for assigning an existing Live Training to another new lesson.
- [x] Extract reusable Live Training form fields from Calendar create dialog.
- [x] Rewire Calendar dialog to use the shared form fields without changing behavior.
- [x] Add Live Training lesson type option in the course lesson create UI.
- [x] Render shared Live Training fields inside the lesson create form.
- [x] Fix `live_lessons` schema constraints:
  - add `language`,
  - replace `unique(lesson_id)` with `unique(lesson_id, language)`,
  - remove `unique(live_training_link_id)`,
  - keep non-unique indexes for lesson, Live Training, and Live Training link lookups.
- [x] Update backend create/link logic to reject only duplicate `(lesson_id, language)` assignments.
- [x] Require base-language Live Training assignment before a Live Training lesson is valid.
- [x] Resolve Live Training lesson reads by selected language first and base-language fallback
      second.
- [x] Allow the same Live Training to be linked to multiple lessons.
- [x] Ensure one lesson cannot link multiple Live Trainings for the same selected language.
- [x] Add `PATCH /lesson/:lessonId/live-training` for SCORM-style language-specific assignment.
- [x] Return `liveTrainingLanguages` in course lesson list responses so the editor can detect
      missing language assignments.
- [x] Allow one lesson to link different Live Trainings for different course languages.
- [x] Show create/link assignment flow in edit mode when the selected course language has no own
      Live Training assignment.
- [x] Add delete confirmation metadata for Live Trainings linked to lessons.
- [x] Block Live Training deletion when it is still linked to lessons.
- [x] Keep Live Training intact when deleting a Live Training lesson.
- [x] Add Live Training lesson delete button and confirmation in the course lesson edit form.
- [x] Render lightweight Live Training lesson view with status, files, and join overlay.
- [ ] Add targeted API and frontend tests after the flow stabilizes.

## Regression Tests To Add

- Same Live Training linked to lesson A and lesson B should pass.
- Same Live Training link reused by multiple `live_lessons` rows should pass.
- Different Live Training linked to the same lesson and same language should fail.
- Different Live Training linked to the same lesson and a different course language should pass
  when that language exists in `course.availableLocales`.
- Lesson read in a non-base language without an override should return the base-language Live
  Training assignment.
- Lesson create/publish without base-language Live Training assignment should fail or stay
  unassigned depending on the existing lesson draft semantics.
- Linking in a language outside `course.availableLocales` should fail.
- Course lesson list/detail should resolve the Live Training assignment for the requested language.
- Deleting a Live Training linked to lessons should expose linked lesson count in confirmation
  metadata and block deletion.
- Deleting a Live Training lesson should remove the lesson and bridge rows, but not the Live
  Training.

## Open Questions

- Should creating a Live Training lesson require both lesson create permission and
  `LIVE_TRAINING_CREATE`, or is lesson create permission enough inside the course flow?
- Should the author of the Live Training be the current user who creates the lesson?
- Should the initial trainer list include only the author, or should the lesson form support adding
  trainers immediately?
- If a Live Training lesson is deleted, should the linked Live Training be cancelled/deleted in V1?
- Should the language-specific assignment flow expose richer context about which languages already
  have overrides?
