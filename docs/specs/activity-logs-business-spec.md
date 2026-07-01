# Activity Logs Business Spec

## Business Overview

Activity Logs give authorized administrators a searchable record of important activity across a tenant. The page shows who acted, when it happened, what kind of action was taken, and which resource was affected.

For HR and L&D teams, this turns platform operations into an auditable timeline. When someone updates course content, changes users or groups, modifies settings, publishes an announcement, or completes a learning action, the organization has a place to inspect the history instead of relying on memory or manual notes.

The main workflow is investigation: an admin opens Activity Logs, searches for a relevant actor, role, resource ID, or metadata value, narrows the list by action, resource, or date range, and expands a row to review the context behind a specific event.

## Who Uses It

- Platform administrators review tenant activity when they need to explain who changed content, settings, users, groups, or announcements.
- HR and L&D administrators use the timeline to audit learning operations, especially around course updates, enrollments, completions, and learner-facing messages.
- Support or operations users with activity-log access troubleshoot tenant issues by checking the sequence of recent actions.

## Feature Functions

- Review a chronological, paginated activity timeline.
- Search activity by actor email, actor role, resource ID, or recorded metadata.
- Filter activity to one or more action types, such as created, updated, deleted, login, enrollment, completion, or certificate activity.
- Filter activity to an exact resource type, such as course, lesson, user, group, announcement, live training, article, Q&A, settings, or integration activity; selecting a resource narrows the action filter to actions that can occur on that resource.
- Narrow investigations to a date range.
- Expand individual rows to inspect structured details such as changed fields, before/after values, and event context.
- Track key platform events across authentication, users, groups, courses, lessons, chapters, announcements, settings, categories, Q&A, news, articles, live training, certificates, and integrations.
- Preserve actor identity, actor role, timestamp, action type, resource type, and resource reference where the source event provides it.

## End-User Value

Activity Logs reduce investigation time and strengthen accountability. Administrators can answer questions like "who changed this course?", "when was this setting updated?", or "which learner-facing action happened?" without asking multiple teams to reconstruct events manually.

For compliance-oriented learning programs, the feature gives HR and L&D a tenant-scoped evidence trail that supports internal reviews, support handoffs, and operational control.

## How It Works

An administrator opens `/admin/activity-logs` from the admin navigation. Mentingo loads the latest logs in a table, lets the admin search across actor and event details, narrow the view by resource, one or more actions, or date, and provides pagination for longer histories. Selecting the details control expands a row so the admin can inspect the event metadata.

The general search is intentionally broader than the older email-only filter: it can find values stored in the actor email, actor role, resource ID, and serialized event metadata. The backend still accepts the previous actor-email query parameter for compatibility, and when both the old email filter and the broader keyword search are present, both filters must match.

When supported domain events happen elsewhere in Mentingo, the activity-log handlers translate those events into audit entries. In normal runtime those entries are queued for persistence so user workflows are not blocked by log writing. In test mode they can be written directly so behavior is deterministic.

## Key Technical Context

- Frontend UI lives in `apps/web/app/modules/ActivityLogs/ActivityLogs.page.tsx`.
- API endpoint is `GET /api/activity-logs` in `apps/api/src/activity-logs/activity-logs.controller.ts`.
- Route and API access require `ACTIVITY_LOG_READ`.
- `ActivityLogsService` supports pagination, backward-compatible actor-email filtering, broad keyword search, multi-value `actionTypes` filtering, exact `resourceType` filtering, and `from`/`to` date filters; `to` is handled as the end of the selected day.
- Activity-log action, resource, and resource-to-action mapping values are exposed from `packages/shared` so API validation and web filter options use the same contract.
- Activity handlers under `apps/api/src/activity-logs/handlers` convert domain events into user-readable audit metadata.

## Test Evidence

API E2E coverage verifies paginated retrieval, date filtering including logs created on the selected `to` date, multi-action/resource filtering, broad keyword matching across actor email, resource ID, and metadata, and pagination totals with active filters. Broader activity-log E2E coverage verifies records for many source events such as course, lesson, chapter, enrollment, announcement, group, category, settings, environment, login, refresh, and logout activity.

No dedicated frontend Activity Logs E2E spec was found; the page behavior is evidenced from the Activity Logs module implementation.
