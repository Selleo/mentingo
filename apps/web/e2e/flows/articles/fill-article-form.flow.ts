import { ARTICLE_FORM_PAGE_HANDLES } from "../../data/articles/handles";

import type { Page } from "@playwright/test";

type FillArticleFormFlowInput = {
  title?: string;
  summary?: string;
};

export const fillArticleFormFlow = async (
  page: Page,
  { title, summary }: FillArticleFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(ARTICLE_FORM_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (summary !== undefined) {
    await page.getByTestId(ARTICLE_FORM_PAGE_HANDLES.SUMMARY_INPUT).fill(summary);
  }
};
