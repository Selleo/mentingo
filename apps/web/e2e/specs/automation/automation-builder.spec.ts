import { USER_ROLE } from "~/config/userRoles";

import {
  AUTOMATION_BUILDER_HANDLES,
  AUTOMATION_DRAWER_HANDLES,
  AUTOMATION_PAGE_HANDLES,
} from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Automation Builder Page", () => {
  test("admin can navigate to builder and see the canvas", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Builder-Canvas-${Date.now()}` },
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);

      // Open drawer
      const row = page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id));
      await row.getByRole("button").click();

      // Navigate to builder
      await page.getByTestId(AUTOMATION_DRAWER_HANDLES.OPEN_BUILDER_BUTTON).click();

      await expect(page).toHaveURL(new RegExp(`/admin/automation/${automation.id}/builder`));
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.CANVAS)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.HEADER)).toBeVisible();
    });
  });

  test("admin can see builder header controls", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Builder-Header-${Date.now()}` },
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE).waitFor({ state: "visible" });

      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.BACK_BUTTON)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.SAVE_BUTTON)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_BUILDER_HANDLES.SIMULATE_BUTTON)).toBeVisible();
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
        name: { en: `Builder-Back-${Date.now()}` },
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

  test("admin can delete automation from builder", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Builder-Delete-${Date.now()}` },
      });

      let wasDeleted = false;
      cleanup.add(async () => {
        if (!wasDeleted) {
          await automationFactory.delete(automation.id);
        }
      });

      await page.goto(`/admin/automation/${automation.id}/builder`);
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.PAGE).waitFor({ state: "visible" });

      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.DELETE_BUTTON).click();

      // Confirm deletion in leave dialog
      await page.getByTestId(AUTOMATION_BUILDER_HANDLES.LEAVE_DIALOG).waitFor({ state: "visible" });
      await page.getByRole("button", { name: /delete|confirm|yes/i }).click();

      await expect(page).toHaveURL(/\/admin\/automation$/);

      await expect
        .poll(async () => {
          const found = await automationFactory.findByName(`Builder-Delete-${Date.now()}`, "en");
          return found;
        })
        .toBeNull();

      wasDeleted = true;
    });
  });
});
