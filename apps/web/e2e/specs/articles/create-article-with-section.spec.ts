import { USER_ROLE } from "~/config/userRoles";

import { ARTICLES_TOC_HANDLES, CREATE_ARTICLE_DIALOG_HANDLES } from "../../data/articles/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openArticleDetailsPageFlow } from "../../flows/articles/open-article-details-page.flow";
import { openCreateArticleDialogFlow } from "../../flows/articles/open-create-article-dialog.flow";

test("admin can create section and article from articles TOC", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const articleFactory = factories.createArticleFactory();
    const { article: seedArticle, section: seedSection } = await articleFactory.createWithSection({
      status: "published",
      isPublic: true,
    });

    let createdSectionId = "";
    let createdArticleId = "";

    cleanup.add(async () => {
      const existingSeedArticle = await articleFactory.safeGetById(seedArticle.id);
      const existingCreatedArticle = createdArticleId
        ? await articleFactory.safeGetById(createdArticleId)
        : null;
      const existingCreatedSection = createdSectionId
        ? await articleFactory.safeGetSectionById(createdSectionId)
        : null;
      const existingSeedSection = await articleFactory.safeGetSectionById(seedSection.id);

      await Promise.allSettled([
        existingCreatedArticle ? articleFactory.delete(createdArticleId) : Promise.resolve(),
        existingSeedArticle ? articleFactory.delete(seedArticle.id) : Promise.resolve(),
      ]);

      if (existingCreatedSection && existingCreatedSection.assignedArticlesCount === 0) {
        await articleFactory.deleteSection(createdSectionId);
      }

      if (existingSeedSection && existingSeedSection.assignedArticlesCount === 0) {
        await articleFactory.deleteSection(seedSection.id);
      }
    });

    await openArticleDetailsPageFlow(page, seedArticle.id);

    const beforeSections = await articleFactory.getToc("en");
    const beforeSectionIds = new Set(beforeSections.map((section) => section.id));

    await page.getByTestId(ARTICLES_TOC_HANDLES.ADD_ACTION).click();
    await page.getByTestId(ARTICLES_TOC_HANDLES.CREATE_SECTION_ACTION).click();

    await expect
      .poll(async () => {
        const sections = await articleFactory.getToc("en");
        const createdSection = sections.find((section) => !beforeSectionIds.has(section.id));
        return createdSection?.id ?? "";
      })
      .not.toBe("");

    const sectionsAfterCreate = await articleFactory.getToc("en");
    const createdSection = sectionsAfterCreate.find((section) => !beforeSectionIds.has(section.id));

    if (!createdSection) {
      throw new Error("Expected created section in articles TOC");
    }

    createdSectionId = createdSection.id;

    await openCreateArticleDialogFlow(page);

    await page.getByTestId(CREATE_ARTICLE_DIALOG_HANDLES.SECTION_SELECT).click();
    await page.getByRole("option", { name: createdSection.title }).click();
    await page.getByTestId(CREATE_ARTICLE_DIALOG_HANDLES.CREATE_BUTTON).click();

    await expect(page).toHaveURL(/\/articles\/[a-f0-9-]+$/);
    createdArticleId = /\/articles\/([a-f0-9-]+)$/.exec(page.url())?.[1] ?? "";

    if (!createdArticleId) {
      throw new Error("Expected created article id in URL");
    }

    await expect(page.getByTestId(ARTICLES_TOC_HANDLES.article(createdArticleId))).toBeVisible();
  });
});
