import { USER_ROLE } from "~/config/userRoles";

import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateNewPasswordFormFlow } from "../../flows/auth/fill-create-new-password-form.flow";
import { fillPasswordRecoveryFormFlow } from "../../flows/auth/fill-password-recovery-form.flow";
import { openPasswordRecoveryPageFlow } from "../../flows/auth/open-password-recovery-page.flow";
import { submitCreateNewPasswordFormFlow } from "../../flows/auth/submit-create-new-password-form.flow";
import { submitPasswordRecoveryFormFlow } from "../../flows/auth/submit-password-recovery-form.flow";
import { assertToastVariantVisible } from "../../utils/assert-toast-visible";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../../utils/mailhog";

const UPDATED_PASSWORD = "ChangedPassword123@";

test("visitor can reset a password from the recovery email", async ({
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  const email = `password-reset-flow-${Date.now()}@example.com`;

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.register({
      email,
      firstName: "Reset",
      lastName: "Flow",
      password: TEST_PASSWORD,
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });
  });

  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openPasswordRecoveryPageFlow(page);
  await fillPasswordRecoveryFormFlow(page, email);
  await submitPasswordRecoveryFormFlow(page);

  await assertToastVariantVisible(page, "default");

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

  await expect(page).toHaveURL("/auth/login");

  await login(page, email, UPDATED_PASSWORD);
  await expect(page).toHaveURL("/dashboard");

  await logout(page);
  await expect(page).toHaveURL("/auth/login");
});
