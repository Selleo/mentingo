import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { createFixtureApiClient } from "../../utils/api-client";
import { assertToastVariantVisible } from "../../utils/assert-toast-visible";
import { markAllOnboardingComplete } from "../../utils/onboarding";
import { requireOrigin } from "../../utils/tenant-host";

test("admin can update profile details", async ({ apiClient, cleanup, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const currentUser = await apiClient.api.authControllerCurrentUser();
    const userId = currentUser.data.data.id;
    const originalDetails = await apiClient.api.userControllerGetUserDetails({ userId });
    const updatedDetails = {
      description: `Settings bio ${Date.now()}`,
      contactEmail: `settings-admin-${Date.now()}@example.com`,
      contactPhoneNumber: "+48123123123",
      jobTitle: "Settings E2E Admin",
    };

    cleanup.add(async () => {
      await apiClient.api.userControllerUpsertUserDetails({
        description: originalDetails.data.data.description ?? "",
        contactEmail: originalDetails.data.data.contactEmail ?? currentUser.data.data.email,
        contactPhoneNumber: originalDetails.data.data.contactPhone ?? "",
        jobTitle: originalDetails.data.data.jobTitle ?? "",
      });
    });

    await openSettingsPageFlow(page);
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_DESCRIPTION)
      .fill(updatedDetails.description);
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_CONTACT_EMAIL)
      .fill(updatedDetails.contactEmail);
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_CONTACT_PHONE)
      .fill(updatedDetails.contactPhoneNumber);
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_JOB_TITLE)
      .fill(updatedDetails.jobTitle);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_SAVE).click();

    await expect
      .poll(async () => {
        const response = await apiClient.api.userControllerGetUserDetails({ userId });

        return {
          description: response.data.data.description,
          contactEmail: response.data.data.contactEmail,
          contactPhone: response.data.data.contactPhone,
          jobTitle: response.data.data.jobTitle,
        };
      })
      .toEqual({
        description: updatedDetails.description,
        contactEmail: updatedDetails.contactEmail,
        contactPhone: updatedDetails.contactPhoneNumber,
        jobTitle: updatedDetails.jobTitle,
      });

    await page.reload();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_DESCRIPTION)).toHaveValue(
      updatedDetails.description,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_CONTACT_PHONE)).toHaveValue(
      updatedDetails.contactPhoneNumber,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_JOB_TITLE)).toHaveValue(
      updatedDetails.jobTitle,
    );
  });
});

test("admin profile details form blocks invalid contact email", async ({
  apiClient,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const currentUser = await apiClient.api.authControllerCurrentUser();
    const userId = currentUser.data.data.id;
    const originalDetails = await apiClient.api.userControllerGetUserDetails({ userId });

    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_CONTACT_EMAIL).fill("invalid-email");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_SAVE).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.USER_DETAILS_CONTACT_EMAIL_ERROR),
    ).toBeVisible();

    const unchangedDetails = await apiClient.api.userControllerGetUserDetails({ userId });

    expect(unchangedDetails.data.data.contactEmail).toBe(originalDetails.data.data.contactEmail);
  });
});

test("user can change password with valid current password and matching new password", async ({
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  const newPassword = `Changed${TEST_PASSWORD}${Date.now()}`;
  let email = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.register({ password: TEST_PASSWORD });
    email = user.email;
    cleanup.add(() => userFactory.delete(user.id));
  });

  const { context, origin, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await login(page, email, TEST_PASSWORD);
  const userApiClient = createFixtureApiClient();
  cleanup.add(() => userApiClient.clearCookies());
  await userApiClient.syncFromContext(context, requireOrigin(origin));
  await markAllOnboardingComplete(userApiClient);

  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_OLD).fill(TEST_PASSWORD);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW).fill(newPassword);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM).fill(newPassword);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_SAVE).click();
  await assertToastVariantVisible(page, "default");

  await login(page, email, newPassword);
  await expect(page).toHaveURL("/dashboard");
});
