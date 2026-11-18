import { expect, test, type Page } from "@playwright/test";

import { getRoleRouteAccess } from "../../data/navigation/route-access.data";
import { REPORTS_HANDLES } from "../../data/reports/handles";
import { protectedRoutes, toRoutePattern } from "../../utils/protected-routes";

import type { FixtureApiClient } from "../../utils/api-client";

const REPORT_QUERY = {
  view: "organisation" as const,
  language: "en" as const,
  timezone: "UTC",
  groupIds: [],
  page: 1,
  pageSize: 10,
};

/** Collects report API requests the page sends; a denied role must not send any. */
export const observeReportRequests = (page: Page) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/report/")) requests.push(request.url());
  });
  return requests;
};

export const assertReportApiDeniedFlow = async (client: FixtureApiClient, status: number) => {
  for (const request of [
    () => client.api.reportControllerGetReportOptions({ language: "en" }),
    () => client.api.reportControllerListReportConfigurations(),
    () => client.api.reportControllerRunReport(REPORT_QUERY),
  ]) {
    await expect(request()).rejects.toMatchObject({ response: { status } });
  }
};

export const assertReportApiAllowedFlow = async (client: FixtureApiClient) => {
  expect((await client.api.reportControllerGetReportOptions({ language: "en" })).status).toBe(200);
  expect((await client.api.reportControllerListReportConfigurations()).status).toBe(200);
  expect((await client.api.reportControllerRunReport(REPORT_QUERY)).status).toBe(201);
};

/** Visits every protected route outside the role's hard-coded allow-list and expects a redirect. */
export const assertDeniedRoutesFlow = async (page: Page, role: string) => {
  const { allowedRoutes, deniedRedirect } = getRoleRouteAccess(role);
  if (!allowedRoutes) throw new Error(`Role "${role}" has no allowed-route expectations`);

  for (const { path } of protectedRoutes) {
    if (allowedRoutes.includes(toRoutePattern(path))) continue;
    await test.step(path, async () => {
      await page.goto(`${path}?language=en`);
      await expect(page).toHaveURL(deniedRedirect);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    });
  }
};

/**
 * /reports follows the role's permission, in the UI and the API. Allowed roles also keep access
 * after a reload; denied roles also try a differently cased path with a trailing slash.
 */
export const assertReportsAccessFlow = async (
  page: Page,
  client: FixtureApiClient,
  role: string,
) => {
  const requests = observeReportRequests(page);
  const { canAccessReports: allowed, deniedRedirect } = getRoleRouteAccess(role);

  if (allowed) {
    for (const open of [() => page.goto("/reports?language=en"), () => page.reload()]) {
      await open();
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeVisible();
      await expect(page).toHaveURL(/\/reports\?language=en$/);
    }
  } else {
    for (const entry of ["/reports?language=en", "/REPORTS/?language=en"]) {
      await page.goto(entry);
      await expect(page).toHaveURL(deniedRedirect);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    }
  }

  if (allowed) {
    await assertReportApiAllowedFlow(client);
  } else {
    expect(requests).toEqual([]);
    await assertReportApiDeniedFlow(client, 403);
  }
};
