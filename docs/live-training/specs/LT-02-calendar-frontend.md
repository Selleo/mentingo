# LT-02 Calendar Frontend Spec

## Summary

Build the first frontend Calendar slice as a read-first calendar projection for visible events.
Live Training is the only current event source, but the UI should consume the normalized Calendar API
shape so future event sources can be added without redesigning the page.

This slice includes:

- Calendar page using React FullCalendar.
- Calendar sidebar entry behind permission checks.
- FE-only today indicator derived from visible fetched events.
- Event details modal.
- Calendar day/slot selection create flow for independent Live Training events.

This slice does not include:

- LiveKit start/join/end actions.
- Generic Calendar event create/edit/delete.
- Course-linked Live Training creation.
  - Course-linked creation is owned by LT-05 through the lesson creation flow.
  - Calendar-created Live Trainings remain standalone until an explicit link-existing flow exists.

## Implementation Progress

- [x] Calendar sidebar entry is always available by `PERMISSIONS.CALENDAR_READ`; Calendar is no
      longer feature flagged.
- [x] Calendar sidebar route access requires `PERMISSIONS.CALENDAR_READ`.
- [x] Calendar navigation test handle and translations are added.
- [x] `/calendar` route exists under the authenticated dashboard/navigation layout.
- [x] Barebone React FullCalendar month view is implemented.
- [x] Calendar page uses a scoped `.calendar-shell` stylesheet with app design-system variables.
- [x] Calendar visible-range events are fetched with `ApiClient.api.calendarControllerGetEvents`.
- [x] Calendar API events are mapped to FullCalendar event objects from normalized root fields.
- [x] Add `@fullcalendar/timegrid` and `@fullcalendar/interaction`.
- [x] Add week/time view after the extra FullCalendar plugins are installed.
- [x] Add Calendar day/slot click create flow.
- [x] Add lightweight add-menu dialog for selected date/slot.
- [x] Add `useCreateLiveTraining` mutation hook.
- [x] Add basic Calendar-created Live Training form behind `globalSettings.liveTrainingEnabled`.
- [x] Invalidate Calendar events after successful Live Training creation.
- [x] Add `useCalendarEventDetails(eventId, language)`.
- [x] Add event details modal.
- [x] Add placeholder `/live-training/:id` route for full Live Training planning.
- [ ] Add FE-only today indicator.
- [ ] Add online/offline visual marker from `event.payload.liveTraining.deliveryType`.
- [ ] Add frontend tests for route visibility, event mapping, rendering, and details modal.

## Routes And Navigation

- Add `/calendar` under the authenticated dashboard/navigation layout.
- Add Calendar to the sidebar when the current user has `PERMISSIONS.CALENDAR_READ`.
- Add `calendar` route access config requiring `PERMISSIONS.CALENDAR_READ`.
- Use the existing navigation/test handle pattern for the sidebar item.
- Use an existing calendar icon if available in `apps/web/app/assets/svgs`; otherwise add a small
  matching SVG asset.

## Dependencies

FullCalendar packages already present:

- `@fullcalendar/core`
- `@fullcalendar/daygrid`
- `@fullcalendar/react`

Add:

- `@fullcalendar/timegrid`
- `@fullcalendar/interaction`

## API And Query Hooks

Use only the generated API client:

- `ApiClient.api.calendarControllerGetEvents`
- `ApiClient.api.calendarControllerGetEventDetails`

Add React Query hooks using existing query patterns and the shared query client:

- `useCalendarEvents({ start, end, language, timezone })`
- `useCalendarEventDetails(eventId, language)`

The list query should be date-range driven from the FullCalendar visible range.

The details query should run only after an event is selected.

## Event Mapping

Calendar API events are normalized. Do not read source-specific fields from the event root.

Use root fields for generic calendar data:

```ts
event.id;
event.uid;
event.sourceType;
event.sourceId;
event.title;
event.description;
event.startsAt;
event.endsAt;
event.timezone;
event.status;
event.actions;
```

Use Live Training-specific fields only from:

```ts
event.payload.liveTraining;
```

Map to FullCalendar events:

```ts
{
  id: event.id,
  title: event.title,
  start: event.startsAt,
  end: event.endsAt,
  classNames: [
    `calendar-event--${event.status}`,
    `calendar-event--${event.sourceType}`,
    `calendar-event--${event.payload.liveTraining.deliveryType}`,
  ],
  extendedProps: {
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    actions: event.actions,
    payload: event.payload,
  },
}
```

Backend visibility and action flags remain authoritative. Frontend mapping must not reimplement
visibility rules.

## Calendar Page UI

Use a quiet operational page layout consistent with existing dashboard pages.

Required UI:

- Page title: Calendar.
- FullCalendar month view by default.
- Week/time view using `@fullcalendar/timegrid` if it fits cleanly.
- Date-range fetching on visible range changes.
- Event state styling for:
  - `scheduled`
  - `active`
  - `ended`
  - `cancelled`
  - `expired`
- Online/offline visual marker from `event.payload.liveTraining.deliveryType`.
- Loading and empty states matching existing app patterns.

Do not build a marketing-style page or decorative hero.

## Today Indicator

Implement today indicator only on the frontend for now.

- Derive it from visible fetched events.
- Count only events returned by the Calendar API.
- Do not call or add a backend today-indicator endpoint.
- If the current fetched range does not include today, either:
  - do not show the indicator, or
  - fetch today range separately using the same Calendar events endpoint.

Recommended default: fetch today range separately so the sidebar/dashboard indicator is not coupled
to the currently opened calendar range.

## Event Details Modal

On event click:

- Store selected `eventId`.
- Fetch details with `calendarControllerGetEventDetails`.
- Open a modal using existing modal/dialog components.

Show:

- title
- description
- starts/ends/timezone
- calendar status
- Live Training delivery type
- linked courses
- author
- trainers
- timezone in the time card
- location when the Live Training is offline
- `Go to Live Training` action that routes to `/live-training/:sourceId`

Do not show start/join/end buttons in this slice. These actions belong to the LiveKit meeting flow.
Do not render the full materials/session/live lesson data here; the modal stays metadata-only.

## Calendar Add Flow

Implemented interaction:

1. User clicks a day or empty slot.
2. Open a modular add menu card/modal for the selected date.
3. If `globalSettings.liveTrainingEnabled === true`, show `Live Training` as an available add
   option.
4. Replace the menu content with a Live Training create form.
5. Submit creates an independent Live Training.
6. Invalidate Calendar events queries so the new training appears.

The Live Training add option and Live Training create section must not be rendered when the tenant
Live Training feature is disabled in settings.

Drag selection requirements:

- Users can drag across days/time slots to span the initial `startsAt` and `endsAt` values.
- Month/day-grid selection should default to the nearest half hour and end 30 minutes later.
- Week/day time-grid selection should preserve the exact selected time range.
- FullCalendar should show a selection highlight/mirror placeholder while dragging in month view.
- Week/day time-grid dragging should avoid the heavy overlay and keep visual feedback minimal.
- Single day/slot clicks still open the same add menu.
- Calendar interaction state should stay in the calendar reducer so visible range, selected range, and
  dialog state do not drift apart.

## Live Training Create Form Fields

Calendar-created Live Training is independent and has no course links. Course-linked Live Training is
created from the course add-lesson flow.

Required fields:

- `title`
- `title` is capped by `LIVE_TRAINING_TITLE_MAX_LENGTH`
- `language`, using the existing language selector pattern
- `startsAt`, using shadcn Calendar date picker plus time picker
- `endsAt`, using shadcn Calendar date picker plus time picker
- `timezone`, defaulted from browser/user context
- `deliveryType`
- `maxParticipants`, default `100`, max `100`

Optional fields:

- `description`
- `description` is capped by `LIVE_TRAINING_DESCRIPTION_MAX_LENGTH`
- `trainerUserIds`, for additional trainers only; backend includes the author/current user
- `beforeResourceIds`
- `afterResourceIds`
- `settings.viewerPermissions.microphoneEnabled`
- `settings.viewerPermissions.cameraEnabled`

Current implementation note:

- `trainerUserIds`, `beforeResourceIds`, and `afterResourceIds` remain planned for a follow-up form
  pass.
- Viewer permissions are rendered as settings toggles and are hidden for offline trainings.
- Date fields use the shadcn Calendar popover; time fields use a shadcn Select-based 15-minute
  picker.
- Each field has a dark zero-delay tooltip consistent with the AI Mentor lesson creation tooltips.

Trainer selection requirements:

- Use a multi-selector field with a search input.
- Show each user option with profile picture/avatar, full name, and email.
- Load users with `useInfiniteQuery` so the dropdown supports infinite scroll pagination.
- Keep selected users visible as removable chips/items.
- Do not include the current user as a selectable additional trainer if the backend already adds the
  author automatically.

Offline-only field:

- `location`; do not render it for online mode

Explicitly excluded from Calendar create:

- `linkedCourseIds`
- lesson linking
- course visibility selection

## Test Plan

Add tests when implementing the frontend slice:

- Event mapping from normalized API response to FullCalendar event objects.
- Calendar route/sidebar visibility for feature and permission checks.
- Calendar route renders visible events.
- Inaccessible events are not rendered because they are not returned by the API.
- Event click opens details modal and renders details.
- Today indicator counts only visible fetched events.
- Later add-flow tests:
  - day click opens add menu
  - Live Training option opens create form
  - online mode hides location
  - offline mode shows location
  - create invalidates calendar event queries

Use existing E2E fixture/factory patterns and prefer `data-testid` selectors.

## Assumptions

- Backend Calendar API response shape is stable for this frontend slice.
- Calendar-created Live Training has no linked courses and is visible to all users under current
  backend behavior.
- Course-linked Live Training creation belongs to the course add-lesson flow.
- Today indicator remains frontend-derived unless a backend endpoint is explicitly reintroduced.
