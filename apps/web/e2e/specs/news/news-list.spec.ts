import { USER_ROLE } from "~/config/userRoles";

import { NEWS_PAGE_HANDLES } from "../../data/news/handles";
import { openNewsPageFlow } from "../../flows/news/open-news-page.flow";

import { expect, test } from "./news-test.fixture";

test("admin can browse news list", async ({ cleanup, factories, withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const newsFactory = factories.createNewsFactory();
    const prefix = `news-list-${Date.now()}`;
    const firstNews = await newsFactory.create({
      title: `${prefix}-first`,
      status: "published",
      isPublic: true,
    });
    const secondNews = await newsFactory.create({
      title: `${prefix}-second`,
      status: "published",
      isPublic: true,
    });

    cleanup.add(async () => {
      const existingFirstNews = await newsFactory.safeGetById(firstNews.id);
      const existingSecondNews = await newsFactory.safeGetById(secondNews.id);

      await Promise.allSettled([
        existingFirstNews ? newsFactory.delete(firstNews.id) : Promise.resolve(),
        existingSecondNews ? newsFactory.delete(secondNews.id) : Promise.resolve(),
      ]);
    });

    await openNewsPageFlow(page);

    await expect(page.getByTestId(NEWS_PAGE_HANDLES.HEADING)).toBeVisible();
    await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(firstNews.id))).toBeVisible();
    await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(secondNews.id))).toBeVisible();
  });
});
