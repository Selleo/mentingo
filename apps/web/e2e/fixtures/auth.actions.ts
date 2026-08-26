import { expect, type BrowserContext, type Page } from "@playwright/test";

import { LOGIN_PAGE_HANDLES } from "../data/auth/handles";
import { NAVIGATION_HANDLES } from "../data/navigation/handles";

const LOGIN_URL = "/auth/login";

export async function authenticateContext(
  context: BrowserContext,
  origin: string,
  email: string,
  password: string,
) {
  await context.clearCookies();

  const response = await context.request.post(`${origin}/api/auth/login`, {
    data: { email, password },
    headers: {
      Origin: origin,
      Referer: `${origin}/`,
    },
  });

  expect(response, `API login failed for ${email}`).toBeOK();

  const currentUserResponse = await context.request.get(`${origin}/api/auth/current-user`, {
    headers: {
      Origin: origin,
      Referer: `${origin}/`,
    },
  });

  expect(currentUserResponse, `Authenticated user could not be loaded for ${email}`).toBeOK();
}

export async function login(
  page: Page,
  email: string,
  password: string,
  options?: { origin?: string },
) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const loginUrl = options?.origin ? `${options.origin}${LOGIN_URL}` : LOGIN_URL;

  await page.goto(loginUrl);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(options?.origin ? `${options.origin}${LOGIN_URL}` : LOGIN_URL);
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
  await page.getByTestId(LOGIN_PAGE_HANDLES.EMAIL).fill(email);
  await page.getByTestId(LOGIN_PAGE_HANDLES.PASSWORD).fill(password);
  await page.getByTestId(LOGIN_PAGE_HANDLES.LOGIN).click();
  await expect(page).not.toHaveURL(options?.origin ? `${options.origin}${LOGIN_URL}` : LOGIN_URL, {
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle");
}

export async function logout(page: Page, options?: { origin?: string }) {
  await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
  await page.getByTestId(NAVIGATION_HANDLES.LOGOUT).click();
  await expect(page).toHaveURL(options?.origin ? `${options.origin}${LOGIN_URL}` : LOGIN_URL);
}

export { getAuthEmail, getReadonlyAuthEmail, getWorkerAuthEmail } from "../utils/auth-email";
