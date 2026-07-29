import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_BUILDER_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";

test.describe("Automation Builder Page", () => {
  test("admin can access builder page for an automation", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Builder ${Date.now()}` },
        description: { en: "Builder page test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);

      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE)).toBeVisible();
    });
  });

  test("builder page shows header and sidebar", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Builder Layout ${Date.now()}` },
        description: { en: "Builder layout test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE).waitFor({ state: "visible" });

      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.HEADER)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.SIDEBAR)).toBeVisible();
    });
  });

  test("builder page shows canvas", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Builder Canvas ${Date.now()}` },
        description: { en: "Canvas visibility test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE).waitFor({ state: "visible" });

      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.CANVAS)).toBeVisible();
    });
  });

  test("admin can navigate back from builder to automation list", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Builder Back ${Date.now()}` },
        description: { en: "Back navigation test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE).waitFor({ state: "visible" });

      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.BACK_BUTTON).click();

      await expect(page).toHaveURL(/\/admin\/automation$/);
    });
  });
});
