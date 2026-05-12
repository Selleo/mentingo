# LT-02 Calendar API, FullCalendar UI, And E2E

> Status: Implementation-ready v1 spec.
>
> This slice comes immediately after LT-01. The goal is to finish the calendar path end-to-end
> before finishing LiveKit meeting runtime work. Calendar should show visible calendar events, merge
> source-specific enrichment such as Live Training, enforce visibility rules, and provide role-aware
> event details using the existing API/client/web patterns.

## Purpose

Implement the first usable global calendar layer:

- expose visible scheduled calendar events through API endpoints,
- return details needed by the calendar UI and event details panel,
- regenerate the web API client,
- add a Calendar route using React FullCalendar,
- add calendar visibility and sidebar indicator tests.

This slice should not implement LiveKit token issuing, LiveKit room creation, native PPTX rendering,
recording, chat, or recurrence materialization.

## Locked Decisions

- Use React FullCalendar for the calendar UI.
- Calendar is behind a tenant Calendar feature toggle.
- Live Training calendar data additionally requires the tenant Live Training feature toggle.
- Calendar endpoints must be guarded by feature checks, not only filtered in services.
- Use the generic `calendar_events` table as the calendar source.
- Start calendar queries from `calendar_events`, then merge source-specific enrichment through CTEs
  or joins.
- In v1, `calendar_events` rows are concrete occurrences only.
- Do not add physical calendars, generic calendar audiences, generic RSVP, or generic attendance in
  this slice.
- Calendar visibility is derived from Live Training ownership, staff membership, visibility scope,
  and linked course enrollment.
- Calendar API responses should be shaped for the UI, not as raw DB rows.
- Web code must use the generated API client through `ApiClient.api...`.
- E2E tests should use stable `data-testid` selectors, not visible text.

## Dependencies

- LT-01 DB schema and shared constants exist.
- Live Training permissions exist in shared constants.
- `live_training` lesson type exists in shared/frontend constants.
- `calendar_events` and Live Training tables have tenant RLS enabled.

## Non-Goals

- No recurrence expansion from `rrule`.
- No editing recurring series.
- No user/group audience tables.
- No generic calendar invitation/RSVP workflow.
- No LiveKit join/start/end token flow.
- No attendance tracking beyond showing the fields that already exist in event/session summaries.
- No course progress/completion implementation.

## API Scope

Add calendar-facing endpoints under the Live Training module unless a dedicated calendar module is
introduced first.

Endpoint/module details are specified in
`docs/live-training/specs/LT-02-calendar-module-endpoints.md`.

Recommended endpoints:

```text
GET /calendar/events
GET /calendar/events/:eventId
GET /calendar/today-indicator
```

### List Events

`GET /calendar/events`

Query params:

```text
start string ISO date/datetime, required
end string ISO date/datetime, required
timezone string optional
```

Rules:

- `start` is inclusive.
- `end` is exclusive.
- Validate that `end > start`.
- Apply a defensive maximum range. Suggested default: 3 months.
- Return only events visible to the current user. Tenant isolation is handled through RLS.
- Include events that overlap the requested range:
  - `starts_at < end`
  - `ends_at > start`
- Do not expand `rrule` in v1.

Response shape:

```ts
type CalendarEventListItem = {
  id: string;
  uid: string;
  sourceType: "live_training";
  sourceId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  allDay: boolean;
  status: "scheduled" | "cancelled" | "ended" | "expired";
  deliveryType: "online" | "offline";
  sourceStatus: "scheduled" | "active" | "ended" | "cancelled" | "expired";
  sourceVisibilityScope: "all" | "linked_courses";
  sourceRole: "admin" | "author" | "trainer" | "co_trainer" | "moderator" | "observer";
  linkedCourses: Array<{
    courseId: string;
    courseTitle: string;
  }>;
  actions: {
    canView: boolean;
    canEdit: boolean;
    canLinkCourse: boolean;
    canStart: boolean;
    canJoin: boolean;
    canEnd: boolean;
    canViewReport: boolean;
  };
};
```

Wrap the response with the existing `BaseResponse` or equivalent list response pattern used by the
API.

### Event Details

`GET /calendar/events/:eventId`

Response should include the list item fields plus:

```ts
type CalendarEventDetails = CalendarEventListItem & {
  author: {
    id: string;
    fullName: string | null;
    email: string;
  };
  trainers: Array<{
    userId: string;
    fullName: string | null;
    email: string;
    role: "trainer" | "co_trainer" | "moderator";
  }>;
  materials: {
    before: CalendarEventMaterial[];
    after: CalendarEventMaterial[];
  };
  latestSession: {
    id: string;
    status: "waiting" | "active" | "ended" | "failed";
    actualStartedAt: string | null;
    actualEndedAt: string | null;
    peakParticipants: number;
    uniqueParticipantCount: number;
  } | null;
};

type CalendarEventMaterial = {
  resourceId: string;
  title: string;
  mimeType: string | null;
  size: number | null;
  relationshipType: "live_training_before" | "live_training_after";
};
```

At this stage, `canStart`, `canJoin`, and `canEnd` may be returned as `false` or disabled with a
reason until LiveKit meeting flow is implemented.

### Today Indicator

`GET /calendar/today-indicator`

Purpose: support the left-sidebar indicator without loading the full calendar.

Response:

```ts
type CalendarTodayIndicator = {
  hasVisibleEventsToday: boolean;
  visibleEventsTodayCount: number;
  nextEvent: {
    eventId: string;
    sourceType: "live_training";
    sourceId: string;
    title: string;
    startsAt: string;
    deliveryType: "online" | "offline";
    status: "scheduled" | "active" | "ended" | "cancelled" | "expired";
  } | null;
};
```

Use the current user's tenant timezone or the request timezone if the existing app shell already has
a preferred timezone concept. Do not count inaccessible events.

## Visibility Rules

A calendar event is visible when all base conditions pass:

- the event is visible in the current RLS tenant context,
- the event overlaps the requested date range.

Then source-specific visibility must pass. For Live Training-backed events at least one access
condition must pass:

- user has admin-level Live Training read/manage authority,
- user is the Live Training author,
- user is assigned in `live_training_members`,
- `visibility_scope = all`,
- `visibility_scope = linked_courses` and the user is enrolled in at least one linked course.

For `visibility_scope = linked_courses`, no linked course means the event is visible only to admin,
author, and assigned staff. It must not become global by accident.

## Role And Action Mapping

Return one primary role for UI decisions:

```text
admin > author > trainer > co_trainer > moderator > observer
```

Action rules:

- `canView`: true for every visible event.
- `canEdit`: admin or author/update-own authority before the event is ended/cancelled/expired.
- `canLinkCourse`: admin or author/update-own authority before the event starts.
- `canStart`: false in LT-02 UI until LiveKit meeting flow lands, but calculate the future
  permission shape from admin/author/trainer/co-trainer/moderator.
- `canJoin`: false in LT-02 UI until LiveKit meeting flow lands, but visible observers should see
  the future action as disabled/waiting.
- `canEnd`: false in LT-02 UI until LiveKit meeting flow lands.
- `canViewReport`: admin, author, assigned trainer, or manageable linked course authority.

## Frontend Scope

Install and use React FullCalendar packages in `apps/web`.

Recommended packages:

```text
@fullcalendar/react
@fullcalendar/daygrid
@fullcalendar/timegrid
@fullcalendar/interaction
```

Implement:

- Calendar route reachable from the left sidebar.
- Calendar page loader/query hook using the generated API client.
- React FullCalendar configuration:
  - month view,
  - week/time view if it is cheap to add cleanly,
  - date-range-driven fetching,
  - event click handler,
  - today highlighting,
  - event state classes for scheduled/active/ended/cancelled/expired,
  - online/offline visual label.
- Event details panel/modal:
  - title, description, schedule, status,
  - linked courses,
  - trainers,
  - materials grouped as before/after,
  - role-aware disabled/enabled actions.
- Sidebar indicator based on the today indicator endpoint.

Use existing UI components and styling conventions. Do not add a marketing-style calendar page.

## FullCalendar Event Mapping

Map API events to FullCalendar events like this:

```ts
{
  id: event.id,
  title: event.title,
  start: event.startsAt,
  end: event.endsAt,
  allDay: event.allDay,
  classNames: [
    `calendar-event--${event.status}`,
    `calendar-event--${event.deliveryType}`,
  ],
  extendedProps: {
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    role: event.sourceRole,
    actions: event.actions,
  },
}
```

Do not put authorization logic only in `extendedProps`; backend visibility and action calculation
remain authoritative.

## Backend Implementation Notes

- Prefer a calendar-focused repository method rather than embedding large query logic in the
  controller.
- Start list/detail/indicator queries from `calendar_events`, then merge Live Training enrichment
  using CTEs or joins in the main query.
- Keep date filtering on `calendar_events.starts_at` / `calendar_events.ends_at`.
- Join Live Training tables only as needed for visibility and summary fields.
- Avoid loading all tenant users or materializing learner rows.
- Return linked courses as a compact array.
- Avoid N+1 queries for trainers/materials/details.
- Do not pass tenant IDs through public endpoint or repository method contracts; rely on the
  existing RLS-aware DB context.

## Testing

### API E2E

Add API E2E coverage for:

- admin sees visible calendar events in range,
- author sees own event,
- assigned trainer sees assigned event,
- course learner sees linked-course event,
- unrelated learner does not see linked-course event,
- `visibility_scope = all` is visible to tenant users,
- unlinked `visibility_scope = linked_courses` is not visible to unrelated learners,
- date range overlap includes multi-day events correctly,
- today indicator counts only visible events.

### Web E2E

Add web E2E coverage for:

- Calendar route loads and renders visible events,
- inaccessible events are not rendered,
- changing calendar date range triggers a new event fetch,
- event click opens details,
- details panel shows role-aware disabled start/join state before LiveKit flow,
- sidebar today indicator appears only when the user has visible events today.

Use shared fixtures/factories/flows where available. Prefer `data-testid` selectors.

## Definition Of Done

- Calendar API endpoints implemented with feature guards, permission guards, and RLS-backed tenant
  isolation.
- Visibility rules implemented in service/repository layer.
- Swagger/API schema regenerated.
- Web API client regenerated.
- Calendar route uses React FullCalendar and generated API client.
- Sidebar today indicator implemented.
- API E2E and web E2E cover visibility and date-range behavior.
- Narrow validation commands pass:
  - API typecheck or targeted API test command for touched backend code,
  - web typecheck or targeted web test command for touched frontend code,
  - targeted E2E where added.
