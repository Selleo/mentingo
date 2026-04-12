import { expect, type Page } from "@playwright/test";

import { LOGIN_PAGE_HANDLES } from "../data/auth/handles";
import { NAVIGATION_HANDLES } from "../data/navigation/handles";

const LOGIN_URL = "/auth/login";
const COURSES_URL = "/courses";

export async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(LOGIN_URL);
  await expect(page).toHaveURL(LOGIN_URL);
  await page.getByTestId(LOGIN_PAGE_HANDLES.EMAIL).fill(email);
  await page.getByTestId(LOGIN_PAGE_HANDLES.PASSWORD).fill(password);
  await page.getByTestId(LOGIN_PAGE_HANDLES.LOGIN).click();
  await expect(page).toHaveURL(COURSES_URL);
}

export async function logout(page: Page) {
  await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
  await page.getByTestId(NAVIGATION_HANDLES.LOGOUT).click();
  await expect(page).toHaveURL(LOGIN_URL);
}

export { getAuthEmail, getReadonlyAuthEmail, getWorkerAuthEmail } from "../utils/auth-email";
