import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES, NEWS_PAGE_HANDLES } from "../../data/news/handles";
import { deleteNewsFlow } from "../../flows/news/delete-news.flow";
import { fillNewsFormFlow } from "../../flows/news/fill-news-form.flow";
import { openCreateNewsPageFlow } from "../../flows/news/open-create-news-page.flow";
import { submitNewsFormFlow } from "../../flows/news/submit-news-form.flow";
import { updateNewsFlow } from "../../flows/news/update-news.flow";

import { expect, test } from "./news.fixture";

test("admin can create, update and delete news", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const title = `news-lifecycle-${Date.now()}`;
    const summary = `news-lifecycle-summary-${Date.now()}`;
    const updatedTitle = `${title}-updated`;
    const updatedSummary = `${summary}-updated`;

    await openCreateNewsPageFlow(page);
    await fillNewsFormFlow(page, { title, summary, status: "published" });
    await submitNewsFormFlow(page);

    // The create page lives at /news/add, so match a UUID to wait for the saved news.
    await expect(page).toHaveURL(/\/news\/[a-f0-9]{8}-[a-f0-9-]+$/);
    const newsId = /\/news\/([a-f0-9]{8}-[a-f0-9-]+)$/.exec(page.url())?.[1];

    if (!newsId) throw new Error("Expected created news id in URL");

    cleanup.add(() => newsFactory.safeDelete(newsId));

    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(title);
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(summary);

    await updateNewsFlow(page, {
      newsId,
      title: updatedTitle,
      summary: updatedSummary,
      status: "published",
    });

    await expect(page).toHaveURL(new RegExp(`/news/${newsId}$`));
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(updatedTitle);
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(updatedSummary);
    await expect.poll(async () => (await newsFactory.getById(newsId)).title).toBe(updatedTitle);

    await deleteNewsFlow(page);

    await expect(page).toHaveURL(/\/news(\?.*)?$/);
    await expect(page.getByTestId(NEWS_PAGE_HANDLES.PAGE)).toBeVisible();
    await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(newsId))).toHaveCount(0);
    await expect.poll(() => newsFactory.safeGetById(newsId)).toBeNull();
  });
});
