import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

import type { Page } from "@playwright/test";
import type { GetEmailTemplateResponse } from "~/api/generated-api";

export const openEmailCatalogFromNavigationFlow = async (page: Page) => {
  await page.goto("/");
  await page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE).click();
  await page.getByTestId(NAVIGATION_HANDLES.EMAIL_TEMPLATES_LINK).click();
};

export const copyEmailTemplateFlow = async (page: Page, input: { event: string }) => {
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/defaults/${input.event}/copy`) &&
      response.request().method() === "POST",
  );
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.COPY).click();
  const result: GetEmailTemplateResponse = await (await created).json();
  return result.data;
};

export const duplicateEmailTemplateFlow = async (page: Page, input: { id: string }) => {
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${input.id}/duplicate`) && response.request().method() === "POST",
  );
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.DUPLICATE).click();
  const result: GetEmailTemplateResponse = await (await created).json();
  return result.data;
};

export const sendTestEmailFlow = async (page: Page) => {
  const queued = page.waitForResponse(
    (response) =>
      response.url().endsWith("/email-templates/test-send") &&
      response.request().method() === "POST",
  );
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SEND_TEST).click();
  return queued;
};

export const returnToEmailCatalogFlow = async (page: Page) => {
  const catalogLink = page.getByTestId(NAVIGATION_HANDLES.EMAIL_TEMPLATES_LINK);
  if (!(await catalogLink.isVisible())) {
    await page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE).click();
  }
  await catalogLink.click();
};
