import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { updateNewsFlow } from "../../flows/news/update-news.flow";

test("admin can update news title and summary", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const news = await newsFactory.create({ status: "published", isPublic: true });
    const updatedTitle = `updated-news-${Date.now()}`;
    const updatedSummary = `updated-news-summary-${Date.now()}`;

    cleanup.add(async () => {
      const existingNews = await newsFactory.safeGetById(news.id);

      if (existingNews) {
        await newsFactory.delete(news.id);
      }
    });

    await updateNewsFlow(page, {
      newsId: news.id,
      title: updatedTitle,
      summary: updatedSummary,
      status: "published",
    });

    await expect(page).toHaveURL(new RegExp(`/news/${news.id}$`));
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(updatedTitle);
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(updatedSummary);

    await expect
      .poll(async () => {
        const updatedNews = await newsFactory.getById(news.id);
        return updatedNews.title;
      })
      .toBe(updatedTitle);
  });
});
