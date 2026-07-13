import { USER_ROLE } from "~/config/userRoles";

import { ACTIVITY_LOGS_HANDLES } from "../../data/activity-logs/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openActivityLogsPageFlow } from "../../flows/activity-logs/open-activity-logs-page.flow";

test("admin sees a newly created category in the activity log timeline", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const activityLogFactory = factories.createActivityLogFactory();

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const categoryFactory = factories.createCategoryFactory();
      const category = await categoryFactory.create(`activity-log-list-${Date.now()}`);

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

      await openActivityLogsPageFlow(page);
      await page.getByTestId(ACTIVITY_LOGS_HANDLES.SEARCH_INPUT).fill(category.id);

      await expect(page.getByTestId(ACTIVITY_LOGS_HANDLES.row(logEntry.id))).toBeVisible();
    },
    { root: true },
  );
});
