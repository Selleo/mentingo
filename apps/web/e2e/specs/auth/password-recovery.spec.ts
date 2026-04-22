import { USER_ROLE } from "~/config/userRoles";

import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateNewPasswordFormFlow } from "../../flows/auth/fill-create-new-password-form.flow";
import { fillPasswordRecoveryFormFlow } from "../../flows/auth/fill-password-recovery-form.flow";
import { openPasswordRecoveryPageFlow } from "../../flows/auth/open-password-recovery-page.flow";
import { submitCreateNewPasswordFormFlow } from "../../flows/auth/submit-create-new-password-form.flow";
import { submitPasswordRecoveryFormFlow } from "../../flows/auth/submit-password-recovery-form.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../../utils/mailhog";

const UPDATED_PASSWORD = "ChangedPassword123@";

test("visitor can request a password reset email", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `password-reset-${Date.now()}@example.com`;
    const user = await userFactory.register({
      email,
      firstName: "Password",
      lastName: "Reset",
      password: "Password123@",
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openPasswordRecoveryPageFlow(page);
    await fillPasswordRecoveryFormFlow(page, email);
    await submitPasswordRecoveryFormFlow(page);

    await assertToastVisible(page, "A link to reset your password has been sent to your email.");
  });
});

test("visitor can reset a password from the recovery email", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `password-reset-flow-${Date.now()}@example.com`;
    const user = await userFactory.register({
      email,
      firstName: "Reset",
      lastName: "Flow",
      password: "Password123@",
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openPasswordRecoveryPageFlow(page);
    await fillPasswordRecoveryFormFlow(page, email);
    await submitPasswordRecoveryFormFlow(page);

    const message = await waitForMailhogMessage({
      recipient: email,
      subjectIncludes: "Password recovery",
    });

    const resetLink = extractLinkFromMailhogMessage(message, "/auth/create-new-password");

    await page.goto(resetLink);
    await expect(page).toHaveURL(/\/auth\/create-new-password\?/);

    await fillCreateNewPasswordFormFlow(page, {
      newPassword: UPDATED_PASSWORD,
    });
    await submitCreateNewPasswordFormFlow(page);

    await assertToastVisible(page, "Password changed successfully");
    await expect(page).toHaveURL("/auth/login");

    await login(page, email, UPDATED_PASSWORD);
    await expect(page).toHaveURL("/courses");

    await logout(page);
    await expect(page).toHaveURL("/auth/login");
  });
});
