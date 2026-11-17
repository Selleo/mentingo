import { USER_ROLE } from "~/config/userRoles";

import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillRegisterFormFlow } from "../../flows/auth/fill-register-form.flow";
import { openRegisterPageFlow } from "../../flows/auth/open-register-page.flow";
import { submitRegisterFormFlow } from "../../flows/auth/submit-register-form.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { setInviteOnlyRegistrationFlow } from "../../flows/settings/set-invite-only-registration.flow";

test("visitor can register a new account", async ({
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  const email = `register-${Date.now()}@example.com`;

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();

    cleanup.add(async () => {
      const createdUser = await userFactory.getByEmail(email);

      if (createdUser) await userFactory.delete(createdUser.id);
    });
  });

  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openRegisterPageFlow(page);
  await fillRegisterFormFlow(page, {
    firstName: "Register",
    lastName: "User",
    email,
    password: TEST_PASSWORD,
  });
  await submitRegisterFormFlow(page);

  await expect(page).toHaveURL("/dashboard");
  await logout(page);
  await login(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL("/dashboard");
});

test("visitor cannot submit invalid registration data", async ({
  cleanup,
  createWorkspacePage,
}) => {
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openRegisterPageFlow(page);

  await fillRegisterFormFlow(page, {
    firstName: "A",
    lastName: "B",
    email: "not-an-email",
    password: "short",
  });

  await expect(page.getByTestId(REGISTER_PAGE_HANDLES.SUBMIT)).toBeDisabled();
});

test("enabling invite-only registration shows visitors the invite-only screen", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
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

    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await setInviteOnlyRegistrationFlow(page, true);
    await expect.poll(getInviteOnlyRegistration).toBe(true);

    const visitor = await createWorkspacePage();
    cleanup.add(() => visitor.context.close());

    await visitor.page.goto("/auth/register");

    await expect(visitor.page.getByTestId(REGISTER_PAGE_HANDLES.INVITE_ONLY)).toBeVisible();
    await expect(visitor.page.getByTestId(REGISTER_PAGE_HANDLES.PAGE)).toHaveCount(0);

    await visitor.page.getByTestId(REGISTER_PAGE_HANDLES.INVITE_ONLY_SIGN_IN_LINK).click();
    await expect(visitor.page).toHaveURL("/auth/login");
  });
});
