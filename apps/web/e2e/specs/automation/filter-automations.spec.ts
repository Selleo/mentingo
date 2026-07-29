import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterAutomationsFlow } from "../../flows/automation/filter-automations.flow";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Filter Automations", () => {
  test("admin can filter automations by search term", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const uniqueName = `E2E Search ${Date.now()}`;
      const automation = await automationFactory.create({
        name: { en: uniqueName },
        description: { en: "Searchable automation" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await filterAutomationsFlow(page, { search: uniqueName });

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toBeVisible();
    });
  });

  test("search with no results shows empty or filtered state", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);
      await filterAutomationsFlow(page, { search: `nonexistent_${Date.now()}` });

      const rows = page.getByTestId(AUTOMATION_PAGE_HANDLES.TABLE).locator("tbody tr");
      const emptyState = page.getByTestId(AUTOMATION_PAGE_HANDLES.EMPTY_STATE);

      const hasEmptyState = (await emptyState.count()) > 0;
      const hasNoRows = (await rows.count()) === 0;

      expect(hasEmptyState || hasNoRows).toBe(true);
    });
  });

  test("admin can filter automations by status", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `E2E Status Filter ${Date.now()}` },
        description: { en: "Draft automation for filter test" },
        status: "draft",
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await filterAutomationsFlow(page, { status: "draft" });

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toBeVisible();
    });
  });
});
