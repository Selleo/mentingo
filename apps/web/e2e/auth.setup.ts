import { test as setup } from "@playwright/test";

import { AuthFixture } from "./fixture/auth.fixture";

setup("authenticate", async ({ page }) => {
  const studentAuthFixture = new AuthFixture(page);
  await studentAuthFixture.login("student@example.com", "password");

  await page.context().storageState({
    path: "e2e/.auth/user.json",
  });

  const adminAuthFixture = new AuthFixture(page);
  await adminAuthFixture.login("admin@example.com", "password");

  await page.context().storageState({
    path: "e2e/.auth/admin.json",
  });

  const contentCreatorAuthFixture = new AuthFixture(page);
  await contentCreatorAuthFixture.login("contentcreator@example.com", "password");

  await page.context().storageState({
    path: "e2e/.auth/content-creator.json",
  });
});
