import { USER_ROLE } from "~/config/userRoles";

import { AUTOMATION_DRAWER_HANDLES, AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createAutomationFlow } from "../../flows/automation/create-automation.flow";
import { filterAutomationsFlow } from "../../flows/automation/filter-automations.flow";
import { openAutomationPageFlow } from "../../flows/automation/open-automation-page.flow";

test.describe("Automation List Page", () => {
  test("admin can view the automation list page", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.PAGE)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.CREATE_BUTTON)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.SEARCH_INPUT)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.STATUS_FILTER)).toBeVisible();
    });
  });

  test("admin can create a new automation", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();

      await openAutomationPageFlow(page);
      await createAutomationFlow(page);

      // Wait for the new automation to appear — mutation creates it and navigates/reloads
      await expect
        .poll(async () => {
          const all = await automationFactory.getAll();
          return all.length;
        })
        .toBeGreaterThan(0);

      const allAutomations = await automationFactory.getAll();
      const newest = allAutomations[allAutomations.length - 1];

      cleanup.add(async () => {
        if (newest) {
          await automationFactory.delete(newest.id);
        }
      });
    });
  });

  test("admin can filter automations by search term", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const uniqueName = `SearchFilter-${Date.now()}`;
      const automation = await automationFactory.create({
        name: { en: uniqueName },
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);
      await filterAutomationsFlow(page, { search: uniqueName });

      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toBeVisible();
    });
  });

  test("admin can open automation drawer by clicking row menu", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Drawer-Test-${Date.now()}` },
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);

      // Click the row's action button (MoreVertical)
      const row = page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id));
      await row.getByRole("button").click();

      // Drawer should open
      await expect(page.getByTestId(AUTOMATION_DRAWER_HANDLES.OPEN_BUILDER_BUTTON)).toBeVisible();
      await expect(page.getByTestId(AUTOMATION_DRAWER_HANDLES.DELETE_BUTTON)).toBeVisible();
    });
  });

  test("admin can delete an automation", async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Delete-Test-${Date.now()}` },
      });

      // Cleanup only if delete fails
      let wasDeleted = false;
      cleanup.add(async () => {
        if (!wasDeleted) {
          await automationFactory.delete(automation.id);
        }
      });

      await openAutomationPageFlow(page);

      // Open drawer for the automation
      const row = page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id));
      await row.getByRole("button").click();

      // Click delete in drawer
      await page.getByTestId(AUTOMATION_DRAWER_HANDLES.DELETE_BUTTON).click();

      // Confirm deletion
      await page.getByTestId(AUTOMATION_PAGE_HANDLES.DELETE_DIALOG_CONFIRM).click();

      // Verify automation is removed from the list
      await expect(page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id))).toBeHidden();

      // Verify backend deletion
      await expect
        .poll(async () => {
          const found = await automationFactory.findByName(automation.name.en!, "en");
          return found;
        })
        .toBeNull();

      wasDeleted = true;
    });
  });

  test("admin can navigate to automation builder from drawer", async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const automationFactory = factories.createAutomationFactory();
      const automation = await automationFactory.create({
        name: { en: `Builder-Nav-${Date.now()}` },
      });

      cleanup.add(async () => {
        await automationFactory.delete(automation.id);
      });

      await openAutomationPageFlow(page);

      // Open drawer
      const row = page.getByTestId(AUTOMATION_PAGE_HANDLES.row(automation.id));
      await row.getByRole("button").click();

      // Click "Open Builder"
      await page.getByTestId(AUTOMATION_DRAWER_HANDLES.OPEN_BUILDER_BUTTON).click();

      await expect(page).toHaveURL(new RegExp(`/admin/automation/${automation.id}/builder`));
    });
  });

  test("admin can navigate to logs page", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await openAutomationPageFlow(page);

      await page.getByTestId(AUTOMATION_PAGE_HANDLES.OPEN_LOGS_BUTTON).click();

      await expect(page).toHaveURL(/\/admin\/automation\/logs$/);
    });
  });
});
