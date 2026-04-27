import { USER_ROLE } from "~/config/userRoles";

import { ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";

import { expect, test } from "./article-test.fixture";

test("admin can browse articles list", async ({ cleanup, factories, withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const articleFactory = factories.createArticleFactory();
    const prefix = `articles-list-${Date.now()}`;
    const { article: firstArticle, section } = await articleFactory.createWithSection({
      title: `${prefix}-first`,
      status: "published",
      isPublic: true,
    });

    const secondArticle = await articleFactory.create({
      sectionId: section.id,
      title: `${prefix}-second`,
      status: "published",
      isPublic: true,
    });

    cleanup.add(async () => {
      const existingFirstArticle = await articleFactory.safeGetById(firstArticle.id);
      const existingSecondArticle = await articleFactory.safeGetById(secondArticle.id);

      await Promise.allSettled([
        existingFirstArticle ? articleFactory.delete(firstArticle.id) : Promise.resolve(),
        existingSecondArticle ? articleFactory.delete(secondArticle.id) : Promise.resolve(),
      ]);

      const existingSection = await articleFactory.safeGetSectionById(section.id);
      if (existingSection && existingSection.assignedArticlesCount === 0) {
        await articleFactory.deleteSection(section.id);
      }
    });

    await openArticleDetailsPageFlow(page, firstArticle.id);

    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.PANEL)).toBeVisible();
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(firstArticle.id))).toBeVisible();
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(secondArticle.id))).toBeVisible();
  });
});
