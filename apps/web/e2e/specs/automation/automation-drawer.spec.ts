import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_DRAWER_HANDLES, AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Automation Drawer", () => {
  test("admin can open automation drawer by clicking a row", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Drawer ${Date.now()}` },
        description: { en: "Drawer test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();

      await expect(page.getByTestId(AUTOMATION_DRAWER_HANDLES.ROOT)).toBeVisible();
    });
  });

  test("drawer shows open builder button", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Builder Btn ${Date.now()}` },
        description: { en: "Builder button test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();

      await expect(page.getByTestId(AUTOMATION_DRAWER_HANDLES.OPEN_BUILDER_BUTTON)).toBeVisible();
    });
  });

  test("drawer shows delete button", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Delete Btn ${Date.now()}` },
        description: { en: "Delete button test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();

      await expect(page.getByTestId(AUTOMATION_DRAWER_HANDLES.DELETE_BUTTON)).toBeVisible();
    });
  });

  test("admin can navigate to builder from drawer", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Nav Builder ${Date.now()}` },
        description: { en: "Navigate to builder" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();
      await page.getByTestId(AUTOMATION_DRAWER_HANDLES.OPEN_BUILDER_BUTTON).click();

      await expect(page).toHaveURL(new RegExp(`/admin/automation/${automation.id}/builder$`));
    });
  });
});
