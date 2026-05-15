# Live Training Implementation Plan

This document turns `docs/implementation_schema_live_training.md` into a spec-driven implementation checklist. Each section should be implemented as a small reviewable slice and marked complete only after code, tests, generated artifacts, and validation are done.

## Locked Decisions

- Meeting provider: LiveKit.
- Calendar UI library: React FullCalendar.
- New product surfaces are tenant-toggleable features. Calendar must be gated by a Calendar feature
  toggle, and Live Training calendar data must also require the Live Training feature toggle.
- Default active online session limit: `5` globally.
- PPTX support for the first implementation means upload/download as training material and presentation through LiveKit screen share.
- Native PPTX rendering, synced slide control, recording, chat, and whiteboard are out of the first implementation unless explicitly reprioritized.
- Reuse existing Mentingo patterns: Drizzle schema, NestJS modules, generated web API client, `ApiClient.api...`, Socket.IO realtime, outbox notifications, shared constants, and existing E2E factories/flows.

## Progress Checklist

- [ ] LT-01 Domain Model And Constants
- [ ] LT-02 Calendar API, FullCalendar UI, And E2E
- [ ] LT-03 Backend API And Access Policy
- [ ] LT-04 Course Lesson And Event Integration
- [ ] LT-05 Materials
- [ ] LT-06 LiveKit Meeting Integration
- [ ] LT-07 Attendance And Session Lifecycle
- [ ] LT-08 Active Session Popup
- [ ] LT-09 Live Session UI
- [ ] LT-10 Notifications
- [ ] LT-11 Offline Trainings
- [ ] LT-12 Generated Client And Web Wiring
- [ ] LT-13 Tests And Validation

## LT-01 Domain Model And Constants

- [x] Add shared constants for:
  - `LESSON_TYPES.LIVE_TRAINING` / frontend `LessonType.LIVE_TRAINING`
  - live training statuses: `scheduled`, `active`, `ended`, `cancelled`, `expired`
  - session statuses: `waiting`, `active`, `ended`, `failed`
  - delivery types: `online`, `offline`
  - visibility scopes: `all`, `linked_courses`
  - session roles: `trainer`, `observer`
  - resource relationship types: `live_training_before`, `live_training_after`
- [x] Add shared socket event name constants for session start/end, participant updates, attendance updates, popup availability, and errors.
- [x] Add permissions:
  - `live_training.read`
  - `live_training.create`
  - `live_training.update`
  - `live_training.update_own`
  - `live_training.delete`
  - `live_training.join`
  - `live_training.start`
  - `live_training.end`
  - `live_training.statistics`
- [x] Map permissions to system roles:
  - Admin: full tenant management and statistics.
  - Content Creator: own trainings and own/manageable courses.
  - Student: assigned training visibility and join.
- [x] Add Drizzle schema and migration for:
  - calendar events
  - core live training rows
  - staff/member assignment
  - course links and live lesson bridge
  - LiveKit session state
  - session participants
  - attendance
- [x] Add tenant RLS enablement migration for Live Training and calendar tables.
- [x] Keep independent live trainings independent from `lessons`; only course-linked trainings should have a `lessons` row.
- [x] Reuse existing `resources` + `resource_entity` for Live Training files instead of adding a dedicated resources table.
- [ ] Add repository/service-level implementations that use the LT-01 schema.
- [ ] Add validation/tests around the new domain model once LT-02/LT-03 behavior exists.

## LT-02 Calendar API, FullCalendar UI, And E2E

Spec: `docs/live-training/specs/LT-02-calendar-api-fullcalendar-and-e2e.md`
Endpoint spec: `docs/live-training/specs/LT-02-calendar-module-endpoints.md`

This is the next implementation slice after LT-01. Finish the calendar path end-to-end before finishing LiveKit meeting runtime work.

- [x] Add shared feature constants and `@RequireFeature(...)` guard infrastructure for toggleable product surfaces.
- [x] Add a dedicated read-only `CalendarModule` scaffold with controller, service, and repository.
- [x] Apply the Calendar feature guard to the Calendar controller scaffold.
- [ ] Keep Calendar read-only in this slice. Direct calendar CRUD is deprecated for v1.
- [ ] Add calendar/listing API endpoints needed by the UI:
  - list visible calendar events by date range for the current user
  - get calendar event details
  - expose event status, delivery type, linked source ID, linked lesson/course context, and session role
- [ ] Create/update/delete scheduled Live Training events through the Live Training flow, not through Calendar endpoints.
- [ ] Treat Calendar rows as a projection/read surface: Live Training writes `calendar_events` as a side effect, then Calendar displays the visible result.
- [ ] Ensure calendar endpoints are guarded by Calendar and Live Training feature toggles where applicable.
- [ ] Rely on RLS for tenant isolation; do not pass tenant IDs through calendar endpoint or repository contracts.
- [ ] Implement visibility rules from the Live Training domain:
  - `visibility_scope = all` is visible to every tenant user
  - course-linked trainings are visible to users enrolled in any linked course and to assigned trainers/admins
  - unlinked course-scoped trainings should not leak to unrelated users
- [ ] Regenerate Swagger/API schema and web API client after the calendar API contract is added.
- [ ] Add web query hooks using `ApiClient.api...` only.
- [ ] Add a dedicated Calendar route from the left sidebar.
- [ ] Build the calendar screen with React FullCalendar.
- [ ] Configure React FullCalendar for:
  - date-range fetching
  - today highlighting
  - one-day and multi-day events
  - online/offline labels
  - active/ended/cancelled/expired visual states
  - event click opening a role-aware details panel/modal
- [ ] Event details should support the non-LiveKit information already available at this stage:
  - view details and materials
  - show waiting/disabled state for start/join until LiveKit meeting work lands
- [ ] Add sidebar indicator for visible trainings today.
- [ ] Ensure the indicator never counts inaccessible trainings.
- [ ] Add API E2E for calendar visibility by role and date range.
- [ ] Add web E2E for:
  - calendar route renders events visible to the current user
  - inaccessible events are not rendered
  - today sidebar indicator appears only when applicable

## LT-03 Backend API And Access Policy

Spec: `docs/live-training/specs/LT-03-live-training-crud-endpoints.md`

- [x] Add a dedicated `live-training` NestJS module with controller, service, and repository shell.
- [ ] Add Live Training request/response schemas and tests.
- [ ] Add API endpoints for:
  - create/update/delete live training
  - get training details
  - list visible trainings
  - attach existing resources as before/after files through `resource_entity`
  - create/update/cancel the paired `calendar_events` row as a side effect
- [ ] Return data through existing `BaseResponse` / `PaginatedResponse` shapes.
- [ ] Enforce access rules:
  - Admin can manage all trainings in tenant.
  - Content Creator can create/manage own trainings and can choose only self as trainer.
  - Content Creator can link only own trainings to own/manageable courses.
  - Trainer can read assigned trainings and see all before/after files.
  - Student/observer sees before files before completion and after files only once ended.
- [ ] Keep runtime session logic out of this slice:
  - no LiveKit room/token/start/join/end
  - no attendance/report data
  - no offline completion
- [ ] Ensure all queries are tenant-scoped.

## LT-04 Course Lesson And Event Integration

This slice should finish Live Training creation, calendar event creation, course linking, and lesson rendering before LiveKit room/token behavior is completed.

- [ ] Add `live_training` to backend lesson creation/update/read flows.
- [ ] Add `live_training` to frontend lesson type selector, lesson cards, lesson icons, lesson labels, sidebar, previews, and lesson renderer.
- [ ] Creating a Live Training should create its `calendar_events` row in the same transactional flow.
- [ ] Linking a Live Training to a course should create/update the course lesson representation without duplicating the Live Training.
- [ ] Support M:N links through `live_training_links`, including course/lesson link records where required by the schema.
- [ ] Course-linked live training should behave as a normal lesson with:
  - title
  - description
  - status
  - materials
  - join/start/end actions based on role
  - progress state
- [ ] Ending a linked training should automatically complete the lesson for all assigned participants, regardless of actual attendance.
- [ ] Update progress/statistics queries so live training lessons count correctly and do not break existing content, quiz, AI Mentor, embed, or SCORM behavior.
- [ ] Keep independent calendar trainings outside course progress.

## LT-05 Materials

- [ ] Reuse central resources/file upload where possible.
- [ ] Support PDF, PPTX, and supporting documents.
- [ ] Store Live Training material phase through resource entity relationship type:
  - `live_training_before`
  - `live_training_after`
- [ ] Allow authorized admins/content creators/trainers to attach/update materials before session start.
- [ ] Show materials before, during, and after the event to authorized users.
- [ ] Allow observers to view/download materials when allowed by training configuration.
- [ ] Treat PPTX as a stored material for v1; trainer presents it using screen share.
- [ ] Do not implement native PPTX renderer or slide sync in this slice.

## LT-06 LiveKit Meeting Integration

- [ ] Add backend LiveKit configuration:
  - server URL
  - API key
  - API secret
  - default active session limit `5`
- [ ] Add a LiveKit service responsible for:
  - creating/activating rooms
  - generating participant tokens
  - closing rooms or disconnecting participants
  - validating webhook signatures/events if supported by the chosen LiveKit SDK
- [ ] Generate role-based tokens:
  - Trainer/admin moderator: publish audio/video/screen share/data and subscribe.
  - Observer with microphone OFF: subscribe only.
  - Observer with microphone ON: publish microphone only and subscribe.
- [ ] Enforce no observer camera or screen-share grant.
- [ ] Add start-session flow:
  - verify trainer/admin permission
  - enforce active online session limit
  - create/activate LiveKit room
  - persist actual start and room ID
  - set status to `active`
  - emit realtime/in-app event
- [ ] Add join-session flow:
  - verify visibility/assignment
  - return LiveKit URL, token, role, status, and UI capabilities
- [ ] Add end-session flow:
  - verify trainer/admin permission
  - close/disconnect LiveKit room
  - persist actual end
  - set status to `ended`
  - finalize attendance
  - complete linked course lesson for assigned participants

## LT-07 Attendance And Session Lifecycle

- [ ] Persist session fields:
  - planned start/end
  - actual start/end
  - current status
  - LiveKit room ID
  - peak participants
  - unique participant count
- [ ] Add LiveKit webhook endpoint for participant join/leave/disconnect events.
- [ ] Track attendance intervals with:
  - user ID
  - role
  - join time
  - leave time
  - reconnect-safe total attended time
- [ ] Make webhook handling idempotent.
- [ ] Add fallback cleanup/expiry job:
  - mark not-started trainings as `expired` after allowed window
  - close stale active sessions if needed
  - finalize open attendance intervals defensively
- [ ] Keep attendance reporting-only for course completion.

## LT-08 Active Session Popup

- [ ] Add active training summary endpoint or include active-session data in existing app-shell loading.
- [ ] Show quick-join popup when a visible assigned/managed training becomes active.
- [ ] Show popup once per `sessionId:userId`.
- [ ] Persist dismissal in localStorage:
  - `liveTrainingPopupDismissed:<sessionId>:<userId>`
- [ ] Use Zustand only for current in-app popup state.
- [ ] Use Socket.IO for session-start notifications.
- [ ] Popup actions:
  - Trainer: go to session host view.
  - Observer: join session.

## LT-09 Live Session UI

- [ ] Add frontend LiveKit dependencies.
- [ ] Build live training lesson/session screen using `@livekit/components-react`.
- [ ] Connect through server-provided LiveKit URL and token only.
- [ ] Render trainer controls:
  - microphone
  - camera
  - screen share
  - leave
  - end session
- [ ] Render observer controls:
  - microphone hidden/disabled when observer mic is OFF
  - microphone available when observer mic is ON
  - no camera control
  - no screen-share control
  - leave
- [ ] Show waiting state before trainer starts:
  - `Szkolenie rozpocznie się, gdy Trener uruchomi sesję.`
- [ ] Show session ended/canceled/expired states.
- [ ] Keep UI consistent with existing course/lesson surfaces.

## LT-10 Notifications

- [ ] Add outbox events for:
  - live training scheduled/reminder
  - live training started
  - optional trainer reminder
  - live training canceled if needed
- [ ] Add handlers for email and in-app/socket notification.
- [ ] Minimum first implementation:
  - email before training for assigned observers
  - in-app/socket notification when trainer starts the session
- [ ] Reuse existing outbox dispatcher/listener/fallback behavior.
- [ ] Do not introduce a separate notification queue.

## LT-11 Offline Trainings

- [ ] Support `offline` delivery type without LiveKit room/token.
- [ ] Show offline trainings in Calendar.
- [ ] Allow offline trainings to have:
  - planned dates
  - description
  - trainer
  - assigned observers
  - materials
  - optional course lesson link
- [ ] Trainer/admin can mark offline training complete.
- [ ] If linked to course, completion marks assigned participants complete using the same rule as online training.
- [ ] Offline events should never count against active online LiveKit session limit.

## LT-12 Generated Client And Web Wiring

- [ ] Regenerate Swagger/API schema through existing scripts after backend contract changes.
- [ ] Regenerate web API client with `pnpm generate:client`.
- [ ] Use `ApiClient.api...` only in web code.
- [ ] Treat calendar API/client wiring as part of LT-02 when implementing the calendar slice.
- [ ] Add web query hooks for read-only Calendar data:
  - calendar list
  - details
  - indicator
- [ ] Add Live Training mutation hooks for scheduling and lifecycle actions:
  - create/update/delete/cancel/complete training
  - link to course
  - start/join/end/cancel/complete
  - materials
  - popup summary
  - attendance report
- [ ] Add shared `data-testid` handles for E2E instead of relying on visible copy.
- [ ] Add translations for all supported UI languages.

## LT-13 Tests And Validation

- [ ] API e2e: admin creates online and offline trainings.
- [ ] API e2e: content creator can create only own training and cannot assign another trainer.
- [ ] API e2e: content creator can link own training to own/manageable course only.
- [ ] API e2e: observer cannot read or join unassigned training.
- [ ] API e2e: trainer can start/end only assigned training.
- [ ] API e2e: start blocks when `5` active online sessions already exist.
- [ ] API e2e: join token grants differ for trainer, observer mic OFF, and observer mic ON.
- [ ] API e2e: end linked training completes lesson for all assigned participants.
- [ ] API e2e: attendance intervals handle join/leave/reconnect idempotently.
- [ ] Web unit/Vitest: popup dismissal key logic.
- [ ] Web unit/Vitest: role-based live session controls.
- [ ] Web E2E: calendar visibility by role.
- [ ] Web E2E: today sidebar indicator.
- [ ] Web E2E: quick-join popup appears once per user/session.
- [ ] Web E2E: course-linked live training start/join/end with mocked LiveKit token.
- [ ] Run narrow validation for touched slices:
  - `pnpm lint-tsc-api`
  - `pnpm lint-tsc-web`
  - targeted API e2e specs
  - targeted web E2E specs
  - `pnpm generate:client` after API contract changes

## Suggested Implementation Order

1. LT-01 Domain Model And Constants
2. LT-02 Calendar API, FullCalendar UI, And E2E
3. LT-03 Backend API And Access Policy
4. LT-04 Course Lesson And Event Integration
5. LT-05 Materials
6. LT-12 Generated Client And Web Wiring for non-calendar endpoints
7. LT-08 Active Session Popup shell without LiveKit token flow
8. LT-06 LiveKit Meeting Integration
9. LT-07 Attendance And Session Lifecycle
10. LT-09 Live Session UI
11. LT-10 Notifications
12. LT-11 Offline Trainings
13. LT-13 Tests And Validation

## Risks And Follow-Up Decisions

- LiveKit Cloud vs self-hosting is an infrastructure decision; app code should be environment-configurable.
- The `5` active online session limit should be configurable, with `5` as the default.
- Native PPTX rendering and synced slide control are separate feature work.
- Recording/Egress will add storage, CPU, transfer, and retention concerns and should be specified separately.
- Multi-node LiveKit/self-host scaling should be validated with load testing before production rollout.
