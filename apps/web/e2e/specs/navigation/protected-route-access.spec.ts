import { expect } from "@playwright/test";
import { matchesRequirement, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { routeAccessConfig } from "../../../app/config/routeAccessConfig";
import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { REPORTS_HANDLES } from "../../data/reports/handles";
import { UserFactory } from "../../factories/user.factory";
import { authenticateContext } from "../../fixtures/auth.actions";
import { pageFixture } from "../../fixtures/page.fixture";
import { createFixtureApiClient } from "../../utils/api-client";
import { protectedRoutes } from "../../utils/protected-routes";

import type { PageHandle } from "../../fixtures/types";
import type { FixtureApiClient } from "../../utils/api-client";
import type { Page } from "@playwright/test";

const SEEDED_PASSWORD = "password";
const REGISTERED_USER_PASSWORD = "Password123@";

const SEEDED_ROLE_EMAILS = {
  [SYSTEM_ROLE_SLUGS.STUDENT]: "user@example.com",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "contentcreator@example.com",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "admin@example.com",
  [SYSTEM_ROLE_SLUGS.TRAINER]: "trainer@example.com",
} as const;

type SeededRole = keyof typeof SEEDED_ROLE_EMAILS;

// Authenticate seeded identities in fresh contexts instead of overwriting shared
// auth-state files or provisioning a tenant just to check read-only access.
const test = pageFixture.extend<{
  withSeededRolePage: (
    role: SeededRole,
    run: (handle: PageHandle) => Promise<void>,
  ) => Promise<void>;
}>({
  withSeededRolePage: async ({ browser, baseURL }, use) => {
    await use(async (role, run) => {
      const context = await browser.newContext();
      try {
        await authenticateContext(context, baseURL!, SEEDED_ROLE_EMAILS[role], SEEDED_PASSWORD);
        const page = await context.newPage();
        await run({ context, page });
      } finally {
        await context.close();
      }
    });
  },
});

const reportQuery = {
  view: "organisation" as const,
  language: "en" as const,
  timezone: "UTC",
  groupIds: [],
  page: 1,
  pageSize: 10,
};

const observeReports = (page: Page) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/report/")) requests.push(request.url());
  });
  return requests;
};

const expectReportApiDenied = async (client: FixtureApiClient, status: number) => {
  for (const request of [
    () => client.api.reportControllerGetReportOptions({ language: "en" }),
    () => client.api.reportControllerListReportConfigurations(),
    () => client.api.reportControllerRunReport(reportQuery),
  ]) {
    await expect(request()).rejects.toMatchObject({ response: { status } });
  }
};

const expectReportApiAllowed = async (client: FixtureApiClient) => {
  expect((await client.api.reportControllerGetReportOptions({ language: "en" })).status).toBe(200);
  expect((await client.api.reportControllerListReportConfigurations()).status).toBe(200);
  expect((await client.api.reportControllerRunReport(reportQuery)).status).toBe(201);
};

const expectDeniedRoutes = async (page: Page, role: string) => {
  for (const { path, requirement } of protectedRoutes) {
    if (matchesRequirement(SYSTEM_ROLE_PERMISSIONS[role], requirement)) continue;
    await test.step(path, async () => {
      await page.goto(`${path}?language=en`);
      await expect(page).toHaveURL(/\/(dashboard|courses)$/);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    });
  }
};

const expectReportsAccessFollowsPermissions = async (
  page: Page,
  client: FixtureApiClient,
  role: string,
) => {
  await expectDeniedRoutes(page, role);
  const requests = observeReports(page);
  const allowed = matchesRequirement(SYSTEM_ROLE_PERMISSIONS[role], routeAccessConfig.reports);

  for (const open of [() => page.goto("/reports?language=en"), () => page.reload()]) {
    await open();
    if (allowed) {
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeVisible();
      await expect(page).toHaveURL(/\/reports\?language=en$/);
    } else {
      await expect(page).toHaveURL(/\/(dashboard|courses)$/);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    }
  }

  if (allowed) {
    await expectReportApiAllowed(client);
  } else {
    expect(requests).toEqual([]);
    await expectReportApiDenied(client, 403);
  }
};

test("anonymous cannot enter any protected route", async ({ page }) => {
  test.slow();
  const requests = observeReports(page);
  for (const { path } of protectedRoutes) {
    await test.step(path, async () => {
      await page.goto(`${path}?language=en`);
      await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/login$/);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    });
  }
  expect(requests).toEqual([]);
});

test("anonymous report APIs return 401", async ({ baseURL }) => {
  const client = createFixtureApiClient();
  client.syncTenantOrigin(baseURL!);
  await expectReportApiDenied(client, 401);
});

for (const role of [SYSTEM_ROLE_SLUGS.STUDENT, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] as const) {
  test(`${role} cannot directly enter routes without permission`, async ({
    withSeededRolePage,
    baseURL,
  }) => {
    test.slow();
    await withSeededRolePage(role, async ({ page, context }) => {
      const apiClient = createFixtureApiClient();
      await apiClient.syncFromContext(context, baseURL!);
      const requests = observeReports(page);
      await expectDeniedRoutes(page, role);
      if (!matchesRequirement(SYSTEM_ROLE_PERMISSIONS[role], routeAccessConfig.reports)) {
        await page.goto("/REPORTS/?language=en");
        await expect(page).toHaveURL(/\/(dashboard|courses)$/);
        await page.reload();
        await expect(page).toHaveURL(/\/(dashboard|courses)$/);
        await expectReportApiDenied(apiClient, 403);
      }
      expect(requests).toEqual([]);
    });
  });
}

for (const role of [SYSTEM_ROLE_SLUGS.ADMIN, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] as const) {
  test(`${role} can open and reload reports and its APIs`, async ({
    withSeededRolePage,
    baseURL,
  }) => {
    await withSeededRolePage(role, async ({ page, context }) => {
      const apiClient = createFixtureApiClient();
      await apiClient.syncFromContext(context, baseURL!);
      for (const open of [() => page.goto("/reports?language=en"), () => page.reload()]) {
        await open();
        await expect(page).toHaveURL(/\/reports\?language=en$/);
        await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeVisible();
      }
      await expectReportApiAllowed(apiClient);
    });
  });
}

for (const [email, destination] of [
  [SEEDED_ROLE_EMAILS[SYSTEM_ROLE_SLUGS.ADMIN], /\/reports\?language=en$/],
  [SEEDED_ROLE_EMAILS[SYSTEM_ROLE_SLUGS.STUDENT], /\/(dashboard|courses)$/],
] as const) {
  test(`login from reports returns only to an authorized destination for ${email}`, async ({
    page,
  }) => {
    await page.goto("/reports?language=en");
    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
    await page.getByTestId(LOGIN_PAGE_HANDLES.EMAIL).fill(email);
    await page.getByTestId(LOGIN_PAGE_HANDLES.PASSWORD).fill(SEEDED_PASSWORD);
    await page.getByTestId(LOGIN_PAGE_HANDLES.LOGIN).click();
    await expect(page).toHaveURL(destination);
    if (email === SEEDED_ROLE_EMAILS[SYSTEM_ROLE_SLUGS.ADMIN]) {
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeVisible();
    } else {
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    }
    await page.reload();
    await expect(page).toHaveURL(destination);
  });
}

test(`${SYSTEM_ROLE_SLUGS.TRAINER} reports access follows its permissions on direct entry and reload`, async ({
  withSeededRolePage,
  baseURL,
}) => {
  test.slow();
  await withSeededRolePage(SYSTEM_ROLE_SLUGS.TRAINER, async ({ page, context }) => {
    const client = createFixtureApiClient();
    await client.syncFromContext(context, baseURL!);
    await expectReportsAccessFollowsPermissions(page, client, SYSTEM_ROLE_SLUGS.TRAINER);
  });
});

test(`${SYSTEM_ROLE_SLUGS.GROUP_MANAGER} reports access follows its permissions on direct entry and reload`, async ({
  browser,
  baseURL,
}) => {
  test.slow();
  const adminContext = await browser.newContext();
  const context = await browser.newContext();
  const adminClient = createFixtureApiClient();
  const factory = new UserFactory(adminClient);
  let userId: string | undefined;
  try {
    await authenticateContext(
      adminContext,
      baseURL!,
      SEEDED_ROLE_EMAILS[SYSTEM_ROLE_SLUGS.ADMIN],
      SEEDED_PASSWORD,
    );
    await adminClient.syncFromContext(adminContext, baseURL!);
    const user = await factory.register({ password: REGISTERED_USER_PASSWORD });
    userId = user.id;
    await factory.update(user.id, { roleSlugs: [SYSTEM_ROLE_SLUGS.GROUP_MANAGER] });

    await authenticateContext(context, baseURL!, user.email, REGISTERED_USER_PASSWORD);
    const client = createFixtureApiClient();
    await client.syncFromContext(context, baseURL!);
    const page = await context.newPage();
    await expectReportsAccessFollowsPermissions(page, client, SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
  } finally {
    if (userId) await factory.delete(userId);
    await context.close();
    await adminContext.close();
  }
});
