import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";
import { openNewsDetailsPageFlow } from "../../flows/news/open-news-details-page.flow";

import { expect, test } from "./news-test.fixture";

test("admin can delete news from details page", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const news = await newsFactory.create({ status: "published", isPublic: true });

    cleanup.add(async () => {
      const existing = await newsFactory.safeGetById(news.id);
      if (existing) {
        await newsFactory.delete(news.id);
      }
    });

    await openNewsDetailsPageFlow(page, news.id);
    await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.DELETE_BUTTON).click();

    await expect(page).toHaveURL(/\/news(\?.*)?$/);
    await expect
      .poll(async () => {
        const deletedNews = await newsFactory.safeGetById(news.id);
        return deletedNews;
      })
      .toBeNull();
  });
});
