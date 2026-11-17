import { stat } from "node:fs/promises";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_REPORT_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";

test("admin downloads the summary report as an XLSX file", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openDashboardFlow(page);

    const reportRequest = page.waitForRequest((request) =>
      request.url().includes("/api/report/summary"),
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByTestId(DASHBOARD_REPORT_HANDLES.DOWNLOAD).click();
    const [request, download] = await Promise.all([reportRequest, downloadEvent]);

    expect(new URL(request.url()).searchParams.get("language")).toBe("en");
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const file = await stat(await download.path());
    expect(file.size).toBeGreaterThan(0);
  });
});
