# Personal Dashboard Business Spec

## Business Overview

The personal dashboard gives users a configurable starting point for the learning information and actions relevant to their role. Its tile layout reduces navigation effort and lets each user decide which optional widgets are visible, how they are ordered, and how much horizontal space they occupy.

The dashboard combines per-user layout persistence with operational learning information. Administrators can monitor organization-wide course completion, deadline risks, courses with the most unfinished enrollments, and learning events without leaving their start page. Users can enter edit mode, reorder widgets, switch between supported widths, manage visibility in a widget library, restore the role-aware default layout, and save or discard a draft. Learner-specific widget bodies remain placeholders for a later implementation.

## Who Uses It

- Administrators with organization statistics access monitor completion across every active course enrollment, identify mandatory training at risk, open course or learner details, and review learning events.
- Learners with dashboard access arrange the three learner widgets around their day-to-day learning workflow.
- Users with another system role can access the route when they have `dashboard.read`, but the current shared catalog does not define dedicated content-creator or trainer widgets. A user with multiple roles receives the widgets allowed for any of those roles.

## Feature Functions

- Present role-relevant widgets in a responsive personal layout with a consistent maximum tile height.
- Show completed, in-progress, and not-started course enrollments with an organization-wide completion rate.
- Highlight overdue mandatory enrollments and those due within seven days, grouped by course and affected learner.
- Rank courses with unfinished enrollments and link directly to course statistics.
- Present live trainings and mandatory-course deadlines in a navigable monthly calendar, with selected-day events highlighted above the upcoming-event list.
- Reorder visible widgets with a live grid preview using mouse, touch, or keyboard controls, then commit the draft order only after a valid drop.
- Change a widget between only the widths allowed by its shared definition.
- Add or remove optional widgets through the widget library while keeping required widgets visible.
- Review each widget's description in the single-column widget library while keeping the dashboard cards focused on titles and data.
- Restore the current role- and feature-aware default layout without saving it immediately.
- Save or discard a draft containing the selected widget IDs, order, and width.
- Filter obsolete or unavailable saved widgets before presenting the dashboard.

## End-User Value

The dashboard gives administrators a current picture of training execution before missed obligations become a reporting or compliance problem. Completion and risk summaries help L&D teams prioritize intervention, while direct links reduce the time needed to move from a signal to the affected course or learner. Personal layout persistence and role-aware selection keep that operational view focused on each user's responsibilities.

## How It Works

The user opens `/dashboard` and sees the widgets stored in their personal settings. The page title uses the same typography as the administrator Users view for visual consistency across the administration workspace. Selecting **Customize dashboard** creates an editable draft. The user can reorder cards, change supported widths, and open the widget library to show or hide optional widgets. While a card is dragged, a local ordering preview lets CSS Grid reflow the cards at their natural single- or double-column widths; the draft order changes only after a valid drop, while cancellation or dropping outside the grid keeps the previous order. Mouse users get precise pointer-based targeting, touch users get a short activation delay that reduces accidental drags, and keyboard users retain directional sorting. **Restore default** replaces only the draft with the current default returned by the API; **Save** persists it, while **Cancel** returns to the previously saved layout.

A widget is visible when it is present in the saved `dashboard.widgets` array. There is no separate `enabled` property. Each saved item contains a stable widget ID, a non-negative order used for sorting, and a width of `1` (single column) or `2` (double column). Adding a widget uses its configured default width and appends it to the draft; removing or dragging widgets recalculates their order.

Widget rows remain content-driven across screen sizes, while every card stretches to match the tallest card in its row and uses a consistent maximum height that prevents excessive expansion. Longer content scrolls inside its tile while the page retains its natural document flow. Every widget uses the same Mentingo card surface, spacing, header typography, icon treatment, content behavior, and fixed-footer pattern; edit mode adds a non-layout-shifting focus ring around the card.

Widget descriptions appear in the widget library rather than inside the cards, making the dashboard itself more compact while preserving guidance when users choose their layout. On smaller screens, cards have a maximum height and scroll their content when necessary. The calendar reserves enough vertical space for six complete week rows. On large screens, its event panel follows the calendar's height without contributing to it, so longer selected-day and upcoming-event lists scroll independently instead of expanding the tile. The Incomplete courses legend remains fixed in the card footer while its course list scrolls. Training completion presents completed, in-progress, and not-started enrollments as a donut chart, with the completion percentage and completed-to-total ratio visible in the center.

Mentingo determines the effective catalog on the server. It starts with the shared widget definitions, then filters them by the user's roles and any required tenant-level feature flags. The same filtering is applied when loading a saved layout and when producing the default layout. Unknown, obsolete, or currently unavailable IDs are therefore not rendered. When saving, the API rejects unknown, unavailable, or duplicate IDs, verifies widget-specific widths, ensures that every required widget is still present, and normalizes the submitted order into a contiguous sequence.

For administrators, the training widgets count enrollments rather than unique courses or learners. One course assigned to 100 learners therefore contributes 100 enrollments. Training completion uses the shared shadcn chart wrapper over Recharts, including a labeled donut, accessible chart summary, segment tooltip, and color-keyed status breakdown. Each data-backed widget loads independently and receives only its own presentation data, so hiding or failing one widget does not require downloading unrelated dashboard aggregates. Deadline risks include only active, unfinished enrollments made through a mandatory group assignment with a due date. The risk card loads only overdue and due-soon counts; learner and course details are fetched in pages only after the user opens a risk dialog, where a localized action links directly to each course's statistics. Every data-backed widget presents a loading skeleton and a retryable error state.

The calendar reuses Mentingo's role-aware event visibility, so administrators see tenant learning events while other roles retain their narrower course, enrollment, or trainer scope. Dates containing events use a light primary background instead of dot markers. Calendar day controls expose full localized date labels and their selected state to assistive technology. When the selected date has events, the widget places them in a highlighted section above upcoming events; events already shown for the selected date are not repeated in the upcoming list.

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
    requiredFeature?: FeatureKey;
  }
  ```

- The administrator catalog uses semantic persisted IDs: `a_training_completion`, `a_deadline_risks`, `a_incomplete_courses`, and `a_event_calendar`. A data migration maps the three historical administrator placeholder IDs to their semantic equivalents without changing each user's saved order, width, or visibility. Training completion and Incomplete courses are optional, default-visible, administrator-only widgets fixed at single width; Deadline risks is optional and default-hidden. Event calendar is default-visible, always visible, fixed at double width, and available only when the tenant calendar feature is enabled. The learner catalog still contains three placeholder widgets whose existing visibility settings are unchanged.
- Frontend presentation metadata is defined independently in `apps/web/app/modules/Dashboard/Home/widgetMetadata.ts`, while `widgetRegistry.tsx` adds the React component for each ID. Widgets import metadata without importing the component registry, keeping the SSR module graph free of registry-to-widget circular dependencies. These presentation fields are never persisted in user settings.
- `GET /api/settings` supplies the saved layout, `GET /api/settings/dashboard` supplies the effective list of available IDs, `GET /api/settings/dashboard/default` supplies the effective default items, and `PUT /api/settings` saves the layout. The dashboard catalog endpoints and the `/dashboard` route require `dashboard.read`.
- Training completion, deadline-risk summary, incomplete courses, and the dashboard event calendar use separate read endpoints. Each endpoint currently requires the shared `statistics.read` permission and returns only the fields consumed by its widget. `GET /api/statistics/dashboard/deadline-risks` separately supplies paginated course and learner details only after a risk dialog is opened. The lightweight calendar endpoint still reuses Mentingo's role-aware calendar service, but omits event details that the dashboard card does not display.
- The grid uses one column on phones, two on medium screens, and four on large screens. Grid items and cards stretch to the automatically calculated row height, so tiles sharing a row remain equal without assigning a fixed or viewport-derived row size. Cards are capped at 27rem from the small breakpoint and their content areas scroll vertically when needed. Dragging uses a local order preview with sortable transforms disabled, allowing CSS Grid to reflow mixed-width cards without overlap or visual scaling. Motion animates only an inner visual layer's positional change, while the outer dnd-kit hitbox moves immediately to its logical grid cell; this preserves natural widget dimensions, prevents the animation from shifting collision targets, and respects the user's reduced-motion preference. Pointer-first collision detection uses the item geometry captured at drag start and retains the last valid target through gaps, so a reflowed neighbouring card cannot trigger an unintended second move. Every pointer event captures one immutable drop decision and projects it from the layout captured at drag start rather than from the previous preview, preventing movement from accumulating during a longer drag. Duplicate target decisions are ignored, and a center hysteresis zone prevents minor pointer movement from repeatedly switching between the two halves of a wider target. Those halves map to insertion before or after the target, while returning to the dragged card's original area restores its initial position and leaving the grid clears the target. Keyboard movement uses a center-based fallback, the draft layout is reordered only on drop, and the overlay shows lightweight widget metadata instead of mounting a duplicate data-backed widget. The calendar grid has a six-week-row minimum height, and size containment prevents the adjacent large-screen event panel from affecting the tile's intrinsic height. `DashboardWidgetShell` owns drag and resize controls, while each registered widget owns its card content. All visible dashboard strings exist in the six supported web locales.

## Test Evidence

Frontend component tests lock the administrator catalog's semantic IDs, roles, visibility flags, default widths, and allowed widths. They also prove that the dashboard title uses the administrator Users view typography, administrator widget titles render from saved IDs, only saved widgets appear, card descriptions are available in the single-column picker rather than on the cards, the Event calendar required badge sits beside its title in the picker, widget cards stretch to their row height and share application typography, icon sizing, maximum-height scrolling, and edit-ring styling, edit mode exposes widget, cancel, and save actions, fixed-width administrator widgets do not expose resize controls, available widgets can be added, restoring defaults includes the event calendar, and saving sends the `dashboard.widgets` structure with `id`, normalized `order`, and `width`. A dedicated Training completion test verifies the donut radii, segment stroke, central percentage and completed-to-total label, and accessible chart summary. Deadline-risk coverage verifies that the localized course action links to the relevant course statistics. Dedicated grid unit tests prove that both single-to-double and double-to-single reordering retain widget widths, create a contiguous order, and do not mutate the input layout. Dedicated calendar-widget coverage verifies localized date labels and selected-state semantics in addition to event highlighting and list behavior.

Backend schema tests cover known widget IDs and the global width enum. Settings API E2E tests cover saving a valid dashboard layout, order normalization, and rejecting unknown, duplicate, unavailable, missing-required, globally unsupported, and widget-specific disallowed values. Dashboard-statistics service tests prove that completion, risk counts, incomplete courses, and paginated risk details are produced independently; a permission-metadata test locks every widget endpoint to `statistics.read`. Frontend component tests mock each widget query separately, while dedicated calendar coverage uses the reduced dashboard event shape. Browser-level coverage of physical mouse and touch drag gestures, aggregate queries, and risk-dialog pagination is not yet present.
