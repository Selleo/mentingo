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
- Start, join, and end live training sessions through permission-controlled actions.
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

When LiveKit is configured, online sessions expose join-room behavior. When it is not configured, online delivery is not selectable and offline sessions remain available. Hosts can start and end sessions. For course-linked offline sessions, ending the session can complete the linked lesson for enrolled learners.

Materials are separated into before-session and after-session resources. Privileged users can manage and preview materials, while learners see resources according to their access and the session lifecycle. Live session state changes are pushed to open pages so learners and hosts see the current session state.

## Key Technical Context

- Frontend routes include `/live-training/:id` and `/live-training/:id/room`.
- Frontend implementation lives under `apps/web/app/modules/LiveTraining`.
- API endpoints live under `apps/api/src/live-training`.
- Access is guarded by the Live Training feature flag plus permissions such as `PERMISSIONS.LIVE_TRAINING_READ`, create/update/delete, join, start, end, and statistics.
- Live Training integrates with Calendar, course lessons, resource uploads, announcements/email, realtime session updates, and LiveKit online rooms.

## Test Evidence

- API E2E coverage verifies creation with calendar events, course links, host access, calendar updates, soft deletion, material visibility, learner visibility, session ending, and notification/email behavior.
- Web E2E coverage verifies disabled online delivery when LiveKit is unavailable, live-training lesson view behavior, material permissions, trainer/host visibility, offline session start/end, edit/delete, and calendar-driven creation/navigation.
