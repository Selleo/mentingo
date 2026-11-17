import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { getRoleRouteAccess } from "../../data/navigation/route-access.data";
import { REPORTS_HANDLES } from "../../data/reports/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { authenticateContext } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillLoginFormFlow } from "../../flows/auth/fill-login-form.flow";
import { submitLoginFormFlow } from "../../flows/auth/submit-login-form.flow";
import {
  assertDeniedRoutesFlow,
  assertReportApiDeniedFlow,
  assertReportsAccessFlow,
  observeReportRequests,
} from "../../flows/navigation/assert-route-access.flow";
import { createFixtureApiClient } from "../../utils/api-client";
import { enableLiveTraining } from "../../utils/live-training-settings";
import { protectedRoutes } from "../../utils/protected-routes";
import { requireOrigin } from "../../utils/tenant-host";

test("anonymous cannot enter any protected route", async ({ cleanup, createWorkspacePage }) => {
  test.slow();
  const { context, origin, page } = await createWorkspacePage();
  cleanup.add(() => context.close());
  const requests = observeReportRequests(page);

  for (const { path } of protectedRoutes) {
    await test.step(path, async () => {
      await page.goto(`${path}?language=en`);
      await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/login$/);
      await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(0);
    });
  }
  expect(requests).toEqual([]);

  const anonymousClient = createFixtureApiClient();
  anonymousClient.syncTenantOrigin(requireOrigin(origin));
  await assertReportApiDeniedFlow(anonymousClient, 401);
});

for (const role of [USER_ROLE.admin, USER_ROLE.student, USER_ROLE.contentCreator] as const) {
  test(`${role} route and reports access follows its role on direct entry and reload`, async ({
    apiClient,
    withWorkerPage,
  }) => {
    test.slow();
    await withWorkerPage(role, async ({ page }) => {
      if (role !== USER_ROLE.admin) await assertDeniedRoutesFlow(page, role);
      await assertReportsAccessFlow(page, apiClient, role);
    });
  });
}

for (const role of [
  SYSTEM_ROLE_SLUGS.TRAINER,
  SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
  SYSTEM_ROLE_SLUGS.REVIEWER,
] as const) {
  test(`${role} route and reports access follows its permissions on direct entry and reload`, async ({
    apiClient,
    cleanup,
    createWorkspacePage,
    factories,
    withWorkerPage,
  }) => {
    test.slow();
    let email = "";

    await withWorkerPage(USER_ROLE.admin, async () => {
      // Assigning the trainer role requires the live-training feature; restore it afterwards.
      if (role === SYSTEM_ROLE_SLUGS.TRAINER) cleanup.add(await enableLiveTraining(apiClient));

      const userFactory = factories.createUserFactory();
      const user = await userFactory.register({ password: TEST_PASSWORD });
      email = user.email;

      cleanup.add(async () => {
        await userFactory.delete(user.id);
      });

      await userFactory.update(user.id, { roleSlugs: [role] });
    });

    const { context, origin, page } = await createWorkspacePage();
    cleanup.add(() => context.close());
    const workspaceOrigin = requireOrigin(origin);
    await authenticateContext(context, workspaceOrigin, email, TEST_PASSWORD);
    const roleClient = createFixtureApiClient();
    await roleClient.syncFromContext(context, workspaceOrigin);
    cleanup.add(() => roleClient.clearCookies());

    await assertDeniedRoutesFlow(page, role);
    await assertReportsAccessFlow(page, roleClient, role);
  });
}

for (const role of [SYSTEM_ROLE_SLUGS.ADMIN, SYSTEM_ROLE_SLUGS.STUDENT] as const) {
  test(`login from reports returns only to an authorized destination for ${role}`, async ({
    cleanup,
    createWorkspacePage,
    factories,
    withWorkerPage,
  }) => {
    let email = "";

    await withWorkerPage(USER_ROLE.admin, async () => {
      const userFactory = factories.createUserFactory();
      const user = await userFactory.register({ password: TEST_PASSWORD });
      email = user.email;

      cleanup.add(async () => {
        await userFactory.delete(user.id);
      });

      await userFactory.update(user.id, { roleSlugs: [role] });
    });

    const { context, page } = await createWorkspacePage();
    cleanup.add(() => context.close());
    const { canAccessReports: allowed, deniedRedirect } = getRoleRouteAccess(role);
    const destination = allowed ? /\/reports\?language=en$/ : deniedRedirect;

    await page.goto("/reports?language=en");
    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
    await fillLoginFormFlow(page, email, TEST_PASSWORD);
    await submitLoginFormFlow(page);

    await expect(page).toHaveURL(destination);
    await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toHaveCount(allowed ? 1 : 0);
    await page.reload();
    await expect(page).toHaveURL(destination);
  });
}
