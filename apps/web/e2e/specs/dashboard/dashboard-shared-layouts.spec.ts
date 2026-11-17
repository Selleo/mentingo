import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { dashboardWidget, defaultDashboardLayout } from "../../data/dashboard/dashboard.data";
import {
  DASHBOARD_CALENDAR_HANDLES,
  DASHBOARD_EDIT_HANDLES,
  DASHBOARD_WIDGET_HANDLES,
} from "../../data/dashboard/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertDashboardWidgetOrderFlow } from "../../flows/dashboard/assert-dashboard-layout.flow";
import {
  closeWidgetPickerFlow,
  openWidgetPickerFlow,
  restoreDashboardDefaultFlow,
} from "../../flows/dashboard/customize-dashboard.flow";
import { mockDashboardFlow } from "../../flows/dashboard/mock-dashboard.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

import type { DashboardWidgetType } from "@repo/shared";
import type { UserRole } from "~/config/userRoles";

const WORKER_ROLES = [USER_ROLE.admin, USER_ROLE.contentCreator, USER_ROLE.student];

// Trainer and group manager have no worker account, so they sign in to an isolated workspace.
const ISOLATED_ROLES = [SYSTEM_ROLE_SLUGS.TRAINER, SYSTEM_ROLE_SLUGS.GROUP_MANAGER];

test.describe("role-specific dashboard default layouts", () => {
  for (const role of WORKER_ROLES) {
    test(`${role} restores its default profile and persists it`, async ({ withWorkerPage }) => {
      await withWorkerPage(role, async ({ page }) => {
        const expectedWidgets = defaultDashboardLayout(role);
        const state = await mockDashboardFlow(page, {
          widgets: [...expectedWidgets].reverse(),
          resetWidgets: expectedWidgets,
        });

        await openDashboardFlow(page);
        await openWidgetPickerFlow(page);

        await page.getByTestId(DASHBOARD_EDIT_HANDLES.RESTORE_DEFAULT).click();
        const confirmation = page.getByTestId(DASHBOARD_EDIT_HANDLES.RESTORE_DEFAULT_DIALOG);
        await expect(confirmation).toBeVisible();
        await page.getByTestId(DASHBOARD_EDIT_HANDLES.RESTORE_DEFAULT_CANCEL).click();
        await expect(confirmation).toBeHidden();
        expect(state.getResetRequests()).toBe(0);

        await restoreDashboardDefaultFlow(page);
        await expect.poll(() => state.getResetRequests()).toBe(1);
        await closeWidgetPickerFlow(page);
        await page.reload();

        await assertDashboardWidgetOrderFlow(
          page,
          expectedWidgets.map((widget) => widget.type),
        );
      });
    });
  }

  for (const role of ISOLATED_ROLES) {
    test(`${role} restores its default profile`, async ({ createIsolatedWorkspace }) => {
      const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
      await workspace.apiClient.api.settingsControllerUpdateLiveTrainingEnabled();
      // shortcut: the fixture types roles as worker roles only; widen UserRole when more roles get worker accounts
      const user = await workspace.createTenantUserWithPasswordAndRole({ role: role as UserRole });
      const expectedWidgets = defaultDashboardLayout(role);
      const state = await mockDashboardFlow(user.page, {
        widgets: [...expectedWidgets].reverse(),
        resetWidgets: expectedWidgets,
      });

      await openDashboardFlow(user.page, user.origin);
      await openWidgetPickerFlow(user.page);
      await restoreDashboardDefaultFlow(user.page);

      await expect.poll(() => state.getResetRequests()).toBe(1);
      await assertDashboardWidgetOrderFlow(
        user.page,
        expectedWidgets.map((widget) => widget.type),
      );
    });
  }
});

test("admin hides a widget, keeps it hidden after reload and restores the default layout", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    cleanup.add(
      await setDashboardWidgets(apiClient, [
        { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
        {
          type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        },
      ]),
    );

    await openDashboardFlow(page);
    await openWidgetPickerFlow(page);
    await page
      .getByTestId(DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION))
      .click();
    await closeWidgetPickerFlow(page);
    await page.reload();

    await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR)).toBeVisible();
    await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION)).toHaveCount(
      0,
    );

    await openWidgetPickerFlow(page);
    await restoreDashboardDefaultFlow(page);
    await closeWidgetPickerFlow(page);
    await page.reload();

    await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS)).toBeVisible();
    await expect(
      page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION),
    ).toBeVisible();
  });
});

test("a student restores a default layout without AI Mentor when AI is unavailable", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const aiConfig = await apiClient.api.envControllerGetAiConfigured();
    test.skip(aiConfig.data.data.enabled, "requires an environment without OpenAI configured");
    cleanup.add(
      await setDashboardWidgets(apiClient, [
        {
          type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
        },
      ]),
    );

    await openDashboardFlow(page);
    await openWidgetPickerFlow(page);
    await expect(
      page.getByTestId(
        DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING),
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId(
        DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE),
      ),
    ).toHaveCount(0);
    await restoreDashboardDefaultFlow(page);
    await closeWidgetPickerFlow(page);

    let savedTypes: DashboardWidgetType[] = [];
    await expect
      .poll(async () => {
        const { layout } = (await apiClient.api.settingsControllerGetDashboardSettings()).data.data;
        savedTypes = layout.widgets.filter((widget) => widget.visible).map((widget) => widget.type);
        return savedTypes.length;
      })
      .toBeGreaterThan(1);
    expect(savedTypes).not.toContain(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE);

    await page.reload();
    await assertDashboardWidgetOrderFlow(page, savedTypes);
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET)).toHaveCount(0);
  });
});

test("a multi-role admin and student restores the management profile", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const managementDefaults = defaultDashboardLayout(SYSTEM_ROLE_SLUGS.ADMIN);
    const studentDefaults = defaultDashboardLayout(SYSTEM_ROLE_SLUGS.STUDENT);
    const state = await mockDashboardFlow(page, {
      widgets: [...studentDefaults].reverse(),
      resetWidgets: managementDefaults,
      catalog: [...new Set([...studentDefaults, ...managementDefaults].map(({ type }) => type))],
    });

    await openDashboardFlow(page);
    await openWidgetPickerFlow(page);
    await restoreDashboardDefaultFlow(page);

    await expect.poll(() => state.getResetRequests()).toBe(1);
    await assertDashboardWidgetOrderFlow(
      page,
      managementDefaults.map((widget) => widget.type),
    );
  });
});

test("uses catalog sizes for alignment and does not offer an invalid span", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const state = await mockDashboardFlow(page, {
      widgets: [
        dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO),
        dashboardWidget(
          DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
          DASHBOARD_WIDGET_SIZES.ONE_BY_ONE,
        ),
      ],
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openDashboardFlow(page);
    const slots = page.getByTestId(DASHBOARD_WIDGET_HANDLES.SLOT);
    const calendar = slots.filter({
      has: page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR),
    });
    const completion = slots.filter({
      has: page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION),
    });

    await expect(calendar).toHaveClass(/md:col-span-4/);
    await expect(calendar).toHaveAttribute("style", /grid-row: span 2/);
    await expect(completion).toHaveClass(/col-span-1/);
    await expect(completion).toHaveAttribute("style", /grid-row: span 1/);

    await page.getByTestId(DASHBOARD_EDIT_HANDLES.CUSTOMIZE).click();
    await page
      .getByTestId(DASHBOARD_EDIT_HANDLES.sizeTrigger(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR))
      .click();
    await expect(page.getByTestId(DASHBOARD_EDIT_HANDLES.sizeOption("4x2"))).toBeVisible();
    await expect(page.getByTestId(DASHBOARD_EDIT_HANDLES.sizeOption("2x2"))).toHaveCount(0);
    await page.getByTestId(DASHBOARD_EDIT_HANDLES.sizeOption("4x3")).click();

    await expect.poll(() => state.getWidgets()[0]?.size).toBe("4x3");
    await expect(calendar).toHaveAttribute("style", /grid-row: span 3/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(calendar).toHaveClass(/col-span-2/);
    await expect(completion).toHaveClass(/col-span-1/);
  });
});

test("clamps persisted wide spans on mobile and restores them at md", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const state = await mockDashboardFlow(page, {
      widgets: [
        dashboardWidget(
          DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
          DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
        ),
        dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO),
      ],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await openDashboardFlow(page);

    const slots = page.getByTestId(DASHBOARD_WIDGET_HANDLES.SLOT);
    const aiSlot = slots.filter({ has: page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET) });
    const calendarSlot = slots.filter({
      has: page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR),
    });

    for (const slot of [aiSlot, calendarSlot]) {
      await expect(slot).toHaveClass(/col-span-2/);
      await expect.poll(async () => (await slot.boundingBox())?.width ?? 0).toBeGreaterThan(340);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(aiSlot).toHaveClass(/md:col-span-3/);
    await expect(calendarSlot).toHaveClass(/md:col-span-4/);
    expect(state.getWidgets().map((widget) => widget.size)).toEqual(["3x2", "4x2"]);
  });
});

test("autosaves resize and reorder without a global save", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const state = await mockDashboardFlow(page, {
      widgets: [
        dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO),
        dashboardWidget(
          DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
          DASHBOARD_WIDGET_SIZES.ONE_BY_ONE,
        ),
      ],
    });

    await openDashboardFlow(page);
    await page.getByTestId(DASHBOARD_EDIT_HANDLES.CUSTOMIZE).click();

    await page
      .getByTestId(DASHBOARD_EDIT_HANDLES.sizeTrigger(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION))
      .click();
    await page.getByTestId(DASHBOARD_EDIT_HANDLES.sizeOption("2x2")).click();
    await expect
      .poll(
        () =>
          state
            .getWidgets()
            .find((widget) => widget.type === DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION)?.size,
      )
      .toBe("2x2");

    const calendarDragHandle = page.getByTestId(
      DASHBOARD_EDIT_HANDLES.dragHandle(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR),
    );
    await calendarDragHandle.focus();
    await calendarDragHandle.press("Space");
    await calendarDragHandle.press("ArrowDown");
    await calendarDragHandle.press("Space");
    await expect
      .poll(() => state.getWidgets()[0]?.type)
      .toBe(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION);

    await page.getByTestId(DASHBOARD_EDIT_HANDLES.OPEN_WIDGET_PICKER).click();
    const calendarToggle = page.getByTestId(
      DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR),
    );
    await expect(calendarToggle).toBeChecked();
    await expect(calendarToggle).toBeDisabled();
    await closeWidgetPickerFlow(page);

    await page.reload();
    await assertDashboardWidgetOrderFlow(page, [
      DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
      DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
    ]);
    await expect(
      page
        .getByTestId(DASHBOARD_WIDGET_HANDLES.SLOT)
        .filter({ has: page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION) }),
    ).toHaveAttribute("style", /grid-row: span 2/);
  });
});

test("removes Calendar from the sidebar while keeping the card CTA route", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await mockDashboardFlow(page, {
      widgets: [
        dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO),
      ],
    });

    await openDashboardFlow(page);
    await expect(page.getByTestId(NAVIGATION_HANDLES.CALENDAR_LINK)).toHaveCount(0);

    const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
    await expect(widget.getByRole("grid")).toBeVisible();
    await widget.getByTestId(DASHBOARD_CALENDAR_HANDLES.OPEN_CALENDAR).click();
    await expect(page).toHaveURL(/\/calendar$/);
  });
});

test("keeps learner widgets opt-in for admins while exposing eligible catalog entries", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await mockDashboardFlow(page, {
      widgets: [
        dashboardWidget(DASHBOARD_WIDGET_TYPES.TODO_LIST, DASHBOARD_WIDGET_SIZES.TWO_BY_TWO),
        dashboardWidget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, DASHBOARD_WIDGET_SIZES.TWO_BY_ONE),
      ],
      catalog: [
        DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
        DASHBOARD_WIDGET_TYPES.CERTIFICATES,
        DASHBOARD_WIDGET_TYPES.TODO_LIST,
      ],
    });

    await openDashboardFlow(page);
    await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING)).toHaveCount(
      0,
    );
    await openWidgetPickerFlow(page);

    await expect(
      page.getByTestId(
        DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING),
      ),
    ).not.toBeChecked();
    await expect(
      page.getByTestId(DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.CERTIFICATES)),
    ).not.toBeChecked();
    await expect(
      page.getByTestId(DASHBOARD_EDIT_HANDLES.widgetToggle(DASHBOARD_WIDGET_TYPES.TODO_LIST)),
    ).toBeChecked();
  });
});
