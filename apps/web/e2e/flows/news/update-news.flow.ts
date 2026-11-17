import { NEWS_DETAILS_PAGE_HANDLES, NEWS_FORM_PAGE_HANDLES } from "../../data/news/handles";

import { fillNewsFormFlow } from "./fill-news-form.flow";
import { submitNewsFormFlow } from "./submit-news-form.flow";

import type { Page } from "@playwright/test";

type UpdateNewsFlowInput = {
  newsId: string;
  title?: string;
  summary?: string;
  status?: "draft" | "published";
};

export const updateNewsFlow = async (
  page: Page,
  { newsId, title, summary, status }: UpdateNewsFlowInput,
) => {
  await page.goto(`/news/${newsId}/edit`);
  await page.getByTestId(NEWS_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
  await fillNewsFormFlow(page, { title, summary, status });
  await submitNewsFormFlow(page);
  // Saving navigates to the details page; leaving earlier would cancel the update request.
  await page.waitForURL(new RegExp(`/news/${newsId}$`));
  await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
