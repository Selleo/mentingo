# Personal Dashboard Business Spec

## Business Overview

Student dashboard tiles turn the Mentingo home page into a personalized learning action center. Learners can immediately see what to continue, which mandatory courses need attention, how much assigned learning they have completed, which certificates they hold, and whether a daily AI Mentor practice is available.

For HR and L&D teams, this creates a clearer path from assignment to action: urgent learning is surfaced earlier, progress is easier for learners to understand, and achievements remain visible. Learners can personalize the order and size of available tiles, while permissions and tenant configuration ensure they only see relevant capabilities.

This branch replaces the learner placeholders with five production widgets: Continue learning, Required courses, Course completion, Certificates, and AI Mentor practice. The three administrator widgets remain placeholders.

## Who Uses It

- Administrators with dashboard access arrange the three admin widgets around the operational information they will need most often.
- Learners with dashboard access arrange five learner widgets around their day-to-day learning workflow. The three course widgets are enabled by default; Certificates and AI Mentor practice are opt-in.
- Users with another system role can access the route when they have `dashboard.read`, but the current shared catalog does not define dedicated content-creator or trainer widgets. A user with multiple roles receives the widgets allowed for any of those roles.

## Feature Functions

- Present role-relevant widgets in a responsive personal layout.
- Reorder visible widgets by dragging a card with pointer, touch, or keyboard controls.
- Change a widget between only the widths allowed by its shared definition.
- Add or remove optional widgets through the widget library while keeping required widgets visible.
- Restore the current role- and feature-aware default layout without saving it immediately.
- Save or discard a draft containing the selected widget IDs, order, and width.
- Filter obsolete or unavailable saved widgets before presenting the dashboard.
- Resume any enrolled course currently in progress, with progress, the next incomplete lesson when available, and a direct course fallback for formats without a lesson destination.
- Review every unfinished mandatory course, including assignments without a deadline, with overdue, due-soon, upcoming, and no-deadline states.
- Summarize completed, in-progress, and not-started course assignments.
- Show active certificates and the nearest certificate expiring within 30 days, then open a paginated dialog containing every active certificate.
- Offer one standalone AI Mentor practice per learner-local day when the tenant AI runtime is configured.

## End-User Value

Learners spend less time searching for their next action and are more likely to resume active learning, notice mandatory deadlines, and recognize their progress and achievements. HR and L&D teams gain a more consistent learner experience that supports course completion, compliance follow-through, engagement, and self-directed development without adding operational steps for administrators.

Personal layout persistence, responsive sizing, and role-aware availability keep the experience relevant and usable across devices while preventing unavailable or unauthorized tiles from creating clutter.

## How It Works

The user opens `/dashboard` and sees the widgets stored in their personal settings. Selecting **Customize dashboard** creates an editable draft. The user can reorder cards, change supported widths, and open the widget library to show or hide optional widgets. **Restore default** replaces only the draft with the current default returned by the API; **Save** persists it, while **Cancel** returns to the previously saved layout.

A widget is visible when it is present in the saved `dashboard.widgets` array. There is no separate `enabled` property. Each saved item contains a stable widget ID, a non-negative order used for sorting, and a width of `1` (single column) or `2` (double column). Adding a widget uses its configured default width and appends it to the draft; removing or dragging widgets recalculates their order.

Mentingo determines the effective catalog on the server. It starts with the shared widget definitions, then filters them by the user's roles, permissions, tenant-level feature flags, and AI runtime availability. The same filtering is applied when loading a saved layout and when producing the default layout. Unknown, obsolete, or currently unavailable IDs are therefore not rendered. Submitted settings are structurally validated, and the API additionally verifies that the chosen width is allowed for the specific widget.

The learner starts from the dashboard and sees every enrolled course whose progress is already underway, ordered by recent activity. Each row shows the course image, progress percentage, and next incomplete lesson when one exists. Courses without a lesson destination, including formats that manage progress differently, remain visible and open at the course level.

Mandatory learning is presented as a complete action list rather than a single alert. Mentingo includes every unfinished mandatory assignment, whether its deadline is overdue, due within seven days, later, or not configured. Learners can open any row directly, while the footer summarizes the total and calls out overdue work.

The certificate tile keeps its compact count and nearest-expiry summary. Selecting the count or **View all certificates** opens a responsive dialog that loads the learner's active certificates in pages. Each result shows the course, issue date, and expiration status and links to the corresponding certificate. Empty data never hides a widget; every widget owns its loading, error, retry, populated, and empty presentation.

## Key Technical Context

- The persisted user-settings structure is:

  ```yaml
  dashboard:
    widgets:
      - id: DashboardWidgetId
        order: non-negative integer
        width: 1 | 2
  ```

  `widgets` contains only visible tiles; it does not contain `enabled` or presentation data.

- The shared catalog in `packages/shared/src/constants/dashboard.ts` defines each widget's behavior independently from the saved layout:

  ```ts
  {
    alwaysVisible: boolean;
    defaultVisible: boolean;
    defaultWidth: 1 | 2;
    defaultOrder: number;
    allowedWidths: readonly (1 | 2)[];
    allowedRoles?: readonly SystemRoleSlug[];
    requiredPermissions?: readonly PermissionKey[];
    requiredFeature?: FeatureKey;
    requiresAiConfigured?: boolean;
  }
  ```

- The administrator catalog retains `a_placeholder_1..3`. Learner IDs are `s_continue_learning`, `s_required_course`, `s_course_completion`, `s_certificates`, and `s_ai_mentor_practice`. Continue learning is required and double-width; Required course and Certificates support one or two columns; Course completion is single-width; AI Mentor practice is double-width.
- The course widgets require `course.read_assigned`, Certificates requires `certificate.read`, and AI Mentor practice requires `ai.use` plus a configured tenant AI runtime. Certificates and AI Mentor practice are not included in the default layout.
- A data migration maps `s_placeholder_1..3` to the first three production IDs in existing user settings without changing array order, width, or visibility.
- `GET /api/course/dashboard-summary` supplies arrays for all in-progress and mandatory courses plus the aggregate completion view. `POST /api/course/:courseId/open` records genuine learner access and helps order active courses by recency.
- `GET /api/certificates/dashboard-summary` supplies the lightweight count and expiry view. The certificate dialog lazily reuses the paginated certificate API with the authenticated learner's ID, so opening the dashboard does not download the complete certificate history.
- Frontend presentation is a separate exhaustive registry in `apps/web/app/modules/Dashboard/Home/widgetRegistry.tsx`. Each ID maps to a React component, translated title and description keys, an icon, and optional icon styles; these fields are never persisted in user settings.
- `GET /api/settings` supplies the saved layout, `GET /api/settings/dashboard` supplies the effective list of available IDs, `GET /api/settings/dashboard/default` supplies the effective default items, and `PUT /api/settings` saves the layout. The dashboard catalog endpoints and the `/dashboard` route require `dashboard.read`.
- The grid uses one column on phones, two on medium screens, and four on large screens. `DashboardWidgetShell` owns drag and resize controls, while each registered widget owns its card content. All visible dashboard strings exist in the six supported web locales.

## Test Evidence

Frontend dashboard tests cover saved-widget rendering, editing, width changes, widget selection, restore, and persistence. The production widget components independently cover loading, error, empty, and populated states, prove that multiple in-progress and mandatory courses render together, and verify that the certificate summary opens a dialog containing every loaded certificate.

Backend settings tests cover stable IDs, widths, defaults, permission filtering, and the AI configuration gate. The course contract distinguishes full course lists from completion aggregates, while certificate access remains permission-protected and tenant-scoped. Dedicated browser coverage for long learner course lists and certificate-dialog pagination is not yet present.
