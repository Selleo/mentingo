import { expect, type Page } from "@playwright/test";

import { NEWS_DETAILS_PAGE_HANDLES, NEWS_FORM_PAGE_HANDLES } from "../../data/news/handles";

import { fillNewsFormFlow } from "./fill-news-form.flow";
import { submitNewsFormFlow } from "./submit-news-form.flow";

type UpdateNewsFlowInput = {
  newsId: string;
  title?: string;
  summary?: string;
  status?: "draft" | "published";
};

/** Edits and saves the news. The form skips saving without changes, so callers must change a field. */
export const updateNewsFlow = async (
  page: Page,
  { newsId, title, summary, status }: UpdateNewsFlowInput,
) => {
  if (title === undefined && summary === undefined && status === undefined) {
    throw new Error("updateNewsFlow needs at least one field to change");
  }

  await page.goto(`/news/${newsId}/edit`);
  await page.getByTestId(NEWS_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
  await fillNewsFormFlow(page, { title, summary, status });

  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/news/${newsId}` &&
      response.request().method() === "PATCH",
  );
  await submitNewsFormFlow(page);
  expect((await saved).ok()).toBe(true);

  // Saving navigates to the details page; leaving earlier would cancel the update request.
  await page.waitForURL(new RegExp(`/news/${newsId}$`));
  await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
