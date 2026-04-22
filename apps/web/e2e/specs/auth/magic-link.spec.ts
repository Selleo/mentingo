import { USER_ROLE } from "~/config/userRoles";

import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillMagicLinkFormFlow } from "../../flows/auth/fill-magic-link-form.flow";
import { openMagicLinkPageFlow } from "../../flows/auth/open-magic-link-page.flow";
import { submitMagicLinkFormFlow } from "../../flows/auth/submit-magic-link-form.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../../utils/mailhog";

const INITIAL_PASSWORD = "Password123@";

test("visitor can request a login link email", async ({ cleanup, factories, withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `magic-link-${Date.now()}@example.com`;
    const user = await userFactory.register({
      email,
      firstName: "Magic",
      lastName: "Link",
      password: INITIAL_PASSWORD,
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openMagicLinkPageFlow(page);
    await fillMagicLinkFormFlow(page, email);
    await submitMagicLinkFormFlow(page);

    await assertToastVisible(page, "Login link sent to your email.");
  });
});

test("visitor can log in from the magic link email", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `magic-link-flow-${Date.now()}@example.com`;
    const user = await userFactory.register({
      email,
      firstName: "Magic",
      lastName: "Flow",
      password: INITIAL_PASSWORD,
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openMagicLinkPageFlow(page);
    await fillMagicLinkFormFlow(page, email);
    await submitMagicLinkFormFlow(page);

    const message = await waitForMailhogMessage({
      recipient: email,
      subjectIncludes: "Login link",
    });

    const magicLink = extractLinkFromMailhogMessage(message, "/auth/login?token=");

    await page.goto(magicLink);
    await expect(page).toHaveURL("/courses");

    await logout(page);
    await login(page, email, INITIAL_PASSWORD);
    await expect(page).toHaveURL("/courses");
  });
});
