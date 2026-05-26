# LT-07 Live Training Sessions Runtime

## Summary

Implement the LiveKit-backed runtime slice for Live Training sessions.

The full `/live-training/:id` page owns the meeting runtime, session lifecycle, people, files, and
management actions. Live Training lessons render a compact lesson-friendly view with status and
files, but joining opens the full Live Training page.

This slice should not redesign the Live Training CRUD, Calendar CRUD, or lesson assignment flows.

## Product Decisions

- Session start creates a waiting room:
  - backend creates the LiveKit room,
  - backend creates a `live_training_sessions` row with `waiting`,
  - Live Training becomes `active`,
  - first real LiveKit participant join moves the session to `active`.
- Attendance source is LiveKit webhooks:
  - webhook joins/leaves are authoritative,
  - frontend leave/heartbeat is only fallback/supporting signal.
- Frontend meeting integration uses LiveKit React components:
  - use `LiveKitRoom`,
  - render a custom full-screen meeting overlay with participant tiles and allowed media toggles,
  - keep advanced moderation for a later slice.
- Lesson view is compact:
  - show session status and Live Training files,
  - joining opens the same full-screen meeting overlay from the lesson page.
- Lesson view does not expose host session management:
  - no lesson-side start,
  - no lesson-side finish,
  - hosts/admins manage sessions on the full Live Training page.
- Live Training lesson completion happens on manual session end:
  - when an authorized user ends the session,
  - linked Live Training lessons are completed for enrolled students who joined at least once in any
    session of that Live Training.

## Implementation Progress

- [x] DB schema exists for sessions, session participants, and attendance intervals.
- [x] Bare `LiveTrainingSessionsController`, service, and repository exist in the Live Training
      module.
- [x] Shared socket event constants exist for session and participant updates.
- [x] Add LiveKit env-manager keys and `.env` fallback config.
- [x] Add LiveKit room/token/webhook adapter service.
- [x] Add public LiveKit webhook controller and session-service entrypoint.
- [ ] Add `.env`/env-manager support for max parallel active Live Training sessions.
- [x] Add start session endpoint.
- [x] Add join current session endpoint that returns a LiveKit token.
- [x] Add end session endpoint.
- [x] Add LiveKit webhook domain event handling.
- [x] Include `currentSession` in `GET /live-training/:id`.
- [x] Wire session lifecycle into `/live-training/:id`.
- [ ] Add Live Training socket gateway.
- [x] Persist attendance from LiveKit webhooks.
- [x] Mark linked Live Training lessons completed on manual session end.
- [x] Render compact Live Training lesson view.
- [x] Regenerate API client after API schema changes.
- [ ] Add targeted API and frontend tests.

## Backend API

### Start Session

```text
POST /live-training/:liveTrainingId/sessions/start
```

Response:

```text
BaseResponse<LiveTrainingSessionSummary>
```

Rules:

- Require `FEATURES.LIVE_TRAINING`.
- Require `LIVE_TRAINING_START`.
- Backend must also validate object-level authority:
  - author,
  - assigned host,
  - or broad Live Training management permission.
- Reject if Live Training is deleted, cancelled, ended, expired, or offline.
- Reject if another `waiting` or `active` session exists for the Live Training.
- Reject if the configured max parallel active online sessions limit is already reached.
- Create LiveKit room.
- Create `live_training_sessions` row with:
  - `status = waiting`,
  - `started_at = now`,
  - `started_by_user_id = currentUser.userId`,
  - `livekit_room_name`,
  - `metadata`.
- Set `live_trainings.status = active`.
- Emit session started/status changed over socket.

### Join Current Session

```text
POST /live-training/:liveTrainingId/sessions/current/join
```

Response:

```text
BaseResponse<JoinLiveTrainingSessionResponse>
```

Response shape:

```text
sessionId
livekitUrl
token
role
identity
viewerPermissions
```

Rules:

- Require `FEATURES.LIVE_TRAINING`.
- Require `LIVE_TRAINING_JOIN`.
- User must pass the same object visibility rules as `GET /live-training/:id`.
- Session must be `waiting` or `active`.
- Live Training must be online and `active`.
- Upsert `live_training_session_participants` for the current user.
- Generate LiveKit token using the participant role and viewer settings.
- Do not start camera or microphone on the frontend automatically.

### End Session

```text
POST /live-training/:liveTrainingId/sessions/:sessionId/end
```

Response:

```text
BaseResponse<LiveTrainingSessionSummary>
```

Rules:

- Require `FEATURES.LIVE_TRAINING`.
- Require `LIVE_TRAINING_END`.
- Backend must also validate object-level authority:
  - author,
  - assigned host,
  - or broad Live Training management permission.
- Finish is always manual.
- Delete/close the LiveKit room if it exists.
- Close all open attendance intervals.
- Aggregate participant totals.
- Set session status to `ended`.
- Set Live Training status to `ended`.
- Set linked Calendar event status to `ended`.
- Increment Calendar sequence.
- Mark linked Live Training lessons completed for enrolled students.
- Emit session ended/status changed over socket.

### LiveKit Webhook

```text
POST /live-training/livekit/webhook
```

Rules:

- Verify webhook signature with LiveKit `WebhookReceiver`.
- Use raw request body.
- Process at least:
  - `participant_joined`,
  - `participant_left`,
  - `participant_connection_aborted`,
  - `room_finished`.
- Do not treat `room_finished` as normal completion unless the backend session was manually ended.
- If the room unexpectedly finishes while the DB session is still waiting/active, close open
  attendance intervals and mark the session as failed or emit an operational error according to the
  final service implementation.

## Backend Data Flow

### LiveKit Room Naming

Use a deterministic non-PII room name:

```text
lt_<liveTrainingId>_<sessionId>
```

Store it in `live_training_sessions.livekit_room_name`.

### LiveKit Identity

Use one stable LiveKit identity per user per session:

```text
lt:<sessionId>:<userId>
```

Store it in `live_training_session_participants.livekit_identity`.

Purpose:

- LiveKit webhooks contain participant identity.
- Backend can map webhook events back to session/user rows.
- Identity must not be a display name or email.

### Token Grants

Host/admin token:

- `roomJoin = true`
- `room = livekitRoomName`
- `canSubscribe = true`
- `canPublish = true`
- `canPublishData = true`

Observer token:

- `roomJoin = true`
- `room = livekitRoomName`
- `canSubscribe = true`
- `canPublish` or `canPublishSources` based on Live Training viewer settings:
  - microphone disabled means no microphone publish,
  - camera disabled means no camera publish.

Do not grant broad room administration unless a concrete moderation feature needs it.

### Attendance Persistence

`live_training_attendance` stores intervals:

- participant joined:
  - create interval with `joined_at`,
  - set session from `waiting` to `active` if needed,
  - increment participant join metadata.
- participant left/connection aborted:
  - close latest open interval with `left_at`,
  - update `total_seconds`, `last_left_at`, `join_count`,
  - update active/unique/peak counts.

Redis can be added later as a cache for active presence, but Postgres remains the source of truth in
this slice.

## Response Models

### LiveTrainingSessionSummary

```text
id
status
startedAt
endedAt
startedByUserId
endedByUserId
activeParticipantCount
uniqueParticipantCount
peakParticipantCount
```

Do not expose LiveKit API keys or secrets.

### LiveTrainingDetails Extension

Extend `GET /live-training/:id` with:

```text
currentSession: LiveTrainingSessionSummary | null
```

`currentSession` should return the latest `waiting` or `active` session. If none exists, return
`null`.

## Socket Gateway

Add a Live Training gateway on the existing websocket path/namespace style.

Client events:

```text
liveTraining:subscribe
liveTraining:unsubscribe
liveTraining:participant:heartbeat
liveTraining:participant:leave
```

Server events:

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

Rooms:

```text
live-training:{liveTrainingId}
live-training-session:{sessionId}
live-training-user:{userId}
```

Start/end should remain HTTP mutations in v1. Socket is for subscriptions and realtime updates.

## Frontend Full Page

Update `/live-training/:id`.

- Add session mutations:
  - start session,
  - join current session,
  - end session.
- Join stores returned token in local component state.
- When token exists, render LiveKit React room in the session stage.
- Clear token on disconnect.
- Invalidate Live Training, Calendar, session, linked course, and linked lesson queries after
  start/end/join mutations.
- Add a Sessions workspace tab with historical/current session summaries.
- Subscribe to Live Training socket updates and invalidate or patch query state on session events.
- Keep current design:
  - compact stage by default,
  - fullscreen later if needed,
  - no media starts before join.

Button behavior:

- Start:
  - visible only when frontend-derived actions allow it,
  - backend remains authoritative.
- Join:
  - visible when current session is waiting/active and user can join,
  - calls join endpoint and mounts LiveKit room.
- Finish:
  - visible for authorized session managers while session is waiting/active,
  - calls end endpoint.

## Frontend Lesson View

Add a `live_training` case to the student lesson renderer.

Recommended component:

```text
apps/web/app/modules/Courses/Lesson/LiveTrainingLesson/LiveTrainingLesson.tsx
```

Behavior:

- If `lesson.liveTrainingId` is missing, show a compact unavailable state.
- Fetch `GET /live-training/:id` using the current UI language.
- Render a compact version of the Live Training page:
  - title,
  - status,
  - schedule,
  - delivery type,
  - location for offline,
  - host summary,
  - files tab/section using the same backend-filtered before/after materials.
- Do not render inline LiveKit meeting.
- Do not show Start or Finish.
- Show a primary action that navigates to `/live-training/:id`.
- The full page owns actual Join and session management.

Completion behavior:

- Do not mark the lesson completed on lesson page view.
- Do not mark it completed on compact view button click.
- Completion happens when the session is manually ended by an authorized user.

## Validation And Edge Cases

- Missing LiveKit config should return a translated API error and not create a half-started session.
- Missing max parallel sessions config should fall back to the default product limit.
- If LiveKit room creation fails, do not set Live Training to active.
- If DB update fails after room creation, delete the room best-effort.
- Joining a deleted/cancelled/ended training returns 404 or translated bad request.
- Joining without object visibility returns 404.
- Starting an offline training is rejected in this runtime slice.
- After-files remain hidden from students/viewers until Live Training status is `ended`.
- Author/host/admin can always see before and after files.
- Linked Live Training deletion remains blocked while linked to lessons.

## Test Plan

API tests:

- Start creates a session and calls LiveKit room creation.
- Start rejects duplicate waiting/active sessions.
- Start rejects when the configured max parallel active online session limit is reached.
- Start rejects unauthorized users.
- Join returns token, session id, role, and LiveKit identity.
- Join upserts participant row.
- Webhook participant join creates an attendance interval.
- Webhook participant leave closes the attendance interval.
- End closes open intervals and marks session/training/calendar ended.
- End marks linked Live Training lessons completed for enrolled students.
- Object-invisible users cannot join.

Frontend tests:

- Full Live Training page shows Start/Join/Finish based on derived actions and current session.
- Join mounts the LiveKit room after token response.
- End invalidates Live Training and Calendar queries.
- Live Training lesson renders compact state for linked training.
- Live Training lesson primary action navigates to `/live-training/:id`.
- Live Training lesson does not show Start/Finish.
- After-files are hidden for viewers before end and visible after end.

Validation commands:

- Regenerate API client after schema changes with `pnpm generate:client`.
- Run the narrowest API typecheck/tests for Live Training/session changes.
- Run the narrowest web typecheck/tests for Live Training and lesson view changes.

## Deferred

- Custom LiveKit UI beyond prefab components.
- Fullscreen meeting mode.
- Redis-backed active presence cache.
- Max parallel sessions enforcement.
- Offline/manual attendance tooling.
- Attendance export/statistics UI.
- Session reminders for empty rooms or overdue trainings.
