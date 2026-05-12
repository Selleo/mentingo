# Live Training Implementation Plan

This document turns `docs/implementation_schema_live_training.md` into a spec-driven implementation checklist. Each section should be implemented as a small reviewable slice and marked complete only after code, tests, generated artifacts, and validation are done.

## Locked Decisions

- Meeting provider: LiveKit.
- Default active online session limit: `5` globally.
- PPTX support for the first implementation means upload/download as training material and presentation through LiveKit screen share.
- Native PPTX rendering, synced slide control, recording, chat, and whiteboard are out of the first implementation unless explicitly reprioritized.
- Reuse existing Mentingo patterns: Drizzle schema, NestJS modules, generated web API client, `ApiClient.api...`, Socket.IO realtime, outbox notifications, shared constants, and existing E2E factories/flows.

## Progress Checklist

- [ ] LT-01 Domain Model And Constants
- [ ] LT-02 Backend API And Access Policy
- [ ] LT-03 Course Lesson Integration
- [ ] LT-04 LiveKit Integration
- [ ] LT-05 Attendance And Session Lifecycle
- [ ] LT-06 Materials
- [ ] LT-07 Calendar UI
- [ ] LT-08 Active Session Popup
- [ ] LT-09 Live Session UI
- [ ] LT-10 Notifications
- [ ] LT-11 Offline Trainings
- [ ] LT-12 Generated Client And Web Wiring
- [ ] LT-13 Tests And Validation

## LT-01 Domain Model And Constants

- [ ] Add shared constants for:
  - `LESSON_TYPES.LIVE_TRAINING` / frontend `LessonType.LIVE_TRAINING`
  - live training statuses: `scheduled`, `waiting_for_trainer`, `active`, `ended`, `cancelled`, `expired`
  - delivery types: `online`, `offline`
  - participant roles: `trainer`, `observer`
  - socket event names for session start/end and popup availability
- [ ] Add permissions if the current course permissions are not expressive enough:
  - `live_training.manage`
  - `live_training.manage_own`
  - `live_training.join`
  - `live_training.statistics`
- [ ] Map permissions to system roles:
  - Admin: full tenant management and statistics.
  - Content Creator: own trainings and own/manageable courses.
  - Student: assigned training visibility and join.
- [ ] Add Drizzle schema and migration for:
  - core live training rows
  - participants/assigned users
  - optional course lesson linkage
  - LiveKit session state
  - attendance intervals
  - resource/material links if central resources cannot be linked directly enough
- [ ] Keep independent live trainings independent from `lessons`; only course-linked trainings should have a `lessons` row.

## LT-02 Backend API And Access Policy

- [ ] Add a dedicated `live-training` NestJS module with controller, service, repository, schemas, and tests.
- [ ] Add API endpoints for:
  - create/update/delete live training
  - list calendar events by date range for current user
  - get training details
  - link existing training to a course lesson
  - start session
  - join session and return LiveKit connection data
  - end session
  - cancel training
  - complete offline training
  - get attendance/report data
  - get sidebar indicator/active popup summary
- [ ] Return data through existing `BaseResponse` / `PaginatedResponse` shapes.
- [ ] Enforce access rules:
  - Admin can manage all trainings in tenant.
  - Content Creator can create/manage own trainings and can choose only self as trainer.
  - Content Creator can link only own trainings to own/manageable courses.
  - Trainer can start/end assigned trainings.
  - Observer can see and join only assigned trainings.
  - Observer microphone setting is fixed before session start.
- [ ] Ensure all queries are tenant-scoped.

## LT-03 Course Lesson Integration

- [ ] Add `live_training` to backend lesson creation/update/read flows.
- [ ] Add `live_training` to frontend lesson type selector, lesson cards, lesson icons, lesson labels, sidebar, previews, and lesson renderer.
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

## LT-04 LiveKit Integration

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

## LT-05 Attendance And Session Lifecycle

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

## LT-06 Materials

- [ ] Reuse central resources/file upload where possible.
- [ ] Support PDF, PPTX, and supporting documents.
- [ ] Allow authorized admins/content creators/trainers to attach/update materials before session start.
- [ ] Show materials before, during, and after the event to authorized users.
- [ ] Allow observers to view/download materials when allowed by training configuration.
- [ ] Treat PPTX as a stored material for v1; trainer presents it using screen share.
- [ ] Do not implement native PPTX renderer or slide sync in this slice.

## LT-07 Calendar UI

- [ ] Add a separate Calendar route accessible from the left sidebar.
- [ ] Fetch calendar events with a date range and current-user visibility rules.
- [ ] Highlight today.
- [ ] Render one-day and multi-day events.
- [ ] Support online and offline event labels/states.
- [ ] Event click opens details with role-specific actions:
  - Trainer: start, open active session, end.
  - Observer: join, wait for trainer, view details/materials.
  - Content Creator: edit own/manageable training before start, link to course where allowed.
  - Admin: edit/manage/link/report.
- [ ] Add sidebar indicator when the current user has at least one visible training today.
- [ ] Ensure the indicator never counts inaccessible trainings.

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
- [ ] Add web query/mutation hooks for:
  - calendar list
  - details
  - create/update/delete
  - link to course
  - start/join/end/cancel/complete
  - materials
  - indicator
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
2. LT-02 Backend API And Access Policy
3. LT-03 Course Lesson Integration
4. LT-04 LiveKit Integration
5. LT-05 Attendance And Session Lifecycle
6. LT-06 Materials
7. LT-12 Generated Client And Web Wiring
8. LT-07 Calendar UI
9. LT-08 Active Session Popup
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
