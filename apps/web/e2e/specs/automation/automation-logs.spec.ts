import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_LOGS_HANDLES, AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Automation Logs Page", () => {
  test("admin can navigate to logs page from automation list", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await page.getByTestId(AUTOMATION_PAGE_HANDLES.OPEN_LOGS_BUTTON).click();

      await expect(page).toHaveURL(/\/admin\/automation\/logs$/);
      await expect(page.getByTestId(AUTOMATION_LOGS_HANDLES.PAGE)).toBeVisible();
    });
  });

  test("admin can see the logs table", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await page.goto("/admin/automation/logs");
      await page.getByTestId(AUTOMATION_LOGS_HANDLES.PAGE).waitFor({ state: "visible" });

      await expect(page.getByTestId(AUTOMATION_LOGS_HANDLES.TABLE)).toBeVisible();
    });
  });

  test("logs page is accessible directly via URL", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await page.goto("/admin/automation/logs");

      await expect(page.getByTestId(AUTOMATION_LOGS_HANDLES.PAGE)).toBeVisible();
    });
  });
});
