# Activity Logs Business Spec

## Business Overview

Activity Logs give administrators and auditors a searchable timeline of important platform actions. The feature records who performed an action, what type of operation occurred, what resource was affected, and structured before/after context where available.

For HR and L&D teams, activity logs create operational accountability. They help explain changes to courses, users, groups, settings, announcements, content, and authentication activity without relying on manual notes or external tracking.

## Who Uses It

- HR and L&D administrators who need to review platform changes.
- Platform admins who investigate configuration or content updates.
- Auditors who need evidence of who changed what and when.
- Support staff who need a tenant-scoped timeline for troubleshooting.

## Feature Functions

- View a paginated activity log table.
- Filter logs by actor email.
- Filter logs by date range.
- Expand rows to inspect structured change metadata.
- Record create, update, delete, login, logout, enrollment, assignment, and read/view actions.
- Preserve actor identity, role, action type, resource type, timestamp, and context.
- Capture settings and content changes through event handlers.
- Process logs asynchronously outside test mode for lower user-facing latency.

## End-User Value

Administrators can answer operational questions faster: who changed a course, who updated a setting, who enrolled a learner, or when a key action happened. This improves accountability, reduces investigation time, and supports compliance-oriented learning operations.

## How It Works

Users with activity-log access open the Activity Logs page from the admin area. They can search by actor email, narrow results by date, page through results, and expand a row to view detailed metadata.

When supported platform events occur, Mentingo turns them into activity log entries. In production-style flows, those entries are queued and persisted tenant-safely by a worker; in tests, they can be persisted directly for deterministic assertions.

## Key Technical Context

- Frontend route: `/admin/activity-logs`.
- API endpoint: `GET /api/activity-logs`.
- Access requires `ACTIVITY_LOG_READ`.
- Backend implementation lives under `apps/api/src/activity-logs` with handlers for users, groups, courses, chapters, lessons, settings, announcements, auth, envs, news, articles, Q&A, and live training.
- The worker runs activity-log persistence with tenant context.

## Test Evidence

- API E2E coverage verifies paginated retrieval and date filtering, including logs created on the selected `to` date.
- Broader activity-log E2E coverage verifies records are created for chapters, lessons, courses, enrollments, announcements, groups, categories, settings, env values, login, token refresh, and logout.
- No dedicated frontend Activity Logs E2E spec was found; frontend behavior is evidenced by the Activity Logs page implementation.
