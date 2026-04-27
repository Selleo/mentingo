import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";
import { fillNewsFormFlow } from "../../flows/news/fill-news-form.flow";
import { openCreateNewsPageFlow } from "../../flows/news/open-create-news-page.flow";
import { submitNewsFormFlow } from "../../flows/news/submit-news-form.flow";

import { expect, test } from "./news-test.fixture";

test("admin can create news from the news page", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const title = `create-news-${Date.now()}`;
    const summary = `create-news-summary-${Date.now()}`;

    await openCreateNewsPageFlow(page);
    await fillNewsFormFlow(page, { title, summary, status: "published" });
    await submitNewsFormFlow(page);

    await expect(page).toHaveURL(/\/news\/[a-f0-9-]+$/);

    const createdNewsId = /\/news\/([a-f0-9-]+)$/.exec(page.url())?.[1];

    if (!createdNewsId) throw new Error("Expected created news id in URL");

    cleanup.add(async () => {
      const existingNews = await newsFactory.safeGetByIdAnyLanguage(createdNewsId);

      if (existingNews) await newsFactory.delete(createdNewsId);
    });

    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(title);
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(summary);
  });
});
