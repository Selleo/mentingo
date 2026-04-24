import { USER_ROLE } from "~/config/userRoles";

import { deleteArticleFlow } from "../../flows/articles/delete-article.flow";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";

import { expect, test } from "./article-test.fixture";

test("admin can delete article from details page", async ({
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

    cleanup.add(async () => {
      const existing = await articleFactory.safeGetById(article.id);
      await Promise.allSettled([
        existing ? articleFactory.delete(article.id) : Promise.resolve(),
        articleFactory.deleteSection(section.id),
      ]);
    });

    await openArticleDetailsPageFlow(page, article.id);
    await deleteArticleFlow(page);

    await expect(page).toHaveURL(/\/articles(\/[^/]+)?(\?.*)?$/);
    await expect
      .poll(async () => {
        const deletedArticle = await articleFactory.safeGetById(article.id);
        return deletedArticle;
      })
      .toBeNull();
  });
});
