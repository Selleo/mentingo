import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { login } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateNewPasswordFormFlow } from "../../flows/auth/fill-create-new-password-form.flow";
import { openCreateNewPasswordPageFlow } from "../../flows/auth/open-create-new-password-page.flow";
import { submitCreateNewPasswordFormFlow } from "../../flows/auth/submit-create-new-password-form.flow";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../../utils/mailhog";

const NEW_PASSWORD = "ChangedPassword123@";

test("visitor can create a password from the invite email", async ({
  cleanup,
  factories,
  withWorkerPage,
  page,
}) => {
  let email = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    email = `invite-${Date.now()}@example.com`;
    const createdUser = await userFactory.create({
      email,
      firstName: "Invite",
      lastName: "User",
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    });

    cleanup.add(async () => {
      await userFactory.delete(createdUser.id);
    });
  });

  const message = await waitForMailhogMessage({
    recipient: email,
    subjectIncludes: "You're invited to the platform!",
  });

  const inviteLink = extractLinkFromMailhogMessage(message, "/auth/create-new-password");

  await openCreateNewPasswordPageFlow(page, {
    email,
    resetToken: new URL(inviteLink).searchParams.get("resetToken") ?? undefined,
    createToken: new URL(inviteLink).searchParams.get("createToken") ?? undefined,
  });

  await fillCreateNewPasswordFormFlow(page, {
    newPassword: NEW_PASSWORD,
  });
  await submitCreateNewPasswordFormFlow(page);

  await expect(page).toHaveURL("/auth/login");

  await login(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL("/courses");
});
