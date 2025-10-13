import { test, expect, type Page } from "@playwright/test";

import { fillAndAssertTextField, logout } from "../../utils";

import { ENV_MANAGER_UI } from "./data/env-manager-data";

const getInputId = (name: string) => `${name}-input`;

const showTextField = async (page: Page, name: string) => {
  const inputTestId = getInputId(name);

  const inputField = page.getByTestId(inputTestId);
  await expect(inputField).toBeVisible();
  await inputField.waitFor({ state: "attached" });

  if (!(await inputField.isDisabled())) return;

  await page.getByTestId(`${name}-toggle`).click();
  await expect(page.getByTestId(inputTestId)).toBeEnabled();
};

test.describe("Admin envs page flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/envs");
  });

  test.describe("Env CRUD", () => {
    test("should update env to true", async ({ page, browser }) => {
      await test.step("should insert env", async () => {
        await showTextField(page, ENV_MANAGER_UI.env.viteMicrosoftEnabled.name);

        await fillAndAssertTextField(
          page,
          getInputId(ENV_MANAGER_UI.env.viteMicrosoftEnabled.name),
          ENV_MANAGER_UI.env.viteMicrosoftEnabled.true,
        );

        await page.getByTestId(ENV_MANAGER_UI.button.submit).click();
      });

      await test.step("should verify updated env", async () => {
        const newPage = await logout(browser);

        await newPage.goto("/");

        await expect(newPage.getByTestId(ENV_MANAGER_UI.button.microsoftSSO)).toBeVisible();
      });
    });

    test("should update env to false", async ({ page, browser }) => {
      await test.step("should insert env", async () => {
        await showTextField(page, ENV_MANAGER_UI.env.viteMicrosoftEnabled.name);

        await fillAndAssertTextField(
          page,
          getInputId(ENV_MANAGER_UI.env.viteMicrosoftEnabled.name),
          ENV_MANAGER_UI.env.viteMicrosoftEnabled.false,
        );

        await page.getByTestId(ENV_MANAGER_UI.button.submit).click();
      });

      await test.step("should verify updated env", async () => {
        const newPage = await logout(browser);

        await newPage.goto("/");

        const ssoElement = newPage.getByTestId(ENV_MANAGER_UI.button.microsoftSSO);

        await expect(ssoElement).not.toBeVisible();
      });
    });
  });
});
