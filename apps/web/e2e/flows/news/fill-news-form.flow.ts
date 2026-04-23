import { NEWS_FORM_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

type FillNewsFormFlowInput = {
  title?: string;
  summary?: string;
  status?: "draft" | "published";
};

export const fillNewsFormFlow = async (
  page: Page,
  { title, summary, status }: FillNewsFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(NEWS_FORM_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (summary !== undefined) {
    await page.getByTestId(NEWS_FORM_PAGE_HANDLES.SUMMARY_INPUT).fill(summary);
  }

  if (status !== undefined) {
    await page.getByTestId(NEWS_FORM_PAGE_HANDLES.STATUS_SELECT).click();
    await page.getByTestId(NEWS_FORM_PAGE_HANDLES.statusOption(status)).click();
  }
};
