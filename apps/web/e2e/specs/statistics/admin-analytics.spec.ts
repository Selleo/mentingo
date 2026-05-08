import { USER_ROLE } from "~/config/userRoles";

import { ADMIN_STATISTICS_HANDLES } from "../../data/statistics/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAdminStatisticsFlow } from "../../flows/statistics/open-admin-statistics.flow";

test("admin can view analytics dashboard charts", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openAdminStatisticsFlow(page);

    await expect(
      page.getByTestId(ADMIN_STATISTICS_HANDLES.MOST_POPULAR_COURSES_CHART),
    ).toBeVisible();
    await expect(page.getByTestId(ADMIN_STATISTICS_HANDLES.COURSE_COMPLETION_CHART)).toBeVisible();
    await expect(
      page.getByTestId(ADMIN_STATISTICS_HANDLES.FREEMIUM_CONVERSION_CHART),
    ).toBeVisible();
    await expect(page.getByTestId(ADMIN_STATISTICS_HANDLES.ENROLLMENT_CHART)).toBeVisible();
    await expect(page.getByTestId(ADMIN_STATISTICS_HANDLES.AVERAGE_QUIZ_SCORE_CHART)).toBeVisible();
  });
});

test("admin can download analytics summary report", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openAdminStatisticsFlow(page);

    await page.route("**/api/report/summary?**", async (route) => {
      await route.fulfill({
        body: "summary",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    });

    const reportResponse = page.waitForResponse((response) =>
      response.url().includes("/api/report/summary"),
    );

    await page.getByTestId(ADMIN_STATISTICS_HANDLES.DOWNLOAD_REPORT_BUTTON).click();

    await expect((await reportResponse).ok()).toBe(true);
    await expect(page.getByTestId(ADMIN_STATISTICS_HANDLES.DOWNLOAD_REPORT_BUTTON)).toBeEnabled();
  });
});
