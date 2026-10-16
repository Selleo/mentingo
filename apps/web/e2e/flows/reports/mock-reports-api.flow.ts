import { REPORTS_IDS, REPORTS_OPTIONS, REPORTS_RESULT } from "../../data/reports/reports.data";

import type { Page } from "@playwright/test";

type ReportsApiRecord = Record<string, unknown>;

export type ReportsApiMock = {
  savedConfigurations: ReportsApiRecord[];
  submittedQueries: ReportsApiRecord[];
  getExportRequest: () => ReportsApiRecord | undefined;
};

/** Serves every reports endpoint from fixed data and records what the page sends. */
export const mockReportsApiFlow = async (page: Page): Promise<ReportsApiMock> => {
  const savedConfigurations: ReportsApiRecord[] = [];
  const submittedQueries: ReportsApiRecord[] = [];
  let exportRequest: ReportsApiRecord | undefined;

  await page.route("**/api/report/options*", (route) =>
    route.fulfill({ json: { data: REPORTS_OPTIONS } }),
  );
  await page.route("**/api/report/configurations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: savedConfigurations } });
      return;
    }

    const body = route.request().postDataJSON() as ReportsApiRecord;
    const saved = {
      id: REPORTS_IDS.config,
      name: body.name,
      visibility: body.visibility,
      query: body.query,
      ownerId: REPORTS_IDS.owner,
      isAvailable: true,
      updatedAt: new Date().toISOString(),
    };
    savedConfigurations.splice(0, savedConfigurations.length, saved);
    await route.fulfill({ json: { data: saved } });
  });
  await page.route("**/api/report/query", async (route) => {
    submittedQueries.push(route.request().postDataJSON() as ReportsApiRecord);
    await route.fulfill({ json: { data: REPORTS_RESULT } });
  });
  await page.route("**/api/report/exports", (route) => {
    exportRequest = route.request().postDataJSON() as ReportsApiRecord;
    return route.fulfill({
      json: {
        data: {
          id: REPORTS_IDS.export,
          format: "xlsx",
          status: "processing",
          expiresAt: null,
          failureCode: null,
        },
      },
    });
  });
  await page.route(`**/api/report/exports/${REPORTS_IDS.export}`, (route) =>
    route.fulfill({
      json: {
        data: {
          id: REPORTS_IDS.export,
          format: "xlsx",
          status: "completed",
          expiresAt: "2026-04-15T12:00:00.000Z",
          failureCode: null,
        },
      },
    }),
  );
  await page.route(`**/api/report/exports/${REPORTS_IDS.export}/download`, (route) =>
    route.fulfill({ body: "mock spreadsheet", contentType: "application/octet-stream" }),
  );

  return { savedConfigurations, submittedQueries, getExportRequest: () => exportRequest };
};
