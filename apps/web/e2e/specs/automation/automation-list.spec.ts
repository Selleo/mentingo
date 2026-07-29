import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Automation List Page", () => {
  test("admin can open the automation list page", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await expect(page).toHaveURL(/\/admin\/automation$/);
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.PAGE)).toBeVisible();
    });
  });

  test("automation page shows the table", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.TABLE)).toBeVisible();
    });
  });

  test("automation page shows the create button", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.CREATE_BUTTON)).toBeVisible();
    });
  });

  test("automation page shows search input and status filter", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.SEARCH_INPUT)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.STATUS_FILTER)).toBeVisible();
    });
  });
});
