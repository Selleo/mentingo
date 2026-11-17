import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES, ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { ArticleFactory } from "../../factories/article.factory";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";
import { overrideContentModuleState } from "../../utils/content-features";

import { expect, test } from "./articles.fixture";

const ROLES = [
  { role: USER_ROLE.admin, canManage: true },
  { role: USER_ROLE.contentCreator, canManage: false },
  { role: USER_ROLE.student, canManage: false },
] as const;

for (const { role, canManage } of ROLES) {
  test(`${role} can open an article and browse its section in the TOC`, async ({
    cleanup,
    withWorkerPage,
    workerTenantApiClient,
  }) => {
    const articleFactory = new ArticleFactory(workerTenantApiClient);
    const prefix = `article-access-${role}-${Date.now()}`;
    const { article, section } = await articleFactory.createWithSection({
      title: `${prefix}-first`,
      summary: `${prefix}-summary`,
      isPublic: true,
    });
    cleanup.add(() => articleFactory.safeDeleteSection(section.id));
    cleanup.add(() => articleFactory.safeDelete(article.id));
    const otherArticle = await articleFactory.create({
      sectionId: section.id,
      title: `${prefix}-second`,
      isPublic: true,
    });
    cleanup.add(() => articleFactory.safeDelete(otherArticle.id));

    await withWorkerPage(role, async ({ page }) => {
      await openArticleDetailsPageFlow(page, article.id);

      await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(article.title);
      await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(
        `${prefix}-summary`,
      );
      await expect(page.getByTestId(ARTICLES_TOC_HANDLES.PANEL)).toBeVisible();
      await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(article.id))).toBeVisible();
      await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(otherArticle.id))).toBeVisible();
      await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.EDIT_BUTTON)).toHaveCount(
        canManage ? 1 : 0,
      );
      await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.DELETE_BUTTON)).toHaveCount(
        canManage ? 1 : 0,
      );
    });
  });
}

test("visitor sees only public articles when public articles access is enabled", async ({
  cleanup,
  createWorkspacePage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await overrideContentModuleState(workerTenantApiClient, "articles", {
      enabled: true,
      public: true,
    }),
  );
  const articleFactory = new ArticleFactory(workerTenantApiClient);
  const { article: publicArticle, section } = await articleFactory.createWithSection({
    title: `article-public-${Date.now()}`,
    isPublic: true,
  });
  cleanup.add(() => articleFactory.safeDeleteSection(section.id));
  cleanup.add(() => articleFactory.safeDelete(publicArticle.id));
  const privateArticle = await articleFactory.create({
    sectionId: section.id,
    title: `article-private-${Date.now()}`,
    isPublic: false,
  });
  cleanup.add(() => articleFactory.safeDelete(privateArticle.id));
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openArticleDetailsPageFlow(page, publicArticle.id);
  await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(
    publicArticle.title,
  );
  await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(publicArticle.id))).toBeVisible();
  await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(privateArticle.id))).toHaveCount(0);

  await page.goto(`/articles/${privateArticle.id}`);
  await expect(page).not.toHaveURL(/\/auth\/login$/);
  await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.NOT_FOUND)).toBeVisible();
  await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveCount(0);
});
