import { USER_ROLE } from "~/config/userRoles";

import { ARTICLE_DETAILS_PAGE_HANDLES, ARTICLES_TOC_HANDLES } from "../../data/articles/handles";
import { deleteArticleFlow } from "../../flows/articles/delete-article.flow";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";
import { updateArticleFlow } from "../../flows/articles/update-article.flow";
import { clickVisibleTestIdFlow } from "../../flows/click-visible-testid.flow";

import { expect, test } from "./articles.fixture";

test("admin can create a section and article from the TOC, update it and delete it", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const articleFactory = factories.createArticleFactory();
    const { article: seedArticle, section: seedSection } = await articleFactory.createWithSection({
      isPublic: true,
    });
    cleanup.add(() => articleFactory.safeDeleteSection(seedSection.id));
    cleanup.add(() => articleFactory.safeDelete(seedArticle.id));
    const updatedTitle = `updated-article-${Date.now()}`;
    const updatedSummary = `updated-article-summary-${Date.now()}`;

    await openArticleDetailsPageFlow(page, seedArticle.id);
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(seedArticle.id))).toBeVisible();

    const sectionIdsBefore = new Set((await articleFactory.getToc()).map(({ id }) => id));
    await clickVisibleTestIdFlow(page, ARTICLES_TOC_HANDLES.CREATE_SECTION_ACTION);

    let sectionId = "";
    await expect
      .poll(async () => {
        const sections = await articleFactory.getToc();
        sectionId = sections.find(({ id }) => !sectionIdsBefore.has(id))?.id ?? "";
        return sectionId;
      })
      .not.toBe("");
    cleanup.add(() => articleFactory.safeDeleteSection(sectionId));

    await page
      .getByTestId(ARTICLES_TOC_HANDLES.section(sectionId))
      .getByTestId(ARTICLES_TOC_HANDLES.CREATE_ARTICLE_ACTION)
      .click();

    await expect(page).toHaveURL(/\/articles\/[a-f0-9]{8}-[a-f0-9-]+$/);
    const articleId = /\/articles\/([a-f0-9]{8}-[a-f0-9-]+)$/.exec(page.url())?.[1];

    if (!articleId) throw new Error("Expected created article id in URL");

    cleanup.add(() => articleFactory.safeDelete(articleId));
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(articleId))).toBeVisible();

    await updateArticleFlow(page, { articleId, title: updatedTitle, summary: updatedSummary });

    await expect(page).toHaveURL(new RegExp(`/articles/${articleId}$`));
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(updatedTitle);
    await expect(page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(updatedSummary);
    await expect
      .poll(async () => (await articleFactory.getById(articleId)).title)
      .toBe(updatedTitle);

    await deleteArticleFlow(page);

    await expect(page).toHaveURL(/\/articles(\/[^/]+)?(\?.*)?$/);
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.PANEL)).toBeVisible();
    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(articleId))).toHaveCount(0);
    await expect.poll(() => articleFactory.safeGetById(articleId)).toBeNull();
  });
});
