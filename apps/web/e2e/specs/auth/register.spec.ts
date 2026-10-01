import { USER_ROLE } from "~/config/userRoles";

import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillRegisterFormFlow } from "../../flows/auth/fill-register-form.flow";
import { openRegisterPageFlow } from "../../flows/auth/open-register-page.flow";
import { submitRegisterFormFlow } from "../../flows/auth/submit-register-form.flow";

const REGISTER_PASSWORD = "Password123@";

test("visitor can register a new account", async ({ cleanup, factories, withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `register-${Date.now()}@example.com`;

    await openRegisterPageFlow(page);
    await fillRegisterFormFlow(page, {
      firstName: "Register",
      lastName: "User",
      email,
      password: REGISTER_PASSWORD,
    });
    await submitRegisterFormFlow(page);

    await expect
      .poll(async () => {
        const createdUser = await userFactory.getByEmail(email);
        return createdUser?.id ?? null;
      })
      .not.toBeNull();

    cleanup.add(async () => {
      const createdUser = await userFactory.getByEmail(email);

      if (createdUser) await userFactory.delete(createdUser.id);
    });

    const createdUser = await userFactory.getByEmail(email);

    if (!createdUser) throw new Error(`Expected registered user ${email} to exist`);

    await expect(page).toHaveURL("/dashboard");
    await logout(page);
    await login(page, email, REGISTER_PASSWORD);
    await expect(page).toHaveURL("/dashboard");
  });
});

test("visitor cannot submit invalid registration data", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openRegisterPageFlow(page);

    await fillRegisterFormFlow(page, {
      firstName: "A",
      lastName: "B",
      email: "not-an-email",
      password: "short",
    });

    await expect(page.getByTestId(REGISTER_PAGE_HANDLES.SUBMIT)).toBeDisabled();
  });
});

test("visitor sees an explanation and sign-in link when registration is invite-only", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const getInviteOnlyRegistration = async () => {
      const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
      return response.data.data.inviteOnlyRegistration;
    };
    const originalValue = await getInviteOnlyRegistration();

    cleanup.add(async () => {
      if ((await getInviteOnlyRegistration()) !== originalValue) {
        await apiClient.api.settingsControllerUpdateInviteOnlyRegistration();
      }
    });

    if (!originalValue) {
      await apiClient.api.settingsControllerUpdateInviteOnlyRegistration();
    }

    await page.context().clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/auth/register");

    await expect(page).toHaveURL("/auth/register");
    await expect(
      page.getByRole("heading", { name: "Registration is only possible by invitation." }),
    ).toBeVisible();
    await expect(page.getByTestId(REGISTER_PAGE_HANDLES.PAGE)).toHaveCount(0);

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/auth/login");
  });
});
