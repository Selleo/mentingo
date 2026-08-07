import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { SUPPORT_MODE_HANDLES } from "../../data/support-mode/handles";
import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { enterSupportModeFromListFlow } from "../../flows/tenants/enter-support-mode-from-list.flow";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openTenantsPageFlow } from "../../flows/tenants/open-tenants-page.flow";
import { createFixtureApiClient } from "../../utils/api-client";
import { buildLmsLocalhostTenantHost } from "../../utils/tenant-host";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const requireOrigin = (origin?: string) => {
  if (!origin) {
    throw new Error("Expected authenticated page fixture to provide an origin");
  }

  return origin;
};

test("managing admin can enter support mode and see the support banner", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ origin, page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenantSlug = Date.now();
      const tenantName = `support-mode-${tenantSlug}`;
      const tenant = await tenantFactory.create({
        name: tenantName,
        host: buildLmsLocalhostTenantHost(requireOrigin(origin), tenantName),
      });

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);

      const supportOrigin = new URL(tenant.host).origin;

      await enterSupportModeFromListFlow(page, tenant.id);

      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(supportOrigin)}/dashboard$`));
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.MESSAGE)).toBeVisible();
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.TIME_LEFT)).toBeVisible();
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.EXIT_BUTTON)).toBeVisible();

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await expect(page.getByTestId(NAVIGATION_HANDLES.PROFILE_LINK)).toHaveCount(0);
    },
    { root: true },
  );
});

test("managing admin can impersonate a non-admin user from all users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ origin, page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenantSlug = Date.now();
      const tenantName = `support-mode-user-${tenantSlug}`;
      const tenant = await tenantFactory.create({
        name: tenantName,
        host: buildLmsLocalhostTenantHost(requireOrigin(origin), tenantName),
      });

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      const supportOrigin = new URL(tenant.host).origin;
      const registrationClient = createFixtureApiClient();
      registrationClient.syncTenantOrigin(supportOrigin);
      const studentEmail = `support-mode-student-${tenantSlug}@example.com`;
      const studentResponse = await registrationClient.api.authControllerRegister({
        email: studentEmail,
        firstName: "Support",
        lastName: "Student",
        password: "Password123@",
        language: "en",
      });
      const studentId = studentResponse.data.data.id;

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);
      await page.getByTestId(TENANTS_PAGE_HANDLES.supportModeButton(tenant.id)).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER).waitFor();
      await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH).fill(studentEmail);

      await expect(
        page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH_ALL_USERS),
      ).toBeVisible();
      await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH_ALL_USERS).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_ALL_USERS_TAB).click();
      await expect(
        page.getByTestId(TENANTS_PAGE_HANDLES.supportModeUserOption(studentId)),
      ).toBeVisible();
      await page.getByTestId(TENANTS_PAGE_HANDLES.supportModeUserOption(studentId)).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SUBMIT).click();

      await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(supportOrigin)}/courses$`));
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page.getByTestId(NAVIGATION_HANDLES.USERS_LINK)).toHaveCount(0);

      await page.goto(`${supportOrigin}/settings`);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NO_AVAILABLE_SETTINGS)).toHaveText(
        "No settings are available for this user while in support mode.",
      );
    },
    { root: true },
  );
});

test("support mode blocks super-admin access and can be exited", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ origin, page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenantSlug = Date.now();
      const tenantName = `support-mode-exit-${tenantSlug}`;
      const tenant = await tenantFactory.create({
        name: tenantName,
        host: buildLmsLocalhostTenantHost(requireOrigin(origin), tenantName),
      });

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);

      const supportOrigin = new URL(tenant.host).origin;
      await enterSupportModeFromListFlow(page, tenant.id);

      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(supportOrigin)}/dashboard$`));
      await expect(page.getByTestId(NAVIGATION_HANDLES.SUPER_ADMIN_GROUP)).toHaveCount(0);

      const originalOrigin = requireOrigin(origin);
      const supportExitNavigation = page.waitForURL(
        new RegExp(`^${escapeRegExp(originalOrigin)}/`),
      );
      await page.getByTestId(SUPPORT_MODE_HANDLES.EXIT_BUTTON).click();
      await supportExitNavigation;

      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toHaveCount(0);

      await openTenantsPageFlow(page);

      await expect(page).toHaveURL(/\/super-admin\/tenants$/);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.PAGE)).toBeVisible();
    },
    { root: true },
  );
});
