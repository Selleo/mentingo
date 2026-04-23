import { USER_ROLE } from "~/config/userRoles";

import {
  LOGIN_PAGE_HANDLES,
  MAGIC_LINK_PAGE_HANDLES,
  PASSWORD_RECOVERY_PAGE_HANDLES,
  REGISTER_PAGE_HANDLES,
} from "../../data/auth/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { USERS_PAGE_HANDLES } from "../../data/users/handles";
import { getReadonlyAuthEmail, login } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillLoginFormFlow } from "../../flows/auth/fill-login-form.flow";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { submitLoginFormFlow } from "../../flows/auth/submit-login-form.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";

test("admin can sign in and sign out", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const email = getReadonlyAuthEmail(USER_ROLE.admin);

    await login(page, email, "Password123@");
    await page.goto("/admin/users");

    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toHaveCount(0);
    await expect(page.getByTestId(USERS_PAGE_HANDLES.HEADING)).toBeVisible();
    await expect(page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER)).toBeVisible();

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await page.getByTestId(NAVIGATION_HANDLES.LOGOUT).click();

    await expect(page).toHaveURL("/auth/login");
    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});

test("visitor can navigate between auth pages", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
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
});

test("visitor cannot log in with invalid credentials", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openLoginPageFlow(page);
    await fillLoginFormFlow(page, `visitor-${Date.now()}@example.com`, "wrong-password");
    await submitLoginFormFlow(page);

    await expect(page).toHaveURL("/auth/login");
    await assertToastVisible(page, "Invalid email or password");
  });
});
