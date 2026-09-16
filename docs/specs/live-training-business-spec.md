# Live Training Business Spec

## Business Overview

Live Training lets organizations run scheduled instructor-led sessions inside Mentingo. Sessions can be online when LiveKit is configured, or offline for classroom, workshop, or external meeting delivery.

For HR and L&D teams, Live Training supports blended learning: self-paced courses can be combined with trainer-led sessions, calendar scheduling, materials, attendance-related completion, and participant communication.

Administrators create sessions from the Live Training or Calendar workflow, trainers host or support sessions, and learners open session details, join online rooms when available, and access the right materials before or after the session.

## Who Uses It

- HR and L&D administrators schedule and manage live training sessions.
- Trainers and assigned hosts start, run, and end sessions.
- Learners attend sessions, join online rooms when available, and access materials.
- Course creators link live sessions to course lessons for blended-learning programs.

## Feature Functions

- Create, edit, and delete standalone or course-linked live training events.
- Configure delivery type, date, time, location, hosts, maximum participants, and viewer permissions.
- Enable optional self-registration and view confirmed participants and a waiting list.
- Automatically assign a cancelled place to the first eligible person on the waiting list.
- Start, join, and end live training sessions through permission-controlled actions.
- Keep online room participants arranged in a stable responsive grid, including balanced 2x2 layout for four participants.
- Attach before-session and after-session materials.
- Link sessions to course lessons so session completion can contribute to learning progress.
- Restrict learner material visibility based on the session lifecycle.
- Show scheduled sessions in the calendar and keep calendar events aligned after edits or deletion.
- Send session-related in-app and email announcements to eligible participants.

## End-User Value

Learners get one place to find session details, join online rooms when available, and access supporting materials at the right time. Trainers can manage delivery without leaving the learning platform.

L&D teams can coordinate blended programs more reliably because scheduling, course linkage, materials, participant visibility, and completion behavior are connected.

## How It Works

Administrators create a live training item with title, schedule, delivery type, hosts, location or online room behavior, participant visibility, and optional course links. Sessions can also be created from the calendar, which pre-fills scheduling context.

Authorized editors can adjust key session details directly from the Live Training workspace. Valid inline changes, including maximum participant capacity, are saved when the editor leaves the field and are then reflected in the session data and connected calendar views. Once a session is waiting to start or in progress, Mentingo locks Live Training configuration and participant/material management until the session is finished, while hosts retain the controls needed to run it.

For a training with registration enabled, learners register from the training details page. Available places are confirmed immediately; further registrations enter a waiting list. Learners see their own status and waiting-list position, while organizers see both lists. Cancelling before the scheduled start automatically promotes the earliest eligible waiting participant. Increasing capacity also fills places from the waiting list. Hosts do not consume registration places.

Registration closes at the scheduled start or when a session is opened, whichever happens first. Capacity cannot be reduced below confirmed registrations, and registration mode cannot change while the lists are nonempty. Open details pages refresh registration status every five seconds. Promotion does not send an additional email.

When LiveKit is configured, online sessions expose join-room behavior. When it is not configured, online delivery is not selectable and offline sessions remain available. Hosts can start and end sessions. When registration is enabled, learners need a confirmed place to join an online room; existing technical room-capacity limits still apply. For course-linked offline sessions with registration enabled, automatic lesson completion includes confirmed participants only. Training notifications also target confirmed participants.

In online rooms, participant tiles adapt to the available stage size so small group sessions remain easy to scan, including a balanced two-by-two arrangement when four camera tiles are visible.

Materials are separated into before-session and after-session resources. Privileged users can manage and preview materials, while learners see resources according to their access and the session lifecycle. Live session state changes are pushed to open pages so learners and hosts see the current session state.

## Key Technical Context

- Frontend routes include `/live-training/:id` and `/live-training/:id/room`.
- Frontend implementation lives under `apps/web/app/modules/LiveTraining`.
- API endpoints live under `apps/api/src/live-training`.
- Access is guarded by the Live Training feature flag plus permissions such as `PERMISSIONS.LIVE_TRAINING_READ`, create/update/delete, join, start, end, and statistics.
- Live Training integrates with Calendar, course lessons, resource uploads, announcements/email, realtime session updates, and LiveKit online rooms.
- Registration reuses the existing member table with a distinct attendee role and JSON metadata; it requires no database migration. Seat allocation and waiting-list promotion lock the training row in one transaction. Host reads and host edits exclude attendee records.
- An open session prevents changes to Live Training configuration, deletion, host assignments, and materials; the API enforces this rule even if a client bypasses the UI.
- Online room participant layout is handled by the LiveKit-based meeting components in `apps/web/app/modules/LiveTraining/components/LiveTrainingMeeting`.

## Test Evidence

- API E2E coverage verifies creation with calendar events, course links, host access, calendar updates, soft deletion, material visibility, learner visibility, session ending, and notification/email behavior.
- Web E2E coverage verifies disabled online delivery when LiveKit is unavailable, live-training lesson view behavior, material permissions, trainer/host visibility, offline session start/end, inline edits including maximum participant capacity, deletion, and calendar-driven creation/navigation. A focused frontend test also verifies that the current capacity value is committed when the editor leaves the field.

Focused API coverage verifies competing registrations for one place, automatic promotion, repeated registration, participant-list access, registration-mode locking, and preservation of attendee records during host edits. A browser scenario demonstrates registration, waiting-list status, and promotion after cancellation.
