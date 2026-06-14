# Live Training Business Spec

## Business Overview

Live Training lets organizations run scheduled instructor-led sessions inside the learning platform. It supports both online sessions, when LiveKit is configured, and offline sessions for classroom or external meeting delivery.

The feature connects live events to courses, calendar visibility, lesson completion, participant access, materials, and follow-up communication. It gives HR and L&D teams a structured way to blend self-paced learning with trainer-led experiences.

## Who Uses It

- HR and L&D administrators who schedule and manage live training sessions.
- Trainers and course authors who host or support sessions.
- Learners who attend training and access before/after materials.
- Managers who need visibility into mandatory or course-linked training activity.

## Feature Functions

- Create, edit, and delete standalone or course-linked live training events.
- Configure delivery type, date, time, location, hosts, maximum participants, and viewer permissions.
- Start, join, and end live training sessions through permission-controlled actions.
- Attach before-session and after-session resources.
- Link sessions to course lessons so attendance and completion can contribute to learning progress.
- Restrict material visibility so learners receive follow-up resources only after the session is completed.
- Sync scheduled sessions to the calendar and update/cancel the paired calendar event when the session changes.
- Send session-related in-app and email announcements for eligible course participants.

## End-User Value

Learners get one place to find session details, join online rooms when available, and access supporting materials at the right time. Trainers can manage live delivery without leaving the platform. L&D teams can combine live instruction with course workflows, making blended learning easier to coordinate and track.

## How It Works

Administrators create a live training item either from the Live Training workflow or directly from the Calendar. If online delivery is available, the system exposes online session actions; otherwise, sessions can be run as offline events.

When a live training is connected to a course lesson, learner access is based on enrollment and course visibility. Starting and ending sessions changes learner-facing state. For offline course-linked sessions, ending the session can complete the linked lesson for enrolled learners.

Materials are split into before-session and after-session resources. Privileged users can manage and preview all materials, while learners receive access according to the session lifecycle.

## Key Technical Context

- Frontend routes include `/live-training/:id` and `/live-training/:id/room`.
- API endpoints are implemented under `apps/api/src/live-training`.
- Access is guarded by the Live Training feature flag and permissions such as `LIVE_TRAINING_READ`, `LIVE_TRAINING_CREATE`, `LIVE_TRAINING_UPDATE`, `LIVE_TRAINING_JOIN`, `LIVE_TRAINING_START`, and `LIVE_TRAINING_END`.
- The web page listens for live training session socket updates and refetches state when sessions move through waiting, active, ended, or failed states.
- Live Training integrates with Calendar, Course lessons, announcements, resource uploads, and LiveKit configuration.

## Test Evidence

- API E2E coverage verifies creation with calendar events, course links, host access, calendar updates, soft deletion, material visibility, learner visibility, session ending, and notification/email behavior.
- Web E2E coverage verifies disabled online delivery when LiveKit is unavailable, lesson view behavior, material permissions, trainer visibility, offline session start/end, edit/delete, and calendar-driven creation/navigation.
