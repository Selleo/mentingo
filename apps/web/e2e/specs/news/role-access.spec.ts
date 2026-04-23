import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES, NEWS_PAGE_HANDLES } from "../../data/news/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openNewsDetailsFromListFlow } from "../../flows/news/open-news-details-from-list.flow";
import { openNewsPageFlow } from "../../flows/news/open-news-page.flow";

const ROLES: Array<{ role: USER_ROLE; title: string }> = [
  { role: USER_ROLE.contentCreator, title: "content creator" },
  { role: USER_ROLE.student, title: "student" },
];

for (const { role, title } of ROLES) {
  test(`${title} can browse and open news details`, async ({ factories, withReadonlyPage }) => {
    const newsFactory = factories.createNewsFactory();
    let newsId = "";
    let newsTitle = "";

    await withReadonlyPage(USER_ROLE.admin, async () => {
      const news = await newsFactory.create({
        title: `news-role-${title.replace(/\s+/g, "-")}-${Date.now()}`,
        summary: `news-role-summary-${Date.now()}`,
        status: "published",
        isPublic: true,
      });

      newsId = news.id;
      newsTitle = news.title;
    });

    try {
      await withReadonlyPage(role, async ({ page }) => {
        await openNewsPageFlow(page);
        await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(newsId))).toBeVisible();

        await openNewsDetailsFromListFlow(page, newsId);

        await expect(page).toHaveURL(new RegExp(`/news/${newsId}$`));
        await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(newsTitle);
      });
    } finally {
      await withReadonlyPage(USER_ROLE.admin, async () => {
        const existingNews = newsId ? await newsFactory.safeGetById(newsId) : null;

        await Promise.allSettled([existingNews ? newsFactory.delete(newsId) : Promise.resolve()]);
      });
    }
  });
}
