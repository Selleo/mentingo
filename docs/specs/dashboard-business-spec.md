### Business Overview

The dashboard gives learners and learning administrators a role-appropriate starting point for their most important learning work. Learners can return to active courses, monitor required training and certificates, and see upcoming events. Administrators and content creators can identify completion gaps and deadline risks without first opening detailed analytics.

The backend provides default widget layouts based on a user's assigned system roles and removes widgets when the user lacks the permissions needed to use them. Authenticated users can read and replace their own layout through the dashboard API. Dashboard metric data and drag-and-drop customization in the web application are not implemented yet.

### Who Uses It

- Learners return to in-progress learning, review required courses, monitor overall completion and certificates, and see relevant calendar events.
- Administrators monitor organization-wide course completion, deadline risks, incomplete courses, and tenant learning events.
- Content creators monitor the same management themes for the courses they are allowed to manage; exact data scoping will be enforced when widget data APIs are implemented.
- Trainers receive a calendar-focused default and can later gain dedicated live-training widgets.

### Feature Functions

- Provide a default dashboard layout appropriate to each system role.
- Combine defaults for users who hold multiple roles without duplicating widgets.
- Remove default widgets when the user lacks their required permissions.
- Keep stable widget identifiers and sizes that can later be shared by the API and web application.
- Preserve a user's complete widget order and settings as one consistent layout update.
- Prepare learner, administrator, content creator, trainer, and shared calendar widget groups for later implementation.

### End-User Value

The dashboard will reduce navigation time for learners and make completion risks easier for HR and L&D teams to notice. Permission-aware defaults provide a relevant starting point while supporting Mentingo's mixed-role users and custom access model.

### How It Works

When a user opens the dashboard, Mentingo will resolve the layout associated with their roles. Users with multiple system roles receive the combined set of relevant defaults, while duplicate shared widgets such as the calendar appear only once. A widget is included only when the user has the permissions required for that capability.

The current implementation provides default-layout resolution and API operations to read or replace a user's complete layout. Replacing a layout is atomic, so a failed update cannot leave only part of the widget order saved. The API derives user and tenant identity from the authenticated session and prevents layout changes in support mode. Widget metrics are not loaded yet.

### Key Technical Context

- Widget identifiers and sizes are shared through `packages/shared/src/constants/dashboard.ts`.
- Default layouts and permission requirements live in the API dashboard domain.
- `DashboardService.getDefaultLayout` resolves role defaults and filters them using the authenticated user's permissions.
- `DashboardService.getLayout` falls back to role defaults when no saved layout exists; saving rejects duplicate or inaccessible widgets before persistence.
- `DashboardRepository` reads a tenant-scoped user's layout and replaces its widget collection in one database transaction.
- `GET /dashboard/layout` returns the saved layout or role-aware defaults, while `PUT /dashboard/layout` replaces the authenticated user's layout.
- Custom roles currently receive no default layout unless the user also holds a system role; future availability should remain permission-driven.
- Existing tenant isolation will apply when dashboard persistence and metric queries are added.

### Test Evidence

Unit coverage verifies administrator and learner defaults, permission filtering, multi-role deduplication, the empty fallback for a custom-only role, and controller delegation. A backend E2E spec covers authenticated default retrieval, layout replacement and retrieval, duplicate rejection, and unauthenticated access rejection, but its local execution remains pending because the test PostgreSQL service was unavailable. Frontend E2E coverage remains pending.
