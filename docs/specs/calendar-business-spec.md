# Calendar Business Spec

## Business Overview

Calendar gives learners, trainers, and administrators one place to see time-based learning commitments. It combines scheduled live training with mandatory course due dates so users do not need to inspect separate course and live-training screens to understand what is coming up.

For HR and L&D operations, the calendar is a planning and coordination view. It helps administrators schedule instructor-led sessions in context and gives learners a clear reminder surface for required learning.

## Who Uses It

- Learners checking upcoming live sessions and mandatory course deadlines.
- Administrators scheduling live training from a calendar view.
- Trainers and authors who need visibility into training sessions connected to them.
- L&D managers reviewing time-sensitive learning obligations across the tenant.

## Feature Functions

- Display calendar events for the visible date range.
- Show live training events and mandatory course due-date events in a unified feed.
- Open event details directly from the calendar.
- Navigate from a live training event to the live training detail page.
- Create an offline or online live training session from a selected calendar date range when permitted.
- Localize event titles and details according to the selected language.
- Apply permission, enrollment, authorship, host, and feature-flag rules before showing events or creation controls.

## End-User Value

Learners can quickly answer what training is scheduled and when mandatory courses are due. Administrators can create live sessions while seeing existing commitments, which reduces accidental scheduling conflicts. Trainers get a more direct view of events they host or manage.

## How It Works

The calendar page requests events for the current date range, selected language, and user timezone. The API returns a normalized event list instead of exposing separate live-training and due-date queries to the web app.

Event details are resolved by source type. Live training events show session details and a link to the live-training page. Course due-date events represent mandatory group-course deadlines and show the relevant course deadline information.

Course due-date events are synchronized from group-course due dates. The synchronization updates existing events, creates missing ones, and reactivates cancelled events instead of producing duplicate calendar records.

## Key Technical Context

- Frontend route: `/calendar`.
- Frontend implementation: `apps/web/app/modules/Calendar`.
- API implementation: `apps/api/src/calendar`.
- API endpoints: `GET /api/calendar/events` and `GET /api/calendar/events/:eventId`.
- Access requires `PERMISSIONS.CALENDAR_READ`.
- Creating live training from the calendar also depends on the Live Training feature and `PERMISSIONS.LIVE_TRAINING_CREATE`.
- Supported event source types include Live Training and Course Due Date.

## Test Evidence

- Web E2E coverage verifies opening a live training event from the calendar, seeing event details, navigating to the live-training detail page, and creating an offline live training session from the calendar.
- API E2E coverage verifies due-date event synchronization, updating existing due-date events, creating missing due-date events, and reactivating cancelled events without duplicate UIDs.
