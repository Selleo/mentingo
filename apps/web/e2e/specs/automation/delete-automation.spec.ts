import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { deleteAutomationFromDrawerFlow } from "../../flows/automation/delete-automation.flow";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Delete Automation", () => {
  test("admin can delete an automation from the drawer", async ({ factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Delete ${Date.now()}` },
        description: { en: "Will be deleted" },
        status: "draft",
      });

      await openAutomationPageFlow(page);

      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();

      await deleteAutomationFromDrawerFlow(page);

      await expect
        .poll(async () => {
          const found = await automationFactory.findByName(automation.name.en);
          return found;
        })
        .toBeNull();

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toHaveCount(0);
    });
  });

  test("admin can cancel automation deletion", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Cancel Delete ${Date.now()}` },
        description: { en: "Should not be deleted" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);

      await page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id)).click();

      await page.getByTestId("automation-drawer-delete-button").click();

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.DELETE_DIALOG)).toBeVisible();

      await page.getByTestId(AUTOMATION_PAGE_HANDLES.DELETE_DIALOG_CANCEL).click();

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.DELETE_DIALOG)).toHaveCount(0);

      await expect
        .poll(async () => {
          const found = await automationFactory.getById(automation.id);
          return found?.id;
        })
        .toBe(automation.id);
    });
  });
});
