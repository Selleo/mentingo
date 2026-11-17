import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import versionJson from "../../../version.json" with { type: "json" };
import {
  LOGIN_PAGE_HANDLES,
  MAGIC_LINK_PAGE_HANDLES,
  PASSWORD_RECOVERY_PAGE_HANDLES,
  REGISTER_PAGE_HANDLES,
} from "../../data/auth/handles";
import { TOAST_HANDLES } from "../../data/common/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillLoginFormFlow } from "../../flows/auth/fill-login-form.flow";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { submitLoginFormFlow } from "../../flows/auth/submit-login-form.flow";

const { version } = versionJson;

test("admin can sign in and sign out", async ({
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  const email = `login-admin-${Date.now()}@example.com`;

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.register({ email, password: TEST_PASSWORD });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await userFactory.update(user.id, { roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN] });
  });

  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openLoginPageFlow(page);
  await fillLoginFormFlow(page, email, TEST_PASSWORD);
  await submitLoginFormFlow(page);
  await expect(page).not.toHaveURL("/auth/login");

  await page.goto("/admin/users");

  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toHaveCount(0);
  await expect(page.getByTestId(USERS_PAGE_HANDLES.HEADING)).toBeVisible();

  await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
  await page.getByTestId(NAVIGATION_HANDLES.LOGOUT).click();

  await expect(page).toHaveURL("/auth/login");
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
});

test("visitor can navigate between auth pages", async ({ cleanup, createWorkspacePage }) => {
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openLoginPageFlow(page);

  await page.getByTestId(LOGIN_PAGE_HANDLES.FORGOT_PASSWORD_LINK).click();
  await expect(page).toHaveURL("/auth/password-recovery");

  await page.getByTestId(PASSWORD_RECOVERY_PAGE_HANDLES.BACK_TO_LOGIN_LINK).click();
  await expect(page).toHaveURL("/auth/login");

  await page.getByTestId(LOGIN_PAGE_HANDLES.MAGIC_LINK_LINK).click();
  await expect(page).toHaveURL("/auth/magic-link");

  await page.getByTestId(MAGIC_LINK_PAGE_HANDLES.BACK_TO_LOGIN_LINK).click();
  await expect(page).toHaveURL("/auth/login");

  await page.getByTestId(LOGIN_PAGE_HANDLES.REGISTER_LINK).click();
  await expect(page).toHaveURL("/auth/register");
  await expect(page.getByTestId(REGISTER_PAGE_HANDLES.PAGE)).toBeVisible();

  await page.getByTestId(REGISTER_PAGE_HANDLES.SIGN_IN_LINK).click();
  await expect(page).toHaveURL("/auth/login");
});

test("visitor can open changelog for the current app version", async ({
  cleanup,
  createWorkspacePage,
}) => {
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openLoginPageFlow(page);

  const changelogLink = page.getByTestId(LOGIN_PAGE_HANDLES.VERSION_CHANGELOG_LINK);

  await expect(changelogLink).toBeVisible();
  await expect(changelogLink).toHaveAttribute(
    "href",
    `https://github.com/Selleo/mentingo/blob/main/CHANGELOG.md#${version}`,
  );
  await expect(changelogLink).toHaveAttribute("target", "_blank");
});

test("visitor cannot log in with invalid credentials", async ({ cleanup, createWorkspacePage }) => {
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openLoginPageFlow(page);
  await fillLoginFormFlow(page, `visitor-${Date.now()}@example.com`, "wrong-password");
  await submitLoginFormFlow(page);

  await expect(page.getByTestId(TOAST_HANDLES.ROOT)).toBeVisible();
  await expect(page).toHaveURL("/auth/login");
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
});
