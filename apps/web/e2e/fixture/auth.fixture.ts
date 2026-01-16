import { expect } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

const COURSES_URL = "/courses";
const LOGIN_URL = "/auth/login";

export class AuthFixture {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly logoutButton: Locator;

  constructor(public page: Page) {
    this.emailInput = page.getByLabel("email");
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.getByRole("button", { name: /login/i });
    this.logoutButton = page.getByRole("menuitem", { name: /logout/i }).locator("div");
  }

  async login(email: string, password: string) {
    await this.page.goto(LOGIN_URL);
    await this.page.waitForURL(LOGIN_URL);
    const loginHeading = this.page.getByRole("heading", { name: "Login" });
    await loginHeading.waitFor({ state: "visible", timeout: 15000 });
    await expect(loginHeading).toBeVisible();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    await expect(this.page).toHaveURL(COURSES_URL);
  }

  async logout() {
    await this.page.getByRole("button", { name: /(avatar for|profile test)/i }).click();
    await this.logoutButton.click();
    await this.page.waitForURL(LOGIN_URL);
    await expect(this.page).toHaveURL(LOGIN_URL);
  }
}
