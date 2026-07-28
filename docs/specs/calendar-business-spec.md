# Calendar Business Spec

## Business Overview

Calendar gives learners, trainers, and administrators one place to see time-based learning commitments. It combines scheduled live training, mandatory course due dates, and a user's Microsoft Outlook events so users do not need to inspect separate systems to understand what is coming up. Users can also optionally publish Mentingo commitments into a dedicated `Mentingo` calendar in Outlook.

For HR and L&D operations, the calendar is a planning and coordination view. It helps administrators schedule instructor-led sessions in context, gives learners a clear reminder surface for required learning, and reduces conflicts with personal or work commitments already held in Outlook.

## Who Uses It

- Learners checking upcoming live sessions and mandatory course deadlines.
- Administrators scheduling live training from a calendar view.
- Trainers and authors who need visibility into training sessions connected to them.
- L&D managers reviewing time-sensitive learning obligations across the tenant.
- Microsoft 365 users who want a read-only view of their own Outlook calendar alongside Mentingo commitments, or want those commitments copied into Outlook.

## Feature Functions

- Display calendar events for the visible date range.
- Show live training events and mandatory course due-date events in a unified feed.
- Open event details directly from the calendar.
- Navigate from a live training event to the live training detail page.
- Create an offline or online live training session from a selected calendar date range when permitted.
- Connect, replace, reconnect, manually synchronize, or disconnect one Microsoft Outlook account from the Integrations tab in settings.
- Import the connected user's primary Outlook calendar as a read-only calendar source.
- Optionally export live trainings and mandatory course due dates to a separate, Mentingo-managed Outlook calendar.
- Reconcile exported events when Mentingo events change, recipients gain or lose eligibility, or a user manually synchronizes.
- Mask private and confidential Outlook events and never expose their location or Outlook link.
- Show synchronization, reconnect, admin-approval, stale-data, and six-month import-horizon guidance.
- Localize event titles and details according to the selected language.
- Apply permission, enrollment, authorship, host, and feature-flag rules before showing events or creation controls.

## End-User Value

Learners can quickly answer what training is scheduled, when mandatory courses are due, and whether those commitments conflict with Outlook events. Administrators can create live sessions while seeing their own existing commitments, which reduces accidental scheduling conflicts. Trainers get a more direct view of events they host or manage.

The Outlook connection is personal to each user. Imported events are not editable in Mentingo and are not made visible to tenant administrators or other users. Exported entries are independent copies for each eligible recipient; they do not send invitations or collect RSVPs. Mentingo remains the source of truth, so changes made to managed Outlook copies are overwritten during reconciliation.

## How It Works

The calendar page requests events for the current date range, selected language, and user timezone. The API returns a normalized event list instead of exposing separate live-training and due-date queries to the web app.

Event details are resolved by source type. Live training events show session details and a link to the live-training page. Course due-date events represent mandatory group-course deadlines and show the relevant course deadline information.

Course due-date events are synchronized from group-course due dates. The synchronization updates existing events, creates missing ones, and reactivates cancelled events instead of producing duplicate calendar records.

A user can connect one Microsoft account from the Integrations tab in settings. Mentingo requests calendar read/write consent for new or outbound-enabled connections, performs an initial import, and then keeps a rolling window from 30 days in the past through six months in the future synchronized through Microsoft change notifications, incremental synchronization, and scheduled reconciliation. Selecting a different Microsoft account requires explicit replacement confirmation. Outbound synchronization is opt-in; existing read-only connections must be reauthorized before export starts.

When outbound synchronization is enabled, Mentingo creates or locates one non-default `Mentingo` calendar and exports eligible live trainings and course due dates asynchronously. Live trainings go to the author, hosts, and enrolled learners linked through the relevant course lesson. Due dates go to enrolled learners and the course owner. A durable Mentingo marker keeps these copies out of the inbound Outlook projection. If the dedicated calendar is deleted, Mentingo pauses export instead of recreating it silently.

Outlook events are stored as normalized calendar records and remain read-only. Deleted and cancelled Microsoft events are removed from the active calendar view. Private and confidential events are imported with a generic title and without their location or external link. If authorization expires, the last successfully imported data remains visible with a stale warning until the user reconnects. Disconnecting or archiving the user removes the connection and imported Outlook events.

## Key Technical Context

- Frontend route: `/calendar`.
- Frontend implementation: `apps/web/app/modules/Calendar` and the Settings Integrations tab.
- API implementation: `apps/api/src/calendar`.
- API endpoints: calendar event list/details plus Microsoft connection, sync, disconnect, OAuth callback, and notification endpoints under `/api/calendar/microsoft` and `/api/auth/microsoft-calendar`.
- Access requires `PERMISSIONS.CALENDAR_READ`.
- Creating live training from the calendar also depends on the Live Training feature and `PERMISSIONS.LIVE_TRAINING_CREATE`.
- Managing the personal Microsoft connection uses the existing self-account permission.
- Supported event source types include Live Training, Course Due Date, and Microsoft Outlook.
- Microsoft refresh tokens use envelope encryption at rest. OAuth state is signed and bound to the tenant, user, intended action, origin, expiry, and nonce.
- Tenant row-level security and owner filtering prevent users, including tenant administrators, from reading another user's imported Outlook events.
- BullMQ handles initial, incremental, webhook-triggered, lifecycle, and reconciliation sync work. Microsoft subscriptions are renewed before expiry and recreated if Microsoft no longer recognizes them.
- Outbound mappings are isolated from imported Outlook mappings and are keyed per tenant, connection, Mentingo event, and recipient; BullMQ retries Graph work without blocking local calendar changes.
- The managed-event marker used to distinguish Mentingo-owned Outlook copies is configurable per deployment so installations can choose their own Microsoft Graph extended-property identifier.

## Test Evidence

- Web E2E coverage verifies opening a live training event from the calendar, seeing event details, navigating to the live-training detail page, and creating an offline live training session from the calendar.
- API E2E coverage verifies due-date event synchronization, updating existing due-date events, creating missing due-date events, and reactivating cancelled events without duplicate UIDs.
- API E2E coverage verifies Outlook events remain owner-only even for tenant administrators, cancelled imports stay hidden, and cross-user detail access returns not found.
- API unit coverage verifies Outlook event mapping, private-event masking, unsafe-link removal, tombstones, refresh-token envelope encryption, OAuth-state tamper protection, multi-page delta synchronization, deletion handling, token rotation, reconnect behavior, and subscription renewal/recreation.
- Web unit coverage verifies read-only Outlook details, safe Outlook navigation, metadata presentation, and link suppression for private events.
- Outbound API coverage should verify Graph payloads, mapping idempotency, recipient deduplication, authorization failures, and dedicated-calendar deletion handling.
