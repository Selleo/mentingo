# LT-08 Remaining Work: Notifications, Popup, Limits, Cleanup, Offline, Tests

## Summary

This file tracks only the work still missing after the main Live Training CRUD, Calendar, materials,
lesson view, LiveKit room, sessions, attendance, and full-screen meeting slices.

The remaining work should be implemented in small reviewable slices. Notifications must be durable:
Postgres is the source of truth for scheduled notification delivery. Redis/BullMQ delayed jobs may be
used later as an optimization, but they must not be the only place where a planned reminder exists.

## Remaining Product Slices

### 1. Durable Scheduled Notifications

Goal: send email and notification-center announcements before a scheduled Live Training starts.

Recommended first reminder:

- `starts_at - 15 minutes`
- channels:
  - email
  - in-app notification center
  - socket push to currently connected users

Durable DB model:

```text
scheduled_notifications
id uuid pk
tenant_id uuid not null
type text not null                 -- live_training_reminder
entity_type text not null          -- live_training
entity_id uuid not null
send_at timestamptz not null
status text not null               -- pending | processing | sent | cancelled | failed
channels jsonb not null            -- ["email", "in_app"]
dedupe_key text not null
metadata jsonb not null default '{}'
attempt_count int not null default 0
last_error text null
processing_started_at timestamptz null
sent_at timestamptz null
cancelled_at timestamptz null
created_at timestamptz not null
updated_at timestamptz not null
unique(tenant_id, dedupe_key)
```

Reminder dedupe key:

```text
live_training_reminder:{liveTrainingId}:15m
```

Create/update/cancel flow:

- On Live Training create:
  - if status is scheduled and `starts_at - 15 minutes > now`, upsert reminder row.
- On Live Training schedule update:
  - update `send_at` for the same dedupe key.
- On Live Training cancellation/deletion:
  - mark related pending scheduled notification rows as `cancelled`.
- On Live Training start before reminder time:
  - cancel pending reminder, because start notification handles the active-session notification.

Delivery flow:

- Run a scheduled-notification poller every minute.
- Query due rows from Postgres:

```sql
select *
from scheduled_notifications
where status = 'pending'
  and send_at <= now()
order by send_at
limit 100
for update skip locked;
```

- Mark locked rows as `processing`.
- Resolve recipients at send time, not schedule time:
  - linked course enrolled students,
  - visible all-scope users if needed,
  - assigned hosts/trainers,
  - admins only if product decides they should receive operational reminders.
- Create notification-center records.
- Send emails.
- Emit socket events only to targeted user rooms.
- Mark row as `sent`.
- On retryable failure:
  - increment `attempt_count`,
  - store `last_error`,
  - set back to `pending` with a retry delay or mark `failed` after max attempts.

Socket delivery:

- Do not broadcast to every connected socket.
- Emit to user-specific rooms, for example:

```text
tenant:{tenantId}:user:{userId}
```

Frontend behavior:

- Notification socket event either includes a small payload or only signals `notification.available`.
- Frontend invalidates/refetches notification-center query.

### 2. Immediate Live Training Notifications

Goal: notify users when a session actually starts or is cancelled.

Events:

- `live_training.started`
- `live_training.cancelled`
- optional `live_training.updated`

Flow:

- Runtime service publishes existing outbox/domain event when session starts.
- Handler resolves current visible recipients.
- Handler creates notification-center records.
- Handler emits socket events to recipient user rooms.
- Email on start is optional; first implementation can use in-app/socket only for start.

### 3. Active Session Quick-Join Popup

Goal: when a visible training becomes active, eligible users see a quick-join popup once.

Backend/API:

- Add an active Live Training summary endpoint or include active session summaries in app-shell data.
- Data should include:
  - `liveTrainingId`
  - `sessionId`
  - title
  - starts/ends
  - delivery type
  - role/capability summary

Socket:

- Use session-start notification event to signal popup availability.
- Target only users who can see/join/manage the Live Training.

Frontend:

- Zustand only stores current in-app popup state.
- Persist dismissal in localStorage:

```text
liveTrainingPopupDismissed:{sessionId}:{userId}
```

Popup actions:

- Student/viewer: join session.
- Host/admin/trainer: open Live Training page or join session depending on final UX.

### 4. Max Parallel Active Online Sessions

Goal: enforce global active online session limit.

Config:

- Add env-manager value:

```text
LIVE_TRAINING_MAX_PARALLEL_ONLINE_SESSIONS=5
```

Backend:

- Before starting an online session, count current `waiting` + `active` online sessions.
- Reject with translated error if limit is reached.
- Offline sessions must not count toward the limit.
- Add tests for limit reached and under-limit start.

### 5. Fallback Cleanup And Expiry

Goal: make runtime state recoverable when webhooks/workers are missed.

Poller/cron tasks:

- Expire scheduled trainings that were never started after the allowed window.
- Close stale active sessions when LiveKit room no longer exists.
- Close old open attendance intervals defensively.
- Mark failed/stale sessions clearly without completing course lessons unless an authorized manual
  finish happened.

Important rule:

- Manual session end is the normal completion path.
- Cleanup is defensive operational repair, not a replacement for trainer/admin finish.

### 6. Offline Training Lifecycle

Goal: support offline trainings without LiveKit.

Backend:

- Start offline session:
  - create session row without LiveKit room.
  - set Live Training status active.
  - never count against online session limit.
- Finish offline session:
  - manual trainer/admin action.
  - set session and Live Training ended.
  - complete linked Live Training lessons for the agreed participant set.

Open decision:

- For offline linked lessons, decide whether completion applies to:
  - all enrolled linked-course students,
  - manually selected attendees,
  - or only users with manual attendance rows.

Frontend:

- Offline Live Training page should show a non-video session surface.
- Lesson view should show scheduled/active/ended status and files.

## Test Plan

### API E2E

- Admin creates online Live Training and paired `calendar_events` row.
- Admin creates offline Live Training and paired `calendar_events` row.
- Content creator creates own Live Training and cannot assign another trainer.
- Content creator can link own Live Training to own/manageable course only.
- Trainer can read assigned trainings and see before/after files.
- Student can read only visible/assigned/all-scope trainings.
- Student cannot read or join unassigned course-scoped training.
- Calendar list excludes inaccessible trainings.
- Calendar details excludes inaccessible trainings.
- Same Live Training can be linked to multiple lessons.
- One lesson cannot link multiple Live Trainings for the same language.
- One lesson can link different Live Trainings for different course languages.
- Base-language fallback returns base Live Training assignment.
- Deleting a Live Training linked to lessons is blocked.
- Deleting a Live Training lesson removes lesson/bridge rows but keeps Live Training.
- Start session:
  - author/host/admin can start,
  - unrelated user cannot start,
  - offline start uses offline path,
  - online start creates LiveKit room metadata.
- Join session:
  - visible student can join,
  - unassigned student cannot join,
  - token grants match role and viewer settings,
  - observer camera/screen-share grants are never issued.
- End session:
  - author/host/admin can end,
  - student cannot end,
  - open attendance intervals are closed,
  - after files unlock for viewers.
- Completion:
  - linked Live Training lesson completes only users who joined at least once in any session.
  - users who never joined are not completed.
- Webhook:
  - participant joined opens interval and increments join count.
  - participant left closes interval and totals seconds.
  - duplicate join/leave/reconnect remains idempotent.
- Notifications:
  - scheduled reminder row is created on create.
  - scheduled reminder row is updated when `starts_at` changes.
  - scheduled reminder row is cancelled on cancellation/deletion.
  - poller locks due rows with skip-locked semantics.
  - poller resolves recipients at send time.
  - duplicate poller runs do not duplicate notifications because of dedupe key/status.
- Max parallel sessions:
  - starting session is rejected when limit is reached.
  - offline sessions do not count toward online limit.
- Cleanup:
  - stale open attendance intervals are closed defensively.
  - expired scheduled trainings are marked expired according to configured window.

### Frontend Unit/Vitest

- Live Training UI actions:
  - author/host/admin see session management controls.
  - student sees join only when joinable.
  - observer controls respect mic/camera settings.
- Popup dismissal key:
  - once per `sessionId:userId`.
  - new session shows again.
- Calendar event mapping:
  - normalized event shape maps to FullCalendar event.
  - status/delivery styles are applied.
- Live Training lesson view:
  - scheduled state shows planned date.
  - active state shows join.
  - ended state shows ended message.
  - after-files locked message is not shown after ended.

### Web E2E

- Calendar route:
  - visible trainings render.
  - inaccessible trainings do not render.
  - event details modal opens.
  - online/offline markers render.
- Calendar create flow:
  - select date/slot.
  - create Live Training.
  - event appears on calendar.
- Live Training page:
  - author starts session.
  - student joins session.
  - author ends session.
  - files before/after visibility changes after end.
- Live Training lesson:
  - scheduled card appears before start.
  - active card appears after session start.
  - join opens full-screen meeting overlay.
  - ended card appears after end.
- Quick-join popup:
  - appears for visible session start.
  - does not appear twice after dismissal.
  - appears again for a new session.
- Notifications:
  - notification-center item appears for due reminder.
  - socket push invalidates/refetches notification center.

## Implementation Order

1. Scheduled notifications DB schema and poller.
2. Live Training reminder creation/update/cancellation hooks.
3. Notification-center + email handler for due reminders.
4. Session-start notification and socket popup event.
5. Active session quick-join popup.
6. Max parallel online session env/config and enforcement.
7. Cleanup/expiry poller.
8. Offline lifecycle start/finish.
9. API E2E coverage.
10. Frontend unit/E2E coverage.
