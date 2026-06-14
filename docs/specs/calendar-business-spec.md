# Calendar Business Spec

## Business Overview

Calendar gives learners, trainers, and administrators a consolidated schedule for time-based learning obligations. It surfaces live training events and mandatory course due dates in one view, helping teams understand what is coming up without checking multiple modules.

For HR and L&D operations, the calendar is the planning layer for instructor-led training and a reminder surface for required course completion.

## Who Uses It

- Learners who need to see upcoming live sessions and mandatory due dates.
- Administrators who schedule training from a calendar view.
- Trainers and course authors who need visibility into sessions they host or manage.
- L&D managers who track time-sensitive learning commitments.

## Feature Functions

- Display calendar events by selected visible date range.
- Show live training events and mandatory course due-date events.
- Open event details from the calendar.
- Create offline or online live training from a selected calendar date range when permitted.
- Navigate from a live training event to the live training detail page.
- Localize event details according to the selected interface language.
- Respect feature flags and permissions for event visibility and creation.

## End-User Value

Learners can quickly see scheduled training and course deadlines. Administrators can schedule live sessions in the context of existing commitments. Trainers get a clearer view of events they host or author, reducing coordination gaps.

## How It Works

The web calendar requests events for the current date range and user timezone. The API combines eligible live training events and mandatory course due-date events, sorts them by start date, and returns a unified calendar feed.

Event details are resolved by event source type. A live training event opens live training details, while a course due-date event opens course-related information. Creating from the calendar opens a live training dialog prefilled with the selected date range.

Visibility depends on the event source. Live training visibility considers management permissions, author or host status, all-user visibility settings, and linked course enrollment. Course due dates are shown for enrolled learners and users with relevant course management permissions.

## Key Technical Context

- Frontend route: `/calendar`.
- API endpoints: `GET /api/calendar/events` and `GET /api/calendar/events/:eventId`.
- Access requires `CALENDAR_READ`.
- Live training creation from calendar additionally requires Live Training to be enabled and `LIVE_TRAINING_CREATE`.
- Event source types include Live Training and Course Due Date.
- The Calendar service validates date ranges, applies tenant settings, and resolves source-specific detail views.

## Test Evidence

- API E2E coverage verifies due-date event synchronization, update behavior, and reactivation of cancelled due-date events without duplicate UIDs.
- Web E2E coverage verifies opening a Live Training calendar event, navigating to details, and creating an offline Live Training session from the calendar.
