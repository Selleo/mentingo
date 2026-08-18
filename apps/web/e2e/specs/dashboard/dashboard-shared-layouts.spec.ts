import { DASHBOARD_WIDGET_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { mockDashboardLayout } from "../../flows/dashboard/mock-dashboard-layout.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";

import type {
  DashboardLayoutCatalogEntry,
  DashboardLayoutSize,
  DashboardLayoutWidget,
} from "../../flows/dashboard/mock-dashboard-layout.flow";
import type { UserRole } from "~/config/userRoles";

const W = DASHBOARD_WIDGET_TYPES;

const roleDefaults: Record<string, DashboardLayoutWidget[]> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: [
    { type: W.AI_MENTOR_PRACTICE, size: "3x2", visible: true },
    { type: W.EVENT_CALENDAR, size: "4x2", visible: true },
    { type: W.TODO_LIST, size: "3x2", visible: true },
    { type: W.DEADLINE_RISKS, size: "3x2", visible: true },
    { type: W.TRAINING_COMPLETION, size: "2x2", visible: true },
  ],
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: [
    { type: W.AI_MENTOR_PRACTICE, size: "3x2", visible: true },
    { type: W.EVENT_CALENDAR, size: "4x2", visible: true },
    { type: W.TODO_LIST, size: "3x2", visible: true },
    { type: W.DEADLINE_RISKS, size: "3x2", visible: true },
    { type: W.TRAINING_COMPLETION, size: "2x2", visible: true },
  ],
  [SYSTEM_ROLE_SLUGS.TRAINER]: [
    { type: W.AI_MENTOR_PRACTICE, size: "3x2", visible: true },
    { type: W.EVENT_CALENDAR, size: "4x2", visible: true },
    { type: W.TODO_LIST, size: "3x2", visible: true },
  ],
  [SYSTEM_ROLE_SLUGS.STUDENT]: [
    { type: W.AI_MENTOR_PRACTICE, size: "3x2", visible: true },
    { type: W.EVENT_CALENDAR, size: "4x2", visible: true },
    { type: W.TODO_LIST, size: "3x2", visible: true },
    { type: W.CONTINUE_LEARNING, size: "3x2", visible: true },
    { type: W.REQUIRED_COURSES, size: "2x2", visible: true },
    { type: W.COURSE_COMPLETION, size: "2x2", visible: true },
    { type: W.CERTIFICATES, size: "2x2", visible: true },
  ],
};

const catalogSizeByType: Record<string, DashboardLayoutSize[]> = {
  [W.AI_MENTOR_PRACTICE]: ["2x2", "3x2"],
  [W.TODO_LIST]: ["2x1", "2x2", "3x2"],
  [W.EVENT_CALENDAR]: ["4x2", "4x3"],
  [W.DEADLINE_RISKS]: ["2x1", "2x2", "3x2"],
  [W.TRAINING_COMPLETION]: ["1x1", "2x2"],
  [W.CONTINUE_LEARNING]: ["2x1", "2x2", "3x2"],
  [W.REQUIRED_COURSES]: ["2x1", "2x2", "3x2"],
  [W.CERTIFICATES]: ["2x1", "2x2"],
  [W.COURSE_COMPLETION]: ["1x1", "2x2"],
};

const catalogFor = (widgets: DashboardLayoutWidget[]): DashboardLayoutCatalogEntry[] =>
  [...new Map(widgets.map((widget) => [widget.type, widget])).values()].map((widget) => ({
    type: widget.type,
    allowedSizes: catalogSizeByType[widget.type],
    defaultSize: widget.size,
  }));

const reverseLayout = (widgets: DashboardLayoutWidget[]) =>
  [...widgets].reverse().map((widget) => ({ ...widget }));

const titleByType: Record<string, string> = {
  [W.AI_MENTOR_PRACTICE]: "AI Mentor practice",
  [W.TODO_LIST]: "To-do list",
  [W.EVENT_CALENDAR]: "Event calendar",
  [W.DEADLINE_RISKS]: "Deadline risks",
  [W.TRAINING_COMPLETION]: "Training completion",
  [W.CONTINUE_LEARNING]: "Continue learning",
  [W.REQUIRED_COURSES]: "Required courses",
  [W.CERTIFICATES]: "Certificates",
  [W.COURSE_COMPLETION]: "Course progress",
};

const visibleWidgetTitles = async (page: Parameters<typeof mockDashboardLayout>[0]) =>
  page.locator('[data-dashboard-widget-hitbox="true"] h2').allTextContents();

test.describe("role-specific dashboard default layouts", () => {
  for (const [roleSlug, expectedWidgets] of Object.entries(roleDefaults)) {
    if (roleSlug === SYSTEM_ROLE_SLUGS.TRAINER) continue;
    const role = roleSlug as UserRole;
    test(`${roleSlug} restores its default profile and persists it`, async ({ withWorkerPage }) => {
      await withWorkerPage(role, async ({ page }) => {
        const state = await mockDashboardLayout(page, {
          widgets: reverseLayout(expectedWidgets),
          resetWidgets: expectedWidgets,
          catalog: catalogFor(expectedWidgets),
        });

        await page.goto("/dashboard");
        await expect(page.locator('[data-dashboard-widget-hitbox="true"]')).toHaveCount(
          expectedWidgets.length,
        );

        await page.getByRole("button", { name: "Customize dashboard" }).click();
        await page.getByRole("button", { name: "Widgets" }).click();
        await page.getByRole("button", { name: "Restore default" }).click();

        const confirmation = page.getByRole("alertdialog");
        await expect(confirmation).toBeVisible();
        await expect(confirmation).toContainText(
          "Restore the default widget layout? Your current arrangement will be replaced.",
        );
        await confirmation.getByRole("button", { name: "Cancel" }).click();
        await expect(confirmation).toBeHidden();
        expect(state.getResetRequests()).toBe(0);

        await page.getByRole("button", { name: "Restore default" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Yes" }).click();
        await expect.poll(() => state.getResetRequests()).toBe(1);
        expect(state.getWidgets()).toEqual(expectedWidgets);

        await page.getByRole("button", { name: "Close" }).last().click();
        await page.reload();
        await expect(page.locator('[data-dashboard-widget-hitbox="true"]')).toHaveCount(
          expectedWidgets.length,
        );
        await expect
          .poll(() => visibleWidgetTitles(page))
          .toEqual(expectedWidgets.map((widget) => titleByType[widget.type]));
      });
    });
  }
});

test("trainer restores the trainer default profile", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  await workspace.apiClient.api.settingsControllerUpdateLiveTrainingEnabled();
  const trainer = await workspace.createTenantUserWithPasswordAndRole({
    role: SYSTEM_ROLE_SLUGS.TRAINER as UserRole,
  });
  const expectedWidgets = roleDefaults[SYSTEM_ROLE_SLUGS.TRAINER];
  const state = await mockDashboardLayout(trainer.page, {
    widgets: reverseLayout(expectedWidgets),
    resetWidgets: expectedWidgets,
    catalog: catalogFor(expectedWidgets),
  });

  await openDashboardFlow(trainer.page, trainer.origin);
  await trainer.page.getByRole("button", { name: "Customize dashboard" }).click();
  await trainer.page.getByRole("button", { name: "Widgets" }).click();
  await trainer.page.getByRole("button", { name: "Restore default" }).click();
  await trainer.page.getByRole("alertdialog").getByRole("button", { name: "Yes" }).click();

  await expect.poll(() => state.getResetRequests()).toBe(1);
  expect(state.getWidgets()).toEqual(expectedWidgets);
});

test("an unavailable AI environment omits AI Mentor from the catalog and restored layout", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    const expectedWidgets = roleDefaults[SYSTEM_ROLE_SLUGS.STUDENT].filter(
      (widget) => widget.type !== W.AI_MENTOR_PRACTICE,
    );
    const state = await mockDashboardLayout(page, {
      widgets: reverseLayout(expectedWidgets),
      resetWidgets: expectedWidgets,
      catalog: catalogFor(expectedWidgets),
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "AI Mentor practice" })).toHaveCount(0);
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    await page.getByRole("button", { name: "Widgets" }).click();
    await expect(page.getByRole("switch", { name: "Toggle AI Mentor practice" })).toHaveCount(0);

    await page.getByRole("button", { name: "Restore default" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Yes" }).click();
    await expect.poll(() => state.getResetRequests()).toBe(1);
    expect(state.getWidgets().some((widget) => widget.type === W.AI_MENTOR_PRACTICE)).toBe(false);
  });
});

test("a multi-role admin and student restores the management profile", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const managementDefaults = roleDefaults[SYSTEM_ROLE_SLUGS.ADMIN];
    const state = await mockDashboardLayout(page, {
      widgets: reverseLayout(roleDefaults[SYSTEM_ROLE_SLUGS.STUDENT]),
      resetWidgets: managementDefaults,
      catalog: catalogFor([...roleDefaults[SYSTEM_ROLE_SLUGS.STUDENT], ...managementDefaults]),
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    await page.getByRole("button", { name: "Widgets" }).click();
    await page.getByRole("button", { name: "Restore default" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Yes" }).click();

    await expect.poll(() => state.getResetRequests()).toBe(1);
    expect(state.getWidgets()).toEqual(managementDefaults);
    expect(state.getWidgets().some((widget) => widget.type === W.CONTINUE_LEARNING)).toBe(false);
  });
});

test("uses catalog sizes for alignment and does not offer an invalid span", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const widgets: DashboardLayoutWidget[] = [
      { type: W.EVENT_CALENDAR, size: "4x2", visible: true },
      { type: W.TRAINING_COMPLETION, size: "1x1", visible: true },
    ];
    const state = await mockDashboardLayout(page, {
      widgets,
      resetWidgets: widgets,
      catalog: catalogFor(widgets),
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");
    const calendar = page.locator('[data-dashboard-widget-hitbox="true"]').filter({
      has: page.getByRole("heading", { name: "Event calendar" }),
    });
    const completion = page.locator('[data-dashboard-widget-hitbox="true"]').filter({
      has: page.getByRole("heading", { name: "Training completion" }),
    });

    await expect(calendar).toHaveClass(/md:col-span-4/);
    await expect(calendar).toHaveAttribute("style", /grid-row: span 2/);
    await expect(completion).toHaveClass(/col-span-1/);
    await expect(completion).toHaveAttribute("style", /grid-row: span 1/);

    await page.getByRole("button", { name: "Customize dashboard" }).click();
    const sizeButton = page.getByRole("button", { name: "Change size of Event calendar" });
    await sizeButton.click();
    await expect(page.getByRole("radio", { name: "4x2 — Feature" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "4x3 — Tall feature" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "2x2 — Large" })).toHaveCount(0);
    await page.getByRole("radio", { name: "4x3 — Tall feature" }).click();

    await expect.poll(() => state.getWidgets()[0]?.size).toBe("4x3");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(calendar).toHaveClass(/col-span-2/);
    await expect(completion).toHaveClass(/col-span-1/);
  });
});
