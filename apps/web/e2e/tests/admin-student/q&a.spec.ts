import { expect, test, type Page } from "@playwright/test";

import { getTenantEmail } from "../../utils/tenant-email";

const USERS = {
  admin: { email: getTenantEmail("admin@example.com"), password: "password" },
  student: { email: getTenantEmail("student0@example.com"), password: "password" },
};

const QA_CONTENT = {
  en: { question: "Where can I access settings?", answer: "In the left bottom corner" },
  plFirst: { question: "Gdzie znajdę kursy?", answer: "W lewym panelu" },
  plSecond: { question: "Do czego służy ta platforma?", answer: "Do nauki o samochodach" },
};

const openLanguageCombobox = async (page: Page) => {
  const combobox = page.getByRole("combobox");
  await combobox.waitFor({ state: "visible" });
  await combobox.click({ force: true });
  return combobox;
};

const enableQASection = async (page: Page) => {
  const profileButton = page.getByRole("button", {
    name: /Test Admin profile Test Admin|Avatar for email@example.com/i,
  });
  await profileButton.click();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Platform Customization" }).click();
  await page.getByLabel("Enable Q&A section").click();
};

const goToQAPageFromContent = async (page: Page) => {
  await page.getByRole("button", { name: "Content" }).nth(1).click();
  await expect(page.getByRole("link", { name: "Q&A" })).toBeVisible();
  await page.getByRole("link", { name: "Q&A" }).click();
  await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();
};

const createQA = async (
  page: Page,
  { question, answer, languageLabel }: { question: string; answer: string; languageLabel?: string },
) => {
  await page.getByRole("button", { name: "Create new Q&A" }).click();
  await page.waitForURL("/qa/new");

  if (languageLabel) {
    await openLanguageCombobox(page);
    await page.getByLabel(languageLabel).click();
  }

  await page.getByLabel("*Question").click();
  await page.getByLabel("*Question").fill(question);
  await page.getByLabel("*Answer").click();
  await page.getByLabel("*Answer").fill(answer);
  await expect(page.getByRole("button", { name: "Create new Q&A" })).toBeVisible();
  await page.getByRole("button", { name: "Create new Q&A" }).click();
  await page.waitForURL("/qa");
};

const logout = async (page: Page) => {
  const profileButton = page.getByRole("button", {
    name: /Test Admin profile Test Admin|Avatar for email@example.com/i,
  });
  await profileButton.click();
  await page
    .getByRole("menuitem", { name: /logout|wyloguj/i })
    .locator("div")
    .click();
};

const login = async (page: Page, { email, password }: { email: string; password: string }) => {
  await page.getByPlaceholder("user@example.com").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel(/password|hasło/i).click();
  await page.getByLabel(/password|hasło/i).fill(password);
  await page.getByRole("button", { name: /login|zaloguj się/i }).click();
};

test.describe("Q&A flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should create Q&A and verify in student view with different languages", async ({
    page,
  }) => {
    page.goto("/qa");
    // goes to home page as Q&A is disabled
    await page.waitForURL("/");

    await enableQASection(page);
    await goToQAPageFromContent(page);

    await createQA(page, QA_CONTENT.en);
    await createQA(page, { ...QA_CONTENT.plFirst, languageLabel: "Polish" });
    await createQA(page, { ...QA_CONTENT.plSecond, languageLabel: "Polish" });

    await page.getByRole("button", { name: "Q:  Where can I access" }).click();
    await page.getByRole("button", { name: "Q:  Gdzie znajdę kursy? Edit" }).click();
    await expect(page.getByText("W lewym panelu")).toBeVisible();
    await page.getByRole("button", { name: "Q:  Do czego służy ta" }).click();
    await expect(page.getByText("Do nauki o samochodach")).toBeVisible();
    await page.getByRole("button", { name: "Q:  Where can I access" }).click();
    await expect(page.getByText("In the left bottom corner")).toBeVisible();
    await logout(page);
    await login(page, USERS.student);

    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Continue learning" })).toBeVisible();

    const qaButton = page.getByRole("link", { name: "Q&A" });
    if (!(await qaButton.isVisible())) {
      await page.getByRole("button", { name: "Content" }).nth(1).click();
    }
    await expect(qaButton).toBeVisible();
    await qaButton.click();
    await expect(page.getByRole("heading", { name: "Gdzie znajdę kursy?" })).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Do czego służy ta platforma?" }),
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Q:  Where can I access" })).toBeVisible();
    await page.getByRole("button", { name: "Q:  Where can I access" }).click();
    await expect(page.getByText("In the left bottom corner")).toBeVisible();
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await openLanguageCombobox(page);
    await page.getByLabel("Polish").click();
    await page.getByRole("link", { name: "Q&A" }).click();
    await expect(page.getByRole("button", { name: "Q:  Where can I access" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Q:  Gdzie znajdę kursy?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Q:  Do czego służy ta" })).toBeVisible();
    await page.getByRole("button", { name: "Q:  Gdzie znajdę kursy?" }).click();
    await expect(page.getByText("W lewym panelu")).toBeVisible();
    await page.getByRole("button", { name: "Q:  Do czego służy ta" }).click();
    await expect(page.getByText("Do nauki o samochodach")).toBeVisible();
    await logout(page);
    await login(page, USERS.admin);
    await page
      .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
      .click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Platform Customization" }).click();
    await page.getByLabel("Enable Q&A section").click();
    await logout(page);
    await login(page, USERS.student);

    await page.waitForURL("courses");

    await expect(page.getByRole("button", { name: "Content" }).nth(1)).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Q&A" })).not.toBeVisible();
    page.goto("/qa");
    // goes to home page as Q&A is disabled
    await page.waitForURL("/", { waitUntil: "domcontentloaded", timeout: 10000 });
  });
});
