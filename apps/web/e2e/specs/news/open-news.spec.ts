import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";
import { openNewsDetailsFromListFlow } from "../../flows/news/open-news-details-from-list.flow";
import { openNewsPageFlow } from "../../flows/news/open-news-page.flow";

import { expect, test } from "./news-test.fixture";

test("admin can open news details from news list", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const title = `open-news-${Date.now()}`;
    const summary = `open-news-summary-${Date.now()}`;
    const news = await newsFactory.create({ title, summary, status: "published", isPublic: true });

    cleanup.add(async () => {
      const existingNews = await newsFactory.safeGetById(news.id);

      if (existingNews) {
        await newsFactory.delete(news.id);
      }
    });

    await openNewsPageFlow(page);
    await openNewsDetailsFromListFlow(page, news.id);

    await expect(page).toHaveURL(new RegExp(`/news/${news.id}$`));
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(title);
    await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(summary);
  });
});
