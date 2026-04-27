import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES, ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";

import { expect, test } from "./article-test.fixture";

import type { ArticleFactory } from "../../factories/article.factory";
import type { FixtureApiClient } from "../../utils/api-client";

const ROLES: Array<{ role: USER_ROLE; title: string }> = [
  { role: USER_ROLE.contentCreator, title: "content creator" },
  { role: USER_ROLE.student, title: "student" },
];

const ensureArticleVisibilityForAllLocales = async ({
  articleId,
  apiClient,
  articleFactory,
  titlePrefix,
  summaryPrefix,
}: {
  articleId: string;
  apiClient: FixtureApiClient;
  articleFactory: ArticleFactory;
  titlePrefix: string;
  summaryPrefix: string;
}) => {
  const baseArticle = await articleFactory.getById(articleId, SUPPORTED_LANGUAGES.EN);

  for (const language of Object.values(SUPPORTED_LANGUAGES)) {
    if (!baseArticle.availableLocales.includes(language)) {
      await apiClient.api.articlesControllerAddNewLanguage(articleId, { language });
    }

    await articleFactory.update(articleId, {
      language,
      title: `${titlePrefix}-${language}`,
      summary: `${summaryPrefix}-${language}`,
      status: "published",
      isPublic: true,
    });
  }
};

for (const { role, title } of ROLES) {
  test(`${title} can open article details`, async ({ factories, apiClient, withReadonlyPage }) => {
    const articleFactory = factories.createArticleFactory();
    let articleId = "";
    let articleTitlePrefix = "";
    let sectionId = "";

    await withReadonlyPage(USER_ROLE.admin, async () => {
      const { article, section } = await articleFactory.createWithSection({
        title: `article-role-${title.replace(/\s+/g, "-")}-${Date.now()}`,
        summary: `article-role-summary-${Date.now()}`,
        status: "published",
        isPublic: true,
      });

      await ensureArticleVisibilityForAllLocales({
        articleId: article.id,
        apiClient,
        articleFactory,
        titlePrefix: `article-role-${title.replace(/\s+/g, "-")}`,
        summaryPrefix: "article-role-summary",
      });

      articleId = article.id;
      articleTitlePrefix = `article-role-${title.replace(/\s+/g, "-")}`;
      sectionId = section.id;
    });

    try {
      await withReadonlyPage(role, async ({ page }) => {
        await openArticleDetailsPageFlow(page, articleId);

        await expect(page).toHaveURL(new RegExp(`/articles/${articleId}$`));
        await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toContainText(
          articleTitlePrefix,
        );
        await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(articleId))).toBeVisible();
      });
    } finally {
      await withReadonlyPage(USER_ROLE.admin, async () => {
        await Promise.allSettled([
          articleId ? articleFactory.delete(articleId) : Promise.resolve(),
          sectionId ? articleFactory.deleteSection(sectionId) : Promise.resolve(),
        ]);
      });
    }
  });
}
