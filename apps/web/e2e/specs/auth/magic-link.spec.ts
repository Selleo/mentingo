import { USER_ROLE } from "~/config/userRoles";

import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillMagicLinkFormFlow } from "../../flows/auth/fill-magic-link-form.flow";
import { openMagicLinkPageFlow } from "../../flows/auth/open-magic-link-page.flow";
import { submitMagicLinkFormFlow } from "../../flows/auth/submit-magic-link-form.flow";
import { assertToastVariantVisible } from "../../utils/assert-toast-visible";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../../utils/mailhog";

test("visitor can log in from the magic link email", async ({
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  const email = `magic-link-flow-${Date.now()}@example.com`;

  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.register({
      email,
      firstName: "Magic",
      lastName: "Flow",
      password: TEST_PASSWORD,
    });

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });
  });

  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openMagicLinkPageFlow(page);
  await fillMagicLinkFormFlow(page, email);
  await submitMagicLinkFormFlow(page);

  await assertToastVariantVisible(page, "default");

  const message = await waitForMailhogMessage({
    recipient: email,
    subjectIncludes: "Login link",
  });

  const magicLink = extractLinkFromMailhogMessage(message, "/auth/login?token=");
  const magicLinkUrl = new URL(magicLink);

  await page.goto(`${magicLinkUrl.pathname}${magicLinkUrl.search}`);
  await expect(page).toHaveURL("/dashboard");

  await logout(page);
  await login(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL("/dashboard");
});
