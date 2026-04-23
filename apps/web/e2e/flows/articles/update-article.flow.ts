import { ARTICLE_FORM_PAGE_HANDLES } from "../../data/articles/handles";

import { fillArticleFormFlow } from "./fill-article-form.flow";
import { submitArticleFormFlow } from "./submit-article-form.flow";

import type { Page } from "@playwright/test";

type UpdateArticleFlowInput = {
  articleId: string;
  title?: string;
  summary?: string;
};

export const updateArticleFlow = async (
  page: Page,
  { articleId, title, summary }: UpdateArticleFlowInput,
) => {
  await page.goto(`/articles/${articleId}/edit`);
  await page.getByTestId(ARTICLE_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
  await fillArticleFormFlow(page, { title, summary });
  await submitArticleFormFlow(page);
};
