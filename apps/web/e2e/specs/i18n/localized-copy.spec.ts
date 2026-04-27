import { expect, test } from "../../fixtures/test.fixture";
import { fillLoginFormFlow } from "../../flows/auth/fill-login-form.flow";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { submitLoginFormFlow } from "../../flows/auth/submit-login-form.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { seedLanguageStorage } from "../../utils/language-storage";

test("visitor sees localized auth copy when the language is stored in localStorage", async ({
  createWorkspacePage,
}) => {
  const { context, page } = await createWorkspacePage({ root: true });

  await seedLanguageStorage(context, "de");

  try {
    await openLoginPageFlow(page, { preserveSession: true });
    await expect(page.locator("html")).toHaveAttribute("lang", "de");

    await fillLoginFormFlow(page, `visitor-${Date.now()}@example.com`, "wrong-password");
    await submitLoginFormFlow(page);

    await expect(page).toHaveURL("/auth/login");
    await assertToastVisible(page, "Ungültige E-Mail-Adresse oder ungültiges Passwort");
  } finally {
    await context.close();
  }
});
