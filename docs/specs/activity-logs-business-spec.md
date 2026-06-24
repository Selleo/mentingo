# Activity Logs Business Spec

## Business Overview

Activity Logs give authorized administrators a searchable record of important activity across a tenant. The page shows who acted, when it happened, what kind of action was taken, and which resource was affected.

For HR and L&D teams, this turns platform operations into an auditable timeline. When someone updates course content, changes users or groups, modifies settings, publishes an announcement, or completes a learning action, the organization has a place to inspect the history instead of relying on memory or manual notes.

The main workflow is investigation: an admin opens Activity Logs, narrows the list by actor email or date range, and expands a row to review the context behind a specific event.

## Who Uses It

- Platform administrators review tenant activity when they need to explain who changed content, settings, users, groups, or announcements.
- HR and L&D administrators use the timeline to audit learning operations, especially around course updates, enrollments, completions, and learner-facing messages.
- Support or operations users with activity-log access troubleshoot tenant issues by checking the sequence of recent actions.

## Feature Functions

- Review a chronological, paginated activity timeline.
- Find activity from a specific person by filtering on actor email.
- Narrow investigations to a date range.
- Expand individual rows to inspect structured details such as changed fields, before/after values, and event context.
- Track key platform events across authentication, users, groups, courses, lessons, chapters, announcements, settings, categories, Q&A, news, articles, live training, certificates, and integrations.
- Preserve actor identity, actor role, timestamp, action type, resource type, and resource reference where the source event provides it.

## End-User Value

Activity Logs reduce investigation time and strengthen accountability. Administrators can answer questions like "who changed this course?", "when was this setting updated?", or "which learner-facing action happened?" without asking multiple teams to reconstruct events manually.

For compliance-oriented learning programs, the feature gives HR and L&D a tenant-scoped evidence trail that supports internal reviews, support handoffs, and operational control.

## How It Works

An administrator opens `/admin/activity-logs` from the admin navigation. Mentingo loads the latest logs in a table, lets the admin filter by email or date, and provides pagination for longer histories. Selecting the details control expands a row so the admin can inspect the event metadata.

When supported domain events happen elsewhere in Mentingo, the activity-log handlers translate those events into audit entries. In normal runtime those entries are queued for persistence so user workflows are not blocked by log writing. In test mode they can be written directly so behavior is deterministic.

## Key Technical Context

- Frontend UI lives in `apps/web/app/modules/ActivityLogs/ActivityLogs.page.tsx`.
- API endpoint is `GET /api/activity-logs` in `apps/api/src/activity-logs/activity-logs.controller.ts`.
- Route and API access require `ACTIVITY_LOG_READ`.
- `ActivityLogsService` supports pagination plus email, `from`, and `to` filters; `to` is handled as the end of the selected day.
- Activity handlers under `apps/api/src/activity-logs/handlers` convert domain events into user-readable audit metadata.

## Test Evidence

API E2E coverage verifies paginated retrieval and date filtering, including logs created on the selected `to` date. Broader activity-log E2E coverage verifies records for many source events such as course, lesson, chapter, enrollment, announcement, group, category, settings, environment, login, refresh, and logout activity.

No dedicated frontend Activity Logs E2E spec was found; the page behavior is evidenced from the Activity Logs module implementation.
