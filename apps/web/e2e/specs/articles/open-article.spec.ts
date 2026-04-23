import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES, ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";

test("admin can open article details and see it in TOC", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const articleFactory = factories.createArticleFactory();
    const title = `open-article-${Date.now()}`;
    const summary = `open-article-summary-${Date.now()}`;
    const { article, section } = await articleFactory.createWithSection({
      title,
      summary,
      status: "published",
      isPublic: true,
    });

    cleanup.add(async () => {
      await Promise.allSettled([
        articleFactory.delete(article.id),
        articleFactory.deleteSection(section.id),
      ]);
    });

    await openArticleDetailsPageFlow(page, article.id);

    await expect(page).toHaveURL(new RegExp(`/articles/${article.id}$`));
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(title);
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(summary);
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.PANEL)).toBeVisible();
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(article.id))).toBeVisible();
  });
});
