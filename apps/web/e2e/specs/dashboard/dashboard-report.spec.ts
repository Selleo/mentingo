import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_REPORT_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";

test("admin can download the summary report as an XLSX file", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    let reportRequestUrl = "";

    await page.route("**/api/report/summary*", async (route) => {
      reportRequestUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: {
          "content-disposition": 'attachment; filename="summary-report-2026-08-21.xlsx"',
        },
        body: "fake-xlsx-content",
      });
    });

    await openDashboardFlow(page);

    const downloadButton = page.getByTestId(DASHBOARD_REPORT_HANDLES.DOWNLOAD);
    await expect(downloadButton).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);

    expect(new URL(reportRequestUrl).searchParams.get("language")).toBe("en");
    expect(download.suggestedFilename()).toBe("summary-report-2026-08-21.xlsx");
  });
});
