# Personal Dashboard Business Spec

## Business Overview

The personal dashboard gives users a configurable starting point for the learning information and actions relevant to their role. Its tile layout reduces navigation effort and lets each user decide which optional widgets are visible, how they are ordered, and how much horizontal space they occupy.

The current implementation provides the dashboard framework and per-user layout persistence. Users can enter edit mode, reorder widgets, switch between supported widths, manage visibility in a widget library, restore the role-aware default layout, and save or discard a draft. The six current widget bodies are placeholders: three are assigned to administrators and three to learners, ready to be replaced with production data and interactions.

## Who Uses It

- Administrators with dashboard access arrange the three admin widgets around the operational information they will need most often.
- Learners with dashboard access arrange the three learner widgets around their day-to-day learning workflow.
- Users with another system role can access the route when they have `dashboard.read`, but the current shared catalog does not define dedicated content-creator or trainer widgets. A user with multiple roles receives the widgets allowed for any of those roles.

## Feature Functions

- Present role-relevant widgets in a responsive personal layout.
- Reorder visible widgets by dragging a card with pointer, touch, or keyboard controls.
- Change a widget between only the widths allowed by its shared definition.
- Add or remove optional widgets through the widget library while keeping required widgets visible.
- Restore the current role- and feature-aware default layout without saving it immediately.
- Save or discard a draft containing the selected widget IDs, order, and width.
- Filter obsolete or unavailable saved widgets before presenting the dashboard.

## End-User Value

The dashboard gives administrators and learners a predictable home screen that can be adapted to their priorities. Personal layout persistence reduces repeated setup, while role-aware widget selection prevents irrelevant tiles from cluttering the page. Responsive sizing and keyboard-enabled reordering keep the same workflow usable across devices and input methods.

## How It Works

The user opens `/dashboard` and sees the widgets stored in their personal settings. Selecting **Customize dashboard** creates an editable draft. The user can reorder cards, change supported widths, and open the widget library to show or hide optional widgets. **Restore default** replaces only the draft with the current default returned by the API; **Save** persists it, while **Cancel** returns to the previously saved layout.

A widget is visible when it is present in the saved `dashboard.widgets` array. There is no separate `enabled` property. Each saved item contains a stable widget ID, a non-negative order used for sorting, and a width of `1` (single column) or `2` (double column). Adding a widget uses its configured default width and appends it to the draft; removing or dragging widgets recalculates their order.

Mentingo determines the effective catalog on the server. It starts with the shared widget definitions, then filters them by the user's roles and any required tenant-level feature flags. The same filtering is applied when loading a saved layout and when producing the default layout. Unknown, obsolete, or currently unavailable IDs are therefore not rendered. Submitted settings are structurally validated, and the API additionally verifies that the chosen width is allowed for the specific widget.

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

- The current catalog contains `a_placeholder_1..3` for administrators and `s_placeholder_1..3` for learners. In each role group, widget 1 is required and double-width, widget 2 is optional and supports both widths, and widget 3 is optional and single-width. All six are default-visible; the API filters the combined default by the current user's roles.
- Frontend presentation is a separate exhaustive registry in `apps/web/app/modules/Dashboard/Home/widgetRegistry.tsx`. Each ID maps to a React component, translated title and description keys, an icon, and optional icon styles; these fields are never persisted in user settings.
- `GET /api/settings` supplies the saved layout, `GET /api/settings/dashboard` supplies the effective list of available IDs, `GET /api/settings/dashboard/default` supplies the effective default items, and `PUT /api/settings` saves the layout. The dashboard catalog endpoints and the `/dashboard` route require `dashboard.read`.
- The grid uses one column on phones, two on medium screens, and four on large screens. `DashboardWidgetShell` owns drag and resize controls, while each registered widget owns its card content. All visible dashboard strings exist in the six supported web locales.

## Test Evidence

Frontend component tests prove that only saved widgets render, edit mode exposes widget, cancel, and save actions, allowed widths can be changed, available widgets can be added, restoring defaults calls the dedicated API, and saving sends the `dashboard.widgets` structure with `id`, `order`, and `width`.

Backend schema tests cover known widget IDs and the global width enum. Settings API E2E tests cover saving a valid dashboard layout and rejecting unknown IDs, unsupported width values, and widget-specific disallowed widths. Dedicated browser E2E coverage for drag-and-drop, role/feature filtering, required-widget enforcement, and real widget data is not currently present.
