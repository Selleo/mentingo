import { expect, test, type Page } from "@playwright/test";
import { matchesRequirement, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { routeAccessConfig } from "../../../app/config/routeAccessConfig";
import { REPORTS_HANDLES } from "../../data/reports/handles";
import { protectedRoutes } from "../../utils/protected-routes";

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

export const canAccessReports = (role: string) =>
  matchesRequirement(SYSTEM_ROLE_PERMISSIONS[role], routeAccessConfig.reports);

// The reviewer has no dashboard, course, calendar or path access, so it lands on the grading queue.
export const deniedRouteRedirect = (role: string) =>
  role === SYSTEM_ROLE_SLUGS.REVIEWER ? /\/quiz-grading$/ : /\/(dashboard|courses)$/;

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

/** Visits every protected route the role lacks permission for and expects a redirect. */
export const assertDeniedRoutesFlow = async (page: Page, role: string) => {
  for (const { path, requirement } of protectedRoutes) {
    if (matchesRequirement(SYSTEM_ROLE_PERMISSIONS[role], requirement)) continue;
    await test.step(path, async () => {
      await page.goto(`${path}?language=en`);
      await expect(page).toHaveURL(deniedRouteRedirect(role));
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    });
  }
};

/** Direct entry and reload of /reports follow the role's permission, in the UI and the API. */
export const assertReportsAccessFlow = async (
  page: Page,
  client: FixtureApiClient,
  role: string,
) => {
  const requests = observeReportRequests(page);
  const allowed = canAccessReports(role);

  for (const open of [() => page.goto("/reports?language=en"), () => page.reload()]) {
    await open();
    if (allowed) {
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeVisible();
      await expect(page).toHaveURL(/\/reports\?language=en$/);
    } else {
      await expect(page).toHaveURL(deniedRouteRedirect(role));
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
