import { test as setup } from "@playwright/test";

import { AuthFixture } from "./fixture/auth.fixture";

setup("authenticate", async ({ browser }) => {
  // Student
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const studentAuthFixture = new AuthFixture(studentPage);
  await studentAuthFixture.login("student@example.com", "password");
  await studentContext.storageState({ path: "e2e/.auth/user.json" });
  await studentContext.close();

  // Admin
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminAuthFixture = new AuthFixture(adminPage);
  await adminAuthFixture.login("admin@example.com", "password");
  await adminContext.storageState({ path: "e2e/.auth/admin.json" });
  await adminContext.close();

  // Content Creator
  const creatorContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  const contentCreatorAuthFixture = new AuthFixture(creatorPage);
  await contentCreatorAuthFixture.login("contentcreator@example.com", "password");
  await creatorContext.storageState({ path: "e2e/.auth/content-creator.json" });
  await creatorContext.close();
});
