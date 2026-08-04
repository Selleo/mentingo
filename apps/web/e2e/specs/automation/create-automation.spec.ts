import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createAutomationFlow } from "../../flows/automation/create-automation.flow";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Create Automation", () => {
  test("admin can create a new automation", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();

      await openAutomationPageFlow(page);
      await createAutomationFlow(page);

      await expect
        .poll(async () => {
          const automations = await automationFactory.getAll();
          return automations.length;
        })
        .toBeGreaterThan(0);

      const automations = await automationFactory.getAll();
      const createdAutomation = automations[automations.length - 1];

      cleanup.add(async () => {
        if (createdAutomation) {
          await automationFactory.delete(createdAutomation.id);
        }
      });

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.TABLE)).toBeVisible();
    });
  });

  test("newly created automation appears in the list", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E List Verify ${Date.now()}` },
        description: { en: "Should appear in list" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toBeVisible();
    });
  });
});
