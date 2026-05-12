# LT-02 Calendar Module And Endpoint Spec

> Status: Implementation-ready v1 API spec.
>
> This document defines the NestJS calendar module boundary for LT-02. It should be implemented as
> a dedicated feature module, with focused controller/service/repository responsibilities and no
> LiveKit meeting runtime behavior.

## Purpose

Create a generic calendar read module that serves global calendar events. Live Training is only one
event-backed source that can enrich calendar rows; the calendar module must not be modeled as a Live
Training-specific reader.

The module should:

- expose current-user visible calendar events by date range,
- expose a single visible event details response,
- expose a lightweight today indicator for the app sidebar,
- keep all visibility and action calculation server-side,
- return UI-ready response DTOs for the generated web client,
- rely on database RLS tenant context instead of passing tenant IDs through public endpoint or
  repository method contracts.

## NestJS Module Shape

Create a dedicated `calendar` feature module:

```text
apps/api/src/calendar/
  calendar.module.ts
  calendar.controller.ts
  calendar.service.ts
  calendar.repository.ts
  schemas/
    calendar-event-list.schema.ts
    calendar-event-details.schema.ts
    calendar-today-indicator.schema.ts
    get-calendar-events-query.schema.ts
```

Recommended responsibilities:

- `CalendarController`
  - HTTP routing only.
  - Auth/permission decorators.
  - Query/path validation.
  - Wrap responses with `BaseResponse`.
- `CalendarService`
  - Visibility and action policy orchestration.
  - Date-range validation beyond schema basics.
  - DTO assembly.
  - Throws NestJS HTTP exceptions for invalid range or not found/inaccessible events.
- `CalendarRepository`
  - Drizzle queries only.
  - Queries run under the current user's RLS tenant context.
  - Date overlap filtering.
  - Compact projections for list/detail/indicator.

Do not make the calendar module depend on LiveKit. The calendar query should start from visible
`calendar_events`, then merge source-specific data such as Live Training through CTEs or joins.
That keeps Calendar global and lets future event sources plug into the same surface.

## Dependency Rules

- Use constructor injection only.
- Inject `DB` into `CalendarRepository`, not into the controller.
- Avoid circular imports with `LiveTrainingModule`.
- Do not duplicate providers already owned by another module.
- Prefer repository methods over controller/service inline SQL.
- Keep the service singleton-scoped.
- Do not use request-scoped providers unless a concrete existing app pattern requires it.

## Routes

Use a top-level calendar route:

```text
GET /calendar/events
GET /calendar/events/:eventId
GET /calendar/today-indicator
```

Reasoning:

- Calendar is a generic app surface, not only a Live Training subresource.
- The route stays stable if later event types are added.
- Live Training-specific write flows still belong in `live-training`.

## Permission Boundary

All endpoints require authenticated users. Calendar itself should use a calendar read permission or
the closest existing read permission if one already exists. Live Training permissions apply only to
Live Training-specific enrichment/actions.

Controller decorators:

```text
@RequirePermission(PERMISSIONS.CALENDAR_READ)
```

Service-level checks remain mandatory:

- RLS tenant context,
- calendar event visibility,
- source-specific visibility,
- source-specific role/action flags.

`@RequirePermission` is only the coarse gate. It does not replace row-level visibility checks.

## Feature Toggle Requirement

Calendar is a toggleable tenant feature because all new product surfaces should be feature-gated.
Live Training is also a separate toggleable tenant feature. Calendar routes require Calendar to be
enabled. Live Training-specific enrichment/actions require Live Training to be enabled.

- Calendar feature enabled for the current tenant on every Calendar route,
- Live Training feature enabled before returning Live Training source details/actions.

Implementation should be decided before coding LT-02, but the preferred NestJS shape is:

```text
@RequireFeature(FEATURES.CALENDAR)
```

backed by a guard that checks the current tenant feature configuration. This keeps feature checks
declarative at the controller level and avoids scattering toggle checks through every service
method. Live Training-specific enrichment should be disabled or omitted when
`FEATURES.LIVE_TRAINING` is off.

Rules:

- Add or reuse shared feature constants for `calendar` and `live_training`.
- Apply the Calendar feature gate to all Calendar routes.
- Apply the Live Training feature gate to Live Training-backed event queries/responses.
- Endpoints must be guarded; feature checks should not exist only as ad hoc service `if`
  statements.
- Service methods may still assert the feature where they are called outside HTTP controllers.
- Disabled feature behavior should be consistent across endpoints. Prefer `404` for specific event
  details and an empty result for list/indicator endpoints, unless the existing feature-flag pattern
  in the repo uses `403`.
- Add API E2E coverage for disabled Calendar behavior and disabled Live Training calendar-data
  behavior.

## Endpoint: List Calendar Events

```text
GET /calendar/events
```

Query params:

```text
start string ISO date or datetime, required
end string ISO date or datetime, required
timezone string optional
```

Validation:

- `start` must parse as a valid date/datetime.
- `end` must parse as a valid date/datetime.
- `end` must be after `start`.
- Maximum range: 3 months.
- If `timezone` is provided, it must be an IANA timezone string if the existing validation stack has
  support for that. Otherwise accept string and normalize later only when timezone utilities are
  introduced.

Database filter:

```text
calendar_events.starts_at < end
calendar_events.ends_at > start
```

Tenant isolation is handled by RLS. Do not pass tenant ID as an endpoint parameter or repository
input. Repository calls must run through the app DB context that has the current tenant RLS setting.

Query shape:

The main query should be event-first:

```text
WITH visible_events AS (
  SELECT calendar_events.*
  FROM calendar_events
  WHERE calendar_events.starts_at < :end
    AND calendar_events.ends_at > :start
)
SELECT ...
FROM visible_events
LEFT JOIN live_training_enrichment ...
```

For LT-02, add a Live Training enrichment CTE or joined subquery. Later event sources can add their
own enrichment without rewriting the calendar base query.

Visibility filter:

Generic calendar event visibility is evaluated first. For Live Training-backed events, source
visibility is true when at least one applies:

- current user has admin/manage authority,
- current user is `live_trainings.author_id`,
- current user is in `live_training_members`,
- `live_trainings.visibility_scope = all`,
- `live_trainings.visibility_scope = linked_courses` and current user is enrolled in one linked
  course.

Response:

```ts
type CalendarEventListResponse = {
  events: CalendarEventListItem[];
};

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
  linkedCourses: CalendarLinkedCourse[];
  actions: CalendarEventActions;
};

type CalendarLinkedCourse = {
  courseId: string;
  courseTitle: string;
};

type CalendarEventActions = {
  canView: boolean;
  canEdit: boolean;
  canLinkCourse: boolean;
  canStart: boolean;
  canJoin: boolean;
  canEnd: boolean;
  canViewReport: boolean;
};
```

Wrap as:

```text
BaseResponse<CalendarEventListResponse>
```

## Endpoint: Get Calendar Event Details

```text
GET /calendar/events/:eventId
```

Path params:

```text
eventId uuid, required
```

Rules:

- Return `404` when the event does not exist or is not visible to the current user.
- Do not leak whether an inaccessible event exists.
- Return the same role/action calculation as the list endpoint.
- Include source-specific details for the event source. For LT-02 this means Live Training
  materials grouped by phase and latest session summary.
- Do not expose LiveKit credentials.

Response:

```ts
type CalendarEventDetailsResponse = CalendarEventListItem & {
  author: CalendarEventUserSummary;
  trainers: CalendarEventTrainerSummary[];
  materials: {
    before: CalendarEventMaterial[];
    after: CalendarEventMaterial[];
  };
  latestSession: CalendarLatestSessionSummary | null;
};

type CalendarEventUserSummary = {
  id: string;
  fullName: string | null;
  email: string;
};

type CalendarEventTrainerSummary = CalendarEventUserSummary & {
  role: "trainer" | "co_trainer" | "moderator";
};

type CalendarEventMaterial = {
  resourceId: string;
  title: string;
  mimeType: string | null;
  size: number | null;
  relationshipType: "live_training_before" | "live_training_after";
};

type CalendarLatestSessionSummary = {
  id: string;
  status: "waiting" | "active" | "ended" | "failed";
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  peakParticipants: number;
  uniqueParticipantCount: number;
};
```

Wrap as:

```text
BaseResponse<CalendarEventDetailsResponse>
```

## Endpoint: Today Indicator

```text
GET /calendar/today-indicator
```

Query params:

```text
timezone string optional
```

Rules:

- Calculate today from the provided timezone or the user's tenant/default timezone.
- Count only visible events.
- Ignore inaccessible events.
- Return the next visible event for today by `starts_at`.

Response:

```ts
type CalendarTodayIndicatorResponse = {
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

Wrap as:

```text
BaseResponse<CalendarTodayIndicatorResponse>
```

## Role And Action Calculation

Calendar should return generic action flags but calculate them from the event source.

Primary role precedence:

```text
admin > author > trainer > co_trainer > moderator > observer
```

Action rules for LT-02:

- `canView`: true for every returned event.
- `canEdit`: admin or author/update-own authority before event is terminal.
- `canLinkCourse`: admin or author/update-own authority before event/session starts.
- `canStart`: false until LiveKit meeting runtime is implemented.
- `canJoin`: false until LiveKit meeting runtime is implemented.
- `canEnd`: false until LiveKit meeting runtime is implemented.
- `canViewReport`: admin, author, assigned trainer/co-trainer/moderator, or manageable linked
  course authority.

Future LiveKit work can change `canStart`, `canJoin`, and `canEnd` without changing endpoint names.

## Repository Method Sketch

```ts
class CalendarRepository {
  findVisibleEventsInRange(input: {
    userId: string;
    permissions: string[];
    start: Date;
    end: Date;
  }): Promise<CalendarEventListRow[]>;

  findVisibleEventDetails(input: {
    userId: string;
    permissions: string[];
    eventId: string;
  }): Promise<CalendarEventDetailsRow | null>;

  findVisibleEventsForDay(input: {
    userId: string;
    permissions: string[];
    dayStart: Date;
    dayEnd: Date;
  }): Promise<CalendarTodayIndicatorRow[]>;
}
```

Implementation notes:

- Keep SQL/Drizzle in repository methods.
- Start from `calendar_events` in a visible-events CTE, then merge source-specific enrichments in
  the main query.
- Do not start the calendar list query from `live_trainings`; that would make Calendar
  source-specific and harder to extend.
- Prefer `exists` subqueries for enrollment/assignment checks over loading participant lists.
- Aggregate linked courses compactly.
- Avoid N+1 material/trainer loading in details.
- Keep terminal status logic in service helpers so FE receives stable flags.
- Do not pass tenant ID through repository method signatures; rely on the existing RLS-aware DB
  context.

## Error Handling

- Invalid date range: `BadRequestException`.
- Range too large: `BadRequestException`.
- Invalid UUID: existing UUID pipe/schema behavior.
- Missing/inaccessible event details: `NotFoundException`.
- Unexpected DB errors: let global exception handling/logging handle them unless a narrower
  existing repository pattern exists.

## Test Plan

API E2E:

- admin sees visible calendar events in range,
- author sees own event,
- assigned trainer sees assigned event,
- learner enrolled in linked course sees linked-course event,
- unrelated learner does not see linked-course event,
- `visibility_scope = all` event is visible to tenant users,
- unlinked `visibility_scope = linked_courses` event is visible only to admin/author/assigned staff,
- date overlap includes multi-day events,
- invalid date range returns `400`,
- inaccessible detail returns `404`,
- today indicator counts only visible events.

Unit tests are optional if API E2E covers the service policy thoroughly, but role/action helper tests
are useful if action calculation grows.

## Definition Of Done

- `CalendarModule` is created and registered.
- `CalendarController`, `CalendarService`, and `CalendarRepository` exist.
- Endpoint schemas/DTOs exist under `calendar/schemas`.
- All endpoints are wrapped in `BaseResponse`.
- All endpoints run under RLS tenant context, are permission-gated, and are feature-gated.
- Visibility is enforced in service/repository logic.
- Swagger/API schema is regenerated.
- Web generated client is regenerated before FE work uses these endpoints.
- API E2E coverage exists for visibility, range filtering, details, and today indicator.
