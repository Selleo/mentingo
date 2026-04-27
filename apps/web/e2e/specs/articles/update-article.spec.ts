import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES } from "../../data/articles/handles";
import { updateArticleFlow } from "../../flows/articles/update-article.flow";

import { expect, test } from "./article-test.fixture";

test("admin can update article title and summary", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const articleFactory = factories.createArticleFactory();
    const { article, section } = await articleFactory.createWithSection({
      status: "published",
      isPublic: true,
    });
    const updatedTitle = `updated-article-${Date.now()}`;
    const updatedSummary = `updated-article-summary-${Date.now()}`;

    cleanup.add(async () => {
      await Promise.allSettled([
        articleFactory.delete(article.id),
        articleFactory.deleteSection(section.id),
      ]);
    });

    await updateArticleFlow(page, {
      articleId: article.id,
      title: updatedTitle,
      summary: updatedSummary,
    });

    await expect(page).toHaveURL(new RegExp(`/articles/${article.id}$`));
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(updatedTitle);
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(updatedSummary);

    await expect
      .poll(async () => {
        const updatedArticle = await articleFactory.getById(article.id);
        return updatedArticle.title;
      })
      .toBe(updatedTitle);
  });
});
