import { USER_ROLE } from "~/config/userRoles";

import { ACTIVITY_LOGS_HANDLES } from "../../data/activity-logs/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openActivityLogsPageFlow } from "../../flows/activity-logs/open-activity-logs-page.flow";

test("admin can filter activity logs by resource type and action type", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const activityLogFactory = factories.createActivityLogFactory();

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const categoryFactory = factories.createCategoryFactory();
      const category = await categoryFactory.create(`activity-log-filters-${Date.now()}`);

      cleanup.add(async () => {
        await categoryFactory.delete(category.id);
      });

      const findCreateLogEntry = async () => {
        const [entry] = await activityLogFactory.findByResourceId(category.id, {
          actionTypes: ["create"],
        });
        return entry ?? null;
      };

      await expect.poll(findCreateLogEntry, { timeout: 15_000 }).not.toBeNull();
      const logEntry = await findCreateLogEntry();
      if (!logEntry) throw new Error(`Activity log for category ${category.id} was not created`);

      const row = page.getByTestId(ACTIVITY_LOGS_HANDLES.row(logEntry.id));

      await openActivityLogsPageFlow(page);
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.SEARCH_INPUT).fill(category.id);
      await expect(row).toBeVisible();

      await page.getByTestId(ACTIVITY_LOGS_HANDLES.RESOURCE_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.resourceFilterOption("category")).click();
      await expect(row).toBeVisible();

      await page.getByTestId(ACTIVITY_LOGS_HANDLES.RESOURCE_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.resourceFilterOption("user")).click();
      await expect(row).toHaveCount(0);

      await page.getByTestId(ACTIVITY_LOGS_HANDLES.RESOURCE_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.resourceFilterOption("all")).click();
      await expect(row).toBeVisible();

      // The action filter is a multi-select popover that stays open across
      // selections, so each "session" below opens it once and closes it with
      // Escape before asserting on the table underneath.
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.ACTION_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.actionFilterOption("create")).click();
      await page.keyboard.press("Escape");
      await expect(row).toBeVisible();

      await page.getByTestId(ACTIVITY_LOGS_HANDLES.ACTION_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.actionFilterOption("create")).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.actionFilterOption("delete")).click();
      await page.keyboard.press("Escape");
      await expect(row).toHaveCount(0);

      await page.getByTestId(ACTIVITY_LOGS_HANDLES.ACTION_FILTER).click();
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.actionFilterOption("all")).click();
      await page.keyboard.press("Escape");
      await expect(row).toBeVisible();
    },
    { root: true },
  );
});
