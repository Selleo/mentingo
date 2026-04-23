import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES, ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { ensureContentFeaturesEnabled } from "../../utils/content-features";

test("visitor cannot see private article when public articles access is enabled", async ({
  cleanup,
  factories,
  apiClient,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const restoreContentFeatures = await ensureContentFeaturesEnabled(apiClient, {
      publicArticles: true,
    });

    cleanup.add(restoreContentFeatures);

    const articleFactory = factories.createArticleFactory();
    const { article, section } = await articleFactory.createWithSection({
      title: `article-private-${Date.now()}`,
      summary: `article-private-summary-${Date.now()}`,
      status: "published",
      isPublic: false,
    });

    cleanup.add(async () => {
      const existingArticle = await articleFactory.safeGetById(article.id);
      if (existingArticle) {
        await articleFactory.delete(article.id);
      }

      const existingSection = await articleFactory.safeGetSectionById(section.id);
      if (existingSection && existingSection.assignedArticlesCount === 0) {
        await articleFactory.deleteSection(section.id);
      }
    });

    const browser = page.context().browser();

    if (!browser) {
      throw new Error("Expected browser instance for public context");
    }

    const publicContext = await browser.newContext();
    await publicContext.addInitScript(() => {
      localStorage.setItem(
        "language-storage",
        JSON.stringify({ state: { language: "en" }, version: 0 }),
      );
    });
    const publicPage = await publicContext.newPage();

    try {
      await publicPage.goto(`/articles/${article.id}`);
      await expect(publicPage).not.toHaveURL(/\/auth\/login$/);
      await expect(publicPage.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveCount(0);
      await expect(publicPage.getByTestId(ARTICLES_TOC_HANDLES.article(article.id))).toHaveCount(0);
    } finally {
      await publicContext.close();
    }
  });
});
